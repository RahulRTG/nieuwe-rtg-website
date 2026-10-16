/* Koppelt het bestaande Zaakregiebeeld uitsluitend aan reeds gebonden context.

   Deze adapter leest geen sessie en verleent geen bevoegdheid. De aanroeper moet
   de identiteit, WorkOS-werkruimte en bronzaak eerst bij zijn bestaande
   toegangsgrens binden. Ontbreekt die binding of wijkt de zaak af, dan blijft
   het beeld leesbaar maar de context gesloten. */
'use strict';

const B = require('./basis');
const standaardBeeld = require('../zaakregiebeeld');
const { maakZaakregieContext } = require('../zaakregie-context.js');

const SOORTEN = Object.freeze({
  account: 'rtg-account',
  workspace: 'workos-workspace',
  zaak: 'case-source',
  entiteit: 'concern-entity'
});

/*
 * @typedef {Object} GebondenReferentie
 * @property {string} kind       Vast referentietype uit SOORTEN.
 * @property {string} id         Identifier uit de bestaande bron.
 * @property {string} provenance Naam van de bestaande grens die hem bond.
 *
 * @typedef {Object} ZaakReferentie
 * @property {'case-source'} kind
 * @property {string} domain
 * @property {string} type
 * @property {string} id
 * @property {string} provenance
 *
 * @typedef {Object} ZaakregieBinding
 * @property {1} schemaVersion
 * @property {GebondenReferentie} account
 * @property {GebondenReferentie} workspace
 * @property {ZaakReferentie} case
 * @property {GebondenReferentie=} legalEntity
 */

function gesloten(status, reason) {
  return B.diepBevries({ schemaVersion: 1, status,
    states: { organization: status, legalEntity: B.STATUS.NIET_BEOORDEELD,
      capacity: B.STATUS.NIET_BEOORDEELD },
    context: { tenant: null, workspace: null, legalEntity: null },
    relationships: [], capacities: [],
    provenance: [{ source: 'zaakregie.binding', state: status, reason }],
    readOnly: true, grantsAuthority: false, refreshBeforeAction: true });
}

function referentie(ref, kind) {
  return !!ref && ref.kind === kind && !!B.tekst(ref.id, 160)
    && !!B.tekst(ref.provenance, 160);
}

function zaakPast(ref, source) {
  return referentie(ref, SOORTEN.zaak)
    && B.tekst(ref.domain, 60) === source.domain
    && B.tekst(ref.type, 60) === source.type
    && B.tekst(ref.id, 160) === source.id;
}

function leesBinding(bindingVanBron, view) {
  if (typeof bindingVanBron !== 'function')
    return { error: gesloten(B.STATUS.ONBEKEND, 'binding-resolver-ontbreekt') };
  let binding;
  try {
    binding = bindingVanBron(B.diepBevries({ kind: view.kind, source: view.source }));
  } catch (e) {
    return { error: gesloten(B.STATUS.ONBEKEND, 'binding-bron-onbeschikbaar') };
  }
  if (binding && typeof binding.then === 'function')
    return { error: gesloten(B.STATUS.ONBEKEND, 'asynchrone-binding-niet-ondersteund') };
  if (!binding || binding.schemaVersion !== 1
    || !referentie(binding.account, SOORTEN.account)
    || !referentie(binding.workspace, SOORTEN.workspace)
    || (binding.legalEntity && !referentie(binding.legalEntity, SOORTEN.entiteit))) {
    return { error: gesloten(B.STATUS.ONBEKEND, 'binding-onvolledig') };
  }
  if (!zaakPast(binding.case, view.source))
    return { error: gesloten(B.STATUS.CONFLICT, 'case-binding-wijkt-af') };
  return { binding };
}

function maakZaakregieContextAdapter(opties) {
  const o = opties || {};
  const context = maakZaakregieContext(o.bronnen);
  const beelden = o.beeld || standaardBeeld;

  function verbind(view) {
    const gelezen = leesBinding(o.bindingVanBron, view);
    const projectie = gelezen.error || context.projecteer({
      accountRef: gelezen.binding.account.id,
      workspaceRef: gelezen.binding.workspace.id,
      entityRef: gelezen.binding.legalEntity && gelezen.binding.legalEntity.id,
      caseRef: { domain: view.source.domain, id: view.source.id }
    });
    return B.diepBevries(Object.assign({}, view, { context: projectie }));
  }

  return Object.freeze({
    bureau: zaak => verbind(beelden.bureau(zaak)),
    service: zaak => verbind(beelden.service(zaak))
  });
}

module.exports = Object.freeze({ maakZaakregieContextAdapter, SOORTEN });
