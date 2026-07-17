import type { ReactNode } from "react";
import type {
  AssistantTurnDisplayItem,
  ConversationDisplayRecordEntry,
} from "../../lib/assistantTurnModel";
import { ThinkingPanel } from "./ThinkingPanel";

export function AssistantTurn({
  turn,
  thinkingFace,
  renderRecord,
}: {
  turn: AssistantTurnDisplayItem;
  thinkingFace?: string;
  renderRecord: (entry: ConversationDisplayRecordEntry) => ReactNode;
}) {
  let thinkingPanelRendered = false;
  return (
    <div
      data-assistant-turn-id={turn.renderId}
      data-thread-id={turn.threadId}
      data-turn-id={turn.turnId}
    >
      {turn.entries.map((entry) => {
        const type = String(entry.record.type || entry.record.role || "").trim();
        if (type === "thinking") {
          if (thinkingPanelRendered) return null;
          thinkingPanelRendered = true;
          return (
            <ThinkingPanel
              key={turn.thinkingPanelId}
              records={turn.thinkingRecords}
              panelId={turn.thinkingPanelId}
              face={thinkingFace}
              standalone
            />
          );
        }
        return renderRecord(entry);
      })}
    </div>
  );
}
