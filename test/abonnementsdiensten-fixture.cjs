'use strict';
const crypto = require('node:crypto');
const { maakAanbod } = require('../server/kern/aanmeldingen/abonnementsaanbod-vorm');
const { abonnementsAanbod } = require('../server/kern/pasprijs');
const ontvangst = require('../server/kern/aanmeldingen/abonnementsaanbod-ontvangst');
async function fixture(pas = 'business-lite') {
  const stand = { at: '2026-11-13T10:00:00.000Z' }, db = { data: { onboarding: { profielen: {} },
    contracten: [], lidmaatschapBetalingen: [], betaalWaarheid: {}, notifications: {}, zaakAbonnement: {} } };
  const contract = { id: 'c-1', accountId: 1, aanmeldingId: 'a-1', pas, frequentie: 'maand',
    automatischAbonnement: true, status: 'AANGEBODEN' }, zaak = pas.startsWith('business');
  const prijs = abonnementsAanbod(pas, { frequentie: 'maand', btwProfiel: 'nl-21' });
  contract.aanbod = maakAanbod(contract, { prijs, at: stand.at, opdracht: crypto.randomUUID(),
    scope: { soort: zaak ? 'zaak' : 'persoon', code: zaak ? 'ZAAK' : null, capaciteiten: [] },
    verrekening: { ok: true, bronContractId: null, regels: [], creditCenten: 0, overCenten: 0,
      teBetalenCenten: prijs.termijn.brutoCenten } });
  const r = ontvangst(db.data, contract, { naam: 'Test Ondertekenaar', akkoord: true, doorlopendeBetalingAkkoord: true }, stand.at);
  if (!r.ok) throw Error(JSON.stringify(r));
  contract.ondertekening = r.bewijs; contract.status = 'ACTIEF'; contract.activering = { at: stand.at };
  if (zaak) { contract.zaakCode = 'ZAAK'; db.data.zaakAbonnement.ZAAK = { pas, contractId: contract.id, door: 'abonnement:c-1' }; }
  db.data.contracten.push(contract);
  const termijn = { id: 'c-1:2', nr: 2, contractId: contract.id, invoiceId: 'INV-2',
    vervalt: '2026-11-12T10:00:00.000Z', brutoCenten: 1210, centen: 1000, status: 'open', betaalWaarheidId: 'bw-2' };
  const bw = { id: 'bw-2', actor: 'acc:1', soort: 'factuur', bronRef: 'INV-2', centen: 1210, valuta: 'eur',
    status: 'WACHT_OP_KLANT', provider: 'stripe', providerId: 'pi_fixture', providerStatus: 'requires_payment_method',
    start: { terugkerend: { modus: 'innen' } }, terugbetaaldCenten: 0, terugbetaalOpdrachten: [],
    context: { own: true, accountId: 1, contractId: 'c-1', invoiceId: 'INV-2', termijn: 2 } };
  db.data.lidmaatschapBetalingen.push({ contractId: contract.id, termijnen: [termijn] });
  db.data.betaalWaarheid[bw.id] = bw;
  const opties = { db, nu: () => stand.at, bewerkCollectie: (_vorm, werk) => werk(db.data) };
  const meldingen = require('../server/kern/aanmeldingen/abonnementsmeldingen')(opties);
  await meldingen.meld(contract.id);
  const diensten = require('../server/kern/aanmeldingen/abonnementsdiensten')(opties);
  const zaakAbonnement = require('../server/kern/commercie/zaakabonnement').maakZaakabonnement({ ...opties, save() {} });
  return { db, stand, contract, termijn, bw, diensten, zaakAbonnement, meldingen,
    beperk() { stand.at = '2026-12-14T10:00:00.001Z'; },
    betaal() { bw.status = 'BEVESTIGD'; bw.afgehandeldAt = stand.at; } };
}
module.exports = { fixture };
