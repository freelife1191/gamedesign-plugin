# 이미지 자산

이미지 작업은 계획, 생성, 검토를 나눠 진행합니다. 모든 생성 모드에서 `assets/image-assets.yml`, Markdown·JSON 프롬프트, 예상 수량과 자리표시자를 보존하며 새 자산은 `concept-draft` 상태로 시작합니다.

## 안전한 기본 설정

```dotenv
IMAGE_GEN_MODE=prompt-only
IMAGE_PROVIDER=codex-first
IMAGE_EMBEDDED_TEXT_LOCALE=none
# 다음 값은 IMAGE_PROVIDER=openai를 명시적으로 선택했을 때만 사용합니다.
IMAGE_MODEL=gpt-image-2
IMAGE_QUALITY=low
```

기본 경로는 호스트 `image_gen`을 먼저 쓰는 `codex-first`입니다. **API 키가 있어도 유료 사용 승인으로 보지 않습니다.** 실제 키는 문서나 Git으로 추적하는 `.env`에 넣지 않습니다. 유료 모델의 기본값은 `gpt-image-2`, 품질은 `low`입니다.

## 키와 설정 파일의 사용자 경계

- API 키를 쓰는 경우 작업 공간 루트의 `.env`는 **일반 파일이며 심볼릭 링크가 아니고 Git으로 추적되지 않아야** 합니다. 빈 API 키 예시와 자리표시자는 허용되지만 실제 값을 문서·명령·커밋에 넣지 않습니다.
- `.env`를 만들거나 바꾼 뒤에는 Codex App에서는 **새 채팅**, Codex CLI에서는 **새 세션**을 열어 설정을 다시 읽습니다. 이미 열린 대화·세션에 값이 자동 주입되었다고 가정하지 않습니다.
- 작업 흐름을 호출할 때마다 작업 공간 루트의 `.env`를 읽습니다. 다만 현재 프로세스 환경 변수가 `.env`보다 우선하므로, 이미 설정된 값은 `.env`의 같은 이름 값을 덮어씁니다. 새 채팅·새 세션 권고는 설치 또는 환경 변경을 안전하게 반영하기 위한 지침이지 유일한 로딩 조건은 아닙니다.
- 호스트 이미지 생성 기능은 API 키 보유 여부와 관계없이 `codex-first`에서 우선합니다. 호스트가 `available`을 보고한 경우에만 이 경로를 사용합니다.
- 설정 파일이 64 KiB를 넘으면 거부될 수 있습니다. 구문 분석 오류, 권한 경고, 심볼릭 링크 경고가 나오면 값을 복사해 붙이지 마세요. 작업 공간 루트의 일반 파일인지, 심볼릭 링크가 아닌지, 소유자에게 읽기 권한이 있는지, Git 추적에서 제외됐는지 확인한 뒤 새 세션에서 재개합니다.

## 🧭 생성 모드 선택 (`IMAGE_GEN_MODE`)

| 모드 | 생성 범위 | 승인·비용 경계 |
| --- | --- | --- |
| **`prompt-only`** | **외부 호출 0회.** 계획, 프롬프트, 자리표시자만 작성 | **기본값이며 생성 비용이 없습니다.** |
| `select` | 사용자가 직접 고른 순서 있는 안정 자산 ID만 | 변경 불가능한 사용자 선택 기록 전에는 외부 호출이 없습니다. 표시 이름·순번·에이전트 추측은 선택 근거로 인정하지 않습니다. |
| `required` | 자산 목록에서 필수로 선언한 유한한 자산만 | 선언한 수량 밖의 자산을 만들지 않습니다. |
| `all` | 필수·권장·변형 자산으로 선언한 항목 전부 | 선언하지 않은 변형 자산을 임의로 만들지 않습니다. |

[![IMAGE_GEN_MODE 선택 흐름](../assets/shared/image-generation-mode-routing.png)](../assets/shared/image-generation-mode-routing.svg)

## 💰 제공자 선택과 비용 절약

