import React, { useEffect, useRef, useState } from 'react';
import Sheet from './ui/Sheet';

export type CaptureMode = 'receipt' | 'food-single' | 'food-multi' | 'file';

interface CameraCaptureSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** 사진을 받은 뒤 호출된다. 앨범/파일 선택은 여러 장을 고를 수 있어 항상 배열로 넘긴다
   * (카메라 촬영은 한 장이라 길이 1). */
  onCaptured: (mode: CaptureMode, files: File[]) => void;
  /** 앨범에서 한 번에 고를 수 있는 최대 장수 */
  maxFiles?: number;
}

const ReceiptIcon: React.FC = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1A1A1E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5.5 3.4l1.6 1.3 1.6-1.3 1.6 1.3 1.6-1.3 1.6 1.3 1.6-1.3 1.6 1.3V19a1.6 1.6 0 0 1-1.6 1.6H7.1A1.6 1.6 0 0 1 5.5 19z" />
    <path d="M8.6 8.2h6.8M8.6 11.6h6.8M8.6 15h4.2" />
  </svg>
);

const FoodSingleIcon: React.FC = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1A1A1E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 8.2h3.1l1.5-2.2h6.8l1.5 2.2H20a1.6 1.6 0 0 1 1.6 1.6v8.4A1.6 1.6 0 0 1 20 19.8H4a1.6 1.6 0 0 1-1.6-1.6V9.8A1.6 1.6 0 0 1 4 8.2z" />
    <circle cx="12" cy="13.6" r="3.4" />
  </svg>
);

const FoodMultiIcon: React.FC = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1A1A1E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="3" width="8" height="8" rx="1.6" />
    <rect x="13" y="3" width="8" height="8" rx="1.6" />
    <rect x="3" y="13" width="8" height="8" rx="1.6" />
    <rect x="13" y="13" width="8" height="8" rx="1.6" />
  </svg>
);

const OPTIONS: { key: Extract<CaptureMode, 'receipt' | 'food-single' | 'food-multi'>; label: string; icon: React.FC }[] = [
  { key: 'receipt', label: '영수증', icon: ReceiptIcon },
  { key: 'food-single', label: '음식 1개', icon: FoodSingleIcon },
  { key: 'food-multi', label: '음식 여러 개', icon: FoodMultiIcon },
];

/**
 * 카메라로 재료를 담는 입구를 하나로 모은 시트.
 *
 * 예전엔 "영수증 인식"/"사진으로 재료 인식" 아이콘 버튼 두 개가 따로 있었는데,
 * 어차피 둘 다 눌러도 "준비 중" 안내만 뜨는 자리였다. 실제 인식 기능이 들어올
 * 자리를 미리 만들어 두는 것이라면, 버튼을 하나로 모으고 "뭘 찍을지"를 먼저
 * 고르게 하는 편이 — 나중에 AI가 알아서 구분하는 기능이 생기기 전까지는 —
 * 사용자에게도 무엇을 찍어야 인식이 잘 될지 알려주는 역할을 겸한다.
 *
 * 위로 열리는 바텀시트라 "필터"처럼 손잡이를 잡고 아래로 끌면 닫혀야 자연스럽다
 * — 직접 구현하지 않고, 그 동작을 이미 갖춘 공용 `Sheet`(FilterModal 등이 쓰는 것과
 * 동일)를 그대로 쓴다.
 *
 * 촬영/선택 자체는 표준 <input type=file> 로 처리한다(capture 속성으로 카메라
 * 바로 열기, 없으면 앨범/파일 선택). 실제 OS 위젯(홈 화면 위젯, 다른 앱 위에
 * 떠 있는 플로팅 버튼)은 PWA 만으로는 만들 수 없다 — 네이티브 앱(Capacitor로
 * 감싼 뒤 iOS/Android 각각 위젯 코드)이 있어야 한다. "홈 화면에 추가" PWA
 * 설치 안내는 다른 화면(HomeInstallPrompt 등)에서 이미 하고 있어 여기서는
 * 반복하지 않고, 위젯이 계획돼 있다는 사실만 짧게 알려 둔다.
 */
/** 방금 찍은 사진으로 볼 시간 간격 (파일이 만들어진 지 이 정도 안쪽이면 촬영으로 본다) */
const JUST_TAKEN_MS = 2 * 60 * 1000;

