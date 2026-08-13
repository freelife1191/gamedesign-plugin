# 게임 기획 기억 정책

검색 receipt JSON은 `derived/receipts/<request-sha256>/<receipt-sha256>/instances/<instance-id>.json`에 기록한다. request와 receipt의 exact pair는 canonical bytes를 identity로 사용한다. 같은 canonical bytes를 순차 재시도하면 `present`를 재사용한다. 같은 request에서 서로 다른 유효 receipt는 현재값을 고르지 않는 immutable history로 보존한다. 동시 동일 bytes publish는 quota 안에서 동등한 UUID instance를 만들 수 있으며 conflict가 아니다.

개별 receipt는 oversize, claimed hash와 bytes hash 불일치, schema 불일치일 때만 corrupt다. 한 instance의 문제로 다른 유효 receipt를 corrupt로 만들지 않는다. receipt와 log는 `sourceTreeSha256` 입력이 아니다.

identity별 256개와 전역 10,000개 quota는 global-first/local-second `open('wx')` reservation으로 확보한다. quota namespace는 고정 slot만 probe한다. generation/history tree의 directory 256개와 전체 physical census 100,000개는 `opendir()` streaming traversal의 work budget이며 cardinality invariant가 아니다. index/receipt/view/log는 각각 1 MiB/256 KiB/1 MiB/1 MiB 상한을 지키고, receipt의 observations·applied·excluded 배열은 각각 256개를 넘지 않는다.

불완전한 preflight에서는 쓰거나 어떤 generation/history도 선택하지 않는다. 완전한 preflight 뒤 동시 commit이 tripwire를 넘으면 그 commit은 valid이며, 다음 derived operation은 cache reset 전까지 fail-closed한다. 정상 receipt history도 이 보수적인 cache-health 상태를 만들 수 있다. reservation 누수는 cache reset 전까지 사용 가능한 용량만 줄인다.
