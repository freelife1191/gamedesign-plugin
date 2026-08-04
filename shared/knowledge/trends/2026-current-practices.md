# 2026 현재 실무 등록부

검증일은 2026-08-04다. 이 문서는 현재 공식 자료에서 도출한 설계 검토 항목이며 법률 자문, 플랫폼 승인 보장, 업계 전체의 합의를 뜻하지 않는다. 각 영역은 `reviewAfter` 이전에도 정책이나 제품 변경이 있으면 즉시 재확인한다.

## AI 제작: 권리·출처·사람의 승인

```claim
{
  "id": "CUR-AI-001",
  "type": "time-sensitive",
  "basis": "current-external-claim",
  "guidance": "생성형 AI는 조사·초안·프로토타입에 한정해 사용 목적, 입력 권리, 출력 출처와 변경 이력을 남기고, 표현적 선택과 출시 승인은 사람이 담당한다. 연기자나 디지털 복제물이 포함되면 동의와 계약 검토를 별도 게이트로 둔다.",
  "sourceIds": ["EXT-NIST-AI-600-1", "EXT-USCO-AI-PART2", "EXT-SAG-IMA-2025"],
  "applicability": "AI가 텍스트, 코드, 이미지, 음성, 캐릭터 표현 또는 제작 의사결정에 관여하는 프로젝트에 적용한다.",
  "counterexamples": ["권리와 출처를 확인할 수 없는 출력은 사람이 수정했다는 이유만으로 출시 준비 상태가 되지 않는다."],
  "verifiedAt": "2026-08-04",
  "reviewAfter": "2027-02-04",
  "primaryUrls": ["https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf", "https://www.copyright.gov/newsnet/2025/1060.html", "https://www.sagaftra.org/member-message-sag-aftra-members-approve-2025-interactive-media-agreement"],
  "regionScope": "NIST는 자발적 범분야 위험관리 지침, 저작권 자료는 미국, SAG-AFTRA 자료는 해당 Interactive Media Agreement와 조합원 범위",
  "limitations": "저작권 가능성이나 계약 준수를 판정하지 않는다. 모델 약관, 입력 라이선스, 관할권, 단체협약과 프로젝트 계약은 법무·노무 검토가 필요하다."
}
```
## 접근성: 시작 단계부터 대체 경로 설계

```claim
{
  "id": "CUR-ACCESS-001",
  "type": "time-sensitive",
  "basis": "current-external-claim",
  "guidance": "접근성 목표를 설계 시작에 포함하고 자막·텍스트, 색 이외 신호, 입력 재지정과 대체 입력, 난이도·카메라·모션·오디오·인지 옵션을 후보로 검토하며 장애 경험이 있는 플레이어와 시험한다.",
  "sourceIds": ["EXT-XBOX-ACCESS-TOOLKIT", "EXT-ESA-ESSENTIAL-2025"],
  "applicability": "폭넓은 플레이어와 여러 장치를 대상으로 하는 게임의 기획, 프로토타입, QA에 적용한다.",
  "counterexamples": ["체크리스트 기능 수만 늘리고 실제 과업 성공 여부를 시험하지 않는 방식은 접근성 검증을 대신하지 못한다."],
  "verifiedAt": "2026-08-04",
  "reviewAfter": "2027-08-04",
  "primaryUrls": ["https://developer.microsoft.com/en-us/games/articles/2024/05/game-accessibility-workshop-toolkit/", "https://www.theesa.com/resources/essential-facts-about-the-us-video-game-industry/2025-data/"],
  "regionScope": "Xbox 툴킷은 전 세계 개발팀이 조정해 쓸 수 있는 방법론 예시, ESA 자료는 미국 조사 맥락",
  "limitations": "Xbox도 단일 정답이 아닌 조정 가능한 scaffolding임을 명시한다. ESA 수치는 미국 표본이며 개별 장애 경험이나 플랫폼 인증 기준을 대표하지 않는다."
}
```

## LiveOps와 실험: 가설·가드레일·롤백

