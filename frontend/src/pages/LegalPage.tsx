import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BackButton from '../components/ui/BackButton';
import { CONTACT } from '../components/ContactBox';

/**
 * 개인정보처리방침 · 이용약관.
 *
 * **왜 앱 안에 두나** — 개인정보를 받는 서비스는 처리방침을 공개해야 하고,
 * 구글 로그인 동의 화면도 그 주소를 요구한다. 노션이나 블로그에 두면 주소가
 * 바뀌고 앱과 따로 놀아서, 무엇을 모으는지 바뀌었을 때 한쪽만 고쳐진다.
 *
 * **내용은 코드에서 확인한 사실만 적었다.** 표에 실제로 있는 칸, 실제로 부르는
 * 바깥 서비스, 실제로 도는 삭제 코드. 방침이 코드보다 후하게 적혀 있으면
 * 그건 지킬 수 없는 약속이 된다.
 *
 * ⚠️ **운영자는 사업자가 아니라 개인이다.** 그래서 상호·사업자등록번호·
 *    사업장 주소를 적지 않는다. 그 셋은 전자상거래법이 「통신판매업자」에게
 *    요구하는 표시라, 돈을 받지 않는 동안은 해당하지 않는다.
 *    개인정보처리방침은 개인이 운영해도 써야 하지만, 필수 기재 사항에
 *    **주소는 없다** — 보호책임자의 이름과 연락처만 밝히면 된다.
 *    집 주소를 올릴 이유가 없다는 뜻이다.
 *
 * ⚠️ **크레딧을 유료로 팔기 시작하는 순간** 이야기가 달라진다. 그때는
 *    사업자등록과 통신판매업 신고가 필요하고, 위 표시 항목도 전부
 *    채워 넣어야 한다. 청약철회·환불 조항도 그때 들어간다.
 *
 * ⚠️ **초안이다.** 시행일은 비워 뒀다.
 *    법률 검토 없이 그대로 쓰지 말 것 — 특히 「보관 기간」은 지금 코드가
 *    탈퇴 시 실제로 지우지 않는 상태(soft delete)라 그대로 적어 두었다.
 */

const UPDATED_AT = '2026-09-10';

/**
 * 채워 넣어야 하는 자리. 비워 두면 화면에 그대로 드러나 잃지 않는다.
 *
 * `name` 은 **실명**이어야 한다. 개인정보보호법은 개인정보 보호책임자의
 * 성명과 연락처를 방침에 적게 하고, 혼자 운영하면 그 한 명이 그대로
 * 보호책임자다. 닉네임으로 대신할 수 없다. 반면 **주소는 필수가 아니라**
 * 칸을 아예 두지 않았다.
 *
 * 연락처는 마이페이지 문의 창구(`ContactBox`)와 **같은 값을 쓴다**. 따로
 * 적어 두면 한쪽만 바뀌어 서로 다른 연락처가 된다.
 */
const OPERATOR = {
  name: '나혜진',
  instagram: CONTACT.instagram,
  email: CONTACT.email,
};

/** 방침·약관 맨 아래 「연락처」 줄을 한 군데서 그린다. */
const ContactLines: React.FC<{ label: string }> = ({ label }) => (
  <>
    <li style={S.li}>운영자: {OPERATOR.name} (개인)</li>
    <li style={S.li}>{label}: 인스타그램 @{OPERATOR.instagram}</li>
    {OPERATOR.email && <li style={S.li}>이메일: {OPERATOR.email}</li>}
  </>
);

