import { api, eur, frDate } from './api.js';
import { h, mount, field, modal, toast, confirmDialog } from './ui.js';
import { openAddProvider, openEditProvider } from './providers.js';
import { renderQuoteView } from './quote.js';

const root = document.getElementById('view');
let teardown = null;

function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

/* ------------------------------------------------------- liste clients */

async function viewClients() {
  const clients = await api.listClients();

  const openNewClient = () =>
    modal((close) => {
      const first = h('input', { type: 'text', placeholder: 'Marie' });
      const last = h('input', { type: 'text', placeholder: 'Dupont' });
      const email = h('input', { type: 'email', placeholder: 'marie.dupont@exemple.fr' });
      const phone = h('input', { type: 'tel', placeholder: '06 12 34 56 78' });
      const notes = h('textarea', { placeholder: 'Informations utiles sur le dossier' });

      const save = async () => {
        if (!last.value.trim() && !first.value.trim()) {
          toast('Renseignez au moins un nom');
          return;
        }
        const client = await api.createClient({
          firstName: first.value.trim(),
          lastName: last.value.trim(),
          email: email.value.trim(),
          phone: phone.value.trim(),
          notes: notes.value.trim(),
        });
        close(client);
      };

      return {
        title: 'Nouveau dossier client',
        body: [field('Prénom', first), field('Nom', last), field('E-mail', email), field('Téléphone', phone), field('Notes', notes)],
        footer: [
          h('button', { class: 'btn', type: 'button', text: 'Annuler', onClick: () => close(undefined) }),
          h('button', { class: 'btn btn-primary', type: 'button', text: 'Créer le dossier', onClick: save }),
        ],
      };
    }).then((client) => {
      if (client) navigate(`#/client/${client.id}`);
    });

  mount(root,
    h('div', { class: 'page-head' }, [
      h('div', {}, [
        h('h1', { text: 'Dossiers clients' }),
        h('p', { text: `${clients.length} dossier${clients.length > 1 ? 's' : ''}` }),
      ]),
      h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, [
        h('button', { class: 'btn', type: 'button', text: 'Ajouter un prestataire', onClick: () => openAddProvider() }),
        h('button', { class: 'btn', type: 'button', text: 'Modifier un prestataire', onClick: () => openEditProvider() }),
        h('button', { class: 'btn btn-primary', type: 'button', text: '+ Nouveau dossier client', onClick: openNewClient }),
      ]),
    ]),

    clients.length
      ? h(
          'div',
          { class: 'client-grid' },
          clients.map((client) =>
            h('button', { class: 'client-card', type: 'button', onClick: () => navigate(`#/client/${client.id}`) }, [
              h('strong', { text: `${client.firstName} ${client.lastName}`.trim() || 'Sans nom' }),
              h('div', { class: 'meta', text: client.email || client.phone || '—' }),
              h('div', { class: 'meta', style: 'margin-top:8px', text: `${client.quoteCount} devis` }),
            ]),
          ),
        )
      : h('div', { class: 'empty', text: 'Aucun dossier client. Créez le premier avec le bouton ci-dessus.' }),
  );
}

/* ------------------------------------------------------- dossier client */

async function viewClient(clientId) {
  const [client, groups] = await Promise.all([api.getClient(clientId), api.listQuotes(clientId)]);

  const createQuote = async () => {
    const quote = await api.createQuote(clientId, {
      header: { firstName: client.firstName, lastName: client.lastName },
    });
    navigate(`#/quote/${quote.id}`);
  };

  const removeClient = async () => {
    const ok = await confirmDialog(`Supprimer le dossier de ${client.firstName} ${client.lastName} et tous ses devis ?`);
    if (!ok) return;
    await api.deleteClient(clientId);
    toast('Dossier supprimé');
    navigate('#/clients');
  };

  const quotesHost = groups.length
    ? h(
        'div',
        {},
        groups.map((group) =>
          h('article', { class: 'quote-group' }, [
            h('header', {}, [
              h('span', { text: group.versions[0].title || 'Devis sans intitulé' }),
              h('span', { class: 'tag', text: `${group.versions.length} version${group.versions.length > 1 ? 's' : ''}` }),
            ]),
            ...group.versions.map((version) =>
              h('div', { class: 'quote-row' }, [
                h('span', { class: version.editable ? 'tag tag-live' : 'tag', text: `V${version.version}` }),
                h('div', { class: 'grow' }, [
                  h('div', { style: 'font-weight:600', text: version.title || 'Devis' }),
                  h('div', { style: 'font-size:12px;color:var(--ink-soft)', text: [
                    version.startDate ? `${frDate(version.startDate)} → ${frDate(version.endDate)}` : 'Dates à définir',
                    `créée le ${new Date(version.createdAt).toLocaleDateString('fr-FR')}`,
                  ].join(' · ') }),
                ]),
                h('strong', { style: 'font-variant-numeric:tabular-nums', text: eur(version.total) }),
                h('button', { class: 'btn btn-sm', type: 'button', text: version.editable ? 'Ouvrir' : 'Consulter', onClick: () => navigate(`#/quote/${version.id}`) }),
              ]),
            ),
          ]),
        ),
      )
    : h('div', { class: 'empty', text: 'Aucun devis pour ce client. Créez le premier avec « Créer un nouveau devis ».' });

  mount(root,
    h('div', { class: 'breadcrumb' }, [
      h('a', { href: '#/clients', text: '← Dossiers clients' }),
      h('span', { text: '/' }),
      h('span', { text: `${client.firstName} ${client.lastName}`.trim() }),
    ]),

    h('div', { class: 'page-head' }, [
      h('div', {}, [
        h('h1', { text: `${client.firstName} ${client.lastName}`.trim() || 'Dossier client' }),
        h('p', { text: [client.email, client.phone].filter(Boolean).join(' · ') || 'Aucun contact renseigné' }),
      ]),
      h('button', { class: 'btn btn-danger', type: 'button', text: 'Supprimer le dossier', onClick: removeClient }),
    ]),

    h('div', { class: 'actions-bar' }, [
      h('button', { class: 'btn', type: 'button', text: 'Ajouter un prestataire', onClick: () => openAddProvider() }),
      h('button', { class: 'btn', type: 'button', text: 'Modifier un prestataire', onClick: () => openEditProvider() }),
      h('button', { class: 'btn btn-primary', type: 'button', text: 'Créer un nouveau devis', onClick: createQuote }),
    ]),

    client.notes ? h('div', { class: 'card card-pad', style: 'margin-bottom:18px' }, [h('p', { style: 'margin:0', text: client.notes })]) : null,

    h('h2', { style: 'font-size:16px;margin-bottom:12px', text: 'Devis' }),
    quotesHost,
  );
}

/* ------------------------------------------------------------ un devis */

async function viewQuote(quoteId) {
  const quote = await api.getQuote(quoteId);
  teardown = renderQuoteView(root, {
    quote,
    client: quote.client,
    onReload: (id) => navigate(`#/quote/${id}`),
  });
}

/* ------------------------------------------------------------- routing */

async function render() {
  teardown?.();
  teardown = null;

  const [, section, id] = location.hash.split('/');
  try {
    if (section === 'client' && id) await viewClient(id);
    else if (section === 'quote' && id) await viewQuote(id);
    else await viewClients();
  } catch (err) {
    mount(root, h("div", { class: "empty", text: err.message }));
  }
}

document.getElementById('logout').addEventListener('click', async () => {
  await api.logout();
  location.replace('index.php');
});

window.addEventListener('hashchange', render);
if (!location.hash) location.hash = '#/clients';
render();
