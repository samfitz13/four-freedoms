export interface ReviewResultOk {
  ok: true;
  weekStart: string;
}

export interface ReviewResultErr {
  ok: false;
  error: string;
}

export type ReviewResult = ReviewResultOk | ReviewResultErr;

export interface Reflections {
  wins?: string;
  struggles?: string;
  nextWeek?: string;
}
