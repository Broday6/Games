"""Cut clips and thumbnails out of a VOD with ffmpeg, and fetch VODs with yt-dlp."""
import json
import os
import subprocess
import tempfile
import urllib.parse
import urllib.request

# Ways to turn 16:9 into a 9:16 Short. "blur" keeps the whole picture, centred on a blurred,
# zoomed copy of itself, so facecams and HUDs at the edges survive. "crop" fills the screen but
# keeps only the middle third, which suits games where the action is centred.
VERTICAL = {
    "blur": "split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,"
            "boxblur=20:2[bg];[b]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2",
    "crop": "crop=ih*9/16:ih,scale=1080:1920",
}


def cut_clip(src, start, end, dst, vertical=False, style="blur"):
    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    cmd = ["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.2f}", "-i", src, "-t", f"{end - start:.2f}"]
    if vertical:
        cmd += ["-vf", VERTICAL[style]]
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


FULL_QUALITY = "bv*[height<=1080]+ba/b[height<=1080]/b"
# Smallest copy that still has picture and sound: enough to find the action in a long stream
# (a 5-hour Twitch VOD is ~530 MB at 160p against ~16 GB at 1080p).
ANALYSIS_QUALITY = "worst[vcodec!=none][acodec!=none]/worst"


def download(url, out_dir, quality=FULL_QUALITY):
    """Fetch a VOD with yt-dlp; returns the local path and the VOD's metadata (streamer, game, date)."""
    os.makedirs(out_dir, exist_ok=True)
    template = os.path.join(out_dir, "%(id)s.%(ext)s")
    out = subprocess.run(
        ["yt-dlp", "-f", quality, "-N", "8", "--merge-output-format", "mp4", "--write-info-json",
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


def hls_segments(playlist, start, end):
    """Pick the segments of an HLS media playlist that cover [start, end).

    Returns (init segment URI or None, segment URIs, seconds from the first segment to `start`).
    """
    init, segs, t, dur = None, [], 0.0, None
    for line in playlist.splitlines():
        line = line.strip()
        if line.startswith("#EXT-X-MAP:"):
            init = line.split('URI="', 1)[1].split('"', 1)[0]
        elif line.startswith("#EXTINF:"):
            dur = float(line[8:].split(",", 1)[0])
        elif line and not line.startswith("#") and dur is not None:
            if t < end and t + dur > start:
                segs.append((t, line))
            t += dur
            dur = None
    if not segs:
        return init, [], 0.0
    return init, [u for _, u in segs], start - segs[0][0]


def fetch_section(url, start, end, dst, vertical=False, style="blur"):
    """Cut [start, end) of an online VOD at full quality without downloading the whole stream.

    Twitch serves VODs as HLS, so only the few segments around the clip are fetched; other sites
    go through yt-dlp's --download-sections.
    """
    stream = subprocess.run(["yt-dlp", "-g", "-f", "b[height<=1080]/b", url],
                            check=True, capture_output=True, text=True).stdout.strip().splitlines()
    with tempfile.TemporaryDirectory() as tmp:
        raw = os.path.join(tmp, "section.mp4")
        if len(stream) == 1 and ".m3u8" in stream[0]:
            with urllib.request.urlopen(stream[0], timeout=60) as r:
                init, segs, offset = hls_segments(r.read().decode(), start, end)
            if not segs:
                raise RuntimeError(f"{start}-{end}s is outside the stream")
            with open(raw, "wb") as out:
                for uri in ([init] if init else []) + segs:
                    with urllib.request.urlopen(urllib.parse.urljoin(stream[0], uri), timeout=60) as r:
                        out.write(r.read())
        else:
            subprocess.run(["yt-dlp", "-q", "-f", FULL_QUALITY, "--merge-output-format", "mp4",
                            "--download-sections", f"*{start:.0f}-{end:.0f}", "-o", raw, url], check=True)
            offset = 0.0
        return cut_clip(raw, offset, offset + end - start, dst, vertical=vertical, style=style)
