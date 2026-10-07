# server/AGENTS.md

## Module Context

Bun 런타임에서 실행되는 AI API 프록시. 프론트엔드(`/api/*` Vite 프록시)와 Anthropic/Gemini 사이를 중계한다.

## Tech Stack and Constraints

- 런타임은 Bun 전용 (`Bun.serve`, `process.env`). Node 전용 API나 Express 등 서버 프레임워크를 추가하지 않는다.
- 외부 API 호출은 SDK 없이 전역 `fetch`를 사용한다 (`index.ts:69`, `index.ts:101`). 이 패턴을 유지한다.
- 서버 코드는 `src/` 코드를 import하지 않는다. 타입이 필요하면 `index.ts:57`처럼 로컬 정의한다.

## Implementation Patterns

- 순수 로직은 `generator.ts`/`fallback.ts`처럼 부수효과 없는 모듈로 분리하고 같은 이름의 `*.test.ts`를 둔다.
- 모든 응답에 `CORS_HEADERS`를 포함한다 (성공, 400, 429, 503, 500, 404 모두 — `index.ts:155-217`).
- 신규 provider 추가 순서: `Provider` 타입 → `ENV_KEYS` → `call<Provider>` 함수 → `/api/generate` 분기 → `/api/config`의 `envKeys`.

## Testing Strategy

- `bun run test -- server/` 로 서버 테스트만 실행한다.
- `withModelFallback`처럼 실패 경로가 있는 로직은 성공/폴백/전체 실패/빈 목록 케이스를 모두 테스트한다 (`fallback.test.ts` 참조).

## Local Golden Rules

- Gemini 호출 URL에 API 키가 쿼리스트링으로 포함된다 (`index.ts:99`). 이 URL이나 이를 포함한 에러 객체를 로그/응답에 출력하지 않는다.
- 모델 폴백과 `MAX_TOKENS` 절단 검사는 Google 경로에만 존재한다 (`index.ts:5`, `index.ts:123`, `index.ts:135`). Anthropic 경로는 단일 모델 고정(`index.ts:77`)이며 비대칭이 의도된 상태인지 확인하지 않고 한쪽에 맞춰 통일하지 않는다.
- `withModelFallback`은 모든 에러(인증 실패 포함)에서 다음 모델로 넘어가고 마지막 에러만 던진다 (`fallback.ts:10-16`). 에러 종류별 분기가 필요하면 이 함수가 아니라 `attempt` 콜백 안에서 처리한다.
- `ensureRenderCall`의 컴포넌트 탐지는 대문자로 시작하는 첫 `const|function` 선언만 대상으로 한다 (`generator.ts:241`). 정규식 변경 시 `generator.test.ts` 케이스를 함께 갱신한다.
