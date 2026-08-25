import { cellAt, positionKey } from './board-geometry.js';

export const EMPTY_UNDO_HISTORY = Object.freeze({
  board: null,
  previous: null,
  length: 0,
});

export function createPlayState(people) {
  return {
    assignments: {},
    candidatePositions: {},
    blockedPositions: new Set(),
    manualMarks: new Set(),
    history: EMPTY_UNDO_HISTORY,
    selectedPerson: people[0] || '',
    mode: 'place',
  };
}

export function candidatePeopleAtPosition(candidatePositions, position) {
  return Object.entries(candidatePositions || {})
    .filter(([, positions]) => positions.includes(position))
    .map(([personId]) => personId);
}

export function candidateLabelForPerson(people, personId) {
  const index = (people || []).findIndex((person) => person.id === personId);
  if (index < 0) {
    return '';
  }
  return index < 26 ? String.fromCharCode(97 + index) : String(index + 1);
}

export function toggleCandidatePosition(playState, personId, position, puzzle = null) {
  if (!canPlaceCandidate(playState, personId, position, puzzle)) {
    return withBlockedPositions(playState, puzzle);
  }
  const candidatePositions = { ...(playState.candidatePositions || {}) };
  const positions = new Set(candidatePositions[personId] || []);
  if (positions.has(position)) {
    positions.delete(position);
  } else {
    positions.add(position);
  }
  if (positions.size) {
    candidatePositions[personId] = [...positions];
  } else {
    delete candidatePositions[personId];
  }
  return pushHistory(playState, { candidatePositions }, puzzle);
}

export function confirmPersonPlacement(playState, personId, position, puzzle = null) {
  if (playState.manualMarks?.has(position)) {
    return withBlockedPositions(playState, puzzle);
  }
  const placed = placePerson(playState, personId, position, puzzle);
  if (placed.assignments[personId] !== position) {
    return placed;
  }
  const withoutPlacedPerson = cloneCandidatePositions(placed.candidatePositions);
  delete withoutPlacedPerson[personId];
  return {
    ...placed,
    candidatePositions: pruneCandidatePositions(
      { ...placed, candidatePositions: withoutPlacedPerson },
      puzzle,
    ),
  };
}

export function placePerson(playState, personId, position, puzzle = null) {
  if (playState.manualMarks?.has(position)) {
    return withBlockedPositions(playState, puzzle);
  }
  if (puzzle && !canPlacePerson(playState.assignments, personId, position, puzzle)) {
    return withBlockedPositions(playState, puzzle);
  }
  if (playState.assignments[personId] === position) {
    return withBlockedPositions(playState, puzzle);
  }
  const nextAssignments = { ...playState.assignments };
  for (const [assignedPerson, assignedPosition] of Object.entries(nextAssignments)) {
    if (assignedPosition === position && assignedPerson !== personId) {
      delete nextAssignments[assignedPerson];
    }
  }
  nextAssignments[personId] = position;
  return pushHistory(playState, { assignments: nextAssignments }, puzzle);
}

export function clearPosition(playState, position, puzzle = null) {
  const nextAssignments = { ...playState.assignments };
  const personAtPosition = Object.keys(nextAssignments).find(
    (personId) => nextAssignments[personId] === position,
  );
  if (!personAtPosition) {
    return withBlockedPositions(playState, puzzle);
  }
  delete nextAssignments[personAtPosition];
  return pushHistory(playState, { assignments: nextAssignments }, puzzle);
}

export function eraseAll(playState, puzzle = null) {
  const hasCandidates = Object.keys(playState.candidatePositions || {}).length > 0;
  const hasManualMarks = (playState.manualMarks?.size || 0) > 0;
  if (!Object.keys(playState.assignments).length && !hasCandidates && !hasManualMarks) {
    return withBlockedPositions(playState, puzzle);
  }
  return pushHistory(playState, {
    assignments: {},
    candidatePositions: {},
    manualMarks: new Set(),
  }, puzzle);
}

export function undoLast(playState, puzzle = null) {
  if (!playState.history.length) {
    return withBlockedPositions(playState, puzzle);
  }
  return {
    ...playState,
    ...playState.history.board,
    history: playState.history.previous,
  };
}

export function selectPerson(playState, personId) {
  return {
    ...playState,
    selectedPerson: personId,
    mode: 'place',
  };
}

export function selectTool(playState, tool) {
  if (!['mark-x', 'erase', 'investigate'].includes(tool)) {
    throw new Error(`Unknown tool: ${tool}`);
  }
  return {
    ...playState,
    selectedPerson: '',
    mode: tool,
  };
}

export function markPosition(playState, position, puzzle = null) {
  if (!canMarkPosition(playState, position, puzzle)) {
    return playState;
  }
  if (playState.manualMarks?.has(position)) {
    return withBlockedPositions(playState, puzzle);
  }
  const manualMarks = new Set(playState.manualMarks || []);
  manualMarks.add(position);
  const withoutCandidates = eraseCandidatesAtPosition(playState, position);
  return pushHistory(playState, {
    candidatePositions: withoutCandidates.candidatePositions,
    manualMarks,
  }, puzzle);
}

export function createBoardHistoryTransaction(playState) {
  const previousHistory = playState.history || EMPTY_UNDO_HISTORY;
  return {
    board: boardHistorySnapshot(playState),
    previous: previousHistory,
    length: previousHistory.length + 1,
  };
}

export function coalesceBoardHistoryChange(playState, nextPlayState, transactionHistory) {
  if (!transactionHistory || nextPlayState.history === playState.history) {
    return nextPlayState;
  }
  return {
    ...nextPlayState,
    history: transactionHistory,
  };
}

