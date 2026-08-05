# Image Asset Pipeline Task 1 구현 보고서

## 상태

`READY`

## 변경 요약

- `shared/scripts/validate-image-config.mjs`: process environment → workspace-root `.env` → safe defaults 우선순위, 닫힌 mode/quality, 안전 model ID, public key redaction, legacy migration warning을 구현했다.
- `shared/image-assets/schema/image-config.schema.json`: API key를 구조적으로 제외한 public image configuration schema를 추가했다.
- `shared/image-assets/.env.example`: 네 mode의 bounded scope, 비용/시간, selection, provider routing, no-fallback, prompt/placeholder, human approval 정책을 문서화했다.
- `.gitignore`: 실제 `.env` 및 secret variant를 제외하고 모든 `.env.example`을 허용했다.
- product schema/runtime/product manifests: 닫힌 `image-assets` shared module을 두 제품에 선언했다.
- build: 전체 module을 `references/shared/image-assets/`로 복사하고 동일 source bytes의 `.env.example`을 plugin root에 명시적으로 추가한다. real `.env`, collision, symlink, unsafe staging을 fail closed로 유지한다.
- tests: 설정 precedence/default/closed enums/parser/path/permission/key redaction 및 module packaging exact bytes/no-real-env를 검증한다.
- `plugins/**` generated snapshots은 직접 편집하거나 재생성하지 않았다.

## Strict TDD RED

production 변경 전에 다음 명령을 실행했다.

```bash
node --test tests/unit/image-config.test.mjs tests/unit/build-product.test.mjs tests/contracts/package-contents.test.mjs tests/products/studio/product-contract.test.mjs tests/products/career/product-contract.test.mjs
```

결과: `109 tests`, `100 pass`, `9 fail`.

- `ERR_MODULE_NOT_FOUND`: `shared/scripts/validate-image-config.mjs` 부재
- `ENOENT`: `shared/image-assets/.env.example` 부재
- `Unknown shared module: image-assets`
- 두 product manifest의 module 선언 부재

추가 RED에서 oversized `.env`가 read 전에 거부되지 않고 injected reader까지 도달하는 실패를 확인한 뒤, `lstat.size` preflight를 추가했다.

## Task 1 GREEN

```bash
node --test tests/unit/image-config.test.mjs tests/unit/build-product.test.mjs tests/products/studio/product-contract.test.mjs tests/products/career/product-contract.test.mjs
```

결과: `76 tests`, `76 pass`, `0 fail`.

```bash
node --test --test-name-pattern='temporary product builds package exact image configuration examples' tests/contracts/package-contents.test.mjs
```

결과: `1 test`, `1 pass`, `0 fail`.

## Required five-file command

최종 source 변경 후 요구된 명령을 그대로 다시 실행했다.

Fix round 1 이후 최종 결과: `135 tests`, `132 pass`, `3 fail`.

- Task 1 설정·빌드·제품 계약과 신규 source clean-build test는 모두 통과했다.
- 세 실패는 기존 generated snapshot integrity test의 career/studio child 2개와 aggregate parent 1개다.
- 각 snapshot에 Task 1의 정확한 네 파일 `.env.example`, `references/shared/image-assets/.env.example`, `references/shared/image-assets/schema/image-config.schema.json`, `scripts/validate-image-config.mjs`가 아직 없다는 downstream drift이며 Task 6이 snapshot rebuild를 소유한다.

## 전체 그룹 검증

- `npm run test:unit`: `247 tests`, `246 pass`, `1 fail`. 유일한 실패는 같은 네 파일의 generated snapshot drift를 보고하는 `validate-build-drift`다.
- `npm run test:contracts`: `111 tests`, `107 pass`, `4 fail`. 두 snapshot child + aggregate parent와 Task 2 소유 `shared-contract` module inventory drift다.
- `npm run test:products`: `303 tests`, `301 pass`, `2 fail`. 두 제품 README의 exact runtime-script inventory가 신규 validator를 아직 열거하지 않는 downstream documentation drift다.

해당 downstream 테스트·README·generated snapshot은 Task 1 소유 파일이 아니므로 계약을 약화하거나 직접 수정하지 않았다.

