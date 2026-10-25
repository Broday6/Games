"""Run with: python -m unittest test_seo"""
import unittest

import seo

TWITCH_INFO = {
    "webpage_url": "https://www.twitch.tv/videos/123456",
    "uploader": "ExampleStreamer", "uploader_id": "examplestreamer",
    "timestamp": 1792864800,  # 2026-10-24 18:00 UTC
    "chapters": [{"start_time": 0, "end_time": 3600, "title": "Just Chatting"},
                 {"start_time": 3600, "end_time": 9000, "title": "Valorant"}],
}
REGISTRY = {"examplestreamer": {"links": {"YouTube": "https://www.youtube.com/@examplestreamer",
                                          "Twitch": "https://www.twitch.tv/examplestreamer"},
                                "tags": ["example vods"]}}
CLIP = {"start": 3700, "end": 3730, "peak": 3720}


class Credit(unittest.TestCase):
    def test_links_come_from_vod_and_registry_without_duplicates(self):
        s = seo.streamer_profile(TWITCH_INFO, REGISTRY)
        self.assertEqual(s["name"], "ExampleStreamer")
        self.assertEqual(s["links"], {"Twitch": "https://www.twitch.tv/examplestreamer",
                                      "YouTube": "https://www.youtube.com/@examplestreamer"})

    def test_no_links_are_invented(self):
        s = seo.streamer_profile({}, {}, name="Someone")
        self.assertEqual(s["links"], {})

    def test_description_credits_and_links_the_moment(self):
        s = seo.streamer_profile(TWITCH_INFO, REGISTRY)
        m = seo.metadata(CLIP, 1, TWITCH_INFO, s)
        d = m["description"]
        first = d.splitlines()[0]
        self.assertIn("ExampleStreamer Valorant highlight", first)
        self.assertIn("October 24, 2026", first)
        self.assertIn("https://www.twitch.tv/examplestreamer", d)
        self.assertIn("https://www.youtube.com/@examplestreamer", d)
        self.assertIn("https://www.twitch.tv/videos/123456?t=1h01m40s", d)
        self.assertEqual(d.splitlines()[-1], "#ExampleStreamer #Valorant #StreamHighlights")


class Seo(unittest.TestCase):
    def setUp(self):
        self.s = seo.streamer_profile(TWITCH_INFO, REGISTRY)

    def test_title_front_loads_streamer_and_game_and_fits(self):
        t = seo.metadata(CLIP, 3, TWITCH_INFO, self.s)["title"]
        self.assertEqual(t, "ExampleStreamer Valorant Highlight #3 (Oct 24 Stream)")
        long = dict(self.s, name="A Streamer With An Extremely Long Display Name Indeed")
        self.assertLessEqual(len(seo.build_title(long, "Some Very Long Game Title: Remastered", 1,
                                                 seo.stream_date(TWITCH_INFO))), seo.TITLE_TARGET)

    def test_hook_and_caps(self):
        t = seo.build_title(self.s, "Valorant", 1, None, hook="HITS AN INSANE ACE")
        self.assertEqual(t, "ExampleStreamer Hits An Insane Ace | Valorant")

    def test_titles_are_unique_per_clip(self):
        titles = {seo.metadata(CLIP, n, TWITCH_INFO, self.s)["title"] for n in range(1, 6)}
        self.assertEqual(len(titles), 5)

    def test_tags_fit_budget_and_lead_with_streamer(self):
        tags = seo.metadata(CLIP, 1, TWITCH_INFO, self.s, extra_tags=["x" * 40] * 30)["tags"]
        self.assertEqual(tags[0], "ExampleStreamer")
        self.assertIn("Valorant highlights", tags)
        self.assertIn("example vods", tags)
        cost = sum(len(t) + (2 if " " in t else 0) for t in tags) + len(tags) - 1
        self.assertLessEqual(cost, seo.TAGS_BUDGET)

    def test_shorts_hashtag_when_vertical(self):
        d = seo.metadata(CLIP, 1, TWITCH_INFO, self.s, vertical=True)["description"]
        self.assertTrue(d.endswith("#Shorts"))

    def test_youtube_source(self):
        info = {"webpage_url": "https://www.youtube.com/watch?v=abc", "channel": "Chan",
                "channel_url": "https://www.youtube.com/channel/UC1", "upload_date": "20261020",
                "categories": ["Gaming"]}
        s = seo.streamer_profile(info, {})
        self.assertEqual(s["links"], {"YouTube": "https://www.youtube.com/channel/UC1"})
        self.assertIn("https://www.youtube.com/watch?v=abc&t=3700s", seo.metadata(CLIP, 1, info, s)["description"])


if __name__ == "__main__":
    unittest.main()
