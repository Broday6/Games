#!/usr/bin/env python3
"""Run the clip channels on their own: clip new streams and post on a weekly schedule.

    python autopilot.py connect <channel>   # sign in to one of your YouTube channels (once per channel)
    python autopilot.py run                 # clip new VODs and upload what is due; schedule this hourly
    python autopilot.py status              # what is queued and when it posts

Which streamers to clip, and which channel each one posts to, comes from streamers.json. Only
streamers with a recorded "permission" are clipped. Settings live in autopilot.json.
"""
import argparse
import datetime
import json
import os
import shlex
import shutil
import subprocess
import sys
import traceback
from zoneinfo import ZoneInfo

import cutter
import highlights
import seo

DEFAULTS = {
    "timezone": "America/New_York",
    "slots": ["12:00", "17:00", "20:00"],
    "daily_upload_limit": 6,
    "queue_days": 7,
    "clips_per_vod": 6,
    "vods_per_run": 1,
    "vertical": True,
    "vertical_style": "blur",
    "privacy": "public",
    "language": "en",
    "work_dir": "autopilot",
    "chat_command": None,
    "delete_after_upload": True,
}
# The YouTube API's daily quota resets at midnight Pacific time.
QUOTA_TZ = ZoneInfo("America/Los_Angeles")
UPLOAD_LEAD = datetime.timedelta(hours=3)
# A run that has not finished after this long is assumed to have crashed.
STALE_LOCK = datetime.timedelta(hours=6)


def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)


def log(msg):
    print(f"[{datetime.datetime.now():%Y-%m-%d %H:%M}] {msg}", flush=True)


def token_path(cfg, channel):
    return os.path.join(cfg["work_dir"], "tokens", f"{channel}.json")


# --- scheduling --------------------------------------------------------------------------------

def next_slot(queue, channel, now, cfg):
    """The next posting time free for `channel`, keeping every day under the upload limit."""
    tz = ZoneInfo(cfg["timezone"])
    taken = {q["post_at"] for q in queue if q["channel"] == channel}
    per_day = {}
    for q in queue:
        day = datetime.datetime.fromisoformat(q["post_at"]).astimezone(tz).date()
        per_day[day] = per_day.get(day, 0) + 1
    local = now.astimezone(tz)
    for d in range(366):
        day = local.date() + datetime.timedelta(days=d)
        for slot in sorted(cfg["slots"]):
            if per_day.get(day, 0) >= cfg["daily_upload_limit"]:
                break
            h, m = map(int, slot.split(":"))
            at = datetime.datetime(day.year, day.month, day.day, h, m, tzinfo=tz)
            if at <= now + UPLOAD_LEAD or at.isoformat() in taken:
                continue
            return at.isoformat()
    raise RuntimeError("no free slot in the next year")


def queued_until(queue, channel):
    pending = [q["post_at"] for q in queue if q["channel"] == channel and q["status"] == "queued"]
    return max((datetime.datetime.fromisoformat(p) for p in pending), default=None)


def uploads_today(state, now):
    day = now.astimezone(QUOTA_TZ).date().isoformat()
    return state.setdefault("uploads_by_day", {}).get(day, 0), day


# --- clipping ----------------------------------------------------------------------------------

def new_vods(entry, state, limit):
    source = entry.get("source") or f"https://www.twitch.tv/{entry['login']}/videos?filter=archives&sort=time"
    out = subprocess.run(["yt-dlp", "--flat-playlist", "-J", "--playlist-end", "5", source],
                         check=True, capture_output=True, text=True).stdout
    vods = [e["url"] for e in json.loads(out).get("entries", []) if e.get("url")]
    return [v for v in vods if v not in state["processed"]][:limit]


def fetch_chat(cfg, info, folder):
    if not cfg.get("chat_command"):
        return None
    out = os.path.join(folder, "chat.json")
    vod_id = (info.get("id") or "").lstrip("v")
    cmd = cfg["chat_command"].format(id=vod_id, url=info.get("webpage_url", ""), out=out)
    try:
        subprocess.run(shlex.split(cmd), check=True, capture_output=True, timeout=3600)
        return out if os.path.exists(out) else None
    except (subprocess.SubprocessError, OSError) as e:
        log(f"  chat download failed, clipping without chat: {e}")
        return None


