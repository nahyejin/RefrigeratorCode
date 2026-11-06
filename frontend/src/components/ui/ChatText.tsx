import * as React from 'react';

/**
 * 챗봇 답변 글(쿡 픽·쿡 코치)을 **말머리·굵은 글씨·줄바꿈**으로 그린다(2026-11-06 「줄글로 줄줄 말하지 말고 말머리·# ** ·줄바꿈을 알아서 써 달라」).
 *
 * 마크다운 전체를 읽는 라이브러리가 아니라 **필요한 네 가지만** 직접 읽는다 — LLM 이 쓴 글을 HTML 로 넣지 않으므로(`dangerouslySetInnerHTML`
 * 없음) 글자가 태그로 해석될 길이 없다.
 *   - 빈 줄            → 문단 사이 틈
 *   - `# 제목` `## 제목`   → 굵은 한 줄 제목
 *   - `- 항목` `• 항목` `* 항목`  → 말머리(•) 목록
 *   - `**굵게**`       → 굵은 글씨
 * 그 밖의 줄은 그대로 한 줄. 답을 한 글자씩 내보내는 중이라 `**` 가 닫히기 전에도 그려지는데, 닫히지 않은 `**` 는 지워서 별표가 깜빡이지 않게 한다.
 */
const BULLET = /^\s*(?:[-•·]|\*(?!\*))\s+(.*)$/;
const HEADING = /^\s*#{1,3}\s+(.*)$/;

function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts
    .map((part, i) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) {
        return <b key={`${keyPrefix}-${i}`} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</b>;
      }
      // 닫히지 않은 ** (아직 쓰는 중)는 보이지 않게
      return part.replace(/\*\*/g, '');
    })
    .filter(p => p !== '');
}

const ChatText: React.FC<{ text: string }> = ({ text }) => {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const out: React.ReactNode[] = [];
  let lastWasGap = true;   // 맨 앞의 빈 줄은 그리지 않는다
  lines.forEach((raw, i) => {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) {
      // 연속 빈 줄은 한 번만
      if (!lastWasGap) out.push(<div key={`g${i}`} style={{ height: 6 }} />);
      lastWasGap = true;
      return;
    }
    lastWasGap = false;
    const h = HEADING.exec(line);
    if (h) {
      out.push(<div key={`h${i}`} style={{ fontWeight: 700, margin: '2px 0' }}>{inline(h[1], `h${i}`)}</div>);
      return;
    }
    const b = BULLET.exec(line);
    if (b) {
      out.push(
        <div key={`b${i}`} style={{ display: 'flex', gap: 6, paddingLeft: 2 }}>
          <span aria-hidden style={{ flexShrink: 0 }}>•</span>
          <span style={{ minWidth: 0 }}>{inline(b[1], `b${i}`)}</span>
        </div>,
      );
      return;
    }
    out.push(<div key={`p${i}`}>{inline(line, `p${i}`)}</div>);
  });
  return <>{out}</>;
};

export default ChatText;
