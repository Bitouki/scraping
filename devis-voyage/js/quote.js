import { api, usd, eur } from './api.js';
import { h, mount, field, toast, confirmDialog } from './ui.js';
import { pickProvider } from './providers.js';

const MARGIN_CHOICES = [0, 5, 10, 15, 20];
const uid = () => crypto.randomUUID();

export function computeTotals(quote) {
  const rate = Number(quote.header.exchangeRate) || 0;
  const margin = Number(quote.header.marginPct) || 0;
  const totalUsd = quote.days.reduce(
    (sum, day) => sum + day.items.reduce((s, it) => s + (Number(it.priceUsd) || 0) * (Number(it.quantity) || 1), 0),
    0,
  );
  const grossEur = totalUsd * rate;
  const marginEur = grossEur * (margin / 100);
  return { totalUsd, grossEur, marginEur, finalEur: grossEur + marginEur, marginPct: margin };
}

export function renderQuoteView(root, { quote, client, onReload }) {
  const state = structuredClone(quote);
  let dirty = false;

  const markDirty = () => {
    dirty = true;
    saveBtn.disabled = false;
    saveBtn.textContent = 'Enregistrer *';
  };

  const daysHost = h('div', {});
  const totalsHost = h('div', { class: 'totals-inner' });

  const saveBtn = h('button', {
    class: 'btn btn-primary',
    type: 'button',
    text: 'Enregistrer',
    disabled: true,
    onClick: () => save(),
  });

  async function save({ silent = false } = {}) {
    if (!state.editable) return true;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Enregistrement…';
    try {
      await api.saveQuote(state.id, { header: state.header, days: state.days });
      dirty = false;
      saveBtn.textContent = 'Enregistré';
      if (!silent) toast('Devis enregistré');
      return true;
    } catch (err) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Enregistrer *';
      toast(err.message);
      return false;
    }
  }

  async function openPrint(kind) {
    if (state.editable && dirty && !(await save({ silent: true }))) return;
    window.open(`print.php?quote=${state.id}&doc=${kind}`, '_blank', 'noopener');
  }

  async function newVersion() {
    if (state.editable && dirty) await save({ silent: true });
    const created = await api.branchQuote(state.id);
    toast(`Version ${created.version} créée`);
    onReload(created.id);
  }

  /* ------------------------------------------------------------- header */

  const headerInput = (key, attrs) => {
    const input = h('input', { ...attrs, value: state.header[key] ?? '' });
    input.addEventListener('input', () => {
      state.header[key] = attrs.type === 'number' ? Number(input.value) : input.value;
      markDirty();
      renderTotals();
    });
    input.disabled = !state.editable;
    return input;
  };

  const marginSelect = h(
    'select',
    { disabled: !state.editable },
    MARGIN_CHOICES.map((pct) =>
      h('option', { value: String(pct), text: pct === 0 ? 'Sans marge' : `+ ${pct} %`, selected: Number(state.header.marginPct) === pct }),
    ),
  );
  marginSelect.addEventListener('change', () => {
    state.header.marginPct = Number(marginSelect.value);
    markDirty();
    renderTotals();
  });

  const headerCard = h('section', { class: 'card card-pad', style: 'margin-bottom:22px' }, [
    h('div', { class: 'section-label' }, [h('span', { text: 'Entête du devis' })]),
    h('div', { class: 'field-grid' }, [
      field('Prénom du client', headerInput('firstName', { type: 'text' })),
      field('Nom du client', headerInput('lastName', { type: 'text' })),
      field('Départ', headerInput('startDate', { type: 'date' })),
      field('Retour', headerInput('endDate', { type: 'date' })),
      field('Taux — 1 USD = ? EUR', headerInput('exchangeRate', { type: 'number', min: '0', step: '0.0001' })),
      field('Marge appliquée', marginSelect),
    ]),
    h('div', { style: 'margin-top:14px' }, [field('Intitulé du voyage', headerInput('title', { type: 'text', placeholder: 'Pérou — 10 jours' }))]),
  ]);

  /* --------------------------------------------------------------- days */

  function renderDays() {
    daysHost.replaceChildren();

    if (!state.days.length) {
      daysHost.append(h('div', { class: 'empty', text: 'Aucune journée. Commencez par ajouter le jour 1 du voyage.' }));
    }

    state.days.forEach((day, index) => daysHost.append(renderDay(day, index)));

    if (state.editable) {
      daysHost.append(
        h('button', {
          class: 'btn btn-primary',
          type: 'button',
          text: `+ Ajouter le jour ${state.days.length + 1}`,
          onClick: () => {
            state.days.push({ id: uid(), date: '', city: '', title: '', description: '', hotel: '', activities: [], items: [] });
            markDirty();
            renderDays();
          },
        }),
      );
    }
  }

  function dayInput(day, key, attrs, onInput) {
    const tag = attrs.multiline ? 'textarea' : 'input';
    const node = h(tag, { ...attrs, multiline: null });
    node.value = day[key] ?? '';
    node.disabled = !state.editable;
    node.addEventListener('input', () => {
      day[key] = node.value;
      markDirty();
      onInput?.();
    });
    return node;
  }

  function renderDay(day, index) {
    const itemsBody = h('tbody', {});
    const dayLabel = h('strong', { style: 'flex:1' });
    const syncLabel = () => {
      dayLabel.textContent = day.city || day.title || 'Journée à compléter';
    };
    syncLabel();

    const renderItems = () => {
      itemsBody.replaceChildren();

      if (!day.items.length) {
        itemsBody.append(
          h('tr', {}, [
            h('td', { colspan: state.editable ? '5' : '4', style: 'color:var(--ink-soft);padding:14px 10px', text: 'Aucun prestataire pour cette journée.' }),
          ]),
        );
      }

      for (const item of day.items) {
        const qtyInput = h('input', { type: 'number', min: '1', step: '1', value: item.quantity || 1, style: 'width:70px', disabled: !state.editable });
        qtyInput.addEventListener('input', () => {
          item.quantity = Math.max(1, Number(qtyInput.value) || 1);
          markDirty();
          renderLineTotal();
          renderTotals();
        });

        const priceInput = h('input', { type: 'number', min: '0', step: '0.01', value: item.priceUsd, style: 'width:110px', disabled: !state.editable });
        priceInput.addEventListener('input', () => {
          item.priceUsd = Number(priceInput.value) || 0;
          markDirty();
          renderLineTotal();
          renderTotals();
        });

        const lineTotal = h('td', { class: 'num' });
        const renderLineTotal = () => {
          lineTotal.textContent = usd((Number(item.priceUsd) || 0) * (Number(item.quantity) || 1));
        };
        renderLineTotal();

        itemsBody.append(
          h('tr', {}, [
            h('td', {}, [
              h('div', { style: 'font-weight:600', text: item.name }),
              h('div', { style: 'font-size:12px;color:var(--ink-soft)', text: item.type || '—' }),
            ]),
            h('td', { text: item.city }),
            h('td', { class: 'num' }, [priceInput]),
            h('td', { class: 'num' }, [qtyInput]),
            lineTotal,
            state.editable
              ? h('td', { class: 'num' }, [
                  h('button', {
                    class: 'btn btn-icon btn-danger',
                    type: 'button',
                    text: '✕',
                    title: 'Retirer cette ligne',
                    onClick: () => {
                      day.items = day.items.filter((it) => it.id !== item.id);
                      markDirty();
                      renderItems();
                      renderTotals();
                    },
                  }),
                ])
              : null,
          ]),
        );
      }
    };

    renderItems();

    const activitiesHost = h('div', {});
    const renderActivities = () => {
      activitiesHost.replaceChildren();
      day.activities.forEach((activity, i) => {
        const input = h('input', { type: 'text', value: activity, placeholder: 'Visite guidée du centre historique…', disabled: !state.editable });
        input.addEventListener('input', () => {
          day.activities[i] = input.value;
          markDirty();
        });
        activitiesHost.append(
          h('div', { class: 'activity-row' }, [
            input,
            state.editable
              ? h('button', {
                  class: 'btn btn-icon btn-danger',
                  type: 'button',
                  text: '✕',
                  onClick: () => {
                    day.activities.splice(i, 1);
                    markDirty();
                    renderActivities();
                  },
                })
              : null,
          ]),
        );
      });
      if (!day.activities.length) {
        activitiesHost.append(h('p', { style: 'margin:0;color:var(--ink-soft);font-size:13px', text: 'Aucune activité renseignée.' }));
      }
    };
    renderActivities();

    const addProvider = async () => {
      const provider = await pickProvider();
      if (!provider) return;
      day.items.push({
        id: uid(),
        providerId: provider.id,
        type: provider.type,
        name: provider.name,
        city: provider.city,
        priceUsd: provider.priceUsd,
        quantity: 1,
      });
      markDirty();
      renderItems();
      renderTotals();
    };

    return h('section', { class: 'card day-card' }, [
      h('div', { class: 'day-head' }, [
        h('span', { class: 'day-badge', text: `J${index + 1}` }),
        dayLabel,
        state.editable
          ? h('button', {
              class: 'btn btn-sm btn-danger',
              type: 'button',
              text: 'Supprimer le jour',
              onClick: async () => {
                if (!(await confirmDialog(`Supprimer le jour ${index + 1} et ses ${day.items.length} ligne(s) ?`))) return;
                state.days.splice(index, 1);
                markDirty();
                renderDays();
                renderTotals();
              },
            })
          : null,
      ]),
      h('div', { class: 'day-body' }, [
        h('div', { class: 'field-grid' }, [
          field('Date', dayInput(day, 'date', { type: 'date' })),
          field('Ville / étape', dayInput(day, 'city', { type: 'text', placeholder: 'Lima' }, syncLabel)),
          field('Titre de la journée', dayInput(day, 'title', { type: 'text', placeholder: 'Arrivée à Lima' }, syncLabel)),
          field('Hôtel', dayInput(day, 'hotel', { type: 'text', placeholder: 'Hôtel Casa Andina — chambre double' })),
        ]),

        h('div', {}, [
          h('div', { class: 'section-label' }, [h('span', { text: 'Descriptif (itinéraire client)' })]),
          dayInput(day, 'description', { multiline: true, placeholder: "Accueil à l'aéroport, transfert vers l'hôtel, temps libre…" }),
        ]),

        h('div', {}, [
          h('div', { class: 'section-label' }, [
            h('span', { text: 'Activités (itinéraire client)' }),
            state.editable
              ? h('button', {
                  class: 'btn btn-sm',
                  type: 'button',
                  text: '+ Activité',
                  onClick: () => {
                    day.activities.push('');
                    markDirty();
                    renderActivities();
                  },
                })
              : null,
          ]),
          activitiesHost,
        ]),

        h('div', {}, [
          h('div', { class: 'section-label' }, [
            h('span', { text: 'Prestataires (devis interne)' }),
            state.editable ? h('button', { class: 'btn btn-sm btn-primary', type: 'button', text: '+ Ajouter un prestataire', onClick: addProvider }) : null,
          ]),
          h('div', { class: 'table-wrap' }, [
            h('table', {}, [
              h('thead', {}, [
                h('tr', {}, [
                  h('th', { text: 'Prestataire' }),
                  h('th', { text: 'Ville' }),
                  h('th', { class: 'num', text: 'Prix USD' }),
                  h('th', { class: 'num', text: 'Qté' }),
                  h('th', { class: 'num', text: 'Total USD' }),
                  state.editable ? h('th', { class: 'num', text: '' }) : null,
                ]),
              ]),
              itemsBody,
            ]),
          ]),
        ]),
      ]),
    ]);
  }

  /* ------------------------------------------------------------- totals */

  function renderTotals() {
    const t = computeTotals(state);
    totalsHost.replaceChildren(
      h('div', { class: 'total-block' }, [
        h('div', { class: 'total-item' }, [h('small', { text: 'Total USD' }), h('strong', { text: usd(t.totalUsd) })]),
        h('div', { class: 'total-item' }, [h('small', { text: 'Total EUR brut' }), h('strong', { text: eur(t.grossEur) })]),
        h('div', { class: 'total-item' }, [h('small', { text: `Marge ${t.marginPct} %` }), h('strong', { text: eur(t.marginEur) })]),
        h('div', { class: 'total-item final' }, [h('small', { text: 'Prix de vente EUR' }), h('strong', { text: eur(t.finalEur) })]),
      ]),
      h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, [
        h('button', { class: 'btn', type: 'button', text: 'PDF Itinéraire', onClick: () => openPrint('itineraire') }),
        h('button', { class: 'btn', type: 'button', text: 'PDF Devis', onClick: () => openPrint('devis') }),
        state.editable ? saveBtn : null,
      ]),
    );
  }

  /* --------------------------------------------------------------- mount */

  const versionLabel = h('span', { class: state.editable ? 'tag tag-live' : 'tag', text: `Version ${state.version}` });

  mount(root,
    h('div', { class: 'breadcrumb' }, [
      h('a', { href: '#/clients', text: '← Dossiers clients' }),
      h('span', { text: '/' }),
      h('a', { href: `#/client/${state.clientId}`, text: `${client.firstName} ${client.lastName}`.trim() || 'Dossier' }),
      h('span', { text: '/' }),
      h('span', { text: `Devis v${state.version}` }),
    ]),

    h('div', { class: 'page-head' }, [
      h('div', {}, [
        h('h1', {}, [state.header.title || 'Devis', ' ', versionLabel]),
        h('p', { text: `Créé le ${new Date(state.createdAt).toLocaleDateString('fr-FR')}` }),
      ]),
      h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, [
        h('button', { class: 'btn', type: 'button', text: 'Nouvelle version', onClick: newVersion }),
      ]),
    ]),

    state.editable
      ? null
      : h('div', { class: 'locked-banner' }, [
          h('span', { text: `Version ${state.version} archivée : elle reste figée telle qu'elle a été envoyée. Créez une nouvelle version pour modifier.` }),
          h('button', { class: 'btn btn-sm btn-primary', type: 'button', text: 'Créer une nouvelle version', onClick: newVersion }),
        ]),

    headerCard,
    daysHost,
  );

  renderDays();

  const totalsBar = h('div', { class: 'totals' }, [totalsHost]);
  document.body.append(totalsBar);
  renderTotals();

  return () => totalsBar.remove();
}
