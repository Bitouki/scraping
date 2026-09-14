import { api, usd } from './api.js';
import { h, field, modal, toast, confirmDialog } from './ui.js';

const SUGGESTED_TYPES = [
  'Chauffeur',
  'Transfert',
  'Hôtel',
  'Guide',
  'Accueil / Assistance',
  'Activité',
  'Excursion',
  'Repas',
  'Vol interne',
  'Train',
  'Entrée / Ticket',
  'Autre',
];

function datalist(id, values) {
  return h('datalist', { id }, values.map((v) => h('option', { value: v })));
}

function providerForm(provider, facets) {
  const types = [...new Set([...SUGGESTED_TYPES, ...facets.types])];
  const typeInput = h('input', { type: 'text', list: 'dl-types', placeholder: 'Chauffeur, Hôtel…', value: provider?.type || '' });
  const nameInput = h('input', { type: 'text', placeholder: 'Nom du prestataire', value: provider?.name || '' });
  const cityInput = h('input', { type: 'text', list: 'dl-cities', placeholder: 'Lima, Cusco…', value: provider?.city || '' });
  const priceInput = h('input', { type: 'number', min: '0', step: '0.01', placeholder: '0.00', value: provider?.priceUsd ?? '' });
  const notesInput = h('textarea', { placeholder: 'Précisions internes (facultatif)' });
  notesInput.value = provider?.notes || '';

  const body = [
    datalist('dl-types', types),
    datalist('dl-cities', facets.cities),
    field('Prestataire (type)', typeInput),
    field('Nom du prestataire', nameInput),
    field('Ville', cityInput),
    field('Prix (USD)', priceInput),
    field('Notes', notesInput),
  ];

  const read = () => ({
    type: typeInput.value.trim(),
    name: nameInput.value.trim(),
    city: cityInput.value.trim(),
    priceUsd: Number(priceInput.value) || 0,
    notes: notesInput.value.trim(),
  });

  const validate = () => {
    const data = read();
    if (!data.name) {
      toast('Le nom du prestataire est obligatoire');
      nameInput.focus();
      return null;
    }
    if (!data.city) {
      toast('La ville est obligatoire');
      cityInput.focus();
      return null;
    }
    return data;
  };

  return { body, validate };
}

/** Popup « Ajouter un prestataire ». */
export async function openAddProvider(prefill = {}) {
  const { facets } = await api.listProviders();

  return modal((close) => {
    const { body, validate } = providerForm(prefill, facets);

    const save = async () => {
      const data = validate();
      if (!data) return;
      const created = await api.createProvider(data);
      toast(`${created.name} enregistré`);
      close(created);
    };

    return {
      title: 'Ajouter un prestataire',
      body,
      footer: [
        h('button', { class: 'btn', type: 'button', text: 'Annuler', onClick: () => close(undefined) }),
        h('button', { class: 'btn btn-primary', type: 'button', text: 'Ajouter', onClick: save }),
      ],
    };
  });
}

/**
 * Searchable provider list used by both « Modifier un prestataire » and the
 * picker inside a quote. onPick receives the chosen provider.
 */
