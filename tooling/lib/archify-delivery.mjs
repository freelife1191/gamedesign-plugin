import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, mkdir, open, readFile, readdir, realpath, rename, rmdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { resolveArchifyInstallation } from "../../shared/scripts/capability-probe.mjs";
import { noFollowOpenFlag, openDirectoryHandle } from "../../shared/scripts/lib/platform-file-hardening.mjs";
import { loadArchifyCatalog, publishableArchifyEntries } from "./archify-catalog.mjs";
import { archifyVisualQaArtifactPath, collectArchifyVisualQaRenderPaths, loadArchifyVisualQa } from "./archify-visual-qa.mjs";
import { findStructuralDuplicates } from "./archify-signature.mjs";
import { toPersistedArchifyReceipt, validateArchifyDeliverReceipt, validateArchifyValidateReceipt } from "./archify-receipt.mjs";
import { cleanupGuardedTempRoot, createGuardedTempRoot } from "./guarded-temp.mjs";
import { sha256 } from "./hash.mjs";
import { comparePaths, joinWithin } from "./paths.mjs";

const CURRENT_STAGE = ".tmp/curated-archify/current";
const CATALOG = "guides/archify-diagrams/catalog.json";
const QA_MANIFEST = "guides/archify-diagrams/visual-qa/manifest.json";

// The installed skill is immutable input.  This viewer-only localisation is
// injected into its private execution closure before either CLI phase runs.
const KOREAN_UI = Object.freeze([
  ["Explore this system", "도식 살펴보기"], ["Toggle color theme", "색상 테마 전환"], ["Presentation stage (F)", "프레젠테이션 보기 (F)"], ["Enter Presentation Stage", "프레젠테이션 보기"], ["Enter presentation stage", "프레젠테이션 보기"], ["Exit presentation stage (F or Escape)", "프레젠테이션 끝내기 (F 또는 Esc)"], ["Export diagram (E)", "도식 내보내기 (E)"], ["Export diagram", "도식 내보내기"],
  ["Guided views", "안내 보기"], ["Guided diagram views", "안내 도식 보기"], ["Play story", "이야기 재생"], ["Pause story", "이야기 일시 정지"], ["Replay story", "이야기 다시 재생"], ["Play guided story", "안내 이야기 재생"], ["Show all", "전체 보기"], ["Previous guided view", "이전 안내 보기"], ["Next guided view", "다음 안내 보기"],
  ["Diagram guide", "도식 안내"], ["Open diagram guide", "도식 안내 열기"], ["Close diagram guide", "도식 안내 닫기"], ["Find a node", "노드 찾기"], ["Find any node", "노드 검색"], ["Find start", "시작점 찾기"], ["Search labels or IDs", "라벨 또는 ID 검색"], ["Search diagram nodes", "도식 노드 검색"], ["Diagram nodes", "도식 노드"],
  ["Semantic radar", "의미 레이더"], ["Semantic lens", "의미 렌즈"], ["Semantic passport", "의미 안내서"], ["Route probe", "경로 탐색"], ["Trace a route", "경로 추적"], ["Compare semantic kinds", "의미 유형 비교"], ["Compare system roles", "시스템 역할 비교"],
  ["Legend", "범례"], ["Agent logic", "에이전트 논리"], ["Policy", "정책"], ["Tool action", "도구 작업"], ["Context / trace", "맥락 / 추적"], ["Cloud service", "클라우드 서비스"], ["External system", "외부 시스템"], ["Backend", "백엔드"], ["Cloud", "클라우드"], ["Database", "데이터베이스"], ["External", "외부"], ["Message Bus", "메시지 버스"], ["Security", "보안"],
  ["Verified source", "검증한 출처"], ["Upstream", "이전 단계"], ["Downstream", "다음 단계"], ["Visual identity", "시각 정체성"], ["Style", "스타일"], ["Theme", "테마"], ["Classic", "클래식"], ["Signal Flow", "신호 흐름"], ["SIGNAL FLOW", "신호 흐름"], ["BLUEPRINT / REV 01", "설계도 / 개정 01"], ["EDITORIAL / FIELD NOTE", "편집형 / 현장 기록"], ["ARCHIFY / PLATE 04", "아키파이 / 도판 04"], ["Blueprint", "설계도"], ["Editorial", "편집형"], ["Stable technical default", "안정적인 기술 기본형"], ["Motion-forward presentation", "흐름 중심 프레젠테이션"], ["Engineering review", "기술 검토"], ["Publication and launch notes", "발행 및 출시 노트"],
  ["Present", "발표"], ["Exit", "종료"], ["Export", "내보내기"], ["Dark", "어두움"], ["Light", "밝음"], ["Reset", "초기화"], ["Zoom in", "확대"], ["Zoom out", "축소"], ["Live", "실시간"], ["Ready", "준비"], ["Beat", "장면"], ["Next", "다음"], ["Guided chapter", "안내 장"],
  ["Copy link", "링크 복사"], ["Copy moment", "장면 복사"], ["Copy Share Card", "공유 카드 복사"], ["Copy to clipboard", "클립보드에 복사"], ["Copied", "복사됨"], ["Copy failed", "복사 실패"], ["Close", "닫기"], ["Clear", "지우기"], ["Relations", "관계"], ["Overview", "전체 경로"], ["Journey", "경로 재생"],
  ["Share Card", "공유 카드"], ["Route Share Card", "경로 공유 카드"], ["Reach Share Card", "도달 범위 공유 카드"], ["Download PNG", "PNG 다운로드"], ["Download JPEG", "JPEG 다운로드"], ["Download WebP", "WebP 다운로드"], ["Download SVG", "SVG 다운로드"], ["Download WebM", "WebM 다운로드"],
  ["No matching nodes", "일치하는 노드가 없습니다"], ["Choose a start node", "시작 노드를 선택하세요"], ["Choose the source, then the destination. Direction matters.", "출발 노드와 도착 노드를 순서대로 선택하세요. 방향이 중요합니다."], ["Choose up to two semantic kinds. One reveals its real traffic; two compare only direct authored relationships.", "의미 유형을 두 개까지 선택합니다. 하나는 실제 흐름을 보여 주고, 둘은 직접 작성된 관계만 비교합니다."], ["Pick two semantic nodes on the diagram", "도식에서 의미 노드 두 개를 선택하세요"], ["Search labels, responsibilities, kinds, and stable IDs.", "라벨·책임·유형·고정 ID를 검색합니다."], ["Find a route start", "경로 시작점 찾기"],
  ["Ask how two semantic nodes connect in authored direction.", "두 의미 노드가 작성된 방향으로 어떻게 연결되는지 확인합니다."], ["Authored reach", "작성된 도달 범위"], ["Choose a kind to inspect its nodes and touching relationships.", "유형을 선택해 해당 노드와 연결 관계를 확인합니다."], ["Count roles, reveal their traffic, and compare direct authored links.", "역할 수와 흐름을 확인하고 직접 작성된 연결을 비교합니다."], ["Open Semantic Radar with a live viewport and stable nodes.", "실시간 화면과 고정 노드로 의미 레이더를 엽니다."], ["Play the guided story", "안내 이야기 재생"], ["See the whole system", "전체 시스템 보기"], ["Step through curated paths without changing the source diagram.", "원본 도식을 바꾸지 않고 선별된 경로를 단계별로 살펴봅니다."], ["Walk the authored chapters and real relationships.", "작성된 장과 실제 관계를 따라갑니다."], ["Give the live diagram the viewport without changing export.", "내보내기 결과를 바꾸지 않고 실시간 도식을 화면에 맞춥니다."],
  ["Additional keyboard shortcuts", "추가 키보드 단축키"], ["Choose visual style (S cycles)", "시각 스타일 선택 (S 키로 전환)"], ["Clear route probe", "경로 탐색 지우기"], ["Clear semantic lens", "의미 렌즈 지우기"], ["Close node finder", "노드 찾기 닫기"], ["Close semantic lens", "의미 렌즈 닫기"], ["Close semantic passport", "의미 안내서 닫기"], ["Close semantic radar", "의미 레이더 닫기"], ["Connected relationships", "연결된 관계"], ["Copy link to focused node", "초점 노드 링크 복사"], ["Copy link to semantic lens", "의미 렌즈 링크 복사"], ["Copy link to traced route", "추적 경로 링크 복사"],
  ["Diagram actions", "도식 작업"], ["Diagram exploration actions", "도식 탐색 작업"], ["Diagram guide (?)", "도식 안내 (?)"], ["Diagram overview. Click a node to focus it, or use arrow keys to pan.", "도식 전체 보기입니다. 노드를 클릭해 초점을 맞추거나 방향키로 이동합니다."], ["Diagram view controls", "도식 보기 조작"], ["Direct relationship explorer", "직접 관계 탐색기"], ["Node metadata", "노드 메타데이터"], ["Not supported by this browser", "이 브라우저에서는 지원하지 않습니다"], ["Open semantic lens", "의미 렌즈 열기"], ["Open semantic radar", "의미 레이더 열기"], ["Pause motion", "움직임 일시 정지"], ["Play route journey", "경로 재생"], ["Previous route position", "이전 경로 위치"], ["Next route position", "다음 경로 위치"], ["Route journey controls", "경로 재생 조작"], ["Select a Story Beat to copy its exact link", "장면을 선택해 정확한 링크 복사"],
  ["Semantic diagram radar nodes", "의미 도식 레이더 노드"], ["Semantic kinds", "의미 유형"], ["Semantic legend", "의미 범례"], ["Semantic lens (L)", "의미 렌즈 (L)"], ["Semantic radar (M)", "의미 레이더 (M)"], ["Show complete route overview", "전체 경로 보기"], ["Show connected relationships", "연결된 관계 보기"], ["Show entire diagram", "전체 도식 보기"], ["Story chapters", "이야기 장"], ["Toggle theme (T)", "테마 전환 (T)"], ["Trace a directed route", "방향 경로 추적"], ["Trace authored reachability", "작성된 도달 범위 추적"], ["Trace downstream authored reachability", "다음 단계 도달 범위 추적"], ["Trace route (R)", "경로 추적 (R)"], ["Trace upstream authored reachability", "이전 단계 도달 범위 추적"], ["Traced route", "추적한 경로"], ["Verified source evidence", "검증한 출처 근거"], ["Visual style", "시각 스타일"], ["Zoom in (+)", "확대 (+)"], ["Zoom out (-)", "축소 (-)"],
  ["Use arrow keys to explore relationships. Press Enter or Space to pin details; Escape clears.", "방향키로 관계를 살펴봅니다. Enter 또는 Space로 세부 정보를 고정하고 Esc로 지웁니다."], ["Zoom in again to reveal tags and annotations · reset view (0)", "태그와 주석을 보려면 한 번 더 확대 · 보기 초기화 (0)"], ["Zoom in again to reveal tags and annotations. Reset diagram view", "태그와 주석을 보려면 한 번 더 확대합니다. 도식 보기 초기화"],
  ["Architecture diagram • Archify로 제작", "시스템 구조 도식 • Archify로 제작"], ["Architecture diagram", "시스템 구조 도식"], ["Workflow diagram • Archify로 제작", "워크플로 도식 • Archify로 제작"], ["Data flow diagram • Archify로 제작", "데이터 흐름 도식 • Archify로 제작"], ["Data-flow diagram • Archify로 제작", "데이터 흐름 도식 • Archify로 제작"], ["• Hover to trace •", "• 가리켜 경로 보기 •"], ["route • Click to focus •", "경로 • 클릭하여 초점 맞추기 •"], ["zoom •", "확대/축소 •"], ["radar •", "레이더 •"], ["views •", "안내 보기 •"], ["play story •", "이야기 재생 •"], ["theme •", "테마 •"], ["export", "내보내기"], ["Create yours ↗", "직접 만들기 ↗"],
  ["LENS", "렌즈"], ["MAP", "지도"], ["PATH", "경로"], ["READ 100%", "읽기 100%"], ["FULL", "전체"], ["AUTO", "자동"], ["FULL 100%", "전체 100%"], ["AUTO 100%", "자동 100%"], ["S cycles", "S 키로 전환"], ["Drag to pan", "끌어서 이동"], ["Click node", "노드 클릭"], ["6s motion", "6초 움직임"], ["vector", "벡터"], ["data store", "데이터 저장소"], ["async batch", "비동기 묶음"], ["primary data", "주 데이터"], ["policy / PII", "정책 / 개인정보"],
]);

