"""Cut clips out of a VOD with ffmpeg."""
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


def download(url, out_dir):
    """Fetch a VOD with yt-dlp and return the local path."""
    os.makedirs(out_dir, exist_ok=True)
    template = os.path.join(out_dir, "%(id)s.%(ext)s")
    out = subprocess.run(
        ["yt-dlp", "-f", "bv*[height<=1080]+ba/b", "--merge-output-format", "mp4",
         "-o", template, "--print", "after_move:filepath", url],
        check=True, capture_output=True, text=True).stdout
    return out.strip().splitlines()[-1]
