import { createElement } from '../engine/main.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function canvasFrame(value = {}, index = 0, type = 'image') {
  const fallbackY = 5 + ((index % 4) * 22);
  return {
    x: clamp(Number.isFinite(Number(value.x)) ? Number(value.x) : type === 'text' ? 6 : 58, 0, 94),
    y: clamp(Number.isFinite(Number(value.y)) ? Number(value.y) : fallbackY, 0, 94),
    width: clamp(Number(value.width) || (type === 'text' ? 52 : 34), 12, 100),
    height: clamp(Number(value.height) || (type === 'text' ? 22 : 24), 8, 100),
    page: Math.round(clamp(
      Number.isFinite(Number(value.page)) ? Number(value.page) : Math.floor(index / 4),
      0,
      20,
    )),
  };
}

const intersects = (a, b) => (
  a.x < b.x + b.width
  && a.x + a.width > b.x
  && a.y < b.y + b.height
  && a.y + a.height > b.y
);

function frameStyle(frame) {
  return `left:${frame.x}%;top:${frame.y}%;width:${frame.width}%;height:${frame.height}%;`;
}

function samePage(a, b) {
  return canvasFrame(a.frame, a.index, a.type).page === canvasFrame(b.frame, b.index, b.type).page;
}

function beginTransform(event, object, objects, onChange, mode) {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  const node = event.currentTarget.closest('.canvas-object');
  const artboard = node?.closest('.canvas-artboard');
  if (!node || !artboard) return;

  const boardRect = artboard.getBoundingClientRect();
  const initial = canvasFrame(object.frame, object.index, object.type);
  const startX = event.clientX;
  const startY = event.clientY;
  node.classList.add('is-transforming');

  const move = moveEvent => {
    const dx = ((moveEvent.clientX - startX) / boardRect.width) * 100;
    const dy = ((moveEvent.clientY - startY) / boardRect.height) * 100;
    const next = { ...initial };
    if (mode === 'move') {
      next.x = clamp(initial.x + dx, 0, 100 - initial.width);
      next.y = clamp(initial.y + dy, 0, 100 - initial.height);
    } else {
      if (mode.includes('right')) next.width = clamp(initial.width + dx, 12, 100 - initial.x);
      if (mode.includes('bottom')) next.height = clamp(initial.height + dy, 8, 100 - initial.y);
      if (mode.includes('left')) {
        const right = initial.x + initial.width;
        next.x = clamp(initial.x + dx, 0, right - 12);
        next.width = right - next.x;
      }
      if (mode.includes('top')) {
        const bottom = initial.y + initial.height;
        next.y = clamp(initial.y + dy, 0, bottom - 8);
        next.height = bottom - next.y;
      }
    }
    node.style.cssText = frameStyle(next);
    node.dataset.pendingFrame = JSON.stringify(next);
  };
  const finish = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', finish);
    node.classList.remove('is-transforming');
    const next = JSON.parse(node.dataset.pendingFrame || JSON.stringify(initial));
    const collides = objects.some(other => (
      other.id !== object.id
      && samePage(object, other)
      && intersects(next, canvasFrame(other.frame, other.index, other.type))
    ));
    if (collides) {
      node.style.cssText = frameStyle(initial);
      node.classList.add('canvas-object-collision');
      setTimeout(() => node.classList.remove('canvas-object-collision'), 280);
      return;
    }
    onChange(object.id, next);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', finish, { once: true });
  window.addEventListener('pointercancel', finish, { once: true });
}

function keyboardMove(event, object, objects, onChange, resize = false) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  const frame = canvasFrame(object.frame, object.index, object.type);
  const amount = event.shiftKey ? 5 : 1;
  const next = { ...frame };
  if (resize) {
    if (event.key === 'ArrowLeft') next.width = clamp(frame.width - amount, 12, 100 - frame.x);
    if (event.key === 'ArrowRight') next.width = clamp(frame.width + amount, 12, 100 - frame.x);
    if (event.key === 'ArrowUp') next.height = clamp(frame.height - amount, 8, 100 - frame.y);
    if (event.key === 'ArrowDown') next.height = clamp(frame.height + amount, 8, 100 - frame.y);
  } else {
    if (event.key === 'ArrowLeft') next.x = clamp(frame.x - amount, 0, 100 - frame.width);
    if (event.key === 'ArrowRight') next.x = clamp(frame.x + amount, 0, 100 - frame.width);
    if (event.key === 'ArrowUp') next.y = clamp(frame.y - amount, 0, 100 - frame.height);
    if (event.key === 'ArrowDown') next.y = clamp(frame.y + amount, 0, 100 - frame.height);
  }
  if (!objects.some(other => other.id !== object.id
    && samePage(object, other)
    && intersects(next, canvasFrame(other.frame, other.index, other.type)))) {
    onChange(object.id, next);
  }
}