const REQUIRED_LOCALIZATION_MARKERS = Object.freeze([
  ["assets/template.html", '<strong id="guided-view-label">Explore this system</strong>'],
  ["renderers/shared/legend.mjs", ">Legend<"],
]);

function koreanRuntimeLocalizer() {
  const replacements = JSON.stringify(KOREAN_UI);
  const runtime = String.raw`(function(){
document.documentElement.lang='ko';
const d=new Map(${replacements});
const p=[
[/^(\d+) nodes?$/,'$1개 노드'],[/^(\d+) links?$/,'$1개 연결'],[/^(\d+) stops?$/,'$1개 지점'],[/^(\d+) nodes · full map$/,'$1개 노드 · 전체 지도'],[/^(\d+) semantic nodes · (\d+) relationships · (\d+) guided views$/,'의미 노드 $1개 · 관계 $2개 · 안내 보기 $3개'],
[/^Focus (.+) from Semantic Radar$/,'의미 레이더에서 $1에 초점'],[/^Focus (.+), (\d+) related connections?$/,'$1에 초점 · 관련 연결 $2개'],[/^Focus (.+)$/,'$1에 초점'],[/^Inspect (.+), (\d+) nodes?$/,'$1 살펴보기 · 노드 $2개'],
[/^Inspect relationship (\d+) of (\d+): (.+) to (.+), (.+)\. Press Enter for details\.$/,'관계 $1/$2 살펴보기: $3 → $4, $5. 자세히 보려면 Enter를 누르세요.'],[/^(.+) → (.+) · connects to$/,'$1 → $2 · 연결'],
[/^Open chapter (\d+) of (\d+): (.+)\. Chapter focus delta: (\d+) stay, (\d+) enter, (\d+) leave$/,'장 $1/$2 열기: $3. 초점 변화: 유지 $4, 진입 $5, 이탈 $6'],[/^(.+) — =(\d+) \+(\d+) −(\d+) chapter focus$/,'$1 — 장 초점: 유지 $2, 진입 $3, 이탈 $4'],[/^Chapter (\d+) \/ (\d+)$/,'장 $1 / $2'],
[/^Walk (\d+) authored chapters and their real relationships\.$/,'작성된 장 $1개와 실제 관계를 따라갑니다.'],[/^Visual style: (.+)\. Choose visual style$/,'시각 스타일: $1. 시각 스타일 선택'],[/^(.+), (\d+) nodes?$/,'$1 · 노드 $2개'],[/^(.+) Diagram$/,'$1 도식']
];
const kinds=new Map([['backend','백엔드'],['cloud','클라우드'],['database','데이터베이스'],['external','외부'],['messagebus','메시지 버스'],['security','보안']]);
const c=s=>s.replace(/(content\s*:\s*["'])([^"']+)(["'])/g,(whole,open,label,close)=>{const localized=d.get(label);return localized===undefined?whole:open+localized+close});
const f=s=>{const m=/^(\s*)([\s\S]*?)(\s*)$/.exec(s);let v=d.get(m[2])??m[2];for(const [a,b] of p)v=v.replace(a,b);v=c(v);v=v.replace(/, connects to\. 자세히/,' , 연결. 자세히');v=v.replace(/^(backend|cloud|database|external|messagebus|security)( · )/,(_,k,sep)=>kinds.get(k)+sep);return m[1]+v+m[3]};
const w=n=>{if(n.nodeType===3){const v=f(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v}else if(n.nodeType===1){for(const a of ['aria-label','title','aria-description','data-tooltip','placeholder'])if(n.hasAttribute(a)){const v=f(n.getAttribute(a));if(v!==n.getAttribute(a))n.setAttribute(a,v)}for(const c of n.childNodes)w(c)}};
w(document.documentElement);
new MutationObserver(ms=>ms.forEach(m=>{if(m.type==='attributes')w(m.target);else m.addedNodes.forEach(w)})).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','aria-description','data-tooltip','placeholder']});
})();`;
  return `<script data-archify-ko-localizer>${runtime}</script>`;
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function fileIdentity(stats) {
  return Object.freeze({ dev: stats.dev, ino: stats.ino, mode: stats.mode, size: stats.size, mtimeNs: stats.mtimeNs, ctimeNs: stats.ctimeNs });
}

function sameFileIdentity(left, right) {
  return ["dev", "ino", "mode", "size", "mtimeNs", "ctimeNs"].every((key) => left[key] === right[key]);
}

function directoryIdentity(stats) {
  return Object.freeze({ dev: stats.dev, ino: stats.ino, mode: stats.mode, mtimeNs: stats.mtimeNs, ctimeNs: stats.ctimeNs });
}

function sameDirectoryIdentity(left, right) {
  return ["dev", "ino", "mode", "mtimeNs", "ctimeNs"].every((key) => left[key] === right[key]);
}

function sameMovedDirectoryIdentity(before, after) {
  return before.dev === after.dev && before.ino === after.ino && before.mode === after.mode
    // ctime changes on rename on the supported filesystem; mtime must not.
    && before.mtimeNs === after.mtimeNs;
}

async function directoryRecord(filename, label, root) {
  const requested = path.resolve(filename);
  const stats = await lstat(requested, { bigint: true });
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error(`${label} must be a non-symlink directory`);
  const canonical = await realpath(requested);
  const canonicalRoot = root ? await realpath(path.resolve(root)) : null;
  if (canonicalRoot && !isContained(canonicalRoot, canonical)) throw new Error(`${label} escapes its trusted root`);
  return Object.freeze({ path: canonical, label, identity: directoryIdentity(stats) });
}

async function assertDirectory(record) {
  const stats = await lstat(record.path, { bigint: true });
  if (!stats.isDirectory() || stats.isSymbolicLink() || !sameDirectoryIdentity(record.identity, directoryIdentity(stats)) || await realpath(record.path) !== record.path) {
    throw new Error(`${record.label} identity changed; preserved path: ${record.path}`);
  }
}

function sameDirectorySnapshot(left, right) {
  return sameDirectoryIdentity(left.identity, right.identity)
    && JSON.stringify(left.children) === JSON.stringify(right.children);
}

async function snapshotDirectory(filename, label, root) {
  const requested = path.resolve(filename);
  let handle;
  let primary;
  try {
    const beforePath = await lstat(requested, { bigint: true });
    if (!beforePath.isDirectory() || beforePath.isSymbolicLink()) throw new Error(`${label} must be a non-symlink directory`);
    // A directory handle pins the inode for the whole readdir where the platform has one. Where it does
    // not, the pin is the pair of lstats already bracketing this block: `beforePath` above and
    // `afterPath` below, compared identically. See platform-file-hardening.mjs for what that costs.
    handle = await openDirectoryHandle(requested);
    const before = handle === null ? beforePath : await handle.stat({ bigint: true });
    const children = (await readdir(requested)).sort(comparePaths);
    const after = handle === null ? await lstat(requested, { bigint: true }) : await handle.stat({ bigint: true });
    const canonical = await realpath(requested);
    const afterPath = await lstat(requested, { bigint: true });
    const canonicalRoot = root ? await realpath(path.resolve(root)) : null;
    if (canonicalRoot && !isContained(canonicalRoot, canonical)) throw new Error(`${label} escapes its trusted root`);
    if (!sameDirectoryIdentity(directoryIdentity(beforePath), directoryIdentity(before))
      || !sameDirectoryIdentity(directoryIdentity(before), directoryIdentity(after))
      || !sameDirectoryIdentity(directoryIdentity(before), directoryIdentity(afterPath))) {
      throw new Error(`${label} identity changed while read`);
    }
    const snapshot = Object.freeze({ path: canonical, label, identity: directoryIdentity(before), children: Object.freeze(children) });
    await handle?.close(); handle = null;
    return snapshot;
  } catch (error) { primary = error; }
  try { await handle?.close(); } catch (close) { throw primary ? new AggregateError([primary, close], `${label} read and close failed`) : close; }
  throw primary;
}

async function assertDirectorySnapshot(snapshot) {
  const current = await snapshotDirectory(snapshot.path, snapshot.label, path.dirname(snapshot.path));
  if (!sameDirectorySnapshot(snapshot, current)) throw new Error(`${snapshot.label} identity or child set changed; preserved path: ${snapshot.path}`);
}

async function ancestorRecords(root, leaf, label) {
  const canonicalRoot = path.resolve(root);
  const canonicalLeaf = path.resolve(leaf);
  if (!isContained(canonicalRoot, canonicalLeaf)) throw new Error(`${label} escapes repository`);
  const records = [];
  let current = canonicalRoot;
  records.push(await directoryRecord(current, `${label} ancestor`, canonicalRoot));
  for (const segment of path.relative(canonicalRoot, canonicalLeaf).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    records.push(await directoryRecord(current, `${label} ancestor`, canonicalRoot));
  }
  return Object.freeze(records);
}

async function assertAncestors(records) {
  for (const record of records) await assertDirectory(record);
}

async function snapshotRegular(filename, label) {
  const requested = path.resolve(filename);
  let handle;
  let primary;
  try {
    const beforePath = await lstat(requested, { bigint: true });
    if (!beforePath.isFile() || beforePath.isSymbolicLink()) throw new Error(`${label} must be a regular non-symlink file`);
    handle = await open(requested, fsConstants.O_RDONLY | noFollowOpenFlag());
    const before = await handle.stat({ bigint: true });
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    const canonical = await realpath(requested);
    const afterPath = await lstat(requested, { bigint: true });
    if (!Buffer.isBuffer(bytes) || !sameFileIdentity(fileIdentity(beforePath), fileIdentity(before))
      || !sameFileIdentity(fileIdentity(before), fileIdentity(after)) || !sameFileIdentity(fileIdentity(before), fileIdentity(afterPath))
      || before.size !== BigInt(bytes.byteLength)) throw new Error(`${label} identity changed while read`);
    const snapshot = Object.freeze({ path: canonical, identity: fileIdentity(before), bytes, sha256: sha256(bytes), bytesLength: bytes.byteLength });
    await handle.close();
    handle = null;
    return snapshot;
  } catch (error) {
    primary = error;
  }
  try { await handle?.close(); } catch (close) { throw primary ? new AggregateError([primary, close], `${label} read and close failed`) : close; }
  throw primary;
}

async function assertSnapshotCurrent(snapshot) {
  const current = await snapshotRegular(snapshot.path, "pinned input");
  if (!sameFileIdentity(snapshot.identity, current.identity) || snapshot.sha256 !== current.sha256 || snapshot.bytesLength !== current.bytesLength) {
    throw new Error(`pinned input changed; preserved path: ${snapshot.path}`);
  }
}

async function writeExclusive(filename, bytes, mode = 0o600) {
  await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
  const handle = await open(filename, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | noFollowOpenFlag(), mode);
  try { await handle.writeFile(bytes); } finally { await handle.close(); }
  return snapshotRegular(filename, "private delivery file");
}

function renameForensicError(label, record, target, cause) {
  const identity = record.identity;
  const detail = `expected forensic path: ${target}; original dev=${identity.dev} ino=${identity.ino} mode=${identity.mode} mtimeNs=${identity.mtimeNs} ctimeNs=${identity.ctimeNs}`;
  return new AggregateError([cause instanceof Error ? cause : new Error(String(cause))], `${label} rename is untrusted; ${detail}`);
}

async function snapshotPinnedTree(directory, label) {
  const snapshot = await snapshotDirectory(directory.path, label, path.dirname(directory.path));
  const children = [];
  for (const name of snapshot.children) {
    const child = path.join(snapshot.path, name);
    const stats = await lstat(child, { bigint: true });
    if (stats.isSymbolicLink()) throw new Error(`${label} contains a symlink: ${child}`);
    if (stats.isDirectory()) children.push(Object.freeze({ name, directory: await snapshotPinnedTree(await directoryRecord(child, label, snapshot.path), label) }));
    else if (stats.isFile()) children.push(Object.freeze({ name, file: await snapshotRegular(child, label) }));
    else throw new Error(`${label} contains an unsupported entry: ${child}`);
  }
  await assertDirectorySnapshot(snapshot);
  return Object.freeze({ directory: snapshot, children: Object.freeze(children) });
}

function sameStableDirectoryIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode;
}

