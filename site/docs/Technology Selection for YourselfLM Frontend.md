<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Technology Selection for YourselfLM Frontend

Primary recommendation: Build the frontend with React + TypeScript, Vite, and modern browser APIs (SSE, Web Workers) to meet real-time conversational UX, behavioral telemetry, dynamic UI injection, SVG visualization/download, and future multimodal readiness. Use a component library and state/streaming utilities to accelerate robust implementation while keeping the stack lean and locally debuggable.

Executive summary:

- Framework: React + TypeScript with Vite bundling for performance and developer velocity.
- Real-time streaming: Native Server-Sent Events via EventSource with resilient stream parsing utilities.
- Behavioral telemetry: Custom instrumentation hooks for typing speed, pauses, and correction events; persisted via REST.
- Dynamic UI: JSON-instructed component rendering with a safe schema (Zod) and sandboxed template rendering.
- Data visualization: SVG-first using D3 + React hooks; easy client-side export with Blob and URL APIs.
- Feedback workflow: Dedicated UI components that call a feedback REST endpoint; optimistic updates for trust.
- Future multimodal: WebRTC, MediaDevices getUserMedia, Web Audio API, and Web Workers for on-device pre-processing; ready for later backend integration.
- Security and privacy: CSP, Trusted Types, DOMPurify for any HTML, strict TypeScript types for API contracts, Feature Policy to constrain camera/mic, user-consent gating.

Below is a detailed, requirement-aligned selection.

Section 1. Core framework and tooling

- React + TypeScript
    - Rationale: Mature ecosystem, component-driven UI, strong type safety for evolving APIs, excellent SSE and SVG support, large hiring pool.
- Vite
    - Rationale: Fast dev server, instant HMR, optimized builds; simpler than Webpack for greenfield.
- State management
    - React Query (TanStack Query) for server state: caching, mutation, retries, request dedupe.
    - Zustand or Redux Toolkit for UI/behavioral local state: small, predictable, SSR-friendly if needed later.
- Styling
    - Tailwind CSS for design velocity and consistent design tokens, or CSS Modules if preferred.
    - Headless UI or Radix Primitives for accessible components without heavy styling opinions.
- Form handling
    - React Hook Form + Zod for schema validation, especially for the feedback form and dynamic controls.

Section 2. API communication, streaming, and resilience

- REST over HTTPS for standard endpoints (FastAPI backend).
- Server-Sent Events (SSE) for response streaming
    - Browser EventSource for SSE consumption.
    - Fallback: fetch + ReadableStream if custom protocol is needed (optional).
    - Utility: A small parser to handle message framing, partial chunks, and backend “control” events (e.g., to inject dynamic buttons).
- AbortController for prompt cancellation and resource cleanup.
- Backoff strategies and error boundaries
    - React Query retry/backoff for REST calls; custom retry or reconnect for SSE with jitter.
- Protocol conventions
    - Adopt lightweight SSE event schema: event: token, event: done, event: ui_action, with data as JSON strings. Type-check with Zod on the client.

Section 3. Behavioral telemetry (迷い度/degree of hesitation)

- Instrumentation targets
    - Textarea/Editor component capturing: keydown/up timestamps, input events, debounced per-interval typing speed (chars/sec), pause durations, and deletion/correction events (Backspace/Delete runs, selection-replace).
- Implementation approach
    - Custom React hook useTypingTelemetry that:
        - Tracks event timestamps in-memory.
        - Aggregates per message into a normalized metrics payload: total time, active typing time, pause histogram, backspace ratio, edit bursts.
        - Sends metrics alongside the user’s prompt via POST to the backend, or as a separate endpoint for analytical decoupling.
- Performance
    - Use requestIdleCallback or throttled timers to batch telemetry; avoid flooding the backend.

Section 4. Chat UI and streaming response

- Components
    - MessageInput: large textarea with telemetry hook, send button, Enter-to-send with Shift+Enter for newline.
    - MessageList: virtualized list (React Virtual) if long; maintains chronological transcript.
    - StreamingMessage: renders tokens as they arrive; shows cursor/typing indicator; supports interruption via AbortController.
- SSE handling
    - EventSource listener mapping event types:
        - token: append to active message buffer.
        - done: finalize render, flush metrics.
        - ui_actions: inject dynamic interactive elements (buttons/options) into the message block.
    - Accessibility: Announce new tokens in polite ARIA live regions; allow pause/resume autoscroll.

