export const OPENING_TIMELINE = {
  preludeDuration: 10,
  duration: 43,
  segments: [
    { id: 'dedication', end: 2 },
    { id: 'telescope', end: 3.25 },
    { id: 'moon', end: 5 },
    { id: 'impact', end: 11 },
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