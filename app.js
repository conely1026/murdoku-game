export const LEVEL_INDEX = './public/puzzles/index.json';
export const PACK_BASE = './public/puzzles/fog-town-books';
export const NO_DIRECT_CLUE_TEXT = '无直接线索，需通过其他线索推出。';

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
const REGION_FALLBACK_COLORS = Object.freeze({
  mossy_garden_grass: '#5f7d3c',
  light_honey_cafe_wood: '#b48647',
  dark_walnut_library_wood: '#56351f',
  cool_gray_courtyard_stone: '#6e7778',
  rough_taupe_workshop_stone: '#89775c',
  amber_inn_wood: '#a85d25',
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
  blockedPositions: new Set(),
  manualMarks: new Set(),
  history: [],
  activeHint: 0,
  isPainting: false,
  lastPaintedPosition: '',
  collectedInvestigationIds: new Set(),
};

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
    blockedPositions: new Set(),
    manualMarks: new Set(),
    history: [],
    selectedPerson: people[0] || '',
    mode: 'place',
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
  return pushHistory(playState, nextAssignments, puzzle);
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
  return pushHistory(playState, nextAssignments, puzzle);
}

export function eraseAll(playState, puzzle = null) {
  if (!Object.keys(playState.assignments).length) {
    return withBlockedPositions(playState, puzzle);
  }
  return pushHistory(playState, {}, puzzle);
}

