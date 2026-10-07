# AGENTS.md

## Operational Commands

- 패키지 매니저는 `bun` 고정 (`bun.lock` 사용). npm/yarn/pnpm 사용 금지.
- 개발 서버(API + Vite): `bun run dev`
- API 서버만: `bun run server` (포트 3002)
- 테스트: `bun run test` (vitest). `bun test`(Bun 내장 러너)는 jsdom/setup 설정을 읽지 않으므로 사용 금지.
- 단일 테스트: `bun run test -- server/generator.test.ts`
- 린트: `bun run lint`
- 빌드/타입체크: `bun run build` (`tsc -b && vite build`)
- 작업 완료 전 `bun run lint`, `bun run test`, `bun run build` 통과를 확인한다.

## Golden Rules

### Immutable

- API 키 값을 클라이언트 응답, 로그, 에러 메시지에 노출하지 않는다. `/api/config`는 불리언만 반환한다 (`server/index.ts:147-157`). 환경 키는 서버의 `ENV_KEYS`에만 둔다 (`server/index.ts:59-62`).
- 사용자 입력 키는 요청 body로만 서버에 전달한다. 사용자 요청에 따라 클라이언트 localStorage(`rcg:apiKey`, `src/App.tsx`)에 평문 저장되므로 로그, URL, 에러 메시지에 출력하지 않고 localStorage 키 외의 저장소에 복제하지 않는다.
- localStorage 키는 `rcg:` 접두사를 쓴다 (`apiKey`, `provider`, `history`, `components`). 저장값은 `useLocalStorage`의 `revive`로 검증해 형식이 깨졌으면 초기값으로 복구한다.
- `.env`는 커밋하지 않는다 (`.gitignore`).

### Do's and Don'ts

- 생성 코드는 react-live `noInline` 모드로 실행된다 (`src/components/LivePreview.tsx:71`). `render(<Component />)` 호출이 없으면 미리보기가 그려지지 않는다.
- 시스템 프롬프트의 출력 규칙(import 금지, 인라인 스타일, TS 문법 금지, 펜스 금지, `render()` 호출 — `server/index.ts:7-20`)을 바꾸면 후처리(`server/generator.ts`)와 `LivePreview`가 함께 깨질 수 있다. 같이 검토한다.
- 같은 위험을 프롬프트와 후처리가 이중으로 막는다: 코드펜스는 프롬프트(`server/index.ts:16`)와 `stripCodeFences`(`server/generator.ts:227`), render 호출은 프롬프트(`server/index.ts:12`)와 `ensureRenderCall`(`server/generator.ts:238`). 한쪽만 제거하지 않는다.
- 서버 에러 상태 매핑은 에러 메시지의 `'503'`/`'429'` 문자열 포함 여부에 의존한다 (`server/index.ts:194-206`). 새 provider 호출부는 `... error: ${response.status}` 형태로 상태 코드를 메시지에 포함해야 한다 (`server/index.ts:85`, `server/index.ts:112`).
- 포트 3002는 서버(`server/index.ts:139`)와 Vite 프록시(`vite.config.ts:12`)에 각각 하드코딩되어 있다. 변경 시 두 곳을 함께 수정한다.
- `Provider` 타입은 `src/types/index.ts:1`과 `server/index.ts:57`에 각각 정의되어 있다. provider를 추가하면 양쪽과 `ENV_KEYS`를 모두 갱신한다.

### Test Boundary

- 단위 테스트 대상은 순수 함수(`server/generator.ts`, `server/fallback.ts`)와 `src/components/PromptInput.tsx`뿐이다. `server/index.ts`(`Bun.serve` 부수효과)와 `useComponentGenerator`에는 테스트가 없다.
- 서버 로직을 추가할 때는 `index.ts`에 넣지 말고 부수효과 없는 모듈로 분리해 `*.test.ts`를 함께 작성한다 (`server/generator.ts:1-2` 주석 참조).
- 테스트 파일 위치는 `vite.config.ts`의 `test.include`(`src/**`, `server/**`)를 따른다.

## Project Context

프롬프트를 받아 AI가 React 컴포넌트 코드를 생성하고 react-live로 미리보기하는 도구.

Tech Stack: React 19, TypeScript, Vite, react-live, Bun(`Bun.serve` 프록시), Vitest, ESLint, Anthropic/Google Gemini API.

## Standards and References

- 프로젝트 소개/실행 방법: `README.md`
- 커밋 메시지: 한국어, `type: 설명` 형식 (`feat`, `chore` 등). 변경을 논리 단위로 나눠 커밋한다.
- 서버 전용 규칙: `server/AGENTS.md`

## Maintenance Policy

규칙과 코드 사이에 괴리(파일 이동, 라인 변경, 규칙 위반 필요)가 발견되면 작업을 마치기 전에 이 파일의 갱신을 제안한다.