function deletionState(snapshot, stableIdentity = snapshot.identity) {
  return Object.freeze({
    path: snapshot.path,
    label: snapshot.label,
    stableIdentity,
    identity: snapshot.identity,
    children: Object.freeze([...snapshot.children]),
  });
}

function withExpectedDeletionChildren(state, children) {
  return Object.freeze({ ...state, children: Object.freeze(children) });
}

function deleteEntryForensicError(label, entry, target, cause) {
  const identity = entryIdentity(entry);
  const detail = `expected forensic path: ${target}; original dev=${identity.dev} ino=${identity.ino} mode=${identity.mode}`;
  return new AggregateError([cause instanceof Error ? cause : new Error(String(cause))], `${label} forensic deletion is untrusted; ${detail}`);
}

async function assertDeletionState(state) {
  const current = await snapshotDirectory(state.path, state.label, path.dirname(state.path));
  if (!sameStableDirectoryIdentity(state.stableIdentity, current.identity)
    || JSON.stringify(state.children) !== JSON.stringify(current.children)) {
    throw new Error(`${state.label} identity or child set changed during bounded deletion; preserved path: ${state.path}`);
  }
  return Object.freeze({ ...state, identity: current.identity });
}

function entryIdentity(entry) {
  return entry.file ? entry.file.identity : entry.directory.identity;
}

