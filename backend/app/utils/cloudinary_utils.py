import os
import base64
import secrets
from fastapi import UploadFile, HTTPException, status
from dotenv import load_dotenv

load_dotenv()

CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY    = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

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
        print(f"Cloudinary initialization warning: {e}")


def upload_base64_image(data_url: str, folder: str = "civix/profile_pictures") -> dict:
    """
    Uploads a base64 data URL image to Cloudinary.
    Falls back to local storage if Cloudinary is not configured.
    Returns {"url": str, "public_id": str}
    """
    # Strip data URL prefix: "data:image/jpeg;base64,..."
    if "," in data_url:
        header, encoded = data_url.split(",", 1)
    else:
        encoded = data_url

    try:
        image_bytes = base64.b64decode(encoded)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image data")

    if len(image_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image too large (max 5MB)")

    if _cloudinary_available:
        try:
            import cloudinary.uploader
            res = cloudinary.uploader.upload(
                image_bytes,
                folder=folder,
                resource_type="image",
                unique_filename=True,
            )
            return {
                "url": res.get("secure_url") or res.get("url"),
                "public_id": res.get("public_id"),
            }
        except Exception as e:
            print(f"⚠️ Cloudinary upload failed ({e}). Falling back to local storage.")

    # Local fallback
    upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "profile_pictures")
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"profile_{secrets.token_hex(10)}.jpg"
    filepath = os.path.join(upload_dir, filename)
    with open(filepath, "wb") as f:
        f.write(image_bytes)
    return {
        "url": f"/uploads/profile_pictures/{filename}",
        "public_id": filename,
    }


def save_file_to_cloudinary_or_local(file: UploadFile, folder: str = "official_documents", sub_dir: str = "verification_docs") -> dict:
    content = file.file.read()
    file_size = len(content)
    file_type = file.content_type or "application/octet-stream"

    if _cloudinary_available:
        try:
            import cloudinary.uploader
            res = cloudinary.uploader.upload(
                content,
                folder=f"civix/{folder}",
                resource_type="auto",
                unique_filename=True,
            )
            return {
                "url": res.get("secure_url") or res.get("url"),
                "public_id": res.get("public_id"),
                "type": file_type,
                "size": file_size,
            }
        except Exception as e:
            print(f"Cloudinary upload failed: {e}. Using local storage.")

    # Local storage fallback
    upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", sub_dir)
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1] or ".bin"
    filename = f"doc_{secrets.token_hex(10)}{ext}"
    filepath = os.path.join(upload_dir, filename)
    with open(filepath, "wb") as f:
        f.write(content)

    return {
        "url": f"/uploads/{sub_dir}/{filename}",
        "public_id": filename,
        "type": file_type,
        "size": file_size,
    }