/**
 * 파일 선택으로 들어온 사진이 "방금 찍은 것" 인지 짐작한다.
 *
 * 왜 필요한가: 파일 선택을 누르면 OS 가 `사진 보관함 / 사진 찍기 / 파일 선택` 메뉴를
 * 띄우는데, 웹에서 촬영 항목만 빼는 표준 방법이 없다. 그런데 거기서 찍으면 위쪽
 * 타일(영수증/음식1개/음식여러개)을 거치지 않아 **무엇을 찍었는지 모른 채** 처리된다.
 *
 * 촬영으로 들어온 파일은 만들어진 시각이 방금이다(앨범 사진은 대개 예전 날짜).
 * 그걸 단서로 "방금 찍으셨네요, 무엇인가요?" 를 한 번 물어본다. **다시 찍게 하지 않고**
 * 이미 받은 사진을 그대로 들고 있다가 고른 모드로 보낸다.
 */
const looksJustTaken = (files: File[]) =>
  files.length > 0 &&
  files.some(f => {
    // 시각을 못 읽는 기기도 있다. 그럴 땐 "오래된 사진" 이라고 단정할 수 없으므로
    // 물어보는 쪽으로 기운다 — 잘못 물어봐야 탭 한 번이고, 안 물어보면 분기가 통째로 빠진다.
    if (!f.lastModified) return true;
    return Date.now() - f.lastModified < JUST_TAKEN_MS;
  });

