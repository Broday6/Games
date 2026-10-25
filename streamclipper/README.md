# Stream Clipper

Finds the high-action moments in a stream VOD, cuts them into clips, and uploads them to YouTube with
the streamer credited and linked, and titles, descriptions and tags written for search.

## How it picks moments

Every second of the VOD gets a score from three signals:

| Signal | What it measures | Why |
|---|---|---|
| **audio** | loudness compared with the last couple of minutes | yelling, explosions, hype |
| **motion** | how much the picture changes between frames | fights, fast camera, flashes |
| **chat** (optional) | messages per second | chat spamming is the most reliable sign that something happened |

Each signal is compared with its own rolling baseline, so a streamer who is always loud doesn't score
high all the time; only moments that stand out from their surroundings do. The strongest peaks, at
least 45 s apart, become clips running from 20 s before the peak to 10 s after it.

## Setup

Needs Python 3.9+ and [ffmpeg](https://ffmpeg.org/download.html) on your PATH.

```sh
cd streamclipper
pip install -r requirements.txt
```

## Use

```sh
python clipper.py stream.mp4 --dry-run                   # just list the moments it found
python clipper.py stream.mp4                             # cut them into clips/
python clipper.py https://www.twitch.tv/videos/123456    # download the VOD with yt-dlp first
python clipper.py stream.mp4 --vertical                  # 9:16 crops for YouTube Shorts
```

**Chat** makes the biggest difference on Twitch. Download it with
[chat-downloader](https://github.com/xenova/chat-downloader) and pass it in:

```sh
pip install chat-downloader
chat_downloader https://www.twitch.tv/videos/123456 --output chat.json
python clipper.py stream.mp4 --chat chat.json
```

**Tuning:** `--threshold` (default 2.0; lower finds more clips), `--max-clips`, `--pre` / `--post`
(seconds around the peak), `--min-gap`, and `--weights audio=1,motion=0.6,chat=1.5`. For a game that
is visually busy all the time, lower the motion weight.

Each run writes `clips/<name>_clips.json` listing every clip's times, score, title, description and tags.

## Crediting streamers

Every clip's description credits the streamer and links their real channels. The links come from
only two places, so nothing is guessed:

1. **The VOD itself.** When you pass a Twitch, YouTube or Kick link, yt-dlp saves the stream's
   metadata: streamer name, channel, stream date, and (on Twitch) which game was being played at
   each point, so a clip from the Valorant half of a stream is labelled Valorant.
2. **`streamers.json`**, your list of each streamer's other channels (YouTube, X, TikTok, ...).
   Copy `streamers.example.json` to start, and only add channels you've checked are theirs.

For a local file with no metadata, pass `--streamer`, `--channel-url`, `--vod-url`, `--game` and
`--date`. Uploading refuses to run if there's no streamer name and at least one channel link to credit.

A generated description looks like this:

```
ExampleStreamer Valorant highlight from the October 24, 2026 stream. All credit to ExampleStreamer: go follow and support them live!

Follow ExampleStreamer:
▶ Twitch: https://www.twitch.tv/examplestreamer
▶ YouTube: https://www.youtube.com/@examplestreamer

Watch this moment in the full stream: https://www.twitch.tv/videos/123456?t=0h02m31s

Clipped from ExampleStreamer's stream. Footage belongs to ExampleStreamer; reposted with permission.

#ExampleStreamer #Valorant #StreamHighlights
```

## SEO

| What | How it's built | Why |
|---|---|---|
| **Title** | `Streamer Game Highlight #n (Oct 24 Stream)`, or `Streamer <hook> \| Game` when a clip has a hook; under 70 characters, no ALL CAPS | search ranks the words at the front highest, and longer titles get cut off in results; each clip gets its own title so they don't compete |
| **Description** | the first line holds the keywords (streamer, game, "highlight", date) and the credit, then channel links, a timestamped link to the full stream, and 3 hashtags | search results show only the first ~150 characters; YouTube puts the first 3 hashtags above the title and ignores all of them past 15 |
| **Tags** | streamer name, "<streamer> clips/highlights", the game, "<game> highlights", tags from `streamers.json` and `--tags`, cut to YouTube's 500-character limit | catches misspellings and related searches |
| **Thumbnail** | the frame at the peak of the action, 1280×720 (regular videos only; Shorts can't have custom thumbnails) | thumbnails decide click-through rate. Needs a phone-verified channel |
| **Category & language** | Gaming, plus the language of the stream (`--language`, default `en`) | helps YouTube show it to the right audience |

**Hooks matter most.** "ExampleStreamer Valorant Highlight #2" is accurate but bland, and the tool
can't see what actually happened. Before uploading, open `clips/<name>_clips.json`, watch each clip,
and rewrite its `title` with what happened ("ExampleStreamer Hits a 1v5 Ace | Valorant"). Keep it
truthful: misleading titles break YouTube's spam policy and hurt retention, which hurts ranking.
You can also edit `description` and `tags` there.

## Uploading to YouTube

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable
   **YouTube Data API v3**.
2. Under *APIs & Services → Credentials*, create an **OAuth client ID** of type **Desktop app** and
   download it as `client_secret.json` into this folder. While the OAuth app is in testing, add your
   Google account as a test user.
3. Cut, review, then upload from the manifest:

```sh
python clipper.py https://www.twitch.tv/videos/123456 --chat chat.json
# edit titles in clips/123456_clips.json
python clipper.py clips/123456_clips.json --upload --confirm-rights
```

The first upload opens a browser to sign in to the channel; after that the token is kept in
`token.json` (don't commit it or `client_secret.json`). Uploads are **private by default** so you can
check them in YouTube Studio first; pass `--privacy public` once you trust the picks. The default API
quota allows about 6 uploads a day. If a batch stops partway, run the same command again: clips
already uploaded are skipped.

### Whose streams you can repost

Only upload footage you own or that the streamer has given you permission to repost, which is why
`--upload` needs `--confirm-rights`. Reuploading someone else's stream without permission gets
copyright strikes, and YouTube's *reused content* policy demonetises channels built on unedited clips.
Many streamers welcome clip channels, often with a revenue split; get it in writing. The credit in
each description says the clip was reposted with permission, so only upload when that's true.
