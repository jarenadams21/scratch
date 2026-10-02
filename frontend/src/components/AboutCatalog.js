import { createElement } from '../engine/main.js';
import { renderMarkdown } from '../lib/markdown.js';

let activeCatalogCard = null;
let catalogResizeInstalled = false;

function sizeActiveCatalogCard() {
  if (!activeCatalogCard?.node?.isConnected) return;
  const { node, count } = activeCatalogCard;
  const stage = node.closest('.catalog-stage');
  if (!stage) return;
  const height = node.offsetHeight;
  const narrow = window.matchMedia('(max-width: 820px)').matches;
  const backgroundHeight = narrow && count > 1 ? ((count - 2) * 44) + 136 : 40;
  stage.style.setProperty('--catalog-measured-active-height', `${height}px`);
  stage.style.minHeight = `${Math.max(height + backgroundHeight, 720 + (count * 44))}px`;
}

function registerActiveCatalogCard(node, active, count) {
  if (active) {
    activeCatalogCard = { node, count };
    requestAnimationFrame(sizeActiveCatalogCard);
    if (!catalogResizeInstalled) {
      window.addEventListener('resize', sizeActiveCatalogCard);
      catalogResizeInstalled = true;
    }
  } else if (activeCatalogCard?.node === node) {
    activeCatalogCard = null;
  }
}

export function normalizeAbout(about) {
  const source = about || {};
  const stored = Array.isArray(source.sections) ? source.sections : [];
  const sections = stored.length
    ? stored
    : typeof source.content === 'string' && source.content.trim()
      ? [{
          id: 'about-legacy',
          title: source.title?.trim() || 'About',
          descriptor: '',
          classification: '',
          content: source.content,
        }]
      : [];
  return {
    title: typeof source.title === 'string' ? source.title : '',
    updatedAt: source.updatedAt || null,
    sections: sections.map((section, index) => ({
      id: typeof section?.id === 'string' && section.id ? section.id : `about-${index + 1}`,
      title: typeof section?.title === 'string' ? section.title : '',
      descriptor: typeof section?.descriptor === 'string' ? section.descriptor : '',
      classification: typeof section?.classification === 'string' ? section.classification : '',
      content: typeof section?.content === 'string' ? section.content : '',
    })),
  };
}

function cardNumber(index) {
  return String(index + 1).padStart(2, '0');
}

