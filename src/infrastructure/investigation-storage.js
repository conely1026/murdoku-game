export function loadCollectedInvestigationIds(levelId, storage = browserStorage()) {
  if (!levelId || !storage) {
    return new Set();
  }
  try {
    const value = JSON.parse(storage.getItem(storageKey(levelId)) || '[]');
    return new Set(
      Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [],
    );
  } catch {
    return new Set();
  }
}

export function saveCollectedInvestigationIds(
  levelId,
  collectedIds,
  storage = browserStorage(),
) {
  if (!levelId || !storage) {
    return;
  }
  storage.setItem(storageKey(levelId), JSON.stringify([...collectedIds]));
}

function storageKey(levelId) {
  return `murdoku:investigation:${levelId}`;
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
