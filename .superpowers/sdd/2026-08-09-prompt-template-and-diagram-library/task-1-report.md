# Task 1 — Prompt catalog schema and safe loader

## 구현 내용

- 9개 shard를 고정 순서로 참조하는 canonical catalog index를 추가했다.
- index와 entry 모두 알 수 없는 필드를 거부하는 JSON Schema 2020-12 계약을 추가했다.
- shard/index의 symlink·경로 이탈·중복 정규화 경로를 차단하는 loader를 구현했다.
- loader는 실제 제품 inventory, 역할 registry, use-case manifest를 읽어 skill, intermediate template, role, use-case 참조와 App/CLI namespace를 검증한다.
- validator는 146개 종류별 집계, NFC 중복 ID, 5개 사용자용 text block 중복, unsafe path, credential/API key/개인정보/비공개 자료 요청을 거부한다.
- product별 projection API를 제공했다.

## 변경 파일

- `guides/prompt-templates/catalog.json`
- `guides/prompt-templates/catalog.schema.json`
- `tooling/lib/prompt-template-catalog.mjs`
- `tests/unit/prompt-template-catalog.test.mjs`

## RED / GREEN 증거

- RED: `node --test tests/unit/prompt-template-catalog.test.mjs`
  - `ERR_MODULE_NOT_FOUND`: `tooling/lib/prompt-template-catalog.mjs` 부재를 확인했다.
- RED (template 참조): 같은 명령에서 `true !== false`로 미등록 intermediate template이 아직 허용됨을 확인했다.
- RED (재개 text 중복): 같은 명령에서 `true !== false`로 resume prompt 중복이 아직 허용됨을 확인했다.
- GREEN: `node --test tests/unit/prompt-template-catalog.test.mjs`
  - 5 tests, 5 pass, 0 fail.
- 회귀: `npm run test:unit`
  - 421 tests, 421 pass, 0 fail.
- 정적 확인: `node --check tooling/lib/prompt-template-catalog.mjs && git diff --check`
  - 성공.

## 자체 검토

- index와 shard 모두 공용 `assertNoSymlinkPath` 경계에서 검사하고, 경로는 `catalog/` 하위 및 repository-contained relative path만 허용한다.
- semantic 참조는 실제 설치 skill/template inventory와 routing role registry, 기존 use-case manifest에만 해석한다.
- generated `plugins/*` 및 `package-lock.json`은 수정하지 않았다.

## 우려사항

- canonical index가 가리키는 9개 shard는 후속 Task에서 생성한다. 따라서 이 Task만 적용된 worktree에서 `loadPromptTemplateCatalog`를 실행하면 누락 shard를 안전하게 실패시키는 것이 정상이며, 전체 146-entry load 성공은 shard 작성 완료 후 검증된다.

## Fix round 1

### 변경 내용

- complete validation은 Studio·Career product inventory의 모든 installed skill과 `beginner`/`standard`/`advanced` 조합을 정확히 한 번씩 요구한다. suite `skill-template`은 구조적으로 거부한다.
- 모든 App·CLI prompt pair는 product에 맞는 App mention과 namespace command를 가져야 한다. CLI command는 inventory의 실제 installed skill에 연결되며, suite는 두 제품 중 하나의 실제 App·CLI 경로만 사용할 수 있다.
- `safety_boundary`는 `미정` 처리와 credential/개인정보/비공개 자료 요청 금지를 명시해야 한다. request-aware 검사 범위는 App·CLI, 입력 배열, resume prompt까지 확장했고 `credentials` 표현도 포함한다.

### 커버 테스트

- `tests/unit/prompt-template-catalog.test.mjs`
  - 30개 skill × 3 level cardinality의 누락·중복과 suite skill-template 거부
  - suite의 임의 App, 빈/미등록 CLI command 및 product의 미등록 CLI skill 거부
  - `미정` safety boundary 및 credentials를 요구하는 resume prompt 거부

### RED / GREEN 증거

- RED: `node --test tests/unit/prompt-template-catalog.test.mjs`
  - 수정 전 10 tests 중 5 fail: cardinality, suite skill-template, suite path, product CLI command, safety/resume bypass가 모두 `true !== false`로 재현됐다.
  - credentials 회귀 추가 후 `resume_prompt.*credentials` assertion도 실패해 일반 자격증명 우회를 재현했다.
- GREEN: `node --test tests/unit/prompt-template-catalog.test.mjs`
  - 10 tests, 10 pass, 0 fail.
- 회귀: `npm run test:unit`
  - 426 tests, 426 pass, 0 fail.
- 정적 확인: `node --check tooling/lib/prompt-template-catalog.mjs && git diff --check`
  - 성공.

### 자체 검토

- cardinality는 loader가 읽는 실제 inventory를 기준으로 product·skill·level을 검사하므로 단순 90개 총계만 맞추는 우회를 차단한다.
- CLI validation은 namespace 문자열 포함 여부가 아니라 token 뒤 installed skill ID를 검증한다.
- prohibition 문구 자체(예: “API key를 요청하지 않음”)는 request-aware로 허용하되, resume/입력 경로의 실제 credential 요구는 거부한다.

## Fix round 2

### 변경 내용

