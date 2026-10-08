import React from 'react';
import CloseButton from './ui/CloseButton';

/**
 * 「유통기한 임박 알림을 받아보세요」 하단 시트 — **첫 접속 안내**(`ExpiryPushPrompt`)와
 * **마이페이지 토글을 켤 때**(`NotificationSettings`)가 같은 모양을 쓴다.
 * 처음에 `닫기` 를 눌렀어도, 나중에 토글을 다시 켜면 처음 접속했을 때와 똑같은
 * 이 안내가 뜨고 `알림 켜기` 를 눌러야 OS 권한 팝업으로 넘어간다(2026-10-09 요청).
 */
const ExpiryPushSheet: React.FC<{ onClose: () => void; onConfirm: () => void }> = ({ onClose, onConfirm }) => (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 'var(--z-toast)',
        background: 'rgba(0,0,0,0.42)', display: 'flex',
        alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-label="유통기한 임박 알림 안내"
        style={{
          position: 'relative', width: '100%', maxWidth: 400,
          background: 'rgba(20, 20, 20, 0.94)', borderRadius: '22px 22px 0 0',
          boxShadow: '0 -12px 30px rgba(0,0,0,0.18)',
          padding: '22px 18px calc(18px + env(safe-area-inset-bottom))',
          color: '#FFFFFF',
        }}
      >
        <CloseButton onClick={onClose} dark style={{ top: 10, right: 10 }} />
        <div style={{ paddingRight: 36 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, lineHeight: 1.35, wordBreak: 'keep-all' }}>
            유통기한 임박 알림을 받아보세요
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.55, color: 'rgba(255,255,255,0.66)', wordBreak: 'keep-all' }}>
            알림을 허용하면, 유통기한이 임박한 재료에 대한 알림을 받을 수 있어요.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, minHeight: 38, borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.12)', background: '#3A3A42',
              color: '#D2D2D8', fontSize: 15, fontWeight: 500, cursor: 'pointer',
            }}
          >
            닫기
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, minHeight: 38, borderRadius: 12, border: 'none',
              background: 'var(--brand)', color: '#1A1A1E',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
          >
            알림 켜기
          </button>
        </div>
      </div>
    </div>
);

export default ExpiryPushSheet;
