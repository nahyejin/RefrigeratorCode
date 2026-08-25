import * as React from 'react';
import { createPortal } from 'react-dom';

/**
 * 자식을 document.body 로 옮겨 렌더링한다.
 *
 * 왜 필요한가:
 *  position:sticky / transform / filter 등이 걸린 조상은 새 "스택 맥락"을 만든다.
 *  그 안에서 렌더된 모달은 z-index 를 아무리 높여도 **그 조상의 층위 안에서만** 높을 뿐이라,
 *  바깥의 헤더·하단 네비보다 위로 올라갈 수 없다.
 *  실제로 필터 모달이 sticky 필터바(z:100) 안에서 렌더되는 바람에
 *  z-index 를 600 으로 올려도 헤더/네비(200) 아래에 깔려 있었다.
 *  모달을 body 직속으로 옮기면 이 문제가 근본적으로 사라진다.
 */
const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};

export default Portal;