export function CatalogCard({
  section,
  index,
  backgroundIndex,
  count,
  activeId,
  onSelect,
  onReturn,
  registerSummary,
  registerReturn,
}) {
  const active = activeId === section.id;
  const background = !!activeId && !active;
  const number = cardNumber(index);
  const state = active ? 'active' : background ? 'background' : 'collapsed';
  const headingId = `about-card-title-${section.id}`;
  const bodyId = `about-card-body-${section.id}`;

  return createElement('section', {
    className: `catalog-card catalog-card-${state}`,
    style: `--catalog-index:${index};--catalog-count:${count};--catalog-x:${index * 26}px;--catalog-y:${index * 52}px;--catalog-mobile-y:${index * 52}px;--catalog-background-y:${210 + (backgroundIndex * 62)}px;--catalog-mobile-background-y:${backgroundIndex * 44}px;--catalog-z:${index + 1};`,
    'data-card-id': section.id,
    'data-card-state': state,
    'aria-labelledby': headingId,
    ref: node => registerActiveCatalogCard(node, active, count),
  },
    createElement('button', {
      type: 'button',
      className: 'catalog-card-summary',
      onClick: () => onSelect(section.id),
      'aria-expanded': active ? 'true' : 'false',
      'aria-controls': bodyId,
      'aria-current': active ? 'true' : 'false',
      ref: node => registerSummary(section.id, node),
    },
      createElement('span', { className: 'catalog-card-register' },
        createElement('span', null, `CARD ${number}`),
        createElement('span', null, (section.classification || 'GENERAL REFERENCE').toUpperCase())
      ),
      createElement('span', {
        className: 'catalog-card-title',
        id: headingId,
      }, (section.title || 'Untitled card').toUpperCase()),
      createElement('span', { className: 'catalog-card-descriptor' },
        section.descriptor || 'No descriptor filed.'
      ),
      createElement('span', { className: 'catalog-card-rule', 'aria-hidden': 'true' }),
      createElement('span', { className: 'catalog-card-filed' },
        createElement('span', null, 'FILED UNDER'),
        createElement('strong', null, (section.classification || 'ABOUT / GENERAL').toUpperCase())
      ),
      createElement('span', { className: 'catalog-card-open' },
        active ? 'SELECTED RECORD' : 'OPEN CARD →'
      )
    ),
    createElement('div', {
      className: 'catalog-card-body',
      id: bodyId,
      'aria-hidden': active ? 'false' : 'true',
    },
      createElement('div', { className: 'catalog-card-body-register' },
        createElement('span', null, `${number} / ${String(count).padStart(2, '0')}`),
        createElement('span', null, 'HARBINGER ABOUT CATALOG')
      ),
      createElement('h2', null, section.title || 'Untitled card'),
      section.descriptor
        ? createElement('p', { className: 'catalog-card-deck' }, section.descriptor)
        : null,
      createElement('div', { className: 'catalog-card-body-rule', 'aria-hidden': 'true' }),
      active && section.content.trim()
        ? createElement('div', { className: 'catalog-card-content reading-content' },
            ...renderMarkdown(section.content)
          )
        : active
          ? createElement('p', { className: 'catalog-card-empty' }, 'This catalog card has no published text.')
          : null,
      createElement('button', {
        type: 'button',
        className: 'catalog-return',
        onClick: () => onReturn(section.id),
        tabIndex: active ? 0 : -1,
        ref: node => registerReturn(section.id, node),
      }, '← RETURN TO CATALOG')
    )
  );
}

export function CatalogStack({
  about,
  activeId,
  onSelect,
  onReturn,
  registerSummary = () => {},
  registerReturn = () => {},
  emptyLabel,
}) {
  const normalized = normalizeAbout(about);
  const sections = normalized.sections;
  const validActiveId = sections.some(section => section.id === activeId) ? activeId : null;
  if (!sections.length) {
    return createElement('div', { className: 'catalog-empty' },
      createElement('span', { className: 'about-kicker' }, 'REFERENCE FILE'),
      createElement('h1', null, normalized.title || 'ABOUT'),
      createElement('p', null, emptyLabel)
    );
  }

  return createElement('section', {
    className: validActiveId ? 'catalog-stack catalog-stack-active' : 'catalog-stack',
    'aria-label': normalized.title || 'About catalog',
  },
    createElement('header', { className: 'catalog-heading' },
      createElement('span', { className: 'about-kicker' }, 'REFERENCE DEPARTMENT · PUBLIC FILE'),
      createElement('h1', null, normalized.title || 'ABOUT'),
      createElement('p', null, validActiveId
        ? 'Selected record pulled for reading. Remaining index cards stay available.'
        : 'Select a catalog card to pull its record forward.'
      )
    ),
    createElement('div', {
      className: 'catalog-stage',
      style: `--catalog-stage-height:${Math.max(430, 330 + ((sections.length - 1) * 52))}px;--catalog-active-stage-height:${720 + (sections.length * 44)}px;`,
    },
      ...(() => {
        let backgroundIndex = 0;
        return sections.map((section, index) => createElement(CatalogCard, {
          key: section.id,
          section,
          index,
          backgroundIndex: validActiveId && section.id !== validActiveId
            ? backgroundIndex++
            : index,
          count: sections.length,
          activeId: validActiveId,
          onSelect,
          onReturn,
          registerSummary,
          registerReturn,
        }));
      })()
    )
  );
}
