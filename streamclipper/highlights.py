"""Find high-action moments in a stream VOD.

Three signals are scored once per second and combined:

* audio  - loudness relative to the stream's own recent baseline (yelling, explosions, hype)
* motion - how much the picture changes frame to frame (fights, fast camera, flashes)
* chat   - messages per second, when a chat log is supplied (the strongest signal on Twitch)

Each signal is normalised against a rolling baseline so a loud streamer or a busy game does not
score high all the time; only moments that stand out from their surroundings do.
"""
import json
import subprocess

import numpy as np

AUDIO_RATE = 8000
MOTION_FPS = 5
MOTION_W, MOTION_H = 64, 36


def probe_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", path],
        check=True, capture_output=True, text=True).stdout
    return float(json.loads(out)["format"]["duration"])


def _stream(cmd, chunk):
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        while True:
            buf = proc.stdout.read(chunk)
            if not buf:
                break
            yield buf
    finally:
        proc.stdout.close()
        proc.wait()


def audio_loudness(path):
    """Loudness in dBFS for each second of the file."""
    cmd = ["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(AUDIO_RATE),
           "-f", "s16le", "-"]
    out, leftover = [], b""
    block = AUDIO_RATE * 2
    for buf in _stream(cmd, block * 60):
        buf = leftover + buf
        n = len(buf) // block
        leftover = buf[n * block:]
        if n:
            s = np.frombuffer(buf[:n * block], dtype="<i2").astype(np.float32) / 32768.0
            rms = np.sqrt(np.mean(s.reshape(n, AUDIO_RATE) ** 2, axis=1))
            out.append(20 * np.log10(rms + 1e-6))
    return np.concatenate(out) if out else np.zeros(0)


def video_motion(path):
    """Mean absolute pixel change between sampled frames, averaged per second."""
    cmd = ["ffmpeg", "-v", "error", "-i", path, "-an",
           "-vf", f"fps={MOTION_FPS},scale={MOTION_W}:{MOTION_H},format=gray",
           "-f", "rawvideo", "-"]
    frame = MOTION_W * MOTION_H
    diffs, prev, leftover = [], None, b""
    for buf in _stream(cmd, frame * MOTION_FPS * 60):
        buf = leftover + buf
        n = len(buf) // frame
        leftover = buf[n * frame:]
        if not n:
            continue
        frames = np.frombuffer(buf[:n * frame], dtype=np.uint8).reshape(n, frame).astype(np.int16)
        if prev is not None:
            frames = np.vstack([prev[None], frames])
        diffs.append(np.abs(np.diff(frames, axis=0)).mean(axis=1))
        prev = frames[-1]
    if not diffs:
        return np.zeros(0)
    d = np.concatenate([[0.0], np.concatenate(diffs)])
    secs = len(d) // MOTION_FPS
    return d[:secs * MOTION_FPS].reshape(secs, MOTION_FPS).mean(axis=1)


def chat_rate(chat_path, seconds):
    """Messages per second from a chat log.

    Accepts TwitchDownloader's chat JSON (`comments[].content_offset_seconds`), the JSON list
    written by chat_downloader (`time_in_seconds`), JSON lines with that key, or a plain text
    file with one timestamp in seconds per line.
    """
    with open(chat_path, encoding="utf-8") as f:
        text = f.read().strip()
    times = []
    if text.startswith("{") and '"comments"' in text[:2000]:
        times = [m["content_offset_seconds"] for m in json.loads(text)["comments"]]
    elif text.startswith("["):
        times = [m["time_in_seconds"] for m in json.loads(text) if "time_in_seconds" in m]
    else:
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            if line.startswith("{"):
                m = json.loads(line)
                if "time_in_seconds" in m:
                    times.append(m["time_in_seconds"])
            else:
                times.append(float(line.split(",")[0]))
    t = np.asarray(times, dtype=float)
    t = t[(t >= 0) & (t < seconds)]
    return np.bincount(t.astype(int), minlength=seconds).astype(float)[:seconds]


def _smooth(x, width):
    if width <= 1 or len(x) == 0:
        return x
    k = np.ones(width) / width
    return np.convolve(x, k, mode="same")


def _rolling_median(x, width):
    """Median over a centred window, computed on a coarse grid so a 3-hour VOD stays fast."""
    if len(x) == 0:
        return x
    step = max(1, width // 10)
    half = width // 2
    centres = np.arange(0, len(x), step)
    meds = np.array([np.median(x[max(0, c - half):c + half + 1]) for c in centres])
    return np.interp(np.arange(len(x)), centres, meds)


def relative_score(x, baseline_window=120):
    """How far each second sits above its local baseline, in robust standard deviations."""
    if len(x) == 0:
        return x
    base = _rolling_median(x, baseline_window)
    dev = x - base
    mad = np.median(np.abs(dev - np.median(dev))) * 1.4826
    spread = max(mad, np.std(dev) * 0.25, 1e-6)
    return np.clip(dev / spread, 0, None)


def combine(signals, weights, smooth=3):
    """Weighted sum of relative scores, trimmed to the shortest signal."""
    n = min(len(s) for s in signals.values())
    total = np.zeros(n)
    for name, s in signals.items():
        total += weights.get(name, 1.0) * relative_score(np.asarray(s[:n], dtype=float))
    return _smooth(total, smooth)


def pick_clips(score, max_clips=10, pre=20, post=10, min_gap=45, threshold=2.0, duration=None):
    """Choose the strongest peaks, at least `min_gap` seconds apart, and turn them into windows.

    Returns clips in chronological order as dicts with start, end, peak and score.
    """
    duration = len(score) if duration is None else duration
    chosen = []
    for i in np.argsort(score)[::-1]:
        if score[i] < threshold or len(chosen) >= max_clips:
            break
        if all(abs(int(i) - c) >= min_gap for c in chosen):
            chosen.append(int(i))
    clips = []
    for peak in sorted(chosen):
        start = max(0.0, peak - pre)
        end = min(float(duration), peak + post)
        clips.append({"start": start, "end": end, "peak": peak, "score": round(float(score[peak]), 2)})
    return clips


def find_highlights(path, chat=None, weights=None, **pick_kwargs):
    weights = weights or {"audio": 1.0, "motion": 0.6, "chat": 1.5}
    signals = {"audio": audio_loudness(path), "motion": video_motion(path)}
    signals = {k: v for k, v in signals.items() if len(v)}
    if not signals:
        raise RuntimeError(f"no audio or video could be read from {path}")
    if chat:
        signals["chat"] = chat_rate(chat, max(len(v) for v in signals.values()))
    score = combine(signals, weights)
    return pick_clips(score, duration=probe_duration(path), **pick_kwargs), score