function readerAspect(objects) {
  const bottom = objects.reduce((highest, object, index) => {
    const frame = canvasFrame(object.frame, index, object.type);
    return Math.max(highest, frame.y + frame.height);
  }, 0);
  const visibleRatio = clamp((bottom + 4) / 100, .12, 1);
  return `aspect-ratio:5/${7 * visibleRatio};`;
}

function syncReaderPage(pageNode) {
  if (!pageNode) return;
  requestAnimationFrame(() => {
    const shell = pageNode.querySelector('.canvas-artboard-shell');
    const board = pageNode.querySelector('.canvas-artboard');
    if (!shell || !board) return;
    let bottom = 0;
    let visibleObjects = 0;
    for (const objectNode of board.querySelectorAll('.canvas-object')) {
      const contentNode = objectNode.querySelector('.canvas-object-content');
      const canFlow = objectNode.dataset.canFlow === 'true';
      const overflowing = canFlow && contentNode.scrollHeight > contentNode.clientHeight + 2;
      const flowNode = [...pageNode.querySelectorAll('.canvas-flow-section')]
        .find(node => node.dataset.objectId === objectNode.dataset.objectId);
      objectNode.hidden = overflowing;
      if (flowNode) flowNode.hidden = !overflowing;
      if (overflowing) continue;
      visibleObjects += 1;
      const objectBottom = Number(objectNode.dataset.bottom) || 0;
      bottom = Math.max(bottom, objectBottom);
    }
    shell.hidden = visibleObjects === 0;
    if (visibleObjects > 0) {
      const visibleRatio = clamp((bottom + 4) / 100, .12, 1);
      shell.style.aspectRatio = `5 / ${7 * visibleRatio}`;
    }
  });
}

export function CanvasArtboard({ objects = [], onChange, onRemove = null, editable = true, label = 'Editorial canvas' }) {
  const normalized = objects.map((object, index) => ({
    ...object,
    index,
    frame: canvasFrame(object.frame, index, object.type),
  }));
  const pageCount = Math.max(1, ...normalized.map(object => object.frame.page + 1));
  const pages = Array.from({ length: pageCount }, (_, page) =>
    normalized.filter(object => object.frame.page === page)
  );

  return createElement('div', {
    className: `canvas-document${editable ? ' is-editable' : ''}`,
  },
    ...pages.map((pageObjects, page) => createElement('section', {
      key: `page-${page}`,
      className: 'canvas-page',
      ref: editable ? null : syncReaderPage,
    },
      editable
        ? createElement('div', { className: 'canvas-page-label' }, `PAGE ${String(page + 1).padStart(2, '0')}`)
        : null,
      createElement('div', {
        className: `canvas-artboard-shell${editable ? ' is-editable' : ''}`,
        style: editable ? null : readerAspect(pageObjects),
      },
        createElement('div', {
          className: 'canvas-artboard',
          role: editable ? 'group' : null,
          'aria-label': pageCount > 1 ? `${label}, page ${page + 1}` : label,
        },
          ...pageObjects.map(object => {
        const item = object;
        const frame = object.frame;
        return createElement('section', {
          key: object.id,
          className: `canvas-object canvas-object-${object.type}`,
          style: frameStyle(frame),
          'data-object-id': object.id,
          'data-bottom': frame.y + frame.height,
          'data-can-flow': !editable && object.type === 'text' && object.flowContent ? 'true' : 'false',
        },
          editable
            ? createElement('div', {
                className: 'canvas-object-bar',
                tabIndex: 0,
                onPointerDown: event => beginTransform(event, item, pageObjects, onChange, 'move'),
                onKeyDown: event => keyboardMove(event, item, pageObjects, onChange),
                'aria-label': `Move ${object.label || object.type}`,
              },
                createElement('span', null, object.label || object.type.toUpperCase()),
                onRemove
                  ? createElement('button', {
                      type: 'button',
                      onPointerDown: event => event.stopPropagation(),
                      onClick: () => onRemove(object.id),
                      'aria-label': `Remove ${object.label || object.type}`,
                    }, '×')
                  : null
              )
            : null,
          createElement('div', { className: 'canvas-object-content' }, object.content),
          ...(editable
            ? ['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(handle =>
                createElement('button', {
                  key: handle,
                  type: 'button',
                  className: `canvas-resize-handle canvas-resize-${handle}`,
                  onPointerDown: event => beginTransform(event, item, pageObjects, onChange, handle),
                  onKeyDown: event => keyboardMove(event, item, pageObjects, onChange, true),
                  'aria-label': `Resize ${object.label || object.type}`,
                })
              )
            : [])
        );
      })
        )
      ),
      !editable
        ? createElement('div', { className: 'canvas-flow-continuation' },
            ...pageObjects
              .filter(object => object.type === 'text' && object.flowContent)
              .map(object => createElement('section', {
                key: `flow-${object.id}`,
                className: 'canvas-flow-section',
                'data-object-id': object.id,
                hidden: true,
              }, object.flowContent))
          )
        : null
    ))
  );
}