function entryTypeMatches(stats, entry) {
  return entry.file ? stats.isFile() && !stats.isSymbolicLink() : stats.isDirectory() && !stats.isSymbolicLink();
}

function sameStableEntryIdentity(entry, stats) {
  const identity = entryIdentity(entry);
  return identity.dev === stats.dev && identity.ino === stats.ino && identity.mode === stats.mode;
}

async function assertOriginalDeleteEntry(entry, parent) {
  const entryPath = path.join(parent.path, entry.name);
  if (entry.file) {
    await assertSnapshotCurrent(entry.file);
    return;
  }
  const current = await snapshotDirectory(entryPath, parent.label, parent.path);
  if (!entryTypeMatches(await lstat(entryPath, { bigint: true }), entry)
    || !sameStableDirectoryIdentity(entry.directory.identity, current.identity)
    || JSON.stringify(current.children) !== JSON.stringify([])) {
    throw new Error(`${parent.label} delete entry changed; preserved path: ${entryPath}`);
  }
}

async function deletePinnedEntry(entry, parent, label, hooks) {
  let current = await assertDeletionState(parent);
  await assertOriginalDeleteEntry(entry, current);
  await invoke(hooks, "before-forensic-delete-rename", { parent: current.path, name: entry.name, label, entry: path.join(current.path, entry.name) });
  current = await assertDeletionState(current);
  await assertOriginalDeleteEntry(entry, current);
  const movedName = `.forensic-delete-${randomUUID()}`;
  const source = path.join(current.path, entry.name);
  const moved = path.join(current.path, movedName);
  const movedChildren = current.children.map((name) => name === entry.name ? movedName : name).sort(comparePaths);
  try {
    await rename(source, moved);
    await invoke(hooks, "after-forensic-delete-rename", { parent: current.path, name: entry.name, label, source, moved });
    const movedStats = await lstat(moved, { bigint: true });
    if (!entryTypeMatches(movedStats, entry) || !sameStableEntryIdentity(entry, movedStats)) {
      throw new Error(`${label} moved entry identity mismatch`);
    }
    current = await assertDeletionState(withExpectedDeletionChildren(current, movedChildren));
    const finalChildren = current.children.filter((name) => name !== movedName);
    await rmdirOrUnlink(entry, moved);
    return assertDeletionState(withExpectedDeletionChildren(current, finalChildren));
  } catch (error) {
    throw deleteEntryForensicError(label, entry, moved, error);
  }
}

async function assertVerifiedMissing(filename, label) {
  try {
    await lstat(filename, { bigint: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`${label} target is not verified ENOENT; preserved path: ${filename}`);
}

async function rmdirOrUnlink(entry, moved) {
  const stats = await lstat(moved, { bigint: true });
  if (!entryTypeMatches(stats, entry) || !sameStableEntryIdentity(entry, stats)) throw new Error(`forensic delete entry identity mismatch: ${moved}`);
  if (entry.file) await unlink(moved);
  else await rmdir(moved);
}

async function deletePinnedTree(tree, parent, name, label, hooks) {
  let current = deletionState(tree.directory);
  for (const child of tree.children) {
    if (child.file) current = await deletePinnedEntry(child, current, label, hooks);
    else current = await deletePinnedTree(child.directory, current, child.name, label, hooks);
  }
  const rootEntry = Object.freeze({ name, directory: Object.freeze({ ...tree.directory, children: Object.freeze([]) }) });
  return deletePinnedEntry(rootEntry, parent, label, hooks);
}

async function removePinnedTree(record, parent, label, hooks) {
  const quarantine = path.join(parent.path, `.${label}-quarantine-${randomUUID()}`);
  const quarantined = await renameDirectory(record, quarantine, parent, `${label} quarantine`, parent.path, hooks);
  let tree;
  try {
    tree = await snapshotPinnedTree(quarantined, `${label} quarantine`);
    await invoke(hooks, "before-quarantine-delete", { quarantine: quarantined.path, label });
    const quarantineParent = deletionState(await snapshotDirectory(parent.path, parent.label, path.dirname(parent.path)), parent.identity);
    await deletePinnedTree(tree, quarantineParent, path.basename(quarantined.path), label, hooks);
  } catch (error) {
    throw new AggregateError([error], `${label} quarantine cleanup failed; forensic path: ${quarantined.path}`);
  }
}

async function renameDirectory(record, target, parent, label, targetRoot = parent.path, hooks, onRenamed) {
  await assertDirectory(record);
  await assertDirectory(parent);
  try {
    await rename(record.path, target);
    await onRenamed?.();
    await invoke(hooks, "after-rename", { source: record.path, target, label });
    const moved = await directoryRecord(target, label, targetRoot);
    if (!sameMovedDirectoryIdentity(record.identity, moved.identity)) throw new Error(`${label} moved identity mismatch`);
    return moved;
  } catch (error) {
    throw renameForensicError(label, record, target, error);
  }
}

async function invoke(hooks, name, context) {
  await hooks?.[name]?.(Object.freeze(context));
}

async function finalizeTemp(temp, result, primary, hooks) {
  let cleanup;
  try {
    await invoke(hooks, "before-temp-cleanup", { temp: temp.root });
    await invoke(hooks, "fail-temp-cleanup", { temp: temp.root });
    await cleanupGuardedTempRoot(temp);
  } catch (error) { cleanup = error; }
  if (primary && cleanup) throw new AggregateError([primary, cleanup], "Archify operation and temporary cleanup failed");
  if (primary) throw primary;
  if (cleanup) throw new AggregateError([cleanup], "Archify operation succeeded but temporary cleanup failed");
  return result;
}

async function repoRootRecord(repoRoot) {
  const root = path.resolve(repoRoot);
  return directoryRecord(root, "repository root", root);
}

function selectEntries(catalog, { ids = [], product = null, publishable = false } = {}) {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || id.length === 0)) throw new Error("ids must be non-empty strings");
  if (product !== null && !["studio", "career", "suite"].includes(product)) throw new Error("product must be studio, career, or suite");
  const requested = new Set(ids);
  const source = publishable
    ? publishableArchifyEntries(catalog)
    : catalog.entries.filter((entry) => entry.decision === "selected" && !entry.delivery_status.startsWith("blocked-") && entry.delivery_status !== "stale-source");
  const result = source.filter((entry) => (!requested.size || requested.has(entry.id)) && (product === null || entry.product === product)).sort((a, b) => comparePaths(a.id, b.id));
  if (!result.length && requested.size) throw new Error("no Archify entries selected");
  if (requested.size && result.length !== requested.size) throw new Error("requested Archify id is not selected");
  return result;
}

