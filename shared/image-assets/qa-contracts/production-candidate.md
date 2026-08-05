# Production candidate review contract

`production-candidate`는 제작 검토 후보일 뿐 release, 법무, 배포 승인이 아니다.

- 먼저 named visual reviewer가 purpose, placement, alt text, readability와 artifact 내부 evidence를 근거로 `document-approved`를 기록한다.
- 그 다음 `rights-provenance-reviewer` 역할의 named human reviewer가 technical fit, gameplay readability, rights/provenance와 artifact 내부 evidence를 검토해 `production-candidate`를 기록한다. visual reviewer와 rights/provenance reviewer의 role·scope는 서로 대체할 수 없다.
- review ledger에서 마지막 유효 human rights/provenance review가 현재 권리 결정을 지배한다. `rights.effective_status`는 `active`, `restricted`, `revoked`, `unreviewed` 중 하나이며, restricted/revoked에는 이유가 필요하다.
- 권리 제한·거절·철회(revocation)가 마지막 유효 review이면 후보 상태는 무효다. 제한을 해제하려면 새 `approved` human rights/provenance review와 `active` effective status를 기록한다.
- 각 승인 transition은 named human, stage-bound role/scope, evidence paths, digest를 묶은 human review authority receipt를 제시해야 한다. caller가 `human` 문자열만 보내거나 receipt를 복사·위조해서는 승인할 수 없다.
- 자동 생성, 파일 존재, 타임스탬프만 있는 기록은 어느 승인도 부여하지 않는다.
