import React from 'react';
import { useNavigate } from 'react-router-dom';
import Dialog from './ui/Dialog';

interface RegisterPromptModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  message: string;
  /** 두 번째 줄. `null`이면 두 번째 줄 없음(첫 줄만). 미전달 시 기본: 회원가입이 필요해요 */
  subMessage?: string | null;
  dismissLabel?: string;
  confirmLabel?: string;
}

/**
 * 회원가입 유도 팝업.
 * 예전엔 자체 마크업(딤 30% / rounded-xl / 320px / p-6 / h-10 버튼)을 들고 있어
 * 다른 팝업들과 규격이 달랐음 → 공통 `ui/Dialog` 로 위임.
 */
const RegisterPromptModal: React.FC<RegisterPromptModalProps> = ({
  visible,
  onClose,
  onConfirm,
  message,
  subMessage,
  dismissLabel = '나중에',
  confirmLabel = '회원가입하기',
}) => {
  const navigate = useNavigate();

  const showSecondLine = subMessage !== null;
  const secondLineText =
    subMessage === undefined || subMessage === '' ? '회원가입이 필요해요' : subMessage;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
      return;
    }
    onClose();
    navigate('/login');
  };

  return (
    <Dialog
      open={visible}
      onClose={onClose}
      actions={[
        { label: dismissLabel, onClick: onClose, variant: 'outline' },
        { label: confirmLabel, onClick: handleConfirm, variant: 'primary' },
      ]}
    >
      <div>{message}</div>
      {showSecondLine && <div style={{ marginTop: 2 }}>{secondLineText}</div>}
    </Dialog>
  );
};

export default RegisterPromptModal;
