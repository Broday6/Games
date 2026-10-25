"""Upload clips with the YouTube Data API v3.

Setup (once): in Google Cloud Console create a project, enable "YouTube Data API v3", create an
OAuth client ID of type "Desktop app" and download it as client_secret.json. The first upload
opens a browser to sign in to the channel; the token is cached in token.json afterwards.

Each upload costs 1600 of the default 10,000 daily quota units, so about 6 uploads a day.
"""
import os

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


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


def upload(path, title, description="", tags=(), privacy="private", category="20",
           client_secret="client_secret.json", token="token.json"):
    """Upload one video and return its YouTube id. Category 20 is Gaming."""
    from googleapiclient.http import MediaFileUpload

    yt = _service(client_secret, token)
    body = {
        "snippet": {"title": title[:100], "description": description, "tags": list(tags),
                    "categoryId": category},
        "status": {"privacyStatus": privacy, "selfDeclaredMadeForKids": False},
    }
    req = yt.videos().insert(part="snippet,status", body=body,
                             media_body=MediaFileUpload(path, chunksize=-1, resumable=True))
    resp = None
    while resp is None:
        _, resp = req.next_chunk()
    return resp["id"]
