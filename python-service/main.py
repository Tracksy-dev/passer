"""
main.py — Render-hosted FastAPI service for volleyball smash detection.

Endpoints:
  GET  /health        → Render health check
  POST /detect        → start a detection job in a background thread
  DELETE /jobs/{id}   → signal a running job to cancel
"""

import os
import threading

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from runner import run_detection

_cancel_flags: dict[str, threading.Event] = {}

API_SECRET = os.environ.get("RENDER_API_SECRET", "")


def _check_auth(authorization: str | None) -> None:
    if not API_SECRET:
        return  # no secret configured — open (local dev only)
    if authorization != f"Bearer {API_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")


class DetectRequest(BaseModel):
    video_url: str
    job_id: str
    match_id: str
    detector_version: str = "v6_improved"


app = FastAPI()


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/detect", status_code=202)
def detect(
    req: DetectRequest,
    authorization: str | None = Header(default=None),
):
    _check_auth(authorization)

    cancel_flag = threading.Event()
    _cancel_flags[req.job_id] = cancel_flag

    def _run():
        try:
            run_detection(
                req.video_url,
                req.job_id,
                req.match_id,
                req.detector_version,
                cancel_flag,
            )
        finally:
            _cancel_flags.pop(req.job_id, None)

    threading.Thread(target=_run, daemon=True).start()
    return {"accepted": True, "job_id": req.job_id}


@app.delete("/jobs/{job_id}")
def cancel_job(
    job_id: str,
    authorization: str | None = Header(default=None),
):
    _check_auth(authorization)
    flag = _cancel_flags.get(job_id)
    if flag:
        flag.set()
        return {"cancelled": True}
    return {"cancelled": False, "message": "Job not found or already completed"}
