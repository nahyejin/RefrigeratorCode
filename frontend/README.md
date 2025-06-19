# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```

## 2024-06-09 인기 급상승 상세 필터링 동작 변경

- 인기 급상승 **재료 Top10** 클릭 시:
  - 해당 재료명 또는 동의어가 `used_ingredients`(실제 사용된 재료)에 포함된 레시피만 보여줍니다.
  - 제목/본문에 단순히 포함된 경우는 제외합니다.

- 인기 급상승 **테마 Top10** 클릭 시:
  - 해당 테마명(키워드) 또는 동의어가 레시피의 제목/본문에 **2번 이상 등장**하는 경우에만 해당 레시피를 보여줍니다.
  - 1번만 등장하는 경우는 제외합니다.

- '특정 재료·테마 등 키워드로 찾아보기' 검색창에서 키워드를 입력해도, 해당 키워드가 레시피의 제목/본문에 **2번 이상 등장**하는 경우에만 결과가 노출됩니다. (테마 Top10 클릭과 동일한 기준)

- 이 동작은 `/ingredient/:name` 경로에서 자동으로 적용됩니다.
