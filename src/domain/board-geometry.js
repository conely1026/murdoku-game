export function positionKey(row, col) {
  return `${row},${col}`;
}

export function cellAt(puzzle, row, col) {
  return puzzle?.cells?.find((item) => item.row === row && item.col === col) || null;
}

export function parseCellReference(value) {
  const match = /^R(\d+)C(\d+)$/.exec(value || '');
  return match ? { row: Number(match[1]), col: Number(match[2]) } : null;
}

export function isOpenPresentationBoundary(boundaryStyle, a, b) {
  if (!boundaryStyle?.open_edges?.length) {
    return false;
  }
  const key = [a, b].sort().join('|');
  return boundaryStyle.open_edges.some((edge) => (
    [edge.a, edge.b].sort().join('|') === key
  ));
}

export function regionBoundaryClasses(puzzle, cell, boundaryStyle = null) {
  const classes = [];
  if (!puzzle || !cell) {
    return classes;
  }

  const sameRegion = (row, col) => cellAt(puzzle, row, col)?.region === cell.region;
  if (cell.row === 1 || !sameRegion(cell.row - 1, cell.col)) {
    const isOpen = cell.row > 1 && isOpenPresentationBoundary(
      boundaryStyle,
      cellReference(cell.row, cell.col),
      cellReference(cell.row - 1, cell.col),
    );
    if (!isOpen) {
      classes.push('region-border-top');
    }
    classes.push('region-outline-top');
  }
  if (cell.col === 1 || !sameRegion(cell.row, cell.col - 1)) {
    const isOpen = cell.col > 1 && isOpenPresentationBoundary(
      boundaryStyle,
      cellReference(cell.row, cell.col),
      cellReference(cell.row, cell.col - 1),
    );
    if (!isOpen) {
      classes.push('region-border-left');
    }
    classes.push('region-outline-left');
  }
  if (cell.row === puzzle.rows) {
    classes.push('region-border-bottom');
  }
  if (cell.col === puzzle.cols) {
    classes.push('region-border-right');
  }
  if (cell.row === puzzle.rows || !sameRegion(cell.row + 1, cell.col)) {
    classes.push('region-outline-bottom');
  }
  if (cell.col === puzzle.cols || !sameRegion(cell.row, cell.col + 1)) {
    classes.push('region-outline-right');
  }
  return classes;
}

export function regionCellsByName(puzzle) {
  const regions = {};
  for (const cell of puzzle?.cells || []) {
    if (!regions[cell.region]) {
      regions[cell.region] = [];
    }
    regions[cell.region].push(cell);
  }
  return regions;
}

function cellReference(row, col) {
  return `R${row}C${col}`;
}
