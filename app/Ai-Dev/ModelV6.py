import os
import cv2
import json
import torch
from ultralytics import YOLO
from collections import defaultdict, deque

# ============================================================
# PATHS (EDIT THESE)
# ============================================================
VIDEO_INPUT_PATH = r"c:\Users\nicol\Collab project\work_env\testVideo.mp4" #Video input
OUTPUT_DIR = os.path.abspath("runs/video_output_pose")
OUTPUT_VIDEO = os.path.join(OUTPUT_DIR, "smash_detection_output.mp4")
OUTPUT_JSON = os.path.abspath("output_smash_detection.json")

# ============================================================
# POSE MODEL (use stronger if possible)
# ============================================================
POSE_MODEL = "yolov8s-pose.pt"    # try yolov8m-pose.pt if you have GPU

# ============================================================
# TRACKER (reduces warnings & improves ID stability)
# ============================================================
TRACKER_CFG = "bytetrack.yaml"

# ============================================================
# DETECTION SETTINGS
# ============================================================
CONF_THRES = 0.25   # LOWER => more poses detected
IOU_THRES = 0.6
IMGSZ = 960
MAX_DET = 25

# ============================================================
# HIGH-RECALL HEURISTIC SETTINGS
# (These are intentionally permissive to catch real smashes first.)
# ============================================================
KP_CONF_MIN = 0.25     # LOWER => accept more keypoints (more noise too)

HISTORY = 10           # wrist history length
COOLDOWN_FRAMES = 12   # draw box for a bit after trigger

# "Arm raised" gate (permissive)
HEAD_MARGIN = 6        # wrist slightly above nose counts
SHOULDER_MARGIN = -5   # wrist just above shoulder counts (very permissive)

# Swing trigger (permissive)
DOWN_SPEED_THRES = 5   # px/frame downward speed
DOWN_TOTAL_THRES = 12  # px total drop from peak

MIN_TRACK_AGE = 4      # allow earlier triggering

# ============================================================
# COCO 17 KEYPOINT INDICES
# ============================================================
NOSE = 0
L_SHOULDER, R_SHOULDER = 5, 6
L_ELBOW, R_ELBOW = 7, 8
L_WRIST, R_WRIST = 9, 10

# ============================================================
# JSON helpers
# ============================================================
def format_timestamp_ms(ms: float) -> str:
    if ms is None:
        ms = 0
    ms = int(ms)
    minutes = ms // 60000
    seconds = (ms % 60000) // 1000
    centi = (ms % 1000) // 10
    return f"{minutes}.{seconds:02d}.{centi:02d}"

def load_or_create_json(path: str) -> dict:
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                d = json.load(f)
            if isinstance(d, dict):
                return d
        except Exception:
            pass
    return {}

def save_json(d: dict, path: str):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(d, f, indent=2)

# ============================================================
# Per-track state
# ============================================================
track_age = defaultdict(int)
cooldown = defaultdict(int)

# Wrist history: store chosen wrist y per frame
wrist_hist = defaultdict(lambda: deque(maxlen=HISTORY))  # (frame_idx, wrist_y)

def kp_ok(c):
    return c is not None and c >= KP_CONF_MIN

def get_kp(xy, conf, idx):
    x, y = xy[idx]
    c = conf[idx]
    return float(x), float(y), float(c)

def choose_wrist(kp_xy, kp_conf):
    """
    Choose the wrist with higher confidence. Return (wrist_y, wrist_conf, shoulder_y, shoulder_conf, nose_y, nose_conf)
    """
    _, ny, nc = get_kp(kp_xy, kp_conf, NOSE)

    _, wyL, wcL = get_kp(kp_xy, kp_conf, L_WRIST)
    _, wyR, wcR = get_kp(kp_xy, kp_conf, R_WRIST)

    _, syL, scL = get_kp(kp_xy, kp_conf, L_SHOULDER)
    _, syR, scR = get_kp(kp_xy, kp_conf, R_SHOULDER)

    # default to best wrist
    if wcR >= wcL:
        wy, wc = wyR, wcR
        sy, sc = syR, scR
    else:
        wy, wc = wyL, wcL
        sy, sc = syL, scL

    return wy, wc, sy, sc, ny, nc

def is_arm_raised(wy, wc, sy, sc, ny, nc):
    """
    Permissive: arm considered raised if wrist above shoulder OR wrist above nose.
    """
    if not (kp_ok(wc) and (kp_ok(sc) or kp_ok(nc))):
        return False

    above_shoulder = kp_ok(sc) and (wy < sy - SHOULDER_MARGIN)
    above_head = kp_ok(nc) and (wy < ny - HEAD_MARGIN)
    return above_shoulder or above_head

def swing_down_detected(tid, frame_idx, wy):
    """
    Detect downward swing using recent wrist history:
    - recent downward speed over last step
    - total drop from peak within HISTORY window
    """
    wrist_hist[tid].append((frame_idx, wy))
    if len(wrist_hist[tid]) < 4:
        return False

    # speed (last 2)
    (f1, y1), (f2, y2) = wrist_hist[tid][-2], wrist_hist[tid][-1]
    df = max(1, f2 - f1)
    down_speed = (y2 - y1) / df  # + means moving down

    ys = [y for (_, y) in wrist_hist[tid]]
    peak_high = min(ys)          # smallest y is highest wrist position
    total_drop = wy - peak_high

    return (down_speed >= DOWN_SPEED_THRES) and (total_drop >= DOWN_TOTAL_THRES)

# ============================================================
# Main
# ============================================================
def run(video_path):
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"❌ Could not open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    out = cv2.VideoWriter(OUTPUT_VIDEO, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))

    model = YOLO(POSE_MODEL)

    log = load_or_create_json(OUTPUT_JSON)
    if "smash" not in log or not isinstance(log.get("smash"), list):
        log["smash"] = []
    prev_present = False

    stream = model.track(
        source=video_path,
        stream=True,
        persist=True,
        verbose=False,
        conf=CONF_THRES,
        iou=IOU_THRES,
        imgsz=IMGSZ,
        max_det=MAX_DET,
        tracker=TRACKER_CFG,
    )

    frame_idx = 0

    for result in stream:
        ret, frame = cap.read()
        if not ret:
            break

        t_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
        t_str = format_timestamp_ms(t_ms)

        # cooldown tick
        for tid in list(cooldown.keys()):
            cooldown[tid] -= 1
            if cooldown[tid] <= 0:
                cooldown.pop(tid, None)

        smash_present_now = False

        if result.boxes is None or len(result.boxes) == 0 or result.keypoints is None:
            out.write(frame)
            prev_present = False
            frame_idx += 1
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

            # 1) Arm raised gate (permissive)
            raised = is_arm_raised(wy, wc, sy, sc, ny, nc)

            # 2) Swing down gate
            swing = swing_down_detected(tid, frame_idx, wy)

            # Trigger smash if we see raised AND swing down
            if raised and swing:
                cooldown[tid] = COOLDOWN_FRAMES

            # Draw if recently triggered
            if cooldown.get(tid, 0) > 0:
                smash_present_now = True
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

        # rising-edge log
        if smash_present_now and not prev_present:
            if len(log["smash"]) == 0 or log["smash"][-1] != t_str:
                log["smash"].append(t_str)

        prev_present = smash_present_now
        out.write(frame)
        frame_idx += 1

    cap.release()
    out.release()
    save_json(log, OUTPUT_JSON)

    print("✅ Video saved:", OUTPUT_VIDEO)
    print("✅ Log saved:", OUTPUT_JSON)

if __name__ == "__main__":

    run(VIDEO_INPUT_PATH)
