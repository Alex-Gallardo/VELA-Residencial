export function normalizeDuplicateText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function duplicateTitleSimilarity(left: string, right: string) {
  const leftWords = new Set(normalizeDuplicateText(left).split(" "));
  const rightWords = new Set(normalizeDuplicateText(right).split(" "));
  const intersection = [...leftWords].filter((word) => rightWords.has(word));
  const union = new Set([...leftWords, ...rightWords]);
  return union.size === 0 ? 0 : intersection.length / union.size;
}
