# export-career-documents

## 목적과 최종 산출물

Career canonical artifact를 MD·PDF·DOCX·PPTX로 전달하기 위한 renderer-neutral non-terminal job manifest를 준비합니다.

## 사용할 때

- portfolio, roadmap, 역기획서, 면접 report 또는 transition report의 형식별 handoff가 필요할 때
- recruiter용 PPTX에 Markdown과 독립된 story outline을 만들 때

## 사용하지 않을 때

- canonical validation이 failed·pending·unevidenced일 때
- 실제 renderer 실행이나 terminal format QA를 이 단계가 수행했다고 주장할 때

## 필수 입력과 선택 입력

- 필수: document type, audience, purpose, artifact root/ID, requested formats와 형식별 capability probe
- PPTX 필수: slide별 message를 가진 독립 story outline
- 선택: locale, 접근성 요구, downstream workflow와 기존 prepared manifest

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Career 승인 가능한 역기획 원본의 MD·PDF·DOCX 작업과 recruiter용 portfolio PPTX 작업을 준비해. 형식별 capability와 pending/unavailable 상태를 분리하고 passed를 미리 쓰지 마.
```

## Codex CLI 요청 예시

```text
$game-design-career:export-career-documents artifact=artifacts/system-reverse-design, formats=md,pdf,docx,pptx, audience=portfolio-reviewer
```

## 내부 진행 흐름

canonical artifact를 먼저 검증하고 형식별 renderer capability를 `unknown`, `available`, `unavailable`로 구분합니다. PPTX는 audience-specific story를 별도로 작성합니다. 설치된 skill directory에서 `node scripts/prepare-career-export.mjs input.json output.json`을 실행한 뒤 trusted document/PDF/presentation workflow로 넘깁니다.

## 생성 파일과 결과 구조

prepared job manifest, 형식별 availability/status, probe evidence와 resumable next action을 반환합니다. 이 단계는 derivative path나 terminal 성공을 반환하지 않습니다. 예상 결과 요약: 원본을 보존한 채 각 형식의 실행 전 상태가 정직하게 준비됩니다.

## 관련 템플릿·품질 프로필·전문 역할

기존 Artifact의 템플릿과 선택된 Quality Profile을 그대로 사용하고, 필요 시 관련 전문 역할의 finding을 evidence와 decision record에 연결합니다. 시작점은 [템플릿 카탈로그](../templates.md)와 [문서 품질 프로필](../document-quality.md)입니다.

## 이미지·도식화 조건

이 스킬은 승인된 이미지와 검증된 Skillstead SVG/2× PNG를 참조할 수 있지만 새 이미지를 만들지 않습니다. 구조 도식은 [Skillstead 도식화](../visualization.md), 삽화는 [이미지 자산 흐름](../image-assets.md)에서 별도 준비합니다.

## 검토·승인 기준

MD는 canonical frontmatter·한 H1·stable heading IDs·NFC·relative asset/alt text, PDF/DOCX는 semantics와 전 페이지 visual QA, PPTX는 독립 story·overflow·전 슬라이드 visual QA가 downstream에서 필요합니다. final derivative는 승인된 asset만 참조합니다.

## 실패·fallback·재개 방법

canonical validation 실패는 `blocked`, probe 전은 `pending/unknown`, 실패한 probe는 `unavailable`입니다. 준비 단계의 `passed`, `failed`, generation·QA evidence는 거부하며 canonical artifact를 덮어쓰지 않습니다.

```text
$game-design-career:export-career-documents 기존 prepared manifest와 canonical artifact를 보존하고 새 capability probe evidence만 반영해 재개해.
```

## 다음 작업 요청문

**복사 가능한 CLI 후속 요청문**

```text
$game-design-career:export-career-documents 기존 Canonical Artifact와 decision/evidence 기록을 유지하고, 현재 blocker 또는 미확정 항목만 확인해 다음 검토 가능한 작업을 진행해.
```

## 관련 문서

[스킬 선택표](README.md), [내보내기 안내](../exports.md), [템플릿 카탈로그](../templates.md), [문제 해결](../troubleshooting.md)
