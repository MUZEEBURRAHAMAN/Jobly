import asyncio
import unittest
from backend.app.matching import detect_role, detect_seniority, detect_work_mode, matches_preferences
from backend.app.ingestion.base import calculate_content_hash, clean_text

class TestHiringRadar(unittest.TestCase):
    def test_role_detection(self):
        # Product Design
        self.assertEqual(detect_role("Product Designer"), "product_design")
        self.assertEqual(detect_role("Senior Product Designer - Growth"), "product_design")
        self.assertEqual(detect_role("Lead UX Designer"), "product_design")
        self.assertEqual(detect_role("Interaction Designer"), "product_design")
        # Exclusions
        self.assertNotEqual(detect_role("Graphic Designer"), "product_design")
        self.assertNotEqual(detect_role("Interior Designer"), "product_design")

        # Frontend
        self.assertEqual(detect_role("Frontend Engineer"), "frontend_engineering")
        self.assertEqual(detect_role("Senior Front-End Developer"), "frontend_engineering")
        self.assertEqual(detect_role("React Developer"), "frontend_engineering")
        # Frontend Exclusions
        self.assertNotEqual(detect_role("Backend Engineer"), "frontend_engineering")

        # Product Management
        self.assertEqual(detect_role("Product Manager, Core Experience"), "product_management")
        self.assertEqual(detect_role("Senior Product Manager"), "product_management")
        # PM Exclusions
        self.assertNotEqual(detect_role("Project Manager"), "product_management")
        self.assertNotEqual(detect_role("Program Manager"), "product_management")

        # AI / ML
        self.assertEqual(detect_role("Machine Learning Engineer"), "ai_ml")
        self.assertEqual(detect_role("Research Scientist, Post-Training"), "ai_ml")

    def test_seniority_detection(self):
        self.assertEqual(detect_seniority("Senior Product Designer"), "senior")
        self.assertEqual(detect_seniority("Sr. Frontend Engineer"), "senior")
        self.assertEqual(detect_seniority("Staff Software Engineer"), "lead")
        self.assertEqual(detect_seniority("Principal Designer"), "lead")
        self.assertEqual(detect_seniority("Junior UX Designer"), "junior")
        self.assertEqual(detect_seniority("Software Engineering Intern"), "intern")
        self.assertEqual(detect_seniority("Product Designer"), "mid")

    def test_work_mode_detection(self):
        self.assertEqual(detect_work_mode("Remote - US", "Product Designer"), "remote")
        self.assertEqual(detect_work_mode("Worldwide (Distributed)", "Frontend Engineer"), "remote")
        self.assertEqual(detect_work_mode("Hybrid - New York", "Product Designer"), "hybrid")
        self.assertEqual(detect_work_mode("San Francisco, CA", "Staff Designer"), "on-site")

    def test_matching_rules(self):
        job = {
            "title": "Senior Product Designer",
            "normalized_role": "product_design",
            "seniority": "senior",
            "work_mode": "remote",
            "location": "Remote",
        }
        prefs = {
            "roles": ["product_design", "frontend_engineering"],
            "seniorities": ["senior", "lead"],
            "remote_only": True,
            "custom_keywords": "",
            "excluded_keywords": "",
        }
        self.assertTrue(matches_preferences(job, prefs))

        # Test remote only restriction
        job_onsite = dict(job, work_mode="on-site", location="San Francisco")
        self.assertFalse(matches_preferences(job_onsite, prefs))

        # Test excluded keyword
        prefs_with_exc = dict(prefs, excluded_keywords="contract, manager")
        job_manager = dict(job, title="Product Design Manager")
        self.assertFalse(matches_preferences(job_manager, prefs_with_exc))

    def test_content_hashing(self):
        h1 = calculate_content_hash("OpenAI", "Product Designer", "San Francisco", "https://example.com/job1")
        h2 = calculate_content_hash("OpenAI", "Product Designer", "San Francisco", "https://example.com/job1")
        h3 = calculate_content_hash("OpenAI", "Staff Designer", "San Francisco", "https://example.com/job2")
        self.assertEqual(h1, h2)
        self.assertNotEqual(h1, h3)

if __name__ == "__main__":
    unittest.main()
