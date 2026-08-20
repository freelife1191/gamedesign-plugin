# 임시 마켓플레이스 설치 스모크 테스트

최종 확인: 2026-08-20 (Asia/Seoul)

## 실행

저장소 루트에서 실행합니다.

```bash
npm run smoke:marketplace
```

공백·한글·NFC 유니코드 경로도 확인하려면 안전한 임시 상위 경로를 전달합니다.

```bash
npm run smoke:marketplace -- --temp-parent "<temporary-parent>/게임 기획 é space"
```

한 시나리오만 다시 실행할 때는 `--scenario`를 사용합니다. 같은 옵션을 여러 번 넘기면 선택한 시나리오만 순서대로 실행합니다.

```bash
npm run smoke:marketplace -- --scenario career-entry-orchestration
npm run smoke:marketplace -- --scenario game-design-studio-direct --scenario studio-entry-orchestration
```

`tooling/marketplace-smoke.mjs`는 실제 `codex`와 `python3`, 설치된 공식 플러그인 검증기를 찾아 별도 임시 `HOME`·`CODEX_HOME`에서 실행합니다. 로컬 세션 인증을 사용할 때에도 `auth.json`은 권한 `0600`으로 복사해 사용하며, 비밀값·경로·해시는 결과에 남기지 않습니다.

## 검증 범위

각 플러그인을 격리 환경에 설치하고 직접 호출 요청과 대표 진입 요청을 각각 실행합니다. 기본 실행은 네 시나리오를 모두 확인합니다.

| 시나리오 | 기대 경로 | 기대 설치 스킬 | 추가 증거 |
| --- | --- | --- | --- |
| `game-design-career-direct` | `junior-growth-plan` | `plan-junior-growth` | 스킬 이름을 모르는 자연어 요청 |
| `career-entry-orchestration` | `entry-intake` | `orchestrate-game-design-career` | `$game-design-career:game-design-career`, 여섯 줄 영수증, 검토 역할 1~3개, 결정적 병합 |
| `game-design-studio-direct` | `vision` | `define-game-vision` | 스킬 이름을 모르는 자연어 요청 |
| `studio-entry-orchestration` | `project-orchestration` | `orchestrate-game-design-project` | `$game-design-studio:game-design-studio`, 여섯 줄 영수증, 검토 역할 1~3개, 결정적 병합 |

1. `game-design-suite` 마켓플레이스와 플러그인 설치·목록·삭제 JSON 계약이 정확히 맞는지 확인합니다.
2. 플러그인마다 스킬 25개 이상과 공식 플러그인 검증기를 확인합니다.
3. 직접 호출 시나리오는 스킬명이나 사례 ID를 적지 않은 짧은 한국어 요청을 `codex exec --ephemeral`에 전달합니다. 설치된 플러그인이 요청에 맞는 경로와 전문 스킬을 직접 골라야 합니다.
4. 대표 시나리오는 설치된 `$game-design-career:game-design-career` 또는 `$game-design-studio:game-design-studio`를 명시하고 서로 영향을 주는 복합 결과를 요청합니다. 첫 에이전트 메시지의 처음 여섯 줄은 `소유 제품 → 선택 스킬 → 교차 제품 핸드오프 → 결과물 경로 → 현재 사실·가정·차단 요인 → 다음 사람 결정` 순서를 지켜야 합니다.
5. 대표 시나리오는 허용된 검토 역할을 1~3개 선택하고 역할마다 설치본에서 검토한 경로와 검토 결과를 남깁니다. Studio는 `severity → affectedSectionId → rolePriority`, Career는 `severity → evidence-gap-id → artifact-section-id → role-priority` 순서로 결과를 병합해야 합니다. 실행 도구는 표시 문자열만 보지 않고 허용 역할, 역할별 근거와 병합 키를 다시 확인합니다.
6. 실행 도구는 모델 실행 전에 암호학적 바인딩 난수와 `routeId: null`을 가진 원본 결합 영수증 템플릿을 만듭니다. 난수 값은 프롬프트나 명령행에 노출하지 않습니다. 모델은 `schemaVersion`·`requestSha256`·`bindingNonce`를 보존하고 설치된 `routing.json`에서 고른 경로 ID만 채워야 합니다. 실행 도구는 난수, 요청 해시, 스키마를 다시 확인한 뒤 실제 `SKILL.md`의 SHA-256으로 선택 스킬을 확정합니다. 영수증의 재생성은 허용하되 난수 누락·변조, null·알 수 없는 경로, 추가 필드는 거부합니다.
7. 실행 도구는 설치본의 `assets/shared/templates/canonical-artifact`를 결과물 폴더에 먼저 복사합니다. 모델은 YAML 구조와 제목·소제목 ID를 새로 만들지 않고 `content.md`의 본문만 요청에 맞게 작성합니다. 실행 도구는 본문이 기준 템플릿과 실제로 달라졌고 요청의 핵심 표현을 담았는지 확인합니다.
8. 모델이 응답을 마치면 실행 도구가 다음의 정확한 인수로 증명 도구를 외부에서 한 번 실행합니다.

```text
<node> marketplace-proof-harness.mjs <cache-root> <workspace-root> <validator-path> <validator-sha256> <artifact-path> <request-sha256>
```

   프롬프트에는 특정 스킬명이나 해당 스킬 경로를 넣지 않습니다. 증명 도구는 설치본 `routing.json`에서 영수증의 경로 ID를 찾아 실제 선택 스킬을 도출하고, 그 스킬의 `SKILL.md` 경로와 해시를 다시 확인합니다.
