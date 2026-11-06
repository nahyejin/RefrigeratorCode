import * as React from 'react';

/**
 * 말로 입력하는 마이크 버튼. 눌러서 켜고, 다시 누르면 멈춘다.
 *
 * 왜 만들었나(2026-11-06): 요리하는 중이거나 손이 젖었을 때, 두 AI 채팅창(쿡매치 AI·AI 식단 추천)과 앞으로의 요리 도우미에서
 * 글자를 치기 어렵다는 요청. 입력창이 같은 모양이라 버튼을 하나로 만들어 같이 쓴다.
 *
 * **들은 말은 입력창에 채우기만 한다. 보내기는 직접 누른다** — 잘못 알아들은 말이 자동으로 나가면 크레딧이 나간다.
 * 듣는 동안은 말이 들리는 대로 입력창이 바뀌고(`interimResults`), 멈추면 마지막 글자가 남는다.
 *
 * 브라우저가 음성인식을 지원하지 않으면 **버튼 자체를 그리지 않는다**(눌러도 아무 일도 없는 버튼을 두지 않는다).
 * 설치 앱의 웹뷰(안드로이드 WebView·iOS WKWebView)는 지원하지 않아서 앱에서는 아직 안 보인다 — 앱은 음성인식 플러그인과
 * 마이크 권한을 넣은 빌드가 따로 필요하다.
 */
const getRecognition = (): any =>
  typeof window === 'undefined'
    ? null
    : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;

const join = (base: string, said: string) => [base.trim(), said.trim()].filter(Boolean).join(' ');

const VoiceInputButton: React.FC<{
  /** 지금 입력창에 들어 있는 글자. 듣기 시작할 때의 값 뒤에 들은 말을 이어 붙인다. */
  value: string;
  onText: (text: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  size?: number;
}> = ({ value, onText, onError, disabled = false, size = 40 }) => {
  const Recognition = getRecognition();
  const [listening, setListening] = React.useState(false);
  const recRef = React.useRef<any>(null);
  const baseRef = React.useRef('');
  const valueRef = React.useRef(value);
  valueRef.current = value;

  const stop = React.useCallback(() => {
    try { recRef.current?.stop(); } catch { /* 이미 멈춘 상태 */ }
  }, []);

  // 화면을 떠나거나 입력이 막히면(보내는 중 등) 듣기를 끈다.
  React.useEffect(() => {
    if (disabled) stop();
  }, [disabled, stop]);
  React.useEffect(() => () => {
    try { recRef.current?.abort(); } catch { /* ignore */ }
  }, []);

  if (!Recognition) return null;

  const start = () => {
    const rec = new Recognition();
    rec.lang = 'ko-KR';
    rec.interimResults = true;
    rec.continuous = false;
    baseRef.current = valueRef.current;
    rec.onresult = (e: any) => {
      let said = '';
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
      onText(join(baseRef.current, said));
    };
    rec.onerror = (e: any) => {
      setListening(false);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        onError?.('마이크를 쓸 수 있게 허용해 주세요.');
      } else if (e.error === 'no-speech') {
        onError?.('말소리가 들리지 않았어요. 다시 눌러 말해 주세요.');
      } else if (e.error !== 'aborted') {
        onError?.('음성을 알아듣지 못했어요. 다시 시도해 주세요.');
      }
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => (listening ? stop() : start())}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? '듣는 중이에요. 누르면 멈춰요' : '말로 입력하기'}
      style={{
        flex: 'none', width: size, height: size, borderRadius: size / 2, padding: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        // 듣는 동안은 앱의 AI 아이콘과 같은 검정+노랑으로 켜진 걸 알린다.
        border: listening ? '1px solid #1A1A1E' : '1px solid var(--line-200)',
        background: listening ? '#1A1A1E' : 'var(--surface)',
        color: listening ? '#FFD600' : 'var(--ink-700)',
        boxShadow: listening ? '0 0 0 3px rgba(255,214,0,.45)' : 'none',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
        transition: 'background .15s ease, color .15s ease, box-shadow .15s ease',
      }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" aria-hidden="true"
           stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
      </svg>
    </button>
  );
};

export default VoiceInputButton;
