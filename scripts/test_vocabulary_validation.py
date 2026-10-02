import unittest
from vocabulary_validation import ALLOWED_PARTS_OF_SPEECH, has_complete_study_example, has_informative_primary_gloss


class StudyExampleTests(unittest.TestCase):
    def test_rejects_tautological_primary_gloss(self):
        self.assertFalse(has_informative_primary_gloss({"word": "Pesticide", "meaningEn": "pesticide"}))
        self.assertFalse(has_informative_primary_gloss({"word": "include", "meaningEn": "to include."}))
        self.assertTrue(has_informative_primary_gloss({"word": "pesticide", "meaningEn": "a substance used to kill pests"}))

    def test_rejects_exam_cloze_fragments_and_templates(self):
        for example in ("A mod___ load can cause damage.", "In this vocabulary set, load means a burden."):
            self.assertFalse(has_complete_study_example({"example": example, "translation": "해석"}))

    def test_accepts_complete_examples_and_rejects_missing_translation(self):
        self.assertTrue(has_complete_study_example({"example": "The editor flagged the term as vulgar.", "translation": "편집자는 그 표현을 비속어로 표시했습니다."}))
        self.assertFalse(has_complete_study_example({"example": "The load increased."}))

    def test_function_words_can_keep_their_actual_grammatical_role(self):
        self.assertTrue({"preposition", "conjunction", "determiner"} <= ALLOWED_PARTS_OF_SPEECH)
        self.assertNotIn("unknown", ALLOWED_PARTS_OF_SPEECH)
