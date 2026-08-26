export const LEVEL_INDEX = './public/puzzles/index.json';
export const PACK_BASE = './public/puzzles/fog-town-books';
export const FORMAL_PLACEMENT_HOLD_MS = 1000;

export const TILE_NAMES = Object.freeze({
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
});

export const TILE_SYMBOLS = Object.freeze({
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
});

export const COMMON_OBJECT_ASSETS = Object.freeze({
  carpet: 'assets/common/tile-kit/v1/tiles/carpet.png',
  chair: 'assets/common/tile-kit/v1/tiles/chair.png',
  bookshelf: 'assets/common/tile-kit/v1/tiles/bookshelf.png',
  tree: 'assets/common/tile-kit/v1/tiles/tree.png',
  table: 'assets/common/tile-kit/v1/tiles/table.png',
  fountain: 'assets/common/tile-kit/v1/tiles/fountain.png',
  shrub: 'assets/common/tile-kit/v1/tiles/shrub.png',
});

export const PORTRAIT_ASSETS = Object.freeze({
  Aiden: 'assets/portraits/common/v1/aiden.png',
  Bella: 'assets/portraits/common/v1/bella.png',
  Colin: 'assets/portraits/common/v1/colin.png',
  Diana: 'assets/portraits/common/v1/diana.png',
  Ethan: 'assets/portraits/common/v1/ethan.png',
  Fiona: 'assets/portraits/common/v1/fiona.png',
});

export const ART_MODE_DEFAULT = 'matrix-skin';
export const ART_MODES = new Set([
  ART_MODE_DEFAULT,
]);

export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
export const BOARD_COORD_WIDTH = 34;
export const LARGE_GRID_MIN_CELL_SIZE = 40;

export const REGION_FALLBACK_COLORS = Object.freeze({
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
