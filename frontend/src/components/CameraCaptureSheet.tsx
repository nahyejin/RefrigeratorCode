import React, { useRef, useState } from 'react';
import Sheet from './ui/Sheet';
import Dialog from './ui/Dialog';

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

// 세 모드는 서버에서 **서로 다른 프롬프트**를 쓴다. 무엇을 시키느냐가 달라서
// 결과도 크게 달라진다 — 영수증은 "산 목록을 읽어라", 음식 1개는 "가운데 것
// 하나만", 음식 여러 개는 "보이는 것을 빠짐없이". 그래서 찍기 전에 먼저 묻고,
// 타일에도 언제 무엇을 고르는지 한 줄로 적어 둔다.
const OPTIONS: {
  key: Extract<CaptureMode, 'receipt' | 'food-single' | 'food-multi'>;
  label: string;
  hint: string;
  icon: React.FC;
}[] = [
  { key: 'receipt', label: '영수증', hint: '산 것 전부', icon: ReceiptIcon },
  { key: 'food-single', label: '음식 1개', hint: '하나만 크게', icon: FoodSingleIcon },
  { key: 'food-multi', label: '음식 여러 개', hint: '펼쳐 놓고', icon: FoodMultiIcon },
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
const CameraCaptureSheet: React.FC<CameraCaptureSheetProps> = ({ isOpen, onClose, onCaptured, maxFiles = 5 }) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingMode, setPendingMode] = useState<CaptureMode>('food-single');
  /**
   * 앨범/파일 버튼을 누른 뒤, **사진을 고르기 전에** 모드를 먼저 묻는 중인지.
   *
   * 왜 먼저 묻나: 파일 선택을 누르면 OS 가 `사진 보관함 / 사진 찍기 / 파일 선택` 을
   * 띄우는데, 웹에서 촬영 항목만 빼는 표준 방법이 없다. 거기서 찍으면 위쪽 타일을
   * 거치지 않아 **무엇을 찍었는지 모른 채** 처리된다(타일마다 프롬프트가 다르다).
   *
   * 예전엔 사진이 들어온 뒤 파일 시각으로 "방금 찍은 것" 을 짐작해 되물었는데,
   * 기기에 따라 그 시각이 없거나 촬영 중 화면 상태가 날아가 물어보지 못하는 경우가
   * 있었다. 그래서 **순서를 뒤집었다** — 고르기 전에 정하면 OS 메뉴에서 무엇을
   * 누르든(보관함이든 촬영이든) 모드가 이미 정해져 있다.
   */
  const [choosingForPicker, setChoosingForPicker] = useState(false);
  /** 파일 선택창을 열 때 정해 둔 모드 */
  const pickerModeRef = useRef<CaptureMode>('file');

  /** 정한 모드로 앨범/파일 선택창을 연다 */
  const openPickerWith = (mode: CaptureMode) => {
    pickerModeRef.current = mode;
    setChoosingForPicker(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    fileInputRef.current?.click();
  };

  const openCameraFor = (mode: CaptureMode) => {
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
    // 앨범/파일 경로는 열기 전에 정해 둔 모드를 쓴다 (OS 메뉴에서 촬영을 골랐어도 동일).
    onCaptured(mode === 'file' ? pickerModeRef.current : mode, files);
  };

  const handleClose = () => {
    setChoosingForPicker(false);
    onClose();
  };

  return (
    <>
    <Sheet open={isOpen} onClose={handleClose} title="사진으로 재료 담기" maxHeight="70dvh" hideFooter>
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

      {/* 예전엔 여기에 "영수증은 지금 바로 인식돼요 · 음식 사진은 준비 중" 노랑 배지가
          있었다. 세 모드가 모두 동작하게 되면서 알릴 내용이 없어져 걷어냈다.
          (시트를 여는 버튼 자체가 이미 "AI" 배지를 달고 있어 중복이기도 했다.) */}
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 17, marginBottom: 16, color: '#1A1A1E' }}>
        무엇을 찍을까요?
      </div>

      {/* 카드를 눌러야 찍힌다는 게 한눈에 들어오도록, 글줄보다 아이콘을 훨씬
          크게 키운 타일 3개를 나란히 둔다(설명문처럼 가로로 긴 줄 형태였던
          이전 버전은 "눌러서 촬영"이라는 느낌이 잘 안 살았다).

          ⚠️ `1fr` 이 아니라 `minmax(0, 1fr)` 이어야 한다.
          `1fr` 의 자동 최소 크기는 **min-content** 라 칸이 내용보다 작아질 수 없다.
          예전엔 타일에 `aspect-ratio: 1/1` 이 걸려 있어서, 타일이 세로로 길어지면
          그 높이가 **가로 최소 폭**으로 되돌아왔다. 힌트 한 줄(`펼쳐 놓고`)을
          더했더니 내용 높이가 102 -> 125px 이 되면서 칸도 125px 을 요구했고,
          3칸 합이 시트보다 59px 넓어져 **시트가 좌우로 흔들렸다**(바텀시트 본문은
          overflow-y:auto 라 가로도 자동으로 스크롤된다).
          지금은 `minmax(0, ...)` 로 칸이 줄어들 수 있게 하고, 정사각 고정 대신
          내용에 맞춰 높이가 정해지게 두었다(그리드가 세 칸 높이를 알아서 맞춘다). */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 14 }}>
        {OPTIONS.map(({ key, label, hint, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => openCameraFor(key)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '16px 6px',
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
            <span style={{ fontSize: 11, color: 'var(--ink-500)', textAlign: 'center', marginTop: -4 }}>{hint}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        // 바로 선택창을 열지 않고 먼저 종류를 묻는다 (openPickerWith 설명 참고).
        //
        // 이름을 "사진 추가" 로 둔 이유: 이 버튼을 누르면 OS 가 보관함/촬영/파일을
        // 함께 띄우는데 그 메뉴는 웹에서 손댈 수 없다. "앨범/파일에서 선택" 이라고 하면
        // 촬영이 나오는 게 앞뒤가 안 맞고, "여러 장 고르기" 라고 하면 촬영은 한 장이라
        // 또 어긋난다. 세 경로를 다 포괄하는 말이어야 한다.
        onClick={() => setChoosingForPicker(true)}
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
        사진 추가 (최대 {maxFiles}장)
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

    {/* 앨범/파일에서 고르기 전에 종류를 정하는 팝업.
        시트 위에 뜨므로 nested 로 한 단계 위 층에 올린다.
        고르지 않으면 선택창이 열리지 않는다 — 모드 없이 처리되는 길을 없앴다. */}
    <Dialog
      open={choosingForPicker}
      onClose={() => setChoosingForPicker(false)}
      title="어떤 사진을 고르실 건가요?"
      nested
      dismissLabel="취소"
    >
      {/* 고른 종류는 그때 선택한 사진 **전체**에 적용된다. 여러 장을 한 번의 호출로
          처리하느라 프롬프트가 하나뿐이라서, 종류를 섞으면 인식이 나빠진다. */}
      <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 12, wordBreak: 'keep-all' }}>
        고른 종류가 사진 전체에 적용돼요. <b>같은 종류끼리</b> 골라 주세요.
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {OPTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => openPickerWith(key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              height: 56,
              padding: '0 14px',
              borderRadius: 12,
              border: '1px solid var(--line-200)',
              background: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--surface-sub)',
                flexShrink: 0,
              }}
            >
              <Icon />
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1E' }}>{label}</span>
          </button>
        ))}
      </div>
    </Dialog>
    </>
  );
};

export default CameraCaptureSheet;
