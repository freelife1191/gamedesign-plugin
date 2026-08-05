# 대표 형식 검증 결과

검증일: 2026-08-05
상태: **PASS**

이 문서는 Studio와 Career 플러그인의 대표 Canonical Artifact를 실제 여섯 형식으로 생성하고 검증한 결과를 기록한다. MD/PDF/DOCX/PPTX는 문서 export lane이며 SVG/PNG는 Skillstead 시각화 lane이다.

## 검증 사례

| 제품 | 사례 | 원본 근거 | 검증 범위 |
| --- | --- | --- | --- |
| Studio | 라이브 서비스 RPG 경제 운영 브리프 | `tests/e2e/studio/live-service-rpg-economy/` | 경제 루프, 단일 변수 실험, 가드레일, 자동 롤백 |
| Career | 입문 게임 디자이너 12주 로드맵 | `tests/e2e/career/entry-12-week-roadmap/` | 역할 후보, 증거 공백, 12주 실행 리듬, 첫 포트폴리오 브리프 |

각 사례의 `case.json`은 원본 파일 SHA-256, 문서별 한글 앵커, 섹션별 source pointer, 예상 페이지·슬라이드 수를 선언한다. verifier는 원본 drift와 섹션 source pointer의 순서 오류를 fail-closed로 거부한다.

## 산출물 결과

| 형식 | Studio | Career | 검증 |
| --- | --- | --- | --- |
| MD | PASS | PASS | 한글 앵커, source pointer 순서, 로컬 이미지 링크 |
| PDF | PASS · 4페이지 | PASS · 4페이지 | PDF signature, 페이지별 PNG QA, 개별 시각 검사 |
| DOCX | PASS · 4페이지 | PASS · 4페이지 | OOXML 필수 member, 문서 텍스트, source pointer, 전 페이지 QA |
| PPTX | PASS · 6슬라이드 | PASS · 6슬라이드 | Artifact Tool 생성, OOXML, speaker notes source, overflow, 전 슬라이드 QA |
| SVG | PASS · 960×540 viewBox | PASS · 960×540 viewBox | 패키지 내부 Skillstead lint, 한글 앵커 |
| PNG | PASS · 1920×1080 | PASS · 1920×1080 | 패키지 내부 Skillstead 2× render, PNG 구조·크기 |

출력 위치:

- `tests/formats/output/studio-live-service-rpg-economy/`
- `tests/formats/output/career-entry-12-week-roadmap/`

각 디렉터리의 `artifact-manifest.json`은 여섯 산출물의 SHA-256, source binding, runtime class, 페이지·슬라이드 수, Skillstead 및 PPTX 검증 상태를 보관한다.

## 시각 QA

두 사례에서 다음 15개 이미지를 각각 개별 검사했다.

- PDF 4페이지
- DOCX 4페이지
- PPTX 6슬라이드
- Skillstead visualization PNG 1개

총 30개 이미지에서 한글 소실/tofu, clipping, overflow, 빈 페이지·슬라이드, 중복·손상 렌더를 확인했다. Studio와 Career 모두 독립 vision reviewer와 primary reviewer의 승인을 받았다. 승인 목록은 각 artifact manifest의 `visualAttestation`에 기록되어 있으며 verifier가 정확한 15개 경로, PNG 구조, 중복 hash, 페이지·슬라이드 수를 다시 확인한다.

Studio 문서의 source footer는 다음 순서로 검증됐다.

1. `economy + responsibleGates/0`
2. `economy`
3. `experiment`
4. `rollback + responsibleGates/1`

Career 문서의 source footer는 다음 순서로 검증됐다.

1. `availableHoursPerWeek`
2. `roleCandidates + evidenceGaps`
3. `weeks`
4. `firstPortfolioBrief`

## DOCX 한글 QA 경로

DOCX 자체의 OOXML과 한글은 정상이다. 번들 LibreOffice renderer가 임시 `HOME`을 사용하는 환경에서는 사용자 설치 D2Coding을 발견하지 못해 QA 렌더에서 한글이 소실될 수 있었다. 생성물 문제와 renderer 격리 문제를 구분한 뒤 다음 검증 경로를 사용했다.

1. macOS Quick Look이 DOCX를 semantic HTML로 해석한다.
2. form-feed를 명시적인 Letter page break로 변환한다.
3. Chromium이 HTML을 PDF로 인쇄한다.
4. Poppler가 PDF 네 페이지를 PNG로 변환한다.

이 경로는 DOCX 생성 방식이나 문서 내용을 바꾸지 않는 QA adapter다. `qlmanage` 또는 Chromium이 없으면 생성기는 성공을 추정하지 않고 실패한다.

## 재생성 및 검증

```bash
node tests/formats/generate-formats.mjs
node --test \
  tests/formats/archive-inspection.test.mjs \
  tests/formats/docx-qa.test.mjs \
  tests/formats/runtime-resolver.test.mjs \
  tests/formats/verify-formats.test.mjs
node tests/formats/verify-formats.mjs tests/formats/output
npm run validate:release
```

`generate-formats.mjs`는 출력과 QA corpus를 원자적으로 교체하고 새 manifest의 시각 상태를 `pending-individual-inspection`으로 되돌린다. 따라서 재생성 후에는 30개 이미지를 다시 검사하고, 현재 산출물에 대한 승인 증명을 manifest에 기록한 뒤 release 검증을 실행해야 한다.

## 사용한 runtime class

- Codex primary runtime 공식 cache
- Node 24.14.0
- Python 3.12.13
- `@oai/artifact-tool` 2.8.31
- LibreOfficeDev 26.8 계열 capability
- Poppler 26.05 계열
- Google Chrome 151 계열
- D2Coding 1.3.2, SIL OFL 1.1

manifest에는 runtime의 공개 버전과 source class만 기록하고 사용자 홈 또는 절대 설치 경로는 기록하지 않는다.

## 주장 경계

이 PASS는 두 대표 fixture와 현재 hash에 묶인다. 과거 export job의 blocked 상태를 소급해 성공으로 바꾸지 않으며, 아직 실행하지 않은 플레이테스트 결과나 운영 성과를 주장하지 않는다. 다른 입력은 각 플러그인의 capability probe, generation evidence, format QA 및 승인 gate를 새로 통과해야 한다.