const CameraCaptureSheet: React.FC<CameraCaptureSheetProps> = ({ isOpen, onClose, onCaptured, maxFiles = 5 }) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingMode, setPendingMode] = useState<CaptureMode>('food-single');
  /** 방금 찍은 것으로 보여 모드를 물어보는 중인 사진들 */
  const [awaitingMode, setAwaitingMode] = useState<File[] | null>(null);
  /** 물어보는 동안 보여줄 미리보기. "사진이 잘 찍혔고 우리가 갖고 있다" 를 눈으로 알려 준다 */
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    if (!awaitingMode) {
      setPreviews([]);
      return;
    }
    const urls = awaitingMode.map(f => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [awaitingMode]);

  const openCameraFor = (mode: CaptureMode) => {
    // 모드를 물어보는 중이면, 타일을 누른 건 "이 사진은 이거예요" 라는 뜻이다.
    // 다시 찍게 하지 않고 들고 있던 사진을 그대로 보낸다.
    if (awaitingMode) {
      const files = awaitingMode;
      setAwaitingMode(null);
      onCaptured(mode, files);
      return;
    }
    setPendingMode(mode);
    // 같은 모드를 연달아 찍어도 change 이벤트가 다시 뜨도록 비워 둔다.
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    cameraInputRef.current?.click();
  };

  const makeChangeHandler = (mode: CaptureMode) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (picked.length === 0) return;
    // 너무 많이 고르면 앞에서부터 자른다 (서버도 같은 수로 막고 있다).
    const files = picked.slice(0, maxFiles);
    // 앨범/파일 경로인데 방금 찍은 사진이면, OS 메뉴에서 '사진 찍기' 로 들어온 것이다.
    // 타일을 안 거쳤으므로 무엇을 찍었는지 여기서 한 번 묻는다.
    if (mode === 'file' && looksJustTaken(files)) {
      setAwaitingMode(files);
      return;
    }
    onCaptured(mode, files);
  };

  const handleClose = () => {
    setAwaitingMode(null);
    onClose();
  };

  return (
    <Sheet open={isOpen} onClose={handleClose} title="사진으로 재료 담기" maxHeight="70dvh" hideFooter>
      {/* 모드를 물어보는 동안 타일이 눈에 띄도록 하는 깜빡임 */}
      <style>{`
        @keyframes cookmatch-tile-blink {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 214, 0, 0); }
          50%      { box-shadow: 0 0 0 4px rgba(255, 214, 0, 0.85); }
        }
        .cookmatch-tile-blink { animation: cookmatch-tile-blink 1.1s ease-in-out infinite; }
      `}</style>
      {/* 실제 촬영/선택은 숨겨진 input 두 개가 담당한다.
          capture="environment" 는 모바일에서 바로 후면 카메라를 연다.
          아래쪽 것은 capture가 없어 앨범·파일 앱을 그대로 보여준다 — 모바일에서는
          이 하나로 앨범/파일 선택이 다 되므로 버튼을 둘로 나눌 필요가 없다. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={makeChangeHandler(pendingMode)}
      />
      {/* 앨범 선택은 여러 장을 고를 수 있게 한다. 여러 장이어도 LLM 호출은
          1회라(한 요청에 이미지를 여러 개 넣는다) 한도가 장수만큼 늘지 않는다.

          accept 를 `image/*` 대신 형식 목록으로 좁힌 이유: `image/*` 이면 OS 가
          띄우는 선택 메뉴에 "사진 찍기"가 함께 나온다. 촬영은 바로 위 타일들이
          맡고 있어 여기서는 중복이라, 형식을 명시해 보관함/파일 쪽으로 유도한다.
          (메뉴 자체는 OS 가 그리는 것이라 강제할 수는 없다.)
          어차피 업로드 직전에 전부 JPEG 으로 다시 뽑으므로 실제로 받는 형식은
          이 목록보다 넓다. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
        multiple
        style={{ display: 'none' }}
        onChange={makeChangeHandler('file')}
      />

      {/* 아직 실제 인식 기능은 없다는 걸, 개발 중인 영역임을 한눈에 알 수 있게
          살짝 기울어진 배지로 밝혀 둔다. */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
        <span
          style={{
            display: 'inline-block',
            transform: 'rotate(-4deg)',
            background: '#FFD600',
            color: '#1A1A1E',
            fontSize: 12,
            fontWeight: 700,
            padding: '4px 12px',
            borderRadius: 9999,
            whiteSpace: 'nowrap',
          }}
        >
          ✨ 영수증은 지금 바로 인식돼요 · 음식 사진은 준비 중
        </span>
      </div>

      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 17, marginBottom: awaitingMode ? 6 : 16, color: '#1A1A1E' }}>
        {awaitingMode ? '방금 찍은 사진, 무엇인가요?' : '무엇을 찍을까요?'}
      </div>
      {awaitingMode && (
        <>
          {previews.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
              {previews.slice(0, 3).map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt={`찍은 사진 ${i + 1}`}
                  style={{
                    width: 64, height: 64, objectFit: 'cover',
                    borderRadius: 10, border: '2px solid #FFD600',
                  }}
                />
              ))}
              {previews.length > 3 && (
                <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--ink-500)' }}>
                  +{previews.length - 3}
                </span>
              )}
            </div>
          )}
          <div
            style={{
              margin: '0 0 14px',
              padding: '10px 12px',
              borderRadius: 10,
              background: '#FFF8D6',
              border: '1px solid #FFD600',
              color: '#1A1A1E',
              fontSize: 13,
              lineHeight: 1.5,
              textAlign: 'center',
              wordBreak: 'keep-all',
            }}
          >
            사진은 잘 받았어요. <b>다시 찍지 않아도 돼요.</b>
            <br />
            아래에서 <b>무엇을 찍었는지</b> 골라 주세요.
          </div>
        </>
      )}

      {/* 카드를 눌러야 찍힌다는 게 한눈에 들어오도록, 글줄보다 아이콘을 훨씬
          크게 키운 정사각 타일 3개를 나란히 둔다(설명문처럼 가로로 긴 줄
          형태였던 이전 버전은 "눌러서 촬영"이라는 느낌이 잘 안 살았다). */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
        {OPTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={awaitingMode ? 'cookmatch-tile-blink' : undefined}
            onClick={() => openCameraFor(key)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              aspectRatio: '1 / 1',
              padding: '10px 6px',
              borderRadius: 16,
              border: '1px solid var(--line-200)',
              background: 'var(--surface-sub)',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: '#FFFFFF',
                border: '1px solid var(--line-200)',
                flexShrink: 0,
              }}
            >
              <Icon />
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1E', textAlign: 'center' }}>{label}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          if (awaitingMode) {
            // 고르기 싫으면 모델이 알아서 판단하게 한다 (앨범 경로와 같은 처리).
            const files = awaitingMode;
            setAwaitingMode(null);
            onCaptured('file', files);
            return;
          }
          fileInputRef.current?.click();
        }}
        style={{
          width: '100%',
          height: 40,
          borderRadius: 10,
          border: '1px solid var(--line-200)',
          background: '#FFFFFF',
          color: 'var(--ink-700)',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: 14,
        }}
      >
        {awaitingMode
          ? '모르겠어요 · 알아서 인식해 주세요'
          : `사진 앨범/파일에서 선택 (최대 ${maxFiles}장)`}
      </button>

      {/* 진짜 "홈 화면 위젯"(다른 앱 위에 떠 있는 버튼 포함)은 PWA 로는 만들 수
          없다 — 네이티브 앱이어야 한다. 이 시트에서는 "홈 화면에 추가" 같은
          PWA 설치 안내는 굳이 반복하지 않고, 위젯 자체가 계획돼 있다는 것만
          짧게 알려 둔다(설치 안내는 다른 화면에서 이미 하고 있음). */}
      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.5 }}>
        📱 바탕화면에 바로 찍는 위젯도 준비 중이에요.
        <br />
        앱 출시 후 지원될 예정이에요.
      </div>
    </Sheet>
  );
};

export default CameraCaptureSheet;
