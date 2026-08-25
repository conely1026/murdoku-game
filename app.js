import {
  ART_MODE_DEFAULT,
  COMMON_OBJECT_ASSETS,
  FORMAL_PLACEMENT_HOLD_MS,
  LEVEL_INDEX,
  PACK_BASE,
  PORTRAIT_ASSETS,
} from './src/config/game-config.js';
import { createBoardInteractionController } from './src/controllers/board-interaction-controller.js';
import {
  isOpenPresentationBoundary,
  positionKey,
  regionBoundaryClasses,
  regionCellsByName,
} from './src/domain/board-geometry.js';
import {
  activeCluesByPerson,
  clueCardOwnerId,
  generalClues,
  NO_DIRECT_CLUE_TEXT,
  personClueText,
} from './src/domain/clues.js';
import {
  collectInvestigationItem,
  investigationItemAt,
} from './src/domain/investigation.js';
import {
  candidateLabelForPerson,
  candidatePeopleAtPosition,
  clearPosition,
  coalesceBoardHistoryChange,
  computeBlockedPositions,
  confirmPersonPlacement,
  createBoardHistoryTransaction,
  createPlayState,
  EMPTY_UNDO_HISTORY,
  eraseAll,
  eraseCell,
  eraseManualMark,
  markPosition,
  placePerson,
  selectPerson,
  selectTool,
  toggleCandidatePosition,
  undoLast,
} from './src/domain/play-state.js';
import { evaluateSubmission } from './src/domain/submission.js';
import {
  loadCollectedInvestigationIds,
  saveCollectedInvestigationIds,
} from './src/infrastructure/investigation-storage.js';
import { publicAssetUrl } from './src/infrastructure/public-assets.js';
import {
  loadLevelIndex,
  loadMatrixSkinAssets,
  loadPublicPack,
  packBaseForLevel,
} from './src/infrastructure/public-pack.js';
import {
  objectPlacementStyle,
} from './src/presentation/matrix-skin-layers.js';
import {
  renderBoardView,
  updateRegionHighlightView,
} from './src/presentation/board-view.js';
import {
  renderGeneralCluesView,
  renderInvestigationView,
  renderPeopleView,
  renderStoryView,
} from './src/presentation/sidebar-view.js';
import {
  boardBackgroundAssetFor,
  boundaryToneFor,
  cellObjectAssetFor,
  cellSceneAssetFor,
  commonObjectAssetFor,
  largeGridMinWidth,
  objectOverlayOpacityFor,
  portraitAssetFor,
  sceneBackgroundAssetFor,
  tileClasses,
  visualModeFromSearch,
} from './src/presentation/visual-assets.js';

export {
  ART_MODE_DEFAULT,
  COMMON_OBJECT_ASSETS,
  FORMAL_PLACEMENT_HOLD_MS,
  LEVEL_INDEX,
  NO_DIRECT_CLUE_TEXT,
  PACK_BASE,
  PORTRAIT_ASSETS,
  activeCluesByPerson,
  boardBackgroundAssetFor,
  boundaryToneFor,
  candidateLabelForPerson,
  candidatePeopleAtPosition,
  cellObjectAssetFor,
  cellSceneAssetFor,
  clearPosition,
  clueCardOwnerId,
  coalesceBoardHistoryChange,
  collectInvestigationItem,
  commonObjectAssetFor,
  computeBlockedPositions,
  confirmPersonPlacement,
  createBoardHistoryTransaction,
  createPlayState,
  eraseAll,
  eraseCell,
  eraseManualMark,
  evaluateSubmission,
  generalClues,
  investigationItemAt,
  isOpenPresentationBoundary,
  largeGridMinWidth,
  loadLevelIndex,
  loadMatrixSkinAssets,
  loadPublicPack,
  markPosition,
  objectOverlayOpacityFor,
  objectPlacementStyle,
  packBaseForLevel,
  personClueText,
  placePerson,
  portraitAssetFor,
  positionKey,
  regionBoundaryClasses,
  regionCellsByName,
  sceneBackgroundAssetFor,
  selectPerson,
  selectTool,
  tileClasses,
  toggleCandidatePosition,
  undoLast,
  visualModeFromSearch,
};

const state = {
  levels: [],
  currentLevel: null,
  puzzle: null,
  proof: null,
  hints: null,
  tileManifest: null,
  materialManifest: null,
  objectManifest: null,
  visualMode: ART_MODE_DEFAULT,
  hoveredRegion: '',
  focusedRegion: '',
  selectedRegion: '',
  selectedPerson: '',
  mode: 'place',
  assignments: {},
  candidatePositions: {},
  blockedPositions: new Set(),
  manualMarks: new Set(),
  history: EMPTY_UNDO_HISTORY,
  activeHint: 0,
  collectedInvestigationIds: new Set(),
};

