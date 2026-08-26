import {
  activeCluesByPerson,
  generalClues,
  personClueText,
} from '../domain/clues.js';
import { candidateLabelForPerson } from '../domain/play-state.js';
import { publicAssetUrl } from '../infrastructure/public-assets.js';
import { portraitAssetFor } from './visual-assets.js';

export function renderStoryView(puzzle, root = document) {
  const storyCard = root.getElementById('story-card');
  const storyText = root.getElementById('story-text');
  const story = puzzle.story || '';
  storyCard.hidden = !story;
  storyText.textContent = story;
}

export function renderGeneralCluesView(puzzle, root = document) {
  const card = root.getElementById('general-clue-card');
  const clues = generalClues(puzzle);
  const section = card.closest('.general-clues');
  card.replaceChildren();
  section.hidden = clues.length === 0;
  if (!clues.length) {
    return;
  }
  for (const clue of clues) {
    const text = root.createElement('p');
    text.textContent = clue.text;
    card.appendChild(text);
  }
}

export function renderInvestigationView({
  puzzle,
  collectedIds,
  onReset,
  root = document,
}) {
  const panel = root.getElementById('investigation-panel');
  const tool = root.getElementById('tool-investigate');
  const investigation = puzzle?.investigation;
  const items = investigation?.items || [];
  const hasInvestigation = items.length > 0;
  panel.hidden = !hasInvestigation;
  tool.hidden = !hasInvestigation;
  if (!hasInvestigation) {
    return;
  }

  root.getElementById('investigation-intro').textContent = investigation.intro
    || '调查棋盘上的特殊物件，可获得不影响唯一解的追加线索。';
  const collectedCount = items.filter((item) => collectedIds.has(item.id)).length;
  root.getElementById('investigation-progress').textContent = `${collectedCount} / ${items.length}`;

  const list = root.getElementById('investigation-list');
  list.replaceChildren();
  for (const item of items) {
    const collected = collectedIds.has(item.id);
    const card = root.createElement('article');
    card.className = `investigation-entry${collected ? ' is-collected' : ''}`;
    card.dataset.investigationId = item.id;

    const object = root.createElement('span');
    object.className = 'investigation-object';
    object.textContent = collected ? item.object_label : '未调查物件';
    const title = root.createElement('strong');
    title.textContent = collected ? item.title : '线索尚未解锁';
    const summary = root.createElement('span');
    summary.className = 'investigation-summary';
    summary.textContent = collected
      ? item.summary
      : '切换到“调查物件”，在场景中寻找金色标记。';
    const clue = root.createElement('p');
    clue.textContent = collected ? item.clue_text : '？？？';
    card.append(object, title, summary, clue);
    list.appendChild(card);
  }

  const completion = root.getElementById('investigation-complete');
  const isComplete = collectedCount === items.length;
  completion.hidden = !isComplete;
  completion.replaceChildren();
  if (isComplete) {
    const title = root.createElement('strong');
    title.textContent = investigation.completion_title || '调查完成';
    const text = root.createElement('span');
    text.textContent = investigation.completion_text || '全部追加线索已经收录。';
    const reset = root.createElement('button');
    reset.type = 'button';
    reset.className = 'investigation-reset';
    reset.textContent = '重置调查记录';
    reset.addEventListener('click', onReset);
    completion.append(title, text, reset);
  }
}

export function renderPeopleView({
  puzzle,
  assignments,
  selectedPerson,
  onSelectPerson,
  root = document,
}) {
  const list = root.getElementById('person-list');
  const cluesByPerson = activeCluesByPerson(puzzle);
  list.closest('.people-panel')?.classList.toggle(
    'is-large-roster',
    puzzle.people.length > 9,
  );
  list.replaceChildren();
  for (const person of puzzle.people) {
    const assignedPosition = assignments[person.id];
    const isSelected = person.id === selectedPerson;
    const button = root.createElement('button');
    button.type = 'button';
    button.className = [
      'person-card',
      assignedPosition ? 'is-placed' : '',
      isSelected ? 'is-selected' : '',
    ].filter(Boolean).join(' ');
    button.dataset.personId = person.id;
    if (assignedPosition) {
      button.dataset.assignment = assignedPosition;
    }
    button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    button.addEventListener('click', () => onSelectPerson(person.id));

    const portrait = createPortrait(root, puzzle, person);
    const meta = createPersonMeta(root, person, assignedPosition);
    const clue = createPersonClue(root, cluesByPerson, person.id);
    button.append(portrait, meta, clue);
    list.appendChild(button);
  }
  bindPersonCarousel({
    list,
    people: puzzle.people,
    selectedPerson,
    onSelectPerson,
    root,
  });
}