```claim
{
  "id": "CUR-LIVEOPS-001",
  "type": "time-sensitive",
  "basis": "current-external-claim",
  "guidance": "실험 전에 가설, 대조군, 한 번에 바꿀 변수, 표본과 기간, 성공 지표와 부작용 가드레일, 중지·롤백 조건을 정하고 이벤트의 이름·주체·시각·관련 데이터를 추적한다.",
  "sourceIds": ["EXT-UNITY-AB-TEST", "EXT-PLAYFAB-ANALYTICS"],
  "applicability": "라이브 밸런스, 온보딩, 이벤트, 경제 변경을 일부 플레이어에게 단계적으로 적용할 때 사용한다.",
  "counterexamples": ["매출 하나만 최적화하거나 겹치는 실험을 같은 변수에 실행하면 원인 해석과 플레이어 보호가 약해진다."],
  "verifiedAt": "2026-08-04",
  "reviewAfter": "2027-02-04",
  "primaryUrls": ["https://docs.unity.com/en-us/game-overrides/ab-testing", "https://learn.microsoft.com/en-us/xbox/playfab/data-analytics/ingest-data/real-time-analytics-core-concepts"],
  "regionScope": "Unity Game Overrides와 Microsoft PlayFab 제품 문서의 기능 범위",
  "limitations": "제품 문서는 보편 통계 표준이 아니다. 표본 설계, 다중 검정, 개인정보, 취약 이용자 영향은 별도 전문가 검토가 필요하다."
}
```

## 가상 화폐와 확률형 보상: 실질 가격을 보이게 한다

```claim
{
  "id": "CUR-ECONOMY-001",
  "type": "time-sensitive",
  "basis": "current-external-claim",
  "guidance": "재화의 source·sink·인플레이션과 함께 실질 화폐 환산 가격, 확률과 보장 규칙, 만료·환불·거래 이력, 미성년자 경로, 다단계 화폐의 이해 가능성을 검토한다.",
  "sourceIds": ["EXT-EC-CPC-CURRENCY", "EXT-FTC-HOYOVERSE", "EXT-APPLE-REVIEW"],
  "applicability": "유료 가상 화폐, 확률형 아이템, 기간 한정 판매, 미성년자 이용 가능성이 있는 경제에 적용한다.",
  "counterexamples": ["재화 단위를 여러 번 환전하게 하면서 현금 비용과 확률을 숨기는 설계는 내부 경제 균형만으로 정당화할 수 없다."],
  "verifiedAt": "2026-08-04",
  "reviewAfter": "2027-02-04",
  "primaryUrls": ["https://commission.europa.eu/news-and-media/news/european-commission-hosts-stakeholders-talks-application-cpc-networks-key-principles-games-virtual-2025-06-03_en", "https://www.ftc.gov/news-events/news/press-releases/2025/01/genshin-impact-game-developer-will-be-banned-selling-lootboxes-teens-under-16-without-parental", "https://developer.apple.com/app-store/review/guidelines/"],
  "regionScope": "EU CPC 원칙 맥락, 미국 FTC의 특정 집행 사례, Apple App Store 배포 정책",
  "limitations": "법적 준수 판정이 아니라 법무 검토 trigger다. FTC 자료는 특정 사건의 주장과 명령이고, Apple 지침은 수시 변경되는 플랫폼 정책이다."
}
```

## 크로스플랫폼: 저장보다 넓은 계약

```claim
{
  "id": "CUR-CROSS-001",
  "type": "time-sensitive",
  "basis": "current-external-claim",
  "guidance": "계정, 저장·진행, 입력과 UI, 성능 등급, 매치 공정성, 채팅 안전, 스토어 권한, 업적과 장애 시 복구를 플랫폼별 계약으로 설계한다.",
  "sourceIds": ["EXT-PLAYFAB-FOUNDATION"],
  "applicability": "두 개 이상의 플랫폼에서 동일한 커뮤니티, 진행 또는 경제를 공유하는 게임에 적용한다.",
  "counterexamples": ["단일 플레이 로컬 게임은 통합 계정보다 플랫폼 고유 저장과 입력 품질이 우선일 수 있다."],
  "verifiedAt": "2026-08-04",
  "reviewAfter": "2027-02-04",
  "primaryUrls": ["https://developer.microsoft.com/en-us/games/articles/2026/03/gdc-2026-introducing-foundation-mode-for-playfab/"],
  "regionScope": "Xbox 출판 계약과 PlayFab Foundation Mode Public Preview 제품 범위",
  "limitations": "서비스 소개는 특정 구현 선택지이지 모든 게임의 의무나 성과 보장이 아니다. 각 플랫폼 인증·상거래·개인정보 요건은 별도 확인한다."
}
```

## UGC와 모딩: 창작 범위와 운영 안전을 함께 설계

