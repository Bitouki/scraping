/** Minimal element builder. Text is always set via textContent, never innerHTML. */
export function h(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'value') node.value = value;
    else if (key === 'checked' || key === 'disabled' || key === 'selected') node[key] = Boolean(value);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** replaceChildren() renders null as the text "null"; drop empty slots first. */
export function mount(host, ...children) {
  host.replaceChildren(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
}

export function field(labelText, input) {
  return h('div', {}, [h('label', { text: labelText }), input]);
}

export function toast(message) {
  document.querySelector('.toast')?.remove();
  const node = h('div', { class: 'toast', text: message });
  document.body.append(node);
  setTimeout(() => node.remove(), 2600);
}

/**
 * Opens a modal. `render(close)` returns { title, body, footer }.
 * Resolves with whatever close() was called with.
 */
export function modal(render, { wide = false } = {}) {
  return new Promise((resolve) => {
    const backdrop = h('div', { class: 'modal-backdrop' });

    const close = (result) => {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };

    const onKey = (event) => {
      if (event.key === 'Escape') close(undefined);
    };

    const { title, body, footer } = render(close);

    const box = h('div', { class: wide ? 'modal wide' : 'modal' }, [
      h('header', {}, [
        h('h2', { text: title }),
        h('button', { class: 'close-x', type: 'button', 'aria-label': 'Fermer', text: '×', onClick: () => close(undefined) }),
      ]),
      h('div', { class: 'modal-body' }, body),
      footer ? h('footer', {}, footer) : null,
    ]);

    backdrop.append(box);
    backdrop.addEventListener('mousedown', (event) => {
      if (event.target === backdrop) close(undefined);
    });
    document.addEventListener('keydown', onKey);
    document.body.append(backdrop);

    box.querySelector('input, select, textarea')?.focus();
  });
}

export function confirmDialog(message, { confirmLabel = 'Supprimer', danger = true } = {}) {
  return modal((close) => ({
    title: 'Confirmation',
    body: [h('p', { text: message, style: 'margin:0' })],
    footer: [
      h('button', { class: 'btn', type: 'button', text: 'Annuler', onClick: () => close(false) }),
      h('button', {
        class: danger ? 'btn btn-danger' : 'btn btn-primary',
        type: 'button',
        text: confirmLabel,
        onClick: () => close(true),
      }),
    ],
  })).then(Boolean);
}
