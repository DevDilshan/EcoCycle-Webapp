"""Upload the prepared Sri Lanka boundary files to Supabase Storage.

The outlines are about 20 MB, so they are served from a public storage bucket
instead of living in the repository. Run this after
prepare_sri_lanka_boundaries.py whenever the files are regenerated:

    python scripts/upload_boundaries.py

Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment, or from
backend/.env. Existing files are replaced; nothing else in the project is touched.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "frontend" / "public" / "data" / "sri-lanka-boundaries"
BUCKET = "boundary-data"
FOLDER = "sri-lanka-boundaries"


def setting(name):
    value = os.environ.get(name)
    if value:
        return value.strip()
    env = ROOT / "backend" / ".env"
    if env.exists():
        match = re.search(rf"^{name}=(.*)$", env.read_text(encoding="utf-8"), re.M)
        if match:
            return match.group(1).strip().strip('"')
    sys.exit(f"{name} is not set (environment or backend/.env).")


def call(method, url, key, body=None, headers=None):
    request = urllib.request.Request(url, data=body, method=method)
    request.add_header("apikey", key)
    request.add_header("Authorization", f"Bearer {key}")
    for name, value in (headers or {}).items():
        request.add_header(name, value)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code


def main():
    base = setting("SUPABASE_URL").rstrip("/") + "/storage/v1"
    key = setting("SUPABASE_SERVICE_ROLE_KEY")
    files = sorted(p for p in SOURCE.iterdir() if p.suffix in (".geojson", ".json"))
    if not any(p.suffix == ".geojson" for p in files):
        sys.exit(f"No .geojson files in {SOURCE}. Run prepare_sri_lanka_boundaries.py first.")

    if call("GET", f"{base}/bucket/{BUCKET}", key) != 200:
        status = call("POST", f"{base}/bucket", key,
                      json.dumps({"id": BUCKET, "name": BUCKET, "public": True}).encode(),
                      {"Content-Type": "application/json"})
        if status not in (200, 201, 409):
            sys.exit(f"Could not create the {BUCKET} bucket (HTTP {status}).")
        print(f"created public bucket {BUCKET}")

    failed = 0
    for path in files:
        status = call("POST", f"{base}/object/{BUCKET}/{FOLDER}/{path.name}", key, path.read_bytes(), {
            "Content-Type": "application/json",
            "Cache-Control": "max-age=86400",
            "x-upsert": "true",
        })
        ok = status in (200, 201)
        failed += not ok
        print(f"{'ok ' if ok else 'FAILED'} {path.name} ({path.stat().st_size / 1e6:.1f} MB){'' if ok else f' HTTP {status}'}")

    print(f"{len(files) - failed} of {len(files)} uploaded to {base}/object/public/{BUCKET}/{FOLDER}/")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
