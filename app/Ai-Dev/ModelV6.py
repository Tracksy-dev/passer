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

# ============================================================
# OUTPUT PATHS
# ============================================================
OUTPUT_DIR = os.path.join(BASE_DIR, "runs", "video_output_pose")
DEFAULT_OUTPUT_JSON = os.path.join(BASE_DIR, "runs", "output_smash_detection.json")
OUTPUT_VIDEO = os.path.join(OUTPUT_DIR, "smash_detection_output.mp4")
WRITE_OUTPUT_VIDEO = False

# ============================================================
# MODEL + DETECTION SETTINGS
# ============================================================
POSE_MODEL = "yolov8s-pose.pt"
TRACKER_CFG = "bytetrack.yaml"
CONF_THRES = 0.25
IOU_THRES = 0.6
IMGSZ = 960
MAX_DET = 25

# ============================================================
# HEURISTIC SETTINGS
# ============================================================
KP_CONF_MIN = 0.25
HISTORY = 10
COOLDOWN_FRAMES = 12
HEAD_MARGIN = 6
SHOULDER_MARGIN = -5
DOWN_SPEED_THRES = 5
DOWN_TOTAL_THRES = 12
MIN_TRACK_AGE = 4

# ============================================================
# COCO 17 KEYPOINT INDICES
# ============================================================
NOSE = 0
L_SHOULDER, R_SHOULDER = 5, 6
L_WRIST, R_WRIST = 9, 10

# ============================================================
# Per-track state
# ============================================================
track_age = defaultdict(int)
cooldown = defaultdict(int)
wrist_hist = defaultdict(lambda: deque(maxlen=HISTORY))


def emit_progress(status, message, progress=None, processed_frames=None, total_frames=None):
    payload = {
        "type": "progress",
        "status": status,
        "message": message,
    }

    if progress is not None:
        payload["progress"] = int(max(0, min(100, progress)))
    if processed_frames is not None:
        payload["processed_frames"] = int(max(0, processed_frames))
    if total_frames is not None:
        payload["total_frames"] = int(max(0, total_frames))

    print(json.dumps(payload), flush=True)


def format_timestamp_ms(ms: float) -> str:
    if ms is None:
        ms = 0
    ms = int(ms)
    minutes = ms // 60000
    seconds = (ms % 60000) // 1000
    centi = (ms % 1000) // 10
    return f"{minutes}.{seconds:02d}.{centi:02d}"