def clip_vod(url, key, entry, cfg, state, registry):
    work = os.path.join(cfg["work_dir"], "tmp", key)
    shutil.rmtree(work, ignore_errors=True)
    meta = json.loads(subprocess.run(["yt-dlp", "-J", "--skip-download", url],
                                     check=True, capture_output=True, text=True).stdout)
    if meta.get("is_live"):
        log(f"{key}: {url} is still live, will clip it once the stream ends")
        return 0
    try:
        log(f"{key}: analysing {url}")
        small, info = cutter.download(url, work, quality=cutter.ANALYSIS_QUALITY)
        chat = fetch_chat(cfg, info, work)
        clips, _ = highlights.find_highlights(small, chat=chat, max_clips=cfg["clips_per_vod"])
        clips.sort(key=lambda c: -c["score"])  # the best moments get the earliest posting slots
        vertical = entry.get("vertical", cfg["vertical"])
        streamer = seo.streamer_profile(info, registry, entry.get("name"), None, entry.get("game"))
        if not streamer["links"]:
            raise RuntimeError("no channel link to credit; add links to streamers.json")
        out_dir = os.path.join(cfg["work_dir"], "clips", key)
        os.makedirs(out_dir, exist_ok=True)
        vod_id = info.get("id") or os.path.splitext(os.path.basename(small))[0]
        for n, c in enumerate(clips, 1):
            c.update(seo.metadata(c, n, info, streamer, vertical))
            base = os.path.join(out_dir, f"{vod_id}_{int(c['peak'])}s")
            c["file"] = cutter.fetch_section(url, c["start"], c["end"], base + ".mp4", vertical=vertical,
                                             style=entry.get("vertical_style", cfg["vertical_style"]))
            if not vertical:
                c["thumbnail"] = cutter.thumbnail(small, c["peak"], base + ".jpg")
            c.update(streamer=key, channel=entry["channel"], vod=url, status="queued",
                     post_at=next_slot(state["queue"], entry["channel"], now_utc(), cfg))
            state["queue"].append(c)
            log(f"{key}: queued {c['title']!r} for {c['post_at']}")
        state["processed"][url] = {"streamer": key, "clips": len(clips), "at": now_utc().isoformat()}
        return len(clips)
    finally:
        shutil.rmtree(work, ignore_errors=True)  # the analysis copy is hundreds of MB


def now_utc():
    return datetime.datetime.now(datetime.timezone.utc)


# --- uploading ---------------------------------------------------------------------------------

