# Game Design Career 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: career:game-design-career:beginner -->
## career:game-design-career:beginner

**어떤 커리어 스킬을 부를지 모르는 요청을 실행 경로 하나로 정리**

무엇을 써야 할지 모르는 커리어 요청을 route 하나와 영수증으로 바꾼다.

### 간단 요청 예시
```text
@Game Design Career 게임 기획자로 준비를 시작하고 싶은데 어떤 스킬을 불러야 할지 모르겠어. 요청을 다섯 항목으로 정리하고 담당 스킬 하나를 골라 라우팅 영수증을 남겨 줘. 모르는 정보는 미정으로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: game-design-career → orchestrate-game-design-career
- 함께 검토하는 역할: career-strategist

### 이 요청으로 받는 결과
요청을 경력 단계 정리 경로로 보내기로 하고 소유 제품과 실행 경로를 한 줄로 적었습니다. 공개 범위와 결정 담당자는 아직 미정이라 사람이 확인해야 합니다. (ID: career:game-design-career:beginner; 파일: game-design-career/career-entry/beginner/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
게임 기획 커리어를 준비하고 싶지만 어떤 스킬이 그 요청을 맡는지 모를 때 사용한다.

### 사용하지 않는 경우
결과가 하나로 분명한 요청을 굳이 진입 스킬로 우회하거나 사용자가 부르지 않은 스킬을 대신 실행할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- 원하는 최종 결과
- 이미 가진 자료
- 공개 범위
- 사람 결정 담당자
- 출력 형식

#### 선택 입력
- 현재 경력 단계
- 관심 직무
- 마감 조건

### 바꿀 자리표시자
- [원하는 최종 결과]
- [이미 가진 자료]
- [사람 결정 담당자]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [원하는 최종 결과]를 준비하고 싶은데 지금은 [이미 가진 자료]만 있어. 요청을 다섯 항목으로 정리하고 담당 스킬 하나를 골라 [사람 결정 담당자]가 볼 라우팅 영수증을 남겨 줘. 모르는 정보는 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-career:game-design-career 기획자 준비를 어디서부터 시작할지 모르겠어. 요청을 정규화하고 route 하나를 골라 라우팅 영수증으로 남겨.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:game-design-career [원하는 최종 결과]와 [이미 가진 자료]를 정규화하고 route 하나를 골라 [사람 결정 담당자]가 확인할 라우팅 영수증으로 남겨.
```

### 스킬·전문 역할 흐름
- 기본 스킬: game-design-career
- 스킬 흐름: game-design-career → orchestrate-game-design-career
- 전문 역할: career-strategist

### 중간 산출물
- career-stage-goal

### 예상 결과물
#### 최소 결과물
- 정규화된 요청 다섯 항목
- 선택된 route 하나
- 라우팅 영수증
- 다음 사람 결정

#### 선택 결과물
- 미정 항목 목록
- 한 번만 묻는 확인 질문

#### 확장 결과물
- 탈락한 route 후보
- 보류 사유

### 파일 구조
- game-design-career/career-entry/beginner/content.md

### 읽는 순서
- game-design-career/career-entry/beginner/content.md

### 도식 바인딩
- ID: ca-s06
- SVG: guides/assets/game-design-career/skills/orchestrate-game-design-career.svg
- PNG: guides/assets/game-design-career/skills/orchestrate-game-design-career.png
- 대체 텍스트: 게임 기획 커리어 오케스트레이터 흐름도 — 대표 진입은 이 흐름의 앞단

### 사람 검토
#### 승인 경계
career-strategist 결정 담당자가 선택된 route를 승인·수정·보류하며 라우팅은 승인이 아니고 위임된 스킬의 승인 규칙이 그대로 적용된다.

#### 보류 조건
- 원하는 최종 결과가 없음
- 사람 결정 담당자가 없음
- 고른 route가 설치된 스킬 목록에 없음

#### 안전 경계
모르는 정보는 미정으로 남기고 라우팅을 승인이나 합격 약속으로 바꾸지 않는다. Do not request credentials, personal data, or private materials.

### 실패와 재개
```text
career-entry beginner의 정규화된 다섯 항목과 선택된 route를 보존하고 새로 확인된 입력만 반영해 라우팅 영수증 확인부터 재개해.
```

</details>
<!-- PROMPT-CARD: career:game-design-career:standard -->
## career:game-design-career:standard

**여러 준비 과제가 섞인 요청을 담당 제품 하나로 좁히기**

여러 도메인이 섞인 커리어 요청을 owner 하나와 route 하나로 좁힌다.

