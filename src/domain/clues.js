export const NO_DIRECT_CLUE_TEXT = '无直接线索，需通过其他线索推出。';

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