def save_json(d: dict, path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(d, f, indent=2)


def kp_ok(c):
    return c is not None and c >= KP_CONF_MIN


def get_kp(xy, conf, idx):
    x, y = xy[idx]
    c = conf[idx]
    return float(x), float(y), float(c)


def choose_wrist(kp_xy, kp_conf):
    _, ny, nc = get_kp(kp_xy, kp_conf, NOSE)

    _, wy_l, wc_l = get_kp(kp_xy, kp_conf, L_WRIST)
    _, wy_r, wc_r = get_kp(kp_xy, kp_conf, R_WRIST)

    _, sy_l, sc_l = get_kp(kp_xy, kp_conf, L_SHOULDER)
    _, sy_r, sc_r = get_kp(kp_xy, kp_conf, R_SHOULDER)

    if wc_r >= wc_l:
        wy, wc = wy_r, wc_r
        sy, sc = sy_r, sc_r
    else:
        wy, wc = wy_l, wc_l
        sy, sc = sy_l, sc_l

    return wy, wc, sy, sc, ny, nc


def is_arm_raised(wy, wc, sy, sc, ny, nc):
    if not (kp_ok(wc) and (kp_ok(sc) or kp_ok(nc))):
        return False

    above_shoulder = kp_ok(sc) and (wy < sy - SHOULDER_MARGIN)
    above_head = kp_ok(nc) and (wy < ny - HEAD_MARGIN)
    return above_shoulder or above_head


def swing_down_detected(tid, frame_idx, wy):
    wrist_hist[tid].append((frame_idx, wy))
    if len(wrist_hist[tid]) < 4:
        return False

    (f1, y1), (f2, y2) = wrist_hist[tid][-2], wrist_hist[tid][-1]
    df = max(1, f2 - f1)
    down_speed = (y2 - y1) / df

    ys = [y for (_, y) in wrist_hist[tid]]
    peak_high = min(ys)
    total_drop = wy - peak_high

    return (down_speed >= DOWN_SPEED_THRES) and (total_drop >= DOWN_TOTAL_THRES)


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


def run(video_path, output_json_path):
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    local_video = ensure_local_video(video_path)

    cap = cv2.VideoCapture(local_video)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {local_video}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    cap.release()

    if not fps or fps <= 0:
        fps = 30.0

    emit_progress("loading_model", "Loading model", 15)
    model = YOLO(POSE_MODEL)

    emit_progress(
        "processing",
        "Analyzing frames",
        20,
        processed_frames=0,
        total_frames=total_frames,
    )

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

    out = None
    log = {"smash": []}
    prev_present = False
    frame_idx = 0

    for result in stream:
        t_ms = (frame_idx / fps) * 1000.0
        t_str = format_timestamp_ms(t_ms)

        frame = None
        if WRITE_OUTPUT_VIDEO and result.orig_img is not None:
            frame = result.orig_img.copy()
            if out is None:
                h, w = frame.shape[:2]
                out = cv2.VideoWriter(
                    OUTPUT_VIDEO,
                    cv2.VideoWriter_fourcc(*"mp4v"),
                    fps,
                    (w, h),
                )

        for tid in list(cooldown.keys()):
            cooldown[tid] -= 1
            if cooldown[tid] <= 0:
                cooldown.pop(tid, None)

        smash_present_now = False

        if result.boxes is None or len(result.boxes) == 0 or result.keypoints is None:
            if WRITE_OUTPUT_VIDEO and out is not None and frame is not None:
                out.write(frame)

            frame_idx += 1
            if total_frames > 0 and frame_idx % 60 == 0:
                progress = 20 + int((frame_idx / total_frames) * 70)
                emit_progress(
                    "processing",
                    "Analyzing frames",
                    progress,
                    processed_frames=frame_idx,
                    total_frames=total_frames,
                )
            continue

        boxes = result.boxes.xyxy
        ids = result.boxes.id
        if ids is None:
            ids = torch.arange(len(boxes), device=boxes.device)

        boxes_np = boxes.cpu().numpy().astype(int)
        ids_np = ids.cpu().numpy().astype(int)
        kp_xy = result.keypoints.xy.cpu().numpy()
        kp_cf = result.keypoints.conf.cpu().numpy()

        for i, ((x1, y1, x2, y2), tid) in enumerate(zip(boxes_np, ids_np)):
            track_age[tid] += 1
            if track_age[tid] < MIN_TRACK_AGE:
                continue

            wy, wc, sy, sc, ny, nc = choose_wrist(kp_xy[i], kp_cf[i])
            raised = is_arm_raised(wy, wc, sy, sc, ny, nc)
            swing = swing_down_detected(tid, frame_idx, wy)

            if raised and swing:
                cooldown[tid] = COOLDOWN_FRAMES

            if cooldown.get(tid, 0) > 0:
                smash_present_now = True
                if WRITE_OUTPUT_VIDEO and frame is not None:
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 4)
                    cv2.putText(
                        frame,
                        "smash",
                        (x1, max(20, y1 - 10)),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        1.0,
                        (0, 255, 0),
                        3,
                    )

        if smash_present_now and not prev_present:
            if len(log["smash"]) == 0 or log["smash"][-1] != t_str:
                log["smash"].append(t_str)

        prev_present = smash_present_now

        if WRITE_OUTPUT_VIDEO and out is not None and frame is not None:
            out.write(frame)

        frame_idx += 1
        if total_frames > 0 and frame_idx % 60 == 0:
            progress = 20 + int((frame_idx / total_frames) * 70)
            emit_progress(
                "processing",
                "Analyzing frames",
                progress,
                processed_frames=frame_idx,
                total_frames=total_frames,
            )

    emit_progress("finalizing", "Finalizing results", 95)

    if out is not None:
        out.release()

    save_json(log, output_json_path)

    emit_progress("completed", "Completed", 100, processed_frames=frame_idx, total_frames=total_frames)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("video_input_path")
    parser.add_argument("--output-json", default=DEFAULT_OUTPUT_JSON)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run(args.video_input_path, args.output_json)
