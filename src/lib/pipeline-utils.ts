/**
 * Shared pipeline date utilities for 30-day rolling window calculations.
 */

export function getToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getIn30Days(today?: Date): Date {
  const t = today ?? getToday();
  const d = new Date(t);
  d.setDate(d.getDate() + 30);
  return d;
}

/** Check if a piece is "upcoming" in the Geplant phase (next 30 days or no date set) */
export function isUpcomingHandedOver(scheduledPostDate: string | null | undefined): boolean {
  if (!scheduledPostDate) return true; // needs a date → counts as upcoming
  const postDate = new Date(scheduledPostDate);
  postDate.setHours(0, 0, 0, 0);
  const today = getToday();
  const in30 = getIn30Days(today);
  return postDate >= today && postDate <= in30;
}

/** Check if a piece is archived (posted in the past) */
export function isArchivedHandedOver(scheduledPostDate: string | null | undefined): boolean {
  if (!scheduledPostDate) return false;
  const postDate = new Date(scheduledPostDate);
  postDate.setHours(0, 0, 0, 0);
  const today = getToday();
  return postDate < today;
}
