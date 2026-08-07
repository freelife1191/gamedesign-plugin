# README 활용 사례·결과물 탐색 구조 보강 설계

## 1. 결정 요약

Game Design Plugin Suite의 루트 README를 종합 활용 허브로 강화하고, Studio와 Career 제품 README에는 제품별 대표 사례와 예상 결과물을 선별해 보강한다. 공통·제품별 사용자 가이드 README도 같은 탐색 구조로 정돈하고, 이미 완료된 사례를 `deferred`로 표시하는 오래된 상태 문구를 제거한다. 상세 사례, 스킬 계약과 FAQ의 권위 있는 본문은 기존 `guides/` 문서에 유지한다.

사용자는 README에서 다음 순서로 이동할 수 있어야 한다.

1. 자신의 목표와 작업 규모를 고른다.
2. 복사 가능한 대표 요청문과 적합한 플러그인을 확인한다.
3. 생성될 최소 결과와 선택·확장 결과를 구분한다.
4. 상세 사례, 스킬 워크벤치, 결과물 카탈로그 또는 FAQ로 이동한다.
5. Canonical Artifact와 파생 결과를 사람 검토 경계 안에서 사용한다.

## 2. 배경과 문제

현재 루트 README에는 제품 선택, 설치, 빠른 시작, 템플릿, 이미지, 내보내기와 일부 대표 사례가 있다. 제품 README에도 사용 예시가 존재하고, `guides/`에는 6개 사용자 경로, 36개 복합 사례, 30개 직접 스킬 사례, 48개 FAQ와 결과물 카탈로그가 준비되어 있다.

그러나 README의 대표 진입점은 다음 질문을 한 화면에서 충분히 연결하지 못한다.

- 학습, 단일 시스템 설계, 전체 프로젝트, 역기획, 포트폴리오와 면접 중 어디에서 시작하는가?
- 짧은 실습, 한 과제, 포트폴리오 프로젝트와 전체 기획은 요청과 결과가 어떻게 다른가?
- 요청 뒤에 어떤 Canonical Artifact, 표, 도식, 이미지 prompt와 파생 문서를 얻는가?
- 더 자세한 사례, 개별 스킬 사용법과 FAQ는 어디에서 찾는가?
- 생성된 결과 중 무엇을 사람이 검토하고 승인해야 하는가?

README가 상세 가이드의 내용을 모두 복제하면 문서가 지나치게 길어지고 사실이 어긋날 위험이 커진다. 따라서 README는 선택과 routing을 담당하고, 상세 가이드는 실행 계약과 전체 사례 본문을 계속 소유한다.

## 3. 목표와 비목표

### 목표

- 처음 사용하는 학생이나 기획자가 루트 README에서 자신의 목표에 맞는 첫 요청을 찾는다.
- 대표 요청마다 적합한 플러그인, 핵심 결과와 상세 가이드 진입점을 확인한다.
- 작업 규모별로 최소 결과, 선택 결과와 확장 결과의 차이를 이해한다.
- Studio와 Career 제품 README에서 해당 제품의 대표 활용 범위와 결과물을 빠르게 파악한다.
- 공통·제품별 가이드 README가 완료된 사례집, 스킬 워크벤치와 FAQ를 정확히 안내한다.
- source README와 generated plugin README의 동기화 계약을 유지한다.
- 기존 설치, 이미지, 내보내기, 권리와 사람 승인 경계를 약화하지 않는다.

### 비목표

- 36개 복합 사례와 30개 직접 스킬 사례의 전체 본문을 README에 복제하지 않는다.
- 플러그인 runtime, 스킬, 에이전트, hook, script 또는 템플릿 동작을 변경하지 않는다.
- 새로운 도식 자산이나 외부 의존성을 추가하지 않는다.
- 재미, 흥행, 매출, 채용 합격, 일정, 법률 준수 또는 사람 승인을 보장하지 않는다.
- 제품 배포 패키지에 저장소의 `guides/`를 새로 포함하지 않는다.
- 템플릿의 `assets/README.md`와 `decisions/README.md`, shared 계약 README 또는 vendored 예제 README를 사용자 활용 안내로 바꾸지 않는다.

## 4. 대안과 선택

### 대안 A — 허브형 요약과 제품별 큐레이션

루트 README는 목표·규모·결과·가이드 routing을 제공하고, 제품 README는 대표 사례만 선별한다. 상세 본문은 기존 가이드에 둔다.

- 장점: 초보자 탐색과 유지보수의 균형이 좋다.
- 단점: 전체 사례를 보려면 상세 가이드로 이동해야 한다.

### 대안 B — README에 전체 사례 직접 수록

모든 복합 사례와 직접 스킬 사례를 README에 넣는다.

- 장점: README 한 파일에서 검색할 수 있다.
- 단점: 중복과 drift가 크고 설치·기술 정보가 묻힌다.

