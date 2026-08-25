import { TILE_SYMBOLS } from '../config/game-config.js';
import {
  positionKey,
  regionBoundaryClasses,
} from '../domain/board-geometry.js';
import { investigationItemAt } from '../domain/investigation.js';
import { candidateLabelForPerson, candidatePeopleAtPosition } from '../domain/play-state.js';
import { publicAssetUrl } from '../infrastructure/public-assets.js';
import {
  renderObjectLayer,
  renderRegionLabelLayer,
  renderRegionSurfaceLayer,
} from './matrix-skin-layers.js';
import {
  boardBackgroundAssetFor,
  boundaryToneFor,
  cellObjectAssetFor,
  cellSceneAssetFor,
  largeGridMinWidth,
  objectOverlayOpacityFor,
  portraitAssetFor,
  tileClasses,
  tileNameFor,
} from './visual-assets.js';

export function renderBoardView({
  board,
  puzzle,
  tileManifest,
  materialManifest,
  objectManifest,
  visualMode,
  viewState,
  callbacks,
}) {
  const boardBackground = boardBackgroundAssetFor(tileManifest, visualMode);
  const hasMatrixSkin = visualMode === 'matrix-skin'
    && materialManifest
    && objectManifest;
  board.className = [
    'board',
    `is-art-${visualMode}`,
    hasMatrixSkin ? 'has-matrix-skin' : '',
    hasMatrixSkin ? `is-boundary-${boundaryToneFor(tileManifest)}` : '',
    boardBackground ? 'has-board-background' : '',
    viewState.mode === 'mark-x' ? 'is-tool-mark-x' : '',
    viewState.mode === 'erase' ? 'is-tool-erase' : '',
    viewState.mode === 'investigate' ? 'is-tool-investigate' : '',
    puzzle.rows > 9 || puzzle.cols > 9 ? 'is-large-grid' : '',
  ].filter(Boolean).join(' ');
  board.style.setProperty('--cols', String(puzzle.cols));
  board.style.setProperty('--rows', String(puzzle.rows));
  board.style.setProperty('--large-grid-min-width', `${largeGridMinWidth(puzzle.cols)}px`);
  board.style.setProperty(
    '--object-overlay-opacity',
    String(objectOverlayOpacityFor(tileManifest, visualMode)),
  );
  if (boardBackground) {
    board.style.setProperty('--board-background-image', `url("${publicAssetUrl(boardBackground)}")`);
  } else {
    board.style.removeProperty('--board-background-image');
  }
  board.onpointerleave = () => callbacks.onHoverRegion('');
  board.onfocusout = (event) => {
    if (!board.contains(event.relatedTarget)) {
      callbacks.onFocusRegion('');
    }
  };
  board.replaceChildren();
  if (hasMatrixSkin) {
    board.append(
      renderRegionSurfaceLayer(puzzle, tileManifest, materialManifest),
      renderObjectLayer(puzzle, objectManifest),
      renderRegionLabelLayer(puzzle),
    );
  }
  board.appendChild(createCoordinateLabel(''));
  for (let col = 1; col <= puzzle.cols; col += 1) {
    board.appendChild(createCoordinateLabel(`C${col}`));
  }
  for (let row = 1; row <= puzzle.rows; row += 1) {
    board.appendChild(createCoordinateLabel(`R${row}`));
    for (let col = 1; col <= puzzle.cols; col += 1) {
      board.appendChild(createCellButton({
        row,
        col,
        puzzle,
        tileManifest,
        visualMode,
        viewState,
        callbacks,
      }));
    }
  }
}

export function updateRegionHighlightView(
  board,
  { selectedRegion = '', previewRegion = '' } = {},
) {
  if (!board) {
    return;
  }
  for (const cell of board.querySelectorAll('.cell')) {
    const isSelected = cell.dataset.region === selectedRegion;
    const isPreview = cell.dataset.region === previewRegion;
    cell.classList.toggle('is-region-selected', isSelected);
    cell.classList.toggle('is-region-preview', isPreview);
    cell.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  }
}