export function undoLast(playState, puzzle = null) {
  if (!playState.history.length) {
    return withBlockedPositions(playState, puzzle);
  }
  const previous = playState.history[playState.history.length - 1];
  return {
    ...playState,
    assignments: { ...previous },
    blockedPositions: computeBlockedPositions(previous, puzzle),
    history: playState.history.slice(0, -1),
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
  const manualMarks = new Set(playState.manualMarks || []);
  manualMarks.add(position);
  return {
    ...playState,
    manualMarks,
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
  const withoutMark = eraseManualMark(playState, position);
  const nextAssignments = { ...withoutMark.assignments };
  const personAtPosition = Object.keys(nextAssignments).find(
    (personId) => nextAssignments[personId] === position,
  );
  if (!personAtPosition) {
    return withBlockedPositions(withoutMark, puzzle);
  }
  delete nextAssignments[personAtPosition];
  return pushHistory(withoutMark, nextAssignments, puzzle);
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
    for (const personId of cluePersonIds(clue)) {
      if (byPerson[personId] && !byPerson[personId].includes(clue.text)) {
        byPerson[personId].push(clue.text);
      }
    }
  }
  return byPerson;
}

export function personClueText(cluesByPerson, personId) {
  const clues = cluesByPerson[personId] || [];
  return clues.length ? clues.join(' ') : NO_DIRECT_CLUE_TEXT;
}

function cluePersonIds(clue) {
  return [clue.person, clue.victim, clue.other].filter(Boolean);
}

export function generalClues(puzzle) {
  return puzzle.clues.filter((clue) => !clue.person && !clue.victim);
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

export function regionBoundaryClasses(puzzle, cell) {
  const classes = [];
  if (!puzzle || !cell) {
    return classes;
  }

  const sameRegion = (row, col) => cellAt(puzzle, row, col)?.region === cell.region;
  if (cell.row === 1 || !sameRegion(cell.row - 1, cell.col)) {
    classes.push('region-border-top');
    classes.push('region-outline-top');
  }
  if (cell.col === 1 || !sameRegion(cell.row, cell.col - 1)) {
    classes.push('region-border-left');
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
    window.addEventListener('pointerup', stopPainting);
    window.addEventListener('pointercancel', stopPainting);
    window.addEventListener('pointermove', handlePaintPointerMove);
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
  state.blockedPositions = new Set();
  state.manualMarks = new Set();
  state.history = [];
  state.activeHint = 0;
  state.hoveredRegion = '';
  state.focusedRegion = '';
  state.selectedRegion = '';
  state.collectedInvestigationIds = loadCollectedInvestigationIds(levelId);
  stopPainting();
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
  state.collectedInvestigationIds = new Set();
  stopPainting();
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
  const regions = regionCellsByName(puzzle);
  const materialByRegion = tileManifest?.matrix_skin?.region_materials || {};

  Object.entries(regions).forEach(([regionName, cells], index) => {
    const materialName = materialByRegion[regionName];
    const material = materialManifest?.materials?.[materialName];
    const clipId = `region-clip-${index}`;
    const patternId = `region-pattern-${index}`;
    const clip = document.createElementNS(SVG_NAMESPACE, 'clipPath');
    clip.id = clipId;
    for (const cell of cells) {
      const rect = document.createElementNS(SVG_NAMESPACE, 'rect');
      rect.setAttribute('x', String((cell.col - 1) * 100));
      rect.setAttribute('y', String((cell.row - 1) * 100));
      rect.setAttribute('width', '100');
      rect.setAttribute('height', '100');
      clip.appendChild(rect);
    }
    defs.appendChild(clip);

    const pattern = document.createElementNS(SVG_NAMESPACE, 'pattern');
    pattern.id = patternId;
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    pattern.setAttribute('width', '220');
    pattern.setAttribute('height', '220');
    pattern.setAttribute('overflow', 'hidden');
    const fallback = document.createElementNS(SVG_NAMESPACE, 'rect');
    fallback.setAttribute('width', '220');
    fallback.setAttribute('height', '220');
    fallback.setAttribute('fill', REGION_FALLBACK_COLORS[materialName] || '#70675a');
    pattern.appendChild(fallback);
    if (material?.asset) {
      const image = document.createElementNS(SVG_NAMESPACE, 'image');
      image.setAttribute('href', publicAssetUrl(material.asset));
      image.setAttribute('x', '-3');
      image.setAttribute('y', '-3');
      image.setAttribute('width', '226');
      image.setAttribute('height', '226');
      image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      pattern.appendChild(image);
    }
    defs.appendChild(pattern);

    const surface = document.createElementNS(SVG_NAMESPACE, 'rect');
    surface.classList.add('region-surface');
    surface.dataset.region = regionName;
    surface.setAttribute('width', String(width));
    surface.setAttribute('height', String(height));
    surface.setAttribute('fill', `url(#${patternId})`);
    surface.setAttribute('clip-path', `url(#${clipId})`);
    svg.appendChild(surface);
  });
  return svg;
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
    ...regionBoundaryClasses(state.puzzle, cell),
    sceneAsset ? 'has-scene-asset' : '',
    objectAsset ? 'has-object-asset' : '',
    isSelectedRegion ? 'is-region-selected' : '',
    isPreviewRegion ? 'is-region-preview' : '',
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
  button.setAttribute(
    'aria-label',
    `${row} 行 ${col} 列，${cell.region}，${element}${cell.walkable ? '' : '，不可放置，可查看区域'}`,
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

  const occupant = occupantAt(row, col);
  if (occupant) {
    const badge = document.createElement('span');
    badge.className = 'occupant';
    badge.textContent = occupant;
    button.appendChild(badge);
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
  button.addEventListener('pointerdown', (event) => handleCellPointerDown(event, row, col));
  button.addEventListener('pointerenter', () => {
    setHoveredRegion(cell.region);
    handleCellPointerEnter(row, col);
  });
  button.addEventListener('focus', () => setFocusedRegion(cell.region));
  button.addEventListener('blur', () => setFocusedRegion(''));
  return button;
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
  list.closest('.people-panel')?.classList.toggle(
    'is-large-roster',
    state.puzzle.people.length > 9,
  );
  list.replaceChildren();
  const cluesByPerson = activeCluesByPerson(state.puzzle);
  for (const person of state.puzzle.people) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `person-card${person.id === state.selectedPerson ? ' is-selected' : ''}`;
    button.dataset.personId = person.id;
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

    const name = document.createElement('span');
    name.className = 'person-name';
    name.textContent = person.name;
    if (person.victim) {
      const victim = document.createElement('span');
      victim.className = 'victim-tag';
      victim.textContent = '受害者';
      name.append(' ', victim);
    }

    const position = document.createElement('span');
    position.className = 'person-position';
    position.textContent = assignmentLabel(state.assignments[person.id]);

    const meta = document.createElement('span');
    meta.className = 'person-meta';
    meta.append(name);
    if (person.role) {
      const role = document.createElement('span');
      role.className = 'person-role';
      role.textContent = person.role;
      meta.appendChild(role);
    }
    meta.appendChild(position);

    const clue = document.createElement('span');
    clue.className = 'person-clue';
    const clueText = personClueText(cluesByPerson, person.id);
    clue.textContent = clueText;
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
  applyPlayState(placePerson(snapshotPlayState(), state.selectedPerson, key, state.puzzle));
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

function handleCellPointerDown(event, row, col) {
  if (!isPaintToolActive()) {
    return;
  }
  state.isPainting = true;
  state.lastPaintedPosition = '';
  applyToolToCell(row, col);
  event.preventDefault();
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
  if (state.mode === 'mark-x') {
    applyPlayState(markPosition(snapshotPlayState(), position, state.puzzle));
  } else if (state.mode === 'erase') {
    applyPlayState(eraseCell(snapshotPlayState(), position, state.puzzle));
  }
  clearFeedback();
}

function isPaintToolActive() {
  return state.mode === 'mark-x' || state.mode === 'erase';
}

function snapshotPlayState() {
  return {
    assignments: state.assignments,
    blockedPositions: state.blockedPositions,
    manualMarks: state.manualMarks,
    history: state.history,
    selectedPerson: state.selectedPerson,
    mode: state.mode,
  };
}

function applyPlayState(playState) {
  state.assignments = playState.assignments;
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

function stopPainting() {
  state.isPainting = false;
  state.lastPaintedPosition = '';
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

function assignmentLabel(key) {
  if (!key) {
    return '未放置';
  }
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

function pushHistory(playState, nextAssignments, puzzle = null) {
  return {
    ...playState,
    assignments: nextAssignments,
    blockedPositions: computeBlockedPositions(nextAssignments, puzzle),
    history: [...playState.history, { ...playState.assignments }],
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
