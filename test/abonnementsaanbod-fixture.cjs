'use strict';
const crypto = require('node:crypto');
const fabriek = require('../server/kern/aanmeldingen/abonnementsaanbod');
const { abonnementsAanbod } = require('../server/kern/pasprijs');
const { capsVan } = require('../server/kern/commercie/capaciteiten');
const kopie = x => JSON.parse(JSON.stringify(x));
function fixture(data = {}) {
  const db = { data: kopie(data), writable: true }, users = new Map([[1, { id: 1 }], [2, { id: 2 }]]);
  const stand = { at: '2026-11-13T10:00:00.000Z', saves: 0, prijsCalls: 0 };
  const accounts = { getUserById: id => users.get(id), isActief: a => !a.inactief,
    setTier() { throw Error('Een aanbod kent geen tier toe.'); } };
  const bewerk = require('../server/db/collectie-bewerken')({ store: 'memory', db,
    save() { if (stand.saveFout) throw Error('Opslag geweigerd'); stand.saves++; } });
  const opties = { db, accounts, nu: () => stand.at,
    bewerkCollectie(vorm, werk) {
      if (stand.voorSlot) stand.voorSlot();
      const r = bewerk(vorm, werk);
      if (stand.antwoordFout) { stand.antwoordFout = false; throw Error('Antwoord na commit onderbroken'); }
      return r;
    },
    prijsVoor(pas, input) {
      stand.prijsCalls++;
      return stand.prijs ? stand.prijs(pas, input) : abonnementsAanbod(pas, input);
    },
    scopeVoor(id, { pas, aanmelding, input, bestaandAanbod, collecties }) {
      if (stand.scope) return stand.scope(id, { pas, aanmelding, input, bestaandAanbod, collecties });
      return { soort: pas === 'business' ? 'organisatie' : pas === 'business-lite' ? 'zaak' : 'persoon',
        code: pas === 'business' ? aanmelding.besluit?.organisatie : pas === 'business-lite' ? (aanmelding.gezaakt || {}).code || input.zaakCode || null : null,
        capaciteiten: capsVan(pas) };
    },
    verrekeningVoor(id, input) {
      return stand.credit ? stand.credit(id, input) : { ok: true, bronContractId: null, regels: [],
        creditCenten: 0, teBetalenCenten: input.doelCenten, overCenten: 0 };
    } };
  return { db, stand, users, accounts, opties, motor: fabriek(opties) };
}
const body = extra => ({ pas: 'rtg', frequentie: 'maand', idempotencyKey: crypto.randomUUID(), ...extra });
const tekenen = (r, extra) => ({ contractId: r.contract.id, aanbodHash: r.contract.aanbod.hash,
  naam: 'Amber Ondertekenaar', akkoord: true, doorlopendeBetalingAkkoord: true, ...extra });
const aanvraag = (pas, extra) => ({ id: 'a-' + pas, accountId: 1, pas, status: 'in behandeling',
  bedrijf: { naam: 'Fixturezaak', type: 'vakwerk' }, ...extra });
module.exports = { fixture, body, tekenen, aanvraag, kopie, fabriek };
