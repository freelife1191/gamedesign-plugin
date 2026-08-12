import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, opendir } from "node:fs/promises";
import path from "node:path";

import { readCommittedMemoryEvent, resolveMemoryStore, scanMemoryEvents, foldMemoryEvents } from "./lib/safe-memory-store.mjs";
import { observeMemorySourceBindings } from "./validate-design-memory.mjs";

const HARD_LIMITS = Object.freeze({ maxDirectoryEntries: 256, maxCensusEntries: 100000, maxIdentityInstances: 256, maxGenerationReservations: 10000, maxIndexBytes: 1024 * 1024, maxReceiptBytes: 256 * 1024, maxViewBytes: 1024 * 1024, maxLogBytes: 1024 * 1024, maxIndexEntries: 10000, maxReceiptObservationItems: 256, maxReceiptAppliedItems: 256, maxReceiptExcludedItems: 256 });
const RESULT_MAX_BYTES = 64 * 1024;
const HEX = /^[a-f0-9]{64}$/u;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const KIND_PRIORITY = new Map([["project-fact", 0], ["decision", 1], ["style-preference", 2], ["design-lesson", 3], ["career-lesson", 4], ["external-note", 5]]);
const utf8 = new TextDecoder("utf-8", { fatal: true });

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function byteCompare(left, right) { return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")); }
function warning(code, extra = {}) { return { code, ...extra }; }
function emptyPublish(warnings) { return { complete: false, status: null, generationPath: null, generationSha256: null, warnings }; }
function safeId(value) { return typeof value === "string" && value === value.normalize("NFC") && ID.test(value); }
function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function canonicalBytes(value) { return Buffer.from(`${JSON.stringify(value)}\n`, "utf8"); }
function equalCanonicalJson(bytes, value) { return Buffer.isBuffer(bytes) && bytes.equals(canonicalBytes(value)); }
function normalizedList(value) { return [...new Set(Array.isArray(value) ? value : [])].filter(safeId).sort(byteCompare); }
function validMarkdownBytes(bytes) { try { const value = utf8.decode(bytes); return value === value.normalize("NFC") && !value.includes("\0") && !value.includes("\uFEFF") && !value.includes("\r") && value.endsWith("\n") && !value.endsWith("\n\n"); } catch { return false; } }
function limitsFor(override = {}) {
  if (!isObject(override)) throw new Error("Invalid derived limits.");
  const result = { ...HARD_LIMITS };
  for (const [key, hard] of Object.entries(HARD_LIMITS)) {
    if (Object.hasOwn(override, key)) {
      const value = override[key];
      if (!Number.isInteger(value) || value < 1 || value > hard) throw new Error("Invalid derived limits.");
      result[key] = value;
    }
  }
  if (Object.keys(override).some((key) => !Object.hasOwn(HARD_LIMITS, key))) throw new Error("Invalid derived limits.");
  return result;
}
function derivedRoot(store) { return path.join(store.root, "v1", "derived"); }
function safeRelative(relativePath) { return typeof relativePath === "string" && !relativePath.includes("\\") && !relativePath.includes("\0") && !path.posix.isAbsolute(relativePath) && path.posix.normalize(relativePath) === relativePath && !relativePath.startsWith("../"); }
async function isSafeDirectory(candidate, create = false) {
  if (create) await mkdir(candidate, { recursive: true, mode: 0o700 });
  const stat = await lstat(candidate);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("unsafe-derived-path");
  return stat;
}
async function ensureDirectories(root, relative) {
  let current = root;
  await isSafeDirectory(current, true);
  for (const segment of relative.split("/").filter(Boolean)) {
    if (!safeId(segment) && !["v1", "derived", "indexes", "receipts", "views", "logs", "instances", "_slots", ".reservations"].includes(segment) && !HEX.test(segment)) throw new Error("unsafe-derived-path");
    current = path.join(current, segment); await isSafeDirectory(current, true);
  }
  return current;
}
async function readBounded(candidate, maxBytes) {
  const before = await lstat(candidate);
  if (before.isSymbolicLink() || !before.isFile() || before.size > maxBytes) return { ok: false, code: before.size > maxBytes ? "memory.derived_generation_oversize" : "memory.derived_generation_invalid" };
  const handle = await open(candidate, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || opened.size > maxBytes) return { ok: false, code: "memory.derived_generation_invalid" };
    const bytes = await handle.readFile(); const after = await handle.stat(); const final = await lstat(candidate);
    if (bytes.byteLength > maxBytes || after.dev !== opened.dev || after.ino !== opened.ino || final.dev !== before.dev || final.ino !== before.ino || final.isSymbolicLink()) return { ok: false, code: "memory.derived_generation_invalid" };
    return { ok: true, bytes };
  } catch { return { ok: false, code: "memory.derived_generation_invalid" }; } finally { await handle.close(); }
}

