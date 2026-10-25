"""Titles, descriptions and tags that credit the streamer and follow YouTube SEO practice.

What the generated metadata does, and why:

* Title: streamer name first, then the game, kept under 70 characters so search results and
  suggested-video cards do not cut it off (YouTube's hard limit is 100). Every clip gets a
  distinct title; duplicate titles compete with each other.
* Description: the first ~150 characters are what search shows, so line one carries the
  keywords (streamer, game, "highlights") and the credit. The streamer's real channels come right
  after, then a timestamped link to the moment in the full stream, then 3 hashtags (YouTube shows
  the first three above the title and ignores all of them past fifteen).
* Tags: streamer name and login, the game, and the phrases people search ("<streamer> clips",
  "<game> highlights"), trimmed to YouTube's 500-character budget.

Links only ever come from the VOD's own metadata or from streamers.json, never guesses.
"""
import datetime
import json
import os
import re

TITLE_TARGET = 70
TITLE_MAX = 100
TAGS_BUDGET = 500
DESCRIPTION_MAX = 5000


def load_registry(path):
    if not path or not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return {k.lower(): v for k, v in data.items() if not k.startswith("_")}


def _channel_url(info):
    """The streamer's own channel page, as reported by the platform the VOD came from."""
    url = info.get("webpage_url") or ""
    if "twitch.tv" in url and info.get("uploader_id"):
        return "Twitch", f"https://www.twitch.tv/{info['uploader_id']}"
    for key in ("channel_url", "uploader_url"):
        if info.get(key):
            platform = "YouTube" if "youtube.com" in info[key] else \
                "Kick" if "kick.com" in info[key] else "Channel"
            return platform, info[key]
    return None, None


def streamer_profile(info, registry, name=None, channel_url=None, game=None):
    """Merge what the VOD says about its streamer with the user's registry entry and CLI flags."""
    keys = [k.lower() for k in (name, info.get("uploader_id"), info.get("uploader"), info.get("channel")) if k]
    entry = next((registry[k] for k in keys if k in registry), {})
    display = name or entry.get("name") or info.get("uploader") or info.get("channel")
    links = {}
    platform, url = _channel_url(info)
    if url:
        links[platform] = url
    if channel_url:
        links.setdefault(_platform_of(channel_url), channel_url)
    for p, u in entry.get("links", {}).items():
        if u and u not in links.values():
            links.setdefault(p, u)
    return {
        "name": display,
        "login": info.get("uploader_id"),
        "links": links,
        "game": game or entry.get("game"),
        "tags": entry.get("tags", []),
    }


def _platform_of(url):
    for host, name in (("twitch.tv", "Twitch"), ("youtube.com", "YouTube"), ("youtu.be", "YouTube"),
                       ("kick.com", "Kick"), ("tiktok.com", "TikTok"), ("x.com", "X"),
                       ("twitter.com", "X"), ("instagram.com", "Instagram")):
        if host in url:
            return name
    return "Channel"


def game_at(info, t, fallback=None):
    """The game being played at second `t`, from Twitch chapters or the VOD's category."""
    for ch in info.get("chapters") or []:
        if ch.get("start_time", 0) <= t < ch.get("end_time", float("inf")) and ch.get("title"):
            return ch["title"]
    cats = info.get("categories") or []
    return fallback or (cats[0] if cats and cats[0] != "Gaming" else None)


def stream_date(info):
    if info.get("timestamp"):
        return datetime.datetime.fromtimestamp(info["timestamp"], datetime.timezone.utc).date()
    if info.get("upload_date"):
        return datetime.datetime.strptime(info["upload_date"], "%Y%m%d").date()
    return None


def timestamp_link(url, t):
    """Link to second `t` of the full stream, when the platform supports it."""
    if not url:
        return None
    t = int(t)
    if "twitch.tv" in url:
        return f"{url.split('?')[0]}?t={t // 3600}h{t // 60 % 60:02d}m{t % 60:02d}s"
    if "youtube.com" in url or "youtu.be" in url:
        return f"{url}{'&' if '?' in url else '?'}t={t}s"
    return url


def hashtag(text):
    words = re.findall(r"[A-Za-z0-9]+", text or "")
    return "#" + "".join(w[:1].upper() + w[1:] for w in words) if words else None


def _fit_title(parts):
    """Join title parts, dropping trailing ones until it fits the target length."""
    parts = [p for p in parts if p]
    while len(parts) > 1 and len(" ".join(parts)) > TITLE_TARGET:
        parts.pop()
    return " ".join(parts)[:TITLE_MAX].rstrip(" |-")


def _clean(s):
    # No shouting: YouTube and viewers both read ALL CAPS titles as spam.
    s = re.sub(r"\s+", " ", s or "").strip()
    return s.title() if s.isupper() and len(s) > 4 else s


def build_title(streamer, game, n, date, hook=None, template=None):
    name = _clean(streamer["name"])
    game = _clean(game)
    when = f"({date:%b} {date.day} Stream)" if date else None
    if template:
        return template.format(streamer=name, game=game or "", n=n, hook=hook or "",
                               date=f"{date:%b} {date.day}" if date else "")[:TITLE_MAX].strip()
    if hook:
        return _fit_title([f"{name} {_clean(hook)}", f"| {game}" if game else None])
    return _fit_title([name, game, f"Highlight #{n}", when])


def build_tags(streamer, game, extra=()):
    name, login = streamer["name"], streamer.get("login")
    candidates = [name, login, f"{name} clips", f"{name} highlights", f"{name} stream",
                  game, f"{game} highlights" if game else None, f"{game} clips" if game else None,
                  f"{name} {game}" if game else None, *streamer.get("tags", []), *extra,
                  "stream highlights", "twitch highlights", "gaming clips"]
    tags, seen, used = [], set(), 0
    for t in candidates:
        if not t or t.lower() in seen:
            continue
        cost = len(t) + (2 if " " in t else 0) + (1 if tags else 0)  # spaces cost quotes, commas join
        if used + cost > TAGS_BUDGET:
            break
        tags.append(t)
        seen.add(t.lower())
        used += cost
    return tags


def build_description(streamer, game, clip, info, date, vertical=False, note=""):
    name = streamer["name"]
    what = f"{name} {game} highlight" if game else f"{name} stream highlight"
    when = f" from the {date:%B} {date.day}, {date.year} stream" if date else ""
    lines = [f"{what}{when}. All credit to {name}: go follow and support them live!", ""]
    if note:
        lines += [note, ""]
    if streamer["links"]:
        lines.append(f"Follow {name}:")
        lines += [f"▶ {p}: {u}" for p, u in streamer["links"].items()]
        lines.append("")
    full = timestamp_link(info.get("webpage_url"), clip["start"])
    if full:
        lines += [f"Watch this moment in the full stream: {full}", ""]
    lines.append(f"Clipped from {name}'s stream. Footage belongs to {name}; reposted with permission.")
    tags = [hashtag(name), hashtag(game), "#Shorts" if vertical else "#StreamHighlights"]
    lines += ["", " ".join(t for t in tags if t)]
    return "\n".join(lines)[:DESCRIPTION_MAX]


def metadata(clip, n, info, streamer, vertical=False, title_template=None, note="", extra_tags=()):
    """Title, description and tags for one clip."""
    game = game_at(info, clip["peak"], streamer.get("game"))
    date = stream_date(info)
    return {
        "title": build_title(streamer, game, n, date, clip.get("hook"), title_template),
        "description": build_description(streamer, game, clip, info, date, vertical, note),
        "tags": build_tags(streamer, game, extra_tags),
        "game": game,
    }
