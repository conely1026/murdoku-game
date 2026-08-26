const STORAGE_VERSION = 1;

export function loadLastPlayState(levelId, storage = browserStorage()) {
  if (!levelId || !storage) {
    return null;
  }
  try {
    const value = JSON.parse(storage.getItem(storageKey(levelId)) || 'null');
    if (!value || value.version !== STORAGE_VERSION) {
      return null;
    }
    return {
      assignments: stringMap(value.assignments),
      candidatePositions: stringArrayMap(value.candidatePositions),
      manualMarks: new Set(stringArray(value.manualMarks)),
    };
  } catch {
    return null;
  }
}

export function saveLastPlayState(levelId, playState, storage = browserStorage()) {
  if (!levelId || !storage) {
    return;
  }
  const value = {
    version: STORAGE_VERSION,
    assignments: stringMap(playState.assignments),
    candidatePositions: stringArrayMap(playState.candidatePositions),
    manualMarks: stringArray(playState.manualMarks),
  };
  try {
    storage.setItem(storageKey(levelId), JSON.stringify(value));
  } catch {
    // The game remains playable when private browsing or storage quotas block writes.
  }
}

function stringMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, item]) => typeof key === 'string' && typeof item === 'string',
    ),
  );
}

function stringArrayMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, items]) => [key, stringArray(items)])
      .filter(([, items]) => items.length > 0),
  );
}

function stringArray(value) {
  if (!value || typeof value[Symbol.iterator] !== 'function') {
    return [];
  }
  return [...new Set([...value].filter((item) => typeof item === 'string'))];
}

function storageKey(levelId) {
  return `murdoku:play-state:${levelId}`;
}

function browserStorage() {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