export async function scanDerivedGenerations({ store, limits } = {}) {
  let actualLimits;
  try { actualLimits = limitsFor(limits); } catch { return { complete: false, entries: [], warnings: [warning("memory.derived_invalid_limits")] }; }
  const source = await scanMemoryEvents({ store });
  if (!source.complete) return { complete: false, entries: [], warnings: [warning("memory.scan_incomplete")] };
  const entries = []; const warnings = []; let count = 0; let complete = true;
  async function visit(directory, relative = "") {
    let handle;
    try { handle = await opendir(directory); } catch (error) { if (error?.code === "ENOENT") return; complete = false; warnings.push(warning("memory.derived_census_invalid")); return; }
    let children = 0;
    try {
      for await (const entry of handle) {
        if (entry.name === ".reservations" || entry.name === "_slots") continue;
        children += 1; count += 1;
        if (children > actualLimits.maxDirectoryEntries) { complete = false; warnings.push(warning("memory.derived_directory_limit_exceeded")); return; }
        if (count > actualLimits.maxCensusEntries) { complete = false; warnings.push(warning("memory.derived_census_limit_exceeded")); return; }
        const nextRelative = relative ? `${relative}/${entry.name}` : entry.name;
        const next = path.join(directory, entry.name); let stat;
        try { stat = await lstat(next); } catch { complete = false; warnings.push(warning("memory.derived_census_invalid")); return; }
        entries.push({ relativePath: nextRelative, type: stat.isDirectory() && !stat.isSymbolicLink() ? "directory" : stat.isFile() && !stat.isSymbolicLink() ? "file" : "other", size: stat.size });
        if (stat.isDirectory() && !stat.isSymbolicLink()) await visit(next, nextRelative);
        if (!complete) return;
      }
    } catch { complete = false; warnings.push(warning("memory.derived_census_invalid")); } finally { await handle.close().catch(() => {}); }
  }
  await visit(derivedRoot(store));
  if (!complete) return { complete: false, entries: [], warnings };
  return { complete: true, entries: entries.sort((a, b) => byteCompare(a.relativePath, b.relativePath)), warnings };
}