### 대안 C — 현재 구조 유지와 링크만 추가

기존 문장을 거의 유지하고 상세 가이드 링크만 더한다.

- 장점: 변경량이 가장 작다.
- 단점: 사용자가 요청과 예상 결과의 관계를 계속 직접 조합해야 한다.

대안 A를 선택한다.

## 5. 정보 구조

### 5.1 루트 README

기존 설치·정책·기술 정보를 유지하면서 다음 routing 계층을 명확히 한다.

1. **목표별로 바로 시작하기**
   - 기획 학습
   - 규칙·루프·시스템·UX 설계
   - 전체 GDD·프로젝트 기획
   - 관찰 기반 역기획
   - 포트폴리오·면접·직무 전환
   - 현업 검토·제작 전달
2. **요청하면 얻는 결과**
   - 요청 유형
   - 적합한 플러그인
   - 최소 Canonical Artifact
   - 선택 결과
   - 사람 검토 경계
3. **작업 규모별 사용 예시**
   - 10분 실습
   - 단일 과제
   - 포트폴리오 프로젝트
   - 전체 프로젝트
4. **가이드 탐색 지도**
   - 사용자 경로
   - 결과물 카탈로그
   - Studio와 Career 사례집
   - 스킬 워크벤치
   - 제품 FAQ

기존 `이 플러그인으로 할 수 있는 일`, `사용자 유형별 추천 시작점`, `활용 방법 선택`, `5분 빠른 시작`, `상세 사용 가이드`와 의미가 겹치는 부분은 삭제보다 재배치와 짧은 통합을 우선한다. 같은 요청문이나 정책 설명을 두 번 반복하지 않는다.

### 5.2 Studio 제품 README

제품 README의 `활용 경로와 결과`를 권위 있는 제품별 진입점으로 유지한다.

- 규칙·핵심 루프
- 시스템 규칙·상태·예외·데이터
- UX·온보딩·접근성
- 콘텐츠·퀘스트
- 경제·밸런스·LiveOps
- 전체 프로젝트·제작 검토·출력

각 항목은 복사 가능한 짧은 요청, 대표 Artifact와 저장소 상세 가이드 경로를 제공한다. 제품 패키지에는 `guides/`가 포함되지 않으므로 repository checkout only 경로는 클릭 가능한 package-local 링크로 가장하지 않고 일반 텍스트 경로로 표시한다.

### 5.3 Career 제품 README

제품 README의 `활용 시작점`과 `사용 예시`를 다음 목적에 맞춰 정돈한다.

- 직무 탐색과 학습 로드맵
- 관찰 기반 역기획
- 창작 기획 포트폴리오
- 포트폴리오 검토와 발표
- 면접 준비
- 주니어 성장과 직무 전환

현재 사례 표의 증거·owner·root 정보는 유지한다. 대표 결과가 무엇인지와 어느 상세 가이드에서 전체 흐름을 읽는지를 별도 탐색표로 보강한다.

### 5.4 Source와 generated README

- 편집 원본은 `products/game-design-studio/plugin/README.md`와 `products/game-design-career/plugin/README.md`이다.
- `plugins/game-design-studio/README.md`와 `plugins/game-design-career/README.md`는 `npm run build`가 생성한다.
- generated README를 직접 편집하지 않는다.
- 루트 `README.md`는 저장소 종합 허브로 직접 편집한다.

### 5.5 공통·제품별 가이드 README

다음 사용자-facing README도 갱신 범위에 포함한다.

| 문서 | 책임 | 변경 방향 |
| --- | --- | --- |
| `guides/README.md` | 두 제품과 전체 가이드 탐색 | 목표·결과·상세 사례의 종합 진입점을 루트 README와 일치시킨다. |
| `guides/use-cases/README.md` | 공통 활용 허브와 FAQ | 기존 사용자 경로·결과물 카탈로그 링크를 유지하고 새 README routing과 용어를 맞춘다. |
| `guides/game-design-studio/README.md` | Studio 사용자 가이드 인덱스 | 대표 사례·결과와 상세 문서 관계를 루트·제품 README와 일치시킨다. |
| `guides/game-design-career/README.md` | Career 사용자 가이드 인덱스 | 학습·역기획·포트폴리오·면접·성장 결과와 상세 문서 관계를 정돈한다. |
| `guides/game-design-studio/use-cases/README.md` | Studio 활용 사례 인덱스 | 이미 완성된 역량·콘셉트·워크벤치 링크와 결과물 경로가 다른 README와 일치하는지 확인한다. |
| `guides/game-design-career/use-cases/README.md` | Career 활용 사례 인덱스 | 완료된 `concept-scenarios.md`와 `skill-workbench.md`를 실제 링크로 연결하고 `Task 3/4/5 deferred` 문구를 제거한다. |
| `guides/game-design-studio/skills/README.md` | Studio 직접 스킬 선택 | 기존 입력·호출·결과 표를 유지하고 활용 사례·결과물·FAQ로 가는 진입점만 점검한다. |
| `guides/game-design-career/skills/README.md` | Career 직접 스킬 선택 | 기존 입력·호출·결과 표를 유지하고 활용 사례·결과물·FAQ로 가는 진입점을 보강한다. |

