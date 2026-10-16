# -*- coding: utf-8 -*-
"""서버(Railway)에서 **바로** 푸시 알림을 보낸다 — 가족에게 레시피 보내기(2026-10-16)에서 처음 씀.

왜 따로 있나:
    유통기한 알림은 이 PC 의 매일 배치(`scripts/send_expiry_push_notifications.py`)가 보낸다.
    「가족에게 레시피 보내기」는 누르는 순간 가야 하므로 서버가 직접 보내야 한다.
    발송 방식은 그 배치와 같다 — 안드로이드는 FCM HTTP v1, 아이폰은 APNs 직접(앱이 Firebase iOS SDK
    없이 APNs 기기 토큰을 등록하므로), 웹은 웹 푸시(VAPID).

인증 정보(모두 비밀 — git 에 올리지 않는다). 환경변수에 **내용**을 넣거나, 로컬에서는 파일을 둔다:
    FCM   FIREBASE_SERVICE_ACCOUNT_JSON  서비스 계정 JSON 내용(또는 base64)
          없으면 FIREBASE_SERVICE_ACCOUNT(경로) → backend/firebase-service-account.json
    APNs  APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_P8(.p8 내용, 줄바꿈은 \\n 으로 적어도 됨)
          없으면 APNS_KEY_PATH(경로) → backend/apns-auth-key.p8
    웹    VAPID_PRIVATE_KEY (+ VAPID_SUBJECT), pywebpush 설치 시
하나가 없으면 그 플랫폼만 건너뛴다(결과에 'no_credentials' 로 남는다).
"""
import base64
import io
import json
import os
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
APNS_TOPIC = "com.cookmatch.app"
APNS_HOSTS = ("https://api.push.apple.com", "https://api.sandbox.push.apple.com")
FCM_ICON = "ic_stat_cookmatch"
FCM_COLOR = "#FFD600"

_lock = threading.Lock()
_fcm = {"loaded": False, "session": None, "project": None}
_apns = {"loaded": False, "cfg": None, "jwt": None, "at": 0}


def _maybe_b64(s):
    s = (s or "").strip()
    if not s:
        return ""
    if s.startswith("{") or s.startswith("-----"):
        return s
    try:
        return base64.b64decode(s).decode("utf-8")
    except Exception:
        return s