function sourceTree(scan) {
  if (!scan?.complete || !Array.isArray(scan.sourceEntries)) return null;
  const entries = scan.sourceEntries.map(({ relativePath, observedSha256, classification }) => ({ relativePath, observedSha256, classification })).sort((left, right) => byteCompare(left.relativePath, right.relativePath));
  if (!entries.every((entry) => safeRelative(entry.relativePath) && HEX.test(entry.observedSha256) && ["event", "quarantine"].includes(entry.classification))) return null;
  return sha(canonicalBytes(entries));
}
function indexEntry({ memoryId, memory }) {
  const record = memory.record;
  return { memoryId, headEventId: memory.headEventId, headEventPath: memory.headEventPath, fileSha256: memory.fileSha256, kind: record.kind, lane: record.lane, status: record.status, scope: record.scope, projectId: record.project_id, artifactTypes: record.artifact_types, relatedIds: record.related_ids, tags: record.tags };
}
function sortedUniqueIds(list) { return Array.isArray(list) && list.every(safeId) && list.every((item, index) => index === 0 || byteCompare(list[index - 1], item) < 0); }
function exactKeys(value, keys) { return isObject(value) && Object.keys(value).join(",") === keys.join(","); }
function validateIndex(value, limits = HARD_LIMITS) {
  return exactKeys(value, ["schemaVersion", "sourceTreeSha256", "entries"]) && value.schemaVersion === 1 && HEX.test(value.sourceTreeSha256 ?? "") && Array.isArray(value.entries) && value.entries.length <= limits.maxIndexEntries && value.entries.every((entry, index) => exactKeys(entry, ["memoryId", "headEventId", "headEventPath", "fileSha256", "kind", "lane", "status", "scope", "projectId", "artifactTypes", "relatedIds", "tags"]) && safeId(entry.memoryId) && (!index || byteCompare(value.entries[index - 1].memoryId, entry.memoryId) < 0) && /^mev1-[a-f0-9]{64}$/u.test(entry.headEventId ?? "") && safeRelative(entry.headEventPath) && HEX.test(entry.fileSha256 ?? "") && KIND_PRIORITY.has(entry.kind) && ["common", "studio", "career"].includes(entry.lane) && ["candidate", "verified", "approved", "expired", "rejected", "disputed", "superseded", "stale"].includes(entry.status) && ["project", "workspace", "global"].includes(entry.scope) && safeId(entry.projectId) && [entry.artifactTypes, entry.relatedIds, entry.tags].every(sortedUniqueIds));
}
function validateReceipt(value, limits = HARD_LIMITS) {
  const hashes = [value?.requestSha256, value?.sourceTreeSha256];
  const arrays = [value?.observations, value?.applied, value?.excluded];
  if (!exactKeys(value, ["schemaVersion", "requestSha256", "sourceTreeSha256", "projectId", "lane", "policy", "observations", "applied", "excluded"]) || value.schemaVersion !== 1 || !hashes.every((item) => HEX.test(item ?? "")) || !safeId(value.projectId) || !["common", "studio", "career"].includes(value.lane) || !exactKeys(value.policy, ["scope", "maxItems", "candidateTtlDays"]) || !["project", "workspace", "global"].includes(value.policy.scope) || !Number.isInteger(value.policy.maxItems) || value.policy.maxItems < 1 || value.policy.maxItems > 10 || !Number.isInteger(value.policy.candidateTtlDays) || value.policy.candidateTtlDays < 1 || value.policy.candidateTtlDays > 365 || !Array.isArray(value.observations) || value.observations.length > limits.maxReceiptObservationItems || !Array.isArray(value.applied) || value.applied.length > limits.maxReceiptAppliedItems || !Array.isArray(value.excluded) || value.excluded.length > limits.maxReceiptExcludedItems) return false;
  return value.observations.every((item, index) => exactKeys(item, ["memoryId", "artifactId", "locator", "expectedSha256", "observedSha256", "status"]) && safeId(item.memoryId) && safeId(item.artifactId) && typeof item.locator === "string" && HEX.test(item.expectedSha256 ?? "") && (item.observedSha256 === null || HEX.test(item.observedSha256)) && ["current", "missing", "drift", "symlink", "unreadable"].includes(item.status) && (!index || byteCompare(`${value.observations[index - 1].memoryId}\0${value.observations[index - 1].artifactId}\0${value.observations[index - 1].locator}`, `${item.memoryId}\0${item.artifactId}\0${item.locator}`) < 0)) && value.applied.every((item, index) => exactKeys(item, ["memoryId", "headEventId", "fileSha256"]) && safeId(item.memoryId) && /^mev1-[a-f0-9]{64}$/u.test(item.headEventId ?? "") && HEX.test(item.fileSha256 ?? "") && (!index || byteCompare(value.applied[index - 1].memoryId, item.memoryId) < 0)) && value.excluded.every((item, index) => exactKeys(item, ["memoryId", "reason"]) && safeId(item.memoryId) && typeof item.reason === "string" && item.reason.length > 0 && (!index || byteCompare(value.excluded[index - 1].memoryId, item.memoryId) < 0));
}
function parseCanonical(bytes, validator) {
  try { const value = JSON.parse(utf8.decode(bytes)); return validator(value) && equalCanonicalJson(bytes, value) ? value : null; } catch { return null; }
}
function baseFor(kind, root, first, second) { return path.join(root, "v1", "derived", kind === "receipt" ? "receipts" : kind === "index" ? "indexes" : `${kind}s`, first, second); }
function identityHash(kind, parts) {
  const chunks = ["memory-derived-identity-v1", kind, ...parts].map((part) => Buffer.from(String(part), "utf8"));
  const framed = chunks.map((chunk) => { const size = Buffer.alloc(8); size.writeBigUInt64BE(BigInt(chunk.byteLength)); return Buffer.concat([size, chunk]); });
  return sha(Buffer.concat(framed));
}
function reservationBytes({ kind, identitySha256, generationSha256, globalSlot, localSlot, instanceId }) { return canonicalBytes({ schemaVersion: 1, kind, identitySha256, generationSha256, globalSlot, localSlot, instanceId }); }
function validReservation(value, expected) { return isObject(value) && Object.keys(value).join(",") === "schemaVersion,kind,identitySha256,generationSha256,globalSlot,localSlot,instanceId" && value.schemaVersion === 1 && value.kind === expected.kind && value.identitySha256 === expected.identitySha256 && value.generationSha256 === expected.generationSha256 && value.globalSlot === expected.globalSlot && value.localSlot === expected.localSlot && value.instanceId === expected.instanceId; }
async function reservationValid(candidate, expected) {
  const read = await readBounded(candidate, 4096); if (!read.ok) return false;
  try { const value = JSON.parse(utf8.decode(read.bytes)); return read.bytes.equals(reservationBytes(expected)) && validReservation(value, expected); } catch { return false; }
}
async function writeExclusive(candidate, bytes) {
  const handle = await open(candidate, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
}
async function reserveSlot(directory, max, width, make) {
  await ensureDirectories(directory, "");
  for (let slot = 0; slot < max; slot += 1) {
    const candidate = path.join(directory, `${String(slot).padStart(width, "0")}.json`);
    try { await writeExclusive(candidate, make(slot)); return slot; } catch (error) { if (error?.code !== "EEXIST") throw error; }
  }
  return null;
}
function extensionFor(kind) { return kind === "view" || kind === "log" ? ".md" : ".json"; }
async function validInstance({ store, kind, base, first, second, identitySha256, generationSha256, relativePath, limits }) {
  const extension = extensionFor(kind); const prefix = path.relative(derivedRoot(store), path.join(base, "instances")).split(path.sep).join("/") + "/";
  if (!relativePath.startsWith(prefix) || !relativePath.endsWith(extension)) return null;
  const instanceId = path.basename(relativePath, extension); if (!UUID.test(instanceId)) return null;
  const localSlotDirectory = path.join(base, "_slots"); const globalReservationDirectory = path.join(derivedRoot(store), ".reservations");
  let localSlot = null; let localGlobalSlot = null;
  for (let slot = 0; slot < limits.maxIdentityInstances; slot += 1) {
    const local = path.join(localSlotDirectory, `${String(slot).padStart(3, "0")}.json`);
    try { const read = await readBounded(local, 4096); if (!read.ok) continue; const value = JSON.parse(utf8.decode(read.bytes)); if (value.instanceId === instanceId && value.kind === kind && value.identitySha256 === identitySha256 && value.generationSha256 === generationSha256 && Number.isInteger(value.globalSlot) && value.localSlot === slot && await reservationValid(local, { kind, identitySha256, generationSha256, globalSlot: value.globalSlot, localSlot: slot, instanceId })) { localSlot = slot; localGlobalSlot = value.globalSlot; break; } } catch { /* invalid reservation is not authority */ }
  }
  if (localSlot === null) return null;
  let globalSlot = null;
  for (let slot = 0; slot < limits.maxGenerationReservations; slot += 1) {
    const global = path.join(globalReservationDirectory, `${String(slot).padStart(5, "0")}.json`);
    try { const read = await readBounded(global, 4096); if (!read.ok) continue; const value = JSON.parse(utf8.decode(read.bytes)); if (value.instanceId === instanceId && value.kind === kind && value.identitySha256 === identitySha256 && value.generationSha256 === generationSha256 && value.globalSlot === slot && value.localSlot === null && await reservationValid(global, { kind, identitySha256, generationSha256, globalSlot: slot, localSlot: null, instanceId })) { globalSlot = slot; break; } } catch { /* invalid reservation is not authority */ }
  }
  if (globalSlot === null || globalSlot !== localGlobalSlot) return null;
  const bytesResult = await readBounded(path.join(derivedRoot(store), relativePath), kind === "receipt" ? limits.maxReceiptBytes : kind === "index" ? limits.maxIndexBytes : kind === "view" ? limits.maxViewBytes : limits.maxLogBytes);
  if (!bytesResult.ok || sha(bytesResult.bytes) !== generationSha256) return null;
  const value = kind === "index" ? parseCanonical(bytesResult.bytes, validateIndex) : kind === "receipt" ? parseCanonical(bytesResult.bytes, validateReceipt) : bytesResult.bytes.toString("utf8");
  if (!value || (kind === "index" && (value.sourceTreeSha256 !== first || second !== generationSha256)) || (kind === "receipt" && (value.requestSha256 !== first || second !== generationSha256))) return null;
  return { bytes: bytesResult.bytes, relativePath, value, globalSlot, localSlot };
}
async function findInstances({ store, kind, first, second, limits, census }) {
  const root = store.root; const base = baseFor(kind, root, first, second); const identitySha256 = identityHash(kind, [first, second]); const generationSha256 = second;
  const candidates = census.entries.filter((entry) => entry.type === "file").map((entry) => entry.relativePath);
  const valid = [];
  for (const relativePath of candidates) {
    const current = await validInstance({ store, kind, base, first, second, identitySha256, generationSha256, relativePath, limits }); if (current) valid.push(current);
  }
  return valid.sort((left, right) => byteCompare(left.relativePath, right.relativePath));
}
async function publish({ store, kind, bytes, first, limits }) {
  let actualLimits;
  try { actualLimits = limitsFor(limits); } catch { return emptyPublish([warning("memory.derived_invalid_limits")]); }
  const maxBytes = kind === "index" ? actualLimits.maxIndexBytes : kind === "receipt" ? actualLimits.maxReceiptBytes : kind === "view" ? actualLimits.maxViewBytes : actualLimits.maxLogBytes;
  if (!HEX.test(first ?? "")) return emptyPublish([warning("memory.derived_input_limit_exceeded")]);
  const validator = kind === "index" ? (value) => validateIndex(value, actualLimits) : kind === "receipt" ? (value) => validateReceipt(value, actualLimits) : validMarkdownBytes;
  const parsedInput = kind === "index" || kind === "receipt" ? parseCanonical(bytes, validator) : null;
  const validInput = Buffer.isBuffer(bytes) && bytes.byteLength <= maxBytes && (kind === "index" || kind === "receipt" ? Boolean(parsedInput) : validator(bytes)) && (kind === "index" ? parsedInput.sourceTreeSha256 === first : kind === "receipt" ? parsedInput.requestSha256 === first : true);
  if (!validInput) return emptyPublish([warning("memory.derived_input_limit_exceeded")]);
  const second = sha(bytes); const census = await scanDerivedGenerations({ store, limits: actualLimits });
  if (!census.complete) return emptyPublish(census.warnings);
  const present = await findInstances({ store, kind, first, second, limits: actualLimits, census });
  if (present.length) return { complete: true, status: "present", generationPath: present[0].relativePath, generationSha256: second, warnings: census.warnings };
  const base = baseFor(kind, store.root, first, second); const identitySha256 = identityHash(kind, [first, second]); const instanceId = randomUUID();
  try {
    const globalDirectory = await ensureDirectories(store.root, "v1/derived/.reservations");
    const globalSlot = await reserveSlot(globalDirectory, actualLimits.maxGenerationReservations, 5, (slot) => reservationBytes({ kind, identitySha256, generationSha256: second, globalSlot: slot, localSlot: null, instanceId }));
    if (globalSlot === null) return emptyPublish([warning("memory.derived_limit_exceeded")]);
    const localDirectory = await ensureDirectories(base, "_slots");
    const localSlot = await reserveSlot(localDirectory, actualLimits.maxIdentityInstances, 3, (slot) => reservationBytes({ kind, identitySha256, generationSha256: second, globalSlot, localSlot: slot, instanceId }));
    if (localSlot === null) return emptyPublish([warning("memory.derived_limit_exceeded")]);
    const globalReservation = path.join(globalDirectory, `${String(globalSlot).padStart(5, "0")}.json`); const localReservation = path.join(localDirectory, `${String(localSlot).padStart(3, "0")}.json`);
    if (!await reservationValid(globalReservation, { kind, identitySha256, generationSha256: second, globalSlot, localSlot: null, instanceId }) || !await reservationValid(localReservation, { kind, identitySha256, generationSha256: second, globalSlot, localSlot, instanceId })) return emptyPublish([warning("memory.derived_reservation_invalid")]);
    const instances = await ensureDirectories(base, "instances"); const filename = `${instanceId}${extensionFor(kind)}`; const output = path.join(instances, filename); await writeExclusive(output, bytes);
    const readBack = await readBounded(output, maxBytes); if (!readBack.ok || !readBack.bytes.equals(bytes)) return emptyPublish([warning("memory.derived_generation_invalid")]);
    const generationPath = path.relative(derivedRoot(store), output).split(path.sep).join("/");
    return { complete: true, status: "created", generationPath, generationSha256: second, warnings: census.warnings };
  } catch { return emptyPublish([warning("memory.derived_write_failed")]); }
}

export async function publishMemoryIndexGeneration({ store, indexBytes, sourceTreeSha256, limits } = {}) {
  if (!HEX.test(sourceTreeSha256 ?? "")) return { ...emptyPublish([warning("memory.derived_input_limit_exceeded")]), indexSha256: null };
  const result = await publish({ store, kind: "index", bytes: indexBytes, first: sourceTreeSha256, limits });
  return { complete: result.complete, status: result.status, generationPath: result.generationPath, indexSha256: result.generationSha256, warnings: result.warnings };
}
export async function publishMemoryReceiptGeneration({ store, receiptBytes, requestSha256, limits } = {}) {
  if (!HEX.test(requestSha256 ?? "")) return { ...emptyPublish([warning("memory.derived_input_limit_exceeded")]), receiptSha256: null };
  const result = await publish({ store, kind: "receipt", bytes: receiptBytes, first: requestSha256, limits });
  return { complete: result.complete, status: result.status, generationPath: result.generationPath, receiptSha256: result.generationSha256, warnings: result.warnings };
}
export async function publishMemoryViewGeneration({ store, viewBytes, sourceTreeSha256, limits } = {}) { return publish({ store, kind: "view", bytes: viewBytes, first: sourceTreeSha256, limits }); }
export async function publishMemoryLogGeneration({ store, logBytes, sourceTreeSha256, limits } = {}) { return publish({ store, kind: "log", bytes: logBytes, first: sourceTreeSha256, limits }); }

async function load({ store, kind, first, second, limits }) {
  let actualLimits; try { actualLimits = limitsFor(limits); } catch { return { complete: false, status: null, bytes: null, generationPath: null, warnings: [warning("memory.derived_invalid_limits")] }; }
  if (!HEX.test(first ?? "") || !HEX.test(second ?? "")) return { complete: true, status: "missing", bytes: null, generationPath: null, warnings: [] };
  const census = await scanDerivedGenerations({ store, limits: actualLimits });
  if (!census.complete) return { complete: false, status: null, bytes: null, generationPath: null, warnings: census.warnings };
  const valid = await findInstances({ store, kind, first, second, limits: actualLimits, census });
  const prefix = `${kind === "receipt" ? "receipts" : kind === "index" ? "indexes" : `${kind}s`}/${first}/${second}/instances/`;
  const relevant = census.entries.some((entry) => entry.relativePath.startsWith(prefix));
  if (!valid.length) return { complete: true, status: relevant ? "corrupt" : "missing", bytes: null, generationPath: null, warnings: relevant ? [warning("memory.derived_generation_invalid")] : [] };
  return { complete: true, status: "ready", bytes: valid[0].bytes, generationPath: valid[0].relativePath, warnings: [] };
}
export async function loadCurrentMemoryIndex({ store, fold, limits } = {}) {
  const scan = await scanMemoryEvents({ store }); if (!scan.complete) return { complete: false, index: null, bytes: null, sourceTreeSha256: null, indexSha256: null, warnings: [warning("memory.scan_incomplete")] };
  const currentFold = foldMemoryEvents(scan); if (!currentFold.complete) return { complete: false, index: null, bytes: null, sourceTreeSha256: null, indexSha256: null, warnings: [warning("memory.fold_incomplete")] };
  const sourceTreeSha256 = sourceTree(scan); if (!sourceTreeSha256) return { complete: false, index: null, bytes: null, sourceTreeSha256: null, indexSha256: null, warnings: [warning("memory.scan_incomplete")] };
  const eventById = new Map(scan.events.map((item) => [item.eventId, item]));
  const entries = [...currentFold.memories.entries()].map(([memoryId, memory]) => { const head = eventById.get(memory.headEventId); return indexEntry({ memoryId, memory: { ...memory, headEventPath: head?.relativePath, fileSha256: head ? sha(head.bytes) : "" } }); }).filter((entry) => safeRelative(entry.headEventPath) && HEX.test(entry.fileSha256)).sort((left, right) => byteCompare(left.memoryId, right.memoryId));
  const expectedIndexSha256 = sha(canonicalBytes({ schemaVersion: 1, sourceTreeSha256, entries }));
  const loaded = await load({ store, kind: "index", first: sourceTreeSha256, second: expectedIndexSha256, limits });
  const index = loaded.bytes ? parseCanonical(loaded.bytes, validateIndex) : null;
  return { complete: loaded.complete, index, bytes: index ? loaded.bytes : null, sourceTreeSha256: loaded.complete ? sourceTreeSha256 : null, indexSha256: index ? expectedIndexSha256 : null, warnings: loaded.warnings };
}
export async function loadMemoryReceipt({ store, requestSha256, receiptSha256, limits } = {}) {
  const loaded = await load({ store, kind: "receipt", first: requestSha256, second: receiptSha256, limits }); const receipt = loaded.bytes ? parseCanonical(loaded.bytes, validateReceipt) : null;
  return { complete: loaded.complete, status: loaded.status, receipt, bytes: receipt ? loaded.bytes : null, warnings: loaded.warnings };
}
export async function loadMemoryView({ store, sourceTreeSha256, viewSha256, limits } = {}) { return load({ store, kind: "view", first: sourceTreeSha256, second: viewSha256, limits }); }
export async function loadMemoryLog({ store, sourceTreeSha256, logSha256, limits } = {}) { return load({ store, kind: "log", first: sourceTreeSha256, second: logSha256, limits }); }
export async function listMemoryReceipts({ store, requestSha256, maxItems = 256, limits } = {}) {
  if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 256) return { complete: false, items: [], warnings: [warning("memory.derived_invalid_limits")] };
  let actualLimits; try { actualLimits = limitsFor(limits); } catch { return { complete: false, items: [], warnings: [warning("memory.derived_invalid_limits")] }; }
  if (!HEX.test(requestSha256 ?? "")) return { complete: true, items: [], warnings: [] };
  const census = await scanDerivedGenerations({ store, limits: actualLimits }); if (!census.complete) return { complete: false, items: [], warnings: census.warnings };
  const prefix = `receipts/${requestSha256}/`; const hashes = [...new Set(census.entries.map((entry) => entry.relativePath.split("/", 3)).filter((parts) => parts[0] === "receipts" && parts[1] === requestSha256 && HEX.test(parts[2] ?? "")).map((parts) => parts[2]))].sort(byteCompare);
  const items = [];
  for (const receiptSha256 of hashes) {
    const valid = await findInstances({ store, kind: "receipt", first: requestSha256, second: receiptSha256, limits: actualLimits, census });
    const candidatePrefix = `${prefix}${receiptSha256}/instances/`; const candidates = census.entries.filter((entry) => entry.relativePath.startsWith(candidatePrefix) && entry.type === "file");
    items.push({ receiptSha256, status: valid.length ? "valid" : "corrupt", validInstanceCount: valid.length, corruptInstanceCount: Math.max(0, candidates.length - valid.length), firstValidRelativePath: valid[0]?.relativePath ?? null });
  }
  return { complete: true, items: items.slice(0, maxItems), warnings: [] };
}

