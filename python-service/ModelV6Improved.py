"""
ModelV6Improved.py — Volleyball smash detector (Option A, production-ready)

Changes vs ModelV6.py
─────────────────────
  1. All pixel thresholds normalised by bounding-box body height so that
     thresholds are camera-distance and resolution agnostic.
  2. FPS-adaptive cooldown and history window derived from actual video FPS.
  3. Hip-keypoint airborne gating via a per-track EMA baseline.  When no
     baseline is established yet the gate is left open (don't penalise new tracks).
  4. Wrist apex check: wrist must reach ≥75 % of body height above the
     bottom of the bounding box before a swing counts.
  5. Confidence score per detection (geometric mean of speed/drop margin
     ratios, clamped 0–1) exposed in a new `smash_confidence` key.
  6. Structured `type:"detection"` events emitted to stdout alongside
     existing `type:"progress"` events so the API layer can log them.
  7. KP_CONF_MIN raised from 0.25 → 0.30 to reduce jitter on fast motion.
  8. Backward-compatible output: `smash` array is preserved exactly; the
     new `smash_confidence` key is optional and additive.

Precision-first changes (anti-overlap / smash sparsity)
────────────────────────────────────────────────────────
  A. Global 1.0 s refractory gate: any candidate within 1.0 s of the last
     accepted smash is silently dropped, regardless of track identity.
  B. Confidence quality gate: events below SMASH_MIN_CONFIDENCE are dropped.
  C. Attack-phase pre-condition: arm must be raised for ≥ MIN_RAISED_FRAMES
     consecutive frames before a downswing trigger is accepted.  This
     eliminates false positives from momentary arm lifts.
  D. Stricter motion thresholds: DOWN_SPEED, DOWN_TOTAL, and WRIST_APEX all
     tightened to reduce saturated 1.0 confidence scores.
  E. Per-track cooldown raised from ~500 ms to ~700 ms.
  F. Post-processing temporal cluster merge: any two recorded events within
     CLUSTER_WINDOW_SEC are collapsed to the highest-confidence one.
  G. End-of-run summary printed as a structured JSON line.
"""

import argparse
import json
import os
import tempfile
from collections import defaultdict, deque

import cv2
import requests
import torch
from ultralytics import YOLO

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ─────────────────────────────────────────────────────────────
# OUTPUT PATHS
# ─────────────────────────────────────────────────────────────
OUTPUT_DIR = os.path.join(BASE_DIR, "runs", "video_output_pose")
DEFAULT_OUTPUT_JSON = os.path.join(BASE_DIR, "runs", "output_smash_detection.json")
OUTPUT_VIDEO = os.path.join(OUTPUT_DIR, "smash_detection_output.mp4")
WRITE_OUTPUT_VIDEO = False

# ─────────────────────────────────────────────────────────────
# MODEL + DETECTION SETTINGS
# ─────────────────────────────────────────────────────────────
POSE_MODEL = "yolov8s-pose.pt"
TRACKER_CFG = "bytetrack.yaml"
CONF_THRES = 0.30   # raised from 0.25; fewer low-confidence detections
IOU_THRES  = 0.6
IMGSZ      = 960
MAX_DET    = 25

# ─────────────────────────────────────────────────────────────
# KEYPOINT CONFIDENCE MINIMUM
# ─────────────────────────────────────────────────────────────
KP_CONF_MIN = 0.30  # raised from 0.25; reduces noisy wrist coordinates

# ─────────────────────────────────────────────────────────────
# NORMALISED HEURISTIC THRESHOLDS
# All values are *fractions of bounding-box height* so they are invariant
# to camera distance, zoom, and output resolution.
# ─────────────────────────────────────────────────────────────
DOWN_SPEED_THRES_NORM = 0.07   # wrist downward speed ≥ 7 % of body height / frame  [was 0.05]
DOWN_TOTAL_THRES_NORM = 0.28   # total wrist drop    ≥ 28 % of body height           [was 0.20]
WRIST_APEX_NORM_MIN   = 0.82   # wrist must reach    ≥ 82 % of body height above bbox bottom  [was 0.75]
JUMP_HEIGHT_NORM_MIN  = 0.05   # hip elevation       ≥ 5  % of body height above EMA baseline
HIP_EMA_ALPHA         = 0.10   # slow EMA (frozen when arm is raised)

