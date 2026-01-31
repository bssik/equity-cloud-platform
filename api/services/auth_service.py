import base64
import json
import os
from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass(frozen=True)
class UserContext:
    user_id: str
    user_details: Optional[str] = None
    identity_provider: Optional[str] = None


def get_user_context_from_headers(headers: Dict[str, str]) -> Optional[UserContext]:
    """Extract user identity from Azure Static Web Apps / EasyAuth headers.

    Expected header:
      - x-ms-client-principal: base64-encoded JSON with fields like userId/userDetails.

    Local-dev fallback:
      - x-ec-user: explicit user id for local testing.
    """

    # Local/dev override (handy when running without SWA auth emulator)
    explicit = headers.get("x-ec-user") or headers.get("X-EC-USER")
    if explicit:
        return UserContext(user_id=explicit.strip(), identity_provider="local")

    env_user = (os.environ.get("LOCAL_DEV_USER_ID") or "").strip()
    if env_user:
        return UserContext(user_id=env_user, identity_provider="local")

    principal_b64 = headers.get("x-ms-client-principal") or headers.get("X-MS-CLIENT-PRINCIPAL")
    if not principal_b64:
        return None

    try:
        # SWA uses standard base64; tolerate missing padding.
        missing_padding = len(principal_b64) % 4
        if missing_padding:
            principal_b64 += "=" * (4 - missing_padding)

        raw = base64.b64decode(principal_b64)
        principal: Dict[str, Any] = json.loads(raw.decode("utf-8"))

        user_id = (principal.get("userId") or "").strip()
        user_details = (principal.get("userDetails") or None)
        identity_provider = (principal.get("identityProvider") or None)

        if not user_id:
            # userDetails is usually an email/UPN; allow as fallback.
            if user_details:
                user_id = str(user_details).strip()

        if not user_id:
            return None

        return UserContext(user_id=user_id, user_details=user_details, identity_provider=identity_provider)

    except Exception:
        return None