- `IMAGE_PROVIDER=codex-first`는 API 키가 있어도 사용 가능한 호스트 `image_gen`에 선택된 작업만 전달합니다. 호스트가 실제로 반환하지 않은 모델·품질 정보는 기록하지 않습니다.
- 호스트가 없거나 반복해서 실패하거나 결과가 만족스럽지 않으면 프롬프트·결과·실패 상태를 보존하고 유료 `gpt-image-2`의 예상 비용과 품질을 제안합니다. **자동으로 유료 이미지 제공자로 전환하지 않습니다.**
- 사용자가 비용 안내를 확인하고 `IMAGE_PROVIDER=openai`를 명시적으로 승인한 경우에만 OpenAI를 사용합니다. OpenAI가 실패해도 다른 이미지 제공자로 자동 전환하지 않습니다.
- 이미지 안에 한글 문자가 필요하면 `IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR`, `IMAGE_PROVIDER=openai`, `IMAGE_MODEL=gpt-image-2`를 함께 사용합니다. 단순히 한국어로 이미지를 설명했다는 이유만으로 한글 삽입으로 추정하지 않습니다.
- 유료 생성은 초안·스토리보드·변형 이미지 대부분을 **`low` 품질**로 만듭니다. `medium`은 마스터 키 이미지나 고화질 필요가 확인된 결과에만, `high`는 영상용 핵심 프레임이나 게임 원화처럼 예외적으로 필요한 경우에만 추가 비용과 이유를 알리고 승인받아 사용합니다.
- API 키, 승인 권한, Base64와 원본 이미지 바이트는 공개 결과나 로그에 남기지 않습니다.

[![image_gen부터 유료 생성 승인까지 이어지는 이미지 제작 흐름](../assets/shared/image-provider-cost-routing.png)](../assets/shared/image-provider-cost-routing.svg)

도식은 `prompt-only`, 무료 우선 생성, 유료 전환 제안과 승인 후 생성 경계를 함께 보여 줍니다.

## 계획과 생성

`plan-image-assets`는 프로필 슬롯, 명시한 수량, 안정적인 원본 ID, 배치 위치, 대체 텍스트, 크기와 유지·제외 조건을 자산 목록에 기록합니다. `generate-image-assets`는 생성 모드와 변경 불가능한 승인 기록이 허용한 유한한 작업만 실행합니다. 생성·출처 기록과 승인 상태는 따로 관리하며, 일부만 성공하거나 정책에 막힌 경우도 자산별 상태로 남깁니다.

## ✅ 승인 경계

[![이미지 자산 승인 흐름](../assets/shared/image-asset-lifecycle.png)](../assets/shared/image-asset-lifecycle.svg)

승인은 다음 순서로만 이동합니다.

```text
concept-draft → document-approved → production-candidate
```

- `document-approved`: 이름이 기록된 시각 검토자가 용도, 배치, 대체 텍스트, 가독성, 권리·출처와 현재 결과물 안의 근거를 승인해야 합니다.
- `production-candidate`: 그 뒤 이름이 기록된 권리·출처 검토자가 기술 적합성, 게임 화면에서의 가독성과 현재 유효한 권리를 확인해야 합니다.
- `production-candidate`는 출시, 법률 검토, 배포 또는 제작 승인을 뜻하지 않습니다.

에이전트 역할, 생성 성공, 파일 존재 여부와 시각 기록만으로는 승인 상태를 바꿀 수 없습니다. 최종 MD·PDF·DOCX·PPTX 파생본은 `document-approved` 이상인 자산만 참조합니다.

## 권리 상태와 사용 중단

제3자·AI·실연자·사용자 제작 콘텐츠(UGC) 자산은 출처, 제작자·기여자, 저작자 표시, 사용 목적, 권리·동의, 개인정보, 승인자와 사용 중단 기록을 남깁니다. 마지막으로 유효한 사람의 권리 검토 결과인 `active`, `restricted`, `revoked`, `unreviewed` 상태가 현재 결정을 정하며, 제한되거나 사용이 철회된 자산은 후보에서 제외합니다.

## 도식과 삽화의 구분

Skillstead는 근거가 있는 구조 도식의 편집 가능한 SVG와 정확한 2배 PNG를 만드는 도구입니다. 캐릭터 원화, 배경 삽화, 키 아트나 이야기 장면을 대신하지 않습니다. 도식과 삽화는 서로 다른 자산 자리, 프롬프트, 출처와 승인 근거를 유지합니다.

## 복사 가능한 요청문

```text
@Game Design Studio prompt-only로 이 GDD의 required image slot을 계획해. stable asset ID, 명시적 수량, Markdown/JSON prompt와 placeholder를 만들고 생성이나 승인은 하지 마.
```
