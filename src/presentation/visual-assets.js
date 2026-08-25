import {
  ART_MODE_DEFAULT,
  ART_MODES,
  BOARD_COORD_WIDTH,
  COMMON_OBJECT_ASSETS,
  LARGE_GRID_MIN_CELL_SIZE,
  PORTRAIT_ASSETS,
  TILE_NAMES,
} from '../config/game-config.js';

export function largeGridMinWidth(cols) {
  return BOARD_COORD_WIDTH + (Math.max(0, Number(cols) || 0) * LARGE_GRID_MIN_CELL_SIZE);
}

export function tileClasses(cell) {
  const tileClassName = `tile-${cell.tile}`;
  return cell.walkable ? [tileClassName] : ['tile-blocker', tileClassName];
}

export function tileNameFor(tile) {
  return TILE_NAMES[tile] || tile;
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

export function cellSceneAssetFor(cell, tileManifest = null, visualMode = ART_MODE_DEFAULT) {
  if (!cell || ['background-objects', 'matrix-skin'].includes(visualMode)) {
    return '';
  }
  const cellEntry = manifestCellFor(cell, tileManifest);
  const trialCellRoot = tileManifest?.art_trials?.[visualMode]?.cell_asset_root || '';
  if (trialCellRoot) {
    return `${trialCellRoot}/r${cell.row}c${cell.col}.png`;
  }
  return cellEntry?.scene_asset || '';
}

export function cellObjectAssetFor(cell, tileManifest = null, visualMode = ART_MODE_DEFAULT) {
  if (!cell || visualMode === 'matrix-skin') {
    return '';
  }
  const cellEntry = manifestCellFor(cell, tileManifest);
  if (visualMode === 'background-objects') {
    return (
      cellEntry?.object_asset
      || tileManifest?.tiles?.[cell.tile]?.object_asset
      || commonObjectAssetFor(cell.tile)
    );
  }
  if (cellSceneAssetFor(cell, tileManifest, visualMode)) {
    return cellEntry?.object_asset || '';
  }
  return (
    cellEntry?.object_asset
    || tileManifest?.tiles?.[cell.tile]?.object_asset
    || commonObjectAssetFor(cell.tile)
  );
}

export function boardBackgroundAssetFor(
  tileManifest = null,
  visualMode = ART_MODE_DEFAULT,
) {
  return tileManifest?.art_trials?.[visualMode]?.board_background_asset || '';
}

export function objectOverlayOpacityFor(
  tileManifest = null,
  visualMode = ART_MODE_DEFAULT,
) {
  const opacity = Number(tileManifest?.art_trials?.[visualMode]?.object_overlay_opacity);
  return Number.isFinite(opacity) && opacity > 0 ? opacity : 1;
}

export function sceneBackgroundAssetFor(
  tileManifest = null,
  visualMode = ART_MODE_DEFAULT,
) {
  return visualMode === 'matrix-skin' ? '' : tileManifest?.background?.asset || '';
}

export function boundaryToneFor(tileManifest = null) {
  const tone = tileManifest?.matrix_skin?.boundary_style?.line_tone;
  return tone === 'light' ? 'light' : 'dark';
}

function manifestCellFor(cell, tileManifest) {
  if (!cell) {
    return null;
  }
  const key = `R${cell.row}C${cell.col}`;
  return tileManifest?.cells?.find((item) => item.key === key) || null;
}
