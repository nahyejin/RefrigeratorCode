"""유튜브 영상 **자막**(자동 생성 포함)을 가져온다 — 영상 설명에 조리 순서가 없을 때 조리 순서를 만드는 재료로 쓴다(2026-11-06).

왜 필요한가: 유튜브 글의 63%(4,364건 중 2,746건)가 설명란에 조리 순서가 없어 요리 모드에 쓸 수 없었다.
말로만 알려 주는 영상은 자막에 순서가 들어 있다. 음성을 직접 분석하는 길(영상을 내려받아 음성 인식)은 유튜브 약관 위반 소지와
시간·비용 때문에 쓰지 않는다 — **자막이 없으면 실패로 본다.**

**천천히 보낸다.** 이 라이브러리는 유튜브 공식 API 가 아니라 자막 화면을 읽는 방식이라, 짧은 시간에 많이 보내면 유튜브가
이 PC 의 접속을 한동안 막는다(`IpBlocked` — 2026-11-06 시험에서 33건을 연달아 보냈다가 막혔다). 그래서 요청 사이에
`MIN_INTERVAL_SEC` 이상 쉬고, 막히면 `TranscriptBlocked` 를 던져 호출한 쪽이 **그 자리에서 멈추게** 한다(다음 실행에서 이어서 한다).
막힘을 우회하는 방법(주소 바꿔 가며 보내기 등)은 쓰지 않는다.
"""
import re
import threading
import time
from urllib.parse import parse_qs, urlparse

from youtube_transcript_api import YouTubeTranscriptApi
try:  # 1.x 는 최상위에서 가져온다
    from youtube_transcript_api import IpBlocked, NoTranscriptFound, RequestBlocked, TranscriptsDisabled, VideoUnavailable
except ImportError:  # pragma: no cover — 낡은 버전
    from youtube_transcript_api._errors import (  # type: ignore
        IpBlocked, NoTranscriptFound, RequestBlocked, TranscriptsDisabled, VideoUnavailable)

# 요청 사이의 최소 간격(초). 막히지 않게 넉넉히.
MIN_INTERVAL_SEC = 8.0
# 자막이 이보다 짧으면(예: 1글자) 조리 순서를 만들 근거가 못 된다.
MIN_TRANSCRIPT_CHARS = 150
# AI 에 넣는 본문 전체 상한(`llm_ingredient_extraction.CONTENT_CHAR_LIMIT` 와 같은 값). 설명은 앞 1,800자까지, 나머지를 자막이 채운다.
CONTENT_CHAR_LIMIT = 4000
DESCRIPTION_KEEP = 1800


class TranscriptBlocked(Exception):
    """유튜브가 요청을 막았다. 호출한 쪽은 멈추고 나중에 다시 해야 한다."""


_lock = threading.Lock()
_last_call = 0.0
_api = None


def video_id(link):
    u = urlparse(link or '')
    if u.netloc.endswith('youtu.be'):
        return u.path.strip('/') or None
    q = parse_qs(u.query)
    if 'v' in q:
        return q['v'][0]
    m = re.search(r'/(shorts|embed)/([\w-]{11})', u.path)
    return m.group(2) if m else None


def _clean(text):
    text = re.sub(r'\[(음악|박수|웃음|Music|Applause)\]', ' ', text)
    return ' '.join(text.split())


def fetch_korean_transcript(link):
    """(자막 글, 이유) 를 돌려준다. 이유: ok / no_video_id / disabled / no_korean / unavailable / too_short / error:<이름>.
    막히면 `TranscriptBlocked` 를 던진다."""
    global _api, _last_call
    vid = video_id(link)
    if not vid:
        return None, 'no_video_id'
    if _api is None:
        _api = YouTubeTranscriptApi()
    with _lock:  # 스레드가 여럿이어도 한 줄로 천천히
        wait = _last_call + MIN_INTERVAL_SEC - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        _last_call = time.monotonic()
    try:
        listing = _api.list(vid)
        picked = None
        for t in listing:  # 직접 작성한 자막을 먼저, 없으면 자동 생성
            if t.language_code.startswith('ko') and not t.is_generated:
                picked = t
                break
        if picked is None:
            for t in listing:
                if t.language_code.startswith('ko'):
                    picked = t
                    break
        if picked is None:
            return None, 'no_korean'
        text = _clean(' '.join(s.text for s in picked.fetch()))
    except (IpBlocked, RequestBlocked) as e:
        raise TranscriptBlocked(str(e)) from e
    except TranscriptsDisabled:
        return None, 'disabled'
    except (NoTranscriptFound,):
        return None, 'no_korean'
    except VideoUnavailable:
        return None, 'unavailable'
    except Exception as e:  # noqa: BLE001
        return None, f'error:{type(e).__name__}'
    if len(text) < MIN_TRANSCRIPT_CHARS:
        return None, 'too_short'
    return text, 'ok'


def build_content(description, transcript):
    """AI 추출에 넣을 본문: 설명(재료 분량이 보통 여기 있다) + 자막. 전체 상한 안으로."""
    head = (description or '').strip()[:DESCRIPTION_KEEP]
    body = head + '\n\n[영상 자막]\n' + transcript
    return body[:CONTENT_CHAR_LIMIT]
