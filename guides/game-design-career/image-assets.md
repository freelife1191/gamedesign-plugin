# Career 이미지 자산

Career image workflow는 planning, generation, review를 분리합니다. 모든 mode에서 `assets/image-assets.yml`, Markdown/JSON prompt, declared count와 placeholder를 보존하며 생성 asset은 `concept-draft`로 시작합니다.

## 안전한 기본 설정

```dotenv
IMAGE_GEN_MODE=prompt-only
IMAGE_MODEL=gpt-image-2
IMAGE_QUALITY=low
```

기본 상태에서는 `OPENAI_API_KEY`를 설정하지 않습니다. key는 문서·prompt·tracked `.env`에 넣지 않습니다. 기본 model은 `gpt-image-2`, quality는 `low`이고 허용값은 `low`, `medium`, `high`, `auto`입니다.

## IMAGE_GEN_MODE

| Mode | 생성 범위 | 사용자·비용 경계 |
| --- | --- | --- |
| `prompt-only` | 외부 호출 0회; plan, prompt, placeholder만 작성 | 안전한 기본값입니다. |
| `select` | 실제 사용자가 선택한 ordered stable asset IDs만 | immutable host-user receipt 전에는 호출하지 않습니다. |
| `required` | profile/manifest가 required로 선언한 finite assets만 | required count 밖 작업을 만들지 않습니다. |
| `all` | declared required, recommended, variant assets | 선언되지 않은 variant를 발명하지 않습니다. |

label, position, inferred intent, agent selection과 arbitrary JSON은 `select` 증거가 아닙니다.

[![IMAGE_GEN_MODE 선택 흐름](../assets/shared/image-generation-mode-routing.png)](../assets/shared/image-generation-mode-routing.svg)

## Provider routing

- `OPENAI_API_KEY`가 있으면 OpenAI only입니다. OpenAI Images API/auth/quota/billing/invalid-request/policy/network 실패 뒤 Codex fallback을 쓰지 않습니다.
- key가 없고 host Codex image capability가 `available`이면 selected compiled jobs만 전달합니다. host가 실제 반환하지 않은 applied model/quality를 기록하지 않습니다.
- key가 없고 capability가 `unknown` 또는 `unavailable`이면 generator를 호출하지 않고 prompt와 placeholder를 보존합니다.
- API key, authorization, base64, raw image bytes와 private config는 public 결과나 log에 노출하지 않습니다.

## Career planning

portfolio proof, recruiter presentation, 역기획 evidence와 roadmap에 이미지를 쓸 때 target role/level과 source section을 연결합니다. current evidence를 이미지가 대신하지 못하며 실제 project·employer identity를 prompt에 유출하지 않습니다. 사실·추론·제안과 검색일·지역·표본 boundary는 canonical artifact가 authority입니다.

Skillstead는 source-backed role/competency/learning dependency의 editable SVG와 정확한 2× PNG를 위한 별도 slot입니다. portfolio illustration, screenshot, cover와 서로 다른 provenance·alt text·approval evidence를 유지합니다.

## 승인 경계

[![이미지 자산 승인 흐름](../assets/shared/image-asset-lifecycle.png)](../assets/shared/image-asset-lifecycle.svg)

```text
concept-draft → document-approved → production-candidate
```

- `document-approved`: named visual reviewer가 purpose, placement, alt text, readability, rights/provenance와 artifact-local evidence를 승인합니다.
- `production-candidate`: named human rights/provenance reviewer가 technical fit, gameplay readability와 active rights를 추가 검토합니다.
- `production-candidate`는 release, legal, 채용 제출 또는 합격 승인이 아닙니다.

final MD/PDF/DOCX/PPTX는 `document-approved` 이상 asset만 참조합니다. restricted/revoked rights는 현재 eligibility를 차단합니다.

## 개인정보와 fairness

제3자·AI·performer·UGC 자료는 source, creator/contributor, attribution, use purpose, rights/consent, privacy, approver와 revocation을 기록합니다. 얼굴·이름·회사 비공개 UI 같은 개인정보나 confidential source를 portfolio 자산으로 자동 전환하지 않습니다.

## 복사 가능한 요청문

```text
@Game Design Career prompt-only로 portfolio case study의 required proof image와 Skillstead diagram을 계획해. stable ID, 수량, source section, alt text, rights/privacy owner와 placeholder를 만들고 생성·승인은 하지 마.
```