Section 5. Dynamic interactive elements (server-driven UI)

- Payload schema
    - Define a strict schema for UI instructions, e.g.:
{
type: "buttons",
actions: [{ id: string, label: string, payload?: any }]
}
    - Validate with Zod upon receipt to prevent malformed UI or injection.
- Rendering
    - Map schema to React components; never inject raw HTML into the DOM.
    - For complex future elements (sliders, select menus), extend the schema version (e.g., ui_schema_version).
- Action handling
    - Each button triggers a typed client-side handler that POSTs a structured payload back to a specific endpoint or restarts the SSE conversation with those parameters.

Section 6. User feedback mechanism (“This doesn’t feel right”)

- UI workflow
    - Each AI analysis/summary card includes a “This doesn’t feel right” button.
    - Clicking opens a modal or inline form with:
        - Free-text correction.
        - Optional structured tags (e.g., “tone”, “trait misclassification”, “context missing”).
        - Optional severity/impact.
    - Submit via REST to a dedicated endpoint; show optimistic confirmation, then reconcile on server response.
- Data integrity
    - Validate input (length limits, profanity filtering if desired).
    - Link feedback to the source message/analysis ID and user session ID.
- Storage/telemetry
    - Log feedback events to a separate analytics path to drive model alignment and PersonData updates.

Section 7. Data visualization (SVG-first with export)

- Libraries
    - D3.js for data transforms and scales; use React + D3 integration patterns (compute with D3, render via JSX).
    - Alternatively, Recharts or Visx for faster delivery if the visualizations are standard (bars, lines, radars) while still outputting as SVG.
- SVG rendering
    - Fully responsive viewBox-based layouts; CSS variables for theming.
    - Tooltips via accessible overlays; keyboard navigation for focusable data points.
- SVG download
    - Use the reference downloadSvg approach:
        - Serialize the SVG element with XMLSerializer.
        - Prepend XML and inline computed styles if needed.
        - Create a Blob of type image/svg+xml; use URL.createObjectURL for an <a download> trigger with user-specified filename.
    - Provide a user input to name the file; sanitize filename before saving.

Section 8. Privacy, security, and trust

- Content Security Policy (CSP) and Trusted Types to mitigate XSS; no unsafe-inline scripts in production.
- Sanitize any server-provided text that might be rendered as HTML using DOMPurify (prefer rendering as text nodes).
- Do not render arbitrary HTML from backend instructions; use typed component schema only.
- Network security: HTTPS, secure cookies (if used), CSRF tokens for state-changing endpoints, same-site Lax/Strict as appropriate.
- Permissions and consent
    - For future webcam/mic: explicit in-UI consent gates, clear indicators when active, easy one-click disable.
    - Use Feature Policy/Permissions Policy headers to limit camera/mic/geolocation to required contexts only.
- Telemetry transparency
    - Show a privacy panel explaining what typing metrics are collected and why; provide opt-out if policy requires.

Section 9. Performance and UX quality

- Streaming-first UX
    - Immediate UI feedback on send; skeleton for incoming AI message; token-by-token streaming for trust.
- Code-splitting via Vite dynamic imports; prefetch critical routes/components.
- Web Workers
    - Offload heavy client-side parsing or future on-device feature extraction (e.g., audio features) to Workers to keep UI responsive.
- Accessibility
    - WAI-ARIA roles for chat, live regions for streamed tokens, keyboard navigation for dynamic actions, color contrast compliance.

Section 10. Future multimodal readiness

- Camera and mic capture
    - MediaDevices.getUserMedia for video/audio streams.
    - WebRTC for low-latency streaming to backend if required later.
- Audio processing
    - Web Audio API to capture PCM, compute basic features (e.g., volume, pitch proxy) in a Worker; forward to backend as needed.
- Video processing
    - OffscreenCanvas + WebCodecs or WebGL for frame sampling; send to backend via WebRTC DataChannel or batched REST/SSE side-channel.
- Model-running client-side (optional)
    - For purely local analysis prototypes: WebAssembly + WebGPU/WebNN-backed libraries (e.g., ONNX Runtime Web, Transformers.js) if privacy or offline modes are desired. Keep this optional to avoid complexity now.

Section 11. Testing, observability, and tooling

