# 임시 마켓플레이스 설치 스모크 테스트

최종 확인: 2026-08-11 (Asia/Seoul)

## 실행

저장소 루트에서 실행합니다.

```bash
npm run smoke:marketplace
```

공백·한글·NFC 유니코드 경로도 확인하려면 안전한 임시 상위 경로를 전달합니다.

```bash
npm run smoke:marketplace -- --temp-parent "<temporary-parent>/게임 기획 é space"
```

`tooling/marketplace-smoke.mjs`는 실제 `codex`와 `python3`, 설치된 공식 플러그인 검증기를 찾아 별도 임시 `HOME`·`CODEX_HOME`에서 실행합니다. 로컬 세션 인증을 사용할 때에도 `auth.json`은 권한 `0600`으로 복사해 사용하며, 비밀값·경로·해시는 결과에 남기지 않습니다.

## 검증 범위

각 플러그인을 하나씩 설치하고 다음을 확인합니다.

1. `game-design-suite` 마켓플레이스와 플러그인 설치·목록·삭제 JSON 계약이 정확히 맞는지 확인합니다.
2. 플러그인마다 스킬 23개와 공식 플러그인 검증기를 확인합니다.
3. 스킬명이나 사례 ID를 적지 않은 짧은 한국어 요청을 `codex exec --ephemeral`에 전달합니다. 요청에 맞는 경로는 설치된 플러그인이 스스로 선택해야 합니다.
4. runner는 모델 실행 전에 암호학적 binding nonce와 `routeId: null`을 가진 source-bound receipt 템플릿을 만듭니다. nonce 값은 프롬프트나 명령행에 노출되지 않습니다. 모델은 schemaVersion·requestSha256·bindingNonce를 보존하고 설치된 `routing.json`에서 고른 route ID만 채워야 합니다. runner는 nonce, 요청 해시, schema를 다시 확인한 뒤 실제 `SKILL.md`의 SHA-256으로 선택 스킬을 확정합니다. receipt의 재생성은 허용하되 nonce 누락·변조, null·알 수 없는 route, 추가 필드는 거부합니다.
5. 실행 도구는 설치본의 `assets/shared/templates/canonical-artifact`를 결과물 폴더에 먼저 복사합니다. 모델은 YAML 구조와 제목·소제목 ID를 새로 만들지 않고 `content.md`의 본문만 요청에 맞게 작성합니다. 실행 도구는 본문이 기준 템플릿과 실제로 달라졌고 요청의 핵심 표현을 담았는지 확인합니다.
6. 모델이 응답을 마치면 runner가 다음의 정확한 인수로 proof harness를 외부에서 한 번 실행합니다.

```text
<node> marketplace-proof-harness.mjs <cache-root> <workspace-root> <validator-path> <validator-sha256> <artifact-path> <request-sha256>
```

   프롬프트에는 특정 스킬명이나 해당 스킬 경로를 넣지 않습니다. harness는 설치본 `routing.json`에서 receipt의 route ID를 찾아 실제 선택 스킬을 도출하고, 그 스킬의 `SKILL.md` 경로와 해시를 다시 확인합니다.
7. harness와 validator·artifact의 파일 식별자가 실행 전후에 바뀌지 않았는지, artifact가 다시 검증되는지 확인합니다. 일반 셸 명령, 경로 접두사, 리다이렉션, 위조된 출력, 누락·위조된 route receipt, 심볼릭 링크는 모두 거부합니다.
8. 운영 Codex 상태가 바뀌지 않았고 임시 상태가 guarded cleanup으로 정리됐는지 확인합니다.

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
- 경로 선택 기록: `route-receipt-unavailable`, `route-receipt-invalid-json`, `route-receipt-changed-during-capture`, `route-receipt-contract-mismatch`, `route-receipt-nonce-mismatch`, `route-receipt-request-mismatch`, `route-receipt-selected-route-mismatch`, `route-receipt-instruction-mismatch`, `route-receipt-mismatch`, `route-receipt-invalid`
- 외부 검증: `route-proof-command-missing`, `route-proof-receipt-malformed`, `route-proof-receipt-mismatch`, `route-proof-path-boundary`, `route-proof-artifact-tree`, `route-proof-input`, `route-proof-validator-exec`, `route-proof-validator-result`, `route-proof-file-changed`, `route-proof-artifact-changed`, `route-proof-selection-mismatch`, `route-proof-failed`
- 결과물·정리: `artifact-scaffold-failed`, `artifact-missing`, `artifact-validation-failed`, `plugin-remove-failed`, `marketplace-remove-failed`, `marketplace-list-failed`, `production-state-changed`, `temporary-cleanup-failed`, `command-failed`

결과물 디렉터리 자체가 사라졌거나 다른 파일 형식으로 바뀐 경우에는 경로 선택 기록보다 먼저 `artifact-missing`으로 분류합니다. 임시 상태 정리까지 실패하더라도 앞서 확인한 작업 실패 원인은 덮어쓰지 않으며, `temporaryStateCleanup: false`로 정리 실패를 함께 남깁니다.

## 성공 결과 예시

선택 스킬은 고정값이 아니라 검증된 route receipt와 설치된 routing registry에서 도출됩니다.

```json
{
  "status": "PASS",
  "marketplace": "game-design-suite",
  "products": [
    {
      "product": "game-design-career",
      "pluginId": "game-design-career@game-design-suite",
      "selectedSkill": "map-game-design-career",
      "route": "entry-role-map",
      "skills": 23,
      "artifact": "validated-md",
      "exec": "completed"
    },
    {
      "product": "game-design-studio",
      "pluginId": "game-design-studio@game-design-suite",
      "selectedSkill": "define-game-vision",
      "route": "vision",
      "skills": 23,
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