## 보안·정적 검증

- hostile parser/path/secret probes를 포함한 full image config: `27 tests`, `27 pass`, `0 fail`.
- Node syntax: `validate-image-config.mjs`, product/build contracts, config test 모두 exit 0.
- JSON parse: image config schema, product schema, 두 product manifests 모두 exit 0.
- official plugin validator: source Career/Studio 모두 PASS.
- `git diff --check`: PASS.
- 실제 secret pattern scan: PASS.
- `git diff --name-only -- plugins`: empty.

## Temporary clean builds

두 제품을 독립 OS temp staging에 source-only clean build하고 source/root/reference example bytes와 real `.env` 부재를 직접 비교했다.

- `game-design-career`: 321 files, tree SHA-256 `afa54f6440bd5fbd2d398a3cece1c2adde2802ccdcdcbc6fcb3a5369362a1109`
- `game-design-studio`: 329 files, tree SHA-256 `31ea5555937356c36f6810a9e730b259206109a21b65dc47702a71078d9e2784`

두 빌드 모두 root/reference `.env.example`이 source와 byte-exact였고 basename `.env`가 없었다.

## 독립 리뷰

초기 독립 리뷰 verdict: `REQUEST CHANGES` — Critical 0, Important 2.

### Fix round 1

RED 명령:

```bash
node --test --test-name-pattern='backtick|swapped in after lstat|only the workspace-root' tests/unit/image-config.test.mjs
```

결과: `8 tests`, `0 pass`, `8 fail`.

- 네 supported key 모두 backtick syntax를 `.env` parser 단계에서 거부하지 못했다.
- path-based read 때문에 `openFileFn`이 호출되지 않았고 symlink/inode swap이 모두 통과했다.
- inode swap descriptor close evidence도 없었다.

수정:

- supported `.env` value를 closed ASCII grammar로 제한하고 internal API key도 안전한 bounded identifier만 허용했다. 오류는 값을 포함하지 않는다.
- production default read를 `O_NOFOLLOW` descriptor open으로 교체했다.
- inspected/opened/current path의 regular-file 상태와 `dev`/`ino`를 open 전후로 비교한다.
- 최대 `64 KiB + 1`까지만 descriptor chunk read하고, 모든 성공/실패 경로에서 handle을 닫는다.
- open 후와 read 후 workspace ancestor를 다시 검사하고, parse는 최종 identity 검증 후에만 수행한다.

GREEN 결과:

- targeted finding tests: `8 tests`, `8 pass`, `0 fail`.
- full image config: `27 tests`, `27 pass`, `0 fail`.
- Task 1 direct lane excluding generated snapshot assertion: `83 tests`, `83 pass`, `0 fail`.

### Public seam compatibility 보정

독립 리뷰 후 locked public seam을 재확인하면서 injected `readFileFn`이 path-level callback 대신 descriptor chunk adapter로 호출되는 회귀 후보를 발견했다. 기존 계약처럼 injected callback에는 정확히 `<workspaceRoot>/.env` 경로 하나만 전달하도록 복원했고, injection이 없는 production default만 descriptor-safe read 경로를 사용한다.

- compatibility RED: 기존 path-level wrapper가 `ERR_INVALID_ARG_TYPE`으로 실패.
- compatibility GREEN: `only the workspace-root .env is read` 통과, callback 정확히 1회 호출.
- production default는 계속 `O_NOFOLLOW`, bounded descriptor read, identity 재검사, `finally` close를 유지한다.

### 최종 독립 re-review

Verdict: `READY (APPROVE)`.

- Critical: 0
- Important: 0
- Minor: 0
- 기존 backtick/TOCTOU 2건과 public `readFileFn` seam을 모두 `ADDRESSED`로 직접 재검증했다.
- fresh full image config `27/27`, required lane `132/135`이며 세 실패는 Task 6 generated snapshot drift뿐이다.

## 잔여 위험

- generated `plugins/**`와 README/shared-contract inventory는 후속 소유 task가 갱신할 때까지 의도된 drift를 유지한다.
