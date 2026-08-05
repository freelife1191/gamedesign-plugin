# Generated image QA contract

생성 결과는 언제나 `concept-draft`이며, 생성 성공은 문서·제작·법무 승인이 아닙니다.

- 매니페스트의 `asset_id`, 프롬프트, preserve/exclude 제약, 출력 경로·크기·비율·배경을 대조한다.
- `assets/generated/` 밖의 산출물, 깨진 파일, 텍스트·로고 같은 exclude 위반, 읽기 어려운 결과는 `qa-failed`로 기록한다.
- provider/model/quality와 provenance를 기록한다. 생성 불가·실패·정책 차단도 생성 상태로 남기며 승인 상태를 바꾸지 않는다.
- 플레이스홀더는 실제 이미지나 승인 증거가 아니다. 프롬프트 파일은 생성이 없을 때도 보존한다.
