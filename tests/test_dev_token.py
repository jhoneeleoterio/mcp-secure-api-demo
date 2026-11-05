import base64
import json
import unittest

from scripts.dev_token import create_token


class DevelopmentTokenTests(unittest.TestCase):
    def test_scope_claim_is_present_only_when_requested(self):
        key = bytes(range(32))

        def payload(scopes=()):
            token = create_token(key, "test-issuer", "test-audience", scopes=scopes)
            encoded = token.split(".")[1]
            return json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))

        self.assertNotIn("scope", payload())
        self.assertEqual("customers.read orders.read",
                         payload(("customers.read", "orders.read"))["scope"])


if __name__ == "__main__":
    unittest.main()
