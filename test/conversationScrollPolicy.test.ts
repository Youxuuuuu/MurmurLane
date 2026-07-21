import test from "node:test";
import assert from "node:assert/strict";
import {
  ConversationEntryMetrics,
  ConversationScrollCauseLedger,
  conversationScrollCauses,
  createConversationRenderWindow,
  expandConversationRangeEarlier,
  expandConversationRangeLater,
  getConversationHistoryPrefetchThreshold,
  resolveConversationRenderWindow,
  resolveBubbleRevealAnchorTop,
  resolveConversationViewportAnchorTop,
  shouldAnimateConversationBubble,
  shouldPrefetchConversationHistory,
  shouldShowFloatingDate,
} from "../src/lib/conversationScrollPolicy";
import { PageViewport } from "../src/components/layout/PageViewport";

test("the chat scroll policy exposes only the approved causes", () => {
  assert.deepEqual(conversationScrollCauses, [
    "user",
    "initial-position",
    "new-message",
    "date-jump",
    "history-prepend",
    "bubble-reveal",
  ]);
});

test("one chat entry can claim initial bottom positioning only once", () => {
  const metrics = new ConversationEntryMetrics();
  metrics.beginEntry("thread-1");

  assert.equal(metrics.claimInitialBottomPositioning(), true);
  assert.equal(metrics.claimInitialBottomPositioning(), false);
  assert.equal(metrics.snapshot().initialBottomPositioningCount, 1);
});

test("logical reconciliation with the same render id does not add a mount", () => {
  const metrics = new ConversationEntryMetrics();
  metrics.beginEntry("thread-1");
  metrics.observeLogicalMessages(["user:message-1", "assistant:thread-1:turn-1:item-1"]);
  metrics.observeLogicalMessages(["user:message-1", "assistant:thread-1:turn-1:item-1"]);

  assert.equal(metrics.snapshot().logicalMessageMountCount, 2);
});

test("programmatic scroll retains its explicit cause and cannot show floating date", () => {
  const ledger = new ConversationScrollCauseLedger();
  const plan = ledger.beginProgrammaticScroll({
    cause: "initial-position",
    requestedTop: 1000,
    currentTop: 0,
    scrollHeight: 1000,
    clientHeight: 400,
  });

  assert.deepEqual(plan, {
    shouldScroll: true,
    targetTop: 600,
    cause: "initial-position",
  });
  assert.equal(ledger.resolveScrollEvent(600), "initial-position");
  assert.equal(shouldShowFloatingDate("initial-position"), false);
  assert.equal(ledger.resolveScrollEvent(600), null);
});

test("floating date is enabled only by a user scroll intent", () => {
  const ledger = new ConversationScrollCauseLedger();
  assert.equal(ledger.resolveScrollEvent(40), null);
  ledger.noteUserScrollIntent();
  assert.equal(ledger.resolveScrollEvent(40), "user");
  assert.equal(shouldShowFloatingDate("user"), true);
  assert.equal(ledger.resolveScrollEvent(41), null);
});

test("bubble reveal follows the exact height delta only while the user remains near bottom", () => {
  const common = {
    anchorScrollTop: 500,
    anchorScrollHeight: 1000,
    currentScrollHeight: 1064,
    anchorUserRevision: 3,
    currentUserRevision: 3,
  };

  assert.equal(resolveBubbleRevealAnchorTop({
    ...common,
    wasNearBottom: true,
  }), 564);
  assert.equal(resolveBubbleRevealAnchorTop({
    ...common,
    wasNearBottom: false,
  }), null);
  assert.equal(resolveBubbleRevealAnchorTop({
    ...common,
    wasNearBottom: true,
    currentUserRevision: 4,
  }), null);

  const secondRevealTop = resolveBubbleRevealAnchorTop({
    wasNearBottom: true,
    anchorScrollTop: 564,
    anchorScrollHeight: 1064,
    currentScrollHeight: 1100,
    anchorUserRevision: 3,
    currentUserRevision: 3,
  });
  assert.equal(secondRevealTop, 600);
});

test("initial archived bubbles stay at rest while a new live bubble may animate", () => {
  const common = {
    isUnseen: true,
    awaitingInitialBatch: true,
    reduceMotion: false,
    historyLoading: false,
    navigating: false,
  };

  assert.equal(shouldAnimateConversationBubble({ ...common, isLive: false }), false);
  assert.equal(shouldAnimateConversationBubble({ ...common, isLive: true }), true);
});

test("history windowing keeps a bounded overlapping render range", () => {
  const earlier = expandConversationRangeEarlier({
    range: { start: 800, end: 1000 },
    total: 1000,
    step: 80,
  });
  const later = expandConversationRangeLater({
    range: { start: 0, end: 200 },
    total: 1000,
    step: 80,
  });

  assert.deepEqual(earlier, { start: 720, end: 920 });
  assert.deepEqual(later, { start: 80, end: 280 });
  assert.equal(earlier.end - earlier.start, 200);
  assert.equal(later.end - later.start, 200);
});

test("history windows preload before the user reaches a hard edge", () => {
  assert.equal(getConversationHistoryPrefetchThreshold(720), 1080);
  assert.equal(getConversationHistoryPrefetchThreshold(120), 320);
  assert.equal(shouldPrefetchConversationHistory(5000, 1080, 5000), true);
  assert.equal(shouldPrefetchConversationHistory(5000, 1080, 0), false);
});

test("a short initial window grows as contiguous history becomes available", () => {
  const next = expandConversationRangeEarlier({
    range: { start: 14, end: 64 },
    total: 64,
    step: 80,
    maximumSize: 200,
  });

  assert.deepEqual(next, { start: 0, end: 64 });
});

test("history insertion preserves the real DOM anchor instead of guessing from scroll height", () => {
  const nextTop = resolveConversationViewportAnchorTop({
    currentScrollTop: 0,
    previousScrollHeight: 14_875,
    currentScrollHeight: 15_693,
    previousAnchorOffset: 204,
    currentAnchorOffset: 10_349,
  });

  assert.equal(nextTop, 10_145);
});

test("prepended records do not replace the active render window before anchoring", () => {
  const currentIds = Array.from({ length: 400 }, (_, index) => `message-${index}`);
  const currentWindow = createConversationRenderWindow({
    messageIds: currentIds,
    scopeKey: "thread-1",
    range: { start: 200, end: 400 },
    maximumSize: 200,
  });
  const prependedIds = [
    ...Array.from({ length: 80 }, (_, index) => `older-${index}`),
    ...currentIds,
  ];
  const indexById = new Map(prependedIds.map((id, index) => [id, index]));
  const resolved = resolveConversationRenderWindow({
    window: currentWindow,
    messageIds: prependedIds,
    messageIndexById: indexById,
    scopeKey: "thread-1",
    maximumSize: 200,
  });

  assert.deepEqual(
    prependedIds.slice(resolved.start, resolved.end),
    currentIds.slice(200),
  );
});

test("PageViewport changes labels without keying and remounting its root", () => {
  const viewport = PageViewport({
    viewportKey: "Conversation-chat",
    scrollMode: "contained",
    header: null,
    children: null,
  });

  assert.equal(viewport.key, null);
  assert.equal(viewport.props["data-viewport"], "Conversation-chat");
});
