# 이미지 자산

`image-assets.yml`은 이미지 매니페스트의 시작점이고, `prompts/`에는 생성 여부와 무관하게 재사용 가능한 Markdown·JSON 프롬프트를 둡니다.

- `generated/`에는 매니페스트의 상대 `assets/generated/...` 출력만 둡니다. 파일 존재나 생성 성공은 승인 증거가 아닙니다.
- `diagrams/`에는 Skillstead와 같은 다이어그램 산출물을 둡니다. 다이어그램도 `skillstead-diagram` 매니페스트 항목과 alt text가 필요합니다.
- 각 항목은 rights holder, license, provenance, `effective_status`와 artifact 내부 review evidence를 기록합니다. 권리 철회·제한은 새 human rights/provenance review record와 이유로 남기며, 가장 최신 유효 review가 후보 상태를 무효화합니다.
- 플레이스홀더는 계획용 표식일 뿐 실제 산출물·권리 증명·문서 승인으로 취급하지 않습니다.
- 사람 이름, 검토 시각, evidence 없이 `document-approved` 또는 `production-candidate`로 바꾸지 않습니다. review record의 human kind와 stage role/scope는 lifecycle이 파생하며, 실제 사용자 승인 입력의 신뢰 경계는 `review-image-assets` 운영 절차가 소유합니다.
