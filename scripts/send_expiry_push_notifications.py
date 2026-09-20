# -*- coding: utf-8 -*-
"""곧 상하는 재료가 있으면 구독자에게 **진짜 웹 푸시**를 보낸다 (매일 배치).

왜 필요한가:
    `ExpiryAlert.tsx`의 예전 "알림 받기"는 브라우저 `Notification` API 였다.
    그건 그 순간 앱이 열려 있어야만 뜨는 로컬 알림이라 "앱을 꺼 둬도, 며칠 안
    들어와도 온다"가 안 됐고, 식구 그룹의 다른 사람에게 전달할 방법도 없었다
    (실사용 지적, 2026-09-12). 이 스크립트가 서버 쪽 절반을 채운다 — 누가
    구독했는지 보고, 그 사람 냉장고에 곧 상하는 게 있으면 쏜다.

로그인한 사람만 대상이다:
    비회원 냉장고는 브라우저 localStorage 에만 있어 서버가 볼 방법이 없다.
    `frontend/src/utils/push.ts`도 로그인 안 했으면 구독 자체를 막는다.

유통기한 계산은 프론트(`shelfLife.ts`/`expiry.ts`)와 **반드시 같은 기준**이어야
한다. 안 그러면 "곧 상해요" 화면과 알림이 서로 다른 재료를 말하게 된다.
그래서 우선순위도 그대로 옮겼다:
    1) 재료에 직접 적힌 유통기한(`expiry_date`)
    2) 없으면 구매일 + 보관 일수 추정 — 보관 일수는
       `scripts/fill_shelf_life.py`가 이미 쓰는 것과 같은 순서
       (이름 예외 → 사전 그 재료 자신의 칸 → 세분류 → 소분류 → 중분류)
    기준일: 남은 5일 이내(SOON_DAYS) ~ 지난 지 14일 이내(STALE_AFTER_DAYS).
    그보다 오래 지난 건 "이미 버렸을 가능성이 높다"고 보고 알리지 않는다
    (`expiry.ts`의 같은 주석 참고).

식구 그룹:
    같은 냉장고(`storage_user_id`)를 보는 사람이 여럿이면, 그 계산은 한 번만
    하고 구독자 각자에게 나눠 보낸다 — 누가 몇 명이든 냉장고 조회는 한 번뿐.

쓰는 법:
    python -u scripts/send_expiry_push_notifications.py            # 미리보기(발송 없이 대상만)
    python -u scripts/send_expiry_push_notifications.py --write    # 실제 발송

필요한 것: `pip install pywebpush` (이 컴퓨터에만 있으면 된다 — 발송은 여기서
하고, Railway 쪽 백엔드는 구독 저장 API 만 있으면 된다).

네이티브 앱(안드로이드/iOS) 푸시:
    앱은 웹 푸시 대신 FCM 토큰을 `push_device_tokens` 테이블에 등록한다
    (`frontend/src/utils/push.ts`). 여기서는 FCM HTTP v1 API 로 보낸다 — 인증은
    Firebase 서비스 계정 키(JSON) 파일로 한다:
        기본 위치 backend/firebase-service-account.json (gitignore 됨)
        다른 곳에 두면 환경변수 FIREBASE_SERVICE_ACCOUNT 에 경로를 넣는다.
    키 파일이 없으면 네이티브 발송만 건너뛰고 웹 푸시는 그대로 보낸다.
    (google-auth 는 requirements 의 google-api-python-client 가 이미 끌고 온다.)
"""

import argparse
import csv
import io
import json
import os
import sys
from datetime import date, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for p in (ROOT, os.path.join(ROOT, "scripts"), os.path.join(ROOT, "ingredient_management")):
    if p not in sys.path:
        sys.path.insert(0, p)

from ingredient_management.llm_ingredient_extraction import (  # noqa: E402
    _load_env_files, _resolve_canonical, load_alias_to_canonical,
)
from ingredient_management.update_used_ingredients_batch import _connect_db  # noqa: E402
from fill_shelf_life import load_bands  # noqa: E402  (BY_DETAIL, BY_SUB, BY_MID, BY_NAME)