function createCellButton({
  row,
  col,
  puzzle,
  tileManifest,
  visualMode,
  viewState,
  callbacks,
}) {
  const cell = puzzle.cells.find((item) => item.row === row && item.col === col);
  const key = positionKey(row, col);
  const candidatePersonIds = candidatePeopleAtPosition(viewState.candidatePositions, key);
  const candidateNames = candidatePersonIds.map((personId) => personName(puzzle, personId));
  const occupant = occupantAt(viewState.assignments, key);
  const isSelectedPersonPosition = Boolean(
    viewState.selectedPerson && occupant === viewState.selectedPerson,
  );
  const hasSelectedCandidate = Boolean(
    viewState.selectedPerson && candidatePersonIds.includes(viewState.selectedPerson),
  );
  const isSelectedRegion = cell.region === viewState.selectedRegion;
  const isPreviewRegion = cell.region === viewState.previewRegion;
  const isManualMark = viewState.manualMarks.has(key);
  const isXHint = viewState.blockedPositions.has(key) || isManualMark;
  const investigationItem = investigationItemAt(puzzle, row, col);
  const isInvestigated = investigationItem
    ? viewState.collectedInvestigationIds.has(investigationItem.id)
    : false;
  const sceneAsset = cellSceneAssetFor(cell, tileManifest, visualMode);
  const objectAsset = cellObjectAssetFor(cell, tileManifest, visualMode);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = [
    'cell',
    ...tileClasses(cell),
    ...regionBoundaryClasses(puzzle, cell, tileManifest?.matrix_skin?.boundary_style),
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
  const element = cell.element || tileNameFor(cell.tile);
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
      occupant ? `正式放置：${personName(puzzle, occupant)}` : '',
      candidateNames.length ? `候选：${candidateNames.join('、')}` : '',
      isSelectedPersonPosition ? '当前选中人物的位置' : '',
      hasSelectedCandidate ? '包含当前选中人物的候选标记' : '',
    ].filter(Boolean).join('，'),
  );

  appendCellArtwork(button, cell, sceneAsset, objectAsset);
  appendCellContent({
    button,
    cell,
    puzzle,
    occupant,
    candidatePersonIds,
    isSelectedPersonPosition,
    isXHint,
    selectedPerson: viewState.selectedPerson,
  });

  button.addEventListener('click', () => {
    callbacks.onSelectRegion(cell.region);
    callbacks.onCellClick(row, col);
  });
  button.addEventListener(
    'pointerdown',
    (event) => callbacks.onCellPointerDown(event, row, col, button),
  );
  button.addEventListener('keydown', (event) => callbacks.onCellKeyDown(event, row, col));
  button.addEventListener('pointerenter', () => {
    callbacks.onHoverRegion(cell.region);
    callbacks.onCellPointerEnter(row, col);
  });
  button.addEventListener('focus', () => callbacks.onFocusRegion(cell.region));
  button.addEventListener('blur', () => callbacks.onFocusRegion(''));
  return button;
}

function appendCellArtwork(button, cell, sceneAsset, objectAsset) {
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
}

function appendCellContent({
  button,
  cell,
  puzzle,
  occupant,
  candidatePersonIds,
  isSelectedPersonPosition,
  isXHint,
  selectedPerson,
}) {
  const symbol = document.createElement('span');
  symbol.className = 'tile-symbol';
  symbol.textContent = TILE_SYMBOLS[cell.tile] || (cell.walkable ? cell.tile : 'X');
  button.appendChild(symbol);

  if (occupant) {
    button.appendChild(renderOccupant(puzzle, occupant, isSelectedPersonPosition));
  } else if (candidatePersonIds.length) {
    button.appendChild(renderCandidateMarkers(puzzle, candidatePersonIds, selectedPerson));
  } else if (isXHint) {
    const x = document.createElement('span');
    x.className = 'map-x';
    x.textContent = 'X';
    button.appendChild(x);
  }

  const region = document.createElement('span');
  region.className = 'cell-region';
  region.textContent = isFirstRegionCell(puzzle, cell) ? cell.region : '';
  const elementLabel = document.createElement('span');
  elementLabel.className = 'cell-element';
  elementLabel.textContent = cell.element || tileNameFor(cell.tile);
  button.append(region, elementLabel);
}

function renderCandidateMarkers(puzzle, personIds, selectedPersonId) {
  const stack = document.createElement('span');
  stack.className = [
    'candidate-stack',
    personIds.includes(selectedPersonId) ? 'has-selected-person' : '',
  ].filter(Boolean).join(' ');
  stack.setAttribute('aria-hidden', 'true');
  for (const personId of personIds) {
    const marker = document.createElement('span');
    const label = candidateLabelForPerson(puzzle.people, personId);
    marker.className = `candidate-letter${personId === selectedPersonId ? ' is-selected' : ''}`;
    marker.dataset.personId = personId;
    marker.title = `${label} · ${personName(puzzle, personId)}`;
    marker.textContent = label;
    stack.appendChild(marker);
  }
  return stack;
}

function renderOccupant(puzzle, personId, isSelected) {
  const marker = document.createElement('span');
  marker.className = `occupant${isSelected ? ' is-selected' : ''}`;
  marker.title = personName(puzzle, personId);
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
  name.textContent = personName(puzzle, personId).trim().split(/\s+/)[0] || personId;
  marker.append(portrait, name);
  return marker;
}

function createCoordinateLabel(text) {
  const cell = document.createElement('div');
  cell.className = 'coord';
  cell.textContent = text;
  return cell;
}

function occupantAt(assignments, position) {
  return Object.keys(assignments).find((personId) => assignments[personId] === position);
}

function personName(puzzle, personId) {
  return puzzle?.people?.find((person) => person.id === personId)?.name || personId;
}

function isFirstRegionCell(puzzle, cell) {
  return (puzzle?.cells || []).find((item) => item.region === cell.region) === cell;
}
