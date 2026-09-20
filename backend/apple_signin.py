"""Sign in with Apple — iOS 앱이 넘긴 identity token 을 검증한다.

앱(iOS)이 Apple 로그인 창을 띄워 받은 identity token(JWT)을 서버에 내면, 서버가 Apple 의
공개키로 서명을 확인하고 이 앱을 위해 발급된 토큰인지(aud), Apple 이 발급한 것인지(iss),
로그인 시작 때 앱이 만든 nonce 와 같은지를 본다. 통과해야만 쿡매치 로그인 토큰을 준다.

nonce: 앱은 무작위 값(raw)을 만들고 그 SHA-256(hex)을 Apple 에 넘긴다. Apple 은 그 값을
토큰에 그대로 넣는다. 서버에는 raw 를 보내므로, 토큰만 가로챈 쪽은 raw 를 몰라 재사용할 수 없다.
"""

import hashlib
import hmac
import os

import jwt
from jwt import PyJWKClient

APPLE_ISSUER = 'https://appleid.apple.com'
APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys'


class AppleTokenError(Exception):
    """Apple 토큰이 유효하지 않다."""


_default_jwk_client = None


def _get_jwk_client():
    global _default_jwk_client
    if _default_jwk_client is None:
        _default_jwk_client = PyJWKClient(APPLE_JWKS_URL, cache_keys=True, lifespan=3600)
    return _default_jwk_client


def _as_bool(value):
    # Apple 은 email_verified / is_private_email 을 true 또는 "true" 로 준다
    return value is True or str(value).lower() == 'true'


def verify_identity_token(identity_token, raw_nonce, *, jwk_client=None, audience=None):
    """토큰을 검증하고 필요한 값만 돌려준다. 유효하지 않으면 AppleTokenError."""
    if not identity_token or not raw_nonce:
        raise AppleTokenError('identity token and nonce required')
    audience = audience or os.getenv('APPLE_BUNDLE_ID', 'com.cookmatch.app')

    try:
        signing_key = (jwk_client or _get_jwk_client()).get_signing_key_from_jwt(identity_token)
        claims = jwt.decode(
            identity_token,
            signing_key.key,
            algorithms=['RS256'],
            audience=audience,
            issuer=APPLE_ISSUER,
            options={'require': ['exp', 'iat', 'iss', 'aud', 'sub']},
        )
    except jwt.PyJWTError as e:
        raise AppleTokenError(str(e)) from e

    expected_nonce = hashlib.sha256(raw_nonce.encode('utf-8')).hexdigest()
    if not hmac.compare_digest(str(claims.get('nonce', '')), expected_nonce):
        raise AppleTokenError('nonce mismatch')

    return {
        'sub': claims['sub'],
        'email': claims.get('email') or '',
        'email_verified': _as_bool(claims.get('email_verified')),
    }
