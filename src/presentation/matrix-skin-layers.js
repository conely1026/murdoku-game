import {
  REGION_FALLBACK_COLORS,
  SVG_NAMESPACE,
} from '../config/game-config.js';
import {
  parseCellReference,
  regionCellsByName,
} from '../domain/board-geometry.js';
import { publicAssetUrl } from '../infrastructure/public-assets.js';

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

export function renderRegionSurfaceLayer(puzzle, tileManifest, materialManifest) {
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

export function renderObjectLayer(puzzle, objectManifest) {
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

export function renderRegionLabelLayer(puzzle) {
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
