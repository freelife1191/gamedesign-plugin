# 릴리스 노트

이 디렉터리는 Git 태그와 GitHub Release에 연결되는 릴리스 기록의 원본입니다. 버전별 기록은 `release/YYYY-MM-DD-vX.Y.Z-자연스러운 릴리스 요약.md` 한 파일에서 관리합니다. 파일 상단의 `github-release` 경계 안에는 GitHub 게시용 요약을, 하단에는 배경·기능·설치·호환성·검증 근거를 포함한 상세 릴리스 노트를 씁니다.

## 버전별 기록

| 버전 | 공개일 | 요약 | GitHub |
| --- | --- | --- | --- |
| [v0.1.0](<./2026-08-15-v0.1.0-게임 기획 스위트 초기 기준점.md>) | 2026-08-15 | 게임 기획 스위트 초기 기준점 | [Release](https://github.com/freelife1191/gamedesign-plugin/releases/tag/v0.1.0) |
| [v0.1.1](<./2026-08-16-v0.1.1-게임 기획 플러그인 첫 공개 릴리스.md>) | 2026-08-16 | 첫 공개 릴리스와 업데이트 점검 | [Release](https://github.com/freelife1191/gamedesign-plugin/releases/tag/v0.1.1) |
| [v0.2.0](<./2026-08-20-v0.2.0-대표 진입 스킬, 제품 간 인계, 승인형 업그레이드.md>) | 2026-08-20 | 대표 진입 스킬, 제품 간 인계, 승인형 업그레이드 | [Release](https://github.com/freelife1191/gamedesign-plugin/releases/tag/v0.2.0) |

## 새 릴리스 작성 절차

1. [템플릿](./TEMPLATE.md)을 복사해 `release/YYYY-MM-DD-vX.Y.Z-자연스러운 릴리스 요약.md`를 만듭니다. 버전 뒤에는 `release-title`에서 버전을 뺀 요약을 그대로 붙입니다. 공백과 쉼표는 유지하되, Windows 파일명에서 금지하는 `< > : " / \ | ? *` 문자는 사용하지 않습니다.
2. 이전 태그부터 새 태그 대상 커밋까지의 Git 이력을 확인합니다. 커밋 제목을 그대로 옮기지 말고, 사용자가 체감하는 변화로 정리합니다.
3. 제목, 공개일과 대상 커밋을 채웁니다. 상단 GitHub 게시 구간에는 핵심 변경, 업데이트 안내, 검증 요약과 알려진 제한을 간결하게 적습니다.
4. 하단 상세 구간에는 변경 배경과 목표, 기능별 동작, 설치·업그레이드, 호환성과 운영, 검증 근거와 변경 이력을 적습니다. 확인하지 못한 결과를 통과했다고 쓰면 안 됩니다.
5. 한국어 본문을 다 쓴 뒤 마지막 문장 편집 단계에서 `$humanize-korean`으로 다듬습니다. 윤문이 끝나면 사실·링크·버전·형식만 검증합니다.
6. `npm run validate:release-notes`와 `npm run validate:release`를 통과시킵니다.
7. `npm run render:github-release-note -- vX.Y.Z --output <임시 파일>`로 상단 게시 구간만 렌더링합니다.
8. 원격 태그를 확인한 뒤 `gh release create vX.Y.Z --title "<release-title>" --notes-file "<임시 파일>" --verify-tag`로 게시합니다. 기존 Release를 고칠 때는 `gh release edit`을 사용한 다음, 공개된 내용을 다시 읽어 확인합니다.

`tooling/validate-release-notes.mjs`는 로컬 SemVer 태그와 `shared/updates/suite-release.lock.json`을 함께 읽습니다. 태그에 맞는 파일이나 색인 링크가 없을 때, 공개일·대상 커밋이 어긋날 때, GitHub 게시 경계가 중복되거나 상세 섹션이 빠졌을 때 릴리스 게이트가 실패합니다. `render:github-release-note`는 검증을 먼저 통과한 노트에서 게시 경계 안의 내용만 꺼내므로 상세 기록이 GitHub 요약에 섞이지 않습니다.

같은 검증은 `.github/workflows/release-notes.yml`에서도 실행합니다. 이 워크플로는 `ubuntu-latest`에서 릴리스 노트만 검사하며, 전체 테스트·플랫폼 검증·자동 게시 작업은 수행하지 않습니다.
