/* Zaakregie-context: alleen-lezen samenstelling van bestaande bronnen.

   `org`, WorkOS-werkruimte en concern-entiteit blijven afzonderlijke
   identifiers. De hoedanigheidsbronnen houden hun eigen levensloop. Dit beeld
   verleent daarom geen rechten en moet voor iedere handeling worden ververst. */
'use strict';

const B = require('./zaakregie-context/basis');
const maakOrganisatie = require('./zaakregie-context/organisatie');
const maakHoedanigheid = require('./zaakregie-context/hoedanigheid');

function leeg(status, spoor) {
  return B.diepBevries({ schemaVersion: 1, status,
    states: { organization: status, legalEntity: B.STATUS.NIET_BEOORDEELD,
      capacity: B.STATUS.NIET_BEOORDEELD },
    context: { tenant: null, workspace: null, legalEntity: null },
    relationships: [], capacities: [], provenance: spoor,
    readOnly: true, grantsAuthority: false, refreshBeforeAction: true });
}

function maakZaakregieContext(bronnen) {
  const organisatie = maakOrganisatie(bronnen);
  const hoedanigheid = maakHoedanigheid(bronnen);

  function projecteer(invoer) {
    const i = invoer || {};
    const accountRef = B.tekst(i.accountRef, 160);
    const workspaceRef = B.tekst(i.workspaceRef, 160);
    const spoor = [];
    if (!accountRef || !workspaceRef) {
      return leeg(B.STATUS.ONBEKEND, [{ source: 'zaakregie.context', state: 'onbekend',
        reason: !accountRef ? 'accountcontext-ontbreekt' : 'werkruimtecontext-ontbreekt' }]);
    }

    const org = organisatie.organisatie(accountRef, workspaceRef, spoor);
    if (org.status !== B.STATUS.BEKEND) return leeg(org.status, spoor);

    const con = organisatie.concern(accountRef, i.entityRef, spoor);
    const vr = hoedanigheid.vertegenwoordiging(accountRef, spoor);
    const sm = hoedanigheid.service(accountRef, i.caseRef, spoor);
    const status = con.status === B.STATUS.ONBEKEND ? B.STATUS.ONBEKEND : B.STATUS.BEKEND;
    const capacity = vr.status === B.STATUS.BEKEND && sm.status === B.STATUS.BEKEND
      ? B.STATUS.BEKEND : B.STATUS.ONBEKEND;
    return B.diepBevries({ schemaVersion: 1, status,
      states: { organization: org.status, legalEntity: con.status, capacity },
      context: { tenant: org.tenant, workspace: org.workspace, legalEntity: con.entity },
      relationships: con.relationships, capacities: vr.capacities.concat(sm.capacities), provenance: spoor,
      readOnly: true, grantsAuthority: false, refreshBeforeAction: true });
  }

  return Object.freeze({ projecteer });
}

module.exports = Object.freeze({ maakZaakregieContext, STATUS: B.STATUS });
