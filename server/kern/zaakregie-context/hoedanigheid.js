/* Hoedanigheden blijven bronrecords. Deze lezer voegt vertegenwoordiging en
   servicemachtiging niet samen en projecteert uitsluitend actieve, passende
   relaties. De bestaande namensprojectie levert de herkomsttaal. */
'use strict';

const B = require('./basis');
const namens = require('../namens/projectie');
const DOEL = 'ZAAKREGIE.CONTEXT';

module.exports = function maakHoedanigheid(bronnen) {
  const b = bronnen || {};

  function vertegenwoordiging(accountRef, spoor) {
    const gelezen = B.bronLees(b.vertegenwoordigingMijn, [accountRef]);
    if (!gelezen.ok) {
      spoor.push({ source: 'vertegenwoordiging', state: 'onbekend', reason: gelezen.reason });
      return { status: B.STATUS.ONBEKEND, capacities: [] };
    }
    const rijen = gelezen.value && Array.isArray(gelezen.value.ikSta) ? gelezen.value.ikSta : null;
    if (!rijen) {
      spoor.push({ source: 'vertegenwoordiging', state: 'onbekend', reason: 'onleesbare-bron' });
      return { status: B.STATUS.ONBEKEND, capacities: [] };
    }
    const capacities = [];
    let malformed = false;
    for (const r of rijen) {
      if (!r || r.stand !== 'actief') {
        spoor.push({ source: 'vertegenwoordiging', state: 'genegeerd', reason: 'machtiging-niet-actief' });
        continue;
      }
      const p = namens.projecteerNamens({ mechanism: 'vertegenwoordiging', principalRef: r.wie,
        actingRef: accountRef, authorityRef: r.id, purpose: DOEL });
      if (!p.projectie || namens.zelfprojectie(p.projectie)) {
        malformed = true;
        spoor.push({ source: 'vertegenwoordiging', state: 'onbekend',
          reason: p.error || 'zelfvertegenwoordiging-is-geen-hoedanigheid' });
        continue;
      }
      capacities.push({ kind: 'human-representation', source: 'vertegenwoordiging',
        name: B.tekst(r.hoedanigheid, 80), authorityRef: B.tekst(r.id, 160),
        scope: { kind: 'person', id: p.projectie.principalRef }, namens: namens.publiek(p.projectie),
        active: true, grantsAuthority: false });
    }
    return { status: malformed ? B.STATUS.ONBEKEND : B.STATUS.BEKEND, capacities };
  }

  function service(accountRef, caseRef, spoor) {
    const gelezen = B.bronLees(b.serviceMachtigingenVan, [accountRef]);
    if (!gelezen.ok || !Array.isArray(gelezen.value)) {
      spoor.push({ source: 'service.machtiging', state: 'onbekend', reason: gelezen.reason || 'onleesbare-bron' });
      return { status: B.STATUS.ONBEKEND, capacities: [] };
    }
    const zaak = caseRef && caseRef.domain === 'service' ? B.code(caseRef.id) : null;
    const capacities = [];
    for (const r of gelezen.value) {
      if (!r || r.stand !== 'geldig') {
        spoor.push({ source: 'service.machtiging', state: 'genegeerd', reason: 'machtiging-niet-actief' });
        continue;
      }
      if (!zaak || B.code(r.zaak) !== zaak) {
        spoor.push({ source: 'service.machtiging', state: 'genegeerd',
          reason: zaak ? 'machtiging-hoort-bij-andere-zaak' : 'geen-servicezaak-geselecteerd' });
        continue;
      }
      capacities.push({ kind: 'case-support-access', source: 'service.machtiging',
        name: 'servicemedewerker', authorityRef: B.tekst(r.id, 160),
        scope: { kind: 'service-case', id: zaak }, active: true, grantsAuthority: false });
    }
    return { status: B.STATUS.BEKEND, capacities };
  }

  return { vertegenwoordiging, service };
};