### 간단 요청 예시
```text
@Game Design Career 포트폴리오 정리, 채용 공고 조사, 면접 준비가 한 번에 섞인 요청이야. 소유 제품 하나와 실행 경로 하나로 좁히고 나머지는 후속 결정으로 남긴 라우팅 영수증을 만들어 줘. 근거가 없는 항목은 미정으로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: game-design-career → orchestrate-game-design-career
- 함께 검토하는 역할: career-strategist

### 이 요청으로 받는 결과
포트폴리오와 면접 준비가 함께 들어온 요청은 경력 단계 정리 경로가 맡고, 공고 조사는 후속 결정으로 미뤘습니다. 두 경로의 우선순위는 결정 담당자가 정해야 합니다. (ID: career:game-design-career:standard; 파일: game-design-career/career-entry/standard/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
포트폴리오·채용 조사·면접 준비가 한 요청에 섞여 있어 소유자와 경로를 하나로 좁혀야 할 때 사용한다.

### 사용하지 않는 경우
섞인 요청을 여러 route로 동시에 펼치거나 근거 없이 유리한 경로를 먼저 고를 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- 요청에 섞인 도메인 목록
- 원하는 최종 결과
- 이미 가진 근거 자료
- 공개 범위
- 사람 결정 담당자

#### 선택 입력
- 우선순위가 높은 도메인
- 출력 형식
- 이미 끝난 검토 기록

### 바꿀 자리표시자
- [요청에 섞인 도메인 목록]
- [원하는 최종 결과]
- [이미 가진 근거 자료]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [요청에 섞인 도메인 목록]이 한 번에 들어 있는 요청이야. [원하는 최종 결과]를 기준으로 소유 제품 하나와 실행 경로 하나로 좁히고 [이미 가진 근거 자료]와의 관계를 라우팅 영수증에 적어 줘. 근거가 없는 항목은 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-career:game-design-career 포트폴리오·채용 조사·면접이 섞인 요청을 소유 제품 하나와 route 하나로 좁히고 나머지는 후속 결정으로 라우팅 영수증에 적어.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:game-design-career [요청에 섞인 도메인 목록]을 [원하는 최종 결과] 기준으로 좁히고 [이미 가진 근거 자료]와의 관계를 라우팅 영수증에 적어.
```

### 스킬·전문 역할 흐름
- 기본 스킬: game-design-career
- 스킬 흐름: game-design-career → orchestrate-game-design-career
- 전문 역할: career-strategist

### 중간 산출물
- career-stage-goal
- portfolio-backlog

### 예상 결과물
#### 최소 결과물
- 소유 제품 하나
- 선택된 route 하나
- 후속 결정으로 미룬 도메인 목록
- 라우팅 영수증

#### 선택 결과물
- 도메인별 우선순위 근거
- 미정 항목 목록

#### 확장 결과물
- 탈락한 route와 탈락 사유
- 다음 사람 결정 대기열

### 파일 구조
- game-design-career/career-entry/standard/content.md

### 읽는 순서
- game-design-career/career-entry/standard/content.md

### 도식 바인딩
- ID: ca-s06
- SVG: guides/assets/game-design-career/skills/orchestrate-game-design-career.svg
- PNG: guides/assets/game-design-career/skills/orchestrate-game-design-career.png
- 대체 텍스트: 게임 기획 커리어 오케스트레이터 흐름도 — 여러 도메인이 섞인 요청도 이 앞단에서 좁힌다

### 사람 검토
#### 승인 경계
career-strategist 결정 담당자가 소유 제품과 실행 경로를 승인·수정·보류하며 라우팅은 승인이 아니고 위임된 스킬의 승인 규칙이 그대로 적용된다.

#### 보류 조건
- 도메인마다 결정 담당자가 다름
- 원하는 최종 결과가 도메인별로 충돌함
- 고른 route가 설치된 스킬 목록에 없음

#### 안전 경계
판단 근거가 없는 도메인 우선순위는 미정으로 남기고 라우팅을 승인이나 합격 약속으로 바꾸지 않는다. Do not request credentials, personal data, or private materials.

### 실패와 재개
```text
career-entry standard의 소유 제품과 좁힌 route를 보존하고 해소된 도메인 충돌 하나만 반영해 후속 결정 목록부터 재개해.
```

</details>
<!-- PROMPT-CARD: career:game-design-career:advanced -->
## career:game-design-career:advanced

**커리어 사례 번호와 제품 사이 근거 요청을 함께 정리**

