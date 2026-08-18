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
};

export const COMMON_OBJECT_ASSETS = Object.freeze({
  carpet: 'assets/common/tile-kit/v1/tiles/carpet.png',
  chair: 'assets/common/tile-kit/v1/tiles/chair.png',
  bookshelf: 'assets/common/tile-kit/v1/tiles/bookshelf.png',
  tree: 'assets/common/tile-kit/v1/tiles/tree.png',
  table: 'assets/common/tile-kit/v1/tiles/table.png',
  fountain: 'assets/common/tile-kit/v1/tiles/fountain.png',
  shrub: 'assets/common/tile-kit/v1/tiles/shrub.png',
});

export const ART_MODE_DEFAULT = 'scene-slices';
const ART_MODES = new Set([ART_MODE_DEFAULT, 'region-grade', 'background-objects']);

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
  visualMode: ART_MODE_DEFAULT,
  selectedPerson: '',
  mode: 'place',
  assignments: {},
  blockedPositions: new Set(),
  manualMarks: new Set(),
  history: [],
  activeHint: 0,
  isPainting: false,
  lastPaintedPosition: '',
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
  return { puzzle, proof, hints, tileManifest };
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
  if (!['mark-x', 'erase'].includes(tool)) {
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

export function regionBoundaryClasses(puzzle, cell) {
  const classes = [];
  if (!puzzle || !cell) {
    return classes;
  }

  const sameRegion = (row, col) => cellAt(puzzle, row, col)?.region === cell.region;
  if (cell.row === 1 || !sameRegion(cell.row - 1, cell.col)) {
    classes.push('region-border-top');
  }
  if (cell.col === 1 || !sameRegion(cell.row, cell.col - 1)) {
    classes.push('region-border-left');
  }
  if (cell.row === puzzle.rows) {
    classes.push('region-border-bottom');
  }
  if (cell.col === puzzle.cols) {
    classes.push('region-border-right');
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
    ? `唯一解 · 凶手 ${state.proof.solution.murderer}`
    : 'proof 未通过';
  renderStory();
  renderBoard();
  renderGeneralClues();
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
  state.visualMode = ART_MODE_DEFAULT;
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
  board.className = [
    'board',
    `is-art-${visualMode}`,
    boardBackground ? 'has-board-background' : '',
    state.mode === 'mark-x' ? 'is-tool-mark-x' : '',
    state.mode === 'erase' ? 'is-tool-erase' : '',
  ].filter(Boolean).join(' ');
  board.style.setProperty('--cols', String(state.puzzle.cols));
  board.style.setProperty('--rows', String(state.puzzle.rows));
  board.style.setProperty(
    '--object-overlay-opacity',
    String(objectOverlayOpacityFor(state.tileManifest, visualMode)),
  );
  if (boardBackground) {
    board.style.setProperty('--board-background-image', `url("${publicAssetUrl(boardBackground)}")`);
  } else {
    board.style.removeProperty('--board-background-image');
  }
  board.replaceChildren();
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

function renderCell(row, col) {
  const cell = state.puzzle.cells.find((item) => item.row === row && item.col === col);
  const key = positionKey(row, col);
  const isManualMark = state.manualMarks.has(key);
  const isXHint = state.blockedPositions.has(key) || isManualMark;
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
    isXHint ? 'is-x-hint' : '',
    isManualMark ? 'is-manual-x' : '',
  ].filter(Boolean).join(' ');
  button.dataset.position = key;
  button.dataset.row = String(row);
  button.dataset.col = String(col);
  button.dataset.walkable = cell.walkable ? 'true' : 'false';
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
  button.disabled = !cell.walkable;
  button.setAttribute(
    'aria-label',
    `${row} 行 ${col} 列，${cell.region}，${element}`,
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
  region.textContent = cell.region;
  button.appendChild(region);

  const elementLabel = document.createElement('span');
  elementLabel.className = 'cell-element';
  elementLabel.textContent = element;
  button.appendChild(elementLabel);

  button.addEventListener('click', () => handleCellClick(row, col));
  button.addEventListener('pointerdown', (event) => handleCellPointerDown(event, row, col));
  button.addEventListener('pointerenter', () => handleCellPointerEnter(row, col));
  return button;
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

function renderPeople() {
  const list = byId('person-list');
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
  byId('tool-undo').disabled = state.history.length === 0;
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
  if (!cell || visualMode === 'background-objects') {
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
  if (!cell) {
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

function sceneBackgroundAsset() {
  return state.tileManifest?.background?.asset || '';
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
