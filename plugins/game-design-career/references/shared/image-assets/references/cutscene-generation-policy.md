# Cutscene Generation Policy

컷씬 비주얼 프리프로덕션은 먼저 `cutscene-brief.md`, beat, shot, continuity와
마스터 레퍼런스 계획을 확정한다. 스타일 마스터, 레퍼런스 마스터, 키프레임,
스토리보드의 순서는 고정이며 각 wave는 자신의 asset ID, 비용, 승인, 시도와
무효화 기록을 가진다.

`prompt-only`는 이미지 공급자 호출과 비용을 발생시키지 않는다. 이 모드의
프롬프트 패키지는 예상 artifact 상대 경로와 stable asset ID를 제공하지만, 아직
존재하지 않는 이미지 SHA-256은 기록하지 않는다. `estimate-only`는 비용 견적까지만
만들며, `generate-after-approval`도 현재 wave의 실제 사람 승인 receipt 없이는
공급자를 호출하지 않는다.

Generation-ready 프롬프트는 `assets/generated/` 아래의 일반 파일을 안전하게 읽어
현재 bytes의 SHA-256을 계산한 뒤에만 만들 수 있다. 마스터, 프롬프트, 가격 또는
레퍼런스가 바뀌면 DAG의 forward impact closure 안에 든 wave만 무효화한다. 영향 밖
자산의 bytes, 상태, receipt와 승인 이력은 보존한다.

`plan-cutscene-visual-preproduction`만 컷씬 manifest의 stable ID, DAG hash,
prompt hash, approval binding과 `cutsceneWorkflow`를 작성한다. 일반
`plan-image-assets`는 전달된 closed manifest를 검증하고 바이트 안정적으로 handoff할
뿐 이를 다시 계획하거나 수정하지 않는다.
