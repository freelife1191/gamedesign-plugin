# 게임 기획 기억 수명주기

source event와 human control은 sealed append-only 기록이다. `derived/logs/`는 source event/control의 상태 변경을 보여 주는 Markdown view이며 receipt가 아니다. derived receipt와 log는 `sourceTreeSha256` 입력이 아니다. 기억 후보는 사람의 명시적 approve, reject, retire 지시가 있어야 상태가 바뀌며, 검토 책임자나 도구는 자동 승인 권한을 얻지 않는다.

receipt identity는 request와 receipt의 exact canonical bytes pair다. `derived/receipts/<request-sha256>/<receipt-sha256>/instances/<instance-id>.json`의 순차 동일 bytes 재시도는 `present`이고, 같은 request의 서로 다른 유효 receipt는 immutable history로 남긴다. 동시 동일 bytes publish의 동등 UUID instance는 conflict가 아니다. oversize, claimed hash·bytes hash·schema 불일치는 해당 receipt만 corrupt로 판정한다.

identity 256개와 global 10,000개 quota는 global-first/local-second `open('wx')` reservation으로 지킨다. quota namespace는 fixed slot만 probe한다. generation/history directory 256개와 전체 physical census 100,000개는 `opendir()` streaming traversal의 work budget이지 cardinality invariant가 아니다. index/receipt/view/log의 byte 상한은 1 MiB/256 KiB/1 MiB/1 MiB이고, receipt의 세 배열 상한은 각각 256개다. reservation 누수는 cache reset 전까지 용량만 줄인다.

preflight가 불완전하면 쓰거나 generation/history를 선택하지 않는다. complete preflight 뒤 concurrent commit이 tripwire를 넘으면 그 commit은 valid지만 다음 derived operation은 cache reset 전까지 fail-closed한다. 정상 receipt history도 cache-health를 보수적으로 fail-closed 상태로 만들 수 있다.
