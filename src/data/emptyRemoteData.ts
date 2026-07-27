import type { RemoteData } from "../types/api";

export const emptyRemoteData: RemoteData = {
  conversationEntries: {},
  conversationMoments: [],
  conversationProfiles: null,
  timelineState: {},
  diaryEntries: {},
  dailySummaryEntries: {},
  letterEntries: {},
  staticModeEntries: {},
  xiaoyeEntries: {},
  reminderHistoryEntries: [],
  dateIndex: null,
  searchCache: {
    conversations: {},
    diary: {},
    dailySummary: {},
    letters: {},
    timeline: {},
  },
};
