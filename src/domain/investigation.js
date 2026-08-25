export function investigationItemAt(puzzle, row, col) {
  return puzzle?.investigation?.items?.find(
    (item) => Number(item.row) === Number(row) && Number(item.col) === Number(col),
  ) || null;
}

export function collectInvestigationItem(collectedIds, itemId) {
  const collected = new Set(collectedIds || []);
  if (itemId) {
    collected.add(itemId);
  }
  return collected;
}
