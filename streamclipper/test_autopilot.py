"""Run with: python -m unittest test_autopilot"""
import datetime
import json
import os
import tempfile
import unittest

import autopilot
import cutter
import discover
import highlights

CFG = dict(autopilot.DEFAULTS, timezone="America/New_York", slots=["12:00", "20:00"], daily_upload_limit=3)
NY = autopilot.ZoneInfo("America/New_York")
NOW = datetime.datetime(2026, 10, 26, 8, 0, tzinfo=NY)  # Monday 8am


def fill(channels):
    queue = []
    for ch in channels:
        queue.append({"channel": ch, "status": "queued", "post_at": autopilot.next_slot(queue, ch, NOW, CFG)})
    return [datetime.datetime.fromisoformat(q["post_at"]) for q in queue]


class Schedule(unittest.TestCase):
    def test_one_channel_fills_slots_in_order(self):
        times = fill(["a"] * 4)
        self.assertEqual([(t.day, t.hour) for t in times], [(26, 12), (26, 20), (27, 12), (27, 20)])

    def test_channels_share_slots_but_respect_daily_limit(self):
        times = fill(["a", "b", "c", "a"])
        self.assertEqual([(t.day, t.hour) for t in times], [(26, 12), (26, 12), (26, 12), (27, 12)])
        per_day = {}
        for t in fill(["a", "b", "c"] * 5):
            per_day[t.date()] = per_day.get(t.date(), 0) + 1
        self.assertTrue(all(n <= 3 for n in per_day.values()))

    def test_skips_slots_too_soon_to_upload(self):
        late = datetime.datetime(2026, 10, 26, 10, 30, tzinfo=NY)
        t = datetime.datetime.fromisoformat(autopilot.next_slot([], "a", late, CFG))
        self.assertEqual((t.day, t.hour), (26, 20))

    def test_only_permitted_streamers_with_a_channel(self):
        reg = {"yes": {"permission": "dm 10/20", "channel": "c"}, "no": {"channel": "c"},
               "nochan": {"permission": "dm"}}
        self.assertEqual([k for k, _ in autopilot.permitted(reg, CFG)], ["yes"])


class Sections(unittest.TestCase):
    PLAYLIST = "\n".join(["#EXTM3U", '#EXT-X-MAP:URI="init-0.mp4"'] +
                         [f"#EXTINF:10.000,\n{i}{'-muted' if i == 2 else ''}.mp4" for i in range(6)])

    def test_picks_covering_segments(self):
        init, segs, offset = cutter.hls_segments(self.PLAYLIST, 15, 32)
        self.assertEqual(init, "init-0.mp4")
        self.assertEqual(segs, ["1.mp4", "2-muted.mp4", "3.mp4"])
        self.assertEqual(offset, 5)

    def test_outside_stream(self):
        self.assertEqual(cutter.hls_segments(self.PLAYLIST, 100, 120)[1], [])


class Discover(unittest.TestCase):
    def test_counts_other_clip_channels_only(self):
        entries = [{"title": "Shroud insane ace", "channel": "shroud"},
                   {"title": "SHROUD best clips", "channel": "Shroud Clips Daily"},
                   {"title": "shroud moments", "channel": "FPS Highlights"},
                   {"title": "shroud moments 2", "channel": "FPS Highlights"},
                   {"title": "unrelated", "channel": "Other"}]
        self.assertEqual(discover.count_competitors("Shroud", entries), (2, True))

    def test_score_prefers_low_competition(self):
        self.assertGreater(discover.score(300, 80, True, 0), discover.score(3000, 80, True, 6))


class TwitchDownloaderChat(unittest.TestCase):
    def test_reads_comments_format(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "chat.json")
            with open(p, "w") as f:
                json.dump({"streamer": {}, "comments": [{"content_offset_seconds": 1.2},
                                                         {"content_offset_seconds": 1.8}]}, f)
            self.assertEqual(list(highlights.chat_rate(p, 3)), [0, 2, 0])


if __name__ == "__main__":
    unittest.main()
