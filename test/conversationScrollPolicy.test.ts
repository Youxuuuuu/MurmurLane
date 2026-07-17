import test from "node:test";
import assert from "node:assert/strict";
import {
  ConversationEntryMetrics,
  ConversationScrollCauseLedger,
  conversationScrollCauses,
  resolveBubbleRevealAnchorTop,
  shouldAnimateConversationBubble,
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