def _load_fcm():
    with _lock:
        if _fcm["loaded"]:
            return _fcm["session"], _fcm["project"]
        _fcm["loaded"] = True
        info = None
        raw = _maybe_b64(os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON"))
        if raw:
            info = json.loads(raw)
        else:
            path = os.getenv("FIREBASE_SERVICE_ACCOUNT") or os.path.join(HERE, "firebase-service-account.json")
            if os.path.exists(path):
                with io.open(path, encoding="utf-8") as f:
                    info = json.load(f)
        if not info:
            return None, None
        from google.oauth2 import service_account
        from google.auth.transport.requests import AuthorizedSession
        creds = service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/firebase.messaging"])
        _fcm["session"], _fcm["project"] = AuthorizedSession(creds), info["project_id"]
        return _fcm["session"], _fcm["project"]


def _load_apns():
    with _lock:
        if _apns["loaded"]:
            return _apns["cfg"]
        _apns["loaded"] = True
        key_id, team_id = os.getenv("APNS_KEY_ID"), os.getenv("APNS_TEAM_ID")
        key = _maybe_b64(os.getenv("APNS_KEY_P8")).replace("\\n", "\n")
        if not key:
            path = os.getenv("APNS_KEY_PATH") or os.path.join(HERE, "apns-auth-key.p8")
            if os.path.exists(path):
                with io.open(path, encoding="utf-8") as f:
                    key = f.read()
        if not (key_id and team_id and key):
            return None
        try:
            import httpx
            client = httpx.Client(http2=True, timeout=15)
        except Exception as e:  # h2 미설치 등
            print(f"[push_send] APNs 건너뜀: {e}")
            return None
        _apns["cfg"] = {"key_id": key_id, "team_id": team_id, "key": key, "client": client}
        return _apns["cfg"]


def _apns_bearer(cfg):
    import jwt as pyjwt
    now = time.time()
    if _apns["jwt"] and now - _apns["at"] < 40 * 60:
        return _apns["jwt"]
    tok = pyjwt.encode({"iss": cfg["team_id"], "iat": int(now)}, cfg["key"], algorithm="ES256",
                       headers={"kid": cfg["key_id"]})
    _apns["jwt"], _apns["at"] = tok, now
    return tok


def send_fcm(token, title, body, url, channel_id):
    session, project = _load_fcm()
    if not session:
        return "no_credentials"
    resp = session.post(
        f"https://fcm.googleapis.com/v1/projects/{project}/messages:send",
        json={"message": {
            "token": token,
            "notification": {"title": title, "body": body},
            "data": {"url": url},  # NativePushBridge 가 눌렀을 때 이동
            "android": {"priority": "high", "notification": {"channel_id": channel_id, "icon": FCM_ICON, "color": FCM_COLOR}},
        }},
        timeout=15,
    )
    if resp.ok:
        return "sent"
    try:
        err = resp.json().get("error", {})
    except ValueError:
        err = {}
    codes = {d.get("errorCode") for d in err.get("details", []) if isinstance(d, dict)}
    if resp.status_code == 404 or "UNREGISTERED" in codes:
        return "gone"
    return f"failed:{resp.status_code}"


def send_apns(token, title, body, url):
    cfg = _load_apns()
    if not cfg:
        return "no_credentials"
    payload = {"aps": {"alert": {"title": title, "body": body}, "sound": "default"}, "url": url}
    headers = {"authorization": f"bearer {_apns_bearer(cfg)}", "apns-topic": APNS_TOPIC,
               "apns-push-type": "alert", "apns-priority": "10"}
    reason, resp = "", None
    for host in APNS_HOSTS:
        resp = cfg["client"].post(f"{host}/3/device/{token}", headers=headers, json=payload)
        if resp.status_code == 200:
            return "sent"
        try:
            reason = resp.json().get("reason", "")
        except ValueError:
            reason = ""
        if resp.status_code == 400 and reason == "BadDeviceToken" and host == APNS_HOSTS[0]:
            continue  # 개발 빌드의 샌드박스 토큰일 수 있다
        break
    if reason in ("BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic") or (resp is not None and resp.status_code == 410):
        return "gone"
    return f"failed:{resp.status_code if resp is not None else '?'} {reason}"


def send_webpush(sub, title, body, url):
    private = os.getenv("VAPID_PRIVATE_KEY")
    if not private:
        return "no_credentials"
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        return "no_credentials"
    try:
        webpush(
            subscription_info={"endpoint": sub["endpoint"], "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}},
            data=json.dumps({"title": title, "body": body, "url": url, "tag": f"cookmatch-{abs(hash(url)) % 100000}"}, ensure_ascii=False),
            vapid_private_key=private,
            vapid_claims={"sub": os.getenv("VAPID_SUBJECT") or "mailto:admin@cookmatch.app"},
            ttl=86400,
        )
        return "sent"
    except WebPushException as e:
        code = getattr(getattr(e, "response", None), "status_code", None)
        return "gone" if code in (404, 410) else f"failed:{code}"


def send_to_users(cursor, user_ids, title, body, url, channel_id="family"):
    """여러 사용자의 모든 기기에 보낸다. 사라진 토큰은 지운다. 반환: {user_id: {'sent': n, 'results': [...]}}"""
    out = {uid: {"sent": 0, "results": []} for uid in user_ids}
    if not user_ids:
        return out
    marks = ",".join(["%s"] * len(user_ids))
    cursor.execute(f"SELECT user_id, token, platform FROM push_device_tokens WHERE user_id IN ({marks})", list(user_ids))
    for dev in cursor.fetchall():
        try:
            r = send_apns(dev["token"], title, body, url) if dev["platform"] == "ios" else send_fcm(dev["token"], title, body, url, channel_id)
        except Exception as e:
            r = f"failed:{type(e).__name__}"
        out[dev["user_id"]]["results"].append(f"{dev['platform']}:{r}")
        if r == "sent":
            out[dev["user_id"]]["sent"] += 1
        elif r == "gone":
            cursor.execute("DELETE FROM push_device_tokens WHERE token = %s", (dev["token"],))
    try:
        cursor.execute(f"SELECT user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id IN ({marks})", list(user_ids))
        subs = cursor.fetchall()
    except Exception:
        subs = []
    for sub in subs:
        try:
            r = send_webpush(sub, title, body, url)
        except Exception as e:
            r = f"failed:{type(e).__name__}"
        out[sub["user_id"]]["results"].append(f"web:{r}")
        if r == "sent":
            out[sub["user_id"]]["sent"] += 1
        elif r == "gone":
            cursor.execute("DELETE FROM push_subscriptions WHERE endpoint = %s", (sub["endpoint"],))
    return out
