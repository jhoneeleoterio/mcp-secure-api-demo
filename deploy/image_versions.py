#!/usr/bin/env python3
"""Select image builds and commit tags for a verified main release."""

import json
import re
import sys
from urllib.request import Request, urlopen


# The first release that published API, MCP and web together.
BASELINE_SHA = "2f3b1dc1899209ef31063d256625dec155234fdc"
REPOSITORY = "jhoneeleoterio/mcp-secure-api-demo"
SHA_PATTERN = re.compile(r"[0-9a-f]{40}\Z")
BACKEND_FILES = {"Dockerfile", "Dockerfile.Mcp", "Directory.Build.props", "AcmeCommerce.slnx"}
WEB_FILES = {"Dockerfile.Web", "deploy/Caddyfile"}


def classify(paths):
    paths = set(paths)
    backend = any(path.startswith("src/") or path in BACKEND_FILES or path == ".dockerignore" for path in paths)
    web = any(path.startswith("frontend/") or path in WEB_FILES or path == ".dockerignore" for path in paths)
    return backend, web


def fetch_commit(sha):
    request = Request(
        f"https://api.github.com/repos/{REPOSITORY}/commits/{sha}?per_page=100",
        headers={"Accept": "application/vnd.github+json", "User-Agent": "acmecommerce-deploy"},
    )
    with urlopen(request, timeout=20) as response:
        if 'rel="next"' in response.headers.get("Link", ""):
            raise ValueError("Commit has more changed files than can be classified safely")
        return json.load(response)


def resolve(target, fetch=fetch_commit):
    if not SHA_PATTERN.fullmatch(target):
        raise ValueError("Expected a full commit SHA")

    backend_tag = None
    web_tag = None
    seen = set()
    current = target
    while current != BASELINE_SHA:
        if current in seen or len(seen) >= 100:
            raise ValueError("Could not reach the first combined image release")
        seen.add(current)
        commit = fetch(current)
        if commit.get("sha") != current:
            raise ValueError("Commit response SHA does not match the request")
        files = commit.get("files")
        parents = commit.get("parents")
        if not isinstance(files, list) or not isinstance(parents, list) or not parents:
            raise ValueError("Commit response is incomplete")
        backend_changed, web_changed = classify(file["filename"] for file in files)
        if backend_changed and backend_tag is None:
            backend_tag = current
        if web_changed and web_tag is None:
            web_tag = current
        if backend_tag and web_tag:
            break
        current = parents[0]["sha"]
        if not SHA_PATTERN.fullmatch(current):
            raise ValueError("Commit parent SHA is invalid")

    return backend_tag or BASELINE_SHA, web_tag or BASELINE_SHA


def main():
    if len(sys.argv) == 2 and sys.argv[1] == "classify":
        paths = (part.decode("utf-8") for part in sys.stdin.buffer.read().split(b"\0") if part)
        backend, web = classify(paths)
        print(f"backend={'true' if backend else 'false'}")
        print(f"web={'true' if web else 'false'}")
    elif len(sys.argv) == 3 and sys.argv[1] == "resolve":
        backend_tag, web_tag = resolve(sys.argv[2])
        print(backend_tag)
        print(web_tag)
    else:
        raise SystemExit("Usage: image_versions.py classify|resolve <main commit SHA>")


if __name__ == "__main__":
    main()
