import unittest
from check_vocabulary_correction_pairs import correction_pair_errors


class CorrectionPairTests(unittest.TestCase):
    def test_rejects_korean_only_sense_patch(self):
        self.assertEqual(len(correction_pair_errors({"press": {"meaningsBySenseId": {"sense": {"meaningKo": "긴급한 상황"}}}})), 1)

    def test_accepts_explicit_bilingual_review(self):
        self.assertEqual(correction_pair_errors({"press": {"meaningsBySenseId": {"sense": {"meaningKo": "긴급한 상황", "meaningEn": "an urgent situation"}}}}), [])

    def test_accepts_synonym_only_patch_but_not_blank_english(self):
        self.assertEqual(correction_pair_errors({"word": {"meaningsBySenseId": {"sense": {"synonyms": []}}}}), [])
        self.assertEqual(len(correction_pair_errors({"word": {"meaningsBySenseId": {"sense": {"meaningKo": "뜻", "meaningEn": " "}}}})), 1)


if __name__ == "__main__":
    unittest.main()
