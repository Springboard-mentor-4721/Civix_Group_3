import csv
import io
from datetime import datetime, timezone
from calendar import monthrange

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.petition import Petition
from app.models.signature import Signature
from app.models.official_response import OfficialResponse
from app.models.user import User
from app.schemas.petition import PetitionCategory, PetitionStatus
from app.routes.auth import require_official

router = APIRouter(prefix="/api/reports", tags=["Reports"])


def _month_range(year: int, month: int):
    """Return (start_dt, end_dt) for the given month."""
    _, last_day = monthrange(year, month)
    start = datetime(year, month, 1, 0, 0, 0)
    end   = datetime(year, month, last_day, 23, 59, 59)
    return start, end


def _build_stats(db: Session, year: int, month: int, official: User) -> dict:
    start, end = _month_range(year, month)

    def _petition_q():
        q = db.query(Petition)
        if official.department:
            dept_str = official.department.strip().lower()
            if dept_str not in ["municipal department", "general", "all", "official", "admin", ""]:
                matched_cat = None
                for cat in PetitionCategory:
                    if cat.value.lower() in dept_str or dept_str in cat.value.lower():
                        matched_cat = cat
                        break
                if matched_cat:
                    q = q.filter(Petition.category == matched_cat)
        return q

    # --- Monthly petitions (created this month) ---
    monthly_petitions = (
        _petition_q()
        .filter(Petition.created_at >= start, Petition.created_at <= end)
        .all()
    )
    monthly_ids = [p.id for p in monthly_petitions]

    # --- All petitions in jurisdiction & department (for status distribution) ---
    all_petitions = _petition_q().all()
    all_ids = [p.id for p in all_petitions]

    # --- Signatures this month ---
    monthly_signatures = (
        db.query(Signature)
        .filter(Signature.petition_id.in_(monthly_ids), Signature.timestamp >= start, Signature.timestamp <= end)
        .count()
    ) if monthly_ids else 0

    # --- Official responses this month ---
    monthly_responses = (
        db.query(OfficialResponse)
        .filter(OfficialResponse.petition_id.in_(monthly_ids), OfficialResponse.created_at >= start, OfficialResponse.created_at <= end)
        .count()
    ) if monthly_ids else 0

    # --- Resolved this month ---
    resolved_this_month = sum(
        1 for p in monthly_petitions if p.status == PetitionStatus.resolved
    )

    # --- Pending (active + under_review + in_progress) ---
    pending = sum(
        1 for p in all_petitions
        if p.status in (PetitionStatus.active, PetitionStatus.under_review, PetitionStatus.in_progress)
    )

    # --- Category breakdown (all jurisdiction petitions) ---
    category_counts = {}
    for cat in PetitionCategory:
        category_counts[cat.value] = sum(1 for p in all_petitions if p.category == cat)

    # --- Status distribution ---
    status_dist = {}
    for st in PetitionStatus:
        status_dist[st.value] = sum(1 for p in all_petitions if p.status == st)

    # --- Avg response time (hours) ---
    avg_response_hours = None
    responses = (
        db.query(OfficialResponse)
        .filter(OfficialResponse.petition_id.in_(all_ids))
        .all()
    ) if all_ids else []

    if responses:
        deltas = []
        for r in responses:
            pet = next((p for p in all_petitions if p.id == r.petition_id), None)
            if pet and pet.created_at and r.created_at:
                delta = (r.created_at - pet.created_at).total_seconds() / 3600
                if delta >= 0:
                    deltas.append(delta)
        if deltas:
            avg_response_hours = round(sum(deltas) / len(deltas), 1)

    # --- Daily activity trend (submissions + responses per day this month) ---
    _, last_day = monthrange(year, month)
    daily_trend = []
    for day in range(1, last_day + 1):
        day_start = datetime(year, month, day, 0, 0, 0)
        day_end   = datetime(year, month, day, 23, 59, 59)
        subs = sum(1 for p in monthly_petitions if day_start <= p.created_at <= day_end)
        resps = (
            db.query(OfficialResponse)
            .filter(OfficialResponse.petition_id.in_(monthly_ids), OfficialResponse.created_at >= day_start, OfficialResponse.created_at <= day_end)
            .count()
        ) if monthly_ids else 0
        daily_trend.append({"day": day, "submissions": subs, "responses": resps})

    # --- Top petitions by signatures ---
    top_petitions = []
    for p in sorted(all_petitions, key=lambda x: db.query(Signature).filter(Signature.petition_id == x.id).count(), reverse=True)[:5]:
        sig_count = db.query(Signature).filter(Signature.petition_id == p.id).count()
        top_petitions.append({
            "id": p.id,
            "title": p.title,
            "category": p.category.value if hasattr(p.category, "value") else str(p.category),
            "status": p.status.value if hasattr(p.status, "value") else str(p.status),
            "signature_count": sig_count,
            "signature_goal": p.signature_goal,
            "location": p.location,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })

    return {
        "year": year,
        "month": month,
        "jurisdiction": official.location or "",
        "department": official.department or "",
        # Summary KPIs
        "monthly_petitions": len(monthly_petitions),
        "monthly_signatures": monthly_signatures,
        "monthly_responses": monthly_responses,
        "resolved_this_month": resolved_this_month,
        "pending_petitions": pending,
        "total_petitions_jurisdiction": len(all_petitions),
        "avg_response_hours": avg_response_hours,
        # Breakdowns
        "category_breakdown": category_counts,
        "status_distribution": status_dist,
        "daily_trend": daily_trend,
        "top_petitions": top_petitions,
    }


