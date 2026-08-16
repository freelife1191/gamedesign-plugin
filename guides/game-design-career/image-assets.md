# Career 이미지 자산

Career 이미지 작업은 계획, 생성, 검토를 나눠 진행합니다. 모든 생성 모드에서 `assets/image-assets.yml`, Markdown·JSON 프롬프트, 선언한 수량과 자리표시자를 보존하며 새 자산은 `concept-draft` 상태로 시작합니다.

## 안전한 기본 설정

```dotenv
IMAGE_GEN_MODE=prompt-only
IMAGE_PROVIDER=codex-first
IMAGE_EMBEDDED_TEXT_LOCALE=none
# 다음 값은 IMAGE_PROVIDER=openai를 명시적으로 선택했을 때만 사용합니다.
IMAGE_MODEL=gpt-image-2
IMAGE_QUALITY=low
```

기본 경로는 호스트 `image_gen`을 먼저 쓰는 `codex-first`입니다. **API 키가 있어도 유료 사용 승인으로 보지 않습니다.** 실제 키는 문서·프롬프트·Git으로 추적하는 `.env`에 넣지 않습니다. 유료 모델의 기본값은 `gpt-image-2`, 품질은 `low`입니다.

## 키와 설정 파일의 사용자 경계

- API 키를 쓰는 경우 작업 공간 루트의 `.env`는 **일반 파일이며 심볼릭 링크가 아니고 Git으로 추적되지 않아야** 합니다. 빈 API 키 예시와 자리표시자는 허용되지만 실제 값을 문서·명령·커밋에 넣지 않습니다.
- `.env`를 만들거나 바꾼 뒤에는 Codex App에서는 **새 채팅**, Codex CLI에서는 **새 세션**을 열어 설정을 다시 읽습니다. 이미 열린 대화·세션에 값이 자동 주입되었다고 가정하지 않습니다.
- 작업 흐름을 호출할 때마다 작업 공간 루트의 `.env`를 읽습니다. 다만 현재 프로세스 환경 변수가 `.env`보다 우선하므로, 이미 설정된 값은 `.env`의 같은 이름 값을 덮어씁니다. 새 채팅·새 세션 권고는 설치 또는 환경 변경을 안전하게 반영하기 위한 지침이지 유일한 로딩 조건은 아닙니다.
- 호스트 이미지 생성 기능은 API 키 보유 여부와 관계없이 `codex-first`에서 우선합니다. 호스트가 `available`을 보고한 경우에만 이 경로를 사용합니다.
- 설정 파일이 64 KiB를 넘으면 거부될 수 있습니다. 구문 분석 오류, 권한 경고, 심볼릭 링크 경고가 나오면 값을 복사해 붙이지 마세요. 작업 공간 루트의 일반 파일인지, 심볼릭 링크가 아닌지, 소유자에게 읽기 권한이 있는지, Git 추적에서 제외됐는지 확인한 뒤 새 세션에서 재개합니다.

## 🧭 생성 모드 선택 (`IMAGE_GEN_MODE`)

| 모드 | 생성 범위 | 사용자·비용 경계 |
| --- | --- | --- |
| **`prompt-only`** | **외부 호출 0회.** 계획, 프롬프트, 자리표시자만 작성 | **안전한 기본값입니다.** |
| `select` | 사용자가 직접 고른 순서 있는 안정 자산 ID만 | 변경 불가능한 사용자 선택 기록 전에는 호출하지 않습니다. |
| `required` | 프로필·자산 목록에서 필수로 선언한 유한한 자산만 | 필수 수량 밖의 작업을 만들지 않습니다. |
| `all` | 필수·권장·변형 자산으로 선언한 항목 전부 | 선언하지 않은 변형 자산을 임의로 만들지 않습니다. |

표시 이름, 순번, 추정한 의도, 에이전트의 선택과 임의 JSON은 `select` 증거가 아닙니다.

[![IMAGE_GEN_MODE 선택 흐름](../assets/shared/image-generation-mode-routing.png)](../assets/shared/image-generation-mode-routing.svg)

## 💰 제공자 선택과 비용 절약

