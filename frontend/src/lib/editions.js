export function entriesForEdition(edition, entries, { includePrivate = false } = {}) {
  const byId = new Map((entries || []).map(entry => [entry.entryId, entry]));
  return (edition?.entryIds || [])
    .map(id => byId.get(id))
    .filter(entry => entry && entry.status !== 'draft' && (includePrivate || entry.visibility !== 'admins'));
}

export function blocksForEdition(edition) {
  if (Array.isArray(edition?.blocks)) {
    return edition.blocks.filter(block => (
      block
      && typeof block === 'object'
      && block.id
      && (block.type === 'entry' || block.type === 'source')
    ));
  }
  return (edition?.entryIds || []).map((entryId, index) => ({
    id: `entry-${index + 1}-${entryId}`,
    type: 'entry',
    entryId,
  }));
}

export function editionNumber(edition, index = 0) {
  const number = String(edition?.number || '').trim();
  return number || String(index + 1).padStart(3, '0');
}

export function entryWordCount(entry) {
  const content = String(entry?.content || '')
    .replace(/```[\s\S]*?```/g, block => block.replace(/```[^\n]*\n?|```/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[#>*+-]\s*/gm, '')
    .replace(/[*_~]/g, '')
    .trim();
  return content ? content.split(/\s+/).length : 0;
}

export function entryReadingMinutes(entry) {
  return Math.max(1, Math.ceil(entryWordCount(entry) / 220));
}

export function isLongformEntry(entry) {
  return entryWordCount(entry) >= 900;
}

export function editionWordCount(entries) {
  return (entries || []).reduce((total, entry) => total + entryWordCount(entry), 0);
}
