#!/usr/bin/env python3
"""Clip the high-action moments out of a stream VOD and optionally upload them to YouTube.

    python clipper.py https://twitch.tv/videos/...   # download, find + cut clips into clips/
    python clipper.py VOD.mp4 --streamer Name --channel-url https://twitch.tv/name
    python clipper.py VOD.mp4 --chat chat.json       # use chat activity as a signal too
    python clipper.py clips/VOD_clips.json --upload --confirm-rights   # upload after editing titles

Every run writes a manifest with the title, description and tags for each clip. Edit it to give
clips real hooks, then upload from it. Uploads are private by default so you can review them first.
"""
import argparse
import datetime
import json
import os
import sys

import cutter
import highlights
import seo


def fmt(t):
    t = int(t)
    return f"{t // 3600}:{t // 60 % 60:02d}:{t % 60:02d}"


def parse_args(argv):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("source", help="video file, VOD URL (downloaded with yt-dlp), or a *_clips.json manifest to upload")
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

    credit = p.add_argument_group("credit (filled in from the VOD when it was downloaded with yt-dlp)")
    credit.add_argument("--streamer", help="streamer's display name")
    credit.add_argument("--channel-url", help="streamer's channel, e.g. https://www.twitch.tv/name")
    credit.add_argument("--vod-url", help="link to the full stream, for the timestamped 'watch the full stream' link")
    credit.add_argument("--game", help="game played, when the VOD does not say")
    credit.add_argument("--date", help="stream date YYYY-MM-DD, when the VOD does not say")
    credit.add_argument("--streamers", default="streamers.json",
                        help="registry of streamers' real channels and default tags (default: streamers.json)")

    up = p.add_argument_group("upload")
    up.add_argument("--upload", action="store_true", help="upload the clips to YouTube")
    up.add_argument("--confirm-rights", action="store_true",
                    help="required with --upload: you own this footage or the streamer has given you permission")
    up.add_argument("--privacy", default="private", choices=["private", "unlisted", "public"])
    up.add_argument("--title", help="title template instead of the SEO default; fields: {streamer} {game} {n} {date} {hook}")
    up.add_argument("--note", default="", help="extra line for every description, after the first line")
    up.add_argument("--tags", default="", help="extra comma-separated tags")
    up.add_argument("--language", default="en", help="language of the stream audio (default: en)")
    up.add_argument("--client-secret", default="client_secret.json")
    up.add_argument("--token", default="token.json")
    return p, p.parse_args(argv)


def vod_info(a, info):
    """VOD metadata from yt-dlp, with anything given on the command line taking precedence."""
    info = dict(info)
    if a.vod_url:
        info["webpage_url"] = a.vod_url
    if a.date:
        info["upload_date"] = a.date.replace("-", "")
        info.pop("timestamp", None)
    if a.game:
        info["chapters"] = []
    return info


def write_manifest(path, manifest):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)


def upload_all(a, p, manifest_path, manifest):
    s = manifest["streamer"]
    if not s.get("name") or not s.get("links"):
        p.error("cannot credit the streamer: pass --streamer and --channel-url, or add them to streamers.json")
    import youtube_upload
    for c in manifest["clips"]:
        if c.get("youtube_id"):
            print(f"already uploaded {c['file']} -> https://youtu.be/{c['youtube_id']}")
            continue
        c["youtube_id"] = youtube_upload.upload(
            c["file"], c["title"], c["description"], c["tags"], a.privacy, language=a.language,
            thumbnail=c.get("thumbnail"), client_secret=a.client_secret, token=a.token)
        c["uploaded"] = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
        write_manifest(manifest_path, manifest)  # so a failed batch can resume where it stopped
        print(f"uploaded {c['title']!r} -> https://youtu.be/{c['youtube_id']} ({a.privacy})")


def main(argv=None):
    p, a = parse_args(argv)
    if a.upload and not a.confirm_rights:
        p.error("--upload needs --confirm-rights: only upload streams you own or have permission to repost. "
                "YouTube strikes and demonetises channels for reuploaded content.")

    if a.source.endswith(".json"):
        with open(a.source, encoding="utf-8") as f:
            manifest = json.load(f)
        if not a.upload:
            p.error("a manifest is only used for uploading; add --upload --confirm-rights")
        upload_all(a, p, a.source, manifest)
        return 0

    src = a.source
    if src.startswith(("http://", "https://")):
        print(f"downloading {src} ...")
        src, info = cutter.download(src, os.path.join(a.out, "vods"))
    else:
        info = cutter.load_info(src)
    info = vod_info(a, info)
    name = os.path.splitext(os.path.basename(src))[0]
    streamer = seo.streamer_profile(info, seo.load_registry(a.streamers), a.streamer, a.channel_url, a.game)
    if not streamer["name"]:
        streamer["name"] = name
    weights = {k: float(v) for k, v in (w.split("=") for w in a.weights.split(",") if w)}

    print(f"analysing {src} ...")
    clips, _ = highlights.find_highlights(
        src, chat=a.chat, weights=weights, max_clips=a.max_clips, pre=a.pre, post=a.post,
        min_gap=a.min_gap, threshold=a.threshold)
    if not clips:
        print("no moments cleared the threshold; try a lower --threshold")
        return 0

    extra_tags = [t.strip() for t in a.tags.split(",") if t.strip()]
    for n, c in enumerate(clips, 1):
        c.update(seo.metadata(c, n, info, streamer, a.vertical, a.title, a.note, extra_tags))
        print(f"  {n:2d}. {fmt(c['start'])}-{fmt(c['end'])}  score {c['score']:5.1f}  {c['title']}")
    if a.dry_run:
        return 0

    os.makedirs(a.out, exist_ok=True)
    for n, c in enumerate(clips, 1):
        base = os.path.join(a.out, f"{name}_{n:02d}_{int(c['peak'])}s")
        c["file"] = cutter.cut_clip(src, c["start"], c["end"], base + ".mp4", vertical=a.vertical)
        if not a.vertical:  # YouTube does not take custom thumbnails for Shorts
            c["thumbnail"] = cutter.thumbnail(src, c["peak"], base + ".jpg")
        print(f"cut {c['file']}")

    manifest_path = os.path.join(a.out, f"{name}_clips.json")
    manifest = {"source": src, "vod_url": info.get("webpage_url"), "streamer": streamer, "clips": clips}
    write_manifest(manifest_path, manifest)
    print(f"wrote {manifest_path} (edit titles there to give each clip a real hook, then upload from it)")

    if a.upload:
        upload_all(a, p, manifest_path, manifest)
    return 0


if __name__ == "__main__":
    sys.exit(main())
