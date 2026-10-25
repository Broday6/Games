"""Run with: python -m unittest test_highlights"""
import os
import subprocess
import tempfile
import unittest

import numpy as np

import highlights


class PickClips(unittest.TestCase):
    def test_strongest_peaks_win_and_respect_gap(self):
        score = np.zeros(300)
        score[50], score[60], score[200] = 5, 4, 3
        clips = highlights.pick_clips(score, max_clips=5, pre=10, post=5, min_gap=30, threshold=1)
        self.assertEqual([c["peak"] for c in clips], [50, 200])
        self.assertEqual((clips[0]["start"], clips[0]["end"]), (40, 55))

    def test_windows_clamped_to_video(self):
        score = np.zeros(30)
        score[2] = 5
        c, = highlights.pick_clips(score, pre=20, post=60, threshold=1, duration=30)
        self.assertEqual((c["start"], c["end"]), (0, 30))

    def test_relative_score_ignores_constant_level(self):
        x = np.full(600, -20.0)
        x[300:305] = -2
        s = highlights.relative_score(x)
        self.assertEqual(int(np.argmax(s)), 300)
        self.assertEqual(s[:290].max(), 0)

    def test_chat_formats(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "chat.txt")
            with open(p, "w") as f:
                f.write("1.5\n1.9\n3\n")
            self.assertEqual(list(highlights.chat_rate(p, 5)), [0, 2, 0, 1, 0])
            p = os.path.join(d, "chat.json")
            with open(p, "w") as f:
                f.write('[{"time_in_seconds": 4.2}, {"message": "no time"}]')
            self.assertEqual(list(highlights.chat_rate(p, 5)), [0, 0, 0, 0, 1])


class EndToEnd(unittest.TestCase):
    def test_finds_loud_busy_moment(self):
        """A calm 3-minute video with a loud, flashing burst at 100-106 s."""
        with tempfile.TemporaryDirectory() as d:
            vod = os.path.join(d, "vod.mp4")
            burst = "between(t,100,106)"  # geq spells time as T, volume as t
            subprocess.run([
                "ffmpeg", "-v", "error", "-y",
                "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=30:duration=180",
                "-f", "lavfi", "-i", "anoisesrc=r=44100:a=0.02:d=180",
                "-filter_complex",
                f"[0:v]format=yuv420p,geq=lum='if({burst.replace("t,", "T,")},random(1)*255,lum(X,Y))':cb=128:cr=128[v];"
                f"[1:a]volume='if({burst},25,1)':eval=frame[a]",
                "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", vod,
            ], check=True)
            clips, _ = highlights.find_highlights(vod, max_clips=3)
            self.assertTrue(clips)
            self.assertTrue(98 <= clips[0]["peak"] <= 107, clips)
            self.assertTrue(clips[0]["start"] <= 100 and clips[0]["end"] >= 106, clips)


if __name__ == "__main__":
    unittest.main()
