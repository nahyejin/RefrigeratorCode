import React, { useState } from 'react';
import BottomNavBar from '../components/BottomNavBar';
import logoImg from '../assets/냉털이 로고 white.png';
import searchIcon from '../assets/navigator_search.png';
import myProfileImg from '../assets/profile_default.png'; // 기본 프로필 이미지(없으면 대체)
import 완료하기버튼 from '../assets/완료하기버튼.svg';
import 공유하기버튼 from '../assets/공유하기버튼.svg';
import 기록하기버튼 from '../assets/기록하기버튼.svg';
import writeIcon from '../assets/write.svg';
import doneIcon from '../assets/done.svg';
import { useNavigate } from 'react-router-dom';

// 타입 명시
interface RecipeCardData {
  id: number;
  thumbnail: string;
  title: string;
  match: number;
}

// 카드 스타일 상수화
const CARD_STYLE = {
  borderRadius: 20,
  background: '#fff',
  boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
  marginBottom: 4,
  minHeight: 144,
  position: 'relative' as 'relative',
  padding: 16,
  border: 'none',
};

// ActionButton 컴포넌트
const ActionButton = ({
  title,
  icon,
  onClick,
  active = true,
}: {
  title: string;
  icon: string;
  onClick: () => void;
  active?: boolean;
}) => (
  <span style={{ position: 'relative', zIndex: 2 }}>
    <span style={{ position: 'absolute', left: 0, top: 0, width: 26, height: 26, borderRadius: '50%', background: 'rgba(34,34,34,0.7)', zIndex: 1 }}></span>
    <button
      title={title}
      tabIndex={0}
      style={{
        width: 26,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        outline: 'none',
        position: 'relative',
        zIndex: 2,
      }}
      onClick={onClick}
    >
      <img src={icon} alt={title} width={19} height={19} style={{ display: 'block', position: 'relative', zIndex: 2, opacity: active ? 1 : 0.5 }} />
    </button>
  </span>
);

const dummyUser = {
  nickname: '홍길동',
  userid: 'honggildong123',
  phone: '010-1234-5678',
};

const dummyRecorded: RecipeCardData[] = [
  {
    id: 1,
    thumbnail: 'https://cdn.pixabay.com/photo/2016/03/05/19/02/hamburger-1238246_1280.jpg',
    title: '요즘 틱톡에서 유행하는 초간단 안주레시피',
    match: 80,
  },
  {
    id: 2,
    thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
    title: '다이어트 김밥 만들기 오이김밥 레시피',
    match: 90,
  },
  {
    id: 3,
    thumbnail: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80',
    title: '숙취해소로 최고의 황태해장국',
    match: 75,
  },
];
const dummyCompleted: RecipeCardData[] = [
  {
    id: 1,
    thumbnail: 'https://cdn.pixabay.com/photo/2016/03/05/19/02/hamburger-1238246_1280.jpg',
    title: '오징어볶음 레시피 만드는법 간단',
    match: 85,
  },
  {
    id: 2,
    thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
    title: '대패삼겹살 제육볶음 레시피',
    match: 78,
  },
  {
    id: 3,
    thumbnail: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80',
    title: '두릅 장아찌 만드는법 레시피',
    match: 70,
  },
];

