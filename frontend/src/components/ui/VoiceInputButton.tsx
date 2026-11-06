import * as React from 'react';

/**
 * 말로 입력하는 마이크 버튼. 눌러서 켜고, 다시 누르면 멈춘다.
 *
 * 왜 만들었나(2026-11-06): 요리하는 중이거나 손이 젖었을 때, 두 AI 채팅창(쿡 픽·AI 식단 추천)과 요리 한 건 전용 도우미(쿡 코치)에서
 * 글자를 치기 어렵다는 요청. 입력창이 같은 모양이라 버튼을 하나로 만들어 같이 쓴다.
 *
 * **들은 말은 입력창에 채우기만 한다. 보내기는 직접 누른다** — 잘못 알아들은 말이 자동으로 나가면 크레딧이 나간다.
 * 듣는 동안은 말이 들리는 대로 입력창이 바뀌고(`interimResults`), 멈추면 마지막 글자가 남는다.
 *
 * 브라우저가 음성인식을 지원하지 않으면 **버튼 자체를 그리지 않는다**(눌러도 아무 일도 없는 버튼을 두지 않는다).
 * 설치 앱의 웹뷰(안드로이드 WebView·iOS WKWebView)는 지원하지 않아서 앱에서는 아직 안 보인다 — 앱은 음성인식 플러그인과
 * 마이크 권한을 넣은 빌드가 따로 필요하다.
 *
 * **켜진 채로 안 꺼지던 문제(2026-11-06 사용자 보고).** 일부 환경(Electron 기반 앱·마이크가 막힌 브라우저)은 음성인식 객체는 있는데
 * `start()` 를 불러도 **아무 이벤트도 안 오고 오류도 없다.** 예전 코드는 「끝났다」는 신호(`onend`)가 와야 꺼진 걸로 쳐서, 버튼은
 * 켜진 색으로 굳고 다시 눌러도(`stop()` 도 신호가 안 옴) 해제가 안 됐다. 그래서
 *  1) 다시 누르면 **신호를 기다리지 않고 바로** 꺼진 상태로 돌아가고,
 *  2) 켠 뒤 **시작 신호가 한참 안 오면** 이 환경에서는 안 되는 것으로 보고 끄고 안내한다(마이크 허용창이 떠 있을 때는 오래 기다린다).
 */
const getRecognition = (): any =>
  typeof window === 'undefined'
    ? null
    : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;

const join = (base: string, said: string) => [base.trim(), said.trim()].filter(Boolean).join(' ');

/** 시작 신호를 기다리는 시간. 마이크 허용창이 떠 있으면 사람이 고르는 시간을 더 준다. */
const WAIT_START_MS = 5000;
const WAIT_START_PROMPT_MS = 25000;

const VoiceInputButton: React.FC<{
  /** 지금 입력창에 들어 있는 글자. 듣기 시작할 때의 값 뒤에 들은 말을 이어 붙인다. */
  value: string;
  onText: (text: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  size?: number;
  /** 처음 그려질 때 바로 듣기 시작한다(다른 곳의 마이크를 눌러 이 입력창이 열린 경우). */
  autoStart?: boolean;
}> = ({ value, onText, onError, disabled = false, size = 40, autoStart = false }) => {
  const Recognition = getRecognition();
  const [listening, setListening] = React.useState(false);
  const recRef = React.useRef<any>(null);
  const baseRef = React.useRef('');
  const valueRef = React.useRef(value);
  valueRef.current = value;
  const watchRef = React.useRef<number | null>(null);

  const clearWatch = () => {
    if (watchRef.current !== null) {
      window.clearTimeout(watchRef.current);
      watchRef.current = null;
    }
  };

  const stop = React.useCallback(() => {
    clearWatch();
    // 「끝났다」는 신호(onend)를 기다리지 않는다 — 신호가 안 오는 환경이 있다.
    setListening(false);
    const rec = recRef.current;
    recRef.current = null;
    if (!rec) return;
    try { rec.stop(); } catch { /* 이미 멈춘 상태 */ }
    // stop() 은 마지막 말을 마저 넘겨 주려고 잠깐 더 기다린다. 그래도 안 끝나면 끊는다.
    window.setTimeout(() => { try { rec.abort(); } catch { /* ignore */ } }, 1500);
  }, []);

  // 화면을 떠나거나 입력이 막히면(보내는 중 등) 듣기를 끈다.
  React.useEffect(() => {
    if (disabled) stop();
  }, [disabled, stop]);
  React.useEffect(() => () => {
    clearWatch();
    try { recRef.current?.abort(); } catch { /* ignore */ }
  }, []);

  const startRef = React.useRef<(() => void) | null>(null);
  const autoRef = React.useRef(autoStart);
  React.useEffect(() => {
    if (autoRef.current && !disabled) {
      autoRef.current = false;
      startRef.current?.();
    }
  }, [disabled]);

  if (!Recognition) return null;

  const start = () => {
    if (recRef.current) stop();
    const rec = new Recognition();
    rec.lang = 'ko-KR';
    rec.interimResults = true;
    rec.continuous = false;
    baseRef.current = valueRef.current;
    rec.onstart = () => clearWatch();
    rec.onaudiostart = () => clearWatch();
    rec.onresult = (e: any) => {
      clearWatch();
      let said = '';
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
      onText(join(baseRef.current, said));
    };
    rec.onerror = (e: any) => {
      clearWatch();
      if (recRef.current === rec) recRef.current = null;
      setListening(false);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        onError?.('마이크를 쓸 수 있게 허용해 주세요.');
      } else if (e.error === 'no-speech') {
        onError?.('말소리가 들리지 않았어요. 다시 눌러 말해 주세요.');
      } else if (e.error === 'network') {
        onError?.('음성 인식 서버에 연결하지 못했어요. 인터넷 연결을 확인하거나 글자로 적어 주세요.');
      } else if (e.error !== 'aborted') {
        onError?.('음성을 알아듣지 못했어요. 다시 시도해 주세요.');
      }
    };
    rec.onend = () => {
      clearWatch();
      if (recRef.current === rec) recRef.current = null;
      setListening(false);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
      setListening(false);
      return;
    }

    // 시작 신호가 안 오면(음성인식 객체만 있고 실제로는 안 되는 환경) 켜진 채로 굳지 않게 끈다.
    void (async () => {
      let state = 'unknown';
      try {
        const p = await (navigator as any).permissions?.query({ name: 'microphone' });
        if (p?.state) state = p.state;
      } catch { /* 권한 조회를 못 하는 환경 */ }
      if (recRef.current !== rec) return;
      watchRef.current = window.setTimeout(() => {
        if (recRef.current !== rec) return;
        stop();
        onError?.('이 화면에서는 음성 입력이 안 돼요. 크롬이나 사파리에서 열거나 글자로 적어 주세요.');
      }, state === 'prompt' ? WAIT_START_PROMPT_MS : WAIT_START_MS);
    })();
  };
  startRef.current = start;

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
