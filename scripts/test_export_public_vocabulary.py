"""Regression checks for checkpoint and terminal-batch publication gates."""

import unittest

from export_public_vocabulary import select_checkpoint


class CheckpointTests(unittest.TestCase):
    def test_partial_review_defaults_to_thousand_boundary(self):
        self.assertEqual(select_checkpoint(0, 23976, 29976), 23000)

    def test_explicit_thousand_checkpoint_is_preserved(self):
        self.assertEqual(select_checkpoint(24000, 24976, 29976), 24000)

    def test_whole_review_allows_exact_final_total(self):
        self.assertEqual(select_checkpoint(29976, 29976, 29976), 29976)
        self.assertEqual(select_checkpoint(0, 29976, 29976), 29976)

    def test_terminal_export_cannot_hide_unreviewed_entries(self):
        for accepted in (29000, 29975):
            with self.assertRaises(ValueError):
                select_checkpoint(29976, accepted, 29976)

    def test_nonboundary_subset_is_not_a_terminal_checkpoint(self):
        with self.assertRaises(ValueError):
            select_checkpoint(29975, 29976, 29976)

    def test_not_enough_accepted_entries(self):
        with self.assertRaises(ValueError):
            select_checkpoint(24000, 23000, 29976)

    def test_empty_corpus_is_not_complete(self):
        with self.assertRaises(ValueError):
            select_checkpoint(0, 0, 0)


if __name__ == "__main__":
    unittest.main()
