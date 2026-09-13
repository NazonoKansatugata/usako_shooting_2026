export const OPENING_TIMELINE = {
  preludeDuration: 5,
  duration: 43,
  segments: [
    { id: 'dedication', end: 1 },
    { id: 'telescope', end: 3 },
    { id: 'moon', end: 5 },
    { id: 'impact', end: 9 },
    { id: 'title', end: 11 },
    { id: 'characters', end: 17 },
    { id: 'story', end: 29 },
    { id: 'gameplay', end: 40.5 },
    { id: 'final-title', end: 43 },
  ],
} as const;

export type OpeningSegmentId = (typeof OPENING_TIMELINE.segments)[number]['id'];

export function getOpeningSegment(seconds: number): OpeningSegmentId {
  return OPENING_TIMELINE.segments.find((segment) => seconds < segment.end)?.id ?? 'final-title';
}