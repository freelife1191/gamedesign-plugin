# 로컬 게임 기획 기억 권한 판정 보정 설계

## 배경

기존 append-only 저장 구조는 정상 입력에서 결정적으로 동작하지만, 손상된 항목을
경로별로 복구하려는 과정에서 권한 판정이 여러 곳으로 흩어졌다. 그 결과 최신
`disputed` 이벤트를 비정규 경로로 옮기면 과거 `approved` 상태가 다시 보이고,
격리된 기억에도 새 resolution을 추가할 수 있었다. 이벤트와 격리 표식의 자유
문자열에는 논리적 NUL도 남길 수 있었다.

이 보정은 기억 기능의 제품 범위를 바꾸지 않는다. 다음 조건은 그대로 유지한다.

- Node.js 18 이상만 사용하고 외부 런타임이나 새 패키지를 추가하지 않는다.
- 기억은 기본적으로 프로젝트 로컬에만 저장하며 완전히 끌 수 있다.
- Markdown 이벤트와 격리 표식은 한 번 만든 뒤 수정·이동·삭제하지 않는다.
- 승인된 기억만 검색에 사용하고, 격리·손상·충돌 기억은 사용하지 않는다.
- 같은 OS 계정의 악의적 프로세스가 syscall 사이에 경로를 바꾸는 공격은 범위
  밖이다. 호출 전에 존재한 symlink와 관찰 가능한 identity 변화는 거부한다.

## 검토한 접근

### 1. 손상 항목 하나만 있어도 저장소 전체 닫기

구현은 가장 단순하지만, 하나의 복구 가능한 경로 오류 때문에 관계없는 정상 기억도
모두 사용할 수 없게 된다. 안전하되 운영성이 지나치게 낮아 채택하지 않는다.

### 2. sealed 내용 우선의 2단계 권한 판정

먼저 `commit.json`이 가리키는 claim과 instance를 bounded read로 검증하고, 그
문서에서 논리 정체성을 복구한다. 그 다음 물리 경로, 대상 이벤트, 격리 표식과
DAG를 결속한다. 정체성을 복구할 수 있는 손상은 해당 기억만 격리하고, 누구의
기억인지 알 수 없는 손상만 저장소 전체를 닫는다.

기존 기능을 보존하면서 과거 승인 상태의 부활을 막을 수 있어 이 방식을 채택한다.

### 3. 전이·resolution·격리 기능 제거

capture-only 저장소는 단순하지만 승인, 이견, 폐기와 충돌 해결 이력을 잃는다.
장기 기억을 안전하게 운영하려는 목적을 훼손하므로 채택하지 않는다.

## 권한 판정 파이프라인

scanner는 각 `commit.json`을 다음 순서로 처리한다.

1. source tree를 `opendir()`로 한 번만 순회하고 10,000개 예산을 넘기 전에 중단한다.
2. 물리 경로에서 얻은 이름을 신뢰하지 않고 commit claim을 먼저 bounded read한다.
3. claim의 event ID, instance ID, 길이와 SHA-256을 검증한 뒤 sealed instance를 연다.
4. instance를 canonical event 또는 quarantine marker로 파싱해 논리 정체성을 얻는다.
5. 논리 정체성에서 계산한 canonical 상대 경로와 실제 상대 경로를 비교한다.
6. 이벤트를 먼저 확정한 뒤 marker의 memory/event/path tuple을 실제 committed
   이벤트와 결속한다.
7. 검증 결과를 `valid`, `tainted-memory`, `fatal-store` 중 하나로 닫는다.

`tainted-memory`는 문서에서 안전한 `memory_id`를 복구했지만 경로·seal·target
결속이 틀린 경우다. 해당 기억 전체를 검색, 색인, transition과 resolution 입력에서
제외한다. `fatal-store`는 문서를 읽거나 정체성을 복구할 수 없어 어느 기억을
격리해야 하는지 알 수 없는 경우다. 이때 `scan.complete`는 `false`이며 저장소
전체를 검색과 색인 생성에서 제외한다. 진단만 남기고 과거 head를 반환하는 경로는
없다.

## 추가 권한

`appendMemoryEvent()`는 scan 결과와 fold 권한을 공통으로 사용한다.

- scan이 불완전하면 모든 append를 거부한다.
- 격리되거나 taint된 memory ID에는 capture, transition, resolution을 모두 거부한다.
- capture는 같은 memory ID가 아직 없을 때만 허용한다.
- transition은 관찰한 유효 head 하나를 parent로 삼아야 한다. scan 뒤 동시 append가
  생기면 두 이벤트가 branch로 남는 것은 정상적인 보수적 충돌 처리다.
- resolution은 관찰한 pairwise-incomparable head 전체를 parent로 삼고 그중 하나를
  선택해야 한다.
