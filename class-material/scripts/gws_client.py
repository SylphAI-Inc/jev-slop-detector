#!/usr/bin/env python3
"""Thin wrapper around the `gws` CLI for Drive + Slides API calls.

Auth is handled by the gws CLI (keyring). Every call returns parsed JSON.
"""
import json
import subprocess


def call(args: list[str], retries: int = 2, cwd: str | None = None) -> dict:
    """Run `gws <args>` and return the parsed JSON payload. Retries on transient errors."""
    last = None
    for attempt in range(retries + 1):
        r = subprocess.run(["gws"] + args, capture_output=True, text=True, cwd=cwd)
        out = r.stdout
        marker = "Using keyring backend: keyring"
        if marker in out:
            out = out.split(marker)[-1]
        out = out.strip()
        try:
            parsed = json.loads(out)
        except json.JSONDecodeError:
            parsed = {"error": {"message": f"non-JSON output: {out[:500]} | stderr: {r.stderr[:500]}"}}
        if "error" in parsed:
            last = parsed
            continue
        return parsed
    raise RuntimeError(f"gws call failed after {retries + 1} attempts: {args}\n{json.dumps(last)[:2000]}")


def upload(file_path: str, name: str, mime: str, cwd: str | None = None) -> dict:
    """Upload a file. `file_path` must resolve inside `cwd` (gws rejects paths outside cwd)."""
    return call([
        "drive", "files", "create",
        "--json", json.dumps({"name": name, "mimeType": mime}),
        "--upload", file_path,
        "--upload-content-type", mime,
    ], cwd=cwd)


def share_anyone_reader(file_id: str) -> None:
    call([
        "drive", "permissions", "create",
        "--params", json.dumps({"fileId": file_id}),
        "--json", json.dumps({"role": "reader", "type": "anyone"}),
    ])


def get_file(file_id: str, fields: str) -> dict:
    return call(["drive", "files", "get", "--params", json.dumps({"fileId": file_id, "fields": fields})])


def create_presentation(name: str) -> dict:
    return call([
        "drive", "files", "create",
        "--json", json.dumps({"name": name, "mimeType": "application/vnd.google-apps.presentation"}),
    ])


def slides_get(presentation_id: str, fields: str = "") -> dict:
    params = {"presentationId": presentation_id}
    if fields:
        params["fields"] = fields
    return call(["slides", "presentations", "get", "--params", json.dumps(params)])


def slides_batch_update(presentation_id: str, requests: list[dict]) -> dict:
    return call([
        "slides", "presentations", "batchUpdate",
        "--params", json.dumps({"presentationId": presentation_id}),
        "--json", json.dumps({"requests": requests}),
    ])
