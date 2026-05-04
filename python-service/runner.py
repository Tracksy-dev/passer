"""
runner.py — Subprocess wrapper for the smash detector.

Spawns ModelV6.py / ModelV6Improved.py, parses its JSON-line progress output,
and mirrors every status update to Supabase via the service-role key.
On completion it reads the output JSON, runs the same temporal dedup used
by the Next.js route, and stores the final payload in ai_jobs.result_json.
"""

import json
import os
import subprocess
import tempfile
import threading
from datetime import datetime, timezone

from supabase import create_client

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

SCRIPT_MAP: dict[str, str] = {
    "v6":          os.path.join(BASE_DIR, "ModelV6.py"),
    "v6_improved": os.path.join(BASE_DIR, "ModelV6Improved.py"),
}

DEDUP_WINDOW_SEC = 1.0


def _supabase():
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )


# ── payload helpers (mirrors route.ts logic) ─────────────────────────────────

def _parse_ts(raw: str) -> float | None:
    parts = raw.strip().split(".")
    if len(parts) != 3:
        return None
    try:
        m, s, cs = int(parts[0]), int(parts[1]), int(parts[2])
    except ValueError:
        return None
    return round(m * 60 + s + cs / 100, 2)


def _merge_by_min_gap(events: list[dict], window: float) -> list[dict]:
    merged: list[dict] = []
    for e in events:
        if merged and e["sec"] - merged[-1]["sec"] <= window:
            if e["conf"] > merged[-1]["conf"]:
                merged[-1] = e
        else:
            merged.append(e)
    return merged


def _build_payload(smash_list: list[str], conf_map: dict, match_id: str) -> dict:
    parsed: list[dict] = []
    for raw in smash_list:
        sec = _parse_ts(raw)
        if sec is not None:
            parsed.append({"raw": raw, "sec": sec, "conf": conf_map.get(raw, 0.0)})

    parsed.sort(key=lambda e: e["sec"])
    merged = _merge_by_min_gap(parsed, DEDUP_WINDOW_SEC)

    points = []
    for e in merged:
        pt: dict = {
            "timestamp_seconds": e["sec"],
            "label": "smash",
            "note": "AI detected smash",
        }
        if e["conf"] > 0:
            pt["confidence"] = e["conf"]
        points.append(pt)

    return {
        "success": True,
        "matchId": match_id,
        "cached": False,
        "smashRaw": [e["raw"] for e in merged],
        "smashSeconds": [e["sec"] for e in merged],
        "smashProjectPoints": points,
    }


# ── main runner ───────────────────────────────────────────────────────────────

def run_detection(
    video_url: str,
    job_id: str,
    match_id: str,
    detector_version: str,
    cancel_flag: threading.Event,
) -> None:
    db = _supabase()
    script = SCRIPT_MAP.get(detector_version, SCRIPT_MAP["v6_improved"])

    def update(patch: dict) -> None:
        db.table("ai_jobs").update(patch).eq("id", job_id).execute()

    output_json = tempfile.mktemp(suffix=".json")

    try:
        proc = subprocess.Popen(
            ["python3", script, video_url, "--output-json", output_json],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=BASE_DIR,
            text=True,
        )

        stderr_lines: list[str] = []

        def _drain_stderr() -> None:
            assert proc.stderr
            for line in proc.stderr:
                stderr_lines.append(line)

        threading.Thread(target=_drain_stderr, daemon=True).start()

        assert proc.stdout
        for line in proc.stdout:
            if cancel_flag.is_set():
                proc.terminate()
                update({
                    "status": "cancelled",
                    "progress": 100,
                    "message": "Cancelled by user",
                    "finished_at": datetime.now(timezone.utc).isoformat(),
                })
                return

            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                evt = json.loads(line)
                if evt.get("type") == "progress":
                    patch: dict = {}
                    for key in ("status", "progress", "message", "processed_frames", "total_frames"):
                        if key in evt:
                            patch[key] = evt[key]
                    if patch:
                        update(patch)
            except (json.JSONDecodeError, Exception):
                pass

        proc.wait()

        if proc.returncode != 0:
            update({
                "status": "failed",
                "progress": 100,
                "message": "Failed",
                "error_text": "".join(stderr_lines).strip()
                    or f"Detector exited with code {proc.returncode}",
                "finished_at": datetime.now(timezone.utc).isoformat(),
            })
            return

        try:
            with open(output_json, encoding="utf-8") as f:
                data = json.load(f)
        except Exception as exc:
            update({
                "status": "failed",
                "progress": 100,
                "message": "Failed",
                "error_text": f"Could not read detector output: {exc}",
                "finished_at": datetime.now(timezone.utc).isoformat(),
            })
            return

        smash_list = [v for v in data.get("smash", []) if isinstance(v, str)]
        conf_map = data.get("smash_confidence", {})
        if not isinstance(conf_map, dict):
            conf_map = {}

        payload = _build_payload(smash_list, conf_map, match_id)
        update({
            "status": "completed",
            "progress": 100,
            "message": "Completed",
            "result_json": payload,
            "error_text": None,
            "finished_at": datetime.now(timezone.utc).isoformat(),
        })

    except Exception as exc:
        update({
            "status": "failed",
            "progress": 100,
            "message": "Failed",
            "error_text": str(exc),
            "finished_at": datetime.now(timezone.utc).isoformat(),
        })
    finally:
        try:
            os.unlink(output_json)
        except FileNotFoundError:
            pass
