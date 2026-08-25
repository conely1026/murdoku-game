import { FORMAL_PLACEMENT_HOLD_MS } from '../config/game-config.js';
import { positionKey } from '../domain/board-geometry.js';
import {
  canConfirmPersonPlacement,
  coalesceBoardHistoryChange,
  confirmPersonPlacement,
  createBoardHistoryTransaction,
  eraseCell,
  markPosition,
} from '../domain/play-state.js';

export function createBoardInteractionController({
  getContext,
  applyPlayState,
  clearFeedback,
  documentRef = () => document,
  timerHost = () => window,
}) {
  let placementHold = null;
  let suppressedCandidateClick = null;
  let paintHistoryTransaction = null;
  let isPainting = false;
  let lastPaintedPosition = '';

  function handleCellPointerDown(event, row, col, cellElement) {
    if (isPaintToolActive(getContext().playState.mode)) {
      startPainting();
      applyToolToPosition(positionKey(row, col));
      event.preventDefault();
      return;
    }
    beginPlacementHold(event, row, col, cellElement);
  }

  function handleCellPointerEnter(row, col) {
    const { playState } = getContext();
    if (!isPainting || !isPaintToolActive(playState.mode)) {
      return;
    }
    applyToolToPosition(positionKey(row, col));
  }

  function handleGlobalPointerMove(event) {
    handlePaintPointerMove(event);
    if (!placementHold || placementHold.pointerId !== event.pointerId) {
      return;
    }
    const cell = documentRef().elementFromPoint(event.clientX, event.clientY)?.closest('.cell');
    if (cell !== placementHold.cellElement) {
      cancelPlacementHold(event.pointerId);
    }
  }

  function handleGlobalPointerEnd(event) {
    stopPainting();
    cancelPlacementHold(event.pointerId);
  }

  function stopInteractions() {
    stopPainting();
    cancelPlacementHold();
  }

  function handleKeyboardFormalPlacement(event, row, col) {
    const { playState, puzzle } = getContext();
    if (playState.mode !== 'place' || !playState.selectedPerson) {
      return;
    }
    event.preventDefault();
    const position = positionKey(row, col);
    if (!canConfirmPersonPlacement(playState, playState.selectedPerson, position, puzzle)) {
      return;
    }
    applyPlayState(confirmPersonPlacement(
      playState,
      playState.selectedPerson,
      position,
      puzzle,
    ));
    clearFeedback();
  }

  function consumeSuppressedCandidateClick(position) {
    if (!suppressedCandidateClick) {
      return false;
    }
    const shouldSuppress = suppressedCandidateClick.position === position
      && Date.now() <= suppressedCandidateClick.expiresAt;
    suppressedCandidateClick = null;
    return shouldSuppress;
  }

  function handlePaintPointerMove(event) {
    const { playState } = getContext();
    if (!isPainting || !isPaintToolActive(playState.mode)) {
      return;
    }
    const cell = documentRef().elementFromPoint(event.clientX, event.clientY)?.closest('.cell');
    if (cell?.dataset.position) {
      applyToolToPosition(cell.dataset.position);
    }
  }

  function applyToolToPosition(position) {
    if (lastPaintedPosition === position) {
      return;
    }
    lastPaintedPosition = position;
    const { playState, puzzle } = getContext();
    let nextPlayState = playState;
    if (playState.mode === 'mark-x') {
      nextPlayState = markPosition(playState, position, puzzle);
    } else if (playState.mode === 'erase') {
      nextPlayState = eraseCell(playState, position, puzzle);
    }
    applyPlayState(coalesceBoardHistoryChange(
      playState,
      nextPlayState,
      paintHistoryTransaction,
    ));
    clearFeedback();
  }

  function beginPlacementHold(event, row, col, cellElement) {
    const { playState, puzzle } = getContext();
    if (
      playState.mode !== 'place'
      || !playState.selectedPerson
      || !event.isPrimary
      || event.button !== 0
    ) {
      return;
    }
    const position = positionKey(row, col);
    if (!canConfirmPersonPlacement(
      playState,
      playState.selectedPerson,
      position,
      puzzle,
    )) {
      return;
    }
    cancelPlacementHold();
    const progress = documentRef().createElement('span');
    progress.className = 'placement-hold-progress';
    progress.setAttribute('aria-hidden', 'true');
    cellElement.classList.add('is-placement-holding');
    cellElement.appendChild(progress);
    const hold = {
      cellElement,
      personId: playState.selectedPerson,
      pointerId: event.pointerId,
      position,
      progress,
      timerId: 0,
    };
    placementHold = hold;
    hold.timerId = timerHost().setTimeout(
      () => completePlacementHold(hold),
      FORMAL_PLACEMENT_HOLD_MS,
    );
  }

  function completePlacementHold(hold) {
    const { playState, puzzle } = getContext();
    if (
      placementHold !== hold
      || playState.mode !== 'place'
      || playState.selectedPerson !== hold.personId
    ) {
      return;
    }
    placementHold = null;
    hold.cellElement.classList.remove('is-placement-holding');
    hold.progress.remove();
    suppressedCandidateClick = {
      position: hold.position,
      expiresAt: Date.now() + 600,
    };
    applyPlayState(confirmPersonPlacement(
      playState,
      hold.personId,
      hold.position,
      puzzle,
    ));
    clearFeedback();
  }

  function cancelPlacementHold(pointerId = null) {
    if (!placementHold || (pointerId !== null && placementHold.pointerId !== pointerId)) {
      return;
    }
    timerHost().clearTimeout(placementHold.timerId);
    placementHold.cellElement.classList.remove('is-placement-holding');
    placementHold.progress.remove();
    placementHold = null;
  }

  function startPainting() {
    const { playState } = getContext();
    isPainting = true;
    lastPaintedPosition = '';
    paintHistoryTransaction = createBoardHistoryTransaction(playState);
  }

  function stopPainting() {
    isPainting = false;
    lastPaintedPosition = '';
    paintHistoryTransaction = null;
  }

  return Object.freeze({
    consumeSuppressedCandidateClick,
    handleCellPointerDown,
    handleCellPointerEnter,
    handleGlobalPointerEnd,
    handleGlobalPointerMove,
    handleKeyboardFormalPlacement,
    stopInteractions,
  });
}

function isPaintToolActive(mode) {
  return mode === 'mark-x' || mode === 'erase';
}
