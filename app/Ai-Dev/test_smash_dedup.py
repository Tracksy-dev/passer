"""
Edge-case tests for temporal_cluster_merge.

Run with:  python -m pytest app/Ai-Dev/test_smash_dedup.py -v
       or:  python app/Ai-Dev/test_smash_dedup.py
"""

import unittest
from ModelV6Improved import temporal_cluster_merge, _parse_ts_sec


def _ts(minutes: int, seconds: int, centiseconds: int) -> str:
    return f"{minutes}.{seconds:02d}.{centiseconds:02d}"


def _conf(ts_list, conf_list):
    return dict(zip(ts_list, conf_list))


class TestParseTsSec(unittest.TestCase):
    def test_basic(self):
        self.assertAlmostEqual(_parse_ts_sec("0.07.03"), 7.03)
        self.assertAlmostEqual(_parse_ts_sec("1.02.50"), 62.50)

    def test_malformed_returns_zero(self):
        self.assertEqual(_parse_ts_sec("bad"), 0.0)
        self.assertEqual(_parse_ts_sec("1.2"), 0.0)


class TestTemporalClusterMerge(unittest.TestCase):

    # ── empty / single-item ──────────────────────────────────────────────────

    def test_empty_list(self):
        merged, conf = temporal_cluster_merge([], {}, 1.0)
        self.assertEqual(merged, [])
        self.assertEqual(conf, {})

    def test_single_item_passes_through(self):
        ts = _ts(0, 5, 0)
        merged, conf = temporal_cluster_merge([ts], {ts: 0.8}, 1.0)
        self.assertEqual(merged, [ts])
        self.assertAlmostEqual(conf[ts], 0.8)

    # ── exact-duplicate timestamps ───────────────────────────────────────────

    def test_exact_duplicate_timestamps_collapse_to_one(self):
        ts = _ts(0, 5, 0)
        # Same timestamp string twice — second should be ignored
        merged, conf = temporal_cluster_merge([ts, ts], {ts: 0.7}, 1.0)
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0], ts)

    def test_exact_duplicate_keeps_higher_confidence(self):
        ts = _ts(0, 5, 0)
        # Duplicate raw strings with different conf entries won't happen in
        # practice (dict key collision), but the sort+merge handles it cleanly.
        merged, _ = temporal_cluster_merge([ts, ts], {ts: 0.4}, 1.0)
        self.assertEqual(len(merged), 1)

    # ── gap < window (0.99 s) → merge ────────────────────────────────────────

    def test_099s_gap_merged(self):
        t1 = _ts(0, 5, 0)    # 5.00 s
        t2 = _ts(0, 5, 99)   # 5.99 s  → gap = 0.99 s ≤ 1.0 → merged
        merged, conf = temporal_cluster_merge([t1, t2], {t1: 0.5, t2: 0.9}, 1.0)
        self.assertEqual(len(merged), 1)
        # Higher-confidence t2 should survive
        self.assertEqual(merged[0], t2)
        self.assertAlmostEqual(conf[t2], 0.9)

    def test_099s_gap_lower_confidence_first_keeps_higher(self):
        t1 = _ts(0, 5, 0)
        t2 = _ts(0, 5, 99)
        # t1 has higher confidence
        merged, conf = temporal_cluster_merge([t1, t2], {t1: 0.95, t2: 0.3}, 1.0)
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0], t1)
        self.assertAlmostEqual(conf[t1], 0.95)

    # ── gap == window (1.00 s) → defined as merged ───────────────────────────

    def test_100s_gap_merged(self):
        """
        Boundary: events exactly 1.0 s apart are merged (gap <= windowSec).
        This matches the API-side DEDUP_WINDOW_SEC behaviour.
        """
        t1 = _ts(0, 5, 0)    # 5.00 s
        t2 = _ts(0, 6, 0)    # 6.00 s  → gap = 1.00 s ≤ 1.0 → merged
        merged, _ = temporal_cluster_merge([t1, t2], {t1: 0.6, t2: 0.8}, 1.0)
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0], t2)  # higher confidence wins

    # ── gap > window (1.01 s) → separate ─────────────────────────────────────

    def test_101s_gap_kept_separate(self):
        t1 = _ts(0, 5, 0)    # 5.00 s
        t2 = _ts(0, 6, 1)    # 6.01 s  → gap = 1.01 s > 1.0 → separate
        merged, _ = temporal_cluster_merge([t1, t2], {t1: 0.6, t2: 0.7}, 1.0)
        self.assertEqual(len(merged), 2)

    # ── mixed-confidence cluster ──────────────────────────────────────────────

    def test_mixed_confidence_cluster_highest_survives(self):
        """Three events within 1.0 s; the middle one has the highest confidence."""
        t1 = _ts(0, 10, 0)   # 10.00 s  conf=0.40
        t2 = _ts(0, 10, 50)  # 10.50 s  conf=0.90  ← should win
        t3 = _ts(0, 10, 80)  # 10.80 s  conf=0.55
        merged, conf = temporal_cluster_merge(
            [t1, t2, t3], {t1: 0.40, t2: 0.90, t3: 0.55}, 1.0
        )
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0], t2)
        self.assertAlmostEqual(conf[t2], 0.90)

    def test_mixed_confidence_last_event_highest(self):
        t1 = _ts(0, 10, 0)
        t2 = _ts(0, 10, 30)
        t3 = _ts(0, 10, 90)  # conf=0.99
        merged, conf = temporal_cluster_merge(
            [t1, t2, t3], {t1: 0.3, t2: 0.5, t3: 0.99}, 1.0
        )
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0], t3)

    # ── two separate rallies ──────────────────────────────────────────────────

    def test_two_separate_rallies_both_kept(self):
        t1 = _ts(0, 5, 0)    # 5.00 s
        t2 = _ts(0, 7, 0)    # 7.00 s  → gap = 2.0 s → separate
        merged, _ = temporal_cluster_merge([t1, t2], {t1: 0.7, t2: 0.8}, 1.0)
        self.assertEqual(len(merged), 2)
        self.assertIn(t1, merged)
        self.assertIn(t2, merged)

    # ── unsorted input ────────────────────────────────────────────────────────

    def test_unsorted_input_sorted_internally(self):
        t1 = _ts(0, 5, 0)
        t2 = _ts(0, 5, 50)
        # Provide in reverse order; function must sort before merging
        merged, _ = temporal_cluster_merge([t2, t1], {t1: 0.6, t2: 0.4}, 1.0)
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0], t1)  # t1 has higher conf

    # ── zero-confidence entries ───────────────────────────────────────────────

    def test_missing_confidence_defaults_to_zero(self):
        t1 = _ts(0, 5, 0)
        t2 = _ts(0, 5, 50)
        # No confidence map entries — both should be treated as 0 and merged
        merged, _ = temporal_cluster_merge([t1, t2], {}, 1.0)
        self.assertEqual(len(merged), 1)


if __name__ == "__main__":
    unittest.main()
