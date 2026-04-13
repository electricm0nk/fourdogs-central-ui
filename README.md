# React + TypeScript + Vite

## Chair Sandbox (Desktop Rapid Prototype)

This repo now includes a local chair-phase sandbox route:

- URL: `/sandbox/chair`
- Focus: Kaylee interaction panel, hide/show side panel, always-visible running total,
  dense SKU table for 5,000 SKUs, 250-line order editing, animal filter (`all/dog/cat`),
  and product tabs including `frozen` and `wellness`.

Run locally with hot reload:

```bash
npm run dev
```

Then open:

```text
http://localhost:5173/sandbox/chair
```

### Catalog API Integration

The sandbox supports live catalog mode from the Central API.

Option A: Vite proxy (recommended for local CORS simplicity)

```bash
VITE_KAYLEE_PROXY_TARGET=http://localhost:8090 npm run dev
```

The sandbox can use base path `/kaylee` if you explicitly expose a catalog API there,
but the recommended dev path is `/dev-api/v1` (Central API).

Option B: Direct API base in UI

- In the sandbox side panel, set `Kaylee API Base` to a full URL, for example:
  `https://kaylee-dev.example.com`

The connector attempts common health and catalog paths and normalizes payloads for rapid iteration.

Important separation of concerns:

- Catalog/SKU data for chair sandbox comes from Central API (for example `/v1/items`).
- Kaylee interaction features (analyze/stream/message) are order-scoped workflows and do not own the product catalog.

### Real Dev Database Data

The sandbox can pull real catalog data from the dev database through fourdogs-central `GET /v1/items`.

Start dev server with a dev API proxy target:

```bash
VITE_DEV_API_PROXY_TARGET=https://central-dev.fourdogspetsupplies.com npm run dev
```

Optional override when needed:

```bash
VITE_API_PROXY_TARGET=https://central-dev.fourdogspetsupplies.com npm run dev
```

OAuth return path in local dev:

- `/auth/*` proxy preserves the local host so successful login returns to `http://localhost:5173/`.
- If your OAuth client is not configured to allow localhost callback URLs, use the deployed host login path instead.

In the sandbox panel:

1. Click `Use Dev DB` (sets base to `/dev-api/v1`).
2. Click `Refresh Kaylee`.

Notes:

- This uses the central API as the DB-backed source (browser cannot connect directly to Postgres).
- If the dev API requires auth/session, provide a valid `session_id` cookie value in the sandbox panel.

#### Protected Dev API (session_id)

`/v1/items` in dev is protected by session middleware. For localhost sandbox use:

1. Sign in at `https://central-dev.fourdogspetsupplies.com`.
2. Copy `session_id` cookie value from browser devtools.
3. In sandbox panel, paste it into `Dev session_id`.
4. Keep `Catalog API Base` as `/dev-api/v1` and click `Refresh Kaylee`.

The Vite proxy forwards that value upstream as `Cookie: session_id=<value>`.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
