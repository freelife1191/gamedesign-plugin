# Studio FAQ

Studio의 사례·스킬·템플릿을 선택할 때 자주 생기는 질문입니다. 아래 요청문은 초안을 시작하는 용도이며, 사람 검토와 증거 확인을 대신하지 않습니다.

### Q01. 규칙, mechanic, system과 core loop는 어떻게 다른가?

**결론:** 규칙은 한 판단, mechanic은 플레이어가 쓰는 상호작용, system은 연결된 규칙과 상태, core loop는 반복되는 플레이 경험의 흐름이므로 같은 문서 층위로 취급하지 않습니다.

**이유와 경계:** 입력과 상태가 하나만 있는 행동은 rule로 시작하고, 여러 rule의 authority·예외·피드백이 얽히면 system으로 확장합니다. core loop의 루프는 reward만이 아니라 플레이어가 왜 다시 선택하는지까지 검증하며, 문서 순서가 loop의 재미를 증명하지는 않습니다.

**실행 요청:**

```text
@Game Design Studio 협동 탐험의 운반 행동을 rule, mechanic, system, core loop로 나누고 입력·상태·루프 가정과 검증 질문을 연결해.
```

**예상 결과:** `content.md`에 rule ID와 state transition, core loop의 선택 지점이 남고, 구현 전 확인할 rule·state 질문을 갖춘 초안이 생성됩니다.