@router.get("/monthly")
def get_monthly_report(
    year:  int = Query(default=None),
    month: int = Query(default=None, ge=1, le=12),
    current_user: User = Depends(require_official),
    db: Session = Depends(get_db),
):
    now = datetime.now()
    year  = year  or now.year
    month = month or now.month
    try:
        return _build_stats(db, year, month, current_user)
    except Exception as e:
        return {
            "year": year,
            "month": month,
            "jurisdiction": current_user.location or "",
            "department": current_user.department or "",
            "monthly_petitions": 0,
            "monthly_signatures": 0,
            "monthly_responses": 0,
            "resolved_this_month": 0,
            "pending_petitions": 0,
            "total_petitions_jurisdiction": 0,
            "avg_response_hours": None,
            "category_breakdown": {cat.value: 0 for cat in PetitionCategory},
            "status_distribution": {st.value: 0 for st in PetitionStatus},
            "daily_trend": [],
            "top_petitions": [],
        }


@router.get("/export/csv")
def export_csv(
    year:  int = Query(default=None),
    month: int = Query(default=None, ge=1, le=12),
    current_user: User = Depends(require_official),
    db: Session = Depends(get_db),
):
    now = datetime.now()
    year  = year  or now.year
    month = month or now.month
    stats = _build_stats(db, year, month, current_user)

    output = io.StringIO()
    writer = csv.writer(output)

    month_name = datetime(year, month, 1).strftime("%B %Y")
    writer.writerow(["CIVIX Monthly Civic Engagement Report"])
    writer.writerow([f"Period: {month_name}"])
    writer.writerow([f"Jurisdiction: {stats['jurisdiction']}"])
    writer.writerow([f"Department: {stats['department']}"])
    writer.writerow([f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}"])
    writer.writerow([])

    writer.writerow(["=== SUMMARY ==="])
    writer.writerow(["Metric", "Value"])
    writer.writerow(["Petitions Submitted (Month)", stats["monthly_petitions"]])
    writer.writerow(["Signatures Received (Month)", stats["monthly_signatures"]])
    writer.writerow(["Official Responses (Month)", stats["monthly_responses"]])
    writer.writerow(["Resolved This Month", stats["resolved_this_month"]])
    writer.writerow(["Pending Petitions", stats["pending_petitions"]])
    writer.writerow(["Total Petitions (Jurisdiction)", stats["total_petitions_jurisdiction"]])
    writer.writerow(["Avg Response Time (Hours)", stats["avg_response_hours"] or "N/A"])
    writer.writerow([])

    writer.writerow(["=== CATEGORY BREAKDOWN ==="])
    writer.writerow(["Category", "Count"])
    for cat, count in stats["category_breakdown"].items():
        writer.writerow([cat, count])
    writer.writerow([])

    writer.writerow(["=== STATUS DISTRIBUTION ==="])
    writer.writerow(["Status", "Count"])
    for st, count in stats["status_distribution"].items():
        writer.writerow([st.replace("_", " ").title(), count])
    writer.writerow([])

    writer.writerow(["=== TOP PETITIONS BY SIGNATURES ==="])
    writer.writerow(["ID", "Title", "Category", "Status", "Signatures", "Goal", "Location", "Created At"])
    for p in stats["top_petitions"]:
        writer.writerow([p["id"], p["title"], p["category"], p["status"],
                         p["signature_count"], p["signature_goal"], p["location"], p["created_at"]])
    writer.writerow([])

    writer.writerow(["=== DAILY ACTIVITY TREND ==="])
    writer.writerow(["Day", "Submissions", "Responses"])
    for d in stats["daily_trend"]:
        writer.writerow([d["day"], d["submissions"], d["responses"]])

    output.seek(0)
    filename = f"civix_report_{year}_{month:02d}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
