# Fix6 — update lock generation/claim repair

## 변경

- 정상 잠금은 staging hard link를 `ownerAnchor`로 보존한다. canonical publish는 `link(ownerAnchor, lockPath)`이며 release는 동일 inode·정확 generation·nlink 2를 검증한 뒤 canonical부터 제거한다.
- 복구 namespace는 `recovery.v1.<target>.claim.<seq>`, `.abort.<seq>`, `.retired` 및 무시되는 `recovery-staging`만 사용한다. 현재 target의 불완전/hostile marker는 fail-closed, 다른 target prefix는 무시한다.
- claim은 수치 순서와 연속성을 검증한다. 최신 claim을 재사용하지 않으며 dead 또는 abort 최신 claim 뒤에만 no-replace hard-link로 다음 sequence를 publish한다.
- retired hard link가 stale inode의 정체성을 보존한다. recovery는 canonical만 제거하고 ownerAnchor·retired·claim/abort marker를 자동 삭제하지 않는다.

## 회귀 범위

46개 단위 테스트에는 unsorted latest claim, retire→unlink resume, unrelated prefix, claim staging unlink fault, normal nlink=2 release, same-PID EIO+abort retry, fresh-publisher barrier와 malformed/seq-gap/symlink/mismatched retired/EPERM/crash-resume 케이스가 포함된다. Fix7은 nlink=3 crash resume, unrelated historical anchor, fresh/expired dead claim lease, release EIO pair preservation을 추가한다.

## 제한

- 기존 directory lock은 보수적으로 unknown으로 남긴다.
- recovery marker는 append-only forensic evidence이므로 정상적으로 자동 정리하지 않는다.
