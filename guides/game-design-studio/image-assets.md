# 이미지 자산

이미지 workflow는 planning, generation, review를 분리합니다. 모든 mode에서 `assets/image-assets.yml`, Markdown/JSON prompt, expected count와 placeholder를 보존하며 새 asset은 `concept-draft`로 시작합니다.

## 안전한 기본 설정

```dotenv
IMAGE_GEN_MODE=prompt-only
IMAGE_MODEL=gpt-image-2
IMAGE_QUALITY=low
```

기본 상태에서는 `OPENAI_API_KEY`를 설정하지 않습니다. 실제 key는 문서나 tracked `.env`에 넣지 않습니다. 기본 model은 `gpt-image-2`, quality는 `low`이며 허용 quality는 `low`, `medium`, `high`, `auto`입니다.

## 키와 설정 파일의 사용자 경계

- API key를 쓰는 경우 workspace root의 `.env`는 **regular file이고 symlink가 아니며 Git 비추적**이어야 합니다. 빈 API key 예시와 placeholder는 허용되지만 실제 값을 문서·명령·commit에 넣지 않습니다.
- `.env`를 만들거나 바꾼 뒤에는 Codex App에서는 **새 채팅**, Codex CLI에서는 **새 세션**을 열어 설정을 다시 읽습니다. 이미 열린 대화·세션에 값이 자동 주입되었다고 가정하지 않습니다.
- workflow 호출 때마다 workspace root의 `.env`를 읽습니다. 다만 현재 process environment가 .env보다 우선하므로, 이미 설정된 process 값은 `.env`의 같은 이름 값을 덮어씁니다. 새 채팅·새 세션 권고는 설치 또는 환경 변경을 안전하게 반영하기 위한 지침이지 유일한 로딩 조건은 아닙니다.
- host image capability를 쓰고 API key가 없으면 API key는 필요하지 않습니다. host가 `available`을 보고한 경우에만 그 경로를 사용합니다.
- 설정 파일은 64 KiB를 넘기면 거부될 수 있습니다. parser 오류·권한 경고·symlink 경고가 나오면 값을 복사해 붙이지 말고, workspace root의 regular non-symlink 파일·소유자 읽기 권한·추적 제외 상태를 확인한 뒤 새 세션에서 재개합니다.

## IMAGE_GEN_MODE

| Mode | 생성 범위 | 승인·비용 경계 |
| --- | --- | --- |
| `prompt-only` | 외부 호출 0회. plan, prompt, placeholder만 작성 | 기본값이며 생성 비용이 없습니다. |
| `select` | 실제 사용자가 선택한 ordered stable asset IDs만 | immutable host-user selection receipt 전에는 외부 호출 0회입니다. label·순번·agent 추측은 거부합니다. |
| `required` | manifest에서 required로 선언된 유한 asset만 | 선언된 count 밖의 asset을 만들지 않습니다. |
| `all` | declared required, recommended, variant asset 전부 | 선언되지 않은 variant를 발명하지 않습니다. |

[![IMAGE_GEN_MODE 선택 흐름](../assets/shared/image-generation-mode-routing.png)](../assets/shared/image-generation-mode-routing.svg)

## Provider routing

- `OPENAI_API_KEY`가 있으면 OpenAI only입니다. OpenAI Images API/auth/quota/billing/request/policy/network 실패 후 Codex fallback은 금지됩니다.
- key가 없고 host Codex image capability가 `available`이면 선택된 jobs만 host에 전달합니다. host가 실제로 반환하지 않은 applied model/quality는 기록하지 않습니다.
- key가 없고 capability가 `unknown` 또는 `unavailable`이면 호출하지 않고 prompt와 placeholder를 보존합니다.
- API key, authorization, base64와 raw image bytes는 public 결과나 log에 남기지 않습니다.

## 계획과 생성

`plan-image-assets`는 profile slot, explicit count, stable source ID, placement, alt text, dimensions와 preserve/exclude를 manifest에 기록합니다. `generate-image-assets`는 mode와 immutable receipt가 허용한 finite jobs만 실행하고 generation/provenance와 approval state를 분리합니다. 부분 성공이나 policy block도 asset별 상태로 남깁니다.

## 승인 경계

[![이미지 자산 승인 흐름](../assets/shared/image-asset-lifecycle.png)](../assets/shared/image-asset-lifecycle.svg)

승인은 다음 순서로만 이동합니다.

```text
concept-draft → document-approved → production-candidate
```

- `document-approved`: named visual reviewer가 purpose, placement, alt text, readability, rights/provenance와 artifact-local evidence를 승인해야 합니다.
- `production-candidate`: 그 뒤 named human rights/provenance reviewer가 technical fit, gameplay readability와 active rights를 검토해야 합니다.
- `production-candidate`는 release, legal, deployment 또는 production approval이 아닙니다.

Agent 역할, generation 성공, file existence와 timestamp만으로는 transition할 수 없습니다. final MD/PDF/DOCX/PPTX derivative는 `document-approved` 이상 asset만 참조합니다.

## Rights와 revocation

제3자·AI·performer·UGC 자산은 source, creator/contributor, attribution, use purpose, rights/consent, privacy, approver와 revocation을 기록합니다. 마지막 유효 human rights review의 `active`, `restricted`, `revoked`, `unreviewed` 상태가 현재 결정을 지배하며 restricted/revoked asset은 후보 자격을 잃습니다.

## Skillstead와 illustration의 구분

Skillstead는 source-backed 구조 도식의 editable SVG와 정확한 2× PNG를 위한 도구입니다. character art, background scene illustration, key art나 story scene을 대체하지 않습니다. diagram과 illustration은 서로 다른 slot, prompt, provenance와 approval evidence를 유지합니다.

## 복사 가능한 요청문

```text
@Game Design Studio prompt-only로 이 GDD의 required image slot을 계획해. stable asset ID, 명시적 수량, Markdown/JSON prompt와 placeholder를 만들고 생성이나 승인은 하지 마.
```
