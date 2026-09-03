import React from 'react';
import CookModeSheet from './CookModeSheet';
import { closeCookMode, subscribeCookMode, CookTarget } from '../utils/cookMode';

/**
 * 요리 모드 시트를 앱에 하나만 띄워 두는 자리.
 *
 * 레시피 카드는 여러 화면에 흩어져 있는데, 시트를 화면마다 두면 같은 코드를
 * 여섯 군데에 적게 된다. 카드는 `openCookMode()` 로 말만 하고 실제로 그리는 건
 * 여기 하나다.
 */
const CookModeHost: React.FC = () => {
  const [target, setTarget] = React.useState<CookTarget | null>(null);

  React.useEffect(() => subscribeCookMode(setTarget), []);

  return (
    <CookModeSheet
      isOpen={!!target}
      onClose={closeCookMode}
      recipeId={target?.id ?? null}
      fallbackTitle={target?.title}
      fallbackLink={target?.link}
      myIngredients={target?.myIngredients}
    />
  );
};

export default CookModeHost;
