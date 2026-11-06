import React, { useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { UsageLine, useUsage } from './UsageMeter';
import Sheet from './ui/Sheet';
import SegmentedToggle from './ui/SegmentedToggle';

/**
 * 네이티브 앱(안드로이드/iOS)에서는 `<input type=file>` 대신 진짜 OS 카메라·
 * 사진 보관함 API(@capacitor/camera)를 부른다 — "웹사이트를 앱 껍데기에
 * 넣은 것"이라 애플 심사에서 반려되는 걸 피하려면 실제 네이티브 기능이
 * 있어야 한다(2026-09-17 논의). 웹(브라우저로 접속하는 사용자)은 기존
 * `<input type=file>` 방식 그대로 — `Capacitor.isNativePlatform()`로만
 * 갈라서, 기존 웹 동작은 한 글자도 안 바뀐다.
 *
 * 플러그인이 돌려주는 사진(webPath)을 서버 업로드에 쓰는 `File`로 바꾼다 —
 * 이 앱의 업로드 로직(`onCaptured(mode, files: File[])`)이 이미 `File[]`을
 * 기대하고 있어서, 여기서만 변환해 주면 나머지 코드는 전혀 안 건드려도 된다.
 */
async function photoToFile(webPath: string, index: number): Promise<File> {
  const res = await fetch(webPath);
  const blob = await res.blob();
  const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  return new File([blob], `capture-${Date.now()}-${index}.${ext}`, { type: blob.type || 'image/jpeg' });
}

export type CaptureMode = 'receipt' | 'food-single' | 'food-multi' | 'file';

type PickMode = Extract<CaptureMode, 'receipt' | 'food-single' | 'food-multi'>;
const LAST_MODE_KEY = 'cm_camera_last_mode';
const readLastMode = (): PickMode => {
  try {
    const v = localStorage.getItem(LAST_MODE_KEY);
    if (v === 'receipt' || v === 'food-single' || v === 'food-multi') return v;
  } catch { /* 저장소를 못 읽어도 기본값으로 */ }
  return 'receipt';
};

interface CameraCaptureSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** 사진을 받은 뒤 호출된다. 앨범/파일 선택은 여러 장을 고를 수 있어 항상 배열로 넘긴다
   * (카메라 촬영은 한 장이라 길이 1). */
  onCaptured: (mode: CaptureMode, files: File[]) => void;
  /** 앨범에서 한 번에 고를 수 있는 최대 장수 */
  maxFiles?: number;
}