function searchPanel({ onPick, emptyLabel }) {
  const searchInput = h('input', { type: 'search', placeholder: 'Rechercher un prestataire…' });
  const typeSelect = h('select', {}, [h('option', { value: '', text: 'Tous les types' })]);
  const citySelect = h('select', {}, [h('option', { value: '', text: 'Toutes les villes' })]);
  const results = h('div', { class: 'result-list' });

  let timer = null;

  const refresh = async () => {
    const { providers, facets } = await api.listProviders({
      search: searchInput.value,
      type: typeSelect.value,
      city: citySelect.value,
    });

    syncOptions(typeSelect, facets.types, 'Tous les types');
    syncOptions(citySelect, facets.cities, 'Toutes les villes');

    results.replaceChildren();
    if (!providers.length) {
      results.append(h('div', { class: 'empty', style: 'border:none', text: emptyLabel }));
      return;
    }
    for (const provider of providers) {
      results.append(
        h('button', { class: 'result-item', type: 'button', onClick: () => onPick(provider, refresh) }, [
          h('div', { class: 'grow' }, [
            h('div', { class: 'name', text: provider.name }),
            h('div', { class: 'sub', text: `${provider.type || 'Sans type'} · ${provider.city}` }),
          ]),
          h('div', { class: 'price', text: usd(provider.priceUsd) }),
        ]),
      );
    }
  };

  const debounced = () => {
    clearTimeout(timer);
    timer = setTimeout(refresh, 180);
  };

  searchInput.addEventListener('input', debounced);
  typeSelect.addEventListener('change', refresh);
  citySelect.addEventListener('change', refresh);

  const body = [
    h('div', { class: 'filter-row' }, [searchInput, typeSelect, citySelect]),
    results,
  ];

  refresh();
  return { body, refresh };
}

function syncOptions(select, values, placeholder) {
  const current = select.value;
  select.replaceChildren(h('option', { value: '', text: placeholder }));
  for (const value of values) select.append(h('option', { value, text: value }));
  select.value = values.includes(current) ? current : '';
}

/** Popup « Modifier un prestataire » : recherche avec filtres puis édition. */
export function openEditProvider() {
  return modal(
    (close) => {
      const panel = searchPanel({
        emptyLabel: 'Aucun prestataire ne correspond à cette recherche.',
        onPick: async (provider, refresh) => {
          const updated = await openProviderEditor(provider);
          if (updated) refresh();
        },
      });

      return {
        title: 'Modifier un prestataire',
        body: [
          h('p', { class: 'sub', style: 'margin:0;color:var(--ink-soft);font-size:13px', text: 'Recherchez un prestataire puis cliquez dessus pour le modifier.' }),
          ...panel.body,
        ],
        footer: [h('button', { class: 'btn', type: 'button', text: 'Fermer', onClick: () => close(undefined) })],
      };
    },
    { wide: true },
  );
}

async function openProviderEditor(provider) {
  const { facets } = await api.listProviders();

  return modal((close) => {
    const { body, validate } = providerForm(provider, facets);

    const save = async () => {
      const data = validate();
      if (!data) return;
      const updated = await api.updateProvider(provider.id, data);
      toast(`${updated.name} mis à jour`);
      close(updated);
    };

    const remove = async () => {
      const ok = await confirmDialog(`Supprimer définitivement « ${provider.name} » du catalogue ?`);
      if (!ok) return;
      await api.deleteProvider(provider.id);
      toast('Prestataire supprimé');
      close({ deleted: true });
    };

    return {
      title: `Modifier — ${provider.name}`,
      body,
      footer: [
        h('button', { class: 'btn btn-danger', type: 'button', text: 'Supprimer', onClick: remove }),
        h('div', { style: 'flex:1' }),
        h('button', { class: 'btn', type: 'button', text: 'Annuler', onClick: () => close(undefined) }),
        h('button', { class: 'btn btn-primary', type: 'button', text: 'Enregistrer', onClick: save }),
      ],
    };
  });
}

/** Popup de sélection d'un prestataire pour une journée du devis. */
export function pickProvider() {
  return modal(
    (close) => {
      const panel = searchPanel({
        emptyLabel: 'Aucun prestataire. Ajoutez-en un avec le bouton ci-dessous.',
        onPick: (provider) => close(provider),
      });

      const createNew = async () => {
        const created = await openAddProvider();
        if (created) close(created);
      };

      return {
        title: 'Ajouter un prestataire à cette journée',
        body: panel.body,
        footer: [
          h('button', { class: 'btn', type: 'button', text: '+ Nouveau prestataire', onClick: createNew }),
          h('div', { style: 'flex:1' }),
          h('button', { class: 'btn', type: 'button', text: 'Fermer', onClick: () => close(undefined) }),
        ],
      };
    },
    { wide: true },
  );
}
