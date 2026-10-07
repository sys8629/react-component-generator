---
name: create-pr
description: 현재 브랜치의 변경사항을 분석해 저장소 언어(한국어/영어)에 맞는 템플릿으로 Pull Request를 생성한다. "PR 만들어줘", "풀리퀘스트 생성", "create pr", "open a pull request" 같은 요청에 활성화한다.
context: fork
allowed-tools: Read, Glob, Grep, Bash
---

# Create PR

현재 브랜치에서 base 브랜치로 향하는 Pull Request를 생성한다. 템플릿은 언어별로 `reference/pr-template.ko.md`(한국어), `reference/pr-template.en.md`(영어)에 분리되어 있다.

## 절차

### 1. 사전 확인
- `git rev-parse --is-inside-work-tree`로 저장소 여부를 확인한다. 아니면 알리고 종료한다.
- `gh auth status`로 GitHub CLI 로그인을 확인한다. 안 되어 있으면 `! gh auth login` 실행을 안내하고 종료한다.
- `git branch --show-current`가 base 브랜치(`gh repo view --json defaultBranchRef -q .defaultBranchRef.name`)와 같으면 PR을 만들 수 없다고 알리고 종료한다.
- `git status --short`에 커밋되지 않은 변경이 있으면 PR에 포함되지 않음을 결과에 명시한다. 대신 커밋하지 않는다.
- 같은 브랜치의 열린 PR이 있는지 `gh pr list --head <브랜치> --state open`으로 확인한다. 있으면 그 URL을 알리고 종료한다.

### 2. 언어 결정
- `gh repo view --json name -q .name`으로 저장소 이름을 얻는다.
- 저장소 이름이 아래 한국어 저장소 목록에 있으면 `reference/pr-template.ko.md`, 없으면 `reference/pr-template.en.md` 하나만 Read로 읽어 사용한다. 다른 언어 파일은 읽지 않는다.
  - 한국어 저장소 (`owner/repo`의 `repo` 부분으로 비교): `react-component-generator`
  - 새 한국어 저장소는 이 목록에 한 줄씩 추가한다.
- 이 규칙을 임의로 바꾸지 않는다. 사용자가 인자로 언어를 명시한 경우(`ko`/`en`)에만 그 값을 우선한다.

### 3. 변경사항 분석
- `git log <base>..HEAD --format='%h %s%n%b'`로 커밋 목록을 읽는다.
- `git diff <base>...HEAD --stat`과 필요한 파일의 `git diff <base>...HEAD -- <파일>`로 실제 변경을 확인한다.
- 커밋 메시지만 믿지 말고 diff로 검증한다. 변경이 없으면 알리고 종료한다.
- `.env`, 키, 토큰 등 비밀 값이 diff에 있으면 PR을 만들지 않고 알린다.

### 4. 제목과 본문 작성
- 선택한 템플릿의 제목 규칙과 본문 섹션을 그대로 따른다. 섹션을 삭제하거나 추가하지 않는다.
- 변경 사항은 diff에서 확인한 내용만 적는다. 추측하지 않는다.
- 테스트 체크박스는 실제로 실행해 통과를 확인한 항목만 체크한다. 실행하지 않았으면 비워 둔다. 실행 가능하면 프로젝트 명령(`bun run test`, `bun run lint`, `bun run build`)을 돌려 확인한다.
- 본문을 HEREDOC 또는 임시 파일(`--body-file`)로 전달해 줄바꿈과 백틱이 깨지지 않게 한다.

### 5. 푸시 및 PR 생성
- 원격에 브랜치가 없거나 뒤처져 있으면 `git push -u origin <브랜치>`로 푸시한다. `--force`는 쓰지 않는다.
- `gh pr create --base <base> --head <브랜치> --title "<제목>" --body-file <파일>`로 생성한다. 사용자가 `draft`를 요청하면 `--draft`를 붙인다.
- 생성 후 PR URL과 사용한 언어, 제목을 보고한다. 임시 파일은 삭제한다.

## 금지 사항
- base 브랜치에서 직접 PR을 만들지 않는다.
- `--force`, `--no-verify` 등 이력을 바꾸거나 훅을 건너뛰는 옵션을 쓰지 않는다.
- 커밋, 리베이스, 병합을 하지 않는다. 이 스킬은 현재 상태 그대로 PR만 만든다.
- 선택한 템플릿 파일과 다른 언어로 본문을 쓰지 않는다.
