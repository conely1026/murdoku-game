import { positionKey } from './board-geometry.js';

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