// 세 모드는 서버에서 **서로 다른 프롬프트**를 쓴다. 무엇을 시키느냐가 달라서
// 결과도 크게 달라진다 — 영수증은 "산 목록을 읽어라", 음식 1개는 "가운데 것
// 하나만", 음식 여러 개는 "보이는 것을 빠짐없이". 그래서 찍기 전에 먼저 묻고,
// 타일에도 언제 무엇을 고르는지 한 줄로 적어 둔다.
//
// "영수증" 타일의 프롬프트는 실제로는 종이 영수증에 한정되지 않는다 —
// "산 것을 읽어라" 라는 지시 자체가 쿠팡·마켓컬리 같은 온라인 쇼핑몰의
// 주문내역 캡처에도 그대로 통한다(둘 다 "이름 + 날짜가 적힌 구매 목록"
// 이라는 점은 같다, `backend/ingredient_vision.py`의 `_RECEIPT_PROMPT`
// 참고). 그런데 타일 라벨이 "영수증"뿐이라 그 활용을 떠올리기 어려웠다 —
// hint 에 짧게 적어 둔다.
const OPTIONS: {
  key: Extract<CaptureMode, 'receipt' | 'food-single' | 'food-multi'>;
  label: string;
  hint: string;
}[] = [
  { key: 'receipt', label: '영수증', hint: '영수증이나 쿠팡·마켓컬리 주문내역 캡처' },
  { key: 'food-single', label: '음식 1개', hint: '재료 하나를 가운데에 크게' },
  { key: 'food-multi', label: '음식 여러 개', hint: '여러 재료를 펼쳐 놓고 한 번에' },
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
  // 이 시트에서 한 번 누르면 몇 크레딧이 나가는지. 서버가 정한 값을 그대로 쓴다.
  const usageNow = useUsage();
  const visionCost = (usageNow?.credits as any)?.vision ?? 2;
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingMode, setPendingMode] = useState<CaptureMode>('food-single');
  /**
   * 고른 종류(영수증 / 음식 1개 / 음식 여러 개). **종류는 여기서 한 번만 고른다.**
   *
   * 예전엔 타일을 누르면 곧바로 카메라가 열렸고(종류+촬영), 아래 「사진 추가」를 누르면 같은 세 종류를
   * 팝업으로 한 번 더 물었다(2026-11-06 「뭐가 뭔지 헷갈린다」). 이제 타일은 종류만 고르고, 아래 버튼 둘이
   * 방법(촬영 / 앨범)만 고른다 — 팝업이 사라진다.
   *
   * 무엇을 고르든 모드는 사진을 열기 **전에** 정해져 있다. 앨범 선택창에서 OS 가 「사진 찍기」를 함께
   * 보여 줘도 어떤 종류인지 이미 안다(타일마다 서버 프롬프트가 다르다).
   * 마지막에 고른 종류를 기억해 둔다 — 영수증만 계속 올리는 사람이 매번 다시 고르지 않게.
   */
  const [selectedMode, setSelectedMode] = useState<PickMode>(readLastMode);
  const chooseMode = (m: PickMode) => {
    setSelectedMode(m);
    try { localStorage.setItem(LAST_MODE_KEY, m); } catch { /* 저장이 안 돼도 이번 선택은 쓴다 */ }
  };
  /**
   * 네이티브 카메라·앨범을 여는 데 실패한 이유(사용자가 그냥 닫은 것은 제외).
   *
   * 전에는 실패를 전부 조용히 삼켰다 — 아이폰 TestFlight 실기기에서 타일을 눌러도 **아무 반응이
   * 없어서** 권한 문제인지 플러그인 문제인지조차 알 수 없었다(2026-09-21). 이제 이유를 화면에 보여
   * 준다. 사용자가 촬영·선택 창을 닫은 경우(cancel)는 오류가 아니므로 계속 조용히 넘어간다.
   */
  const [nativeError, setNativeError] = useState<string | null>(null);
  const reportNativeError = (e: unknown) => {
    const msg = String((e as { message?: unknown })?.message ?? e ?? '');
    if (/cancel|dismiss|no image picked/i.test(msg)) return;
    console.warn('[camera] 열기 실패:', e);
    setNativeError(msg || '알 수 없는 오류');
  };
  /** 파일 선택창을 열 때 정해 둔 모드 */
  const pickerModeRef = useRef<CaptureMode>('file');

  /** 정한 모드로 앨범/파일 선택창을 연다 — 네이티브 앱에서는 진짜 사진
   * 보관함 API(여러 장 선택)를, 웹에서는 기존 `<input type=file multiple>`을. */
  const openPickerWith = async (mode: CaptureMode) => {
    pickerModeRef.current = mode;
    setNativeError(null);
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await Camera.pickImages({ quality: 85, limit: maxFiles });
        if (result.photos.length === 0) return; // 취소
        const files = await Promise.all(result.photos.map((p, i) => photoToFile(p.webPath!, i)));
        onCaptured(mode, files);
      } catch (e) {
        // 사용자가 닫은 것은 조용히, 권한 거부·플러그인 오류는 화면에 이유를 보여 준다.
        reportNativeError(e);
      }
      return;
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    fileInputRef.current?.click();
  };

  /** 정한 모드로 카메라를 연다 — 네이티브 앱에서는 진짜 카메라 API를,
   * 웹에서는 기존 `<input type=file capture=environment>`을. */
  const openCameraFor = async (mode: CaptureMode) => {
    setPendingMode(mode);
    setNativeError(null);
    if (Capacitor.isNativePlatform()) {
      try {
        // iOS 는 새 API `takePhoto` 를 쓴다. 예전 `getPhoto(source: Camera)` 는 플러그인이 더 이상
        // 권장하지 않는(deprecated) 경로인데, 실제 아이폰(iOS 26)에서는 카메라가 아예 안 열리고
        // 오류도 없이 멈췄다(2026-09-21 TestFlight 실기기). 안드로이드는 기존 방식이 잘 돼서 그대로 둔다.
        const photo = Capacitor.getPlatform() === 'ios'
          ? await Camera.takePhoto({ quality: 85 })
          : await Camera.getPhoto({
              resultType: CameraResultType.Uri,
              source: CameraSource.Camera,
              quality: 85,
            });
        if (!photo.webPath) return;
        const file = await photoToFile(photo.webPath, 0);
        onCaptured(mode, [file]);
      } catch (e) {
        // 사용자가 닫은 것은 조용히, 권한 거부·플러그인 오류는 화면에 이유를 보여 준다.
        reportNativeError(e);
      }
      return;
    }
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

  return (
    <>
    <Sheet open={isOpen} onClose={onClose} title="사진으로 재료 담기" maxHeight="70dvh" hideFooter>
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
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 17, marginBottom: 6, color: '#1A1A1E' }}>
        무엇을 담을까요?
      </div>
      {/* 기능을 쓰려고 연 시점이 남은 양을 알려주기 가장 좋은 때다.
          단위를 `upload` 로 준다 — 여러 장을 올려도 LLM 호출은 한 번이라
          크레딧도 한 번치다. 오히려 **몰아서 올리는 쪽이 이득**인데, 장당
          나가는 줄 알면 한 장씩 올려서 손해를 본다. */}
      <UsageLine
        style={{ justifyContent: 'center', marginBottom: 16 }}
        cost={visionCost}
        costUnit="upload"
      />

      {nativeError && (
        <div role="alert" style={{
          marginBottom: 12, padding: '10px 12px', borderRadius: 10,
          background: '#FFF1F0', border: '1px solid #F5C2C0', color: '#B42318',
          fontSize: 12.5, lineHeight: 1.6, wordBreak: 'keep-all',
        }}>
          카메라·사진을 열지 못했어요. 휴대폰 설정 → 쿡매치에서 카메라와 사진 접근이 허용돼 있는지 확인해 주세요.
          <div style={{ marginTop: 4, color: '#7A271A', wordBreak: 'break-all' }}>({nativeError})</div>
        </div>
      )}
      {/* 종류는 **토글**로 고른다. 예전엔 아이콘이 큰 카드 세 장이라 「누르면 다음 화면으로 넘어갈 것」
          처럼 보였다(2026-11-06 지적). 카드는 눈에 띄게 만든 것인데, 여기서는 고르기만 하고 실제 동작은
          아래 버튼 둘이 한다. 앱의 다른 「하나 고르기」(마이캘린더 등)와 같은 공용 토글을 쓴다. */}
      <SegmentedToggle
        value={selectedMode}
        onChange={chooseMode}
        options={OPTIONS.map(o => ({ value: o.key, label: o.label }))}
        height={38}
        style={{ display: 'grid', width: '100%', boxSizing: 'border-box' }}
      />
      {/* 고른 종류의 설명 한 줄. 줄 높이를 고정해 종류를 바꿔도 아래 버튼이 안 움직이게 한다. */}
      <div style={{ minHeight: 20, margin: '8px 0 16px', textAlign: 'center', fontSize: 12.5, color: 'var(--ink-500)', lineHeight: '20px' }}>
        {OPTIONS.find(o => o.key === selectedMode)?.hint}
      </div>

      {/* 방법 버튼 둘 — 위에서 고른 종류로 열린다. 촬영은 한 장, 앨범은 여러 장(maxFiles).
          앨범 선택창에는 OS 가 「사진 찍기」를 함께 보여 주는데, 종류는 이미 정해져 있어 어느 쪽을 눌러도 같다. */}
      <button
        type="button"
        onClick={() => openCameraFor(selectedMode)}
        style={{
          width: '100%',
          minHeight: 48,
          padding: '12px',
          boxSizing: 'border-box',
          borderRadius: 12,
          border: 'none',
          background: '#FFD600',
          color: '#1A1A1E',
          fontSize: 15,
          fontWeight: 700,
          cursor: 'pointer',
          marginBottom: 8,
        }}
      >
        사진 찍기
      </button>
      <button
        type="button"
        onClick={() => openPickerWith(selectedMode)}
        style={{
          width: '100%',
          minHeight: 48,
          padding: '12px',
          boxSizing: 'border-box',
          borderRadius: 12,
          border: '1px solid var(--line-300)',
          background: '#FFFFFF',
          color: 'var(--ink-900)',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: 14,
        }}
      >
        앨범에서 고르기 (최대 {maxFiles}장)
      </button>

      {/* 홈 화면 위젯은 네이티브 앱에서만 된다(PWA 로는 불가). 안드로이드 앱에 「재료 찍기」
          1×1 위젯을 넣었으므로(2026-09-23, CameraWidgetProvider) "준비 중" 안내를 실제 안내로
          바꾼다. 한 줄로 유지한다 — 폭이 좁으면 글씨만 줄인다(어중간한 줄바꿈 방지). */}
      <div style={{ textAlign: 'center', fontSize: 'clamp(10px, 3.1vw, 12px)', color: 'var(--ink-500)',
                    lineHeight: 1.5, whiteSpace: 'nowrap', overflow: 'hidden' }}>
        📱 홈 화면에 위젯으로 추가하면 바로 찍을 수 있어요.
      </div>
    </Sheet>

    </>
  );
};

export default CameraCaptureSheet;