const S: Record<string, React.CSSProperties> = {
  // 위쪽 여백은 고정 헤더(56px) 때문이다 — 안 주면 탭이 헤더에 가려진다.
  page: { maxWidth: 720, margin: '0 auto', padding: '64px 18px 64px' },
  h1: { fontSize: 22, fontWeight: 800, color: 'var(--ink-900)', margin: '18px 0 6px' },
  updated: { fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 22 },
  h2: { fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', margin: '28px 0 10px' },
  p: { fontSize: 14, lineHeight: 1.75, color: 'var(--ink-700)', margin: '0 0 10px',
       wordBreak: 'keep-all' },
  li: { fontSize: 14, lineHeight: 1.75, color: 'var(--ink-700)', margin: '0 0 6px',
        wordBreak: 'keep-all' },
  ul: { margin: '0 0 12px', paddingLeft: 18 },
  note: { fontSize: 13, lineHeight: 1.7, color: 'var(--ink-700)', background: 'var(--surface-sub)',
          border: '1px solid var(--line-200)', borderRadius: 10, padding: '12px 14px',
          margin: '0 0 18px', wordBreak: 'keep-all' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5, margin: '0 0 14px' },
  th: { textAlign: 'left', padding: '8px 10px', background: 'var(--surface-sub)',
        border: '1px solid var(--line-200)', fontWeight: 700, color: 'var(--ink-900)' },
  td: { padding: '8px 10px', border: '1px solid var(--line-200)', color: 'var(--ink-700)',
        lineHeight: 1.6, verticalAlign: 'top', wordBreak: 'keep-all' },
  tabs: { display: 'flex', gap: 6, margin: '10px 0 4px' },
};

const Tab: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode }> = ({
  on, onClick, children,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    style={{
      height: 36, padding: '0 14px', borderRadius: 9999, cursor: 'pointer',
      fontSize: 13.5, fontWeight: on ? 700 : 500,
      background: on ? 'var(--ink-900)' : 'var(--surface)',
      color: on ? '#FFFFFF' : 'var(--ink-700)',
      border: `1px solid ${on ? 'var(--ink-900)' : 'var(--line-300)'}`,
    }}
  >
    {children}
  </button>
);

const Privacy: React.FC = () => (
  <>
    <h1 style={S.h1}>개인정보처리방침</h1>
    <div style={S.updated}>최종 수정일 {UPDATED_AT}</div>

    <div style={S.note}>
      쿡매치는 냉장고에 있는 재료로 만들 수 있는 요리를 찾아 주는 서비스입니다.
      그 일에 필요한 것만 받고, 필요 없어지면 지웁니다. 아래는 <b>실제로 저장되는
      것</b>을 그대로 적은 것입니다.
    </div>

    <h2 style={S.h2}>1. 무엇을 받나</h2>
    <table style={S.table}>
      <thead>
        <tr>
          <th style={S.th}>구분</th>
          <th style={S.th}>항목</th>
          <th style={S.th}>왜</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style={S.td}>계정</td>
          <td style={S.td}>이메일, 닉네임, 로그인 방식(구글/이메일), 비밀번호(되돌릴 수 없게 암호화)</td>
          <td style={S.td}>로그인, 내 재료·기록을 다음에도 보여 주기</td>
        </tr>
        <tr>
          <td style={S.td}>냉장고</td>
          <td style={S.td}>재료 이름, 보관 위치(냉동·냉장·실온), 유통기한, 구매일</td>
          <td style={S.td}>재료 매칭, 임박 재료 알림</td>
        </tr>
        <tr>
          <td style={S.td}>요리 기록</td>
          <td style={S.td}>즐겨찾기·완료·기록한 레시피, 요리 목표, 가족 수</td>
          <td style={S.td}>마이페이지, 캘린더, 식단에서 최근 만든 것 빼기</td>
        </tr>
        <tr>
          <td style={S.td}>가족 공유</td>
          <td style={S.td}>가족 그룹, 초대 코드, 초대 요청 상태</td>
          <td style={S.td}>가족끼리 냉장고·기록 함께 보기</td>
        </tr>
        <tr>
          <td style={S.td}>AI 사용</td>
          <td style={S.td}>크레딧 잔액·사용 내역, 호출 종류, 사용 토큰 수</td>
          <td style={S.td}>사용량 한도 관리, 요금 산정</td>
        </tr>
        <tr>
          <td style={S.td}>이용 기록</td>
          <td style={S.td}>기기 식별값, 세션 값, 어떤 화면에서 무엇을 눌렀는지, 접속 시각</td>
          <td style={S.td}>어디가 불편한지 찾아 고치기, 로그인 없이 써 볼 때의 사용량 한도</td>
        </tr>
      </tbody>
    </table>

    <p style={S.p}>
      <b>로그인하지 않아도</b> 체험할 수 있습니다. 그때는 이메일 없이 기기
      식별값만으로 사용량을 셉니다.
    </p>
    <p style={S.p}>
      <b>사진으로 재료 넣기</b>를 쓰면 그 사진은 재료를 알아보기 위해 아래 AI에
      전달됩니다. <b>사진 자체는 저장하지 않습니다</b> — 알아본 재료 이름만 남습니다.
    </p>

    <h2 style={S.h2}>2. 어디에 맡기나</h2>
    <p style={S.p}>서비스를 돌리기 위해 아래 회사의 기능을 씁니다.</p>
    <table style={S.table}>
      <thead>
        <tr>
          <th style={S.th}>맡기는 곳</th>
          <th style={S.th}>무엇을</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style={S.td}>Google (구글 로그인)</td>
          <td style={S.td}>로그인할 때 이메일·이름을 받아 옵니다</td>
        </tr>
        <tr>
          <td style={S.td}>Google (Gemini) · Groq</td>
          <td style={S.td}>요리 챗봇·식단 짜기·사진 재료 인식. 질문 글, 냉장고 재료 이름, 올린 사진이 전달됩니다</td>
        </tr>
        <tr>
          <td style={S.td}>쿠팡 파트너스</td>
          <td style={S.td}>광고 링크. 누르면 쿠팡으로 이동하며, 어떤 재료의 광고를 눌렀는지 <b>누구인지 모르는 형태로</b> 셉니다</td>
        </tr>
        <tr>
          <td style={S.td}>Railway · Vercel</td>
          <td style={S.td}>서버와 데이터베이스를 두는 곳(해외)</td>
        </tr>
      </tbody>
    </table>
    <p style={S.p}>
      광고·홍보를 위해 개인정보를 다른 곳에 팔거나 넘기지 않습니다.
    </p>

    <h2 style={S.h2}>3. 얼마나 갖고 있나</h2>
    <ul style={S.ul}>
      <li style={S.li}>계정과 냉장고·요리 기록은 <b>서비스를 쓰는 동안</b> 갖고 있습니다.</li>
      <li style={S.li}>
        회원 탈퇴를 하면 계정을 <b>즉시 사용할 수 없게</b> 하고 탈퇴 시각을 남깁니다.
        같은 이메일로 다시 가입하는 경우를 가려내기 위해 <b>계정 기록 자체는 바로
        지우지 않습니다.</b> 완전한 삭제를 원하시면 아래 연락처로 요청해 주세요 —
        확인 후 지웁니다.
      </li>
      <li style={S.li}>이용 기록(어떤 화면에서 무엇을 눌렀는지)은 서비스 개선에만 쓰고, 누구인지 알 수 없게 다룹니다.</li>
      <li style={S.li}>법령이 따로 보관을 요구하는 항목은 그 기간 동안 보관합니다.</li>
    </ul>

    <h2 style={S.h2}>4. 무엇을 요구할 수 있나</h2>
    <ul style={S.ul}>
      <li style={S.li}>내 정보를 보여 달라고 할 수 있습니다.</li>
      <li style={S.li}>틀린 것을 고쳐 달라고 할 수 있습니다.</li>
      <li style={S.li}>지워 달라고 할 수 있습니다. (앱에서 마이페이지 → 회원 탈퇴, 또는 연락처로 요청)</li>
      <li style={S.li}>처리를 멈춰 달라고 할 수 있습니다.</li>
    </ul>
    <p style={S.p}>
      만 14세 미만 어린이는 보호자 동의 없이 가입할 수 없습니다.
    </p>

    <h2 style={S.h2}>5. 어떻게 지키나</h2>
    <ul style={S.ul}>
      <li style={S.li}>비밀번호는 되돌릴 수 없는 형태로 바꿔 저장합니다 — 저희도 원래 값을 모릅니다.</li>
      <li style={S.li}>앱과 서버 사이의 통신은 암호화(HTTPS)합니다.</li>
      <li style={S.li}>데이터베이스에는 서비스 운영에 필요한 최소 인원만 접근합니다.</li>
    </ul>

    <h2 style={S.h2}>6. 브라우저에 남는 것</h2>
    <p style={S.p}>
      로그인 상태를 유지하고, 냉장고 재료를 빠르게 보여 주고, 정렬·필터 설정을
      기억하기 위해 브라우저 저장소를 씁니다. 브라우저 설정에서 지울 수 있고,
      지우면 그 편의 기능만 초기화됩니다.
    </p>

    <h2 style={S.h2}>7. 바뀔 때</h2>
    <p style={S.p}>
      내용이 바뀌면 이 화면에 고쳐 올리고, 최종 수정일을 함께 적습니다. 중요한
      변경은 앱 안에서 따로 알립니다.
    </p>

    <h2 style={S.h2}>8. 연락처</h2>
    <ul style={S.ul}>
      <li style={S.li}>서비스명: 쿡매치 (CookMatch)</li>
      <ContactLines label="개인정보 문의" />
    </ul>
    <p style={S.p}>
      개인정보와 관련해 도움이 더 필요하면 개인정보침해신고센터(privacy.kisa.or.kr,
      국번없이 118)나 개인정보 분쟁조정위원회(kopico.go.kr, 1833-6972)에 문의할 수
      있습니다.
    </p>
  </>
);

const Terms: React.FC = () => (
  <>
    <h1 style={S.h1}>이용약관</h1>
    <div style={S.updated}>최종 수정일 {UPDATED_AT}</div>

    <h2 style={S.h2}>제1조 (무엇을 하는 서비스인가)</h2>
    <p style={S.p}>
      쿡매치는 이용자가 등록한 냉장고 재료를 기준으로, 공개된 요리 글에서 만들 수
      있는 요리를 찾아 보여 주는 서비스입니다. AI를 이용한 재료 인식, 요리 추천,
      식단 짜기를 함께 제공합니다.
    </p>

    <h2 style={S.h2}>제2조 (가입과 이용)</h2>
    <ul style={S.ul}>
      <li style={S.li}>로그인 없이도 일부 기능을 체험할 수 있습니다.</li>
      <li style={S.li}>가입은 이메일 또는 구글 계정으로 합니다.</li>
      <li style={S.li}>만 14세 미만은 보호자 동의 없이 가입할 수 없습니다.</li>
      <li style={S.li}>한 사람이 여러 계정을 만들어 무료 제공량을 반복해서 받는 행위는 제한될 수 있습니다.</li>
    </ul>

    <h2 style={S.h2}>제3조 (레시피 글의 저작권)</h2>
    <p style={S.p}>
      앱에 보이는 요리 글의 <b>제목·요약·재료 정보와 대표 이미지는 원문을 찾아가기
      위한 것</b>이며, 저작권은 각 원문 작성자에게 있습니다. 카드를 누르면 원문으로
      이동합니다. 원문 작성자가 노출을 원하지 않으면 아래 연락처로 알려 주세요 —
      확인 후 내리겠습니다.
    </p>

    <h2 style={S.h2}>제4조 (AI 기능과 크레딧)</h2>
    <ul style={S.ul}>
      <li style={S.li}>
        요리 챗봇·식단 짜기·사진 재료 인식은 AI를 부르므로 <b>크레딧</b>을 씁니다.
        무엇에 얼마가 드는지는 각 화면에 적혀 있습니다.
      </li>
      <li style={S.li}>
        가입하면 기본 크레딧을 드립니다. 추가 크레딧은 현재 <b>요청을 받아
        지급</b>하고 있으며, 유료로 바뀔 경우 미리 알립니다.
      </li>
      <li style={S.li}>
        <b>AI가 알려 주는 내용은 참고용입니다.</b> 재료 인식·매칭·추천이 틀릴 수
        있으니, 실제 조리 전에 원문과 재료 상태를 직접 확인해 주세요.
      </li>
      <li style={S.li}>알레르기·식이 제한·식품 안전에 관한 판단은 이용자 책임입니다. 이 서비스는 의학적·영양학적 조언이 아닙니다.</li>
    </ul>

    <h2 style={S.h2}>제5조 (광고)</h2>
    <p style={S.p}>
      쿡매치는 쿠팡 파트너스 활동의 일환으로, 광고 링크를 통해 구매가 일어나면
      일정액의 수수료를 받습니다. 그 사실은 광고가 보이는 자리마다 표시합니다.
      상품의 판매와 배송, 교환·환불은 쿠팡의 책임이며 쿡매치는 관여하지 않습니다.
    </p>

    <h2 style={S.h2}>제6조 (하면 안 되는 것)</h2>
    <ul style={S.ul}>
      <li style={S.li}>다른 사람의 계정을 쓰거나 정보를 빼내려는 행위</li>
      <li style={S.li}>자동화 도구로 서비스에 과도한 부하를 주는 행위</li>
      <li style={S.li}>서비스의 내용을 무단으로 긁어 다시 배포하는 행위</li>
      <li style={S.li}>법령을 어기거나 다른 이용자에게 해를 끼치는 행위</li>
    </ul>

    <h2 style={S.h2}>제7조 (서비스의 중단·변경)</h2>
    <p style={S.p}>
      점검이나 장애, 외부 서비스의 사정으로 일부 기능이 멈추거나 바뀔 수 있습니다.
      미리 알 수 있는 경우에는 앱 안에서 알립니다.
    </p>

    <h2 style={S.h2}>제8조 (탈퇴)</h2>
    <p style={S.p}>
      마이페이지에서 언제든 탈퇴할 수 있습니다. 탈퇴하면 계정을 사용할 수 없게
      되고, 남은 크레딧은 소멸합니다. 저장한 정보의 처리는 개인정보처리방침을
      따릅니다.
    </p>

    <h2 style={S.h2}>제9조 (책임의 한계)</h2>
    <p style={S.p}>
      쿡매치는 무료로 제공되는 범위에서, 서비스 이용으로 생긴 손해에 대해 고의나
      중대한 과실이 없는 한 책임을 지지 않습니다. 원문 글의 내용과 그에 따른 조리
      결과에 대해서도 마찬가지입니다.
    </p>

    <h2 style={S.h2}>제10조 (약관의 변경)</h2>
    <p style={S.p}>
      약관이 바뀌면 이 화면에 고쳐 올리고 최종 수정일을 적습니다. 이용자에게
      불리한 변경은 시행 7일 전에 알립니다.
    </p>

    <h2 style={S.h2}>문의</h2>
    <ul style={S.ul}>
      <ContactLines label="문의" />
    </ul>
  </>
);

const LegalPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isTerms = location.pathname.startsWith('/terms');

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div style={S.page}>
      <div style={{ paddingTop: 10 }}>
        <BackButton onClick={() => navigate(-1)} />
      </div>
      <div style={S.tabs}>
        <Tab on={!isTerms} onClick={() => navigate('/privacy')}>개인정보처리방침</Tab>
        <Tab on={isTerms} onClick={() => navigate('/terms')}>이용약관</Tab>
      </div>
      {isTerms ? <Terms /> : <Privacy />}
    </div>
  );
};

export default LegalPage;
