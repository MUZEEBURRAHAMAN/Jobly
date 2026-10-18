"""Role classification: titles decide, a job board's category is only a narrow fallback."""
import unittest

import aiosqlite

from backend.app.ingestion.runner import reclassify_roles
from backend.app.matching import classify_role, detect_role


class TestRoleRules(unittest.TestCase):
    def test_engineers_on_design_systems_are_not_designers(self):
        self.assertEqual(detect_role("Staff Software Engineer, Android Design System"), "fullstack_engineering")
        self.assertNotEqual(detect_role("Senior iOS Engineer, Design Systems"), "product_design")
        self.assertNotEqual(detect_role("Design Systems Developer"), "product_design")
        self.assertNotEqual(detect_role("Senior Mask Design Engineer – Hardware"), "product_design")

    def test_design_titles_still_match(self):
        for title in ["Product Designer", "Design Systems Designer", "Design Engineer", "UX Designer",
                      "Senior UI Designer", "Web Designer", "UX Researcher", "Staff Product Designer, Design Systems"]:
            self.assertEqual(detect_role(title), "product_design", title)

    def test_board_category_cannot_label_unrelated_jobs(self):
        # Seen in We Work Remotely's design and product feeds and Remotive's categories.
        self.assertIsNone(classify_role("Enterprise Account Director, West", "product_design"))
        self.assertIsNone(classify_role("Channel Account Manager", "product_design"))
        self.assertIsNone(classify_role("Remote Office Assistant", "product_design"))
        self.assertIsNone(classify_role("Global Controller", "product_management"))
        self.assertIsNone(classify_role("Legal Ops", "fullstack_engineering"))
        self.assertIsNone(classify_role("Graphic Designer", "product_design"))

    def test_title_beats_board_category(self):
        self.assertEqual(classify_role("Tech Lead Full-Stack Rails Engineer", "product_design"), "fullstack_engineering")
        self.assertEqual(classify_role("Senior AI Engineer", "product_design"), "ai_ml")
        self.assertEqual(classify_role("Senior Product Engineer", "product_management"), "fullstack_engineering")

    def test_fullstack_titles_stay_fullstack(self):
        self.assertEqual(detect_role("Senior React Full-stack Developer"), "fullstack_engineering")
        self.assertEqual(detect_role("Fullstack Web3 Engineer (Solidity / Rust / Typescript)"), "fullstack_engineering")
        self.assertEqual(detect_role("Senior Frontend Engineer (React, TypeScript)"), "frontend_engineering")

    def test_other_titles(self):
        self.assertEqual(detect_role("Product Owner"), "product_management")
        self.assertEqual(detect_role("Director, Applied AI"), "ai_ml")

    def test_engineering_category_fills_in_generic_engineering_titles(self):
        self.assertEqual(classify_role("Senior Ruby Developer", "fullstack_engineering"), "fullstack_engineering")
        self.assertEqual(classify_role("Site Reliability Engineer", "fullstack_engineering"), "fullstack_engineering")
        self.assertIsNone(classify_role("QA Engineer", "fullstack_engineering"))
        self.assertIsNone(classify_role("Senior Ruby Developer", None))


class TestReclassify(unittest.IsolatedAsyncioTestCase):
    async def test_fixes_stored_roles_and_is_stable(self):
        async with aiosqlite.connect(":memory:") as db:
            db.row_factory = aiosqlite.Row
            await db.execute("CREATE TABLE jobs (id INTEGER PRIMARY KEY, title TEXT, normalized_role TEXT, status TEXT)")
            await db.executemany("INSERT INTO jobs (title, normalized_role, status) VALUES (?, ?, ?)", [
                ("Enterprise Account Director", "product_design", "active"),
                ("Staff Software Engineer, Android Design System", "product_design", "active"),
                ("Product Designer", "product_design", "active"),
                ("Senior Ruby Developer", "fullstack_engineering", "active"),
                ("Enterprise Account Director", "product_design", "closed"),
            ])
            self.assertEqual(await reclassify_roles(db), 2)
            cur = await db.execute("SELECT title, normalized_role, status FROM jobs ORDER BY id")
            self.assertEqual([tuple(r) for r in await cur.fetchall()], [
                ("Enterprise Account Director", None, "active"),
                ("Staff Software Engineer, Android Design System", "fullstack_engineering", "active"),
                ("Product Designer", "product_design", "active"),
                ("Senior Ruby Developer", "fullstack_engineering", "active"),
                ("Enterprise Account Director", "product_design", "closed"),
            ])
            self.assertEqual(await reclassify_roles(db), 0)


if __name__ == "__main__":
    unittest.main()
