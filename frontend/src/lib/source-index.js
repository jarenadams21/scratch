export const SOURCE_INDEX_FILTERS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: 'website', label: 'Web' },
  { id: 'pdf', label: 'PDF' },
  { id: 'cited', label: 'Cited' },
  { id: 'uncited', label: 'Uncited' },
]);

export const SOURCE_INDEX_SORTS = Object.freeze([
  { id: 'title', label: 'Title A-Z' },
  { id: 'recent', label: 'Recently Added' },
  { id: 'used', label: 'Most Cited' },
  { id: 'published', label: 'Publication Date' },
]);

function normalizedText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

export function sourceYear(source) {
  const match = String(source?.publishedAt || '').match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);
  return match ? Number(match[1]) : null;
}

export function sourceDomain(source) {
  if (source?.type === 'pdf') return source.filename || 'PDF document';
  try {
    return new URL(source?.url || '').hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function sourceUsageMap(entries = []) {
  const usage = new Map();
  entries.forEach(entry => {
    (entry?.sourceIds || []).forEach(id => {
      usage.set(id, (usage.get(id) || 0) + 1);
    });
  });
  return usage;
}

export function linkedEntriesForSource(sourceId, entries = []) {
  return entries.filter(entry => (entry?.sourceIds || []).includes(sourceId));
}

export function sourceRecordCodes(sources = []) {
  const chronological = [...sources].sort((a, b) => {
    const aTime = Date.parse(a?.createdAt || '') || 0;
    const bTime = Date.parse(b?.createdAt || '') || 0;
    return aTime - bTime || String(a?.id || '').localeCompare(String(b?.id || ''));
  });
  return new Map(chronological.map((source, index) => [
    source.id,
    `SRC-${String(index + 1).padStart(3, '0')}`,
  ]));
}

function matchesQuery(source, linkedEntries, query) {
  const tokens = normalizedText(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const searchable = normalizedText([
    source.title,
    source.creator,
    source.publication,
    source.publishedAt,
    source.description,
    sourceDomain(source),
    ...linkedEntries.map(entry => entry.title),
  ].filter(Boolean).join(' '));
  return tokens.every(token => searchable.includes(token));
}

function matchesFilter(source, uses, filter) {
  if (filter === 'website' || filter === 'pdf') return source.type === filter;
  if (filter === 'cited') return uses > 0;
  if (filter === 'uncited') return uses === 0;
  return true;
}

export function sourceFilterCounts(sources = [], usage = new Map()) {
  return {
    all: sources.length,
    website: sources.filter(source => source.type === 'website').length,
    pdf: sources.filter(source => source.type === 'pdf').length,
    cited: sources.filter(source => (usage.get(source.id) || 0) > 0).length,
    uncited: sources.filter(source => (usage.get(source.id) || 0) === 0).length,
  };
}

export function indexedSources({
  sources = [],
  entries = [],
  query = '',
  filter = 'all',
  sort = 'title',
} = {}) {
  const usage = sourceUsageMap(entries);
  const linked = new Map(sources.map(source => [
    source.id,
    linkedEntriesForSource(source.id, entries),
  ]));
  const results = sources.filter(source => {
    const uses = usage.get(source.id) || 0;
    return matchesFilter(source, uses, filter)
      && matchesQuery(source, linked.get(source.id) || [], query);
  });

  results.sort((a, b) => {
    if (sort === 'recent') {
      return (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0)
        || a.title.localeCompare(b.title);
    }
    if (sort === 'used') {
      return (usage.get(b.id) || 0) - (usage.get(a.id) || 0)
        || a.title.localeCompare(b.title);
    }
    if (sort === 'published') {
      return (sourceYear(b) || -Infinity) - (sourceYear(a) || -Infinity)
        || a.title.localeCompare(b.title);
    }
    return a.title.localeCompare(b.title);
  });

  return results;
}