const boardInteractions = createBoardInteractionController({
  getContext: () => ({
    playState: snapshotPlayState(),
    puzzle: state.puzzle,
  }),
  applyPlayState,
  clearFeedback,
});

async function init() {
  try {
    const levelIndex = await loadLevelIndex();
    state.levels = levelIndex.levels || [];
    window.addEventListener('pointerup', boardInteractions.handleGlobalPointerEnd);
    window.addEventListener('pointercancel', boardInteractions.handleGlobalPointerEnd);
    window.addEventListener('pointermove', boardInteractions.handleGlobalPointerMove);
    window.addEventListener('popstate', handlePopState);
    bindShellActions();
    renderLevelSelect();

    const requestedLevel = new URLSearchParams(window.location.search).get('level');
    if (requestedLevel && levelById(requestedLevel)) {
      await loadLevel(requestedLevel, { updateUrl: false });
      return;
    }

    showLevelSelect({ updateUrl: false });
  } catch (error) {
    showLoadError(error);
  }
}

function render() {
  if (!state.puzzle) {
    return;
  }
  document.title = state.puzzle.title;
  byId('puzzle-title').textContent = state.puzzle.title;
  byId('proof-pill').textContent = state.proof.valid
    ? '已验证 · 唯一解'
    : 'proof 未通过';
  renderStory();
  renderBoard();
  renderGeneralClues();
  renderInvestigationPanel();
  renderPeople();
  renderSubmitState();
  bindActions();
}

function bindShellActions() {
  byId('back-button').onclick = () => showLevelSelect();
}

function renderLevelSelect() {
  const list = byId('level-list');
  list.replaceChildren();
  for (const level of state.levels) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'level-card';
    card.dataset.levelId = level.id;
    card.addEventListener('click', () => {
      loadLevel(level.id).catch(showLoadError);
    });

    const meta = document.createElement('span');
    meta.className = 'level-card-meta';
    meta.textContent = `${level.difficulty || '标准'} · 已验证题包`;

    const title = document.createElement('span');
    title.className = 'level-card-title';
    title.textContent = level.title;

    const subtitle = document.createElement('span');
    subtitle.className = 'level-card-subtitle';
    subtitle.textContent = level.subtitle || '';

    const summary = document.createElement('span');
    summary.className = 'level-card-summary';
    summary.textContent = level.summary || '';

    card.append(meta, title, subtitle, summary);
    list.appendChild(card);
  }
}

async function loadLevel(levelId, options = {}) {
  const level = levelById(levelId);
  if (!level) {
    throw new Error(`未知关卡：${levelId}`);
  }

  const pack = await loadPublicPack(packBaseForLevel(level));
  state.currentLevel = level;
  state.puzzle = pack.puzzle;
  state.proof = pack.proof;
  state.hints = pack.hints;
  state.tileManifest = pack.tileManifest;
  state.materialManifest = pack.materialManifest;
  state.objectManifest = pack.objectManifest;
  state.visualMode = options.visualMode || visualModeFromSearch(
    typeof window === 'undefined' ? '' : window.location.search,
  );
  state.selectedPerson = pack.puzzle.people[0]?.id || '';
  state.mode = 'place';
  state.assignments = {};
  state.candidatePositions = {};
  state.blockedPositions = new Set();
  state.manualMarks = new Set();
  state.history = EMPTY_UNDO_HISTORY;
  state.activeHint = 0;
  state.hoveredRegion = '';
  state.focusedRegion = '';
  state.selectedRegion = '';
  state.collectedInvestigationIds = loadCollectedInvestigationIds(levelId);
  if (typeof document !== 'undefined') {
    document.body.dataset.levelId = level.id;
  }
  boardInteractions.stopInteractions();
  applyVisualManifest();
  showGameScreen(options);
  render();
}

function showGameScreen(options = {}) {
  byId('level-select').hidden = true;
  byId('game-screen').classList.remove('is-hidden');
  if (options.updateUrl !== false) {
    updateLevelUrl(state.currentLevel?.id || '');
  }
}

function showLevelSelect(options = {}) {
  if (typeof document !== 'undefined') {
    delete document.body.dataset.levelId;
  }
  state.currentLevel = null;
  state.puzzle = null;
  state.proof = null;
  state.hints = null;
  state.tileManifest = null;
  state.materialManifest = null;
  state.objectManifest = null;
  state.visualMode = ART_MODE_DEFAULT;
  state.hoveredRegion = '';
  state.focusedRegion = '';
  state.selectedRegion = '';
  state.candidatePositions = {};
  state.collectedInvestigationIds = new Set();
  boardInteractions.stopInteractions();
  clearVisualManifest();
  document.title = 'Murdoku';
  byId('game-screen').classList.add('is-hidden');
  byId('level-select').hidden = false;
  renderLevelSelect();
  if (options.updateUrl !== false) {
    updateLevelUrl('');
  }
}

