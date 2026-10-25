# Stream Clipper

Finds the high-action moments in a stream VOD, cuts them into clips, and uploads them to YouTube with
the streamer credited and linked, and titles, descriptions and tags written for search. The
[autopilot](#autopilot-clip-channels-that-run-themselves) does it all week for many streamers, each
with their own channel, and [discover.py](#1-find-streamers) finds streamers worth asking.

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
python clipper.py stream.mp4 --vertical                  # 9:16 for YouTube Shorts
```

**Chat** makes the biggest difference on Twitch. Download it with
[chat-downloader](https://github.com/xenova/chat-downloader) and pass it in:

```sh
pip install chat-downloader
chat_downloader https://www.twitch.tv/videos/123456 --output chat.json
python clipper.py stream.mp4 --chat chat.json
```

**Shorts layout:** `--vertical` puts the whole 16:9 picture over a blurred copy of itself, so
facecams and HUDs at the edges stay in. `--vertical-style crop` fills the screen with the middle
third instead, which suits games where the action is centred.

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

## Autopilot: clip channels that run themselves

`autopilot.py` runs the whole thing on a schedule: it watches each streamer's Twitch for new VODs,
clips them, and posts to each streamer's own YouTube channel at set times through the week.

```
discover.py  ->  you reach out  ->  streamers.json  ->  autopilot.py run (hourly)  ->  YouTube channels
 (find who)       (they say yes)     (permission,        clip new VODs, queue posts,
                                      channel, links)    upload what's due
```

### 1. Find streamers

```sh
export TWITCH_CLIENT_ID=...  TWITCH_CLIENT_SECRET=...   # free app at https://dev.twitch.tv/console/apps
python discover.py --games "Valorant,Minecraft,Just Chatting" --min-viewers 50 --max-viewers 2000
```

It looks at everyone live in those categories within the viewer range and ranks them in
`candidates.csv`. Ranking goes up for a real audience (log scale, so mid-size streamers can compete),
an active clip culture (lots of clips made by their chat in the last 30 days) and a bio that mentions
clips, editors, YouTube or TikTok. It goes down for every other YouTube channel already posting
their clips (found with a YouTube search through yt-dlp, so it uses none of your API quota).
Run it on different days and times; it only sees who is live right now.

It doesn't message anyone. Reach out yourself (Twitch whisper, Discord, or the business email in
their panels). For example:

> Hey <name>, I run clip channels and would love to start a YouTube Shorts channel just for your
> streams: your best moments, credited and linking back to your Twitch in every video. No cost to
> you; happy to split ad revenue <x>/<y> or hand the channel over if you ever want it. Okay if I go
> ahead?

Keep their answer (a screenshot is fine).

### 2. Make a YouTube channel for each streamer

YouTube doesn't let programs create channels, so this part is by hand, once per streamer: in
YouTube, *Settings → Add or manage your channels → Create a channel* (each one is a Brand Account
under your Google login). Name it something like "<Streamer> Clips", and use their channel
art only if they say you can. Phone-verify it under *YouTube Studio → Settings → Channel → Feature
eligibility* so it can have custom thumbnails.

Then connect it, giving it a short name:

```sh
python autopilot.py connect examplestreamer-clips
```

Google's sign-in asks which channel to use; the command prints the channel it connected to.

### 3. Add them to `streamers.json`

```json
"examplestreamer": {
  "name": "ExampleStreamer",
  "permission": "Said yes in Twitch DMs 2026-10-20; 50/50 split",
  "channel": "examplestreamer-clips",
  "links": {"Twitch": "https://www.twitch.tv/examplestreamer", "YouTube": "https://www.youtube.com/@examplestreamer"}
}
```

The autopilot skips anyone without a `permission` note. Several streamers can share a channel.

### 4. Schedule it

Copy `autopilot.example.json` to `autopilot.json` and set your time zone and posting times. Then run
`python autopilot.py run` every hour on a computer that stays on:

- **Mac/Linux:** `crontab -e`, add `0 * * * * cd /path/to/streamclipper && python3 autopilot.py run >> autopilot/log.txt 2>&1`
- **Windows:** Task Scheduler → Create Basic Task → Daily, then in the trigger's settings repeat every
  1 hour; action `python` with arguments `autopilot.py run` and "Start in" set to this folder.

Each run:

1. Checks every permitted streamer's last few Twitch VODs for ones it hasn't clipped, skipping any
   still live and any channel that already has `queue_days` (7) of posts lined up.
2. Downloads the **160p** copy to find the action (a 5-hour stream is ~500 MB instead of 16 GB),
   then fetches **only the clip sections** at 1080p, turns them into Shorts and writes the credited
   SEO title, description and tags. The best moments get the earliest slots.
3. Gives each clip the next free posting slot on its channel (`slots`, default 12:00, 17:00,
   20:00), never more than `daily_upload_limit` posts a day across all channels.
4. Uploads clips due in the next 3 hours as scheduled videos that YouTube makes public at their slot,
   then deletes the local file.

`python autopilot.py status` shows what's queued for each channel and when it goes out. Runs never
overlap, a failed upload is retried up to 3 times, and if the computer was off, overdue clips post
on the next run.

**Chat** makes the picks much better but is off by default, because Twitch has no official API for
chat replays. If you install [TwitchDownloaderCLI](https://github.com/lay295/TwitchDownloader), set
`"chat_command": "TwitchDownloaderCLI chatdownload --id {id} -o {out}"` in `autopilot.json`.

### Before you rely on it: YouTube's API limits

- **Get the API project audited.** YouTube locks every video uploaded through an unaudited API
  project as **private**, scheduled or not. Fill in the
  [YouTube API Services audit and quota extension form](https://support.google.com/youtube/contact/yt_api_form)
  for your Google Cloud project. Until it's approved, set `"privacy": "private"` and publish from
  YouTube Studio by hand.
- **Quota is shared by all your channels.** One project gets 10,000 units a day and an upload costs
  1,600, so about **6 uploads a day in total**, not per channel. Ask for more on the same form.
  Making extra Google Cloud projects to get around the limit breaks the API's terms and can get
  all of them shut off.
- **Raw clips alone don't get monetised.** YouTube's *reused content* rule keeps channels of unedited
  clips out of the Partner Program, and many channels posting near-identical automatic uploads can
  be flagged as spam. Use the autopilot for volume, but give each channel something of its own:
  rewrite the best titles, add captions or commentary, and make weekly compilations.

### Whose streams you can repost

Only upload footage you own or that the streamer has given you permission to repost, which is why
`--upload` needs `--confirm-rights`. Reuploading someone else's stream without permission gets
copyright strikes, and YouTube's *reused content* policy demonetises channels built on unedited clips.
Many streamers welcome clip channels, often with a revenue split; get it in writing. The credit in
each description says the clip was reposted with permission, so only upload when that's true.