9. 증명 도구와 검증기·산출물의 파일 식별자가 실행 전후에 바뀌지 않았는지, 산출물이 다시 검증되는지 확인합니다. 일반 셸 명령, 경로 접두사, 리다이렉션, 위조된 출력, 누락·위조된 경로 영수증, 심볼릭 링크는 모두 거부합니다.
10. 각 제품 실행 뒤 플러그인 캐시가 제거되고, 마지막에는 마켓플레이스 목록도 비어 있어야 합니다. 운영 Codex 상태가 바뀌지 않았고 임시 상태가 보호 정리 절차로 정리됐는지도 확인합니다. 두 제품이 함께 설치된 상태의 선택 제거·재설치·전체 제거는 인증이 필요 없는 `npm run verify:install-roundtrip`이 Ubuntu와 Windows에서 별도로 담당합니다.

## 실패 결과 계약

실패 시 결과는 `status: "INCOMPLETE"`와 함께 비밀값이나 절대경로 대신 안전한 `failure` 객체만 반환합니다.

```json
{
  "code": "natural-language-exec-timeout",
  "product": "game-design-studio",
  "stage": "natural-language-exec"
}
```

`code`는 아래 범위 안에서만 나옵니다. `product`는 해당 플러그인 이름 또는 `null`, `stage`는 실패 구간입니다. 결과물 검증기가 구조 오류를 반환한 경우에는 허용된 오류 코드만 `diagnosticCodes`에 최대 8개까지 담습니다.

- 설치·실행: `marketplace-add-failed`, `plugin-install-failed`, `plugin-package-invalid`, `plugin-list-failed`, `natural-language-exec-timeout`, `natural-language-exec-failed`
- 경로 선택 기록: `route-receipt-unavailable`, `route-receipt-invalid-json`, `route-receipt-changed-during-capture`, `route-receipt-contract-mismatch`, `route-receipt-nonce-mismatch`, `route-receipt-request-mismatch`, `route-receipt-selected-route-mismatch`, `route-receipt-instruction-mismatch`, `route-receipt-mismatch`, `route-receipt-invalid`, `representative-routing-receipt-invalid`, `representative-role-invalid`, `representative-role-evidence-invalid`, `representative-merge-invalid`, `representative-proof-invalid`
- 외부 검증: `route-proof-command-missing`, `route-proof-receipt-malformed`, `route-proof-receipt-mismatch`, `route-proof-path-boundary`, `route-proof-artifact-tree`, `route-proof-input`, `route-proof-validator-exec`, `route-proof-validator-result`, `route-proof-file-changed`, `route-proof-artifact-changed`, `route-proof-selection-mismatch`, `route-proof-failed`
- 결과물·정리: `artifact-scaffold-failed`, `artifact-missing`, `artifact-validation-failed`, `plugin-remove-failed`, `marketplace-remove-failed`, `marketplace-list-failed`, `production-state-changed`, `temporary-cleanup-failed`, `command-failed`

결과물 디렉터리 자체가 사라졌거나 다른 파일 형식으로 바뀐 경우에는 경로 선택 기록보다 먼저 `artifact-missing`으로 분류합니다. 임시 상태 정리까지 실패하더라도 앞서 확인한 작업 실패 원인은 덮어쓰지 않으며, `temporaryStateCleanup: false`로 정리 실패를 함께 남깁니다.

## 성공 결과 예시

선택 스킬은 프롬프트의 주장만 믿지 않고, 검증된 경로 영수증과 설치된 라우팅 레지스트리에서 다시 도출합니다. 대표 시나리오의 역할 근거와 결정적 병합은 별도 영수증 계약을 통과해야 합니다.

```json
{
  "status": "PASS",
  "marketplace": "game-design-suite",
  "products": [
    {
      "scenario": "game-design-career-direct",
      "product": "game-design-career",
      "pluginId": "game-design-career@game-design-suite",
      "selectedSkill": "map-game-design-career",
      "route": "entry-role-map",
      "skills": 25,
      "artifact": "validated-md",
      "exec": "completed"
    },
    {
      "scenario": "career-entry-orchestration",
      "product": "game-design-career",
      "pluginId": "game-design-career@game-design-suite",
      "selectedSkill": "orchestrate-game-design-career",
      "route": "entry-intake",
      "skills": 25,
      "artifact": "validated-md",
      "exec": "completed"
    },
    {
      "scenario": "game-design-studio-direct",
      "product": "game-design-studio",
      "pluginId": "game-design-studio@game-design-suite",
      "selectedSkill": "define-game-vision",
      "route": "vision",
      "skills": 26,
      "artifact": "validated-md",
      "exec": "completed"
    },
    {
      "scenario": "studio-entry-orchestration",
      "product": "game-design-studio",
      "pluginId": "game-design-studio@game-design-suite",
      "selectedSkill": "orchestrate-game-design-project",
      "route": "project-orchestration",
      "skills": 26,
      "artifact": "validated-md",
      "exec": "completed"
    }
  ],
  "authSource": "local-session",
  "productionStateUnchanged": true,
  "temporaryStateCleanup": true,
  "failure": null
}
```
