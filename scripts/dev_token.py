"""Create a local development signing key or a short-lived MCP access token."""

import argparse
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import time


ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env"


def read_env(path=ENV_FILE):
    values = {}
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                name, value = line.split("=", 1)
                values[name.strip()] = value.strip()
    return values


def setting(name, values):
    value = os.environ.get(name) or values.get(name)
    if not value:
        raise ValueError(f"{name} is required in .env or the environment")
    return value


def signing_key(values):
    encoded = setting("JWT_SIGNING_KEY_BASE64", values)
    key = base64.b64decode(encoded, validate=True)
    if len(key) < 32:
        raise ValueError("JWT_SIGNING_KEY_BASE64 must contain at least 32 random bytes")
    return key


def encode_part(value):
    data = json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode()
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def create_token(key, issuer, audience, subject="demo-user", issued_at=None, expires_at=None):
    now = int(time.time()) if issued_at is None else issued_at
    expiry = now + 3600 if expires_at is None else expires_at
    header = encode_part({"alg": "HS256", "typ": "JWT"})
    payload = encode_part({
        "iss": issuer,
        "aud": audience,
        "sub": subject,
        "iat": now,
        "nbf": now,
        "exp": expiry,
    })
    message = f"{header}.{payload}".encode()
    signature = base64.urlsafe_b64encode(hmac.new(key, message, hashlib.sha256).digest())
    return f"{header}.{payload}.{signature.rstrip(b'=').decode()}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--init-key", action="store_true", help="add a random key to .env")
    parser.add_argument("--subject", default="demo-user", help="token subject")
    args = parser.parse_args()
    values = read_env()

    if args.init_key:
        if not ENV_FILE.exists():
            parser.error("copy .env.example to .env first")
        if os.environ.get("JWT_SIGNING_KEY_BASE64") or values.get("JWT_SIGNING_KEY_BASE64"):
            signing_key(values)
            print("Development signing key already configured.")
            return
        encoded = base64.b64encode(secrets.token_bytes(32)).decode()
        with ENV_FILE.open("a") as env_file:
            env_file.write(f"\nJWT_SIGNING_KEY_BASE64={encoded}\n")
        ENV_FILE.chmod(0o600)
        print("Development signing key added to .env.")
        return

    if not args.subject.strip():
        parser.error("subject cannot be empty")
    print(create_token(
        signing_key(values),
        setting("JWT_ISSUER", values),
        setting("JWT_AUDIENCE", values),
        subject=args.subject.strip(),
    ))


if __name__ == "__main__":
    main()