async function loadCatalogSnapshot(root) {
  const snapshot = await snapshotRegular(joinWithin(root.path, CATALOG, "Archify catalog"), "Archify catalog");
  const catalog = await loadArchifyCatalog({ repoRoot: root.path });
  await assertSnapshotCurrent(snapshot);
  return { catalog, snapshot };
}

async function pinCli(env, options) {
  const installation = await resolveArchifyInstallation(env, options);
  if (installation.status !== "available") throw new Error(`Archify CLI is ${installation.status}`);
  const snapshot = await snapshotRegular(installation.cli.path, "Archify CLI");
  if (snapshot.identity.dev !== installation.cli.dev || snapshot.identity.ino !== installation.cli.ino || snapshot.identity.size !== installation.cli.size || snapshot.sha256 !== installation.cli.sha256) {
    throw new Error("Archify CLI identity disagrees with Task 5 pin");
  }
  return snapshot;
}

async function copyClosureDirectory(source, destination, sourceRoot, manifest) {
  const sourceDirectory = await snapshotDirectory(source, "Archify execution closure source directory", sourceRoot);
  await mkdir(destination, { recursive: true, mode: 0o700 });
  for (const name of sourceDirectory.children) {
    const sourceChild = path.join(sourceDirectory.path, name);
    const destinationChild = path.join(destination, name);
    const relative = path.relative(sourceRoot, sourceChild).split(path.sep).join("/");
    const stats = await lstat(sourceChild, { bigint: true });
    if (stats.isSymbolicLink()) throw new Error(`Archify execution closure contains a symlink: ${relative}`);
    if (stats.isDirectory()) await copyClosureDirectory(sourceChild, destinationChild, sourceRoot, manifest);
    else if (stats.isFile()) {
      const sourceSnapshot = await snapshotRegular(sourceChild, "Archify execution closure file");
      const copySnapshot = await writeExclusive(destinationChild, sourceSnapshot.bytes);
      if (sourceSnapshot.sha256 !== copySnapshot.sha256 || sourceSnapshot.bytesLength !== copySnapshot.bytesLength) throw new Error(`Archify closure copy mismatch: ${relative}`);
      manifest.files.push(Object.freeze({ relative, source: sourceSnapshot, copy: copySnapshot }));
    } else throw new Error(`Archify execution closure has unsupported entry: ${relative}`);
  }
  await assertDirectorySnapshot(sourceDirectory);
  const copiedDirectory = await snapshotDirectory(destination, "private Archify execution closure directory", path.dirname(destination));
  if (JSON.stringify(sourceDirectory.children) !== JSON.stringify(copiedDirectory.children)) throw new Error(`Archify closure child set mismatch: ${sourceDirectory.path}`);
  manifest.directories.push(Object.freeze({ relative: path.relative(sourceRoot, sourceDirectory.path).split(path.sep).join("/"), source: sourceDirectory, copy: copiedDirectory }));
}

function replaceOnce(bytes, expected, replacement, label) {
  const text = bytes.toString("utf8");
  const count = text.split(expected).length - 1;
  if (count !== 1) throw new Error(`Archify Korean localization requires exactly one ${label} marker; found ${count}`);
  return Buffer.from(text.replace(expected, replacement));
}

function replaceOptionalOnce(bytes, expected, replacement, label) {
  const text = bytes.toString("utf8");
  const count = text.split(expected).length - 1;
  if (count > 1) throw new Error(`Archify Korean localization requires at most one ${label} marker; found ${count}`);
  return Buffer.from(count === 1 ? text.replace(expected, replacement) : text);
}

async function localizeExecutionClosure(manifest) {
  const files = new Map(manifest.files.map((record) => [record.relative, record]));
  for (const [relative, marker] of REQUIRED_LOCALIZATION_MARKERS) {
    const record = files.get(relative);
    if (!record) throw new Error(`Archify Korean localization closure file is missing: ${relative}`);
    const source = await readFile(record.copy.path);
    if (source.toString("utf8").split(marker).length - 1 !== 1) {
      throw new Error(`Archify Korean localization requires exactly one ${relative} marker`);
    }
  }
  const template = files.get("assets/template.html");
  const cli = files.get("renderers/shared/cli.mjs");
  const legend = files.get("renderers/shared/legend.mjs");
  const localizedTemplate = replaceOnce(await readFile(template.copy.path), "</body>", `${koreanRuntimeLocalizer()}</body>`, "template closing body");
  await writeFile(template.copy.path, localizedTemplate);
  // Archify 2.14 removed its promotional footer. Older releases still carry
  // the marker, so localize it when present while keeping the structural
  // output guards below exact and mandatory for every supported release.
  let localizedCli = replaceOptionalOnce(await readFile(cli.copy.path), "Built with Archify", "Archify로 제작", "CLI footer");
  localizedCli = replaceOnce(localizedCli, "fs.writeFileSync(outPath, applyTemplate(template, {", "const localizedTemplate = applyTemplate(template, {", "CLI output start");
  localizedCli = replaceOnce(localizedCli, "  }));\n  outputPathGuards.delete(outPath);", "  });\n  fs.writeFileSync(outPath, localizedTemplate.replace('<html lang=\"en\"', '<html lang=\"ko\"'));\n  outputPathGuards.delete(outPath);", "CLI output finish");
  await writeFile(cli.copy.path, localizedCli);
  await writeFile(legend.copy.path, replaceOnce(await readFile(legend.copy.path), ">Legend<", ">범례<", "legend title"));
  manifest.files = await Promise.all(manifest.files.map(async (record) => Object.freeze({ ...record, copy: await snapshotRegular(record.copy.path, "localized Archify execution closure file") })));
}

