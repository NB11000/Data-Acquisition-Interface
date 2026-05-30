## Agent skills

### Issue tracker

Issues are tracked as local markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles use their default names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Project

React 19 + TypeScript 6 + Vite 8 + Ant Design 6 + ECharts 6 + MQTT + Zustand 5. Package manager is **pnpm** (lockfile is `pnpm-lock.yaml`). No README, no ESLint, no Prettier, no CI.

### Commands

```
pnpm dev          # Vite dev server (HMR)
pnpm build        # tsc typecheck → vite build
pnpm preview      # serve dist/
pnpm test         # vitest run (src/**/*.test.ts)
pnpm test:watch   # vitest watch
```

Build runs `tsc` before `vite build` — type errors block the build.

### Architecture

**Single-page app** — React Router v7, flat route table in `src/App.tsx`. All pages render inside `<AppLayout>` which mounts `useMqttConnect()` once (the single MQTT connection hook). No SSR, no code splitting.

**Mock / Real DI** — `VITE_MQTT_MODE` in `.env` (`mock` | `real`) selects the client factory in `src/mqtt/client.ts`. No `if (mock)` branches in app code; the factory just instantiates different classes. `.env` is gitignored — must be recreated after clone.

**Zustand stores** (7 separate slices):
- `deviceStore` — device list, selected ID, online status, search text
- `mqttStore` — connection state, will message flag
- `collectorStore` / `laserStore` — hardware state from RPC responses
- `waveformStore` / `dataStore` — streaming data buffers (waveform + lowfreq)
- `alarmStore` — device alarms

Stores outside React call `.getState()` (e.g. `useDeviceStore.getState().setOnline(...)`).

**MQTT singleton** — Module-level `let client` in `src/mqtt/client.ts`, survives React StrictMode double-mount. `getMqttClient()` throws if not initialized; prefer `getMqttClientSafely()` in hooks that may unmount/remount.

**Single onMessage router** — `src/mqtt/router.ts` `setupMqttRouter()` sets ONE callback. Priority: `$SYS` → RPC resolution → waveform → state_changed → will → alarm → lowfreq.

### Context vs code

`CONTEXT.md` describes a **planned multi-server connection-pool architecture** (MqttServer + Device separation). The **current code** still uses the flat per-device model (each Device carries its own `brokerUrl`/`port`/`username`/`password`) with a single MQTT connection. ADRs in `docs/adr/` track the migration path. When reading specs or issues, verify which model they target.

### Conventions

- **CSS Modules** — `*.module.css` imported as `import styles from './Foo.module.css'`; global styles in `src/assets/styles/`
- **Path alias** — `@` → `/src` (Vite only; NOT in tsconfig.json, so IDE may flag unresolved imports)
- **Dark theme** — Detected via `body.dark-theme` class + MutationObserver + Ant Design `ConfigProvider`
- **TypeScript strict** — `tsconfig.json` has `"strict": true`

### Mock mode gotchas

Mock waveform/lowfreq generators only start when ALL three conditions hold: `mqttConnected === true` AND `selectedId !== null` AND `deviceOpened && acquiring` (collector store). RPC `SYSTEM_STATE` on device switch sets the collector/laser state; mock generators then react to that state.

### Environment variables (.env)

```
VITE_MQTT_MODE=mock|real
VITE_BROKER_URL=mqtts://host:port
VITE_BROKER_USERNAME=...
VITE_BROKER_PASSWORD=...
VITE_DEFAULT_MACHINE_ID=...
```

Accessed via `src/env.ts` (`import.meta.env.VITE_*`).

### Tests

Vitest is configured (`src/**/*.test.ts`) but **no test files exist yet**. Test infrastructure is in place — write tests under `src/` alongside the code they test.