export function rankMemoryEntries(entries, requestContext = {}) {
  const count = (left, right) => { const values = new Set(right ?? []); return (left ?? []).filter((item) => values.has(item)).length; };
  return (Array.isArray(entries) ? entries : []).map((entry) => ({ entry, score: count(entry.relatedIds, requestContext.artifactIds) * 8 + count(entry.artifactTypes, requestContext.artifactTypes) * 4 + count(entry.tags, requestContext.tags) * 2 + (entry.kind === "style-preference" ? 1 : 0) })).filter((item) => item.score > 0).sort((left, right) => right.score - left.score || (KIND_PRIORITY.get(left.entry.kind) ?? 99) - (KIND_PRIORITY.get(right.entry.kind) ?? 99) || byteCompare(left.entry.memoryId, right.entry.memoryId)).map((item) => item.entry);
}

export async function rebuildMemoryIndex({ workspaceRoot, config, now } = {}) {
  if (!config?.enabled) return { complete: true, status: "disabled", index: null, bytes: null, sourceTreeSha256: null, indexSha256: null, warnings: [] };
  let store;
  try { store = await resolveMemoryStore({ workspaceRoot, config, platform: process.platform, home: process.env.HOME ?? workspaceRoot }); } catch { return { complete: false, index: null, bytes: null, sourceTreeSha256: null, indexSha256: null, warnings: [warning("memory.store_unavailable")] }; }
  const scan = await scanMemoryEvents({ store }); if (!scan.complete) return { complete: false, index: null, bytes: null, sourceTreeSha256: null, indexSha256: null, warnings: [warning("memory.scan_incomplete"), ...scan.diagnostics] };
  const fold = foldMemoryEvents(scan, { now }); if (!fold.complete) return { complete: false, index: null, bytes: null, sourceTreeSha256: null, indexSha256: null, warnings: [warning("memory.fold_incomplete"), ...fold.diagnostics] };
  const sourceTreeSha256 = sourceTree(scan); if (!sourceTreeSha256) return { complete: false, index: null, bytes: null, sourceTreeSha256: null, indexSha256: null, warnings: [warning("memory.scan_incomplete")] }; const eventById = new Map(scan.events.map((item) => [item.eventId, item]));
  const entries = [...fold.memories.entries()].map(([memoryId, memory]) => { const head = eventById.get(memory.headEventId); return indexEntry({ memoryId, memory: { ...memory, headEventPath: head?.relativePath, fileSha256: head ? sha(head.bytes) : "" } }); }).filter((entry) => safeRelative(entry.headEventPath) && HEX.test(entry.fileSha256)).sort((left, right) => byteCompare(left.memoryId, right.memoryId));
  const index = { schemaVersion: 1, sourceTreeSha256, entries }; const bytes = canonicalBytes(index); const indexSha256 = sha(bytes);
  fold.sourceTreeSha256 = sourceTreeSha256; fold.indexSha256 = indexSha256;
  const published = await publishMemoryIndexGeneration({ store, indexBytes: bytes, sourceTreeSha256 });
  return { complete: published.complete, status: published.status, store, scan, fold, index, bytes, sourceTreeSha256, indexSha256, warnings: published.warnings };
}

