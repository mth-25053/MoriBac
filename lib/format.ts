export function serializeCandidate<T extends { average: unknown }>(candidate: T) {
  return { ...candidate, average: Number(candidate.average) };
}

export function formatAverage(value: number) {
  return `${value.toFixed(2)} /20`;
}