# ─────────────────────────────────────────────────────────────
# PRECISION-FIRST ANTI-OVERLAP GATES
# Quick-tune priority: GLOBAL_MIN_GAP_SEC > SMASH_MIN_CONFIDENCE > MIN_RAISED_FRAMES
# ─────────────────────────────────────────────────────────────
GLOBAL_MIN_GAP_SEC   = 1.0    # no two final smash points < 1.0 s apart (cross-track)
SMASH_MIN_CONFIDENCE = 0.35   # drop events below this quality threshold (0 = disabled)
MIN_RAISED_FRAMES    = 3      # arm must be raised ≥ N consecutive frames before swing counts
CLUSTER_WINDOW_SEC   = 1.0    # post-processing: merge any survivors within this window

# ─────────────────────────────────────────────────────────────
# TRACK SETTINGS
# ─────────────────────────────────────────────────────────────
MIN_TRACK_AGE = 5   # slightly higher than V6 (4) to give time for hip baseline to form

# FPS-adaptive parameters — computed once inside run() after FPS is read
# history_size         = max(6,  round(fps * 0.4))   ~400 ms window
# cooldown_frames      = max(10, round(fps * 0.7))   ~700 ms between events  [was 0.5]
# global_min_gap_frames = max(1, round(fps * GLOBAL_MIN_GAP_SEC))

# ─────────────────────────────────────────────────────────────
# COCO 17 KEYPOINT INDICES
# ─────────────────────────────────────────────────────────────
NOSE       = 0
L_SHOULDER = 5;  R_SHOULDER = 6
L_WRIST    = 9;  R_WRIST    = 10
L_HIP      = 11; R_HIP      = 12

# ─────────────────────────────────────────────────────────────
# Per-track mutable state
# (module-level so they persist across frames within one process invocation)
# ─────────────────────────────────────────────────────────────
track_age              = defaultdict(int)
cooldown               = defaultdict(int)
wrist_hist             = {}                         # tid -> deque; created lazily after FPS is known
hip_baseline           = defaultdict(lambda: None)  # tid -> float | None
arm_raised_consecutive = defaultdict(int)           # tid -> consecutive frames arm was raised


# ─────────────────────────────────────────────────────────────
# PROGRESS / DETECTION EMITTERS
# ─────────────────────────────────────────────────────────────

def emit_progress(status, message, progress=None, processed_frames=None, total_frames=None):
    payload = {"type": "progress", "status": status, "message": message}
    if progress is not None:
        payload["progress"] = int(max(0, min(100, progress)))
    if processed_frames is not None:
        payload["processed_frames"] = int(max(0, processed_frames))
    if total_frames is not None:
        payload["total_frames"] = int(max(0, total_frames))
    print(json.dumps(payload), flush=True)


def emit_detection(timestamp_str: str, confidence: float):
    """Structured detection event consumed by the API layer for logging."""
    print(json.dumps({
        "type": "detection",
        "timestamp": timestamp_str,
        "confidence": round(confidence, 3),
    }), flush=True)


# ─────────────────────────────────────────────────────────────
# HELPERS (unchanged from V6)
# ─────────────────────────────────────────────────────────────

def format_timestamp_ms(ms: float) -> str:
    if ms is None:
        ms = 0
    ms = int(ms)
    minutes = ms // 60000
    seconds = (ms % 60000) // 1000
    centi   = (ms % 1000) // 10
    return f"{minutes}.{seconds:02d}.{centi:02d}"


