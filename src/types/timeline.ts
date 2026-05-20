export interface TimelineEvent {
  id: string;
  startAt: string;
  endAt: string;
  title: string;
  note?: string;
  categoryId?: string;
  subcategoryId?: string;
  eventNodeId?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface TimelineDay {
  status?: string;
  updatedAt?: string;
  events: TimelineEvent[];
  [key: string]: unknown;
}

export type TimelineState = Record<string, TimelineDay>;

export interface TimelineFactsContainer {
  facts: TimelineState;
  [key: string]: unknown;
}

export interface TimelineRange {
  startHour: number;
  endHour: number;
}

export interface TimelineEventLayoutItem {
  event: TimelineEvent;
  column: number;
  columns: number;
  span: number;
  leftPercent: number;
  widthPercent: number;
  zIndex: number;
  conflictCount: number;
}

export interface TimelineEventGroup {
  events: TimelineEvent[];
  maxEnd: number;
}

export interface TimelineCategoryAggregate {
  categoryId: string;
  minutes: number;
  percent: number;
}

export type TimelineResponse =
  | TimelineState
  | TimelineFactsContainer
  | {
      found: false;
      entry: null;
    };
