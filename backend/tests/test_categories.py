import unittest

from backend.app.categories import CATEGORY_IDS, classify_category


class TestCategories(unittest.TestCase):
    def test_tech_role_wins(self):
        self.assertEqual(classify_category("Senior Product Designer", "product_design"), "product_design")

    def test_broad_families(self):
        cases = {
            "Backend Engineer, Payments": "engineering",
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

    def test_ids_are_unique_and_end_with_other(self):
        self.assertEqual(len(CATEGORY_IDS), len(set(CATEGORY_IDS)))
        self.assertEqual(CATEGORY_IDS[-1], "other")


if __name__ == "__main__":
    unittest.main()
