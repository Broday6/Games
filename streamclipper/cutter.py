"""Cut clips and thumbnails out of a VOD with ffmpeg, and fetch VODs with yt-dlp."""
import json
import os
import subprocess

# Centre-crop to 9:16 and scale for YouTube Shorts.
VERTICAL = "crop=ih*9/16:ih,scale=1080:1920"


def cut_clip(src, start, end, dst, vertical=False):
    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    cmd = ["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.2f}", "-i", src, "-t", f"{end - start:.2f}"]
    if vertical:
        cmd += ["-vf", VERTICAL]
    # Re-encode so the cut lands on the exact second rather than the nearest keyframe.
    cmd += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", dst]
    subprocess.run(cmd, check=True)
    return dst


def thumbnail(src, t, dst):
    """A 1280x720 JPEG of the frame at second `t`, for the clip's custom thumbnail."""
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", src, "-frames:v", "1",
                    "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:-1:-1",
                    "-q:v", "3", dst], check=True)
    return dst


def download(url, out_dir):
    """Fetch a VOD with yt-dlp; returns the local path and the VOD's metadata (streamer, game, date)."""
    os.makedirs(out_dir, exist_ok=True)
    template = os.path.join(out_dir, "%(id)s.%(ext)s")
    out = subprocess.run(
        ["yt-dlp", "-f", "bv*[height<=1080]+ba/b", "--merge-output-format", "mp4", "--write-info-json",
         "-o", template, "--print", "after_move:filepath", url],
        check=True, capture_output=True, text=True).stdout
    path = out.strip().splitlines()[-1]
    return path, load_info(path)


def load_info(path):
    """The .info.json yt-dlp wrote next to a VOD, or {} for a file that has none."""
    info_path = os.path.splitext(path)[0] + ".info.json"
    if not os.path.exists(info_path):
        return {}
    with open(info_path, encoding="utf-8") as f:
        info = json.load(f)
    keep = ("id", "title", "webpage_url", "uploader", "uploader_id", "uploader_url", "channel",
            "channel_url", "timestamp", "upload_date", "categories", "chapters")
    return {k: info[k] for k in keep if info.get(k) is not None}
