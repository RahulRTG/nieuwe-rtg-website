'use strict';
const { maakAanbod } = require('../server/kern/aanmeldingen/abonnementsaanbod-vorm');
const { abonnementsAanbod } = require('../server/kern/pasprijs');
const kopie = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const stand = { at: '2026-11-13T10:00:00.000Z', staff: 0, saves: 0 };
  const c = { id: 'org-c-1', accountId: 1, aanmeldingId: 'a-1', pas: 'business', frequentie: 'maand',
    automatischAbonnement: true, status: 'ACTIEF', activering: { at: stand.at, betaalWaarheidId: 'bw-1' } };
  const prijs = abonnementsAanbod('business', { frequentie: 'maand', btwProfiel: 'nl-21',
    aanmelding: { contract: { maandCenten: 750000 } } });
  c.aanbod = maakAanbod(c, { prijs, at: stand.at, opdracht: 'fixture',
    scope: { soort: 'organisatie', code: 'ORG-1', capaciteiten: require('../server/kern/commercie/capaciteiten').capsVan('business') },
    verrekening: { ok: true, bronContractId: null, regels: [], creditCenten: 0, overCenten: 0,
      teBetalenCenten: prijs.termijn.brutoCenten } });
  const a = { id: 'a-1', accountId: 1, pas: 'business', status: 'geaccepteerd', naam: 'Eigenaar',
    bedrijf: { naam: 'Organisatie', type: 'vakwerk', plaats: 'Haarlem' },
    besluit: { besluit: 'geaccepteerd', door: 'office:persoon-8', at: stand.at, organisatie: 'ORG-1' } };
  const db = { writable: true, data: { contracten: [c], aanmeldingen: [a], suppliers: [
    { code: 'ZAAK-A', online: true }, { code: 'ZAAK-B', online: false }, { code: 'BUUR', online: true }],
    zaakAbonnement: {}, onboarding: { profielen: {} }, betaalWaarheid: {}, lidmaatschapBetalingen: [], notifications: {},
    tenants: { 'ORG-1': { org: 'ORG-1', actief: true, zaken: ['ZAAK-A', 'ZAAK-B'], werkruimtes: ['W1'] },
      'ORG-2': { org: 'ORG-2', actief: true, zaken: ['BUUR'], werkruimtes: ['W2'] } } } };
  const opties = { db, nu: () => stand.at, save() { stand.saves++; } };
  c.status = 'AANGEBODEN';
  const ontvangst = require('../server/kern/aanmeldingen/abonnementsaanbod-ontvangst')(db.data, c,
    { naam: 'Bevoegde Ondertekenaar', akkoord: true, doorlopendeBetalingAkkoord: true }, stand.at);
  if (!ontvangst.ok) throw Error(JSON.stringify(ontvangst));
  c.ondertekening = ontvangst.bewijs; c.status = 'ACTIEF';
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ ...opties, store: 'memory' });
  const accounts = { getUserById: () => ({ id: 1, tier: 'rtg' }), isActief: () => true,
    listStaff() { throw Error('Organisatieproductrechten zijn geen personeelsrollen.'); },
    async maakEigenaarEenmaal() { stand.staff++; throw Error('Geen organisatiebrede managers maken.'); } };
  const motor = require('../server/kern/aanmeldingen/bedrijf')({ ...opties, accounts, bewerkCollectie,
    kap: (s, n) => String(s || '').slice(0, n) });
  const zaakAbonnement = require('../server/kern/commercie/zaakabonnement').maakZaakabonnement(opties);
  const diensten = require('../server/kern/aanmeldingen/abonnementsdiensten')(opties);
  const org = require('../server/kern/commercie/organisatieabonnement')(opties);
  async function achterstand() {
    const termijn = { id: c.id + ':2', nr: 2, contractId: c.id, invoiceId: 'INV-ORG-2',
      vervalt: '2026-11-12T10:00:00.000Z', brutoCenten: prijs.termijn.brutoCenten,
      centen: prijs.termijn.nettoCenten, status: 'open', betaalWaarheidId: 'bw-org-2' };
    const bw = { id: 'bw-org-2', actor: 'acc:1', soort: 'factuur', bronRef: termijn.invoiceId,
      centen: termijn.brutoCenten, valuta: 'eur', status: 'WACHT_OP_KLANT', provider: 'stripe',
      providerId: 'pi_org_fixture', providerStatus: 'requires_payment_method',
      start: { terugkerend: { modus: 'innen' } }, terugbetaaldCenten: 0, terugbetaalOpdrachten: [],
      context: { own: true, accountId: 1, contractId: c.id, invoiceId: termijn.invoiceId, termijn: 2 } };
    db.data.lidmaatschapBetalingen.push({ contractId: c.id, termijnen: [termijn] }); db.data.betaalWaarheid[bw.id] = bw;
    const meldingen = require('../server/kern/aanmeldingen/abonnementsmeldingen')({ ...opties, bewerkCollectie });
    const r = await meldingen.meld(c.id); if (!r.ok) throw Error(JSON.stringify(r));
    return { termijn, bw, meldingen };
  }
  return { db, stand, motor, zaakAbonnement, diensten, org, opties, bewerkCollectie,
    c: () => db.data.contracten[0], a: () => db.data.aanmeldingen[0], kopie, achterstand };
}
module.exports = { fixture };