def save_json(d: dict, path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(d, f, indent=2)


def kp_ok(c) -> bool:
    return c is not None and c >= KP_CONF_MIN


def get_kp(xy, conf, idx):
    x, y = xy[idx]
    c    = conf[idx]
    return float(x), float(y), float(c)


def choose_wrist(kp_xy, kp_conf):
    """
    Pick the wrist most likely to be the attacking arm.

    When both wrists are visible with similar confidence, the one that is
    *higher in the frame* (smaller Y) is preferred, since the smashing arm
    is elevated above the non-hitting arm.
    """
    _, ny, nc = get_kp(kp_xy, kp_conf, NOSE)

    _, wy_l, wc_l = get_kp(kp_xy, kp_conf, L_WRIST)
    _, wy_r, wc_r = get_kp(kp_xy, kp_conf, R_WRIST)
    _, sy_l, sc_l = get_kp(kp_xy, kp_conf, L_SHOULDER)
    _, sy_r, sc_r = get_kp(kp_xy, kp_conf, R_SHOULDER)

    l_ok = kp_ok(wc_l)
    r_ok = kp_ok(wc_r)

    if l_ok and r_ok:
        # Both visible: prefer the *higher* wrist unless confidence differs significantly
        CONF_MARGIN = 0.15
        if abs(wc_r - wc_l) > CONF_MARGIN:
            # Clearly one arm is better tracked — trust confidence
            if wc_r >= wc_l:
                wy, wc, sy, sc = wy_r, wc_r, sy_r, sc_r
            else:
                wy, wc, sy, sc = wy_l, wc_l, sy_l, sc_l
        else:
            # Similar confidence: pick the higher wrist (smaller Y = more elevated)
            if wy_r <= wy_l:
                wy, wc, sy, sc = wy_r, wc_r, sy_r, sc_r
            else:
                wy, wc, sy, sc = wy_l, wc_l, sy_l, sc_l
    elif r_ok:
        wy, wc, sy, sc = wy_r, wc_r, sy_r, sc_r
    elif l_ok:
        wy, wc, sy, sc = wy_l, wc_l, sy_l, sc_l
    else:
        # Neither wrist trackable — return zero-confidence sentinel
        wy, wc = (wy_r + wy_l) / 2, 0.0
        sy, sc = (sy_r + sy_l) / 2, 0.0

    return wy, wc, sy, sc, ny, nc


def is_arm_raised(wy, wc, sy, sc, ny, nc) -> bool:
    """Wrist must be above shoulder or above head (unchanged from V6)."""
    if not (kp_ok(wc) and (kp_ok(sc) or kp_ok(nc))):
        return False
    above_shoulder = kp_ok(sc) and (wy < sy + 5)   # +5 px shoulder margin (orig: -SHOULDER_MARGIN)
    above_head     = kp_ok(nc) and (wy < ny - 6)    # 6 px head margin (orig: HEAD_MARGIN)
    return above_shoulder or above_head


# ─────────────────────────────────────────────────────────────
# DETECTION HELPERS
# ─────────────────────────────────────────────────────────────

def wrist_reached_apex(wy: float, wc: float, body_h: float, box_y2: float) -> bool:
    """
    Wrist must be in the upper portion of the bounding box before the swing counts.
    Measured as (box_y2 - wy) / body_h — fraction of body height above the bbox bottom.
    At shoulder level this is typically 0.55–0.65; above head it is 0.85+.
    We require ≥ WRIST_APEX_NORM_MIN (0.82) so setters and arm-pushes cannot trigger.
    """
    if not kp_ok(wc):
        return False
    wrist_height_norm = (box_y2 - wy) / body_h
    return wrist_height_norm >= WRIST_APEX_NORM_MIN


def swing_down_detected_norm(
    tid, frame_idx: int, wy: float, body_h: float, history_size: int
) -> tuple[bool, float]:
    """
    Normalised downward-swing detector.

    Returns (triggered, confidence) where confidence ∈ [0, 1] is the geometric
    mean of how much the speed and drop thresholds are exceeded.

    Normalising by body_h makes the thresholds invariant to:
      • camera distance (distant player → smaller pixel values, same fraction)
      • video resolution
      • zoom level
    """
    if tid not in wrist_hist:
        wrist_hist[tid] = deque(maxlen=history_size)

    wrist_hist[tid].append((frame_idx, wy))

    if len(wrist_hist[tid]) < 4:
        return False, 0.0

    (f1, y1), (f2, y2) = wrist_hist[tid][-2], wrist_hist[tid][-1]
    df = max(1, f2 - f1)

    # Positive = wrist moving down in image space (Y increases downward)
    down_speed_norm = (y2 - y1) / df / body_h

    # Total drop from peak (smallest Y seen in the window)
    ys = [y for (_, y) in wrist_hist[tid]]
    total_drop_norm = (wy - min(ys)) / body_h

    if down_speed_norm < DOWN_SPEED_THRES_NORM or total_drop_norm < DOWN_TOTAL_THRES_NORM:
        return False, 0.0

    # Confidence: geometric mean of threshold-excess ratios, clamped to [0, 1].
    # Tighter thresholds mean genuine smashes yield scores spread across [0.35, 1.0]
    # rather than saturating at 1.0, making SMASH_MIN_CONFIDENCE actually useful.
    speed_ratio = min(2.0, down_speed_norm / DOWN_SPEED_THRES_NORM)
    drop_ratio  = min(2.0, total_drop_norm  / DOWN_TOTAL_THRES_NORM)
    conf = min(1.0, (speed_ratio * drop_ratio) ** 0.5)

    return True, float(conf)


def update_hip_baseline(tid, kp_xy, kp_conf, is_raised: bool) -> None:
    """
    Update the per-track hip EMA baseline.

    Frozen while the arm is raised (is_raised=True) so that a jump-attack
    in progress does not corrupt the resting hip position.
    """
    if is_raised:
        return

    hy_l = kp_xy[L_HIP][1] if kp_conf[L_HIP] >= KP_CONF_MIN else None
    hy_r = kp_xy[R_HIP][1] if kp_conf[R_HIP] >= KP_CONF_MIN else None
    hips = [h for h in [hy_l, hy_r] if h is not None]

    if not hips:
        return

    avg_hip = sum(hips) / len(hips)
    if hip_baseline[tid] is None:
        hip_baseline[tid] = avg_hip
    else:
        # Slow EMA — baseline drifts with camera pans but ignores transient jumps
        hip_baseline[tid] = (1 - HIP_EMA_ALPHA) * hip_baseline[tid] + HIP_EMA_ALPHA * avg_hip


def is_player_airborne(kp_xy, kp_conf, body_h: float, hip_bl) -> bool:
    """
    Returns True if the player's hips are elevated above the EMA resting baseline.

    Falls back to True (gate open) when:
      • hip_bl is None (not enough frames yet for this track)
      • neither hip keypoint is visible
    This avoids penalising new tracks or occluded players.
    """
    if hip_bl is None:
        return True   # no baseline yet — don't block

    hy_l = kp_xy[L_HIP][1] if kp_conf[L_HIP] >= KP_CONF_MIN else None
    hy_r = kp_xy[R_HIP][1] if kp_conf[R_HIP] >= KP_CONF_MIN else None
    hips = [h for h in [hy_l, hy_r] if h is not None]

    if not hips:
        return True   # no hip data — don't block

    avg_hip = sum(hips) / len(hips)
    # In image coords, smaller Y = higher up.  lift_norm > 0 means player jumped.
    lift_norm = (hip_bl - avg_hip) / body_h
    return lift_norm >= JUMP_HEIGHT_NORM_MIN


# ─────────────────────────────────────────────────────────────
# TEMPORAL CLUSTER MERGE  (pure helper — also tested in test_smash_dedup.py)
# ─────────────────────────────────────────────────────────────

def _parse_ts_sec(ts: str) -> float:
    """Parse "M.SS.CS" timestamp string to fractional seconds."""
    parts = ts.split(".")
    if len(parts) != 3:
        return 0.0
    return int(parts[0]) * 60 + int(parts[1]) + int(parts[2]) / 100


def temporal_cluster_merge(
    smash_list: list,
    confidence_map: dict,
    window_sec: float,
) -> tuple:
    """
    Collapse any two smash timestamps within window_sec into one, keeping
    the highest-confidence representative.  The window is sliding: when a
    higher-confidence event replaces the cluster anchor the anchor time
    advances, which can absorb a later event that was farther from the
    original anchor but still close to the new one.

    Boundary definition: gap <= window_sec → merged; gap > window_sec → separate.

    Returns (merged_list, merged_confidence_map).
    """
    if not smash_list:
        return [], {}

    items = sorted(smash_list, key=_parse_ts_sec)

    anchor_raw  = items[0]
    anchor_conf = confidence_map.get(items[0], 0.0)
    anchor_sec  = _parse_ts_sec(items[0])

    out_raw: list = []
    out_conf: dict = {}

    for ts in items[1:]:
        t    = _parse_ts_sec(ts)
        conf = confidence_map.get(ts, 0.0)
        if t - anchor_sec <= window_sec:
            if conf > anchor_conf:
                anchor_raw  = ts
                anchor_conf = conf
                anchor_sec  = t
        else:
            out_raw.append(anchor_raw)
            out_conf[anchor_raw] = anchor_conf
            anchor_raw  = ts
            anchor_conf = conf
            anchor_sec  = t

    out_raw.append(anchor_raw)
    out_conf[anchor_raw] = anchor_conf
    return out_raw, out_conf


# ─────────────────────────────────────────────────────────────
# VIDEO DOWNLOAD
# ─────────────────────────────────────────────────────────────

def ensure_local_video(path_or_url: str) -> str:
    if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
        emit_progress("downloading", "Downloading video", 5)
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
        temp_file.close()

        response = requests.get(path_or_url, stream=True, timeout=120)
        response.raise_for_status()

        with open(temp_file.name, "wb") as f:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)

        emit_progress("downloading", "Download complete", 10)
        return temp_file.name

    emit_progress("downloading", "Using local video file", 10)
    return path_or_url


