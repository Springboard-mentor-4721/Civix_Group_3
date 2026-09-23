import unittest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.models.user import User, UserRole
from app.utils.security import hash_password
from app.utils.jwt import create_access_token

# Setup SQLite in-memory test database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


class TestPollsModule(unittest.TestCase):

    def setUp(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        db = TestingSessionLocal()

        self.citizen = User(
            name="Test Citizen",
            email="citizen@test.com",
            password=hash_password("password123"),
            role=UserRole.citizen,
            email_verified=True,
            face_verified=True
        )

        self.official1 = User(
            name="Official One",
            email="official1@test.com",
            password=hash_password("password123"),
            role=UserRole.official,
            department="Infrastructure Dept",
            department_id="INF-101",
            email_verified=True,
            face_verified=True,
            must_change_password=False
        )

        self.official2 = User(
            name="Official Two",
            email="official2@test.com",
            password=hash_password("password123"),
            role=UserRole.official,
            department="Health Dept",
            department_id="HLT-202",
            email_verified=True,
            face_verified=True,
            must_change_password=False
        )

        db.add(self.citizen)
        db.add(self.official1)
        db.add(self.official2)
        db.commit()

        from app.models.petition import Petition, PetitionStatus
        self.test_petition = Petition(
            title="Fix Chas Road",
            description="Road needs fixing",
            category="Infrastructure",
            location="Chas",
            creator_id=self.citizen.id,
            signature_goal=100,
            status=PetitionStatus.active
        )
        db.add(self.test_petition)
        db.commit()

        self.petition_id = self.test_petition.id

        c_token = create_access_token(user_id=self.citizen.id, role="citizen")
        o1_token = create_access_token(user_id=self.official1.id, role="official")
        o2_token = create_access_token(user_id=self.official2.id, role="official")

        db.close()

        self.citizen_headers = {"Authorization": f"Bearer {c_token}"}
        self.official1_headers = {"Authorization": f"Bearer {o1_token}"}
        self.official2_headers = {"Authorization": f"Bearer {o2_token}"}

    def test_1_official_can_create_poll(self):
        now = datetime.utcnow()
        payload = {
            "title": "Road Repair Priority Poll",
            "question": "Which road requires immediate repaving in Chas?",
            "description": "Public poll for identifying critical road maintenance priorities.",
            "category": "Infrastructure",
            "location": "Chas",
            "petition_id": self.petition_id,
            "start_at": (now - timedelta(hours=1)).isoformat(),
            "end_at": (now + timedelta(days=7)).isoformat(),
            "options": [
                {"option_text": "Station Road", "display_order": 0},
                {"option_text": "Main Market Avenue", "display_order": 1}
            ]
        }
        response = client.post("/api/polls", json=payload, headers=self.official1_headers)
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["title"], "Road Repair Priority Poll")
        self.assertEqual(len(data["options"]), 2)
        self.assertEqual(data["status"], "active")
        self.assertEqual(data["petition_id"], self.petition_id)

    def test_2_citizen_cannot_create_poll(self):
        now = datetime.utcnow()
        payload = {
            "title": "Unauthorized Poll",
            "question": "Can citizens create polls?",
            "category": "Education",
            "location": "Central District",
            "petition_id": self.petition_id,
            "start_at": now.isoformat(),
            "end_at": (now + timedelta(days=2)).isoformat(),
            "options": [{"option_text": "Yes"}, {"option_text": "No"}]
        }
        response = client.post("/api/polls", json=payload, headers=self.citizen_headers)
        self.assertEqual(response.status_code, 403)

    def test_3_poll_creation_validation_minimum_two_options(self):
        now = datetime.utcnow()
        payload = {
            "title": "Single Option Poll",
            "question": "Invalid?",
            "category": "Public Safety",
            "location": "District 1",
            "petition_id": self.petition_id,
            "start_at": now.isoformat(),
            "end_at": (now + timedelta(days=2)).isoformat(),
            "options": [{"option_text": "Only One Option"}]
        }
        response = client.post("/api/polls", json=payload, headers=self.official1_headers)
        self.assertIn(response.status_code, [400, 422])

    def test_4_empty_option_rejected(self):
        now = datetime.utcnow()
        payload = {
            "title": "Empty Option Poll",
            "question": "Is empty text valid?",
            "category": "Environment",
            "location": "Locality A",
            "petition_id": self.petition_id,
            "start_at": now.isoformat(),
            "end_at": (now + timedelta(days=2)).isoformat(),
            "options": [{"option_text": "Valid Option"}, {"option_text": "   "}]
        }
        response = client.post("/api/polls", json=payload, headers=self.official1_headers)
        self.assertIn(response.status_code, [400, 422])

    def test_5_duplicate_option_rejected(self):
        now = datetime.utcnow()
        payload = {
            "title": "Duplicate Option Poll",
            "question": "Duplicates allowed?",
            "category": "Transportation",
            "location": "City Center",
            "petition_id": self.petition_id,
            "start_at": now.isoformat(),
            "end_at": (now + timedelta(days=2)).isoformat(),
            "options": [{"option_text": "Option A"}, {"option_text": "option a"}]
        }
        response = client.post("/api/polls", json=payload, headers=self.official1_headers)
        self.assertIn(response.status_code, [400, 422])

    def test_6_citizen_can_view_active_poll(self):
        now = datetime.utcnow()
        create_res = client.post("/api/polls", json={
            "title": "Park Sanitation Poll",
            "question": "Should waste bins be increased?",
            "category": "Environment",
            "location": "Green Park",
            "petition_id": self.petition_id,
            "start_at": (now - timedelta(hours=1)).isoformat(),
            "end_at": (now + timedelta(days=5)).isoformat(),
            "options": [{"option_text": "Yes"}, {"option_text": "No"}]
        }, headers=self.official1_headers)
        poll_id = create_res.json()["id"]

        list_res = client.get("/api/polls", headers=self.citizen_headers)
        self.assertEqual(list_res.status_code, 200)
        self.assertGreaterEqual(list_res.json()["total"], 1)

        detail_res = client.get(f"/api/polls/{poll_id}", headers=self.citizen_headers)
        self.assertEqual(detail_res.status_code, 200)
        self.assertFalse(detail_res.json()["has_voted"])

    def test_7_citizen_can_vote_and_cannot_vote_twice(self):
        now = datetime.utcnow()
        create_res = client.post("/api/polls", json={
            "title": "Bus Stop Shelter",
            "question": "Add new bus shelter?",
            "category": "Transportation",
            "location": "Route 4",
            "petition_id": self.petition_id,
            "start_at": (now - timedelta(minutes=30)).isoformat(),
            "end_at": (now + timedelta(days=3)).isoformat(),
            "options": [{"option_text": "Support"}, {"option_text": "Oppose"}]
        }, headers=self.official1_headers)
        poll_data = create_res.json()
        poll_id = poll_data["id"]
        opt_id = poll_data["options"][0]["id"]

        # First vote -> 200 OK
        vote_res = client.post(f"/api/polls/{poll_id}/vote", json={"option_id": opt_id}, headers=self.citizen_headers)
        self.assertEqual(vote_res.status_code, 200)
        res_data = vote_res.json()
        self.assertEqual(res_data["total_votes"], 1)
        self.assertEqual(res_data["options"][0]["votes"], 1)
        self.assertEqual(res_data["options"][0]["percentage"], 100.0)

        # Second vote -> 409 Conflict (already_voted)
        repeat_vote = client.post(f"/api/polls/{poll_id}/vote", json={"option_id": opt_id}, headers=self.citizen_headers)
        self.assertEqual(repeat_vote.status_code, 409)
        self.assertEqual(repeat_vote.json()["detail"]["code"], "already_voted")

    def test_8_vote_option_belonging_to_another_poll_rejected(self):
        now = datetime.utcnow()
        p1 = client.post("/api/polls", json={
            "title": "Poll One", "question": "Q1?", "category": "Housing", "location": "Area A",
            "petition_id": self.petition_id,
            "start_at": (now - timedelta(minutes=10)).isoformat(), "end_at": (now + timedelta(days=1)).isoformat(),
            "options": [{"option_text": "P1-O1"}, {"option_text": "P1-O2"}]
        }, headers=self.official1_headers).json()

        p2 = client.post("/api/polls", json={
            "title": "Poll Two", "question": "Q2?", "category": "Housing", "location": "Area B",
            "petition_id": self.petition_id,
            "start_at": (now - timedelta(minutes=10)).isoformat(), "end_at": (now + timedelta(days=1)).isoformat(),
            "options": [{"option_text": "P2-O1"}, {"option_text": "P2-O2"}]
        }, headers=self.official1_headers).json()

        bad_vote = client.post(f"/api/polls/{p1['id']}/vote", json={"option_id": p2["options"][0]["id"]}, headers=self.citizen_headers)
        self.assertEqual(bad_vote.status_code, 400)
        self.assertEqual(bad_vote.json()["detail"]["code"], "invalid_poll_option")

    def test_9_voting_on_closed_or_scheduled_poll_rejected(self):
        now = datetime.utcnow()
        sched_poll = client.post("/api/polls", json={
            "title": "Future Poll", "question": "Future?", "category": "Healthcare", "location": "Zone C",
            "petition_id": self.petition_id,
            "start_at": (now + timedelta(days=2)).isoformat(), "end_at": (now + timedelta(days=5)).isoformat(),
            "options": [{"option_text": "Opt 1"}, {"option_text": "Opt 2"}]
        }, headers=self.official1_headers).json()

        vote_sched = client.post(f"/api/polls/{sched_poll['id']}/vote", json={"option_id": sched_poll["options"][0]["id"]}, headers=self.citizen_headers)
        self.assertEqual(vote_sched.status_code, 400)

        closed_poll = client.post("/api/polls", json={
            "title": "Past Poll", "question": "Expired?", "category": "Healthcare", "location": "Zone C",
            "petition_id": self.petition_id,
            "start_at": (now - timedelta(days=10)).isoformat(), "end_at": (now - timedelta(days=2)).isoformat(),
            "options": [{"option_text": "Opt 1"}, {"option_text": "Opt 2"}]
        }, headers=self.official1_headers).json()

        vote_closed = client.post(f"/api/polls/{closed_poll['id']}/vote", json={"option_id": closed_poll["options"][0]["id"]}, headers=self.citizen_headers)
        self.assertEqual(vote_closed.status_code, 400)

    def test_10_poll_ownership_enforcement(self):
        now = datetime.utcnow()
        p1 = client.post("/api/polls", json={
            "title": "Official 1 Poll", "question": "Owner check?", "category": "Education", "location": "School 5",
            "petition_id": self.petition_id,
            "start_at": now.isoformat(), "end_at": (now + timedelta(days=1)).isoformat(),
            "options": [{"option_text": "A"}, {"option_text": "B"}]
        }, headers=self.official1_headers).json()

        edit_res = client.put(f"/api/polls/{p1['id']}", json={"title": "Hacked Title"}, headers=self.official2_headers)
        self.assertEqual(edit_res.status_code, 403)

        del_res = client.delete(f"/api/polls/{p1['id']}", headers=self.official2_headers)
        self.assertEqual(del_res.status_code, 403)

    def test_11_zero_vote_poll_results(self):
        now = datetime.utcnow()
        p = client.post("/api/polls", json={
            "title": "Zero Vote Test", "question": "Zero?", "category": "Housing", "location": "Chas",
            "petition_id": self.petition_id,
            "start_at": (now - timedelta(minutes=5)).isoformat(), "end_at": (now + timedelta(days=1)).isoformat(),
            "options": [{"option_text": "A"}, {"option_text": "B"}]
        }, headers=self.official1_headers).json()

        res = client.get(f"/api/polls/{p['id']}/results", headers=self.citizen_headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total_votes"], 0)
        self.assertEqual(data["options"][0]["percentage"], 0.0)
        self.assertEqual(data["options"][1]["percentage"], 0.0)

    def test_12_petition_linked_poll_creation(self):
        from app.models.petition import Petition, PetitionStatus
        db = TestingSessionLocal()
        pet = Petition(
            title="Clean Up Market Road",
            description="Market road is clogged with waste",
            category="Environment",
            location="Chas",
            creator_id=self.citizen.id,
            signature_goal=100,
            status=PetitionStatus.active
        )
        db.add(pet)
        db.commit()
        pet_id = pet.id
        db.close()

        now = datetime.utcnow()
        payload = {
            "title": "Clean Up Priority Poll",
            "question": "Which action should be taken first?",
            "category": "Environment",
            "location": "Chas",
            "petition_id": pet_id,
            "start_at": (now - timedelta(minutes=5)).isoformat(),
            "end_at": (now + timedelta(days=5)).isoformat(),
            "options": [{"option_text": "Install Bins"}, {"option_text": "Deploy Sweep Team"}]
        }

        res = client.post("/api/polls", json=payload, headers=self.official1_headers)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["petition_id"], pet_id)

    def test_13_poll_creation_without_petition_rejected(self):
        now = datetime.utcnow()
        payload = {
            "title": "Unlinked Poll",
            "question": "No petition?",
            "category": "Infrastructure",
            "location": "Chas",
            "start_at": now.isoformat(),
            "end_at": (now + timedelta(days=1)).isoformat(),
            "options": [{"option_text": "A"}, {"option_text": "B"}]
        }
        res = client.post("/api/polls", json=payload, headers=self.official1_headers)
        self.assertIn(res.status_code, [400, 422])

    def test_14_unauthenticated_poll_access_rejected(self):
        unauth_list = client.get("/api/polls")
        self.assertIn(unauth_list.status_code, [401, 403])


if __name__ == "__main__":
    unittest.main()