사례 ID와 교차 제품 인계가 필요한 커리어 요청을 owner·supplier·영수증으로 정리한다.

### 간단 요청 예시
```text
@Game Design Career CA-C07 사례로 시작하고 싶고 기획 산출물 쪽 근거도 필요해. 사례 ID를 실행 경로로 바꾸고 소유자와 공급자를 나눈 라우팅 영수증을 만들어 줘. 상대 제품이 없으면 그 사실을 그대로 적어 줘.
```

### 짧은 흐름
- 작업 순서: game-design-career → orchestrate-game-design-career
- 함께 검토하는 역할: career-strategist

### 이 요청으로 받는 결과
지정한 사례 번호는 이직 준비도 점검 경로로 풀었고, 기획 산출물 근거는 상대 제품에 요청할 항목으로 나눴습니다. 상대 제품 설치 여부를 알 수 없어 요청 발송은 보류했습니다. (ID: career:game-design-career:advanced; 파일: game-design-career/career-entry/advanced/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
사용자가 사례 ID를 부르거나 상대 제품의 근거가 있어야 결과가 나오는 커리어 요청에서 소유자와 공급자를 나눠야 할 때 사용한다.

### 사용하지 않는 경우
존재하지 않는 사례 ID를 이웃 사례로 추측하거나 한 요청에서 인계를 두 번 이상 시작할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- 사례 ID
- 원하는 최종 결과
- 필요한 상대 제품 근거
- 공개 범위
- 사람 결정 담당자

#### 선택 입력
- 상대 제품 설치 여부
- 기존 라우팅 영수증
- 출력 형식

### 바꿀 자리표시자
- [사례 ID]
- [필요한 상대 제품 근거]
- [사람 결정 담당자]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [사례 ID]로 시작하고 [필요한 상대 제품 근거]도 있어야 해. 사례 ID를 실행 경로로 바꾸고 소유자와 공급자를 나눠 [사람 결정 담당자]가 볼 라우팅 영수증을 만들어 줘. 상대 제품이 없으면 그 사실을 그대로 적어 줘.
```

### Codex CLI 완성 예시
```text
$game-design-career:game-design-career CA-C07을 실행 경로로 바꾸고 기획 산출물 근거가 필요한 부분은 공급자 요청으로 나눠 라우팅 영수증에 적어.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:game-design-career [사례 ID]를 실행 경로로 바꾸고 [필요한 상대 제품 근거]는 공급자 요청으로 나눠 라우팅 영수증에 적어.
```

### 스킬·전문 역할 흐름
- 기본 스킬: game-design-career
- 스킬 흐름: game-design-career → orchestrate-game-design-career
- 전문 역할: career-strategist

### 중간 산출물
- career-stage-goal
- transition-readiness

### 예상 결과물
#### 최소 결과물
- 사례 ID를 바꾼 실행 경로
- 소유 제품과 공급 제품 구분
- 인계 필요 여부
- 라우팅 영수증

#### 선택 결과물
- 사례 ID를 찾지 못했을 때의 대체 경로
- 미정 항목 목록

#### 확장 결과물
- 상대 제품 미설치 시 진행 가능한 범위
- 돌려받은 근거를 다시 검사할 항목

### 파일 구조
- game-design-career/career-entry/advanced/content.md

### 읽는 순서
- game-design-career/career-entry/advanced/content.md

### 도식 바인딩
- ID: ca-s06
- SVG: guides/assets/game-design-career/skills/orchestrate-game-design-career.svg
- PNG: guides/assets/game-design-career/skills/orchestrate-game-design-career.png
- 대체 텍스트: 게임 기획 커리어 오케스트레이터 흐름도 — 사례 지정과 교차 제품 인계도 이 앞단에서 정리한다

### 사람 검토
#### 승인 경계
career-strategist 결정 담당자가 사례 해석과 인계 시작 여부를 승인·수정·보류하며 라우팅은 승인이 아니고 위임된 스킬의 승인 규칙이 그대로 적용된다.

#### 보류 조건
- 사례 ID가 카탈로그에 없음
- 상대 제품이 설치되지 않음
- 한 요청에서 인계를 두 번 시작하려 함

#### 안전 경계
찾지 못한 사례와 확인되지 않은 상대 제품 근거는 미정으로 남기고 라우팅을 승인이나 합격 약속으로 바꾸지 않는다. Do not request credentials, personal data, or private materials.

### 실패와 재개
```text
career-entry advanced의 사례 해석과 소유자·공급자 구분을 보존하고 돌려받은 근거 하나만 반영해 인계 재검사부터 재개해.
```

</details>
