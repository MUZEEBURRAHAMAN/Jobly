import unittest

from backend.app.categories import CATEGORY_IDS, classify_category
from backend.app.matching import classify_role


class TestCategories(unittest.TestCase):
    def test_tech_role_wins(self):
        self.assertEqual(classify_category("Senior Product Designer", "product_design"), "product_design")

    def test_broad_families(self):
        cases = {
            "Backend Engineer, Payments": "backend",
            "Firmware Engineer": "engineering",
            "Senior Data Analyst": "data",
            "Account Executive, Mid-Market": "sales",
            "Customer Success Manager": "customer",
            "Technical Recruiter": "people",
            "Senior Accountant": "finance",
            "Corporate Counsel": "legal",
            "Supply Chain Planner": "operations",
            "Content Marketing Lead": "marketing",
            "Graphic Designer": "design",
            "Registered Nurse": "healthcare",
            "Barista": "other",
        }
        for title, want in cases.items():
            with self.subTest(title=title):
                self.assertEqual(classify_category(title, None), want)

    def test_every_design_level_and_specialty(self):
        from backend.app.matching import detect_seniority
        product = ["UX Design Intern", "Junior UI Designer", "Product Designer", "Senior Product Designer", "Staff Product Designer",
                   "Principal Product Designer", "Lead UX Designer", "Design Manager", "Head of Design", "Design Director",
                   "VP of Design", "Chief Design Officer", "UX Researcher", "UX Writer", "Content Designer", "Service Designer",
                   "DesignOps Program Manager", "Design Systems Designer", "Interaction Designer"]
        for title in product:
            with self.subTest(title=title):
                self.assertEqual(classify_category(title, classify_role(title)), "product_design")
        for title in ("Graphic Designer", "Motion Designer", "Illustrator", "3D Artist", "Art Director", "Game Designer"):
            with self.subTest(title=title):
                self.assertEqual(classify_category(title, classify_role(title)), "design")
        levels = {"UX Design Intern": "intern", "Junior UI Designer": "junior", "Product Designer": "mid",
                  "Senior Product Designer": "senior", "Principal Product Designer": "lead", "VP of Design": "lead",
                  "Chief Design Officer": "lead", "Graduate Software Engineer": "junior", "CTO": "lead"}
        for title, want in levels.items():
            with self.subTest(title=title):
                self.assertEqual(detect_seniority(title), want)
        # Construction and architecture "design managers" are not product design
        self.assertNotEqual(classify_role("Design Manager - Construction"), "product_design")

    def test_every_development_and_it_area(self):
        cases = {
            "Angular Developer": "frontend_engineering", "Vue.js Developer": "frontend_engineering",
            "Java Developer": "backend", ".NET Developer": "backend", "Golang Engineer": "backend",
            "Android Developer": "mobile", "React Native Developer": "mobile", "Flutter Developer": "mobile",
            "DevOps Engineer": "devops", "Site Reliability Engineer": "devops", "Cloud Architect": "devops",
            "SDET": "qa", "QA Engineer": "qa", "Penetration Tester": "security", "SOC Analyst": "security",
            "Network Engineer": "it", "IT Support Specialist": "it", "Database Administrator": "it",
            "Salesforce Developer": "enterprise", "SAP Consultant": "enterprise", "Data Engineer": "data",
        }
        for title, want in cases.items():
            with self.subTest(title=title):
                self.assertEqual(classify_category(title, classify_role(title)), want)

    def test_design_and_it_group_covers_the_tech_categories(self):
        from backend.app.categories import DESIGN_AND_IT
        self.assertTrue(set(DESIGN_AND_IT) <= set(CATEGORY_IDS))
        self.assertNotIn("sales", DESIGN_AND_IT)

    def test_ids_are_unique_and_end_with_other(self):
        self.assertEqual(len(CATEGORY_IDS), len(set(CATEGORY_IDS)))
        self.assertEqual(CATEGORY_IDS[-1], "other")


if __name__ == "__main__":
    unittest.main()
