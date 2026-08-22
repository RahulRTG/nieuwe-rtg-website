/* Snelle voorcontrole met de officiële KVK Basisprofiel-API. Dit vervangt het
   menselijke eindbesluit niet: de API toont geen Gegevens in Onderzoek (GIO),
   dus voor rechtszekerheid blijft een controle van een actueel uittreksel of
   ander geschikt KVK-product in de toelatingslijst staan. */
'use strict';

const { datum } = require('../lib/klok');

function canon(waarde) {
  return String(waarde || '').toLowerCase()
    .replace(/\b(bv|nv|vof|cv|stichting|vereniging|eenmanszaak)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function namenUit(data) {
  const uit = [data && data.naam, data && data.statutaireNaam];
  for (const h of (data && Array.isArray(data.handelsnamen) ? data.handelsnamen : []))
    uit.push(typeof h === 'string' ? h : (h && (h.naam || h.handelsnaam)));
  const hoofd = data && data._embedded && data._embedded.hoofdvestiging;
  if (hoofd) {
    uit.push(hoofd.eersteHandelsnaam);
    for (const h of (Array.isArray(hoofd.handelsnamen) ? hoofd.handelsnamen : []))
      uit.push(typeof h === 'string' ? h : (h && (h.naam || h.handelsnaam)));
  }
  return [...new Set(uit.map(x => String(x || '').trim()).filter(Boolean))].slice(0, 20);
}

function vestigingenUit(data) {
  const embedded = data && data._embedded || {};
  const hoofd = embedded.hoofdvestiging;
  const blok = embedded.vestigingen;
  const lijst = Array.isArray(blok) ? blok : (blok && Array.isArray(blok.vestigingen) ? blok.vestigingen : []);
  return [...new Set([hoofd && hoofd.vestigingsnummer, ...lijst.map(v => v && v.vestigingsnummer)]
    .map(String).filter(x => /^\d{12}$/.test(x)))];
}

function activiteitenUit(data) {
  const hoofd = data && data._embedded && data._embedded.hoofdvestiging;
  const lijst = [].concat(data && data.sbiActiviteiten || [], hoofd && hoofd.sbiActiviteiten || []);
  return lijst.map(x => ({ code: String(x && x.sbiCode || '').slice(0, 8),
    omschrijving: String(x && x.sbiOmschrijving || '').slice(0, 160), hoofd: !!(x && x.indHoofdactiviteit) }))
    .filter(x => x.code || x.omschrijving).slice(0, 30);
}

async function voorcontrole({ apiKey, kvkNummer, vestigingsnummer, company, fetchFn }) {
  if (!apiKey) return { status: 'handmatig', reden: 'KVK_API_KEY is niet ingesteld.' };
  const haal = fetchFn || global.fetch;
  if (typeof haal !== 'function') return { status: 'handmatig', reden: 'Geen HTTP-client beschikbaar.' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const url = 'https://api.kvk.nl/api/v1/basisprofielen/' + encodeURIComponent(kvkNummer);
    const res = await haal(url, { headers: { apikey: apiKey }, signal: controller.signal });
    if (res.status === 404) return { status: 'niet_gevonden' };
    if (!res.ok) return { status: 'handmatig', reden: 'KVK API gaf status ' + res.status + '.' };
    const data = await res.json();
    const namen = namenUit(data);
    const vestigingen = vestigingenUit(data);
    const doel = canon(company);
    const eind = data && data.materieleRegistratie && data.materieleRegistratie.einddatum;
    return {
      status: 'gevonden', actief: !eind,
      naamMatch: !!doel && namen.some(n => canon(n) === doel),
      vestigingMatch: vestigingen.includes(String(vestigingsnummer)),
      namen, vestigingen, activiteiten: activiteitenUit(data),
      gecontroleerdAt: datum().toISOString()
    };
  } catch (e) {
    return { status: 'handmatig', reden: e && e.name === 'AbortError' ? 'KVK API gaf niet op tijd antwoord.' : 'KVK API tijdelijk niet bereikbaar.' };
  } finally { clearTimeout(timer); }
}

module.exports = { voorcontrole, canon, namenUit, vestigingenUit };