# ─────────────────────────────────────────────────────────────
# MAIN DETECTION LOOP
# ─────────────────────────────────────────────────────────────

def run(video_path: str, output_json_path: str):
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    local_video = ensure_local_video(video_path)

    cap = cv2.VideoCapture(local_video)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {local_video}")

    fps          = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    cap.release()

    if not fps or fps <= 0:
        fps = 30.0

    # Derive timing parameters from actual FPS
    history_size          = max(6,  round(fps * 0.4))            # ~400 ms wrist history
    cooldown_frames       = max(10, round(fps * 0.7))            # ~700 ms dead time per track
    global_min_gap_frames = max(1,  round(fps * GLOBAL_MIN_GAP_SEC))

    # Negative start so the very first detection is never blocked by the global gate
    last_global_smash_frame = -global_min_gap_frames
    raw_candidate_count     = 0   # total per-track trigger fires (before any gate)

    emit_progress("loading_model", "Loading model", 15)
    model = YOLO(POSE_MODEL)

    emit_progress("processing", "Analyzing frames", 20,
                  processed_frames=0, total_frames=total_frames)

    stream = model.track(
        source=local_video,
        stream=True,
        persist=True,
        verbose=False,
        conf=CONF_THRES,
        iou=IOU_THRES,
        imgsz=IMGSZ,
        max_det=MAX_DET,
        tracker=TRACKER_CFG,
    )

    out          = None
    log          = {"smash": [], "smash_confidence": {}}
    prev_present = False
    frame_idx    = 0

    for result in stream:
        t_ms  = (frame_idx / fps) * 1000.0
        t_str = format_timestamp_ms(t_ms)

        frame = None
        if WRITE_OUTPUT_VIDEO and result.orig_img is not None:
            frame = result.orig_img.copy()
            if out is None:
                h, w = frame.shape[:2]
                out = cv2.VideoWriter(
                    OUTPUT_VIDEO, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h)
                )

        # Decrement per-track cooldowns
        for tid in list(cooldown.keys()):
            cooldown[tid] -= 1
            if cooldown[tid] <= 0:
                cooldown.pop(tid, None)

        smash_present_now = False
        pending_conf      = 0.0   # best confidence from a new trigger this frame

        if result.boxes is None or len(result.boxes) == 0 or result.keypoints is None:
            if WRITE_OUTPUT_VIDEO and out is not None and frame is not None:
                out.write(frame)
            frame_idx += 1
            if total_frames > 0 and frame_idx % 60 == 0:
                progress = 20 + int((frame_idx / total_frames) * 70)
                emit_progress("processing", "Analyzing frames", progress,
                              processed_frames=frame_idx, total_frames=total_frames)
            continue

        boxes    = result.boxes.xyxy
        ids      = result.boxes.id
        if ids is None:
            ids = torch.arange(len(boxes), device=boxes.device)

        boxes_np = boxes.cpu().numpy().astype(int)
        ids_np   = ids.cpu().numpy().astype(int)
        kp_xy    = result.keypoints.xy.cpu().numpy()
        kp_cf    = result.keypoints.conf.cpu().numpy()

        for i, ((x1, y1_box, x2, y2_box), tid) in enumerate(zip(boxes_np, ids_np)):
            track_age[tid] += 1
            if track_age[tid] < MIN_TRACK_AGE:
                continue

            body_h = max(10.0, float(y2_box - y1_box))   # bounding-box height proxy

            wy, wc, sy, sc, ny, nc = choose_wrist(kp_xy[i], kp_cf[i])

            raised   = is_arm_raised(wy, wc, sy, sc, ny, nc)
            apex     = wrist_reached_apex(wy, wc, body_h, float(y2_box))
            swing, swing_conf = swing_down_detected_norm(
                tid, frame_idx, wy, body_h, history_size
            )

            # Maintain consecutive raised-arm counter for attack-phase pre-condition
            if raised:
                arm_raised_consecutive[tid] += 1
            else:
                arm_raised_consecutive[tid] = 0

            # Update hip baseline only when not in an attack pose
            update_hip_baseline(tid, kp_xy[i], kp_cf[i], raised)

            airborne = is_player_airborne(kp_xy[i], kp_cf[i], body_h, hip_baseline[tid])

            # All conditions must pass.  arm_raised_consecutive enforces that there
            # was a clear raise-then-swing sequence, not a momentary arm lift.
            attack_phase = arm_raised_consecutive[tid] >= MIN_RAISED_FRAMES
            if raised and apex and swing and airborne and attack_phase:
                raw_candidate_count += 1
                cooldown[tid] = cooldown_frames
                if swing_conf > pending_conf:
                    pending_conf = swing_conf

            if cooldown.get(tid, 0) > 0:
                smash_present_now = True
                if WRITE_OUTPUT_VIDEO and frame is not None:
                    cv2.rectangle(frame, (x1, y1_box), (x2, y2_box), (0, 255, 0), 4)
                    cv2.putText(frame, "smash",
                                (x1, max(20, y1_box - 10)),
                                cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 3)

        # Record on rising edge (transition from no-smash to smash).
        # Global refractory gate: drop if any smash was accepted within GLOBAL_MIN_GAP_SEC,
        # regardless of which track triggered.  Confidence gate: drop low-quality events.
        if smash_present_now and not prev_present:
            gap_ok  = (frame_idx - last_global_smash_frame) >= global_min_gap_frames
            conf_ok = (SMASH_MIN_CONFIDENCE <= 0) or (pending_conf >= SMASH_MIN_CONFIDENCE)
            if gap_ok and conf_ok and (not log["smash"] or log["smash"][-1] != t_str):
                log["smash"].append(t_str)
                conf_to_store = round(pending_conf, 3)
                log["smash_confidence"][t_str] = conf_to_store
                emit_detection(t_str, conf_to_store)
                last_global_smash_frame = frame_idx

        prev_present = smash_present_now

        if WRITE_OUTPUT_VIDEO and out is not None and frame is not None:
            out.write(frame)

        frame_idx += 1
        if total_frames > 0 and frame_idx % 60 == 0:
            progress = 20 + int((frame_idx / total_frames) * 70)
            emit_progress("processing", "Analyzing frames", progress,
                          processed_frames=frame_idx, total_frames=total_frames)

    emit_progress("finalizing", "Finalizing results", 95)

    if out is not None:
        out.release()

    # Post-processing safety net: collapse any survivors still within CLUSTER_WINDOW_SEC
    # (e.g. brief tracking gaps that produced two rising edges inside the same rally).
    pre_cluster_count = len(log["smash"])
    merged_smash, merged_conf = temporal_cluster_merge(
        log["smash"], log["smash_confidence"], CLUSTER_WINDOW_SEC
    )
    log["smash"]            = merged_smash
    log["smash_confidence"] = merged_conf
    final_count = len(merged_smash)

    # Structured end-of-run summary for observability
    print(json.dumps({
        "type":           "summary",
        "raw_candidates": raw_candidate_count,
        "pre_cluster":    pre_cluster_count,
        "final_kept":     final_count,
    }), flush=True)

    save_json(log, output_json_path)

    emit_progress("completed", "Completed", 100,
                  processed_frames=frame_idx, total_frames=total_frames)


# ─────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(
        description="Volleyball smash detector (V6 Improved — normalised heuristics)"
    )
    parser.add_argument("video_input_path")
    parser.add_argument("--output-json", default=DEFAULT_OUTPUT_JSON)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run(args.video_input_path, args.output_json)
