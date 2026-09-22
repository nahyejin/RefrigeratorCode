import React from 'react';

/**
 * 계정·데이터 삭제 안내 — Google Play 「데이터 보안」의 **계정 삭제 URL** 로 등록하는 페이지.
 *
 * 왜 따로 두나(2026-09-22):
 *   Play 는 이 URL 에 ① 앱·개발자 이름 ② 삭제를 요청하는 단계가 **눈에 띄게** ③ 삭제·보관되는
 *   데이터와 **보관 기간**이 있어야 한다고 요구한다. 개인정보처리방침(/privacy)에도 탈퇴 안내는
 *   있지만 긴 방침 중간에 묻혀 있고 보관 기간이 없어서, 이 셋만 모은 짧은 페이지를 만들었다.
 *
 * 실제 동작과 반드시 같아야 한다:
 *   - 회원 탈퇴(`/api/auth/delete-account`)는 계정을 쓸 수 없게 표시(deleted_at)하고, 콘텐츠
 *     (backend `WITHDRAWAL_CONTENT_TABLES` — 냉장고·기록·식단·AI 대화·알림 구독)를 즉시 지운다
 *     (2026-09-22부터. 그 전엔 전부 남겼다). 계정 행과 가입 혜택·이용량 기록은 재가입 혜택 중복
 *     방지용으로 남긴다. 가족 그룹 냉장고는 남은 식구에게 넘기고, Apple 로그인이면 Apple 연결을 끊는다.
 *   - 탈퇴 후 1년이 지나면 `scripts/purge_deleted_accounts.py`(매일 배치)가 남은 기록을 지운다.
 *   - 그 전에 요청하면 7일 안에 같은 스크립트(`--user-id`)로 지운다.
 *   이 중 하나라도 바뀌면 이 페이지와 개인정보처리방침(LegalPage.tsx 「3. 얼마나 갖고 있나」)을 같이 고칠 것.
 */

const DELETION_EMAIL = '920803hj@gmail.com'; // 스토어 연락처 이메일과 같은 값(store/STORE_LISTING.md)
const INSTAGRAM = 'Cook._.match';

const S: Record<string, React.CSSProperties> = {
  // 위쪽 여백은 고정 헤더(56px) 때문 — LegalPage 와 같은 값
  page: { maxWidth: 720, margin: '0 auto', padding: '64px 18px 64px' },
  h1: { fontSize: 22, fontWeight: 800, color: 'var(--ink-900)', margin: '18px 0 6px', wordBreak: 'keep-all' },
  meta: { fontSize: 13, color: 'var(--ink-500)', marginBottom: 20, lineHeight: 1.6 },
  h2: { fontSize: 16.5, fontWeight: 700, color: 'var(--ink-900)', margin: '28px 0 10px' },
  p: { fontSize: 14, lineHeight: 1.75, color: 'var(--ink-700)', margin: '0 0 10px', wordBreak: 'keep-all' },
  ol: { margin: '0 0 12px', paddingLeft: 20 },
  ul: { margin: '0 0 12px', paddingLeft: 18 },
  li: { fontSize: 14, lineHeight: 1.75, color: 'var(--ink-700)', margin: '0 0 6px', wordBreak: 'keep-all' },
  box: { fontSize: 14, lineHeight: 1.7, color: 'var(--ink-900)', background: 'var(--surface-sub)',
         border: '1px solid var(--line-200)', borderRadius: 12, padding: '14px 16px', margin: '0 0 12px',
         wordBreak: 'keep-all' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5, margin: '0 0 14px' },
  th: { textAlign: 'left', padding: '8px 10px', background: 'var(--surface-sub)', border: '1px solid var(--line-200)',
        fontWeight: 700, color: 'var(--ink-900)' },
  td: { padding: '8px 10px', border: '1px solid var(--line-200)', color: 'var(--ink-700)', lineHeight: 1.6,
        verticalAlign: 'top', wordBreak: 'keep-all' },
};

const AccountDeletion: React.FC = () => {
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div style={S.page}>
      <h1 style={S.h1}>쿡매치(CookMatch) 계정 및 데이터 삭제 안내</h1>
      <div style={S.meta}>
        앱: 쿡매치 - 냉장고 재료로 레시피 추천 (Android · iOS) · 개발자: 나혜진
      </div>

      <h2 style={S.h2}>1. 앱에서 바로 탈퇴하기</h2>
      <div style={S.box}>
        <ol style={{ ...S.ol, margin: 0 }}>
          <li style={S.li}>쿡매치 앱을 열고 아래 탭에서 <b>마이페이지</b>를 누릅니다.</li>
          <li style={S.li}>프로필 옆의 <b>정보 수정</b>을 누릅니다.</li>
          <li style={S.li}>맨 아래 <b>회원탈퇴</b>를 누르고, 확인 창에서 <b>탈퇴하기</b>를 누릅니다.</li>
        </ol>
      </div>

      <h2 style={S.h2}>2. 앱 없이 삭제 요청하기</h2>
      <div style={S.box}>
        이메일 <b>{DELETION_EMAIL}</b> 로 제목 「쿡매치 계정 삭제 요청」, 본문에 <b>가입한 이메일 주소</b>(또는
        구글·카카오·네이버·Apple 중 어떤 방법으로 로그인했는지)를 적어 보내 주세요. 인스타그램
        @{INSTAGRAM} 다이렉트 메시지로도 받습니다. 본인 확인 후 <b>7일 안에</b> 계정과 아래 데이터를
        모두 지우고 답장드립니다.
      </div>

      <h2 style={S.h2}>3. 삭제되는 데이터와 보관 기간</h2>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>언제</th>
            <th style={S.th}>내용</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={S.td}>탈퇴 즉시 삭제</td>
            <td style={S.td}>
              냉장고 재료, 즐겨찾기·요리 기록·완료 기록·식단 계획, AI 대화 기록, 알림 수신 정보(기기 알림
              주소). 계정으로 더 이상 로그인할 수 없고, 가족 그룹에서 빠집니다(함께 쓰던 냉장고는 남은
              식구에게 넘어갑니다). Apple 로그인으로 가입했다면 Apple 과의 연결도 끊습니다.
            </td>
          </tr>
          <tr>
            <td style={S.td}>1년 보관 후 자동 삭제</td>
            <td style={S.td}>
              계정 기록(이메일·닉네임·로그인 방식·탈퇴 시각)과 가입 혜택·이용량 기록
            </td>
          </tr>
          <tr>
            <td style={S.td}>1년 전에 지워 달라고 요청하면</td>
            <td style={S.td}>남아 있는 기록도 요청일로부터 7일 안에 모두 삭제합니다.</td>
          </tr>
        </tbody>
      </table>
      <ul style={S.ul}>
        <li style={S.li}>
          <b>왜 계정 기록은 1년 동안 보관하나요?</b> 같은 이메일로 탈퇴와 재가입을 반복해 가입 혜택(AI 이용
          크레딧)을 여러 번 받는 것을 막기 위해서입니다. 보관하는 동안 이 기록은 다른 목적으로 쓰지 않습니다.
        </li>
        <li style={S.li}>
          가족 식구가 직접 남긴 기록(식구 본인의 요리 기록 등)은 그 식구의 데이터라 함께 지워지지 않습니다.
        </li>
        <li style={S.li}>법령이 따로 보관을 요구하는 정보가 생기면 그 기간 동안만 보관합니다.</li>
      </ul>
      <p style={S.p}>
        자세한 내용은 <a href="/privacy">개인정보처리방침</a>을 참고해 주세요.
      </p>
    </div>
  );
};

export default AccountDeletion;