- append와 fold는 같은 snapshot 불변 필드와 상태 전이 함수를 사용한다.

격리된 기억의 복구는 기존 memory ID에 이벤트를 덧붙이는 방식이 아니다. 사람이
원인을 확인한 뒤 새 memory ID로 capture한다.

## Canonical 문서

event와 marker의 모든 문자열 key와 value는 writer 단계에서 다음을 만족해야 한다.

- NFC
- NUL 없음
- BOM과 CR 없음
- 문서 끝에는 LF 한 개만 존재

비정규 입력을 writer가 출력하고 parser가 나중에 거부하는 흐름은 금지한다. schema와
runtime은 같은 capture/transition/resolution 조건을 실행형 fixture로 검증한다.
민감정보 검사는 본문뿐 아니라 actor, reason, reason code, 승인 정보와 중첩된 record
전체에 적용한다.

## 경로와 Git 제외

저장소 root, workspace, home, Git common directory와 `info`까지 호출 전에 존재하는
모든 ancestor를 `lstat()`해 symlink와 비디렉터리를 거부한다. 생성한 각 directory는
다음 단계로 넘어가기 전에 다시 확인한다. 이는 승인된 syscall 사이 race non-goal을
확장하지 않고, 호출 전에 이미 존재하는 우회만 차단한다.

`.git/info/exclude` 보정은 기억 append 권한과 계속 분리된 best-effort 단계다.
열린 `O_NOFOLLOW` handle의 dev/ino/size/mtime/ctime과 bytes digest를 읽기 직후와
쓰기 직전에 비교한다. append와 sync 뒤에는 handle의 최종 bytes와 pathname의
identity를 다시 확인한다. 불일치, symlink, 특수 파일, 경로 이탈은 warning으로
끝내고 기억 이벤트를 되돌리거나 수정하지 않는다.

## 오류 처리

- `memory.scan_limit_exceeded`: source scan 예산을 초과해 저장소 전체를 닫음
- `memory.unbound_seal`: sealed bytes에서 논리 정체성을 복구하지 못해 저장소 전체를 닫음
- `memory.path_binding`: 정체성은 복구했지만 canonical 물리 경로가 달라 해당 기억 격리
- `memory.quarantine_binding`: marker와 실제 target event가 달라 해당 기억 격리
- `memory.quarantined`: 격리된 기억에 append 시도
- `memory.tainted`: 손상된 기억에 append 시도
- `memory.noncanonical`: NFC, NUL, LF 또는 schema canonical 계약 위반
- `memory.git_exclude_*`: Git 제외 보정 실패. 기억 저장 성공 여부와 무관한 warning

오류에는 비밀값, raw 문서, 절대 경로를 넣지 않는다.

## 테스트 계약

다음 적대 사례는 실제 생산 함수를 실행해야 하며 source text 존재 여부만 검사하지
않는다.

1. 최신 disputed event를 비정규 경로로 옮겨도 approved가 재노출되지 않는다.
2. 격리·taint된 기억은 transition과 resolution을 추가할 수 없다.
3. marker의 memory ID, target event ID와 target path 중 하나라도 틀리면 격리된다.
4. event와 marker의 NUL·NFD key/value를 writer와 parser가 모두 거부한다.
5. 호출 전에 존재하는 root·ancestor·final symlink는 파일을 만들지 않는다.
6. Git exclude가 같은 inode에서 읽기 뒤 바뀌거나 최종 pathname identity가 바뀌면
   사용자 bytes를 성공으로 보고하지 않는다.
7. 같은 event의 다중 프로세스 append는 `created` 하나와 `present`만 남긴다.
8. 같은 parent의 동시 transition과 같은 head 집합의 동시 resolution은 branch로
   남아 승인 검색에서 제외된다.
9. instance, claim, sync, hard-link 전후 중단으로 생긴 unsealed 파일은 권한을 얻지
   못하고 재시도로 회복한다.
10. 10,001번째 entry 뒤에 승인 무효화 이벤트를 숨겨도 과거 approved를 반환하지
    않는다.
11. event JSON schema와 runtime validator가 같은 정상·공격 fixture를 판정한다.

각 테스트는 잡아야 할 production mutation을 이름으로 기록하고 RED를 확인한 뒤
구현한다. 보고서는 실제 실행 명령과 결과만 기록하며 C helper 기반 과거 보고서는
superseded로 표시한다.

## 완료 기준

- 위 적대 사례가 모두 GREEN이고 의도적 non-goal 한 건만 skip이다.
- 기존 config/env/image 48개 회귀가 통과한다.
- Task 2 record/store 테스트, JSON schema parity, Node syntax와 diff 검사가 통과한다.
- 독립 리뷰에서 Critical/Important가 0이다.
- 이 조건 전에는 Task 3 이후 구현, main 병합과 worktree 정리를 진행하지 않는다.