const MyPage = () => {
  const [editOpen, setEditOpen] = useState(false);
  const [user, setUser] = useState(dummyUser);
  const [edit, setEdit] = useState({
    nickname: user.nickname,
    userid: user.userid,
    password: '',
    password2: '',
    phone1: '010',
    phone2: '',
    phone3: '',
    zipcode: '',
    address1: '',
    address2: '',
  });
  const [error, setError] = useState({ password: '', phone: '' });
  // 완료 상태 및 토스트
  const [doneStates, setDoneStates] = useState<{ [id: number]: boolean }>({});
  const [writeStates, setWriteStates] = useState<{ [id: number]: boolean }>({});
  const [toast, setToast] = useState('');
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const navigate = useNavigate();

  // 정보 수정 모달 저장
  const handleSave = () => {
    let valid = true;
    const newError = { password: '', phone: '' };
    if (edit.password && edit.password.length < 6) {
      newError.password = '비밀번호는 6자 이상이어야 합니다.';
      valid = false;
    }
    setError(newError);
    if (!valid) return;
    setUser({ ...user, nickname: edit.nickname });
    setEditOpen(false);
  };

  // 완료 버튼 클릭 핸들러
  const handleDoneClick = (id: number) => {
    setDoneStates(prev => {
      const isActive = !!prev[id];
      setToast(isActive ? '레시피 완료를 취소했습니다!' : '레시피를 완료했습니다!');
      setTimeout(() => setToast(''), 1500);
      return { ...prev, [id]: !isActive };
    });
  };

  // 기록 버튼 클릭 핸들러
  const handleWriteClick = (id: number) => {
    setWriteStates(prev => {
      const isActive = !!prev[id];
      setToast(isActive ? '레시피 기록을 취소했습니다!' : '레시피를 기록했습니다!');
      setTimeout(() => setToast(''), 1500);
      return { ...prev, [id]: !isActive };
    });
  };

  // 공유 버튼 클릭 핸들러
  const handleShareClick = () => {
    navigator.clipboard.writeText(window.location.href);
    setToast('URL이 복사되었습니다!');
    setTimeout(() => setToast(''), 1500);
  };

  return (
    <div className="bg-white min-h-screen max-w-[430px] mx-auto pb-24 relative">
      {/* 상단 네비 */}
      <header className="w-full h-[56px] flex items-center justify-between px-5 bg-white">
        <img src={logoImg} alt="냉털이 로고" className="h-4 w-auto" style={{ minWidth: 16 }} />
        <img src={searchIcon} alt="검색" className="h-4 w-4 mr-1 cursor-pointer" />
      </header>
      {/* 타이틀 제거, 프로필 영역을 위로 올림 */}
      <section className="flex flex-col items-center justify-center gap-3 mb-[70px] mt-[64px]">
        <img src={myProfileImg} alt="프로필" className="w-36 h-36 rounded-full border-2 border-gray-200 mb-2" />
        <div className="flex flex-col items-center mb-2">
          <div className="text-[18px] font-bold text-gray-700 mb-1">{user.nickname}</div>
          <div className="text-[15px] text-gray-500">{user.userid}</div>
        </div>
        <button
          className="mt-1 px-3 h-7 bg-[#FFD600] text-[#222] rounded-full text-[13px] font-bold flex items-center gap-1 border-none shadow hover:bg-yellow-300 transition"
          style={{ minWidth: 0, height: 28, paddingLeft: 14, paddingRight: 14, fontFamily: 'inherit' }}
          onClick={() => setEditOpen(true)}
        >내 정보 수정 <span style={{fontFamily:'inherit', fontWeight:500, fontSize:15, color:'#222', marginLeft:2}}>〉</span></button>
      </section>
      {/* 내가 기록한 레시피 + 내가 완료한 레시피 그룹 */}
      <div style={{ marginTop: 56 }}>
        {/* 내가 기록한 레시피 */}
        <div style={{ paddingLeft: 32, marginTop: 0, marginBottom: 8 }}>
          <div className="flex items-center justify-between mb-0">
            <h2 className="text-[16px] font-bold text-[#111] flex items-center gap-1">
              <img src={writeIcon} alt="기록 아이콘" className="inline-block align-middle" style={{width: 18, height: 18, marginRight: 4, marginBottom: 2}} />
              내가 기록한 레시피
            </h2>
            <button
              className="text-[#888] text-[20px] font-bold px-2 py-0 bg-transparent border-none outline-none cursor-pointer"
              aria-label="내가 기록한 레시피 전체보기"
              onClick={() => navigate('/mypage/recorded')}
            >
              〉
            </button>
          </div>
          <div style={{height: 2, width: '100%', background: '#E5E5E5', marginBottom: 4}} />
          <div className="flex gap-1 overflow-x-auto pb-2 custom-scrollbar">
            {dummyRecorded.map(r => (
              <div key={r.id} className="min-w-[210px] max-w-[210px] flex flex-col gap-1 relative" style={CARD_STYLE}>
                <div className="relative">
                  <img src={r.thumbnail} alt={r.title} className="w-full h-[110px] object-cover rounded-lg" />
                  <div className="absolute bg-[#444] bg-opacity-80 text-white font-medium rounded px-2 py-0.5 flex items-center gap-1" style={{position:'absolute', top:0, left:0, fontSize:11, zIndex:2, textShadow: '0 1px 2px rgba(0,0,0,0.12)'}}>
                    재료 매칭률 <span className="text-[#FFD600] font-bold ml-1" style={{ textShadow: 'none', letterSpacing: '0.5px' }}>{r.match}%</span>
                  </div>
                  <div style={{position:'absolute', right:8, bottom:8, display:'flex', flexDirection:'row', gap:6, alignItems:'center', zIndex:2}}>
                    <ActionButton title="완료" icon={완료하기버튼} onClick={() => handleDoneClick(r.id)} active={doneStates[r.id]} />
                    <ActionButton title="공유" icon={공유하기버튼} onClick={handleShareClick} />
                    <ActionButton title="기록" icon={기록하기버튼} onClick={() => handleWriteClick(r.id)} active={writeStates[r.id]} />
                  </div>
                </div>
                <div className="font-bold text-[13px] line-clamp-2 mt-1">{r.title}</div>
              </div>
            ))}
          </div>
        </div>
        {/* 내가 완료한 레시피 */}
        <div style={{ paddingLeft: 32, marginTop: 0 }}>
          <div className="flex items-center justify-between mb-0">
            <h2 className="text-[16px] font-bold text-[#111] flex items-center gap-1">
              <img src={doneIcon} alt="완료 아이콘" className="inline-block align-middle" style={{width: 18, height: 18, marginRight: 4, marginBottom: 2}} />
              내가 완료한 레시피
            </h2>
            <button
              className="text-[#888] text-[20px] font-bold px-2 py-0 bg-transparent border-none outline-none cursor-pointer"
              aria-label="내가 완료한 레시피 전체보기"
              onClick={() => navigate('/mypage/completed')}
            >
              〉
            </button>
          </div>
          <div style={{height: 2, width: '100%', background: '#E5E5E5', marginBottom: 4}} />
          <div className="flex gap-1 overflow-x-auto pb-2 custom-scrollbar">
            {dummyCompleted.map(r => (
              <div key={r.id} className="min-w-[210px] max-w-[210px] flex flex-col gap-1 relative" style={CARD_STYLE}>
                <div className="relative">
                  <img src={r.thumbnail} alt={r.title} className="w-full h-[110px] object-cover rounded-lg" />
                  <div className="absolute bg-[#444] bg-opacity-80 text-white font-medium rounded px-2 py-0.5 flex items-center gap-1" style={{position:'absolute', top:0, left:0, fontSize:11, zIndex:2, textShadow: '0 1px 2px rgba(0,0,0,0.12)'}}>
                    재료 매칭률 <span className="text-[#FFD600] font-bold ml-1" style={{ textShadow: 'none', letterSpacing: '0.5px' }}>{r.match}%</span>
                  </div>
                  <div style={{position:'absolute', right:8, bottom:8, display:'flex', flexDirection:'row', gap:6, alignItems:'center', zIndex:2}}>
                    <ActionButton title="완료" icon={완료하기버튼} onClick={() => handleDoneClick(r.id)} active={doneStates[r.id]} />
                    <ActionButton title="공유" icon={공유하기버튼} onClick={handleShareClick} />
                    <ActionButton title="기록" icon={기록하기버튼} onClick={() => handleWriteClick(r.id)} active={writeStates[r.id]} />
                  </div>
                </div>
                <div className="font-bold text-[13px] line-clamp-2 mt-1">{r.title}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* 광고 영역 */}
      <div className="w-full h-[120px] border-2 border-dashed border-red-400 flex items-center justify-center text-center text-[15px] text-red-500 font-bold mb-24">
        <span>〈추후 광고 추가 할 자리〉<br />'새로 사야하는 재료'는 쿠팡이나 마켓컬리로<br />바로 이동 가능하게 하여 광고 삽입하기</span>
      </div>
      <BottomNavBar activeTab="mypage" />
      {/* 내 정보 수정 모달 */}
      {editOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-start justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-[370px] max-w-[95vw] relative max-h-[90vh] overflow-y-auto scrollbar-none" style={{scrollbarWidth:'none'}} onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 left-0 right-0 z-20 bg-white border-b border-gray-200 rounded-t-xl w-full" style={{minHeight: 56, paddingTop: 18, paddingBottom: 8}}>
              <span className="absolute top-3 right-3 w-6 h-6 text-gray-400 text-xl cursor-pointer select-none" onClick={() => setEditOpen(false)} role="button" aria-label="닫기" style={{zIndex: 20}}>×</span>
              <div className="text-center font-bold text-[18px]">내 정보 수정</div>
            </div>
            <div className="p-6 pt-2">
              {/* 프로필 이미지 + 사진 변경 */}
              <div className="flex flex-col items-center mb-5">
                <img
                  src={profilePreview || myProfileImg}
                  alt="프로필 미리보기"
                  className="w-24 h-24 rounded-full border-2 border-gray-200 object-cover mb-2"
                />
                <label className="inline-block px-4 py-1 bg-gray-200 text-gray-700 rounded-full text-[13px] font-medium cursor-pointer hover:bg-gray-300 transition">
                  사진 변경
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = ev => setProfilePreview(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>
              {/* 닉네임 + 중복체크 */}
              <div className="mb-3 flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-[15px] font-semibold mb-1">닉네임</label>
                  <input className="w-full h-10 border border-gray-300 rounded-lg px-4 text-[15px]" value={edit.nickname} onChange={e => setEdit({ ...edit, nickname: e.target.value })} />
                </div>
                <button className="h-10 px-3 bg-blue-500 text-white rounded-lg text-[14px] font-semibold whitespace-nowrap mt-6">닉네임 중복 체크</button>
              </div>
              {/* 아이디 (회색, 읽기전용) */}
              <div className="mb-3">
                <label className="block text-[15px] font-semibold mb-1">아이디</label>
                <input className="w-full h-10 border border-gray-200 rounded-lg px-4 text-[15px] bg-gray-200 text-gray-400" value={edit.userid} readOnly />
              </div>
              {/* 비밀번호 */}
              <div className="mb-3">
                <label className="block text-[15px] font-semibold mb-1">비밀번호</label>
                <input type="password" className="w-full h-10 border border-gray-300 rounded-lg px-4 text-[15px]" value={edit.password} onChange={e => setEdit({ ...edit, password: e.target.value })} placeholder="Password" />
              </div>
              {/* 비밀번호 확인 */}
              <div className="mb-3">
                <label className="block text-[15px] font-semibold mb-1">비밀번호 확인</label>
                <input type="password" className="w-full h-10 border border-gray-300 rounded-lg px-4 text-[15px]" value={edit.password2} onChange={e => setEdit({ ...edit, password2: e.target.value })} placeholder="Re Password" />
              </div>
              {/* 연락처 */}
              <div className="mb-3">
                <label className="block text-[15px] font-semibold mb-1">연락처</label>
                <div className="flex gap-2">
                  <input className="w-[70px] h-10 border border-gray-300 rounded-lg px-3 text-[15px]" maxLength={3} value={edit.phone1} onChange={e => setEdit({ ...edit, phone1: e.target.value.replace(/[^0-9]/g, '') })} />
                  <input className="w-[90px] h-10 border border-gray-300 rounded-lg px-3 text-[15px]" maxLength={4} value={edit.phone2} onChange={e => setEdit({ ...edit, phone2: e.target.value.replace(/[^0-9]/g, '') })} />
                  <input className="w-[90px] h-10 border border-gray-300 rounded-lg px-3 text-[15px]" maxLength={4} value={edit.phone3} onChange={e => setEdit({ ...edit, phone3: e.target.value.replace(/[^0-9]/g, '') })} />
                </div>
              </div>
              {/* 우편번호 + 확인 */}
              <div className="mb-3 flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-[15px] font-semibold mb-1">우편번호</label>
                  <input className="w-full h-10 border border-gray-300 rounded-lg px-4 text-[15px]" value={edit.zipcode} onChange={e => setEdit({ ...edit, zipcode: e.target.value.replace(/[^0-9]/g, '') })} />
                </div>
                <button className="h-10 px-3 bg-blue-500 text-white rounded-lg text-[14px] font-semibold whitespace-nowrap mt-6">우편번호 찾기</button>
              </div>
              {/* 주소 */}
              <div className="mb-3">
                <label className="block text-[15px] font-semibold mb-1">주소</label>
                <input className="w-full h-10 border border-gray-300 rounded-lg px-4 text-[15px] mb-2" value={edit.address1} onChange={e => setEdit({ ...edit, address1: e.target.value })} placeholder="주소" />
                <input className="w-full h-10 border border-gray-300 rounded-lg px-4 text-[15px]" value={edit.address2} onChange={e => setEdit({ ...edit, address2: e.target.value })} placeholder="상세 주소" />
              </div>
              {/* 저장 버튼 */}
              <button className="w-full h-11 bg-green-600 text-white rounded-lg text-[16px] font-bold mt-4">수정하기</button>
            </div>
          </div>
          <style>{`
            .scrollbar-none::-webkit-scrollbar { display: none; }
            .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
          `}</style>
        </div>
      )}
      {/* Toast Popup */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 100,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(34,34,34,0.9)',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: 12,
          fontWeight: 400,
          fontSize: 15,
          zIndex: 9999,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          maxWidth: 260,
          width: 'max-content',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textAlign: 'center',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
};
 
export default MyPage; 