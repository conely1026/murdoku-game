export const LEVEL_INDEX = './public/puzzles/index.json';
export const PACK_BASE = './public/puzzles/fog-town-books';
export const NO_DIRECT_CLUE_TEXT = '无直接线索，需通过其他线索推出。';
export const FORMAL_PLACEMENT_HOLD_MS = 1000;

const TILE_NAMES = {
  floor: '地板',
  grass: '草地',
  carpet: '地毯',
  chair: '椅子',
  shrub: '灌木',
  tree: '树',
  bookshelf: '书柜',
  fountain: '喷泉',
  table: '桌子',
  telescope: '望远镜',
  radio: '无线电台',
  cabinet: '档案柜',
  generator: '发电机',
  lifebuoy: '救生圈架',
  beacon: '信标灯',
};

const TILE_SYMBOLS = {
  floor: 'F',
  grass: 'G',
  carpet: 'K',
  chair: 'C',
  shrub: 'X',
  tree: 'X',
  bookshelf: 'X',
  fountain: 'X',
  table: 'X',
  telescope: 'X',
  radio: 'X',
  cabinet: 'X',
  generator: 'X',
  lifebuoy: 'X',
  beacon: 'X',
};

export const COMMON_OBJECT_ASSETS = Object.freeze({
  carpet: 'assets/common/tile-kit/v1/tiles/carpet.png',
  chair: 'assets/common/tile-kit/v1/tiles/chair.png',
  bookshelf: 'assets/common/tile-kit/v1/tiles/bookshelf.png',
  tree: 'assets/common/tile-kit/v1/tiles/tree.png',
  table: 'assets/common/tile-kit/v1/tiles/table.png',
  fountain: 'assets/common/tile-kit/v1/tiles/fountain.png',
  shrub: 'assets/common/tile-kit/v1/tiles/shrub.png',
  telescope: 'assets/common/object-kit/v4/objects/telescope.png',
  radio: 'assets/common/object-kit/v4/objects/radio.png',
  cabinet: 'assets/common/object-kit/v4/objects/cabinet.png',
  generator: 'assets/common/object-kit/v4/objects/generator.png',
  lifebuoy: 'assets/common/object-kit/v4/objects/lifebuoy.png',
  beacon: 'assets/common/object-kit/v4/objects/beacon.png',
});

export const ART_MODE_DEFAULT = 'matrix-skin';
const ART_MODES = new Set([
  ART_MODE_DEFAULT,
  'scene-slices',
  'region-grade',
  'background-objects',
]);

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const BOARD_COORD_WIDTH = 34;
const LARGE_GRID_MIN_CELL_SIZE = 40;
const EMPTY_UNDO_HISTORY = Object.freeze({
  board: null,
  previous: null,
  length: 0,
});
const REGION_FALLBACK_COLORS = Object.freeze({
  mossy_garden_grass: '#5f7d3c',
  light_honey_cafe_wood: '#b48647',
  dark_walnut_library_wood: '#56351f',
  cool_gray_courtyard_stone: '#6e7778',
  rough_taupe_workshop_stone: '#89775c',
  amber_inn_wood: '#a85d25',
  manor_walnut_study: '#594638',
  manor_sage_tile: '#8a8b75',
  manor_blue_rug: '#506467',
  manor_oak_parquet: '#977048',
  manor_terracotta: '#93644d',
  manor_moss_stone: '#68705b',
  manor_wet_slate: '#789198',
  manor_rain_terrace: '#849486',
  theatre_black_backstage: '#333231',
  theatre_red_stage: '#87443b',
  theatre_rose_lino: '#876e70',
  theatre_burgundy_carpet: '#674348',
  theatre_blue_aisle: '#3d5060',
  theatre_cream_terrazzo: '#a28e74',
});

export function largeGridMinWidth(cols) {
  return BOARD_COORD_WIDTH + (Math.max(0, Number(cols) || 0) * LARGE_GRID_MIN_CELL_SIZE);
}

export const PORTRAIT_ASSETS = Object.freeze({
  Aiden: 'assets/portraits/common/v1/aiden.png',
  Bella: 'assets/portraits/common/v1/bella.png',
  Colin: 'assets/portraits/common/v1/colin.png',
  Diana: 'assets/portraits/common/v1/diana.png',
  Ethan: 'assets/portraits/common/v1/ethan.png',
  Fiona: 'assets/portraits/common/v1/fiona.png',
});

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
  isPainting: false,
  lastPaintedPosition: '',
  collectedInvestigationIds: new Set(),
};

let placementHold = null;
let suppressedCandidateClick = null;
let paintHistoryTransaction = null;

export async function loadLevelIndex(fetcher = fetch) {
  return fetchJson(LEVEL_INDEX, fetcher);
}

export function packBaseForLevel(level) {
  return level?.pack || PACK_BASE;
}

export async function loadPublicPack(base = PACK_BASE, fetcher = fetch) {
  const [puzzle, proof, hints, tileManifest] = await Promise.all([
    fetchJson(`${base}/puzzle.public.json`, fetcher),
    fetchJson(`${base}/proof.public.json`, fetcher),
    fetchJson(`${base}/hint_pack.json`, fetcher),
    fetchOptionalJson(`${base}/tile_manifest.json`, fetcher, null),
  ]);
  const [materialManifest, objectManifest] = await loadMatrixSkinAssets(
    tileManifest,
    fetcher,
  );
  return { puzzle, proof, hints, tileManifest, materialManifest, objectManifest };
}