`guides/*/skills/README.md`는 이미 15개 스킬의 목적, 입력, 직접 호출과 일반 결과를 소유하므로 사례 본문을 복제하지 않는다. 링크가 충분하면 변경하지 않고 검증만 수행한다.

### 5.6 제외하는 README

다음 README는 사용자 탐색 문서가 아니라 Canonical Artifact 또는 배포 내부 계약이므로 이번 범위에서 수정하지 않는다.

- `products/*/plugin/assets/templates/**/assets/README.md`
- `products/*/plugin/assets/templates/**/decisions/README.md`
- 대응하는 `plugins/*` generated template README
- `shared/templates/canonical-artifact/assets/README.md`
- `shared/contracts/README.md`
- `shared/responsible-design/README.md`
- Skillstead package-local 예제와 vendored README

## 6. 결과물 표현 계약

README의 결과 예시는 다음 세 층을 구분한다.

| 층 | 의미 | 예시 |
| --- | --- | --- |
| 최소 결과 | renderer나 외부 이미지 호출 없이 보존되는 기준 결과 | `content.md`, `evidence.yml`, `decisions/`, manifest |
| 선택 결과 | 요청과 capability가 있을 때 추가되는 검토 자산 | Skillstead SVG·PNG, image prompt package, 생성 이미지 후보 |
| 확장 결과 | renderer와 형식 QA가 확인된 파생 문서 | MD, PDF, DOCX, PPTX |

생성 이미지와 파생 문서는 자동 승인이 아니다. README는 `concept-draft`, `document-approved`, `production-candidate` 경계와 이름 있는 사람의 placement, alt text, evidence, rights/privacy 검토가 필요하다는 기존 정책을 유지한다.

## 7. 링크와 중복 관리

- 루트 README는 저장소 내부 `guides/`를 상대 링크로 연결한다.
- 제품 source README는 설치 패키지에 함께 들어가는 파일만 package-local 링크로 사용한다.
- repository checkout only 가이드는 일반 텍스트 경로로 안내한다.
- 사례의 전체 입력, 스킬 체인, 실패·재개 계약은 기존 사례집과 개별 스킬 가이드가 소유한다.
- README는 대표 요청과 예상 결과만 요약한다.
- 사례 수, 스킬 수, 템플릿 수와 FAQ 수는 기존 검증된 카탈로그와 일치시킨다.

## 8. 검증

README 변경 뒤 다음을 순서대로 확인한다.

1. 새 상대 링크 대상과 heading anchor를 검사한다.
2. 사용자-facing README에 `Task 3`, `Task 4`, `Task 5`, `deferred`, `추가할 예정`처럼 완료 상태와 모순되는 문구가 남지 않았는지 검사한다.
3. `npm run validate:guides`로 가이드 수, 사례, FAQ와 링크 계약을 검증한다.
4. `npm run build`로 제품 source README를 generated snapshot에 동기화한다.
5. source/generated README의 byte 관계와 snapshot drift 검사를 확인한다.
6. README 계약 관련 테스트를 실행한다.
7. `npm test`로 전체 회귀 검증을 실행한다.
8. `git diff --check`와 `git status --short`로 형식 오류와 예상하지 않은 변경을 확인한다.

기존 미추적 `package-lock.json`은 이 작업 범위 밖이며 수정하거나 커밋하지 않는다.

## 9. 완료 기준

- 루트 README에서 3회 이내 링크 이동으로 사용자별 상세 사례 또는 스킬 사용법에 도달할 수 있다.
- 루트 README에 목표별 대표 사용 사례와 작업 규모별 예시가 있다.
- 대표 요청마다 적합한 플러그인과 예상 결과가 명시된다.
- Studio와 Career 제품 README가 각 제품의 대표 활용 사례, 결과와 상세 가이드 경로를 안내한다.
- 공통·제품별 사용자 가이드 README가 같은 목표·결과·상세 문서 관계를 사용한다.
- Career 활용 사례 인덱스가 완성된 대상 사례 10개와 직접 스킬 워크벤치를 실제 링크로 안내하며 과거 `deferred` 상태를 표시하지 않는다.
- 상세 사례 본문을 README에 중복하지 않는다.
- generated 제품 README가 source README와 빌드 계약대로 동기화된다.
- 가이드 검증, 빌드와 테스트가 통과한다.