**관련 사례·스킬·템플릿:** [ST-C02](use-cases/competency-paths.md#st-c02-행동핵심-루프의미-있는-선택), [ST-C03](use-cases/competency-paths.md#st-c03-규칙상태예외데이터), [시스템 스킬](skills/design-game-systems.md), `core-motivation-loop`, `system-specification`을 함께 사용합니다.

**안전·근거·승인:** 재미와 구현 가능성은 사람 검토와 prototype 관찰 전에는 확정하지 않으며, design owner의 승인이 필요합니다.

### Q02. 처음부터 긴 GDD를 만들어야 하는가?

**결론:** 긴 GDD를 처음부터 완성할 필요는 없으며, 짧은 비전과 범위 초안에서 검증할 가정을 먼저 드러내는 편이 안전합니다.

**이유와 경계:** 비전, target player, non-goal과 현재 가정이 없는 장문의 문서는 서로 다른 팀 판단을 숨길 수 있습니다. prototype 또는 실제 제작 경계가 생길 때 필요한 system·content section만 늘리고, 길이 자체를 완성도로 보지 않습니다.

**실행 요청:**

```text
@Game Design Studio 새 프로젝트의 긴 GDD 대신 vision, scope, 가정, 다음 검증 순서를 담은 한 페이지 초안을 content.md로 만들어.
```

**예상 결과:** `content.md`에 vision, target player, non-goal, pending question과 다음 domain route가 남아 이후 문서가 같은 기준에서 확장됩니다.

**관련 사례·스킬·템플릿:** [ST-C01](use-cases/competency-paths.md#st-c01-플레이어-경험과-게임-비전), [비전 스킬](skills/define-game-vision.md), `game-design-brief`, `vision-pillars`를 사용합니다.

**안전·근거·승인:** 가정은 evidence와 함께 기록하고, scope 확장과 release 약속은 product owner의 승인 전에는 보류합니다.

### Q03. 장르 관습과 핵심 재미를 어떻게 구분하는가?

**결론:** 장르 관습은 익숙한 해결 방식이고 핵심 재미는 이 프로젝트가 플레이어에게 반복해서 약속할 경험이므로, 둘을 같은 요구사항으로 고정하지 않습니다.

**이유와 경계:** 플레이어 promise를 먼저 쓰고 관습이 그 promise를 돕는지, 반례가 더 잘 맞는지 비교합니다. 경쟁작의 기능 목록이나 개인 선호만으로 재미를 단정하지 않고, prototype에서 선택과 반응을 검증합니다.

**실행 요청:**

```text
@Game Design Studio 내 협동 복구 게임의 장르 관습과 player promise를 분리하고, 반례와 validation 질문을 포함한 pillar 초안을 만들어.
```

**예상 결과:** `content.md`에 player promise, anti-pillar, 관습 채택 이유와 validation 계획이 남아 기능 제안의 기준으로 사용됩니다.

**관련 사례·스킬·템플릿:** [ST-C01](use-cases/competency-paths.md#st-c01-플레이어-경험과-게임-비전), [ST-C02](use-cases/competency-paths.md#st-c02-행동핵심-루프의미-있는-선택), [비전 스킬](skills/define-game-vision.md), `vision-pillars`를 참조합니다.

**안전·근거·승인:** 시장 관습이나 재미를 근거 없이 사실로 쓰지 않고, evidence와 사람 검토 없이는 자동 승인하지 않습니다.

### Q04. 상태·예외·변수와 데이터 표는 언제 필요한가?

**결론:** 상태·예외·변수와 데이터 표는 행동의 결과가 분기되거나 authority, 우선순위, 구현 handoff가 필요한 시점에 필요합니다.

**이유와 경계:** 단순 설명만으로 충돌을 해결할 수 없으면 state transition, precedence와 data authority를 명시합니다. 디자인 문서는 실제 schema를 발명하지 않으며, engineering과 합의한 식별자·범위만 runtime mapping으로 연결합니다.

**실행 요청:**

```text
@Game Design Studio 공동 제작 기능의 상태, 예외 우선순위, 변수와 data 표가 필요한 경계를 정하고 state와 data 계약 초안을 작성해.
```

**예상 결과:** `content.md`에 state, exception, authority와 data mapping을 포함한 system 초안이 남고, 구현·QA가 확인할 test case가 정리됩니다.

**관련 사례·스킬·템플릿:** [ST-C03](use-cases/competency-paths.md#st-c03-규칙상태예외데이터), [시스템 스킬](skills/design-game-systems.md), `system-specification`, `data-schema-table-contract`를 연결합니다.

**안전·근거·승인:** engineering owner와 design owner의 합의 없이 실제 schema나 migration을 확정하지 않으며, 미해결 충돌은 승인 대신 보류합니다.

### Q05. 캐릭터, 스킬, 전투와 monster spec을 어떻게 연결하는가?

**결론:** 캐릭터, 스킬, 전투와 monster spec은 독립 목록이 아니라 같은 combat 규칙, telegraph와 counterplay에 연결해야 합니다.

**이유와 경계:** 각 entity ID는 입력, cooldown, 상태, 대응 행동과 보상에 닿아야 하며, 수치만으로 읽기 쉬움이나 공정을 보장할 수 없습니다. 전투 feel은 prototype·관찰로 검토하고 asset 제작 계약과 분리합니다.

**실행 요청:**

```text
@Game Design Studio 수호체 monster와 돌진 스킬을 character, combat rule, telegraph, counterplay로 연결한 combat 명세를 작성해.
```

**예상 결과:** `content.md`에 combat entity, 스킬 상태, 대응 행동과 검증 질문이 남아 콘텐츠와 시스템 handoff를 함께 읽을 수 있습니다.

**관련 사례·스킬·템플릿:** [ST-C06](use-cases/competency-paths.md#st-c06-캐릭터스킬전투몬스터), [콘텐츠 스킬](skills/design-game-content.md), `character-skill-combat-monster`, `system-specification`을 사용합니다.

**안전·근거·승인:** prototype 증거와 사람 combat 검토 없이 수치나 난이도를 확정하지 않고, accessibility 영향도 별도 승인합니다.

### Q06. UX flow, feedback와 접근성을 어떻게 함께 검토하는가?

**결론:** UX flow, feedback와 접근성은 화면을 그린 뒤 더하는 항목이 아니라 각 critical action의 동등한 수행 경로로 함께 검토합니다.

**이유와 경계:** 기본 입력, focus, 오류·offline 상태와 대체 입력을 하나의 flow에 기록하고, 감각 cue만으로 중요한 정보를 전달하지 않습니다. 실제 사용자 요구와 플랫폼 evidence가 없으면 준수 여부를 단정하지 않습니다.

**실행 요청:**

```text
@Game Design Studio 첫 세션의 UX flow와 feedback을 critical action, 대체 입력, 오류 recovery, 접근성 검토 지점까지 설계해.
```

**예상 결과:** `content.md`에 flow, state, feedback, accessibility alternative와 검증할 critical path가 남습니다.

**관련 사례·스킬·템플릿:** [ST-C04](use-cases/competency-paths.md#st-c04-uiux온보딩접근성), [플레이어 경험 스킬](skills/design-player-experience.md), `ui-ux-flow-state`, `accessibility-platform-matrix`를 참조합니다.

**안전·근거·승인:** accessibility owner의 확인과 사용자 검토 전에는 동등한 접근을 승인하지 않으며, 미검증 path는 보류합니다.

### Q07. 경제·밸런스 수치를 어떤 근거 없이 만들지 않으려면 어떻게 하는가?

**결론:** 경제·밸런스 수치는 정답처럼 채우지 말고, 가정·정책·telemetry·simulation 근거와 함께 검증 대상으로 기록해야 합니다.

**이유와 경계:** source/sink, 실제 가격, 확률, pity와 보호 지표가 서로 연결되지 않으면 숫자가 player consequence를 가릴 수 있습니다. 제한된 sample이나 synthetic data는 evidence의 한계를 명시하고 출시 성과로 일반화하지 않습니다.

**실행 요청:**

```text
@Game Design Studio 골드와 토큰의 economy 가정, source/sink, telemetry와 simulation 검증 계획을 evidence와 함께 작성해.
```

**예상 결과:** `content.md`에 economy 가설, policy date, evidence, 보호 지표와 재검토 조건이 남아 수치 변경을 추적할 수 있습니다.

**관련 사례·스킬·템플릿:** [ST-C07](use-cases/competency-paths.md#st-c07-성장경제밸런스liveops), [경제·LiveOps 스킬](skills/design-game-economy-and-liveops.md), `economy-balance`, `liveops-experiment-event`를 사용합니다.

**안전·근거·승인:** 실제 가격·확률은 최신 정책과 승인 없이는 확정하지 않으며, monetization 영향은 사람 검토 후에만 결정합니다.

### Q08. LiveOps experiment에서 guardrail과 rollback은 왜 필요한가?

**결론:** guardrail과 rollback은 LiveOps experiment가 가설 검증 중 player harm이나 정책 위반을 발견했을 때 즉시 멈추고 되돌릴 수 있게 합니다.

**이유와 경계:** 성공 지표만 보면 보호 지표의 악화를 놓칠 수 있으므로 control, 한 변수, 중단 조건과 rollback 준비를 함께 둡니다. 관찰 기간이나 표본이 부족하면 experiment 결과를 일반적인 성과로 해석하지 않습니다.

**실행 요청:**

```text
@Game Design Studio 주말 이벤트의 experiment에 control, guardrail, stop 조건과 tested rollback을 포함한 한 변수 계획을 작성해.
```

**예상 결과:** `content.md`에 experiment ID, control, guardrail, stop과 rollback evidence가 남아 실행 전 재개·중단 판단을 할 수 있습니다.

**관련 사례·스킬·템플릿:** [ST-C07](use-cases/competency-paths.md#st-c07-성장경제밸런스liveops), [경제·LiveOps 스킬](skills/design-game-economy-and-liveops.md), `liveops-experiment-event`, `economy-balance`를 연결합니다.

**안전·근거·승인:** 정책 근거와 liveops owner의 승인 없이 publish하지 않으며, rollback이 검증되지 않으면 experiment를 보류합니다.

### Q09. AI가 재미를 검증할 수 있는가?

**결론:** AI는 재미에 대한 가설과 테스트 문서를 정리할 수 있지만, 재미를 검증하거나 승인할 수는 없습니다.

**이유와 경계:** 재미는 플레이어 맥락, 선택, 관찰과 playtest 반응으로 평가하며, AI가 만든 문장이 evidence를 대체하지 않습니다. 가설이 맞는지와 어떤 행동을 측정할지는 design owner와 참가자가 검토합니다.

**실행 요청:**

```text
@Game Design Studio 핵심 루프의 재미 가설을 플레이어 행동, playtest 관찰, evidence 수집 질문으로 바꾸고 승인 전 가정으로 표시해.
```

**예상 결과:** `content.md`에 playtest 계획, evidence 질문, 관찰할 선택과 보류된 재미 가설이 남습니다.

**관련 사례·스킬·템플릿:** [ST-C02](use-cases/competency-paths.md#st-c02-행동핵심-루프의미-있는-선택), [ST-C08](use-cases/competency-paths.md#st-c08-제작검토이미지출력), [검토 스킬](skills/review-game-design.md), `core-motivation-loop`를 사용합니다.

**안전·근거·승인:** 사람 관찰과 design owner 승인이 없으면 자동 승인하지 않으며, AI 생성 문장을 플레이어 증거로 제출하지 않습니다.

### Q10. prototype과 playtest 결과를 문서에 어떻게 반영하는가?

**결론:** prototype과 playtest 결과는 결론만 덮어쓰지 말고 evidence, 가정, 결정과 재개 조건을 연결해 문서에 반영합니다.

**이유와 경계:** 관찰 원문과 해석을 구분하고, 바뀐 가정은 decision ID로 남겨 이전 판단을 추적합니다. 작은 테스트의 반응은 전체 플레이어 집단의 evidence가 아니므로 범위와 한계를 함께 기록합니다.

**실행 요청:**

```text
@Game Design Studio prototype과 playtest 관찰을 evidence.yml, 가정 변경, decision과 다음 검증 요청으로 분리해 content.md에 반영해.
```

**예상 결과:** `content.md`, `evidence.yml`과 decision 기록에 관찰, 해석, 변경 이유와 다음 playtest 요청이 연결됩니다.

**관련 사례·스킬·템플릿:** [ST-C01](use-cases/competency-paths.md#st-c01-플레이어-경험과-게임-비전), [ST-C06](use-cases/competency-paths.md#st-c06-캐릭터스킬전투몬스터), [검토 스킬](skills/review-game-design.md), `decision-change-log`를 참조합니다.

**안전·근거·승인:** 참가자 동의, 출처와 승인 범위를 확인하고, 개인 식별 정보나 한 번의 결과를 확정 성과로 쓰지 않습니다. 검토자는 관찰 원문을 다시 확인한 뒤 변경 결정을 승인합니다.

### Q11. 범위가 너무 큰 기획을 어떻게 줄이는가?

**결론:** 범위가 너무 큰 기획은 core loop 기여와 검증 가능한 prototype을 기준으로 줄이고, 나머지는 defer 또는 exclude로 명시합니다.

**이유와 경계:** 의존성, capacity, 유지 비용과 kill criteria를 비교해 가장 작은 학습 단위를 고릅니다. wish list를 단순 삭제하지 말고 무엇을 나중에 재개할지와 어떤 증거가 필요할지를 기록합니다.

**실행 요청:**

```text
@Game Design Studio 현재 feature 목록을 scope, core loop 기여, dependency, prototype, defer와 kill criteria로 나누어 줄여 줘.
```

**예상 결과:** `content.md`에 scope 결정, prototype 가설, defer·exclude 이유와 다음 검토 owner가 남습니다.

**관련 사례·스킬·템플릿:** [ST-C08](use-cases/competency-paths.md#st-c08-제작검토이미지출력), [제작 스킬](skills/plan-game-production.md), `production-scope-risk`, `game-design-brief`를 사용합니다.

**안전·근거·승인:** capacity 근거와 owner 승인이 없으면 출시 약속으로 바꾸지 않으며, cut 결정은 사람 승인 전에는 보류합니다.

### Q12. 이미지와 도식을 실제 게임 resource로 사용해도 되는가?

**결론:** 이미지와 도식은 실제 게임 resource로 바로 사용하지 말고, 용도·권리·provenance와 승인 receipt를 확인한 뒤 별도 asset 계약으로 다뤄야 합니다.

**이유와 경계:** Skillstead 도식은 구조 설명용이고 illustration이나 생성 이미지는 권리, 동의, 검토와 export 경계가 다릅니다. prompt-only 산출물은 생성된 asset이 아니며, provider 결과가 실제 사용 권한을 보장하지 않습니다.

**실행 요청:**

```text
@Game Design Studio 필요한 asset의 용도, 권리, provenance, receipt와 검토 gate를 image manifest에 기록하고 도식과 illustration을 분리해.
```

**예상 결과:** `content.md`와 asset manifest에 asset ID, provenance, receipt, 사용 범위와 보류 상태가 남습니다.

**관련 사례·스킬·템플릿:** [ST-C08](use-cases/competency-paths.md#st-c08-제작검토이미지출력), [이미지 계획 스킬](skills/plan-image-assets.md), `plan-image-assets`, `image-assets-manifest`를 참조합니다.

**안전·근거·승인:** 권리와 동의가 확인되지 않은 resource는 사용하지 않으며, asset owner의 승인 전에는 배포·공개하지 않습니다.

### Q13. GDD와 PPTX는 같은 내용을 그대로 나누면 되는가?

**결론:** GDD와 PPTX는 같은 Canonical Artifact를 근거로 하지만, 그대로 나누지 말고 audience와 의사결정 목적에 맞게 요약합니다.

**이유와 경계:** GDD는 traceable rule·근거·결정을 보존하고, PPTX는 승인에 필요한 선택지와 위험을 보여 줍니다. format 변환은 내용을 새로 확정하는 행위가 아니며 renderer·visual QA 실패 시 원본을 보존합니다.

**실행 요청:**

```text
@Game Design Studio 승인된 Canonical Artifact를 MD GDD와 의사결정용 PPTX로 나누는 export 준비 manifest를 만들고 audience별 요약을 제안해.
```

**예상 결과:** `content.md`와 export manifest에 MD, PPTX 대상, 읽는 순서, renderer 상태와 format QA 조건이 남습니다.

**관련 사례·스킬·템플릿:** [ST-C08](use-cases/competency-paths.md#st-c08-제작검토이미지출력), [내보내기 스킬](skills/export-game-design-documents.md), `export-game-design-documents`, `export-preparation-manifest`를 사용합니다.

**안전·근거·승인:** renderer 결과와 파일 존재만으로 승인하지 않으며, format owner의 QA와 사람 승인을 확인합니다.

### Q14. 기존 기획서를 review skill만으로 검토할 수 있는가?

**결론:** 기존 기획서는 review skill로 finding을 정리할 수 있지만, source와 owner가 없는 상태에서 내용을 재작성하거나 결론을 승인할 수는 없습니다.

**이유와 경계:** review는 stable source의 section, evidence, impact와 minimal fix를 연결해야 합니다. 누락된 context는 finding으로 남기고, 검토 결과가 원본 rule이나 제작 결정을 자동으로 바꾸지 않게 합니다.

**실행 요청:**

```text
@Game Design Studio 이 기존 system 문서를 source locator, review finding, impact, minimal fix와 결정 owner 기준으로 검토해.
```

**예상 결과:** `content.md`에 review finding, evidence locator, severity와 다음 decision 요청이 남아 원본과 변경 제안을 분리합니다.

**관련 사례·스킬·템플릿:** [ST-C03](use-cases/competency-paths.md#st-c03-규칙상태예외데이터), [ST-C08](use-cases/competency-paths.md#st-c08-제작검토이미지출력), [검토 스킬](skills/review-game-design.md), `game-design-review`를 참조합니다.

**안전·근거·승인:** 근거 없는 finding을 사실로 쓰지 않고, disagreement와 변경 결정은 지정된 사람 owner가 승인합니다.

### Q15. 팀에 전달할 때 어떤 결정과 미해결 위험을 남기는가?

**결론:** 팀 전달에는 결정, 근거, owner, 미해결 위험, 보류 이유와 재개 조건을 함께 남겨 다음 사람이 같은 판단 경계를 읽게 해야 합니다.

**이유와 경계:** handoff는 요약 슬라이드만이 아니라 `content.md`, evidence와 decisions의 읽는 순서를 제공해야 합니다. 확정된 것과 가정, 공개 가능한 정보와 내부 자료를 구분하지 않으면 risk와 책임이 흐려집니다.

**실행 요청:**

```text
@Game Design Studio 현재 Canonical Artifact의 decisions, owner, evidence, risk와 재개 조건을 팀 handoff 목록으로 정리해.
```

**예상 결과:** `content.md`와 `decisions/`에 decisions, unresolved risk, owner, evidence와 다음 요청이 연결된 handoff 초안이 남습니다.

**관련 사례·스킬·템플릿:** [ST-C08](use-cases/competency-paths.md#st-c08-제작검토이미지출력), [검토 스킬](skills/review-game-design.md), `decision-change-log`, `game-design-review`를 사용합니다.

**안전·근거·승인:** NDA, 팀 PII와 권리 불명 자료는 전달하지 않으며, 공개 범위와 최종 승인자는 사람이 확인합니다. 전달 전에는 evidence가 현재 결정과 일치하는지도 문서 책임자가 다시 검토합니다.

### Q16. renderer가 없을 때 어떤 결과를 전달할 수 있는가?

**결론:** renderer가 없을 때도 Canonical Artifact, Markdown, editable SVG와 unavailable 기록은 전달할 수 있지만 파생 PNG·PDF 성공으로 표시하면 안 됩니다.

**이유와 경계:** renderer capability와 lint 결과를 분리해 기록하고, SVG source를 보존한 채 필요한 환경과 재개 조건을 알립니다. unavailable은 실패한 format의 품질이나 사람 승인을 추정하는 상태가 아닙니다.

**실행 요청:**

```text
@Game Design Studio renderer unavailable 상황에서 content.md, SVG source, lint 기록, 보류된 format과 재개 조건을 포함한 handoff를 만들어.
```

**예상 결과:** `content.md`, editable SVG, unavailable capability 기록과 PNG·PDF 재개 요청이 남아 전달 가능한 결과 범위를 명확히 합니다.

**관련 사례·스킬·템플릿:** [ST-C08](use-cases/competency-paths.md#st-c08-제작검토이미지출력), [시각화 스킬](skills/visualize-game-design.md), `visualize-game-design`, `export-game-design-documents`를 참조합니다.

**안전·근거·승인:** PNG나 파생 format은 실제 renderer QA와 사람 승인 전에는 verified 또는 완료로 표시하지 않습니다.

### Q17. 학생 과제에서 결과를 그대로 제출해도 되는가?

**결론:** 학생 과제 결과를 그대로 제출하기보다 개인 contribution, 사용한 근거, 검토와 수정 과정을 과제 정책에 맞게 밝혀야 합니다.

**이유와 경계:** 생성 초안은 학습 보조일 수 있지만 답안 대행이나 개인 기여의 대체가 될 수 없습니다. 교사·기관의 AI 정책, 출처 표기와 공개 권한을 확인하고, 요구된 실습·반성 기록을 남깁니다.

**실행 요청:**

```text
@Game Design Studio 이 과제 초안에서 내 contribution, evidence, 교사 검토 질문과 정책 확인 항목을 분리해 제출 전 checklist로 만들어.
```

**예상 결과:** `content.md`에 contribution 설명, evidence 출처, policy 확인 질문과 사람 피드백 요청이 남아 제출 전 검토에 사용됩니다.

**관련 사례·스킬·템플릿:** [ST-C01](use-cases/competency-paths.md#st-c01-플레이어-경험과-게임-비전), [ST-C08](use-cases/competency-paths.md#st-c08-제작검토이미지출력), [검토 스킬](skills/review-game-design.md), `game-design-review`를 사용합니다.

**안전·근거·승인:** 학교 정책과 교사 또는 멘토의 승인 없이는 그대로 제출하지 않으며, 타인의 자료와 권리 불명 asset은 제거합니다.

### Q18. 서로 다른 장르 사례를 내 아이디어에 어떻게 적용하는가?

**결론:** 서로 다른 장르 사례는 복사 대상이 아니라 내 아이디어의 전이 가능한 문제·제약·가정을 비교하는 출발점으로 적용합니다.

**이유와 경계:** 사례의 player context, 입력 장치, 사회적 위험, 콘텐츠 주기와 evidence 요구를 내 프로젝트와 대조합니다. 장르 성과나 특정 관습을 일반화하지 말고, 바뀌는 assumption마다 validation 계획을 새로 둡니다.

**실행 요청:**

```text
@Game Design Studio 내 아이디어를 ST-G01과 ST-G10의 제약, 전이 역량, assumption, validation 관점에서 비교하고 다음 prototype 질문을 만들어.
```

**예상 결과:** `content.md`에 assumption, validation 질문, 적용할 제약과 검증할 차이가 남아 장르 복제 없이 다음 실습으로 이어집니다.

**관련 사례·스킬·템플릿:** [ST-G01](use-cases/concept-scenarios.md#st-g01-모바일-수집형-rpg라이브서비스), [ST-G10](use-cases/concept-scenarios.md#st-g10-교육사회문제접근성-중심-게임), [비전 스킬](skills/define-game-vision.md), `game-design-brief`를 참조합니다.

**안전·근거·승인:** 사례를 시장 정답으로 일반화하지 않고, 사람 검토와 현재 프로젝트 evidence로 적용 범위를 승인합니다.

### Q19. 이전 프로젝트 교훈을 다음 기획에 어떻게 안전하게 쓰는가?

**결론:** 현재 프로젝트에서 이름이 확인된 사람이 승인한 기록만 참고합니다. 자동으로 남는 기록은 후보뿐이며 자동 승인되지 않습니다.

**이유와 경계:** 출처 파일, 적용·제외 조건, 검토·만료 시점과 Studio 영역을 먼저 확인합니다. 충돌이나 손상이 있으면 어느 쪽도 임의로 고르지 않고 기존 기획은 기억 없이 계속합니다. 기억은 기준 기획 결과물과 플레이테스트 근거를 대신하지 않습니다.

**실행 요청:**

```text
@Game Design Studio 기억 후보와 승인 기록을 보여 주고, 현재 보스전 기획에 적용할 수 없는 항목은 이유와 함께 제외해.
```

**비활성화와 관련 문서:** 완전히 끄려면 `GAME_DESIGN_MEMORY_ENABLED=false`를 설정하고, 한 번만 제외하려면 “이번 작업에서는 이전 기억을 사용하지 마.”라고 요청합니다. 자세한 관리와 복구 순서는 [Studio 프로젝트 기억](memory.md)을 따릅니다.

### Q20. 컷씬 이미지는 언제 생성하고, 비용을 어떻게 통제하는가?

**결론:** 컷씬은 prompt 작성, 비용 산정, 생성, 연속성 검토를 분리합니다. `style-master → reference-masters → keyframes → storyboard` 순서로만 진행하며, 각 wave는 count, model, quality, size, USD 범위, cap, retryReserve, pricing time과 `costStatus`를 공개한 뒤 이름을 기록한 실시간 승인을 받아야 합니다.

**이유와 경계:** host 비용이 `unavailable`이면 무료로 간주하지 않고 provider 호출 0회로 멈춥니다. 이전 승인이나 포괄 승인은 재사용하지 않습니다. 대사만 바뀌는 variant에는 이미지를 만들지 않으며, visual variant는 새 derivative ID와 별도 비용·승인을 사용합니다. 실패 재시도는 현재 full-wave estimate와 남은 retryReserve가 그대로일 때 최신 실패 stable ID에만 허용합니다.

```text
컷씬 brief와 beat만 작성
```

**관련 가이드:** [컷씬 비주얼 프리프로덕션](cutscene-visual-preproduction.md), [이미지 자산](image-assets.md), [이미지 생성 스킬](skills/generate-image-assets.md), [이미지 검토 스킬](skills/review-image-assets.md)을 참조합니다.