export async function loadMatrixSkinAssets(tileManifest, fetcher = fetch) {
  const skin = tileManifest?.matrix_skin;
  if (!skin || skin.mode === 'none') {
    return [null, null];
  }
  const materialRequest = skin.material_manifest
    ? fetchOptionalJson(publicAssetUrl(skin.material_manifest), fetcher, null)
    : Promise.resolve(null);
  const objectRequest = skin.object_manifest
    ? fetchOptionalJson(publicAssetUrl(skin.object_manifest), fetcher, null)
    : Promise.resolve(null);
  return Promise.all([materialRequest, objectRequest]);
}

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
  const previous = playState.history.board;
  return {
    ...playState,
    ...previous,
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

export function activeCluesByPerson(puzzle) {
  const byPerson = Object.fromEntries(puzzle.people.map((person) => [person.id, []]));
  for (const clue of puzzle.clues) {
    const personId = clueCardOwnerId(clue);
    if (byPerson[personId] && !byPerson[personId].includes(clue.text)) {
      byPerson[personId].push(clue.text);
    }
  }
  return byPerson;
}

export function personClueText(cluesByPerson, personId) {
  const clues = cluesByPerson[personId] || [];
  return clues.length ? clues.join(' ') : NO_DIRECT_CLUE_TEXT;
}

export function clueCardOwnerId(clue) {
  return clue.card_owner || clue.victim || clue.person || clue.other || '';
}

export function generalClues(puzzle) {
  return puzzle.clues.filter((clue) => !clueCardOwnerId(clue));
}

export function evaluateSubmission(assignments, proof, people) {
  const missing = people.filter((personId) => !assignments[personId]);
  if (missing.length) {
    return {
      ok: false,
      status: 'incomplete',
      missing,
      message: `还缺少：${missing.join('、')}`,
    };
  }

  const expected = proof.solution.placements;
  const incorrect = people.filter((personId) => {
    const position = expected[personId];
    return assignments[personId] !== positionKey(position.row, position.col);
  });
  if (incorrect.length) {
    return {
      ok: false,
      status: 'wrong_placement',
      incorrect,
      message: `位置不对：${incorrect.join('、')}`,
    };
  }

  return {
    ok: true,
    status: 'solved',
    murderer: proof.solution.murderer,
    message: `验证通过。凶手是 ${proof.solution.murderer}。`,
  };
}

export function positionKey(row, col) {
  return `${row},${col}`;
}

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

function boundaryCellRef(row, col) {
  return `R${row}C${col}`;
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
      boundaryCellRef(cell.row, cell.col),
      boundaryCellRef(cell.row - 1, cell.col),
    );
    if (!isOpen) {
      classes.push('region-border-top');
    }
    classes.push('region-outline-top');
  }
  if (cell.col === 1 || !sameRegion(cell.row, cell.col - 1)) {
    const isOpen = cell.col > 1 && isOpenPresentationBoundary(
      boundaryStyle,
      boundaryCellRef(cell.row, cell.col),
      boundaryCellRef(cell.row, cell.col - 1),
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

export function boundaryToneFor(tileManifest = null) {
  const tone = tileManifest?.matrix_skin?.boundary_style?.line_tone;
  return tone === 'light' ? 'light' : 'dark';
}

function fetchJson(url, fetcher) {
  return fetcher(url).then((response) => {
    if (!response.ok) {
      const error = new Error(`无法读取 ${url}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  });
}

function fetchOptionalJson(url, fetcher, fallback) {
  return fetchJson(url, fetcher).catch((error) => {
    if (error.status === 404) {
      return fallback;
    }
    throw error;
  });
}

async function init() {
  try {
    const levelIndex = await loadLevelIndex();
    state.levels = levelIndex.levels || [];
    window.addEventListener('pointerup', handleGlobalPointerEnd);
    window.addEventListener('pointercancel', handleGlobalPointerEnd);
    window.addEventListener('pointermove', handleGlobalPointerMove);
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
  stopPointerInteractions();
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
  stopPointerInteractions();
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
  const storyCard = byId('story-card');
  const storyText = byId('story-text');
  const story = state.puzzle.story || '';
  storyCard.hidden = !story;
  storyText.textContent = story;
}

function renderBoard() {
  const board = byId('board');
  const visualMode = state.visualMode || ART_MODE_DEFAULT;
  const boardBackground = boardBackgroundAssetFor(state.tileManifest, visualMode);
  const hasMatrixSkin = visualMode === 'matrix-skin'
    && state.materialManifest
    && state.objectManifest;
  board.className = [
    'board',
    `is-art-${visualMode}`,
    hasMatrixSkin ? 'has-matrix-skin' : '',
    hasMatrixSkin ? `is-boundary-${boundaryToneFor(state.tileManifest)}` : '',
    boardBackground ? 'has-board-background' : '',
    state.mode === 'mark-x' ? 'is-tool-mark-x' : '',
    state.mode === 'erase' ? 'is-tool-erase' : '',
    state.mode === 'investigate' ? 'is-tool-investigate' : '',
    state.puzzle.rows > 9 || state.puzzle.cols > 9 ? 'is-large-grid' : '',
  ].filter(Boolean).join(' ');
  board.style.setProperty('--cols', String(state.puzzle.cols));
  board.style.setProperty('--rows', String(state.puzzle.rows));
  board.style.setProperty('--large-grid-min-width', `${largeGridMinWidth(state.puzzle.cols)}px`);
  board.style.setProperty(
    '--object-overlay-opacity',
    String(objectOverlayOpacityFor(state.tileManifest, visualMode)),
  );
  if (boardBackground) {
    board.style.setProperty('--board-background-image', `url("${publicAssetUrl(boardBackground)}")`);
  } else {
    board.style.removeProperty('--board-background-image');
  }
  board.onpointerleave = () => setHoveredRegion('');
  board.onfocusout = (event) => {
    if (!board.contains(event.relatedTarget)) {
      setFocusedRegion('');
    }
  };
  board.replaceChildren();
  if (hasMatrixSkin) {
    board.append(
      renderRegionSurfaceLayer(state.puzzle, state.tileManifest, state.materialManifest),
      renderObjectLayer(state.puzzle, state.objectManifest),
      renderRegionLabelLayer(state.puzzle),
    );
  }
  board.appendChild(coordCell(''));
  for (let col = 1; col <= state.puzzle.cols; col += 1) {
    board.appendChild(coordCell(`C${col}`));
  }
  for (let row = 1; row <= state.puzzle.rows; row += 1) {
    board.appendChild(coordCell(`R${row}`));
    for (let col = 1; col <= state.puzzle.cols; col += 1) {
      board.appendChild(renderCell(row, col));
    }
  }
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

export function objectPlacementStyle(placement, objectManifest, puzzle) {
  const grid = objectManifest?.grid || {};
  const cellSize = Number(grid.cell_size) || 1;
  const boardWidth = (Number(grid.cols) || puzzle?.cols || 1) * cellSize;
  const boardHeight = (Number(grid.rows) || puzzle?.rows || 1) * cellSize;
  const box = placement?.render_box;
  if (box) {
    return {
      left: `${(Number(box.x) / boardWidth) * 100}%`,
      top: `${(Number(box.y) / boardHeight) * 100}%`,
      width: `${(Number(box.width) / boardWidth) * 100}%`,
      height: `${(Number(box.height) / boardHeight) * 100}%`,
    };
  }
  const footprint = placement?.footprint || {};
  const cols = puzzle?.cols || Number(grid.cols) || 1;
  const rows = puzzle?.rows || Number(grid.rows) || 1;
  return {
    left: `${((Number(footprint.col) - 1) / cols) * 100}%`,
    top: `${((Number(footprint.row) - 1) / rows) * 100}%`,
    width: `${((Number(footprint.cols) || 1) / cols) * 100}%`,
    height: `${((Number(footprint.rows) || 1) / rows) * 100}%`,
  };
}

function renderRegionSurfaceLayer(puzzle, tileManifest, materialManifest) {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  const width = puzzle.cols * 100;
  const height = puzzle.rows * 100;
  svg.classList.add('region-surface-layer');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');

  const defs = document.createElementNS(SVG_NAMESPACE, 'defs');
  svg.appendChild(defs);
  const materialByRegion = tileManifest?.matrix_skin?.region_materials || {};
  const materialByCell = tileManifest?.matrix_skin?.cell_material_overrides || {};
  const surfaceZones = tileManifest?.matrix_skin?.surface_zones || {};
  const zoneByCell = {};
  Object.entries(surfaceZones).forEach(([zoneId, zone]) => {
    for (const cellRef of zone?.cells || []) {
      zoneByCell[cellRef] = zoneId;
    }
  });
  const surfaceGroups = new Map();
  for (const cell of puzzle.cells || []) {
    const cellRef = `R${cell.row}C${cell.col}`;
    const materialName = materialByCell[cellRef] || materialByRegion[cell.region];
    const zoneId = zoneByCell[cellRef] || '';
    const key = `${cell.region}\u0000${materialName}\u0000${zoneId}`;
    if (!surfaceGroups.has(key)) {
      surfaceGroups.set(key, {
        regionName: cell.region,
        materialName,
        zoneId,
        cells: [],
      });
    }
    surfaceGroups.get(key).cells.push(cell);
  }

  [...surfaceGroups.values()].forEach((group, index) => {
    const { regionName, materialName, zoneId, cells } = group;
    const material = materialManifest?.materials?.[materialName];
    const clipId = `region-clip-${index}`;
    const clip = document.createElementNS(SVG_NAMESPACE, 'clipPath');
    clip.id = clipId;
    clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
    for (const cell of cells) {
      const rect = document.createElementNS(SVG_NAMESPACE, 'rect');
      rect.setAttribute('x', String((cell.col - 1) * 100));
      rect.setAttribute('y', String((cell.row - 1) * 100));
      rect.setAttribute('width', '100');
      rect.setAttribute('height', '100');
      clip.appendChild(rect);
    }
    defs.appendChild(clip);

    const rows = cells.map((cell) => cell.row);
    const cols = cells.map((cell) => cell.col);
    const left = (Math.min(...cols) - 1) * 100;
    const top = (Math.min(...rows) - 1) * 100;
    const regionWidth = (Math.max(...cols) - Math.min(...cols) + 1) * 100;
    const regionHeight = (Math.max(...rows) - Math.min(...rows) + 1) * 100;

    const fallback = document.createElementNS(SVG_NAMESPACE, 'rect');
    fallback.classList.add('region-surface', 'region-surface-fallback');
    fallback.dataset.region = regionName;
    fallback.dataset.material = materialName || '';
    if (zoneId) fallback.dataset.surfaceZone = zoneId;
    fallback.setAttribute('x', String(left));
    fallback.setAttribute('y', String(top));
    fallback.setAttribute('width', String(regionWidth));
    fallback.setAttribute('height', String(regionHeight));
    fallback.setAttribute('fill', REGION_FALLBACK_COLORS[materialName] || '#70675a');
    fallback.setAttribute('clip-path', `url(#${clipId})`);
    svg.appendChild(fallback);

    if (material?.asset) {
      const image = document.createElementNS(SVG_NAMESPACE, 'image');
      image.classList.add('region-surface', 'region-surface-image');
      image.dataset.region = regionName;
      image.dataset.material = materialName || '';
      if (zoneId) image.dataset.surfaceZone = zoneId;
      image.setAttribute('href', publicAssetUrl(material.asset));
      image.setAttribute('x', String(left));
      image.setAttribute('y', String(top));
      image.setAttribute('width', String(regionWidth));
      image.setAttribute('height', String(regionHeight));
      image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      const pixelSize = material.pixel_size || {};
      image.dataset.sourceWidth = String(Number(pixelSize.width) || 0);
      image.dataset.sourceHeight = String(Number(pixelSize.height) || 0);
      image.setAttribute('clip-path', `url(#${clipId})`);
      svg.appendChild(image);
    }
  });

  Object.entries(surfaceZones).forEach(([zoneId, zone]) => {
    for (const edge of zone?.threshold_edges || []) {
      const a = parseCellReference(edge.a);
      const b = parseCellReference(edge.b);
      if (!a || !b) continue;
      const line = document.createElementNS(SVG_NAMESPACE, 'line');
      line.classList.add('surface-zone-threshold');
      line.dataset.surfaceZone = zoneId;
      line.dataset.kind = edge.kind || '';
      if (a.row === b.row) {
        const x = Math.max(a.col, b.col) * 100 - 100;
        line.setAttribute('x1', String(x));
        line.setAttribute('x2', String(x));
        line.setAttribute('y1', String((a.row - 1) * 100));
        line.setAttribute('y2', String(a.row * 100));
      } else {
        const y = Math.max(a.row, b.row) * 100 - 100;
        line.setAttribute('x1', String((a.col - 1) * 100));
        line.setAttribute('x2', String(a.col * 100));
        line.setAttribute('y1', String(y));
        line.setAttribute('y2', String(y));
      }
      svg.appendChild(line);
    }
  });
  return svg;
}

function parseCellReference(value) {
  const match = /^R(\d+)C(\d+)$/.exec(value || '');
  return match ? { row: Number(match[1]), col: Number(match[2]) } : null;
}

function renderObjectLayer(puzzle, objectManifest) {
  const layer = document.createElement('div');
  layer.className = 'board-object-layer';
  layer.setAttribute('aria-hidden', 'true');
  for (const placement of objectManifest?.object_placements || []) {
    const image = document.createElement('img');
    image.className = `board-object board-object-${placement.tile}`;
    image.src = publicAssetUrl(placement.asset);
    image.alt = '';
    image.loading = 'eager';
    image.decoding = 'async';
    image.dataset.objectId = placement.id;
    image.dataset.align = placement.footprint?.align || '';
    image.dataset.asset = placement.asset || '';
    if ((placement.asset || '').includes('/rain-manor-v4/')) {
      image.classList.add('board-object-generated-v4');
    }
    Object.assign(image.style, objectPlacementStyle(placement, objectManifest, puzzle));
    layer.appendChild(image);
  }
  return layer;
}

function renderRegionLabelLayer(puzzle) {
  const layer = document.createElement('div');
  layer.className = 'board-region-label-layer';
  layer.setAttribute('aria-hidden', 'true');
  for (const [regionName, cells] of Object.entries(regionCellsByName(puzzle))) {
    const anchor = cells[0];
    const label = document.createElement('span');
    label.className = 'board-region-label';
    label.dataset.region = regionName;
    label.textContent = regionName;
    label.style.left = `${((anchor.col - 1) / puzzle.cols) * 100}%`;
    label.style.top = `${((anchor.row - 1) / puzzle.rows) * 100}%`;
    layer.appendChild(label);
  }
  return layer;
}

function renderCell(row, col) {
  const cell = state.puzzle.cells.find((item) => item.row === row && item.col === col);
  const key = positionKey(row, col);
  const candidatePersonIds = candidatePeopleAtPosition(state.candidatePositions, key);
  const candidateNames = candidatePersonIds.map((personId) => personName(personId));
  const occupant = occupantAt(row, col);
  const isSelectedPersonPosition = Boolean(
    state.selectedPerson && occupant === state.selectedPerson,
  );
  const hasSelectedCandidate = Boolean(
    state.selectedPerson && candidatePersonIds.includes(state.selectedPerson),
  );
  const isSelectedRegion = cell.region === state.selectedRegion;
  const isPreviewRegion = cell.region === (state.focusedRegion || state.hoveredRegion);
  const isManualMark = state.manualMarks.has(key);
  const isXHint = state.blockedPositions.has(key) || isManualMark;
  const investigationItem = investigationItemAt(state.puzzle, row, col);
  const isInvestigated = investigationItem
    ? state.collectedInvestigationIds.has(investigationItem.id)
    : false;
  const sceneAsset = cellSceneAssetFor(cell, state.tileManifest, state.visualMode);
  const objectAsset = cellObjectAssetFor(cell, state.tileManifest, state.visualMode);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = [
    'cell',
    ...tileClasses(cell),
    ...regionBoundaryClasses(
      state.puzzle,
      cell,
      state.tileManifest?.matrix_skin?.boundary_style,
    ),
    sceneAsset ? 'has-scene-asset' : '',
    objectAsset ? 'has-object-asset' : '',
    isSelectedRegion ? 'is-region-selected' : '',
    isPreviewRegion ? 'is-region-preview' : '',
    isSelectedPersonPosition ? 'is-selected-person-position' : '',
    hasSelectedCandidate ? 'has-selected-candidate' : '',
    isXHint ? 'is-x-hint' : '',
    isManualMark ? 'is-manual-x' : '',
    investigationItem ? 'is-investigable' : '',
    isInvestigated ? 'is-investigated' : '',
  ].filter(Boolean).join(' ');
  button.dataset.position = key;
  button.dataset.row = String(row);
  button.dataset.col = String(col);
  button.dataset.region = cell.region;
  button.dataset.walkable = cell.walkable ? 'true' : 'false';
  if (investigationItem) {
    button.dataset.investigationId = investigationItem.id;
  }
  if (sceneAsset) {
    button.dataset.sceneAsset = sceneAsset;
    button.style.setProperty('--cell-scene-image', `url("${publicAssetUrl(sceneAsset)}")`);
  }
  if (objectAsset) {
    button.dataset.objectAsset = objectAsset;
    button.style.setProperty('--cell-object-image', `url("${publicAssetUrl(objectAsset)}")`);
  }
  const element = cell.element || tileName(cell.tile);
  button.title = `${key} · ${element} · ${cell.region}`;
  button.setAttribute('aria-pressed', isSelectedRegion ? 'true' : 'false');
  if (isSelectedPersonPosition) {
    button.setAttribute('aria-current', 'location');
  }
  button.setAttribute(
    'aria-label',
    [
      `${row} 行 ${col} 列，${cell.region}，${element}`,
      cell.walkable ? '单击添加候选虚影，长按一秒正式放置' : '不可放置，可查看区域',
      occupant ? `正式放置：${personName(occupant)}` : '',
      candidateNames.length ? `候选：${candidateNames.join('、')}` : '',
      isSelectedPersonPosition ? '当前选中人物的位置' : '',
      hasSelectedCandidate ? '包含当前选中人物的候选标记' : '',
    ].filter(Boolean).join('，'),
  );

  if (sceneAsset) {
    const scene = document.createElement('span');
    scene.className = 'cell-scene';
    scene.setAttribute('aria-hidden', 'true');
    button.appendChild(scene);
  }

  if (objectAsset) {
    const object = document.createElement('span');
    object.className = `cell-object cell-object-${cell.tile}`;
    object.setAttribute('aria-hidden', 'true');
    button.appendChild(object);
  }

  const symbol = document.createElement('span');
  symbol.className = 'tile-symbol';
  symbol.textContent = TILE_SYMBOLS[cell.tile] || (cell.walkable ? cell.tile : 'X');
  button.appendChild(symbol);

  if (occupant) {
    button.appendChild(renderOccupant(occupant, isSelectedPersonPosition));
  } else if (candidatePersonIds.length) {
    button.appendChild(renderCandidateMarkers(candidatePersonIds, state.selectedPerson));
  } else if (isXHint) {
    const x = document.createElement('span');
    x.className = 'map-x';
    x.textContent = 'X';
    button.appendChild(x);
  }

  const region = document.createElement('span');
  region.className = 'cell-region';
  region.textContent = isFirstRegionCell(state.puzzle, cell) ? cell.region : '';
  button.appendChild(region);

  const elementLabel = document.createElement('span');
  elementLabel.className = 'cell-element';
  elementLabel.textContent = element;
  button.appendChild(elementLabel);

  button.addEventListener('click', () => {
    setSelectedRegion(cell.region);
    handleCellClick(row, col);
  });
  button.addEventListener(
    'pointerdown',
    (event) => handleCellPointerDown(event, row, col, button),
  );
  button.addEventListener('keydown', (event) => {
    if (event.shiftKey && event.key === 'Enter') {
      handleKeyboardFormalPlacement(event, row, col);
    }
  });
  button.addEventListener('pointerenter', () => {
    setHoveredRegion(cell.region);
    handleCellPointerEnter(row, col);
  });
  button.addEventListener('focus', () => setFocusedRegion(cell.region));
  button.addEventListener('blur', () => setFocusedRegion(''));
  return button;
}

function renderCandidateMarkers(personIds, selectedPersonId = '') {
  const stack = document.createElement('span');
  stack.className = [
    'candidate-stack',
    personIds.includes(selectedPersonId) ? 'has-selected-person' : '',
  ].filter(Boolean).join(' ');
  stack.setAttribute('aria-hidden', 'true');
  for (const personId of personIds) {
    const marker = document.createElement('span');
    const label = candidateLabelForPerson(state.puzzle.people, personId);
    marker.className = `candidate-letter${personId === selectedPersonId ? ' is-selected' : ''}`;
    marker.dataset.personId = personId;
    marker.title = `${label} · ${personName(personId)}`;
    marker.textContent = label;
    stack.appendChild(marker);
  }
  return stack;
}

function renderOccupant(personId, isSelected = false) {
  const marker = document.createElement('span');
  marker.className = `occupant${isSelected ? ' is-selected' : ''}`;
  marker.title = personName(personId);
  marker.setAttribute('aria-hidden', 'true');

  const portrait = document.createElement('span');
  portrait.className = 'occupant-portrait';
  const asset = portraitAssetFor(personId);
  if (asset) {
    const image = document.createElement('img');
    image.className = 'occupant-portrait-image';
    image.src = publicAssetUrl(asset);
    image.alt = '';
    image.loading = 'eager';
    image.decoding = 'async';
    portrait.appendChild(image);
  } else {
    portrait.classList.add('is-placeholder');
  }

  const name = document.createElement('span');
  name.className = 'occupant-name';
  name.textContent = personName(personId).trim().split(/\s+/)[0] || personId;
  marker.append(portrait, name);
  return marker;
}

function isFirstRegionCell(puzzle, cell) {
  return (puzzle?.cells || []).find((item) => item.region === cell.region) === cell;
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
  const board = byId('board');
  if (!board) {
    return;
  }
  const previewRegion = state.focusedRegion || state.hoveredRegion;
  for (const cell of board.querySelectorAll('.cell')) {
    const isSelected = cell.dataset.region === state.selectedRegion;
    const isPreview = cell.dataset.region === previewRegion;
    cell.classList.toggle('is-region-selected', isSelected);
    cell.classList.toggle('is-region-preview', isPreview);
    cell.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  }
}

function renderGeneralClues() {
  const card = byId('general-clue-card');
  const clues = generalClues(state.puzzle);
  card.replaceChildren();
  if (!clues.length) {
    card.textContent = '没有通用线索。';
    return;
  }
  for (const clue of clues) {
    const text = document.createElement('p');
    text.textContent = clue.text;
    card.appendChild(text);
  }
}

function renderInvestigationPanel() {
  const panel = byId('investigation-panel');
  const tool = byId('tool-investigate');
  const investigation = state.puzzle?.investigation;
  const items = investigation?.items || [];
  const hasInvestigation = items.length > 0;
  panel.hidden = !hasInvestigation;
  tool.hidden = !hasInvestigation;
  if (!hasInvestigation) {
    return;
  }

  byId('investigation-intro').textContent = investigation.intro
    || '调查棋盘上的特殊物件，可获得不影响唯一解的追加线索。';
  const collectedCount = items.filter(
    (item) => state.collectedInvestigationIds.has(item.id),
  ).length;
  byId('investigation-progress').textContent = `${collectedCount} / ${items.length}`;

  const list = byId('investigation-list');
  list.replaceChildren();
  for (const item of items) {
    const collected = state.collectedInvestigationIds.has(item.id);
    const card = document.createElement('article');
    card.className = `investigation-entry${collected ? ' is-collected' : ''}`;
    card.dataset.investigationId = item.id;

    const object = document.createElement('span');
    object.className = 'investigation-object';
    object.textContent = collected ? item.object_label : '未调查物件';
    const title = document.createElement('strong');
    title.textContent = collected ? item.title : '线索尚未解锁';
    const summary = document.createElement('span');
    summary.className = 'investigation-summary';
    summary.textContent = collected
      ? item.summary
      : '切换到“调查物件”，在场景中寻找金色标记。';
    const clue = document.createElement('p');
    clue.textContent = collected ? item.clue_text : '？？？';
    card.append(object, title, summary, clue);
    list.appendChild(card);
  }

  const completion = byId('investigation-complete');
  const isComplete = collectedCount === items.length;
  completion.hidden = !isComplete;
  completion.replaceChildren();
  if (isComplete) {
    const title = document.createElement('strong');
    title.textContent = investigation.completion_title || '调查完成';
    const text = document.createElement('span');
    text.textContent = investigation.completion_text || '全部追加线索已经收录。';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'investigation-reset';
    reset.textContent = '重置调查记录';
    reset.addEventListener('click', () => {
      state.collectedInvestigationIds = new Set();
      saveCollectedInvestigationIds(state.currentLevel?.id || '', state.collectedInvestigationIds);
      renderBoard();
      renderInvestigationPanel();
      clearFeedback();
    });
    completion.append(title, text, reset);
  }
}

function renderPeople() {
  const list = byId('person-list');
  const cluesByPerson = activeCluesByPerson(state.puzzle);
  list.closest('.people-panel')?.classList.toggle(
    'is-large-roster',
    state.puzzle.people.length > 9,
  );
  list.replaceChildren();
  for (const person of state.puzzle.people) {
    const isSelected = person.id === state.selectedPerson;
    const assignedPosition = state.assignments[person.id];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = [
      'person-card',
      assignedPosition ? 'is-placed' : '',
      isSelected ? 'is-selected' : '',
    ].filter(Boolean).join(' ');
    button.dataset.personId = person.id;
    if (assignedPosition) {
      button.dataset.assignment = assignedPosition;
    }
    button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    button.addEventListener('click', () => {
      applyPlayState(selectPerson(snapshotPlayState(), person.id));
      clearFeedback();
    });

    const portraitAsset = portraitAssetFor(person.id);
    const portrait = document.createElement('span');
    portrait.className = [
      'portrait',
      `portrait-${person.id.toLowerCase()}`,
      portraitAsset ? 'has-portrait-asset' : '',
    ].filter(Boolean).join(' ');
    if (portraitAsset) {
      portrait.dataset.portraitAsset = portraitAsset;
      const portraitImage = document.createElement('img');
      portraitImage.className = 'portrait-image';
      portraitImage.src = publicAssetUrl(portraitAsset);
      portraitImage.alt = '';
      portraitImage.loading = 'eager';
      portraitImage.decoding = 'async';
      portrait.appendChild(portraitImage);
    } else {
      portrait.textContent = person.id.slice(0, 1);
    }
    const candidateKey = document.createElement('span');
    candidateKey.className = 'person-candidate-key';
    candidateKey.textContent = candidateLabelForPerson(state.puzzle.people, person.id);
    candidateKey.setAttribute('aria-hidden', 'true');
    portrait.appendChild(candidateKey);

    const name = document.createElement('span');
    name.className = 'person-name';
    name.textContent = person.name;
    if (person.victim) {
      const victim = document.createElement('span');
      victim.className = 'victim-tag';
      victim.textContent = '受害者';
      name.append(' ', victim);
    }

    const meta = document.createElement('span');
    meta.className = 'person-meta';
    meta.append(name);
    if (person.role) {
      const role = document.createElement('span');
      role.className = 'person-role';
      role.textContent = person.role;
      meta.appendChild(role);
    }
    if (assignedPosition) {
      const placement = document.createElement('span');
      placement.className = 'person-placement';
      const placementStatus = document.createElement('span');
      placementStatus.className = 'person-placement-status';
      placementStatus.textContent = '已放置';
      const position = document.createElement('span');
      position.className = 'person-position';
      position.textContent = assignmentLabel(assignedPosition);
      placement.append(placementStatus, position);
      meta.appendChild(placement);
    }

    const clue = document.createElement('span');
    clue.className = 'person-clue';
    const clueParts = cluesByPerson[person.id] || [];
    const clueText = personClueText(cluesByPerson, person.id);
    if (clueParts.length > 1) {
      clue.classList.add('is-list');
      for (const text of clueParts) {
        const item = document.createElement('span');
        item.className = 'person-clue-item';
        item.textContent = text;
        clue.appendChild(item);
      }
    } else {
      clue.textContent = clueText;
    }
    clue.title = clueText;

    button.append(portrait, meta, clue);
    list.appendChild(button);
  }
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
  if (consumeSuppressedCandidateClick(key)) {
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

function handleCellPointerDown(event, row, col, cellElement) {
  if (isPaintToolActive()) {
    startPainting();
    applyToolToCell(row, col);
    event.preventDefault();
    return;
  }
  beginPlacementHold(event, row, col, cellElement);
}

function handleCellPointerEnter(row, col) {
  if (!state.isPainting || !isPaintToolActive()) {
    return;
  }
  applyToolToCell(row, col);
}

function handlePaintPointerMove(event) {
  if (!state.isPainting || !isPaintToolActive()) {
    return;
  }
  const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest('.cell');
  const position = cell?.dataset.position;
  if (position) {
    applyToolToPosition(position);
  }
}

function applyToolToCell(row, col) {
  applyToolToPosition(positionKey(row, col));
}

function applyToolToPosition(position) {
  if (state.lastPaintedPosition === position) {
    return;
  }
  state.lastPaintedPosition = position;
  const playState = snapshotPlayState();
  let nextPlayState = playState;
  if (state.mode === 'mark-x') {
    nextPlayState = markPosition(playState, position, state.puzzle);
  } else if (state.mode === 'erase') {
    nextPlayState = eraseCell(playState, position, state.puzzle);
  }
  applyPlayState(coalesceBoardHistoryChange(
    playState,
    nextPlayState,
    paintHistoryTransaction,
  ));
  clearFeedback();
}

function isPaintToolActive() {
  return state.mode === 'mark-x' || state.mode === 'erase';
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

function handleGlobalPointerMove(event) {
  handlePaintPointerMove(event);
  if (!placementHold || placementHold.pointerId !== event.pointerId) {
    return;
  }
  const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest('.cell');
  if (cell !== placementHold.cellElement) {
    cancelPlacementHold(event.pointerId);
  }
}

function handleGlobalPointerEnd(event) {
  stopPainting();
  cancelPlacementHold(event.pointerId);
}

function stopPointerInteractions() {
  stopPainting();
  cancelPlacementHold();
}

function beginPlacementHold(event, row, col, cellElement) {
  if (
    state.mode !== 'place'
    || !state.selectedPerson
    || !event.isPrimary
    || event.button !== 0
  ) {
    return;
  }
  const position = positionKey(row, col);
  const playState = snapshotPlayState();
  if (!canConfirmPersonPlacement(playState, state.selectedPerson, position, state.puzzle)) {
    return;
  }
  cancelPlacementHold();
  const progress = document.createElement('span');
  progress.className = 'placement-hold-progress';
  progress.setAttribute('aria-hidden', 'true');
  cellElement.classList.add('is-placement-holding');
  cellElement.appendChild(progress);
  const hold = {
    cellElement,
    personId: state.selectedPerson,
    pointerId: event.pointerId,
    position,
    progress,
    timerId: 0,
  };
  placementHold = hold;
  hold.timerId = window.setTimeout(
    () => completePlacementHold(hold),
    FORMAL_PLACEMENT_HOLD_MS,
  );
}

function completePlacementHold(hold) {
  if (
    placementHold !== hold
    || state.mode !== 'place'
    || state.selectedPerson !== hold.personId
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
    snapshotPlayState(),
    hold.personId,
    hold.position,
    state.puzzle,
  ));
  clearFeedback();
}

function cancelPlacementHold(pointerId = null) {
  if (!placementHold || (pointerId !== null && placementHold.pointerId !== pointerId)) {
    return;
  }
  window.clearTimeout(placementHold.timerId);
  placementHold.cellElement.classList.remove('is-placement-holding');
  placementHold.progress.remove();
  placementHold = null;
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

function handleKeyboardFormalPlacement(event, row, col) {
  if (state.mode !== 'place' || !state.selectedPerson) {
    return;
  }
  event.preventDefault();
  const position = positionKey(row, col);
  const playState = snapshotPlayState();
  if (!canConfirmPersonPlacement(playState, state.selectedPerson, position, state.puzzle)) {
    return;
  }
  applyPlayState(confirmPersonPlacement(
    playState,
    state.selectedPerson,
    position,
    state.puzzle,
  ));
  clearFeedback();
}

function investigationStorageKey(levelId) {
  return `murdoku:investigation:${levelId}`;
}

function loadCollectedInvestigationIds(levelId) {
  if (!levelId || typeof window === 'undefined' || !window.localStorage) {
    return new Set();
  }
  try {
    const value = JSON.parse(
      window.localStorage.getItem(investigationStorageKey(levelId)) || '[]',
    );
    return new Set(
      Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [],
    );
  } catch {
    return new Set();
  }
}

function saveCollectedInvestigationIds(levelId, collectedIds) {
  if (!levelId || typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  window.localStorage.setItem(
    investigationStorageKey(levelId),
    JSON.stringify([...collectedIds]),
  );
}

function startPainting() {
  state.isPainting = true;
  state.lastPaintedPosition = '';
  paintHistoryTransaction = createBoardHistoryTransaction(snapshotPlayState());
}

function stopPainting() {
  state.isPainting = false;
  state.lastPaintedPosition = '';
  paintHistoryTransaction = null;
}

function clearFeedback() {
  const feedback = byId('feedback');
  feedback.textContent = '';
  feedback.className = 'feedback';
}

function occupantAt(row, col) {
  const key = positionKey(row, col);
  return Object.keys(state.assignments).find((personId) => state.assignments[personId] === key);
}

function personName(personId) {
  return state.puzzle?.people?.find((person) => person.id === personId)?.name || personId;
}

function assignmentLabel(key) {
  if (!key) return '';
  const [row, col] = key.split(',');
  return `R${row}C${col}`;
}

function coordCell(text) {
  const cell = document.createElement('div');
  cell.className = 'coord';
  cell.textContent = text;
  return cell;
}

export function tileClasses(cell) {
  const tileClassName = `tile-${cell.tile}`;
  if (!cell.walkable) {
    return ['tile-blocker', tileClassName];
  }
  return [tileClassName];
}

export function commonObjectAssetFor(tile) {
  return COMMON_OBJECT_ASSETS[tile] || '';
}

export function portraitAssetFor(personId) {
  return PORTRAIT_ASSETS[personId] || '';
}

export function visualModeFromSearch(search = '') {
  const params = new URLSearchParams(search);
  const value = params.get('art') || ART_MODE_DEFAULT;
  return ART_MODES.has(value) ? value : ART_MODE_DEFAULT;
}

function tileName(tile) {
  return TILE_NAMES[tile] || tile;
}

function manifestCellFor(cell, tileManifest = null) {
  if (!cell) {
    return null;
  }
  const manifest = tileManifest || state.tileManifest;
  const key = `R${cell.row}C${cell.col}`;
  return manifest?.cells?.find((item) => item.key === key) || null;
}

export function cellSceneAssetFor(cell, tileManifest = null, visualMode = ART_MODE_DEFAULT) {
  if (!cell || ['background-objects', 'matrix-skin'].includes(visualMode)) {
    return '';
  }
  const manifest = tileManifest || state.tileManifest;
  const cellEntry = manifestCellFor(cell, manifest);
  const trialCellRoot = manifest?.art_trials?.[visualMode]?.cell_asset_root || '';
  if (trialCellRoot) {
    return `${trialCellRoot}/r${cell.row}c${cell.col}.png`;
  }
  return cellEntry?.scene_asset || '';
}

export function cellObjectAssetFor(cell, tileManifest = null, visualMode = ART_MODE_DEFAULT) {
  if (!cell || visualMode === 'matrix-skin') {
    return '';
  }
  const manifest = tileManifest || state.tileManifest;
  const cellEntry = manifestCellFor(cell, manifest);
  if (visualMode === 'background-objects') {
    return (
      cellEntry?.object_asset
      || manifest?.tiles?.[cell.tile]?.object_asset
      || commonObjectAssetFor(cell.tile)
    );
  }
  if (cellSceneAssetFor(cell, manifest, visualMode)) {
    return cellEntry.object_asset || '';
  }
  return (
    cellEntry?.object_asset
    || manifest?.tiles?.[cell.tile]?.object_asset
    || commonObjectAssetFor(cell.tile)
  );
}

export function boardBackgroundAssetFor(tileManifest = null, visualMode = ART_MODE_DEFAULT) {
  const manifest = tileManifest || state.tileManifest;
  return manifest?.art_trials?.[visualMode]?.board_background_asset || '';
}

export function objectOverlayOpacityFor(tileManifest = null, visualMode = ART_MODE_DEFAULT) {
  const manifest = tileManifest || state.tileManifest;
  const opacity = Number(manifest?.art_trials?.[visualMode]?.object_overlay_opacity);
  if (!Number.isFinite(opacity) || opacity <= 0) {
    return 1;
  }
  return opacity;
}

export function sceneBackgroundAssetFor(
  tileManifest = null,
  visualMode = ART_MODE_DEFAULT,
) {
  if (visualMode === 'matrix-skin') {
    return '';
  }
  const manifest = tileManifest || state.tileManifest;
  return manifest?.background?.asset || '';
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

function publicAssetUrl(asset) {
  const value = String(asset).replace(/["\\\n\r]/g, '').replaceAll('\\', '/');
  if (/^(https?:|data:|\.\/|\/)/.test(value)) {
    return value;
  }
  return `./public/${value}`;
}

function byId(id) {
  return document.getElementById(id);
}

function pushHistory(playState, boardChanges, puzzle = null) {
  const assignments = boardChanges.assignments ?? playState.assignments;
  const candidatePositions = boardChanges.candidatePositions
    ?? playState.candidatePositions
    ?? {};
  const manualMarks = boardChanges.manualMarks ?? playState.manualMarks ?? new Set();
  const previousHistory = playState.history || EMPTY_UNDO_HISTORY;
  // Board collections are replaced on change, so a history node can share
  // their previous versions without copying the whole board.
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

function cellAt(puzzle, row, col) {
  return puzzle?.cells?.find((item) => item.row === row && item.col === col) || null;
}

function canPlacePerson(assignments, personId, position, puzzle) {
  const [row, col] = position.split(',').map(Number);
  const cell = cellAt(puzzle, row, col);
  if (!cell?.walkable) {
    return false;
  }
  const ignorePersonId = assignments[personId] ? personId : '';
  const blockedPositions = computeBlockedPositions(assignments, puzzle, { ignorePersonId });
  return !blockedPositions.has(position);
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

function canConfirmPersonPlacement(playState, personId, position, puzzle = null) {
  if (playState.manualMarks?.has(position) || playState.assignments?.[personId] === position) {
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
  const cell = cellAt(puzzle, row, col);
  return Boolean(cell?.walkable);
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