DICT_CSV = os.path.join(ROOT, "frontend", "public", "ingredient_profile_dict_with_substitutes.csv")

# frontend/src/utils/expiry.ts 와 반드시 같은 값이어야 한다.
SOON_DAYS = 5
STALE_AFTER_DAYS = 14

STORAGE_COLS = {"frozen": "보관냉동", "fridge": "보관냉장", "room": "보관실온"}

PUSH_TITLE = "곧 상하는 재료가 있어요"
PUSH_URL = "/my-fridge"

# 안드로이드 알림 채널·아이콘 — frontend `EXPIRY_CHANNEL_ID`(utils/push.ts)와
# AndroidManifest 의 기본값, res/drawable-*/ic_stat_cookmatch.png 와 같은 이름이어야 한다.
FCM_CHANNEL_ID = "expiry"
FCM_ICON = "ic_stat_cookmatch"
FCM_COLOR = "#E0A800"

DEFAULT_SERVICE_ACCOUNT = os.path.join(ROOT, "backend", "firebase-service-account.json")


def load_fcm_session():
    """(AuthorizedSession, project_id) — 서비스 계정 키가 없으면 (None, None)."""
    path = os.getenv("FIREBASE_SERVICE_ACCOUNT") or DEFAULT_SERVICE_ACCOUNT
    if not os.path.exists(path):
        return None, None
    from google.oauth2 import service_account  # noqa: E402
    from google.auth.transport.requests import AuthorizedSession  # noqa: E402

    creds = service_account.Credentials.from_service_account_file(
        path, scopes=["https://www.googleapis.com/auth/firebase.messaging"]
    )
    with io.open(path, encoding="utf-8") as f:
        project_id = json.load(f)["project_id"]
    return AuthorizedSession(creds), project_id


