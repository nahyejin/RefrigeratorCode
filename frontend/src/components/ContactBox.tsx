import React from 'react';
import { Link } from 'react-router-dom';

/**
 * **개발자에게 말 거는 자리.**
 *
 * 오류 추적(Sentry)은 앱이 터진 것을 알려 주지만, "이게 왜 이렇죠" 나 "이런 게
 * 있으면 좋겠어요" 는 사람이 직접 말해 줘야만 안다. 그런데 말할 곳이 없으면
 * 대부분은 그냥 앱을 닫는다.
 *
 * 인스타그램 DM 을 먼저 두는 이유 — 쿡매치 계정으로 릴스를 올릴 참이라, 보는
 * 곳과 말하는 곳이 같아진다. 앱을 쓰다 말고 메일 앱을 여는 것보다 손이 덜 간다.
  * 이메일은 지금 안 둔다 — 답할 곳을 둘로 나누면 한쪽을 놓친다.
 * 필요해지면 `CONTACT.email` 에 넣는 순간 줄이 생긴다.
 */

/**
 * 인스타그램 아이디는 영문·숫자·마침표·밑줄만 된다 — 한글 `쿡매치` 는
 * 아이디로 못 쓴다(프로필 이름에는 한글을 쓸 수 있다).
 * `ig.me/m/아이디` 는 DM 창을 바로 열어 준다.
 *
 * **여기가 연락처의 유일한 출처다.** 개인정보처리방침·이용약관도
 * 이 값을 가져다 쓴다 — 계정을 바꾸면 이 한 줄만 고치면 된다.
 */
export const CONTACT = {
  instagram: 'Cook._.match',
  /** 비워 두면 이메일 줄은 안 보인다. 지금은 인스타그램 DM 하나로 받는다. */
  email: '',
};

const InstagramMark = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden
       style={{ flexShrink: 0 }}>
    <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.9" />
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.9" />
    <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
  </svg>
);

const MailMark = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden
       style={{ flexShrink: 0 }}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.9" />
    <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"
          strokeLinejoin="round" />
  </svg>
);

const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9,
  height: 44, padding: '0 14px', borderRadius: 10,
  border: '1px solid var(--line-200)', background: 'var(--surface)',
  color: 'var(--ink-900)', fontSize: 13.5, fontWeight: 600,
  textDecoration: 'none', cursor: 'pointer', width: '100%', boxSizing: 'border-box',
};

const ContactBox: React.FC = () => (
  <div style={{ marginTop: 24 }}>
    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 4 }}>
      불편한 점이 있으셨나요
    </div>
    <p style={{ fontSize: 12.5, lineHeight: 1.65, color: 'var(--ink-500)',
                margin: '0 0 10px', wordBreak: 'keep-all' }}>
      오류를 만나셨거나 「이런 게 있으면 좋겠다」 싶은 게 있으면 알려 주세요.
      직접 읽고 고칩니다.
    </p>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <a
        href={`https://ig.me/m/${CONTACT.instagram}`}
        target="_blank"
        rel="noopener noreferrer"
        style={row}
      >
        <InstagramMark />
        <span>인스타그램으로 메시지 보내기</span>
        <span style={{ marginLeft: 'auto', color: 'var(--ink-400)', fontSize: 12.5 }}>
          @{CONTACT.instagram}
        </span>
      </a>

      {CONTACT.email && (
        <a href={`mailto:${CONTACT.email}?subject=${encodeURIComponent('쿡매치 문의')}`} style={row}>
          <MailMark />
          <span>메일 보내기</span>
          <span style={{ marginLeft: 'auto', color: 'var(--ink-400)', fontSize: 12.5 }}>
            {CONTACT.email}
          </span>
        </a>
      )}
    </div>

    {/* 방침·약관도 여기서 갈 수 있게 둔다 — 따로 찾아다닐 이유가 없다. */}
    <div style={{ display: 'flex', gap: 10, marginTop: 12, fontSize: 12.5 }}>
      <Link to="/privacy" style={{ color: 'var(--ink-500)' }}>개인정보처리방침</Link>
      <span style={{ color: 'var(--line-300)' }}>·</span>
      <Link to="/terms" style={{ color: 'var(--ink-500)' }}>이용약관</Link>
    </div>
  </div>
);

export default ContactBox;
