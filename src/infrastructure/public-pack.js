import { LEVEL_INDEX, PACK_BASE } from '../config/game-config.js';
import { publicAssetUrl } from './public-assets.js';

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
