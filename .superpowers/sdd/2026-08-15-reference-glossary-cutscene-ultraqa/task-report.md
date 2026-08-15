# 레퍼런스 분석·용어집·컷씬 통합 UltraQA 보고서

## 범위

- 레퍼런스 게임 분석, 게임 기획 용어집, 컷씬 비주얼 프리프로덕션을 루트·제품 README와 사용자 가이드에서 찾고 실행할 수 있는지 검토했다.
- Studio/Career 라우팅, 스킬 메타데이터, `agents/openai.yaml`, 생성 플러그인과 설치 인벤토리의 정합성을 확인했다.
- README 흐름도, Studio/Career Archify 워크플로, ST-S16 컷씬 도식을 실제 이미지로 다시 확인했다.
- `image_gen` 우선, 한글 픽셀 텍스트의 명시적 `gpt-image-2` 선택, `low` 기본·`medium` 선택·`high` 예외 정책이 문서 전반에서 같은 의미로 유지되는지 검증했다.

## 보정 결과

- README 도식의 번역투를 자연스러운 한국어로 고치고 SVG·PNG를 다시 만들었다. `다음 행동이 선명해집니다` 같은 표현은 남아 있지 않다.
- ST-S16은 `style-master → reference-masters → keyframes → storyboard` 네 단계를 같은 시각 위계로 표시한다.
- Studio/Career Archify에 레퍼런스 분석과 용어 검토를 실제 노드·경로로 반영하고, Studio에는 컷씬 4단계와 이미지 생성 정책을 반영했다.
- 두 공통 스킬에 한국어 발견 문구와 `agents/openai.yaml`을 추가하고, source·Career·Studio 스냅샷의 바이트 정합성을 고정했다.
- 동일 바이트의 제품 overlay라도 공통 레퍼런스 분석 스킬 디렉터리를 덮어쓰지 못하도록 패키징 경계를 강화했다.
- OpenAI 이미지 환경 변수 예시는 `IMAGE_PROVIDER=openai`를 명시적으로 선택했을 때만 적용된다는 주석을 루트·제품·가이드에 추가했다.
- 격리 검증의 고정 수치를 실제 공통 인벤토리와 제품별 23/24 스킬 계약으로 보정했다.

## Humanize 검수

- 산출물: `_workspace/2026-08-15-008/final.md`
- 원문 208자, 최종 222자, Levenshtein 거리 102, 변경률 45.95%, 등급 B
- 의미·기능 계약·숫자·제품명·사람 승인 경계를 보존했고 자가검증 6/6을 완료했다.
- 독립 시각 검수: README 2장과 ST-S16 1장 모두 C0/I0/M0.

## 검증 증거

- 집중 통합 묶음: 491/491 통과
- 전체 단위 테스트(단일 동시성): 1,266 통과, 실패 0, Node 18 비목표 1건 명시적 skip
- 전체 계약 테스트: 332/332 통과
- 전체 제품·제품 E2E: 425/425 통과
- 격리·패키지 보강 테스트: 22/22 통과
- 빌드 정합성:
  - Career 534파일, `e90bc5cf678c03c8cb9b54905a9eed6118b834c29818a614140c9d54fb31649b`
  - Studio 546파일, `0fdd36bc40ec04500f50fc0d5c79be03eea2987c0c865f139b6ee984626320b4`
- 공식 검증: plugin 2/2, skill 47/47, marketplace·isolation·guide·Archify catalog·curated Archify·contact sheet 모두 통과
- 도식: use-case SVG 73·PNG 73, 전체 사용자 가이드 SVG 91·PNG 91, prompt guide Markdown 91·projection 2 정합성 통과
- 수정 MJS 구문, JSON 파싱, YAML 공식 검증, `git diff --check`, source/snapshot metadata parity 통과
- 라이브 이미지 provider 호출과 외부 네트워크 사용 없음.

## 독립 판정

- 문서: C0/I0/M0
- 도식·한국어: C0/I0/M0
- plugin-creator: C0/I0/M0
- skill-creator·agent 의미 전진 테스트: PASS, 새 agent 불필요

## 남은 비차단 후속

- 실제 릴리스나 기존 설치본 갱신 시에는 현재 `0.1.0`을 정식 semver로 올리거나 plugin-creator cachebuster를 적용해야 한다.
- 프로세스 강제 종료 중 다중 파일 게시의 crash-wide 원자성, 영구 대기 host callback의 내부 deadline, 반복 flake 전용 운영 하네스는 현재 기능 계약 밖의 별도 복원력 강화 과제로 남긴다.