function requestIdentity(context) { return { schemaVersion: 1, projectId: context.projectId, lane: context.lane, artifactIds: normalizedList(context.artifactIds), artifactTypes: normalizedList(context.artifactTypes), tags: normalizedList(context.tags) }; }
function validRequestContext(context, config) {
  return isObject(context) && safeId(context.projectId) && context.projectId === config?.projectId && ["common", "studio", "career"].includes(context.lane) && [context.artifactIds, context.artifactTypes, context.tags].every((list) => Array.isArray(list) && list.every(safeId)) && canonicalBytes(requestIdentity(context)).byteLength <= RESULT_MAX_BYTES && Number.isInteger(config?.maxItems) && config.maxItems >= 1 && config.maxItems <= 10 && Number.isInteger(config?.candidateTtlDays) && config.candidateTtlDays >= 1 && config.candidateTtlDays <= 365;
}
function eligible(record, store, context, today) {
  const scope = record.scope === store.scope && (record.scope !== "project" || record.project_id === context.projectId);
  const lane = record.lane === context.lane || record.lane === "common" && ["project-fact", "decision"].includes(record.kind);
  if (!scope || !lane) return "scope-or-lane";
  if (record.expires_at < today) return "expired";
  if (record.kind === "external-note" && record.review_after < today) return "stale-source";
  return null;
}
function boundedResult(result) { return canonicalBytes(result).byteLength <= RESULT_MAX_BYTES ? result : { schemaVersion: 1, status: "unavailable", projectId: null, lane: null, untrustedMemoryData: true, guidance: [], excluded: [], warnings: [warning("memory.result_limit_exceeded")] }; }
function closedResult(status, context, warnings = []) { return boundedResult({ schemaVersion: 1, status, projectId: safeId(context.projectId) ? context.projectId : null, lane: ["common", "studio", "career"].includes(context.lane) ? context.lane : null, untrustedMemoryData: true, guidance: [], excluded: [], warnings }); }
export async function retrieveApprovedDesignMemory({ workspaceRoot, config, requestContext = {}, now = new Date() } = {}) {
  const context = { ...requestContext, projectId: requestContext.projectId };
  if (!config?.enabled || context.disabledForRequest || !validRequestContext(context, config)) return closedResult("disabled", context);
  const rebuilt = await rebuildMemoryIndex({ workspaceRoot, config, now }); if (!rebuilt.complete) return closedResult("unavailable", context, rebuilt.warnings);
  const selected = rankMemoryEntries(rebuilt.index.entries, context); const guidance = []; const excluded = []; const observations = [];
  const eventById = new Map(rebuilt.scan.events.map((item) => [item.eventId, item]));
  for (const entry of selected) {
    const memory = rebuilt.fold.memories.get(entry.memoryId); const head = eventById.get(entry.headEventId);
    if (!memory || !head || memory.headEventId !== entry.headEventId || memory.record.status !== "approved") { excluded.push({ memoryId: entry.memoryId, reason: "head-revalidation" }); continue; }
    const reason = eligible(memory.record, rebuilt.store, context, new Date(now).toISOString().slice(0, 10)); if (reason) { excluded.push({ memoryId: entry.memoryId, reason }); continue; }
    let sealed; try { sealed = await readCommittedMemoryEvent({ store: rebuilt.store, relativePath: entry.headEventPath, eventId: entry.headEventId }); } catch { excluded.push({ memoryId: entry.memoryId, reason: "head-revalidation" }); continue; }
    if (sealed.event.memory_id !== entry.memoryId || sealed.fileSha256 !== entry.fileSha256 || sha(sealed.bytes) !== entry.fileSha256 || sealed.relativePath !== head.relativePath || !sealed.bytes.equals(head.bytes)) { excluded.push({ memoryId: entry.memoryId, reason: "head-revalidation" }); continue; }
    const sourceCheck = await observeMemorySourceBindings(memory.record, { workspaceRoot }); const itemObservations = sourceCheck.observations.map((item) => ({ memoryId: entry.memoryId, ...item })); observations.push(...itemObservations);
    if (!sourceCheck.ok || itemObservations.some((item) => item.status !== "current")) { excluded.push({ memoryId: entry.memoryId, reason: "stale-source" }); continue; }
    guidance.push({ memoryId: entry.memoryId, kind: memory.record.kind, summary: sealed.sections["발견한 내용"], applyWhen: sealed.sections["적용 조건"], avoidWhen: sealed.sections["적용하면 안 되는 경우"], sourceRefs: memory.record.sources.map((source) => `${source.artifact_id}/${source.locator}`) });
    if (guidance.length >= config.maxItems) break;
  }
  if (observations.length > HARD_LIMITS.maxReceiptObservationItems || excluded.length > HARD_LIMITS.maxReceiptExcludedItems || guidance.length > HARD_LIMITS.maxReceiptAppliedItems) return closedResult("unavailable", context, [warning("memory.receipt_limit_exceeded")]);
  const result = boundedResult({ schemaVersion: 1, status: "ready", projectId: context.projectId, lane: context.lane, untrustedMemoryData: true, guidance, excluded: excluded.sort((left, right) => byteCompare(left.memoryId, right.memoryId)), warnings: rebuilt.warnings });
  if (result.status !== "ready") return result;
  const requestSha256 = sha(canonicalBytes(requestIdentity(context)));
  if (guidance.length) {
    const receipt = { schemaVersion: 1, requestSha256, sourceTreeSha256: rebuilt.sourceTreeSha256, projectId: context.projectId, lane: context.lane, policy: { scope: config.scope, maxItems: config.maxItems, candidateTtlDays: config.candidateTtlDays }, observations, applied: guidance.map((item) => ({ memoryId: item.memoryId, headEventId: rebuilt.fold.memories.get(item.memoryId).headEventId, fileSha256: rebuilt.index.entries.find((entry) => entry.memoryId === item.memoryId).fileSha256 })).sort((left, right) => byteCompare(left.memoryId, right.memoryId)), excluded: result.excluded };
    const receiptBytes = canonicalBytes(receipt); const published = await publishMemoryReceiptGeneration({ store: rebuilt.store, receiptBytes, requestSha256 });
    if (published.complete) Object.assign(result, { requestSha256, receiptSha256: published.receiptSha256, receiptGenerationPath: published.generationPath }); else result.warnings.push(...published.warnings);
  }
  return result;
}
