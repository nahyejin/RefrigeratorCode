import React from 'react';
import { useNavigate } from 'react-router-dom';
import Dialog from './ui/Dialog';

interface WelcomeModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * 첫 진입 안내 팝업.
 * 예전엔 딤 배경조차 없이 흰 카드만 떠 있어 모달인지 페이지 일부인지 구분이 안 됐고,
 * 폭·여백·버튼 크기가 다른 팝업들과 제각각이었음 → 공통 `ui/Dialog` 로 위임.
 */
const WelcomeModal: React.FC<WelcomeModalProps> = ({ visible, onClose }) => {
  const navigate = useNavigate();

  const goLogin = () => {
    // 로그인 후 가이드를 표시하기 위한 플래그 저장
    const guideShown = localStorage.getItem('myfridge_guide_shown');
    if (!guideShown) {
      localStorage.setItem('show_guide_after_login', 'true');
    }
    onClose();
    navigate('/login');
  };

  return (
    <Dialog
      open={visible}
      onClose={onClose}
      actions={[
        { label: '닫기', onClick: onClose, variant: 'outline' },
        { label: '로그인하기', onClick: goLogin, variant: 'primary' },
      ]}
    >
      <div>기본 재료를 미리 준비해뒀어요.</div>
      <div>추가·삭제로 내냉장고를 관리해보세요.</div>
      <div>로그인하면 안전하게 보관돼요.</div>
    </Dialog>
  );
};

export default WelcomeModal;
