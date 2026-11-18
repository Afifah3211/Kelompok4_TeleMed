"""MinIO helpers and Nginx edge authorization for chat image delivery."""

import hashlib
import hmac
import time
from urllib.parse import parse_qs, quote, urlencode, urlsplit

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from app.config import settings

router = APIRouter()


def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=f"http://{settings.MINIO_ENDPOINT}",
        aws_access_key_id=settings.MINIO_ACCESS_KEY,
        aws_secret_access_key=settings.MINIO_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def _ensure_bucket(s3, configure_read_policy: bool = False):
    created = False
    try:
        s3.head_bucket(Bucket=settings.MINIO_BUCKET)
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code")
        if code not in {"404", "NoSuchBucket", "NotFound"}:
            raise
        s3.create_bucket(Bucket=settings.MINIO_BUCKET)
        created = True

    # MinIO stays private from the host; Nginx's internal route is the only
    # application delivery path and checks a short-lived signed URL first.
    if created or configure_read_policy:
        policy = {
            "Version": "2012-10-17",
            "Statement": [{
                "Effect": "Allow",
                "Principal": "*",
                "Action": "s3:GetObject",
                "Resource": f"arn:aws:s3:::{settings.MINIO_BUCKET}/*",
            }],
        }
        import json

        s3.put_bucket_policy(Bucket=settings.MINIO_BUCKET, Policy=json.dumps(policy))


def init_minio_bucket() -> bool:
    try:
        _ensure_bucket(_s3_client(), configure_read_policy=True)
        return True
    except Exception:
        return False


def _cdn_url(key: str, ttl_seconds: int = 3600) -> str:
    expires = int(time.time()) + ttl_seconds
    signature = hmac.new(
        settings.JWT_SECRET.encode(),
        f"{key}:{expires}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"/files/{quote(key, safe='/')}?{urlencode({'expires': expires, 'signature': signature})}"


@router.get("/authorize", include_in_schema=False)
async def authorize_cdn_file(request: Request):
    """Nginx auth_request target: validate short-lived signed chat image URLs."""
    parsed = urlsplit(request.headers.get("x-original-uri", ""))
    if not parsed.path.startswith("/files/chat/"):
        raise HTTPException(status_code=403, detail="CDN hanya melayani gambar chat")
    key = parsed.path.removeprefix("/files/")
    query = parse_qs(parsed.query)
    try:
        expires = int(query.get("expires", [""])[0])
        supplied = query.get("signature", [""])[0]
    except ValueError:
        raise HTTPException(status_code=403, detail="Tanda tangan URL file tidak valid")

    now = int(time.time())
    if expires < now or expires > now + 3600:
        raise HTTPException(status_code=403, detail="URL gambar chat kedaluwarsa")
    expected = hmac.new(
        settings.JWT_SECRET.encode(),
        f"{key}:{expires}".encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=403, detail="Tanda tangan URL file tidak valid")
    return Response(status_code=204)
