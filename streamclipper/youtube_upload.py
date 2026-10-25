"""Upload clips with the YouTube Data API v3.

Setup (once): in Google Cloud Console create a project, enable "YouTube Data API v3", create an
OAuth client ID of type "Desktop app" and download it as client_secret.json. The first upload
opens a browser to sign in to the channel; the token is cached in token.json afterwards.

Each upload costs 1600 of the default 10,000 daily quota units, so about 6 uploads a day.
"""
import os

# readonly lets `autopilot.py connect` show which channel a token belongs to.
SCOPES = ["https://www.googleapis.com/auth/youtube.upload",
          "https://www.googleapis.com/auth/youtube.readonly"]


def _service(client_secret="client_secret.json", token="token.json"):
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build

    creds = Credentials.from_authorized_user_file(token, SCOPES) if os.path.exists(token) else None
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            creds = InstalledAppFlow.from_client_secrets_file(client_secret, SCOPES).run_local_server(port=0)
        with open(token, "w") as f:
            f.write(creds.to_json())
    return build("youtube", "v3", credentials=creds)


def upload(path, title, description="", tags=(), privacy="private", category="20", language="en",
           thumbnail=None, publish_at=None, client_secret="client_secret.json", token="token.json"):
    """Upload one video and return its YouTube id. Category 20 is Gaming.

    Setting the language helps YouTube rank the video for searches in that language. A custom
    thumbnail needs a phone-verified channel; if YouTube refuses it the upload still stands.
    `publish_at` (an RFC 3339 time) uploads the video private and YouTube makes it public then.
    """
    from googleapiclient.errors import HttpError
    from googleapiclient.http import MediaFileUpload

    yt = _service(client_secret, token)
    body = {
        "snippet": {"title": title[:100], "description": description, "tags": list(tags),
                    "categoryId": category, "defaultLanguage": language,
                    "defaultAudioLanguage": language},
        "status": {"privacyStatus": "private" if publish_at else privacy, "selfDeclaredMadeForKids": False},
    }
    if publish_at:
        body["status"]["publishAt"] = publish_at
    req = yt.videos().insert(part="snippet,status", body=body,
                             media_body=MediaFileUpload(path, chunksize=-1, resumable=True))
    resp = None
    while resp is None:
        _, resp = req.next_chunk()
    if thumbnail:
        try:
            yt.thumbnails().set(videoId=resp["id"], media_body=MediaFileUpload(thumbnail)).execute()
        except HttpError as e:
            print(f"  thumbnail not set ({e.reason}); verify the channel to allow custom thumbnails")
    return resp["id"]


def channel_title(client_secret="client_secret.json", token="token.json"):
    """Sign in (if needed) and return the title of the channel the token uploads to."""
    resp = _service(client_secret, token).channels().list(part="snippet", mine=True).execute()
    items = resp.get("items") or []
    return items[0]["snippet"]["title"] if items else None
