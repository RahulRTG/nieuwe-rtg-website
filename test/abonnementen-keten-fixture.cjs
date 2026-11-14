'use strict';
const crypto = require('node:crypto');
const { fixture, body, tekenen, kopie } = require('./abonnementsaanbod-fixture.cjs');
function keten(echt = {}) {
  const f = fixture(), dossiers = new Map([[1, { invoices: [] }], [2, { invoices: [] }]]);
  f.users.get(1).tier = 'guest'; f.stand.providerCalls = 0; f.stand.rechtenFout = false;
  Object.assign(f.accounts, {
    getMemberState: id => kopie(dossiers.get(id)), listStaff: () => [],
    achtergrondWerk: async fn => fn(),
    wijzigMemberState(id, fn) {
      const md = kopie(dossiers.get(id)), r = fn(md);
      if (f.stand.accountFout) throw Error('Accountcommit geweigerd');
      if (r.bewaar) dossiers.set(id, md);
      if (f.stand.accountAntwoordFout) { f.stand.accountAntwoordFout = false; throw Error('Antwoord na accountcommit weg'); }
      return r.waarde;
    },
    setTier(id, tier) {
      if (f.stand.rechtenFout) throw Error('Rechtenopslag niet beschikbaar');
      f.users.get(id).tier = tier; return true;
    }
  });
  if (echt.db) { f.db = echt.db; f.opties.db = echt.db; }
  if (echt.accounts) { f.accounts = echt.accounts; f.opties.accounts = echt.accounts; }
  if (echt.bewerkCollectie) f.opties.bewerkCollectie = echt.bewerkCollectie;
  const providers = new Map();
  const betaal = {
    async maakBetaling(o) {
      f.stand.providerCalls++;
      if (!providers.has(o.idempotentieSleutel)) providers.set(o.idempotentieSleutel, {
        id: 'cs_' + o.referentie, aanbieder: 'stripe', status: 'requires_action', bedrag: o.bedrag,
        valuta: 'eur', checkoutUrl: 'https://checkout.stripe.com/c/test', toestemmingRef: o.terugkerend.toestemmingRef });
      if (f.stand.providerFout) throw Error('Providerantwoord verloren');
      return providers.get(o.idempotentieSleutel);
    },
    async haalBetaling(aanbieder, id) { return [...providers.values()].find(p => p.id === id); },
    async haalBetaalafspraak(o) { return { ...o, status: f.stand.mandaatWacht ? 'wachtend' : 'gereed',
      customerId: 'cus_fixture', paymentMethodId: 'pm_fixture', mandateId: null }; },
    async maakBetaalafspraak(o) { f.stand.setupCalls = (f.stand.setupCalls || 0) + 1;
      return { ...o, status: 'wachtend', providerId: 'cs_setup', checkoutUrl: 'https://checkout.stripe.com/c/setup' }; }
  };
  const bw = require('../server/kern/betaalwaarheid')({ d: () => f.db.data, save: echt.save || (() => {}), crypto, betaal,
    nu: () => f.stand.at, log: { warn() {} } });
  const service = require('../server/kern/aanmeldingen/abonnementen')({ ...f.opties, betaal, betaalWaarheid: bw,
    beschikbaar: true, returnUrl: 'https://rtg.example/?abonnement=herstel' });
  const btw = require('../server/kern/commercie/btw');
  const { verdeel, HUIDIGE_VERSIE } = require('../server/kern/commercie/allocatie/regels');
  const fonds = { isAbonnement: () => true, async boekAfdracht(o) {
    const p = btw.overBruto(Math.round(o.bijdrage * 100), o.btwProfiel);
    return { ...o, ...p, centen: verdeel(p.nettoCenten, HUIDIGE_VERSIE).totaalCenten }; } };
  const settle = require('../server/kern/settlement').maakSettlement({ db: f.db, accounts: f.accounts, fonds,
    naAbonnementsbetaling: ctx => service.afgewikkeld(ctx.accountId, ctx.contractId, ctx.termijn) });
  require('../server/kern/betaalwaarheid/inkomend')({ betaalWaarheid: bw, settleFactuur: settle });
  async function getekend(input = {}) {
    const r = await service.aanbod(1, body(input));
    if (!r.ok) throw Error(JSON.stringify(r));
    const s = await service.teken(1, tekenen(r));
    if (!s.ok) throw Error(JSON.stringify(s));
    return r.contract.id;
  }
  function bevestig() { for (const p of providers.values()) p.status = 'succeeded'; }
  return { ...f, dossiers, betaal, bw, service, providers, getekend, bevestig };
}
module.exports = { keten };