export function eraseManualMark(playState, position) {
  if (!playState.manualMarks?.has(position)) {
    return playState;
  }
  const manualMarks = new Set(playState.manualMarks);
  manualMarks.delete(position);
  return {
    ...playState,
    manualMarks,
  };
}

export function eraseCell(playState, position, puzzle = null) {
  const hadManualMark = playState.manualMarks?.has(position) || false;
  const hadCandidates = candidatePeopleAtPosition(
    playState.candidatePositions,
    position,
  ).length > 0;
  const withoutMark = eraseManualMark(playState, position);
  const withoutCandidates = eraseCandidatesAtPosition(withoutMark, position);
  const nextAssignments = { ...withoutCandidates.assignments };
  const personAtPosition = Object.keys(nextAssignments).find(
    (personId) => nextAssignments[personId] === position,
  );
  if (personAtPosition) {
    delete nextAssignments[personAtPosition];
  }
  if (!personAtPosition && !hadManualMark && !hadCandidates) {
    return withBlockedPositions(playState, puzzle);
  }
  return pushHistory(playState, {
    assignments: nextAssignments,
    candidatePositions: withoutCandidates.candidatePositions,
    manualMarks: withoutCandidates.manualMarks,
  }, puzzle);
}

export function computeBlockedPositions(assignments, puzzle, options = {}) {
  const blocked = new Set();
  if (!puzzle?.cells) {
    return blocked;
  }

  const ignorePersonId = options.ignorePersonId || options.ignoredPersonId || '';
  const placed = Object.entries(assignments)
    .filter(([personId, position]) => position && personId !== ignorePersonId)
    .map(([personId, position]) => {
      const [row, col] = position.split(',').map(Number);
      return { personId, position, row, col };
    });
  const occupied = new Set(placed.map((item) => item.position));

  for (const cell of puzzle.cells) {
    if (!cell.walkable) {
      continue;
    }
    const key = positionKey(cell.row, cell.col);
    if (occupied.has(key)) {
      continue;
    }
    for (const item of placed) {
      if (cell.row === item.row || cell.col === item.col) {
        blocked.add(key);
        break;
      }
    }
  }
  return blocked;
}

export function canConfirmPersonPlacement(playState, personId, position, puzzle = null) {
  if (playState.manualMarks?.has(position) || playState.assignments?.[personId] === position) {
    return false;
  }
  if (!puzzle?.cells) {
    return true;
  }
  return canPlacePerson(playState.assignments || {}, personId, position, puzzle);
}

function pushHistory(playState, boardChanges, puzzle = null) {
  const assignments = boardChanges.assignments ?? playState.assignments;
  const candidatePositions = boardChanges.candidatePositions
    ?? playState.candidatePositions
    ?? {};
  const manualMarks = boardChanges.manualMarks ?? playState.manualMarks ?? new Set();
  const previousHistory = playState.history || EMPTY_UNDO_HISTORY;
  return {
    ...playState,
    ...boardChanges,
    assignments,
    candidatePositions,
    manualMarks,
    blockedPositions: computeBlockedPositions(assignments, puzzle),
    history: {
      board: boardHistorySnapshot(playState),
      previous: previousHistory,
      length: previousHistory.length + 1,
    },
  };
}

function boardHistorySnapshot(playState) {
  return {
    assignments: playState.assignments,
    candidatePositions: playState.candidatePositions || {},
    blockedPositions: playState.blockedPositions,
    manualMarks: playState.manualMarks || new Set(),
  };
}

function withBlockedPositions(playState, puzzle = null) {
  return {
    ...playState,
    blockedPositions: computeBlockedPositions(playState.assignments, puzzle),
  };
}

function canPlacePerson(assignments, personId, position, puzzle) {
  const [row, col] = position.split(',').map(Number);
  if (!cellAt(puzzle, row, col)?.walkable) {
    return false;
  }
  const ignorePersonId = assignments[personId] ? personId : '';
  return !computeBlockedPositions(assignments, puzzle, { ignorePersonId }).has(position);
}

function canPlaceCandidate(playState, personId, position, puzzle = null) {
  if (playState.manualMarks?.has(position)) {
    return false;
  }
  if (Object.values(playState.assignments || {}).includes(position)) {
    return false;
  }
  if (!puzzle?.cells) {
    return true;
  }
  return canPlacePerson(playState.assignments || {}, personId, position, puzzle);
}

function cloneCandidatePositions(candidatePositions = {}) {
  return Object.fromEntries(
    Object.entries(candidatePositions).map(([personId, positions]) => [
      personId,
      [...positions],
    ]),
  );
}

function eraseCandidatesAtPosition(playState, position) {
  const candidatePositions = {};
  for (const [personId, positions] of Object.entries(playState.candidatePositions || {})) {
    const remaining = positions.filter((candidate) => candidate !== position);
    if (remaining.length) {
      candidatePositions[personId] = remaining;
    }
  }
  return {
    ...playState,
    candidatePositions,
  };
}

function pruneCandidatePositions(playState, puzzle = null) {
  const candidatePositions = {};
  for (const [personId, positions] of Object.entries(playState.candidatePositions || {})) {
    const remaining = positions.filter(
      (position) => canPlaceCandidate(playState, personId, position, puzzle),
    );
    if (remaining.length) {
      candidatePositions[personId] = remaining;
    }
  }
  return candidatePositions;
}

function canMarkPosition(playState, position, puzzle = null) {
  if (Object.values(playState.assignments || {}).includes(position)) {
    return false;
  }
  if (!puzzle?.cells) {
    return true;
  }
  const [row, col] = position.split(',').map(Number);
  return Boolean(cellAt(puzzle, row, col)?.walkable);
}