async function snapshotExecutionClosure(cliSource, destination, hooks) {
  const sourceRoot = path.dirname(path.dirname(cliSource.path));
  if (path.basename(path.dirname(cliSource.path)) !== "bin" || path.basename(cliSource.path) !== "archify.mjs") {
    throw new Error("Task 5 CLI path is outside the fixed Archify execution closure");
  }
  const manifest = { directories: [], files: [] };
  await copyClosureDirectory(sourceRoot, destination, sourceRoot, manifest);
  await localizeExecutionClosure(manifest);
  await invoke(hooks, "after-closure-copy", { sourceRoot, closure: destination });
  for (const record of manifest.directories) await assertDirectorySnapshot(record.source);
  for (const record of manifest.files) await assertSnapshotCurrent(record.source);
  const cli = manifest.files.find((record) => record.relative === "bin/archify.mjs")?.copy;
  if (!cli) throw new Error("Archify execution closure is incomplete");
  const copiedRoot = manifest.directories.find((record) => record.relative === "")?.copy;
  if (!copiedRoot) throw new Error("Archify execution closure root is incomplete");
  return Object.freeze({
    sourceRoot,
    copiedRoot,
    directories: Object.freeze(manifest.directories.sort((left, right) => comparePaths(left.relative, right.relative))),
    files: Object.freeze(manifest.files.sort((left, right) => comparePaths(left.relative, right.relative))),
    cli,
  });
}

async function assertExecutionClosure(closure) {
  for (const record of closure.directories) await assertDirectorySnapshot(record.copy);
  for (const record of closure.files) await assertSnapshotCurrent(record.copy);
}

async function runCli(cli, closure, args, ancestors, hooks, phase, context) {
  await assertExecutionClosure(closure);
  await assertSnapshotCurrent(cli);
  await assertAncestors(ancestors);
  await invoke(hooks, `before-${phase}-spawn`, { ...context, cli: cli.path, assertAncestors: () => assertAncestors(ancestors) });
  await assertExecutionClosure(closure);
  await assertSnapshotCurrent(cli);
  await assertAncestors(ancestors);
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli.path, ...args], { cwd: closure.copiedRoot.path, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
  await assertExecutionClosure(closure);
  await assertSnapshotCurrent(cli);
  await assertAncestors(ancestors);
  if (result.code !== 0 || result.signal) throw new Error(`Archify ${phase} failed: ${result.stderr || result.stdout || result.signal || result.code}`);
  try { return JSON.parse(result.stdout); } catch { throw new Error(`Archify ${phase} emitted invalid JSON`); }
}

function bindValidate(receipt, entry, input) {
  validateArchifyValidateReceipt(receipt);
  if (receipt.type !== entry.diagram_type) throw new Error("receipt type does not match selected entry");
  if (receipt.input !== input) throw new Error("receipt input does not match pinned spec");
}

function bindDeliver(receipt, entry, input, output, spec, artifact) {
  validateArchifyDeliverReceipt(receipt, { specification: spec.bytes, artifact: artifact.bytes });
  if (receipt.type !== entry.diagram_type) throw new Error("receipt type does not match selected entry");
  if (receipt.input !== input) throw new Error("receipt input does not match pinned spec");
  if (receipt.output !== output) throw new Error("receipt output does not match pinned HTML");
}

async function sourceSnapshot(root, entry) {
  const snapshot = await snapshotRegular(joinWithin(root, entry.source_document, "Archify source"), "Archify source");
  if (snapshot.sha256 !== entry.source_digest) throw new Error(`source or catalog drift: ${entry.source_document}`);
  return snapshot;
}

function outputRelative(entry, field) {
  const prefix = "guides/assets/archify/";
  if (!entry[field].startsWith(prefix)) throw new Error(`invalid managed ${field} path`);
  return entry[field].slice(prefix.length);
}

async function deliverRecord({ root, temp, closure, entry, hooks }) {
  const spec = await snapshotRegular(joinWithin(root.path, entry.spec, "committed Archify spec"), "committed Archify spec").catch((error) => {
    if (error?.code === "ENOENT") throw new Error(`missing committed Archify spec: ${entry.spec}`);
    throw error;
  });
  try { JSON.parse(spec.bytes.toString("utf8")); } catch { throw new Error(`committed Archify spec is invalid JSON: ${entry.spec}`); }
  const source = await sourceSnapshot(root.path, entry);
  const workflowPath = path.join(temp.root, "workflow", entry.id);
  await mkdir(path.join(workflowPath, "exec"), { recursive: true, mode: 0o700 });
  await mkdir(path.join(workflowPath, "output"), { recursive: true, mode: 0o700 });
  const copiedCli = closure.cli;
  const privateSpec = await writeExclusive(path.join(workflowPath, "exec", "spec.json"), spec.bytes);
  if (privateSpec.sha256 !== spec.sha256) throw new Error("private spec copy does not match committed bytes");
  const ancestors = await ancestorRecords(root.path, path.join(workflowPath, "exec"), "delivery workflow");
  const html = path.join(workflowPath, "output", `${entry.id}.html`);
  const context = { entry, workflow: workflowPath, html, closure: closure.copiedRoot.path };
  const validate = await runCli(copiedCli, closure, ["validate", entry.diagram_type, privateSpec.path, "--quality", "showcase", "--json"], ancestors, hooks, "validate", context);
  bindValidate(validate, entry, privateSpec.path);
  await invoke(hooks, "after-validate", { ...context, assertAncestors: () => assertAncestors(ancestors) });
  await invoke(hooks, "replace-cli-after-validate", context);
  await invoke(hooks, "swap-stage-parent-and-restore", context);
  const deliver = await runCli(copiedCli, closure, ["deliver", entry.diagram_type, privateSpec.path, html, "--quality", "showcase", "--json"], ancestors, hooks, "deliver", context);
  await invoke(hooks, "after-deliver", context);
  await invoke(hooks, "symlink-delivered-html", context);
  await invoke(hooks, "nondeterministic-deliver", context);
  const artifact = await snapshotRegular(html, "delivered Archify HTML");
  bindDeliver(deliver, entry, privateSpec.path, html, spec, artifact);
  return Object.freeze({ entry, spec, source, artifact, receipt: toPersistedArchifyReceipt(deliver, { input: entry.spec, output: entry.html }, { specification: spec.bytes, artifact: artifact.bytes }) });
}

async function validateRecordInputs(records, catalogSnapshot) {
  await assertSnapshotCurrent(catalogSnapshot);
  for (const record of records) {
    await assertSnapshotCurrent(record.spec);
    await assertSnapshotCurrent(record.source);
  }
}

function validateExactStructuralSignatures(catalog, records) {
  const specs = new Map(records.map((record) => [record.entry.id, JSON.parse(record.spec.bytes.toString("utf8"))]));
  const duplicates = findStructuralDuplicates({ catalog, specsById: specs });
  if (duplicates.length) throw new Error(`duplicate structural signature: ${duplicates[0].ids.join(", ")}`);
}

async function createTemp(root) {
  const tmpPath = path.join(root.path, ".tmp");
  await mkdir(tmpPath, { recursive: true, mode: 0o700 });
  const tmp = await directoryRecord(tmpPath, ".tmp", root.path);
  await assertDirectory(tmp);
  return createGuardedTempRoot({ parent: tmp.path, prefix: "curated-archify-" });
}

async function writeRecords(root, records) {
  for (const record of records) {
    const html = path.join(root, outputRelative(record.entry, "html"));
    const receipt = path.join(root, outputRelative(record.entry, "receipt"));
    await mkdir(path.dirname(html), { recursive: true, mode: 0o700 });
    await writeExclusive(html, record.artifact.bytes);
    await writeExclusive(receipt, Buffer.from(`${JSON.stringify(record.receipt, null, 2)}\n`));
  }
}

async function managedFileSet(root) {
  const stats = await lstat(root).catch((error) => error.code === "ENOENT" ? null : Promise.reject(error));
  if (!stats) return [];
  const record = await directoryRecord(root, "managed tree", path.dirname(root));
  async function visit(directory, prefix = "") {
    const entries = await readdir(directory, { withFileTypes: true });
    const output = [];
    for (const entry of entries.sort((a, b) => comparePaths(a.name, b.name))) {
      const child = path.join(directory, entry.name); const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const childStats = await lstat(child);
      if (childStats.isSymbolicLink()) throw new Error(`managed output contains a symlink: ${relative}`);
      if (childStats.isDirectory()) output.push(...await visit(child, relative));
      else if (childStats.isFile()) output.push(relative);
      else throw new Error(`managed output has unsupported entry: ${relative}`);
    }
    return output;
  }
  await assertDirectory(record);
  return visit(record.path);
}

