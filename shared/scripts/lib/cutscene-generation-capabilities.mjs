const liveApprovals = new WeakMap();

export function createLiveCutsceneApproval(receipt) {
  const capability = Object.freeze(Object.create(null));
  liveApprovals.set(capability, receipt);
  return capability;
}

export function isLiveCutsceneApprovalPair(receipt, capability) {
  return liveApprovals.get(capability) === receipt;
}
