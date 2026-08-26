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
  if (!clues.length) {
    throw new Error(`人物卡缺少线索：${personId}`);
  }
  return clues.join(' ');
}

export function clueCardOwnerId(clue) {
  return clue.card_owner || clue.victim || clue.person || clue.other || '';
}

export function generalClues(puzzle) {
  return puzzle.clues.filter((clue) => !clueCardOwnerId(clue));
}