function expectedSet(entries) {
  return entries.flatMap((entry) => [outputRelative(entry, "html"), outputRelative(entry, "receipt")]).sort(comparePaths);
}

async function compareRecords(root, records) {
  for (const record of records) {
    const artifact = await snapshotRegular(path.join(root, outputRelative(record.entry, "html")), "managed HTML");
    const receipt = await snapshotRegular(path.join(root, outputRelative(record.entry, "receipt")), "managed receipt");
    if (!artifact.bytes.equals(record.artifact.bytes) || !receipt.bytes.equals(Buffer.from(`${JSON.stringify(record.receipt, null, 2)}\n`))) throw new Error(`managed output bytes drift: ${record.entry.id}`);
  }
}

async function assertExactManagedTree(root, entries, records = []) {
  const actual = await managedFileSet(root);
  const expected = expectedSet(entries);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("managed output exact set is stale or incomplete");
  await compareRecords(root, records);
}

async function loadPublishedRecords(root, entries) {
  const records = [];
  for (const entry of entries) {
    const spec = await snapshotRegular(joinWithin(root, entry.spec, "published committed Archify spec"), "published committed Archify spec");
    const artifact = await snapshotRegular(joinWithin(root, entry.html, "published Archify HTML"), "published Archify HTML");
    const receiptSnapshot = await snapshotRegular(joinWithin(root, entry.receipt, "published Archify receipt"), "published Archify receipt");
    let receipt;
    try { receipt = JSON.parse(receiptSnapshot.bytes.toString("utf8")); } catch { throw new Error(`published receipt is invalid JSON: ${entry.id}`); }
    if (receipt?.schemaVersion !== 1 || receipt.ok !== true || receipt.command !== "deliver"
      || receipt.type !== entry.diagram_type || receipt.input !== entry.spec || receipt.output !== entry.html
      || receipt.specification?.sha256 !== spec.sha256 || receipt.specification?.bytes !== spec.bytesLength
      || receipt.artifact?.sha256 !== artifact.sha256 || receipt.artifact?.bytes !== artifact.bytesLength) {
      throw new Error(`published receipt does not bind exact managed bytes: ${entry.id}`);
    }
    records.push(Object.freeze({ entry, spec, artifact, receipt }));
  }
  return records;
}

async function qaBindings(root, records, catalog, hooks = {}) {
  if (!records.length) return;
  const qaRoot = path.join(root, "guides", "archify-diagrams", "visual-qa");
  const ancestors = Object.freeze([
    await directoryRecord(path.join(root, "guides", "archify-diagrams"), "visual QA evidence parent", root),
    await directoryRecord(qaRoot, "visual QA evidence root", path.join(root, "guides", "archify-diagrams")),
  ]);
  const manifest = await snapshotRegular(joinWithin(root, QA_MANIFEST, "visual QA manifest"), "visual QA manifest");
  let raw; try { raw = JSON.parse(manifest.bytes.toString("utf8")); } catch { throw new Error("visual QA manifest is invalid JSON"); }
  await invoke(hooks, "before-qa-render-snapshot", { manifest });
  const renderPaths = collectArchifyVisualQaRenderPaths(raw);
  const renderFiles = renderPaths.map((relative) => joinWithin(qaRoot, relative, "visual QA render"));
  const renderAncestors = await Promise.all(renderFiles.map((filename) => ancestorRecords(qaRoot, path.dirname(filename), "visual QA render")));
  const renders = await Promise.all(renderFiles.map((filename) => snapshotRegular(filename, "visual QA render")));
  for (const records of renderAncestors) await assertAncestors(records);
  const renderSnapshots = new Map(renderPaths.map((relative, index) => [relative, renders[index].bytes]));
  const artifactSnapshots = new Map(records.map((record) => [record.entry.id, record.artifact.bytes]));
  const catalogById = new Map(catalog.entries.map((entry) => [entry.id, entry]));
  const blockedEntries = Array.isArray(raw.entries)
    ? raw.entries.map((entry) => catalogById.get(entry?.id)).filter((entry) => entry?.delivery_status === "blocked-visual" && !artifactSnapshots.has(entry.id))
    : [];
  const blockedArtifactFiles = blockedEntries.map((entry) => joinWithin(root, archifyVisualQaArtifactPath(entry), "blocked visual QA artifact"));
  const blockedArtifactAncestors = await Promise.all(blockedArtifactFiles.map((filename) => ancestorRecords(qaRoot, path.dirname(filename), "blocked visual QA artifact")));
  for (const records of blockedArtifactAncestors) await assertAncestors(records);
  const blockedArtifacts = await Promise.all(blockedArtifactFiles.map((filename) => snapshotRegular(filename, "blocked visual QA artifact")));
  for (const [index, entry] of blockedEntries.entries()) artifactSnapshots.set(entry.id, blockedArtifacts[index].bytes);
  const loaded = await loadArchifyVisualQa({ repoRoot: root, catalog, manifestBytes: manifest.bytes, renderSnapshots, artifactSnapshots });
  await invoke(hooks, "after-qa-snapshot", { manifest, renders, blockedArtifacts, qaRoot });
  for (const record of records) {
    const entry = loaded.qa.entries.find((candidate) => candidate.id === record.entry.id);
    if (!entry || entry.reviewer !== record.entry.reviewer || entry.specification_sha256 !== record.spec.sha256 || entry.artifact_sha256 !== record.artifact.sha256) throw new Error(`visual QA binding does not match: ${record.entry.id}`);
  }
  return Object.freeze({
    manifest,
    renders: Object.freeze(renders),
    blockedArtifacts: Object.freeze(blockedArtifacts),
    ancestors,
    renderAncestors: Object.freeze(renderAncestors),
    blockedArtifactAncestors: Object.freeze(blockedArtifactAncestors),
  });
}

async function assertQaSnapshotCurrent(snapshot) {
  if (!snapshot) return;
  await assertAncestors(snapshot.ancestors);
  for (const records of snapshot.renderAncestors) await assertAncestors(records);
  for (const records of snapshot.blockedArtifactAncestors) await assertAncestors(records);
  await assertSnapshotCurrent(snapshot.manifest);
  for (const render of snapshot.renders) await assertSnapshotCurrent(render);
  for (const artifact of snapshot.blockedArtifacts) await assertSnapshotCurrent(artifact);
}