- Testing
    - Vitest + Testing Library for unit/integration.
    - Playwright for E2E, including SSE and interactive UI flows.
- Logging/monitoring
    - Client-side analytics for UX events (non-PII by default), error reporting via Sentry.
    - Feature flags via simple environment toggles or a lightweight service for gradual rollout.
- Type-safe API contracts
    - OpenAPI generator to create TypeScript client types from FastAPI OpenAPI spec; reduces drift and runtime errors.

Concrete technology list

- Core: React 18+, TypeScript 5+, Vite.
- State: React Query, Zustand or Redux Toolkit.
- Validation: Zod, React Hook Form.
- Styling/UI: Tailwind CSS, Radix UI/Headless UI.
- Streaming: EventSource API; optional fetch streams.
- Visualization: D3.js with React; or Visx/Recharts for speed.
- Sanitization/Security: DOMPurify, CSP, Trusted Types, Helmet on server.
- Testing: Vitest, React Testing Library, Playwright.
- DevX: ESLint, Prettier, OpenAPI TS codegen.
- Future multimodal: MediaDevices, WebRTC, Web Audio API, Web Workers, OffscreenCanvas/WebCodecs; optional ONNX Runtime Web or Transformers.js for local inference.

Mapping to requirements

- 3.1 Main Conversational Interface: React components for input and message list; EventSource for SSE streaming; dynamic server-instructed buttons via validated schemas; full telemetry capture via custom hooks.
- 3.2 User Feedback Mechanism: Dedicated “This doesn’t feel right” control per AI analysis, modal form with Zod validation, POST to feedback endpoint, optimistic UI confirmation.
- 3.3 Data Visualization: SVG via React+D3/Visx; client-side download using Blob and URL APIs replicating the reference downloadSvg pattern with filename input.
- 2.2 Tech Stack compatibility: Works with FastAPI REST; llama.cpp-compatible backend; SSE-first rendering.
- 4.1 Multimodal Input Analysis: Future additions enabled by MediaDevices, WebRTC, Web Audio API, Workers, and optional WebGPU/WASM paths.

Implementation notes and code-shape sketches

- SSE consumption pattern (TypeScript)

```typescript
const connectSSE = (url: string, onEvent: (type: string, data: any) => void) => {
  const es = new EventSource(url, { withCredentials: true });
  es.addEventListener("token", (e) => onEvent("token", JSON.parse((e as MessageEvent).data)));
  es.addEventListener("done", () => onEvent("done", null));
  es.addEventListener("ui_actions", (e) => onEvent("ui_actions", JSON.parse((e as MessageEvent).data)));
  es.onerror = () => { es.close(); /* backoff + reconnect if desired */ };
  return () => es.close();
};
```

- Typing telemetry hook outline

```typescript
function useTypingTelemetry() {
  const [stats] = React.useState(() => ({
    startedAt: 0,
    lastEventAt: 0,
    charCount: 0,
    backspaces: 0,
    pauses: [] as number[],
  }));
  const onFocus = () => { if (!stats.startedAt) stats.startedAt = performance.now(); stats.lastEventAt = performance.now(); };
  const onInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const now = performance.now();
    const dt = now - stats.lastEventAt;
    if (dt > 1500) stats.pauses.push(dt);
    stats.lastEventAt = now;
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Backspace" || e.key === "Delete") stats.backspaces++;
  };
  const finalize = (text: string) => ({
    durationMs: performance.now() - stats.startedAt,
    backspaces: stats.backspaces,
    pauses: stats.pauses,
    length: text.length,
  });
  return { onFocus, onInput, onKeyDown, finalize };
}
```

- SVG download utility

```typescript
export function downloadSvg(svg: SVGSVGElement, filename: string) {
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svg);
  const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${source}`], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".svg") ? filename : `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

Project scaffolding suggestion

- Monorepo (optional): pnpm workspaces with frontend and a shared types package generated from FastAPI’s OpenAPI spec.
- Environments: .env files for API base URL and SSE endpoints; versioned with example templates.
- CI: Type checks, lint, unit tests, E2E on PR.

This stack keeps the frontend modern, fast, and secure; integrates cleanly with FastAPI and SSE; provides robust UX for conversational streaming and corrective feedback; supports SVG visualization and export; and is ready for multimodal extensions without premature complexity.

