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
import time

import jwt
import requests
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


# =====================
# 토큰 취소(계정 삭제 시) — App Store 심사 가이드라인 5.1.1(v)
# =====================
#
# Apple 로그인을 제공하는 앱은 사용자가 계정을 지울 때 Apple 에도 "이 앱과의 연결을 끊는다"고
# 알려야 한다(설정 > Apple 계정 > 로그인에 Apple 사용 목록에서 쿡매치가 사라지게).
# 그러려면 (1) 로그인 때 받은 authorization code(5분짜리 1회용)를 그 자리에서 refresh token 으로
# 바꿔 저장해 두고, (2) 탈퇴 때 그 token 으로 revoke 를 부른다. 두 호출 모두 **Sign in with Apple 용
# 키(.p8)** 로 서명한 client_secret 이 필요하다 — APNs 키와는 다른 키다. 환경변수:
#   APPLE_TEAM_ID              팀 ID
#   APPLE_SIGNIN_KEY_ID        Sign in with Apple 키의 Key ID
#   APPLE_SIGNIN_PRIVATE_KEY   그 .p8 파일 내용(줄바꿈은 \n 으로 써도 됨)
# 셋 중 하나라도 없으면 토큰 저장·취소는 건너뛴다(로그인·탈퇴 자체는 그대로 동작).

APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token'
APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke'


def _bundle_id():
    return os.getenv('APPLE_BUNDLE_ID', 'com.cookmatch.app')


def revocation_configured():
    return all(os.getenv(k) for k in ('APPLE_TEAM_ID', 'APPLE_SIGNIN_KEY_ID', 'APPLE_SIGNIN_PRIVATE_KEY'))


def _private_key_pem():
    """환경변수의 키를 PEM 으로 돌려준다.

    Railway 에 넣는 방식이 여러 가지라 셋 다 받는다: 여러 줄 그대로, 줄바꿈을 `\\n` 글자로 쓴 한 줄,
    그리고 `-----BEGIN/END-----` 줄 없이 본문만 넣은 경우(앞뒤 줄을 붙여 준다)."""
    raw = os.environ['APPLE_SIGNIN_PRIVATE_KEY'].strip().replace('\\n', '\n')
    if '-----BEGIN' not in raw:
        body = ''.join(raw.split())
        lines = [body[i:i + 64] for i in range(0, len(body), 64)]
        raw = '-----BEGIN PRIVATE KEY-----\n' + '\n'.join(lines) + '\n-----END PRIVATE KEY-----'
    return raw


def make_client_secret(now=None):
    """Apple REST API 에 낼 client_secret(ES256 JWT, 5분 유효)."""
    now = int(now if now is not None else time.time())
    return jwt.encode(
        {
            'iss': os.environ['APPLE_TEAM_ID'],
            'iat': now,
            'exp': now + 300,
            'aud': APPLE_ISSUER,
            'sub': _bundle_id(),
        },
        _private_key_pem(),
        algorithm='ES256',
        headers={'kid': os.environ['APPLE_SIGNIN_KEY_ID']},
    )


def exchange_authorization_code(code, *, post=None):
    """authorization code 를 refresh token 으로 바꾼다. 실패하면 AppleTokenError."""
    resp = (post or requests.post)(
        APPLE_TOKEN_URL,
        data={
            'client_id': _bundle_id(),
            'client_secret': make_client_secret(),
            'code': code,
            'grant_type': 'authorization_code',
        },
        timeout=10,
    )
    if resp.status_code != 200:
        raise AppleTokenError(f'token exchange failed: {resp.status_code}')
    refresh_token = resp.json().get('refresh_token')
    if not refresh_token:
        raise AppleTokenError('no refresh_token in response')
    return refresh_token


def revoke_refresh_token(refresh_token, *, post=None):
    """Apple 에 이 refresh token(=이 앱과의 로그인 연결)을 취소시킨다. 성공하면 True."""
    resp = (post or requests.post)(
        APPLE_REVOKE_URL,
        data={
            'client_id': _bundle_id(),
            'client_secret': make_client_secret(),
            'token': refresh_token,
            'token_type_hint': 'refresh_token',
        },
        timeout=10,
    )
    return resp.status_code == 200
