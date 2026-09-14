import { api, usd, eur, frDate } from './api.js';
import { h } from './ui.js';

const params = new URLSearchParams(location.search);
const quoteId = params.get('quote');
const kind = params.get('doc') === 'itineraire' ? 'itineraire' : 'devis';

const sheet = document.getElementById('sheet');
const quote = await api.getQuote(quoteId);
const { header, days, totals, client } = quote;

const fullName = `${header.firstName || client.firstName} ${header.lastName || client.lastName}`.trim();
const tripDates = header.startDate ? `${frDate(header.startDate)} — ${frDate(header.endDate)}` : 'Dates à confirmer';

document.title = `${kind === 'devis' ? 'Devis' : 'Itinéraire'} — ${fullName || 'client'}`;

function docHead() {
  return h('div', { class: 'doc-head' }, [
    h('div', {}, [
      h('div', { class: 'agency', text: window.AGENCY_NAME || 'Graine de Voyageur' }),
      h('div', { class: 'kind', text: kind === 'devis' ? `Devis interne — version ${quote.version}` : 'Votre itinéraire' }),
    ]),
    h('div', { class: 'client' }, [
      h('div', { class: 'name', text: fullName || '—' }),
      h('div', { class: 'muted', text: tripDates }),
    ]),
  ]);
}

function dayHeading(day, index) {
  return h('div', { class: 'day-title' }, [
    h('span', { class: 'num', text: `Jour ${index + 1}` }),
    h('span', { class: 'place', text: day.city || day.title || '' }),
    h('span', { class: 'date', text: day.date ? frDate(day.date) : '' }),
  ]);
}

/* ------------------------------------------------------ devis complet */

function renderDevis() {
  const blocks = days.map((day, index) => {
    const subtotal = day.items.reduce((s, it) => s + (Number(it.priceUsd) || 0) * (Number(it.quantity) || 1), 0);

    return h('section', { class: 'day' }, [
      dayHeading(day, index),
      day.items.length
        ? h('table', {}, [
            h('thead', {}, [
              h('tr', {}, [
                h('th', { text: 'Prestataire' }),
                h('th', { text: 'Ville' }),
                h('th', { class: 'num', text: 'Prix USD' }),
                h('th', { class: 'num', text: 'Qté' }),
                h('th', { class: 'num', text: 'Total USD' }),
              ]),
            ]),
            h('tbody', {}, [
              ...day.items.map((item) =>
                h('tr', {}, [
                  h('td', {}, [item.name, item.type ? h('span', { style: 'color:#6b7671', text: ` — ${item.type}` }) : null]),
                  h('td', { text: item.city }),
                  h('td', { class: 'num', text: usd(item.priceUsd) }),
                  h('td', { class: 'num', text: String(item.quantity || 1) }),
                  h('td', { class: 'num', text: usd((Number(item.priceUsd) || 0) * (Number(item.quantity) || 1)) }),
                ]),
              ),
              h('tr', { class: 'subtotal' }, [
                h('td', { colspan: '4', class: 'num', text: 'Sous-total journée' }),
                h('td', { class: 'num', text: usd(subtotal) }),
              ]),
            ]),
          ])
        : h('p', { class: 'desc', style: 'color:#6b7671', text: 'Aucun prestataire sur cette journée.' }),
    ]);
  });

  const rate = Number(header.exchangeRate) || 0;

  return [
    docHead(),
    h('h1', { class: 'trip-title', text: header.title || 'Programme détaillé' }),
    ...blocks,
    h('div', { class: 'totals-box' }, [
      h('div', { class: 'row' }, [h('span', { text: 'Total prestations USD' }), h('span', { text: usd(totals.totalUsd) })]),
      h('div', { class: 'row muted' }, [h('span', { text: `Taux appliqué — 1 USD` }), h('span', { text: eur(rate) })]),
      h('div', { class: 'row' }, [h('span', { text: 'Total EUR brut' }), h('span', { text: eur(totals.grossEur) })]),
      h('div', { class: 'row muted' }, [h('span', { text: `Marge ${totals.marginPct} %` }), h('span', { text: eur(totals.marginEur) })]),
      h('div', { class: 'row final' }, [h('span', { text: 'Prix de vente EUR' }), h('span', { text: eur(totals.finalEur) })]),
      h('div', { class: 'row per-person' }, [h('span', { text: `Prix par personne (× ${totals.travelers})` }), h('span', { text: eur(totals.finalPerPerson) })]),
    ]),
    h('div', { class: 'foot-note', text: `Document interne — version ${quote.version} éditée le ${new Date().toLocaleDateString('fr-FR')}. Ne pas transmettre au client.` }),
  ];
}

/* -------------------------------------------- itinéraire client (sans prix) */

function renderItineraire() {
  const blocks = days.map((day, index) =>
    h('section', { class: 'day' }, [
      dayHeading(day, index),
      day.title && day.title !== day.city ? h('p', { class: 'desc', style: 'font-weight:600', text: day.title }) : null,
      day.description ? h('p', { class: 'desc', text: day.description }) : null,
      day.activities.length ? h('ul', {}, day.activities.map((activity) => h('li', { text: activity }))) : null,
      day.hotel ? h('p', { class: 'hotel' }, [h('strong', { text: 'Hébergement : ' }), day.hotel]) : null,
    ]),
  );

  return [
    docHead(),
    h('h1', { class: 'trip-title', text: header.title || 'Votre programme de voyage' }),
    ...blocks,
    h('div', { class: 'foot-note', text: 'Programme susceptible d’ajustements selon les conditions locales.' }),
  ];
}

sheet.replaceChildren(...(kind === 'devis' ? renderDevis() : renderItineraire()));

document.getElementById('print').addEventListener('click', () => window.print());
document.getElementById('switch').textContent = kind === 'devis' ? 'Voir l’itinéraire client' : 'Voir le devis complet';
document.getElementById('switch').href = `print.php?quote=${quoteId}&doc=${kind === 'devis' ? 'itineraire' : 'devis'}`;
