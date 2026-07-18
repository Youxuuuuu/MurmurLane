import test from "node:test";
import assert from "node:assert/strict";
import { BubbleRevealLedger } from "../src/lib/BubbleRevealLedger";

function createLedger() {
  let token = 0;
  return new BubbleRevealLedger({
    createSlotToken: () => `opaque-slot-${++token}`,
  });
}

test("sequential reveal exposes only the first bubble to the initial DOM", () => {
  const ledger = createLedger();
  const initial = ledger.prepareMessage("assistant:thread:turn:item", 3, "sequential");

  assert.equal(initial.totalCount, 3);
  assert.equal(initial.visibleSlots.length, 1);
  assert.equal(initial.visibleSlots[0].status, "queued");
  assert.equal(initial.visibleSlots[0].bubbleId.includes("opaque-slot-1"), true);
});

test("each completion mounts exactly one subsequent bubble", () => {
  const ledger = createLedger();
  const renderId = "assistant:thread:turn:item";
  let snapshot = ledger.prepareMessage(renderId, 3, "sequential");
  const first = snapshot.visibleSlots[0];

  assert.equal(ledger.claimEntering(renderId, first.bubbleId), true);
  assert.equal(ledger.claimEntering(renderId, first.bubbleId), false);
  assert.equal(ledger.getEnterCount(renderId, first.bubbleId), 1);
  assert.equal(ledger.completeEntering(renderId, first.bubbleId), true);

  snapshot = ledger.getSnapshot(renderId)!;
  assert.equal(snapshot.visibleSlots.length, 2);
  assert.deepEqual(snapshot.visibleSlots.map((slot) => slot.status), ["entered", "queued"]);

  const second = snapshot.visibleSlots[1];
  assert.equal(ledger.claimEntering(renderId, second.bubbleId), true);
  assert.equal(ledger.completeEntering(renderId, second.bubbleId), true);
  snapshot = ledger.getSnapshot(renderId)!;
  assert.equal(snapshot.visibleSlots.length, 3);
  assert.deepEqual(snapshot.visibleSlots.map((slot) => slot.status), [
    "entered",
    "entered",
    "queued",
  ]);
});

test("live updates and canonical archive replacement cannot replay entering", () => {
  const ledger = createLedger();
  const renderId = "assistant:thread:turn:item";
  let snapshot = ledger.prepareMessage(renderId, 2, "sequential");

  for (let position = 0; position < 2; position += 1) {
    const slot = snapshot.visibleSlots[position];
    assert.equal(ledger.claimEntering(renderId, slot.bubbleId), true);
    assert.equal(ledger.completeEntering(renderId, slot.bubbleId), true);
    snapshot = ledger.getSnapshot(renderId)!;
  }

  const originalIds = snapshot.visibleSlots.map((slot) => slot.bubbleId);
  const canonicalSnapshot = ledger.prepareMessage(renderId, 2, "sequential");
  assert.deepEqual(canonicalSnapshot.visibleSlots.map((slot) => slot.bubbleId), originalIds);
  for (const slot of canonicalSnapshot.visibleSlots) {
    assert.equal(slot.status, "entered");
    assert.equal(ledger.claimEntering(renderId, slot.bubbleId), false);
    assert.equal(ledger.getEnterCount(renderId, slot.bubbleId), 1);
  }
});

test("an entering bubble completed during virtual unmount is never animated again", () => {
  const ledger = createLedger();
  const renderId = "assistant:thread:turn:item";
  const initial = ledger.prepareMessage(renderId, 2, "sequential");
  const first = initial.visibleSlots[0];

  assert.equal(ledger.claimEntering(renderId, first.bubbleId), true);
  assert.equal(ledger.completeEntering(renderId, first.bubbleId), true);
  assert.equal(ledger.claimEntering(renderId, first.bubbleId), false);
  assert.equal(ledger.getEnterCount(renderId, first.bubbleId), 1);
  assert.deepEqual(
    ledger.getSnapshot(renderId)?.visibleSlots.map((slot) => slot.status),
    ["entered", "queued"],
  );
});