function handlePopState() {
  const requestedLevel = new URLSearchParams(window.location.search).get('level');
  if (requestedLevel && levelById(requestedLevel)) {
    loadLevel(requestedLevel, { updateUrl: false }).catch(showLoadError);
  } else {
    showLevelSelect({ updateUrl: false });
  }
}

function updateLevelUrl(levelId) {
  if (typeof window === 'undefined') {
    return;
  }
  const url = new URL(window.location.href);
  if (levelId) {
    url.searchParams.set('level', levelId);
  } else {
    url.searchParams.delete('level');
  }
  window.history.pushState({}, '', url);
}

function levelById(levelId) {
  return state.levels.find((level) => level.id === levelId);
}

function renderStory() {
  renderStoryView(state.puzzle);
}

function renderBoard() {
  renderBoardView({
    board: byId('board'),
    puzzle: state.puzzle,
    tileManifest: state.tileManifest,
    materialManifest: state.materialManifest,
    objectManifest: state.objectManifest,
    visualMode: state.visualMode || ART_MODE_DEFAULT,
    viewState: {
      assignments: state.assignments,
      candidatePositions: state.candidatePositions,
      blockedPositions: state.blockedPositions,
      manualMarks: state.manualMarks,
      selectedPerson: state.selectedPerson,
      selectedRegion: state.selectedRegion,
      previewRegion: state.focusedRegion || state.hoveredRegion,
      collectedInvestigationIds: state.collectedInvestigationIds,
      mode: state.mode,
    },
    callbacks: {
      onCellClick: handleCellClick,
      onCellKeyDown: boardInteractions.handleKeyboardFormalPlacement,
      onCellPointerDown: boardInteractions.handleCellPointerDown,
      onCellPointerEnter: boardInteractions.handleCellPointerEnter,
      onFocusRegion: setFocusedRegion,
      onHoverRegion: setHoveredRegion,
      onSelectRegion: setSelectedRegion,
    },
  });
}

function setHoveredRegion(region) {
  if (state.hoveredRegion === region) {
    return;
  }
  state.hoveredRegion = region;
  updateRegionHighlights();
}

function setFocusedRegion(region) {
  if (state.focusedRegion === region) {
    return;
  }
  state.focusedRegion = region;
  updateRegionHighlights();
}

function setSelectedRegion(region) {
  if (state.selectedRegion === region) {
    return;
  }
  state.selectedRegion = region;
  updateRegionHighlights();
}

function updateRegionHighlights() {
  updateRegionHighlightView(byId('board'), {
    selectedRegion: state.selectedRegion,
    previewRegion: state.focusedRegion || state.hoveredRegion,
  });
}

function renderGeneralClues() {
  renderGeneralCluesView(state.puzzle);
}

function renderInvestigationPanel() {
  renderInvestigationView({
    puzzle: state.puzzle,
    collectedIds: state.collectedInvestigationIds,
    onReset: resetInvestigation,
  });
}

function resetInvestigation() {
  state.collectedInvestigationIds = new Set();
  saveCollectedInvestigationIds(
    state.currentLevel?.id || '',
    state.collectedInvestigationIds,
  );
  renderBoard();
  renderInvestigationPanel();
  clearFeedback();
}

function renderPeople() {
  renderPeopleView({
    puzzle: state.puzzle,
    assignments: state.assignments,
    selectedPerson: state.selectedPerson,
    onSelectPerson: handlePersonSelection,
  });
}

function handlePersonSelection(personId) {
  applyPlayState(selectPerson(snapshotPlayState(), personId));
  clearFeedback();
}

function bindActions() {
  byId('submit-button').onclick = () => {
    const people = state.puzzle.people.map((person) => person.id);
    const result = evaluateSubmission(
      state.assignments,
      state.proof,
      people,
    );
    const feedback = byId('feedback');
    feedback.textContent = result.message;
    feedback.className = `feedback ${result.ok ? 'is-good' : 'is-bad'}`;
  };

  byId('tool-investigate').onclick = () => {
    applyPlayState(selectTool(snapshotPlayState(), 'investigate'));
    clearFeedback();
  };

  byId('tool-clear').onclick = () => {
    applyPlayState(selectTool(snapshotPlayState(), 'mark-x'));
    clearFeedback();
  };

  byId('tool-eraser').onclick = () => {
    applyPlayState(selectTool(snapshotPlayState(), 'erase'));
    clearFeedback();
  };

  byId('tool-undo').onclick = () => {
    applyPlayState(undoLast(snapshotPlayState(), state.puzzle));
    clearFeedback();
  };

  byId('help-button').onclick = () => {
    state.activeHint = Math.min(state.activeHint + 1, state.hints.hints.length - 1);
    const hint = state.hints.hints[state.activeHint] || state.hints.hints[0];
    const feedback = byId('feedback');
    feedback.textContent = hint ? `${hint.title}：${hint.text}` : '';
    feedback.className = 'feedback';
  };
  renderToolState();
}

