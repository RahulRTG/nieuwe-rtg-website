'use strict';

const HYPOTHESEN = ['vraag', 'prijs', 'capaciteit', 'aanbod', 'arbeid', 'liquiditeit', 'productiviteit'];
const MAATREGELEN = ['prijs-verlagen', 'prijs-verhogen', 'capaciteit-uitbreiden', 'loon-verhogen', 'training-investeren', 'voorraad-verhogen', 'kredietbuffer', 'niets'];
const RICHTINGEN = ['stijgt', 'daalt', 'gelijk'];
const INDICATOREN = [
  ['vraag', 'Vraag', 'eenheden'], ['verkoop', 'Verkoop', 'eenheden'],
  ['capaciteit', 'Capaciteit', 'eenheden'], ['benutting', 'Benutting', '%'],
  ['levergraad', 'Levergraad', '%'], ['voorraad', 'Voorraad', 'eenheden'],
  ['kasbuffer', 'Kasbuffer', 'dagen'], ['schuld', 'Schuld', 'cent'],
  ['marge', 'Nettomarge', '%'], ['marktaandeel', 'Marktaandeel', '%'],
  ['werkloosheid', 'Werkloosheid', '%'], ['inflatie', 'Inflatie', '%'], ['rente', 'Rente', '%']
];
const RELEVANT = {
  vraag: ['vraag', 'verkoop', 'capaciteit', 'benutting', 'marktaandeel'],
  prijs: ['vraag', 'verkoop', 'marge', 'marktaandeel'],
  capaciteit: ['vraag', 'verkoop', 'capaciteit', 'benutting'],
  aanbod: ['levergraad', 'voorraad', 'verkoop', 'vraag'],
  arbeid: ['benutting', 'werkloosheid', 'capaciteit', 'marge'],
  liquiditeit: ['kasbuffer', 'schuld', 'marge', 'rente'],
  productiviteit: ['capaciteit', 'benutting', 'marge', 'verkoop']
};
const PASSEND = {
  vraag: ['prijs-verlagen', 'training-investeren', 'niets'],
  prijs: ['prijs-verlagen', 'prijs-verhogen', 'niets'],
  capaciteit: ['capaciteit-uitbreiden', 'training-investeren', 'niets'],
  aanbod: ['voorraad-verhogen', 'niets'],
  arbeid: ['loon-verhogen', 'training-investeren', 'niets'],
  liquiditeit: ['kredietbuffer', 'prijs-verhogen', 'niets'],
  productiviteit: ['training-investeren', 'capaciteit-uitbreiden', 'niets']
};

const getal = (n, d = 0) => Number.isFinite(Number(n)) ? Number(n) : d;
const rond = n => Math.round(getal(n));
const begrens = (n, min, max) => Math.min(max, Math.max(min, getal(n)));
const cent = n => rond(getal(n) * 100);
const pct = n => Number(getal(n).toFixed(2));
const tekst = (v, max) => String(v || '').trim().slice(0, max);

function zorgStaat(e) {
  if (!e.economen || typeof e.economen !== 'object') e.economen = {};
  if (!e.economen.analyses || typeof e.economen.analyses !== 'object') e.economen.analyses = {};
  return e.economen;
}
function rekeningSaldo(e, code) { return e.rekeningen && e.rekeningen[code] ? rond(e.rekeningen[code].saldo) : 0; }
function somRekeningen(e, actor, soort) {
  return Object.values(e.rekeningen || {}).filter(r => r.actor === actor && r.soort === soort)
    .reduce((t, r) => t + rond(r.saldo), 0);
}

module.exports = { HYPOTHESEN, MAATREGELEN, RICHTINGEN, INDICATOREN, RELEVANT, PASSEND,
  getal, rond, begrens, cent, pct, tekst, zorgStaat, rekeningSaldo, somRekeningen };