```claim
{
  "id": "CUR-UGC-001",
  "type": "time-sensitive",
  "basis": "current-external-claim",
  "guidance": "허용 콘텐츠와 권한, 샌드박스·서버 권위, 업로드 검증, 신고·차단·삭제·이의제기, IP·라이선스·수익배분을 출시 전에 정의한다.",
  "sourceIds": ["EXT-STEAM-WORKSHOP", "EXT-APPLE-REVIEW"],
  "applicability": "플레이어가 파일, 레벨, 아이템, 텍스트, 음성 또는 소셜 콘텐츠를 게시하는 기능에 적용한다.",
  "counterexamples": ["무검수 즉시 배포 모델은 대규모 창작을 돕지만 검증 도구와 운영 대응 없이 안전하다고 볼 수 없다."],
  "verifiedAt": "2026-08-04",
  "reviewAfter": "2027-02-04",
  "primaryUrls": ["https://partner.steamgames.com/doc/features/workshop?l=english&language=english", "https://developer.apple.com/app-store/review/guidelines/"],
  "regionScope": "Steam Workshop 통합 모델과 Apple App Store UGC 정책 범위",
  "limitations": "두 플랫폼의 요구를 전체 UGC 생태계의 법적 기준으로 일반화하지 않는다. 관할권, 연령, 콘텐츠 유형, 서버 구조에 따라 별도 검토한다."
}
```

## AI NPC: 생성은 제한하고 결과는 결정론적으로 보호한다

```claim
{
  "id": "CUR-AINPC-001",
  "type": "time-sensitive",
  "basis": "current-external-claim",
  "guidance": "AI NPC의 역할, 상태, 허용 행동, 기억 범위를 제한하고 안전 필터, 결정론적 fallback, 운영 kill switch, 개인정보, 비용·지연 예산을 둔다. 퀘스트·경제·PvP의 권위 결과는 검증 가능한 규칙이 결정한다.",
  "sourceIds": ["EXT-NIST-AI-600-1"],
  "applicability": "생성형 모델이 플레이어 입력에 실시간으로 반응하는 대화나 행동을 만드는 기능에 적용한다.",
  "counterexamples": ["모델 출력이 보상 지급이나 승패를 직접 확정하게 두면 환각, 악용, 재현 불가능성의 영향이 커진다."],
  "verifiedAt": "2026-08-04",
  "reviewAfter": "2027-02-04",
  "primaryUrls": ["https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"],
  "regionScope": "NIST의 자발적 범분야 생성형 AI 위험관리 프로필을 게임 운영에 종합 적용",
  "limitations": "NIST 문서는 게임 NPC 전용 규격이 아니다. 모델·호스팅·연령·지역별 안전 및 개인정보 요구는 별도로 검증한다."
}
```

## 범위 통제: 포함 기준과 중단 기준을 함께 둔다

```claim
{
  "id": "CUR-SCOPE-001",
  "type": "time-sensitive",
  "basis": "current-external-claim",
  "guidance": "후보 기능을 핵심 루프 기여, 제작 노력, 유지비, 의존성, 외부 권리, 프로토타입 가설, kill criteria로 비교하고 must·should·could·won't에 배치한다.",
  "sourceIds": ["EXT-GDC-STATE-2025", "EXT-GDC-STATE-2026"],
  "applicability": "인력·자금 변동이 큰 프로젝트의 기능 승인, 마일스톤, 포트폴리오 샘플 범위를 정할 때 적용한다.",
  "counterexamples": ["설문에서 많이 언급된 기술이나 장르라는 이유만으로 프로젝트 목표와 검증 없이 must에 넣지 않는다."],
  "verifiedAt": "2026-08-04",
  "reviewAfter": "2027-02-04",
  "primaryUrls": ["https://gdconf.com/article/gdc-2025-state-of-the-game-industry-devs-weigh-in-on-layoffs-ai-and-more/", "https://gdconf.com/article/gdc-2026-state-of-the-game-industry-reveals-impact-of-layoffs-generative-ai-and-more/"],
  "regionScope": "GDC가 조사한 게임 업계 종사자 표본과 해당 연도 산업 맥락",
  "limitations": "설문은 표본·역할·지역 편향이 있는 상황 자료이며 규범이나 개별 프로젝트 수요 예측이 아니다. 페이지 본문에서 정확한 게시일은 확인하지 못했다."
}
```
