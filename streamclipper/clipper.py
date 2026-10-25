#!/usr/bin/env python3
"""Clip the high-action moments out of a stream VOD and optionally upload them to YouTube.

    python clipper.py VOD.mp4                      # find + cut clips into clips/
    python clipper.py https://twitch.tv/videos/... # download with yt-dlp first
    python clipper.py VOD.mp4 --chat chat.json     # use chat activity as a signal too
    python clipper.py VOD.mp4 --upload --confirm-rights

Uploads go up as private by default so you can review them in YouTube Studio before they go live.
"""
import argparse
import json
import os
import sys

import cutter
import highlights


def fmt(t):
    t = int(t)
    return f"{t // 3600}:{t // 60 % 60:02d}:{t % 60:02d}"


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("source", help="local video file or a VOD URL (downloaded with yt-dlp)")
    p.add_argument("--chat", help="chat log: chat_downloader JSON, JSON lines, or one timestamp per line")
    p.add_argument("--out", default="clips", help="output folder (default: clips)")
    p.add_argument("--max-clips", type=int, default=10)
    p.add_argument("--pre", type=float, default=20, help="seconds kept before each peak (default 20)")
    p.add_argument("--post", type=float, default=10, help="seconds kept after each peak (default 10)")
    p.add_argument("--min-gap", type=float, default=45, help="minimum seconds between peaks (default 45)")
    p.add_argument("--threshold", type=float, default=2.0,
                   help="minimum combined score for a peak; lower finds more clips (default 2.0)")
    p.add_argument("--weights", default="audio=1,motion=0.6,chat=1.5",
                   help="signal weights, e.g. audio=1,motion=0.6,chat=1.5")
    p.add_argument("--vertical", action="store_true", help="centre-crop to 9:16 for YouTube Shorts")
    p.add_argument("--dry-run", action="store_true", help="only list the moments, do not cut")
    p.add_argument("--upload", action="store_true", help="upload the clips to YouTube")
    p.add_argument("--confirm-rights", action="store_true",
                   help="required with --upload: you own this footage or the streamer has given you permission")
    p.add_argument("--privacy", default="private", choices=["private", "unlisted", "public"])
    p.add_argument("--title", default="{name} highlight {n}",
                   help="title template; fields: {name} {n} {time} (default: '{name} highlight {n}')")
    p.add_argument("--description", default="", help="description for every upload (credit the streamer here)")
    p.add_argument("--tags", default="", help="comma-separated tags")
    p.add_argument("--client-secret", default="client_secret.json")
    p.add_argument("--token", default="token.json")
    a = p.parse_args(argv)

    if a.upload and not a.confirm_rights:
        p.error("--upload needs --confirm-rights: only upload streams you own or have permission to repost. "
                "YouTube strikes and demonetises channels for reuploaded content.")

    src = a.source
    if src.startswith(("http://", "https://")):
        print(f"downloading {src} ...")
        src = cutter.download(src, os.path.join(a.out, "vods"))
    name = os.path.splitext(os.path.basename(src))[0]
    weights = {k: float(v) for k, v in (w.split("=") for w in a.weights.split(",") if w)}

    print(f"analysing {src} ...")
    clips, _ = highlights.find_highlights(
        src, chat=a.chat, weights=weights, max_clips=a.max_clips, pre=a.pre, post=a.post,
        min_gap=a.min_gap, threshold=a.threshold)
    if not clips:
        print("no moments cleared the threshold; try a lower --threshold")
        return 0

    for n, c in enumerate(clips, 1):
        c["title"] = a.title.format(name=name, n=n, time=fmt(c["peak"]))
        print(f"  {n:2d}. {fmt(c['start'])}-{fmt(c['end'])}  peak {fmt(c['peak'])}  score {c['score']}")
    if a.dry_run:
        return 0

    os.makedirs(a.out, exist_ok=True)
    for n, c in enumerate(clips, 1):
        c["file"] = os.path.join(a.out, f"{name}_{n:02d}_{int(c['peak'])}s.mp4")
        cutter.cut_clip(src, c["start"], c["end"], c["file"], vertical=a.vertical)
        print(f"cut {c['file']}")

    if a.upload:
        import youtube_upload
        tags = [t.strip() for t in a.tags.split(",") if t.strip()]
        for c in clips:
            title = c["title"] + (" #Shorts" if a.vertical else "")
            c["youtube_id"] = youtube_upload.upload(
                c["file"], title, a.description, tags, a.privacy, client_secret=a.client_secret, token=a.token)
            print(f"uploaded {c['file']} -> https://youtu.be/{c['youtube_id']} ({a.privacy})")

    manifest = os.path.join(a.out, f"{name}_clips.json")
    with open(manifest, "w") as f:
        json.dump({"source": src, "clips": clips}, f, indent=2)
    print(f"wrote {manifest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