function handleCellClick(row, col) {
  const key = positionKey(row, col);
  if (boardInteractions.consumeSuppressedCandidateClick(key)) {
    return;
  }
  if (state.mode === 'investigate') {
    investigateCell(row, col);
    return;
  }
  if (state.mode === 'mark-x') {
    applyPlayState(markPosition(snapshotPlayState(), key, state.puzzle));
    clearFeedback();
    return;
  }
  if (state.mode === 'erase') {
    applyPlayState(eraseCell(snapshotPlayState(), key, state.puzzle));
    clearFeedback();
    return;
  }
  if (!state.selectedPerson) {
    return;
  }
  applyPlayState(toggleCandidatePosition(
    snapshotPlayState(),
    state.selectedPerson,
    key,
    state.puzzle,
  ));
  clearFeedback();
}

function investigateCell(row, col) {
  const item = investigationItemAt(state.puzzle, row, col);
  const feedback = byId('feedback');
  if (!item) {
    feedback.textContent = '这里没有可记录的新发现。';
    feedback.className = 'feedback';
    return;
  }
  if (state.collectedInvestigationIds.has(item.id)) {
    feedback.textContent = `已记录：${item.title}`;
    feedback.className = 'feedback';
    return;
  }
  state.collectedInvestigationIds = collectInvestigationItem(
    state.collectedInvestigationIds,
    item.id,
  );
  saveCollectedInvestigationIds(
    state.currentLevel?.id || '',
    state.collectedInvestigationIds,
  );
  feedback.textContent = `发现追加线索：${item.clue_text}`;
  feedback.className = 'feedback is-good';
  renderBoard();
  renderInvestigationPanel();
  renderToolState();
}

function snapshotPlayState() {
  return {
    assignments: state.assignments,
    candidatePositions: state.candidatePositions,
    blockedPositions: state.blockedPositions,
    manualMarks: state.manualMarks,
    history: state.history,
    selectedPerson: state.selectedPerson,
    mode: state.mode,
  };
}

function applyPlayState(playState) {
  state.assignments = playState.assignments;
  state.candidatePositions = playState.candidatePositions || {};
  state.blockedPositions = playState.blockedPositions
    || computeBlockedPositions(playState.assignments, state.puzzle);
  state.manualMarks = playState.manualMarks || new Set();
  state.history = playState.history;
  state.selectedPerson = playState.selectedPerson;
  state.mode = playState.mode;
  renderBoard();
  renderPeople();
  renderSubmitState();
  renderToolState();
}

function renderSubmitState() {
  const submit = byId('submit-button');
  const caption = byId('submit-caption');
  const people = state.puzzle.people.map((person) => person.id);
  const missingCount = people.filter((personId) => !state.assignments[personId]).length;
  submit.disabled = missingCount > 0;
  caption.textContent = missingCount > 0 ? `还差 ${missingCount} 人` : '可以提交';
}

function renderToolState() {
  byId('tool-clear').setAttribute('aria-pressed', state.mode === 'mark-x' ? 'true' : 'false');
  byId('tool-eraser').setAttribute('aria-pressed', state.mode === 'erase' ? 'true' : 'false');
  byId('tool-investigate').setAttribute(
    'aria-pressed',
    state.mode === 'investigate' ? 'true' : 'false',
  );
  byId('tool-undo').disabled = state.history.length === 0;
}

function clearFeedback() {
  const feedback = byId('feedback');
  feedback.textContent = '';
  feedback.className = 'feedback';
}

function sceneBackgroundAsset() {
  return sceneBackgroundAssetFor(state.tileManifest, state.visualMode);
}

function applyVisualManifest() {
  const sceneBackground = sceneBackgroundAsset();
  if (!sceneBackground) {
    clearVisualManifest();
    return;
  }
  if (sceneBackground) {
    document.documentElement.style.setProperty(
      '--scene-background-image',
      `url("${publicAssetUrl(sceneBackground)}")`,
    );
  } else {
    document.documentElement.style.removeProperty('--scene-background-image');
  }
}

function clearVisualManifest() {
  document.documentElement.style.removeProperty('--scene-background-image');
}

function byId(id) {
  return document.getElementById(id);
}

function showLoadError(error) {
  const shell = document.querySelector('.app-shell') || document.body;
  shell.innerHTML = '';
  const panel = document.createElement('section');
  panel.className = 'board-panel';
  const title = document.createElement('h2');
  title.textContent = '题包读取失败';
  const message = document.createElement('p');
  message.textContent = error.message;
  panel.append(title, message);
  shell.appendChild(panel);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  init();
}
