# 저장소 작업 지침

## 검증 운영 정책

- 전체 테스트와 플랫폼 검증을 위한 원격 CI는 실행하지 않습니다. 예외로 `.github/workflows/release-notes.yml`의 Release note gate만 `ubuntu-latest`에서 실행하며, 릴리스 노트 형식과 태그 연결만 검증합니다. 다른 GitHub Actions 워크플로를 추가하거나 되살리지 않습니다.
- 변경 사항은 저장소 소유자의 macOS 환경에서 확인합니다. 먼저 변경 범위에 맞는 테스트를 실행하고, 통합 확인에는 `npm test`, 릴리스 전 최종 확인에는 `npm run validate:release`를 사용합니다.
- 설치 수명주기는 `npm run verify:install-roundtrip`, 인증이 필요한 실제 Codex 오케스트레이션은 `npm run smoke:marketplace`로 따로 확인합니다.
- 2026-08-20에 완료된 Ubuntu·Windows 원격 실행은 과거 호환성 증거입니다. 이후 macOS 로컬 테스트 결과를 새로운 Windows 실제 환경 검증처럼 표현하지 않습니다.

## 릴리스 노트

- 새 버전 태그를 만들기 전에 `release/YYYY-MM-DD-vX.Y.Z-자연스러운 릴리스 요약.md`를 작성하고 `release/README.md` 색인에 추가합니다. 버전 뒤에는 `release-title`에서 버전을 뺀 요약을 그대로 붙입니다. 공백과 쉼표는 유지하되 Windows에서 금지하는 파일명 문자는 사용하지 않습니다.
- 릴리스 노트는 이전 태그부터 대상 커밋까지의 Git 이력과 실제 검증 결과를 근거로 씁니다. 계획이나 실행하지 않은 테스트, 확인하지 않은 호환성을 완료된 사실처럼 적지 않습니다.
- `release/TEMPLATE.md`의 메타데이터와 `github-release` 경계를 유지합니다. 경계 안에는 GitHub 게시용 요약을, 경계 아래에는 변경 배경·기능·설치·호환성·검증 근거를 담은 상세 릴리스 노트를 작성합니다.
- 구현 내역을 나열하기보다 사용자가 새로 할 수 있는 일, 영향받는 대상과 필요한 조치를 먼저 설명합니다.
- 한국어 릴리스 노트와 관련 문서를 다 쓴 뒤, 마지막 문장 편집 단계에서 반드시 `$humanize-korean`을 실행합니다. 윤문이 끝나면 사실, 링크, 버전과 형식만 검증하고 문장은 다시 고치지 않습니다.
- 태그나 GitHub Release를 만들기 전에 `npm run validate:release-notes`와 `npm run validate:release`를 통과시킵니다.
- GitHub Release의 제목은 노트의 `release-title`을 사용합니다. 본문은 `npm run render:github-release-note -- vX.Y.Z --output <임시 파일>`로 검증된 상단 게시 구간만 추출해 사용합니다. 게시 또는 수정 뒤에는 `gh release view`로 태그, 제목, 본문, 공개 상태를 다시 확인합니다.
- 공개된 태그를 이동, 덮어쓰기, 삭제 후 재생성하지 않습니다. 잘못된 공개 릴리스는 새 패치 버전으로 바로잡습니다.
