# Production candidate review contract

`production-candidate`는 제작 검토 후보일 뿐 release, 법무, 배포 승인이 아니다.

- 먼저 named visual reviewer가 purpose, placement, alt text, readability와 artifact 내부 evidence를 근거로 `document-approved`를 기록한다.
- 그 다음 named human reviewer가 technical fit, gameplay readability, rights/provenance와 artifact 내부 evidence를 검토해 `production-candidate`를 기록한다.
- 권리 제한·거절·철회(revocation)가 있으면 후보 상태를 재사용하지 말고 새 review record와 현재 제한을 남긴다.
- 자동 생성, 파일 존재, 타임스탬프만 있는 기록은 어느 승인도 부여하지 않는다.
