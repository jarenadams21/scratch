import { createElement } from '../engine/main.js';

export function ListView({ title, entries, emptyLabel, renderItem, detailPane, topSlot }) {
  const hasEntries = entries && entries.length > 0;
  const hasTop     = !!topSlot;
  const isEmpty    = !hasEntries && !hasTop;

  // The visible record count includes whatever's pinned in topSlot — that
  // way single-entry archives show "1 RECORD" instead of "0 RECORDS".
  const totalCount = (hasEntries ? entries.length : 0) + (hasTop ? 1 : 0);

  if (isEmpty) {
    return createElement('div', { className: 'archive-full-view' },
      createElement('div', { className: 'archive-list-pane' },
        createElement('div', { className: 'archive-list-header' },
          createElement('h2', null, title),
          createElement('div', { className: 'record-count' }, '0 RECORDS')
        ),
        createElement('div', { className: 'empty-archive' },
          createElement('div', { className: 'empty-archive-label' }, emptyLabel)
        )
      )
    );
  }

  const hasDetail = !!detailPane;
  return createElement('div', { className: hasDetail ? 'archive-split-view' : 'archive-full-view' },
    createElement('div', { className: 'archive-list-pane' },
      createElement('div', { className: 'archive-list-header' },
        createElement('h2', null, title),
        createElement('div', { className: 'record-count' }, `${totalCount} RECORD${totalCount === 1 ? '' : 'S'}`)
      ),
      createElement('div', { className: 'archive-list-scroll' },
        topSlot || null,
        ...(hasEntries ? entries.map(renderItem) : [])
      )
    ),
    hasDetail ? detailPane : null
  );
}
