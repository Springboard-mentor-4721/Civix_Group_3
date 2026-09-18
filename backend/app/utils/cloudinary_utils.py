import os
import secrets
from fastapi import UploadFile, HTTPException, status
from dotenv import load_dotenv

load_dotenv()

CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY    = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

# Try initializing Cloudinary SDK
_cloudinary_available = False
if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
    try:
        import cloudinary
        import cloudinary.uploader
        cloudinary.config(
            cloud_name=CLOUDINARY_CLOUD_NAME,
            api_key=CLOUDINARY_API_KEY,
            api_secret=CLOUDINARY_API_SECRET,
            secure=True
        )
        _cloudinary_available = True
    except Exception as e:
        print(f"⚠️ Cloudinary initialization warning: {e}")
        _cloudinary_available = False

MAX_FILE_SIZE_BYTES = 700 * 1024  # 700 KB
BLOCKED_EXTENSIONS  = {".zip", ".rar", ".7z", ".tar", ".gz", ".exe", ".bat", ".sh"}
ALLOWED_EXTENSIONS  = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}


def validate_file_upload(file: UploadFile) -> str:
    """Strictly validates file extension and size (Max 700 KB, no ZIP)."""
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()

    if ext in BLOCKED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ZIP and archive files are strictly prohibited. Please upload PDF, JPG, PNG, or WEBP."
        )

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF, JPG, JPEG, PNG, and WEBP files are allowed."
        )

    # Check file size (700 KB max limit)
    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)

    if size > MAX_FILE_SIZE_BYTES:
        size_kb = round(size / 1024, 1)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size ({size_kb} KB) exceeds the strict 700 KB maximum limit."
        )

    return ext


def save_file_to_cloudinary_or_local(
    file: UploadFile,
    folder: str = "civix_uploads",
    sub_dir: str = "profile_pictures"
) -> dict:
    """
    Validates and uploads file to Cloudinary if configured.
    Falls back to local /uploads/ directory if Cloudinary credentials are not set.
    Returns dict: {"url": str, "public_id": Optional[str], "type": str, "size": int}
    """
    ext = validate_file_upload(file)
    content = file.file.read()
    file_size = len(content)
    public_id = None

    # 1. Attempt Cloudinary upload if configured
    if _cloudinary_available:
        try:
            import cloudinary.uploader
            resource_type = "raw" if ext == ".pdf" else "image"
            res = cloudinary.uploader.upload(
                content,
                folder=f"civix/{folder}",
                resource_type=resource_type,
                use_filename=True,
                unique_filename=True
            )
            secure_url = res.get("secure_url") or res.get("url")
            public_id  = res.get("public_id")
            if secure_url:
                return {
                    "url": secure_url,
                    "public_id": public_id,
                    "type": ext.lstrip('.'),
                    "size": file_size
                }
        except Exception as e:
            print(f"⚠️ Cloudinary upload failed ({e}). Falling back to local storage.")

    # 2. Fallback local storage
    upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", sub_dir)
    os.makedirs(upload_dir, exist_ok=True)

    safe_name = f"file_{secrets.token_hex(8)}{ext}"
    file_path = os.path.join(upload_dir, safe_name)

    with open(file_path, "wb") as f:
        f.write(content)

    local_url = f"/uploads/{sub_dir}/{safe_name}"
    return {
        "url": local_url,
        "public_id": safe_name,
        "type": ext.lstrip('.'),
        "size": file_size
    }

