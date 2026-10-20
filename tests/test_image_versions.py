import importlib.util
import unittest
from pathlib import Path


script = Path(__file__).resolve().parents[1] / "deploy" / "image_versions.py"
spec = importlib.util.spec_from_file_location("image_versions", script)
image_versions = importlib.util.module_from_spec(spec)
spec.loader.exec_module(image_versions)


class ImageVersionsTests(unittest.TestCase):
    def test_classifies_only_affected_images(self):
        self.assertEqual(image_versions.classify(["frontend/src/app/app.ts"]), (False, True))
        self.assertEqual(image_versions.classify(["src/AcmeCommerce.Api/Program.cs"]), (True, False))
        self.assertEqual(image_versions.classify(["deploy/compose.production.yml"]), (False, False))
        self.assertEqual(image_versions.classify([".dockerignore"]), (True, True))

    def test_resolves_last_relevant_main_commit_after_skipped_releases(self):
        baseline = image_versions.BASELINE_SHA
        web = "a" * 40
        backend = "b" * 40
        latest = "c" * 40
        commits = {
            latest: {"sha": latest, "files": [{"filename": "docs/deployment.md"}], "parents": [{"sha": backend}]},
            backend: {"sha": backend, "files": [{"filename": "src/AcmeCommerce.Mcp/Program.cs"}], "parents": [{"sha": web}]},
            web: {"sha": web, "files": [{"filename": "frontend/src/app/app.html"}], "parents": [{"sha": baseline}]},
        }
        self.assertEqual(image_versions.resolve(latest, commits.__getitem__), (backend, web))
        self.assertEqual(image_versions.resolve(web, commits.__getitem__), (baseline, web))
        self.assertEqual(image_versions.resolve(baseline, commits.__getitem__), (baseline, baseline))

    def test_rejects_incomplete_history(self):
        latest = "c" * 40
        invalid = {"sha": latest, "files": [], "parents": []}
        with self.assertRaises(ValueError):
            image_versions.resolve(latest, lambda _: invalid)


if __name__ == "__main__":
    unittest.main()