test("historical messages are all mounted at rest and never enter", () => {
  const ledger = createLedger();
  const renderId = "legacy:assistant:thread:record";
  const snapshot = ledger.prepareMessage(renderId, 3, "rest");

  assert.equal(snapshot.visibleSlots.length, 3);
  assert.deepEqual(snapshot.visibleSlots.map((slot) => slot.status), ["rest", "rest", "rest"]);
  for (const slot of snapshot.visibleSlots) {
    assert.equal(ledger.claimEntering(renderId, slot.bubbleId), false);
    assert.equal(ledger.getEnterCount(renderId, slot.bubbleId), 0);
  }
});

test("re-entering a previously animated message normalizes every bubble to rest", () => {
  const ledger = createLedger();
  const renderId = "assistant:thread:turn:item";
  let snapshot = ledger.prepareMessage(renderId, 2, "sequential");
  const first = snapshot.visibleSlots[0];
  ledger.claimEntering(renderId, first.bubbleId);
  ledger.completeEntering(renderId, first.bubbleId);
  snapshot = ledger.getSnapshot(renderId)!;
  const second = snapshot.visibleSlots[1];
  ledger.claimEntering(renderId, second.bubbleId);
  ledger.completeEntering(renderId, second.bubbleId);

  const history = ledger.prepareMessage(renderId, 2, "rest");
  assert.deepEqual(history.visibleSlots.map((slot) => slot.status), ["rest", "rest"]);
  assert.equal(ledger.getEnterCount(renderId, first.bubbleId), 1);
  assert.equal(ledger.getEnterCount(renderId, second.bubbleId), 1);
  assert.equal(ledger.claimEntering(renderId, first.bubbleId), false);
});

test("bubble identity is independent from text payload changes", () => {
  const ledger = createLedger();
  const renderId = "assistant:thread:turn:item";
  const before = ledger.prepareMessage(renderId, 3, "rest");
  const after = ledger.prepareMessage(renderId, 3, "rest");

  assert.deepEqual(
    after.visibleSlots.map((slot) => slot.bubbleId),
    before.visibleSlots.map((slot) => slot.bubbleId),
  );
});

test("explicit user segment ids produce stable message plus segment bubble ids", () => {
  const ledger = createLedger();
  const renderId = "user:message-1";
  const slotIds = ["segment-a", "segment-b", "segment-c"];
  const draft = ledger.prepareMessage(renderId, slotIds.length, "rest", slotIds);
  const archived = ledger.prepareMessage(renderId, slotIds.length, "rest", slotIds);

  assert.deepEqual(
    draft.visibleSlots.map((slot) => slot.bubbleId),
    [
      "user:message-1:bubble:segment-a",
      "user:message-1:bubble:segment-b",
      "user:message-1:bubble:segment-c",
    ],
  );
  assert.deepEqual(
    archived.visibleSlots.map((slot) => slot.bubbleId),
    draft.visibleSlots.map((slot) => slot.bubbleId),
  );
});

test("an appended live line emits a pre-mount anchor event before it is exposed", () => {
  const ledger = createLedger();
  const renderId = "assistant:thread:turn:item";
  const lifecycle: string[] = [];
  ledger.subscribeLifecycle((event) => {
    lifecycle.push(event.phase + ":" + event.bubbleId);
  });
  let snapshot = ledger.prepareMessage(renderId, 1, "sequential");
  const first = snapshot.visibleSlots[0];
  ledger.claimEntering(renderId, first.bubbleId);
  ledger.completeEntering(renderId, first.bubbleId);

  snapshot = ledger.prepareMessage(renderId, 3, "sequential");
  assert.equal(snapshot.visibleSlots.length, 1);
  assert.equal(ledger.revealNextIfReady(renderId), true);
  snapshot = ledger.getSnapshot(renderId)!;
  assert.equal(snapshot.visibleSlots.length, 2);
  assert.equal(
    lifecycle.includes("will-mount:" + snapshot.visibleSlots[1].bubbleId),
    true,
  );

  ledger.notifyMounted(renderId, snapshot.visibleSlots[1].bubbleId);
  assert.equal(
    lifecycle.at(-1),
    "mounted:" + snapshot.visibleSlots[1].bubbleId,
  );
});