- 민감 입력을 `credentials`, `personal data`, `private materials` 세 범주로 분리했다.
- 입력 유도 문구는 문장 절 단위로 검사한다. `without`은 민감 범주 바로 앞에 붙을 때만 금지 의미로 인정하고, 일반적인 지연·일정 표현은 허용 근거가 되지 않는다.
- safety boundary는 `미정` 처리 외에도 세 민감 범주를 각각 직접 금지해야 한다. 한 범주를 요구하면서 다른 범주만 금지하는 상충 문장은 거부한다.

### 커버 테스트

- `tests/unit/prompt-template-catalog.test.mjs`
  - `Resume without delay after you provide your credentials.` 거부
  - `미정. Provide API keys; do not request personal data.` 거부
  - 같은 절의 무관한 `Do not delay, then provide your credentials.`도 거부

### RED / GREEN 증거

- RED: `node --test tests/unit/prompt-template-catalog.test.mjs`
  - 지정한 두 우회가 `true !== false`로 통과하는 결함을 재현했다.
  - 직접 결합 회귀 추가 후에도 무관한 `Do not delay` 문장이 credential 요구를 허용함을 재현했다.
- GREEN: `node --test tests/unit/prompt-template-catalog.test.mjs`
  - 13 tests, 13 pass, 0 fail.
- 전체 단위 회귀: `npm run test:unit`
  - 429 tests, 429 pass, 0 fail.
- 정적 확인: `node --check tooling/lib/prompt-template-catalog.mjs && git diff --check`
  - 성공.

### 자체 검토

- 금지 토큰의 120자 거리 허용을 제거했고, 금지 prefix/suffix 또는 `without <sensitive category>`의 직접 결합만 허용했다.
- 허용되지 않은 민감 범주의 실제 요청은 App·CLI, 입력 배열, resume prompt에서 동일한 절 단위 규칙으로 실패한다.

## Fix round 3

### 변경 내용

- 금지어와 민감 범주 사이의 40자/24자 거리 매칭을 제거했다.
- 안전으로 인정되는 형식은 문장 시작의 직접 금지 동사가 해당 범주를 대상으로 하거나, 그 뒤가 쉼표·`and`·`or`만으로 구성된 순수 민감범주 목록인 경우로 제한했다.
- `provide`·`share`·`enter` 등 긍정 입력 동사가 같은 절에서 특정 범주를 요구하면, 다른 범주의 금지 문구가 있어도 해당 범주를 보호하지 않는다.

### 커버 테스트

- `tests/unit/prompt-template-catalog.test.mjs`
  - `미정. Do not request personal data but provide API keys. Do not request private materials.` 거부
  - `Do not request personal data but provide your credentials.` 거부
  - 기존 `without delay`와 `Do not delay` 변형도 유지

### RED / GREEN 증거

- RED: `node --test tests/unit/prompt-template-catalog.test.mjs`
  - 지정한 safety boundary와 resume prompt가 모두 `true !== false`로 승인되는 결함을 재현했다.
- GREEN: 같은 명령
  - 15 tests, 15 pass, 0 fail.
- 전체 단위 회귀: `npm run test:unit`
  - 431 tests, 431 pass, 0 fail.
- 정적 확인: `node --check tooling/lib/prompt-template-catalog.mjs && git diff --check`
  - 성공.

### 자체 검토

- 순수 목록 판별은 모든 민감 토큰을 제거한 나머지가 허용된 목록 구분자만 포함하는지 확인한다.
- 복수형 `API keys`와 `private materials`도 하나의 완전한 범주 토큰으로 처리해 정상적인 금지 목록은 계속 허용한다.

## Fix round 4

### 변경 내용

- 금지 prefix 뒤 대상은 선택적 `your`/`the`를 제거한 전체 문자열이 순수 민감 범주 목록일 때만 직접 금지로 인정한다. 따라서 `Do not request credentials but ask for credentials.`처럼 임의 후행 요청을 덧붙이는 우회를 허용하지 않는다.
- 직접 금지 문법을 먼저 판정한 뒤, 금지로 인정되지 않은 범주에 대해서만 `request`/`ask for`/`require`/`provide`/`share` 등 실제 입력 요청 동사를 검사한다. 이로써 `Do not provide API keys.`와 `Never share credentials.`는 유효한 금지로 유지한다.

### 커버 테스트

- `tests/unit/prompt-template-catalog.test.mjs`
  - `미정. Do not request credentials but ask for credentials. Do not request personal data. Do not request private materials.` 거부
  - `Do not provide API keys.` 허용
  - `Never share credentials.` 허용

### RED / GREEN 증거

- RED: `node --test tests/unit/prompt-template-catalog.test.mjs`
  - 18 tests 중 15 pass, 3 fail. 후행 `but ask for credentials` safety-boundary 우회는 `true !== false`로 잘못 승인됐고, 두 직접 금지 회귀는 각각 `resume_prompt must not request ...`로 잘못 거부됐다.
- GREEN: `node --test tests/unit/prompt-template-catalog.test.mjs`
  - 18 tests, 18 pass, 0 fail.
- 전체 단위 회귀: `npm run test:unit`
  - 434 tests, 434 pass, 0 fail.
- 정적 확인: `node --check tooling/lib/prompt-template-catalog.mjs && git diff --check`
  - 성공.

### 자체 검토

- 직접 금지 대상의 prefix 일부 일치 분기를 제거해 범주 뒤의 임의 텍스트를 허용하지 않는다.
- 긍정 요청 동사는 완전한 금지 문법으로 보호되지 않은 범주에서만 평가하므로, 금지 동사를 포함하는 정상 문구를 요청으로 오인하지 않는다.
