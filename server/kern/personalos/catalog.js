/* Adapter tussen de zichtbare appcatalogus en de bestaande Authority Engine.
   Dit is geen tweede catalogus: naam, wereld en URL komen uit de gegenereerde
   sprongindex; de koppeltabel zegt alleen welke bestaande functieschakelaar de
   zichtbaarheid van een capability begrenst. */
'use strict';

const bron = require('../../../public/shared/sprongindex.json').items;
const { OP_ID } = require('../../functies/register');
const { blokkadeReden, tierNaarDoelgroep } = require('../../functies/toegang');

const BINDINGS = Object.freeze({
  leven: 'levenos', berichten: 'kern-berichten', sociaal: 'socialewereld', geldcommand: 'geldwereld',
  reizen: 'dom-reisbureau', ov: 'ov', flits: 'flits', onderneming: 'ondernemersos',
  loopbaan: 'carriereledger', werkos: 'bedrijf', foundationzorg: 'dom-care',
  connect: 'connect', library: 'dom-library', podium: 'podium', theater: 'theater', commerce: 'commerce'
});

const geselecteerd = Object.keys(BINDINGS).map(id => {
  const r = bron.find(x => x.sleutel === id && x.url) || bron.find(x => x.sleutel === id);
  if (!r) throw new Error('PersonalOS: capability ontbreekt in sprongindex: ' + id);
  if (!OP_ID[BINDINGS[id]]) throw new Error('PersonalOS: functieschakelaar ontbreekt: ' + BINDINGS[id]);
  return Object.freeze({ id, name: r.naam, world: String(r.wereld || '').toLowerCase(),
    url: r.url || '/apps/app.html#' + id, authorityCapability: BINDINGS[id] });
});

function toegestaan({ tier, state, person }) {
  const doelgroep = tierNaarDoelgroep(tier);
  if (!doelgroep) return [];
  return geselecteerd.filter(c => {
    const f = OP_ID[c.authorityCapability];
    if (!f.doelgroepen.includes(doelgroep)) return false;
    return !blokkadeReden(f.id, state || {}, { doelgroep, persoon: person });
  }).map(c => ({ ...c }));
}

function preview() {
  return geselecteerd.map(c => ({ id: c.id, name: c.name, world: c.world, url: c.url,
    availability: 'preview_only' }));
}

module.exports = { BINDINGS, allIds: () => geselecteerd.map(x => x.id), toegestaan, preview };