def send_fcm(session, project_id, token, body):
    """FCM HTTP v1 로 한 기기에 보낸다. 반환: 'sent' | 'gone' | 'failed:<사유>'.

    'gone' 은 앱 삭제·재설치 등으로 토큰이 더는 유효하지 않다는 뜻(UNREGISTERED) —
    웹 푸시의 404/410 과 같다. 호출한 쪽이 테이블에서 지운다.
    """
    resp = session.post(
        f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send",
        json={
            "message": {
                "token": token,
                "notification": {"title": PUSH_TITLE, "body": body},
                # 알림을 눌렀을 때 앱이 이동할 화면 — NativePushBridge 가 읽는다
                "data": {"url": PUSH_URL},
                "android": {
                    "notification": {
                        "channel_id": FCM_CHANNEL_ID,
                        "icon": FCM_ICON,
                        "color": FCM_COLOR,
                    }
                },
            }
        },
        timeout=20,
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
    return f"failed:{resp.status_code} {err.get('status') or ''} {err.get('message') or resp.text[:200]}"


# ── iOS(APNs) 직접 발송 ────────────────────────────────────────────────
# 아이폰 앱은 Firebase iOS SDK 없이 Capacitor 푸시 플러그인만 써서, 등록되는 값이 FCM 토큰이
# 아니라 **APNs 기기 토큰**(16진 문자열)이다. FCM 으로는 못 보내므로 Apple 서버(APNs)로 직접 보낸다.
# 필요한 것(전부 비밀이라 git 에 없음): Apple Developer → Keys 에서 만든 APNs 인증 키 `.p8` 파일,
# 그 Key ID, 팀 ID. backend/.env 에 APNS_KEY_ID·APNS_TEAM_ID 를 적고 키 파일은
# backend/apns-auth-key.p8 에 둔다(다른 곳이면 APNS_KEY_PATH). 없으면 iOS 기기는 건너뛴다.
# 실행에는 `pip install "httpx[http2]"` 가 필요하다(APNs 는 HTTP/2 만 받는다).
DEFAULT_APNS_KEY = os.path.join(ROOT, "backend", "apns-auth-key.p8")
APNS_TOPIC = "com.cookmatch.app"  # 앱 번들 ID
APNS_HOSTS = ("https://api.push.apple.com", "https://api.sandbox.push.apple.com")


def load_apns():
    """APNs 설정 dict — 하나라도 없으면 None(그러면 iOS 기기는 건너뛴다)."""
    key_id = os.getenv("APNS_KEY_ID")
    team_id = os.getenv("APNS_TEAM_ID")
    path = os.getenv("APNS_KEY_PATH") or DEFAULT_APNS_KEY
    if not (key_id and team_id and os.path.exists(path)):
        return None
    try:
        import httpx  # noqa: E402
    except ImportError:
        print("  (iOS 알림 건너뜀: pip install \"httpx[http2]\" 가 필요합니다)", flush=True)
        return None
    with io.open(path, encoding="utf-8") as f:
        key = f.read()
    return {"key_id": key_id, "team_id": team_id, "key": key, "client": httpx.Client(http2=True, timeout=20)}


_apns_jwt_cache = {"token": None, "at": 0}


def _apns_bearer(cfg, now=None):
    """APNs 인증 토큰(JWT, ES256). Apple 은 20분~1시간마다 새로 만들라고 해서 40분 캐시한다."""
    import time
    import jwt as pyjwt  # PyJWT + cryptography

    now = now if now is not None else time.time()
    if _apns_jwt_cache["token"] and now - _apns_jwt_cache["at"] < 40 * 60:
        return _apns_jwt_cache["token"]
    token = pyjwt.encode(
        {"iss": cfg["team_id"], "iat": int(now)}, cfg["key"], algorithm="ES256",
        headers={"kid": cfg["key_id"]},
    )
    _apns_jwt_cache.update(token=token, at=now)
    return token


def send_apns(cfg, token, body):
    """APNs 로 한 기기에 보낸다. 반환: 'sent' | 'gone' | 'failed:<사유>' (send_fcm 과 같은 규칙).

    TestFlight·App Store 빌드의 토큰은 운영(production) 서버 것이고, Xcode 로 직접 설치한 개발 빌드의
    토큰은 샌드박스 서버 것이다. 운영에서 BadDeviceToken 이 나오면 샌드박스로 한 번 더 시도한다.
    """
    payload = {
        "aps": {"alert": {"title": PUSH_TITLE, "body": body}, "sound": "default"},
        # 알림을 눌렀을 때 앱이 이동할 화면 — NativePushBridge 가 `data.url` 로 읽는다
        "url": PUSH_URL,
    }
    headers = {
        "authorization": f"bearer {_apns_bearer(cfg)}",
        "apns-topic": APNS_TOPIC,
        "apns-push-type": "alert",
        "apns-priority": "10",
    }
    reason = ""
    for host in APNS_HOSTS:
        resp = cfg["client"].post(f"{host}/3/device/{token}", headers=headers, json=payload)
        if resp.status_code == 200:
            return "sent"
        try:
            reason = resp.json().get("reason", "")
        except ValueError:
            reason = ""
        if resp.status_code == 400 and reason == "BadDeviceToken" and host == APNS_HOSTS[0]:
            continue  # 샌드박스 토큰일 수 있다
        break
    if reason in ("BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic") or resp.status_code == 410:
        return "gone"
    return f"failed:{resp.status_code} {reason}"


def load_dict_rows():
    """대표어 -> 그 행 전체(분류·자기 보관일수 포함)."""
    rows = {}
    with io.open(DICT_CSV, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            kw = (r.get("keyword") or "").strip()
            if kw:
                rows[kw] = r
    return rows


def lookup_days(name, storage, dict_rows, by_detail, by_sub, by_mid, by_name):
    """`shelfLife.ts`의 `lookupShelfLifeDays()`와 같은 순서."""
    # 1) 이름 예외
    band = by_name.get(name)
    if band and band.get(storage) is not None:
        return band[storage]
    row = dict_rows.get(name)
    if not row:
        return None
    # 2) 사전에 그 재료 자신의 값이 있으면 분류보다 먼저
    own = (row.get(STORAGE_COLS[storage]) or "").strip()
    if own and own != "-":
        try:
            return int(own)
        except ValueError:
            pass
    # 3) 분류(세분류 -> 소분류 -> 중분류)
    for tbl, key in ((by_detail, "세분류"), (by_sub, "소분류"), (by_mid, "중분류")):
        k = (row.get(key) or "").strip()
        band = tbl.get(k)
        if band and band.get(storage) is not None:
            return band[storage]
    return None


def compute_expiring_soon(rows, alias_to_canonical, dict_rows, bands):
    """user_ingredients 행들에서 "곧 상하는 것"만 골라 남은 날 순으로."""
    by_detail, by_sub, by_mid, by_name = bands
    today = date.today()
    out = []
    for r in rows:
        raw_name = (r.get("name") or "").strip()
        if not raw_name:
            continue
        name = _resolve_canonical(raw_name, alias_to_canonical) or raw_name
        storage = r.get("storage_box") or "fridge"

        target, estimated = None, False
        if r.get("expiry_date"):
            target = r["expiry_date"]
        elif r.get("purchase_date"):
            days = lookup_days(name, storage, dict_rows, by_detail, by_sub, by_mid, by_name)
            if days is not None:
                target = r["purchase_date"] + timedelta(days=days)
                estimated = True
        if target is None:
            continue

        delta = (target - today).days
        if delta > SOON_DAYS or delta < -STALE_AFTER_DAYS:
            continue
        out.append({"name": name, "days": delta, "estimated": estimated})

    out.sort(key=lambda x: x["days"])
    return out


def days_label(days, estimated):
    about = "약 " if estimated else ""
    if days < 0:
        return f"{-days}일 지났어요"
    if days == 0:
        return f"{about}오늘까지"
    return f"{about}{days}일 남음"


def build_body(items):
    urgent = [f"{i['name']}({days_label(i['days'], i['estimated'])})" for i in items[:3]]
    more = f" 외 {len(items) - 3}개" if len(items) > 3 else ""
    return ", ".join(urgent) + more


def resolve_storage_user_id(cursor, user_id):
    """식구 그룹에 속해 있으면 그룹의 storage_user_id, 아니면 자기 자신.
    (backend/app.py의 `resolve_ingredient_storage_user_id`와 같은 로직 — 이
    스크립트는 Flask 앱을 통째로 import하면 무거워지므로 직접 짧게 둔다.)"""
    cursor.execute(
        """SELECT h.storage_user_id FROM households h
           INNER JOIN users u ON u.household_id = h.id
           WHERE u.id = %s""",
        (user_id,),
    )
    row = cursor.fetchone()
    return row["storage_user_id"] if row else user_id


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="실제로 발송한다")
    args = ap.parse_args()

    _load_env_files()

    vapid_private = os.getenv("VAPID_PRIVATE_KEY")
    vapid_subject = os.getenv("VAPID_SUBJECT") or "mailto:admin@cookmatch.app"
    if args.write and not vapid_private:
        raise SystemExit("VAPID_PRIVATE_KEY 가 없습니다 (backend/.env 확인)")

    alias_to_canonical = load_alias_to_canonical()
    dict_rows = load_dict_rows()
    bands = load_bands()

    conn = _connect_db(read_timeout_sec=60)
    cursor = conn.cursor()

    # 웹 구독(push_subscriptions)과 네이티브 앱 토큰(push_device_tokens) — 백엔드가
    # 첫 등록 때 만드는 테이블이라, 아직 아무도 안 켰으면 없을 수 있다.
    tables = {}
    for t in ("push_subscriptions", "push_device_tokens"):
        cursor.execute("SHOW TABLES LIKE %s", (t,))
        tables[t] = cursor.fetchone() is not None
    if not any(tables.values()):
        print("구독 테이블이 없습니다 — 구독자가 아직 없다는 뜻일 수 있습니다.")
        conn.close()
        return 0

    user_ids = set()
    for t, exists in tables.items():
        if exists:
            cursor.execute(f"SELECT DISTINCT user_id FROM {t}")
            user_ids.update(r["user_id"] for r in cursor.fetchall())
    user_ids = sorted(user_ids)
    print(f"구독자 {len(user_ids)}명", flush=True)

    webpush = WebPushException = None
    if args.write and tables["push_subscriptions"]:
        from pywebpush import webpush, WebPushException  # noqa: E402

    apns_cfg = load_apns() if args.write else None
    fcm_session, fcm_project = (None, None)
    if tables["push_device_tokens"]:
        fcm_session, fcm_project = load_fcm_session()
        if not fcm_session:
            print(
                "Firebase 서비스 계정 키가 없어 네이티브 앱 발송은 건너뜁니다 "
                f"({DEFAULT_SERVICE_ACCOUNT} 또는 FIREBASE_SERVICE_ACCOUNT).",
                flush=True,
            )

    soon_cache = {}
    notified, sent, cleaned, failed = 0, 0, 0, 0

    for user_id in user_ids:
        storage_id = resolve_storage_user_id(cursor, user_id)
        if storage_id not in soon_cache:
            cursor.execute(
                "SELECT name, storage_box, expiry_date, purchase_date "
                "FROM user_ingredients WHERE user_id = %s",
                (storage_id,),
            )
            rows = cursor.fetchall()
            soon_cache[storage_id] = compute_expiring_soon(rows, alias_to_canonical, dict_rows, bands)

        soon = soon_cache[storage_id]
        if not soon:
            continue
        notified += 1
        body = build_body(soon)
        print(f"  user={user_id} storage={storage_id}: {body}", flush=True)

        subs = []
        if tables["push_subscriptions"]:
            cursor.execute(
                "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = %s",
                (user_id,),
            )
            subs = cursor.fetchall()

        # 네이티브 앱 기기(FCM)
        if tables["push_device_tokens"]:
            cursor.execute(
                "SELECT id, token, platform FROM push_device_tokens WHERE user_id = %s",
                (user_id,),
            )
            for dev in cursor.fetchall():
                if not args.write:
                    continue
                if dev["platform"] == "ios":
                    if not apns_cfg:
                        continue  # APNs 키가 없으면 iOS 기기는 건너뛴다
                    result = send_apns(apns_cfg, dev["token"], body)
                elif fcm_session:
                    result = send_fcm(fcm_session, fcm_project, dev["token"], body)
                else:
                    continue
                if result == "sent":
                    sent += 1
                elif result == "gone":
                    cursor.execute("DELETE FROM push_device_tokens WHERE id = %s", (dev["id"],))
                    cleaned += 1
                else:
                    failed += 1
                    print(f"    앱 발송 실패({dev['platform']}): {result}", flush=True)

        for sub in subs:
            if not args.write:
                continue
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub["endpoint"],
                        "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
                    },
                    data=json.dumps({
                        "title": PUSH_TITLE,
                        "body": body,
                        "url": PUSH_URL,
                    }),
                    vapid_private_key=vapid_private,
                    vapid_claims={"sub": vapid_subject},
                )
                sent += 1
            except WebPushException as e:  # noqa: BLE001
                status = e.response.status_code if e.response is not None else None
                if status in (404, 410):
                    # 브라우저가 구독을 스스로 버렸다(재설치·장기 미접속 등) — 우리도 지운다.
                    cursor.execute("DELETE FROM push_subscriptions WHERE id = %s", (sub["id"],))
                    cleaned += 1
                else:
                    failed += 1
                    print(f"    발송 실패({status}): {e}", flush=True)

    if args.write:
        conn.commit()
    conn.close()

    print(
        f"\n완료. 알릴 사람 {notified}명, 발송 {sent}건, 만료 구독 정리 {cleaned}건, 실패 {failed}건",
        flush=True,
    )
    if not args.write:
        print("미리보기입니다. --write 를 붙이면 실제로 발송합니다.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