function bindPersonCarousel({ list, people, selectedPerson, onSelectPerson, root }) {
  const previous = root.getElementById('person-prev');
  const next = root.getElementById('person-next');
  const status = root.getElementById('person-carousel-status');
  if (!previous || !next || !status) {
    return;
  }

  const selectedIndex = Math.max(
    0,
    people.findIndex((person) => person.id === selectedPerson),
  );
  updateCarouselControls({ previous, next, status, index: selectedIndex, count: people.length });
  previous.onclick = () => onSelectPerson(people[selectedIndex - 1]?.id || selectedPerson);
  next.onclick = () => onSelectPerson(people[selectedIndex + 1]?.id || selectedPerson);
  list.onscroll = null;
  list.scrollLeft = 0;
}

function updateCarouselControls({ previous, next, status, index, count }) {
  previous.disabled = index <= 0;
  next.disabled = index >= count - 1;
  status.textContent = count ? `${index + 1} / ${count}` : '';
}

function createPortrait(root, puzzle, person) {
  const portraitAsset = portraitAssetFor(person.id);
  const portrait = root.createElement('span');
  portrait.className = [
    'portrait',
    `portrait-${person.id.toLowerCase()}`,
    portraitAsset ? 'has-portrait-asset' : '',
  ].filter(Boolean).join(' ');
  if (portraitAsset) {
    portrait.dataset.portraitAsset = portraitAsset;
    const portraitImage = root.createElement('img');
    portraitImage.className = 'portrait-image';
    portraitImage.src = publicAssetUrl(portraitAsset);
    portraitImage.alt = '';
    portraitImage.loading = 'eager';
    portraitImage.decoding = 'async';
    portrait.appendChild(portraitImage);
  } else {
    portrait.textContent = person.id.slice(0, 1);
  }
  const candidateKey = root.createElement('span');
  candidateKey.className = 'person-candidate-key';
  candidateKey.textContent = candidateLabelForPerson(puzzle.people, person.id);
  candidateKey.setAttribute('aria-hidden', 'true');
  portrait.appendChild(candidateKey);
  return portrait;
}

function createPersonMeta(root, person, assignedPosition) {
  const name = root.createElement('span');
  name.className = 'person-name';
  name.textContent = person.name;
  if (person.victim) {
    const victim = root.createElement('span');
    victim.className = 'victim-tag';
    victim.textContent = '受害者';
    name.append(' ', victim);
  }

  const meta = root.createElement('span');
  meta.className = 'person-meta';
  meta.append(name);
  if (person.role) {
    const role = root.createElement('span');
    role.className = 'person-role';
    role.textContent = person.role;
    meta.appendChild(role);
  }
  if (assignedPosition) {
    const placement = root.createElement('span');
    placement.className = 'person-placement';
    const placementStatus = root.createElement('span');
    placementStatus.className = 'person-placement-status';
    placementStatus.textContent = '已放置';
    const position = root.createElement('span');
    position.className = 'person-position';
    position.textContent = assignmentLabel(assignedPosition);
    placement.append(placementStatus, position);
    meta.appendChild(placement);
  }
  return meta;
}

function createPersonClue(root, cluesByPerson, personId) {
  const clue = root.createElement('span');
  clue.className = 'person-clue';
  const clueParts = cluesByPerson[personId] || [];
  const clueText = personClueText(cluesByPerson, personId);
  if (clueParts.length > 1) {
    clue.classList.add('is-list');
    for (const text of clueParts) {
      const item = root.createElement('span');
      item.className = 'person-clue-item';
      item.textContent = text;
      clue.appendChild(item);
    }
  } else {
    clue.textContent = clueText;
  }
  clue.title = clueText;
  return clue;
}

function assignmentLabel(key) {
  if (!key) return '';
  const [row, col] = key.split(',');
  return `R${row}C${col}`;
}