- `IMAGE_PROVIDER=codex-first`는 API 키가 있어도 사용 가능한 호스트 `image_gen`을 우선합니다. 호스트가 반환하지 않은 모델·품질 정보는 기록하지 않습니다.
- 호스트가 없거나 반복해서 실패하거나 결과가 만족스럽지 않으면 기존 결과를 보존하고 유료 `gpt-image-2`의 비용·품질 선택을 제안합니다. **자동으로 유료 이미지 제공자로 전환하지 않습니다.**
- `IMAGE_PROVIDER=openai`와 현재 사용자 승인이 함께 있을 때만 유료 API를 사용하며, 실패해도 다른 경로로 자동 전환하지 않습니다.
- 이미지 안에 한글 문자가 필요하면 `IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR`, `IMAGE_PROVIDER=openai`, `IMAGE_MODEL=gpt-image-2`가 필수입니다.
- 유료 품질은 **`low`가 기본**입니다. `medium`은 선택된 마스터·키 이미지에만, `high`는 영상용 핵심 프레임이나 게임 원화처럼 예외적으로 필요한 경우에만 비용과 이유를 확인한 뒤 사용합니다.
- API 키, 승인 권한, Base64, 원본 이미지 바이트와 비공개 설정은 공개 결과나 로그에 노출하지 않습니다.

[![image_gen부터 유료 생성 승인까지 이어지는 이미지 제작 흐름](../assets/shared/image-provider-cost-routing.png)](../assets/shared/image-provider-cost-routing.svg)

도식은 `prompt-only`, 무료 우선 생성, 유료 전환 제안과 승인 후 생성 경계를 함께 보여 줍니다.

## Career 이미지 계획

포트폴리오 근거, 채용 담당자용 발표 자료, 역기획 근거와 학습 계획에 이미지를 쓸 때는 목표 직무·수준과 원본 문서 위치를 연결합니다. 이미지는 현재 근거를 대신할 수 없으며 실제 프로젝트·회사 식별 정보를 프롬프트에 노출하지 않습니다. 사실·추론·제안, 검색일·지역·표본의 경계는 기준 기획 결과물이 판단 기준입니다.

Skillstead는 근거가 있는 직무·역량·학습 의존 관계를 편집 가능한 SVG와 정확한 2배 PNG로 만드는 별도 자산 자리입니다. 포트폴리오 삽화, 화면 캡처, 표지와는 출처·대체 텍스트·승인 근거를 따로 유지합니다.

## ✅ 승인 경계

[![이미지 자산 승인 흐름](../assets/shared/image-asset-lifecycle.png)](../assets/shared/image-asset-lifecycle.svg)

```text
concept-draft → document-approved → production-candidate
```

- `document-approved`: 이름이 기록된 시각 검토자가 용도, 배치, 대체 텍스트, 가독성, 권리·출처와 현재 결과물 안의 근거를 승인합니다.
- `production-candidate`: 이름이 기록된 권리·출처 검토자가 기술 적합성, 게임 화면에서의 가독성과 현재 유효한 권리를 추가로 확인합니다.
- `production-candidate`는 출시, 법률 검토, 채용 제출 또는 합격 승인을 뜻하지 않습니다.

최종 MD·PDF·DOCX·PPTX는 `document-approved` 이상인 자산만 참조합니다. 권리가 제한되거나 철회되면 현재 후보 자격도 사라집니다.

## 개인정보와 공정성

제3자·AI·실연자·사용자 제작 콘텐츠(UGC) 자료는 출처, 제작자·기여자, 저작자 표시, 사용 목적, 권리·동의, 개인정보, 승인자와 사용 중단 기록을 남깁니다. 얼굴·이름·회사 비공개 화면 같은 개인정보나 기밀 자료를 포트폴리오 자산으로 자동 전환하지 않습니다.

## 복사 가능한 요청문

```text
@Game Design Career prompt-only로 portfolio case study의 required proof image와 Skillstead diagram을 계획해. stable ID, 수량, source section, alt text, rights/privacy owner와 placeholder를 만들고 생성·승인은 하지 마.
```