async function stageCommit({ root, temp, catalog, catalogSnapshot, records, hooks }) {
  const candidatePath = path.join(temp.root, "candidate");
  await mkdir(candidatePath, { mode: 0o700 });
  await writeRecords(candidatePath, records);
  const candidate = await directoryRecord(candidatePath, "stage candidate", temp.root);
  const parentPath = path.join(root.path, ".tmp", "curated-archify");
  await mkdir(parentPath, { recursive: true, mode: 0o700 });
  let parent = await directoryRecord(parentPath, "stage parent", root.path);
  const currentPath = path.join(parent.path, "current");
  const existing = await lstat(currentPath).catch((error) => error.code === "ENOENT" ? null : Promise.reject(error));
  let backup; let current;
  try {
    await validateRecordInputs(records, catalogSnapshot); validateExactStructuralSignatures(catalog, records);
    if (existing) {
      backup = await renameDirectory(await directoryRecord(currentPath, "current stage", parent.path), path.join(parent.path, `.current-backup-${randomUUID()}`), parent, "stage backup", parent.path, hooks);
      parent = await directoryRecord(parent.path, "stage parent", root.path);
    }
    current = await renameDirectory(candidate, currentPath, parent, "current stage", root.path, hooks);
    parent = await directoryRecord(parent.path, "stage parent", root.path);
    await assertExactManagedTree(current.path, records.map((record) => record.entry), records);
    await invoke(hooks, "after-stage-commit", { current: current.path });
  } catch (primary) {
    const rollback = [];
    try {
      if (current) { await renameDirectory(current, candidatePath, parent, "stage candidate rollback", temp.root, hooks); parent = await directoryRecord(parent.path, "stage parent", root.path); }
      if (backup) await renameDirectory(backup, currentPath, parent, "current stage restore", parent.path, hooks);
    } catch (error) { rollback.push(error); }
    if (rollback.length) throw new AggregateError([primary, ...rollback], "stage commit and rollback failed");
    throw primary;
  }
  if (backup) {
    try { await invoke(hooks, "before-backup-cleanup", { backup: backup.path }); await removePinnedTree(backup, parent, "current-backup", hooks); }
    catch (cleanup) { throw new AggregateError([cleanup], `stage committed but backup cleanup failed: ${cleanup.message}`); }
  }
  return current.path;
}

async function publishCommit({ root, temp, catalog, catalogSnapshot, qaSnapshot, records, hooks }) {
  const candidatePath = path.join(temp.root, "publish");
  await mkdir(candidatePath, { mode: 0o700 }); await writeRecords(candidatePath, records);
  const candidate = await directoryRecord(candidatePath, "publish candidate", temp.root);
  const assetsPath = path.join(root.path, "guides", "assets"); await mkdir(assetsPath, { recursive: true, mode: 0o700 });
  let assets = await directoryRecord(assetsPath, "assets parent", root.path);
  const targetPath = path.join(assets.path, "archify");
  const original = await lstat(targetPath).catch((error) => error.code === "ENOENT" ? null : Promise.reject(error));
  let backup; let published; let publishedRenameMoved = false;
  try {
    await validateRecordInputs(records, catalogSnapshot); await assertQaSnapshotCurrent(qaSnapshot); validateExactStructuralSignatures(catalog, records);
    if (original) {
      await invoke(hooks, "before-backup-rename", { target: targetPath });
      backup = await renameDirectory(await directoryRecord(targetPath, "managed publish target", assets.path), path.join(assets.path, `.curated-archify-backup-${randomUUID()}`), assets, "publish backup", assets.path, hooks);
      assets = await directoryRecord(assets.path, "assets parent", root.path);
    }
    await invoke(hooks, "before-publish-rename", { target: targetPath, candidate: candidate.path });
    published = await renameDirectory(candidate, targetPath, assets, "published managed tree", root.path, hooks, () => { publishedRenameMoved = true; });
    assets = await directoryRecord(assets.path, "assets parent", root.path);
    await assertExactManagedTree(published.path, records.map((record) => record.entry), records);
    await invoke(hooks, "after-publish-verification", { target: published.path });
    await assertExactManagedTree(published.path, records.map((record) => record.entry), records);
  } catch (primary) {
    const rollback = [];
    try {
      if (publishedRenameMoved && !published) throw new Error(`published managed tree state is untrusted; preserved path: ${targetPath}`);
      assets = await directoryRecord(assets.path, "assets parent", root.path);
      if (published) { await renameDirectory(published, candidatePath, assets, "publish rollback candidate", temp.root, hooks); assets = await directoryRecord(assets.path, "assets parent", root.path); }
      if (backup) {
        await invoke(hooks, "before-rollback-restore", { target: targetPath, backup: backup.path });
        await assertVerifiedMissing(targetPath, "publish rollback restore");
        await renameDirectory(backup, targetPath, assets, "publish rollback restore", assets.path, hooks);
      }
    } catch (error) { rollback.push(error); }
    if (rollback.length) throw new AggregateError([primary, ...rollback], `publication failed and rollback failed: ${primary.message}; ${rollback.map((error) => error.message).join("; ")}`);
    throw primary;
  }
  if (backup) {
    try { await invoke(hooks, "before-backup-cleanup", { backup: backup.path }); await removePinnedTree(backup, assets, "publish-backup", hooks); }
    catch (cleanup) { throw new AggregateError([cleanup], `publication committed but backup cleanup failed: ${cleanup.message}`); }
  }
}

async function prepare({ repoRoot, ids, product, env, archifyOptions, hooks, publishable }) {
  const root = await repoRootRecord(repoRoot);
  const { catalog, snapshot: catalogSnapshot } = await loadCatalogSnapshot(root);
  const entries = selectEntries(catalog, { ids, product, publishable });
  const temp = await createTemp(root);
  try {
    if (entries.length === 0) return { root, catalog, catalogSnapshot, entries, records: [], temp };
    const cli = await pinCli(env, archifyOptions);
    const closure = await snapshotExecutionClosure(cli, path.join(temp.root, "execution-closure"), hooks);
    const records = [];
    for (const entry of entries) records.push(await deliverRecord({ root, temp, closure, entry, hooks }));
    return { root, catalog, catalogSnapshot, entries, records, temp };
  } catch (primary) { return finalizeTemp(temp, undefined, primary, hooks); }
}

export async function stageCuratedArchify({ repoRoot, ids = [], product = null, env = process.env, archifyOptions = {}, __testHooks } = {}) {
  let prepared; let primary; let result;
  try { prepared = await prepare({ repoRoot, ids, product, env, archifyOptions, hooks: __testHooks, publishable: false }); result = await stageCommit({ ...prepared, hooks: __testHooks }); }
  catch (error) { primary = error; }
  if (!prepared) throw primary;
  return finalizeTemp(prepared.temp, primary ? undefined : { staged: result, entries: prepared.entries.map((entry) => entry.id) }, primary, __testHooks);
}

export async function checkCuratedArchify({ repoRoot, ids = [], product = null, env = process.env, archifyOptions = {}, __testHooks } = {}) {
  let prepared; let primary; let result;
  try {
    prepared = await prepare({ repoRoot, ids, product, env, archifyOptions, hooks: __testHooks, publishable: false });
    const stage = path.join(prepared.root.path, CURRENT_STAGE);
    await assertExactManagedTree(stage, prepared.entries, prepared.records);
    const allPublished = publishableArchifyEntries(prepared.catalog);
    await assertExactManagedTree(path.join(prepared.root.path, "guides", "assets", "archify"), allPublished);
    const publishedRecords = await loadPublishedRecords(prepared.root.path, allPublished);
    await qaBindings(prepared.root.path, publishedRecords, prepared.catalog, __testHooks);
    result = { checked: true, entries: prepared.entries.map((entry) => entry.id) };
  } catch (error) { primary = error; }
  if (!prepared) throw primary;
  return finalizeTemp(prepared.temp, result, primary, __testHooks);
}

export async function publishCuratedArchify({ repoRoot, ids = [], product = null, env = process.env, archifyOptions = {}, __testHooks } = {}) {
  let prepared; let primary; let result;
  try {
    prepared = await prepare({ repoRoot, ids, product, env, archifyOptions, hooks: __testHooks, publishable: true });
    const allPassed = publishableArchifyEntries(prepared.catalog);
    if (prepared.entries.length !== allPassed.length) throw new Error("publish must include the complete passed Archify set");
    const qaSnapshot = await qaBindings(prepared.root.path, prepared.records, prepared.catalog, __testHooks);
    await publishCommit({ ...prepared, qaSnapshot, hooks: __testHooks });
    result = { published: true, entries: prepared.entries.map((entry) => entry.id) };
  } catch (error) { primary = error; }
  if (!prepared) throw primary;
  return finalizeTemp(prepared.temp, result, primary, __testHooks);
}
