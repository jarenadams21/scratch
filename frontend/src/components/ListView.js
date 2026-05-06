import { createElement } from '../engine/main.js';

export function ListView({ title, entries, emptyLabel, renderItem, detailPane }) {
  if (!entries || entries.length === 0) {
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
        createElement('div', { className: 'record-count' }, `${entries.length} RECORDS`)
      ),
      createElement('div', { className: 'archive-list-scroll' },
        ...entries.map(renderItem)
      )
    ),
    hasDetail ? detailPane : null
  );
}