def upload_due(cfg, state, client_secret):
    import youtube_upload
    from googleapiclient.errors import HttpError

    now = now_utc()
    due = sorted((q for q in state["queue"] if q["status"] == "queued"
                  and datetime.datetime.fromisoformat(q["post_at"]) <= now + UPLOAD_LEAD),
                 key=lambda q: q["post_at"])
    for q in due:
        done, day = uploads_today(state, now)
        if done >= cfg["daily_upload_limit"]:
            log(f"daily upload limit reached ({done}); {len(due)} clip(s) wait for tomorrow")
            return
        tok = token_path(cfg, q["channel"])
        if not os.path.exists(tok):
            log(f"channel {q['channel']!r} not connected; run: python autopilot.py connect {q['channel']}")
            continue
        when = datetime.datetime.fromisoformat(q["post_at"])
        publish_at = None
        if cfg["privacy"] == "public" and when > now + datetime.timedelta(minutes=15):
            publish_at = when.astimezone(datetime.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
        try:
            q["youtube_id"] = youtube_upload.upload(
                q["file"], q["title"], q["description"], q["tags"], cfg["privacy"],
                language=cfg["language"], thumbnail=q.get("thumbnail"), publish_at=publish_at,
                client_secret=client_secret, token=tok)
        except Exception as e:  # network, auth or a missing file: retry next run, up to 3 times
            q["error"] = str(e)
            if isinstance(e, HttpError) and "quota" in str(e).lower():
                state["uploads_by_day"][day] = cfg["daily_upload_limit"]
                log("YouTube quota used up for today; the rest wait for tomorrow")
                return
            q["attempts"] = q.get("attempts", 0) + 1
            if q["attempts"] >= 3:
                q["status"] = "failed"
            log(f"upload failed for {q['title']!r}: {e}")
            continue
        q["status"] = "uploaded"
        state["uploads_by_day"][day] = done + 1
        log(f"{q['channel']}: uploaded {q['title']!r} -> https://youtu.be/{q['youtube_id']}"
            + (f" (goes public {q['post_at']})" if publish_at else f" ({cfg['privacy']})"))
        if cfg.get("delete_after_upload", True):
            for f in (q.get("file"), q.get("thumbnail")):
                if f and os.path.exists(f):
                    os.remove(f)
        yield


# --- commands ----------------------------------------------------------------------------------

def permitted(registry, cfg):
    """Streamers that may be clipped: recorded permission and a channel to post to."""
    for key, entry in registry.items():
        if not entry.get("permission"):
            continue
        if not entry.get("channel"):
            log(f"{key}: has permission but no \"channel\" to post to; skipping")
            continue
        yield key, dict(entry, login=entry.get("login", key))


def cmd_run(a, cfg):
    lock = os.path.join(cfg["work_dir"], "run.lock")
    if os.path.exists(lock):
        age = now_utc() - datetime.datetime.fromtimestamp(os.path.getmtime(lock), datetime.timezone.utc)
        if age < STALE_LOCK:
            log("another run is still going; exiting")
            return
    open(lock, "w").close()
    try:
        _run(a, cfg)
    finally:
        os.remove(lock)


def _run(a, cfg):
    registry = seo.load_registry(a.streamers)
    state_path = os.path.join(cfg["work_dir"], "state.json")
    state = load_json(state_path, {"processed": {}, "queue": [], "uploads_by_day": {}})
    streamers = list(permitted(registry, cfg))
    if not streamers:
        log("no streamers to clip: add them to streamers.json with \"permission\" and \"channel\"")

    for key, entry in streamers:
        until = queued_until(state["queue"], entry["channel"])
        if until and until > now_utc() + datetime.timedelta(days=cfg["queue_days"]):
            continue  # this channel has a week of posts lined up already
        try:
            for url in new_vods(entry, state, cfg["vods_per_run"]):
                clip_vod(url, key, entry, cfg, state, registry)
                save_json(state_path, state)
        except Exception as e:  # one streamer's broken VOD must not stop the others
            log(f"{key}: {e}")
            if a.verbose:
                traceback.print_exc()

    if not a.no_upload:
        for _ in upload_due(cfg, state, a.client_secret):
            save_json(state_path, state)
    save_json(state_path, state)


def cmd_status(a, cfg):
    state = load_json(os.path.join(cfg["work_dir"], "state.json"), {"queue": []})
    tz = ZoneInfo(cfg["timezone"])
    rows = sorted(state["queue"], key=lambda q: q["post_at"])
    for q in rows:
        if q["status"] == "uploaded" and not a.all:
            continue
        at = datetime.datetime.fromisoformat(q["post_at"]).astimezone(tz)
        print(f"{at:%a %b %d %H:%M}  {q['status']:8s}  {q['channel']:20s}  {q['title']}")
    counts = {}
    for q in rows:
        counts[q["status"]] = counts.get(q["status"], 0) + 1
    print(", ".join(f"{n} {s}" for s, n in sorted(counts.items())) or "queue is empty")


def cmd_connect(a, cfg):
    import youtube_upload
    tok = token_path(cfg, a.channel)
    os.makedirs(os.path.dirname(tok), exist_ok=True)
    print("A browser window will open. Pick the YouTube channel (brand account) this name should post to.")
    title = youtube_upload.channel_title(a.client_secret, tok)
    print(f"connected {a.channel!r} -> YouTube channel {title!r}. Use \"channel\": \"{a.channel}\" in streamers.json.")


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--config", default="autopilot.json")
    p.add_argument("--streamers", default="streamers.json")
    p.add_argument("--client-secret", default="client_secret.json")
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run", help="clip new VODs and upload clips that are due")
    r.add_argument("--no-upload", action="store_true", help="only clip and queue")
    r.add_argument("--verbose", action="store_true")
    s = sub.add_parser("status", help="show the posting queue")
    s.add_argument("--all", action="store_true", help="include clips already uploaded")
    c = sub.add_parser("connect", help="sign in to a YouTube channel and save its token")
    c.add_argument("channel", help="a short name for the channel, used in streamers.json")
    a = p.parse_args(argv)

    cfg = dict(DEFAULTS, **{k: v for k, v in load_json(a.config, {}).items() if not k.startswith("_")})
    os.makedirs(cfg["work_dir"], exist_ok=True)
    {"run": cmd_run, "status": cmd_status, "connect": cmd_connect}[a.cmd](a, cfg)


if __name__ == "__main__":
    sys.exit(main())
