#!/usr/bin/env python3
"""Find streamers worth starting a clip channel for: real audiences, active clip culture, few clippers.

    python discover.py --games "Valorant,Minecraft" --min-viewers 50 --max-viewers 2000

Needs a free Twitch app (https://dev.twitch.tv/console/apps): set TWITCH_CLIENT_ID and
TWITCH_CLIENT_SECRET. Writes a ranked candidates.csv. Nothing is posted or messaged; reach out to
the ones you like yourself and add them to streamers.json once they say yes.

How a streamer is scored:

* audience      - viewers right now (log scale, so mid-size streamers are not drowned out)
* clip culture  - clips their viewers made in the last 30 days; chat that clips a lot means
                  moments worth posting, and a streamer used to seeing their clips shared
* open to clips - their bio mentions clips, clippers, editors, YouTube or TikTok
* competition   - other YouTube channels already posting "<name> clips" (searched with yt-dlp,
                  so it costs no YouTube API quota)
"""
import argparse
import csv
import datetime
import json
import math
import os
import re
import sys
import urllib.parse
import urllib.request

HELIX = "https://api.twitch.tv/helix"
FRIENDLY = re.compile(r"\b(clip(s|per|pers|ping)?|editors?|youtube|tiktok|shorts)\b", re.I)


class Twitch:
    def __init__(self, client_id, client_secret):
        body = urllib.parse.urlencode({"client_id": client_id, "client_secret": client_secret,
                                       "grant_type": "client_credentials"}).encode()
        with urllib.request.urlopen("https://id.twitch.tv/oauth2/token", body, timeout=30) as r:
            self.token = json.load(r)["access_token"]
        self.client_id = client_id

    def get(self, path, **params):
        url = f"{HELIX}/{path}?{urllib.parse.urlencode(params, doseq=True)}"
        req = urllib.request.Request(url, headers={"Client-Id": self.client_id,
                                                   "Authorization": f"Bearer {self.token}"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)

    def pages(self, path, max_items, **params):
        items, cursor = [], None
        while len(items) < max_items:
            resp = self.get(path, first=100, **params, **({"after": cursor} if cursor else {}))
            items += resp.get("data", [])
            cursor = resp.get("pagination", {}).get("cursor")
            if not cursor or not resp.get("data"):
                break
        return items[:max_items]


def live_streams(tw, games, language, min_viewers, max_viewers, pages):
    if games:
        data = tw.get("games", name=games)["data"]
        ids = [g["id"] for g in data]
        missing = {g.lower() for g in games} - {g["name"].lower() for g in data}
        if missing:
            print(f"not found on Twitch (check spelling): {', '.join(sorted(missing))}", file=sys.stderr)
    else:
        ids = [g["id"] for g in tw.get("games/top", first=20)["data"]]
    found = {}
    for gid in ids:
        for s in tw.pages("streams", pages * 100, game_id=gid, language=language, type="live"):
            if min_viewers <= s["viewer_count"] <= max_viewers:
                found.setdefault(s["user_id"], s)
    return list(found.values())


def clip_count(tw, user_id, days=30, cap=300):
    now = datetime.datetime.now(datetime.timezone.utc)
    stamp = "%Y-%m-%dT%H:%M:%SZ"
    # Without ended_at, Twitch only returns the first week after started_at.
    clips = tw.pages("clips", cap, broadcaster_id=user_id,
                     started_at=(now - datetime.timedelta(days=days)).strftime(stamp), ended_at=now.strftime(stamp))
    return len(clips), sum(c.get("view_count", 0) for c in clips)


def competition(name, results=20):
    """Other channels already posting this streamer's clips, from a YouTube search via yt-dlp."""
    import yt_dlp
    opts = {"quiet": True, "extract_flat": True, "skip_download": True, "no_warnings": True}
    with yt_dlp.YoutubeDL(opts) as ydl:
        entries = ydl.extract_info(f"ytsearch{results}:{name} clips", download=False).get("entries") or []
    return count_competitors(name, entries)


def _norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def count_competitors(name, entries):
    """(channels other than the streamer posting videos named after them, whether the streamer has a channel)."""
    key = _norm(name)
    others, own = set(), False
    for e in entries:
        channel = e.get("channel") or e.get("uploader") or ""
        if key not in _norm(e.get("title")):
            continue
        if _norm(channel) == key or (_norm(channel).startswith(key) and "clip" not in channel.lower()):
            own = True
        else:
            others.add(channel)
    return len(others), own


def score(viewers, clips_30d, friendly, competitors):
    return round(math.log10(viewers + 1) * (1 + min(clips_30d, 300) / 25)
                 * (1.5 if friendly else 1.0) / (1 + competitors), 2)


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--games", default="", help="comma-separated Twitch categories (default: top 20)")
    p.add_argument("--language", default="en")
    p.add_argument("--min-viewers", type=int, default=50)
    p.add_argument("--max-viewers", type=int, default=2000,
                   help="above this most streamers already have clip channels (default 2000)")
    p.add_argument("--pages", type=int, default=2, help="pages of 100 live streams per game (default 2)")
    p.add_argument("--limit", type=int, default=40, help="how many candidates to check in depth (default 40)")
    p.add_argument("--out", default="candidates.csv")
    a = p.parse_args(argv)

    cid, secret = os.environ.get("TWITCH_CLIENT_ID"), os.environ.get("TWITCH_CLIENT_SECRET")
    if not cid or not secret:
        p.error("set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET (create an app at https://dev.twitch.tv/console/apps)")
    tw = Twitch(cid, secret)
    games = [g.strip() for g in a.games.split(",") if g.strip()]
    streams = live_streams(tw, games, a.language, a.min_viewers, a.max_viewers, a.pages)
    print(f"{len(streams)} live streams between {a.min_viewers} and {a.max_viewers} viewers")

    # Cheap filter first: clip culture, from Twitch. Then the YouTube search only for the best.
    users = {}
    for i in range(0, len(streams), 100):
        for u in tw.get("users", id=[s["user_id"] for s in streams[i:i + 100]])["data"]:
            users[u["id"]] = u
    rows = []
    for s in streams:
        u = users.get(s["user_id"], {})
        n, views = clip_count(tw, s["user_id"])
        rows.append({"name": s["user_name"], "login": s["user_login"], "game": s["game_name"],
                     "viewers": s["viewer_count"], "clips_30d": n, "clip_views_30d": views,
                     "friendly_bio": bool(FRIENDLY.search(u.get("description", ""))),
                     "partner": u.get("broadcaster_type", ""), "bio": u.get("description", "")[:200],
                     "twitch": f"https://www.twitch.tv/{s['user_login']}"})
    rows.sort(key=lambda r: score(r["viewers"], r["clips_30d"], r["friendly_bio"], 0), reverse=True)
    rows = rows[:a.limit]
    for r in rows:
        try:
            r["competing_channels"], r["has_own_youtube"] = competition(r["name"])
        except Exception as e:
            print(f"  youtube search failed for {r['name']}: {e}", file=sys.stderr)
            r["competing_channels"], r["has_own_youtube"] = -1, False
        r["score"] = score(r["viewers"], r["clips_30d"], r["friendly_bio"], max(r["competing_channels"], 0))
    rows.sort(key=lambda r: r["score"], reverse=True)

    with open(a.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["score", "name", "game", "viewers", "clips_30d", "clip_views_30d",
                                          "competing_channels", "has_own_youtube", "friendly_bio",
                                          "partner", "twitch", "login", "bio"])
        w.writeheader()
        w.writerows(rows)
    print(f"\n{'score':>6}  {'streamer':20s} {'game':22s} {'viewers':>7} {'clips/30d':>9} {'rivals':>6}")
    for r in rows[:15]:
        print(f"{r['score']:6.1f}  {r['name'][:20]:20s} {r['game'][:22]:22s} {r['viewers']:7d} "
              f"{r['clips_30d']:9d} {r['competing_channels']:6d}" + ("  bio mentions clips" if r["friendly_bio"] else ""))
    print(f"\nwrote {a.out}")


if __name__ == "__main__":
    sys.exit(main())
