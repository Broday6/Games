# Stream Clipper

Finds the high-action moments in a stream VOD, cuts them into clips, and can upload them to YouTube.

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

Each run writes `clips/<name>_clips.json` listing every clip's start, end, peak and score.

## Uploading to YouTube

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable
   **YouTube Data API v3**.
2. Under *APIs & Services → Credentials*, create an **OAuth client ID** of type **Desktop app** and
   download it as `client_secret.json` into this folder. While the OAuth app is in testing, add your
   Google account as a test user.
3. Run:

```sh
python clipper.py stream.mp4 --vertical --upload --confirm-rights \
  --title "{name} - insane moment {n}" --description "Clipped from ..." --tags gaming,highlights
```

The first upload opens a browser to sign in to the channel; after that the token is kept in
`token.json` (don't commit it or `client_secret.json`). Uploads are **private by default** so you can
check them in YouTube Studio first; pass `--privacy public` once you trust the picks. The default API
quota allows about 6 uploads a day.

### Whose streams you can repost

Only upload footage you own or that the streamer has given you permission to repost, which is why
`--upload` needs `--confirm-rights`. Reuploading someone else's stream without permission gets
copyright strikes, and YouTube's *reused content* policy demonetises channels built on unedited clips.
Many streamers welcome clip channels, often with a revenue split; get it in writing, and credit
them in the description.
