/* Eén betalingsopdracht per contracttermijn, in de bestaande betaalwaarheid.
   Eerst duurzaam voorbereiden, dan pas provider-I/O. Accounts en collecties
   hebben elk hun eigen commit: de factuur is daarom idempotent hervatbaar. */
'use strict';
const crypto = require('node:crypto');
const maakWaarheid = require('../betaalwaarheid');
const { termijn, factuur } = require('./abonnementstermijn');
const { valideOndertekening } = require('./abonnementsaanbod');
const { canon } = require('./abonnementsaanbod-vorm');
const controleOrganisatie = require('./abonnementsbetaalgrens');
const VORM = { contracten: 'lijst', onboarding: 'kaart', lidmaatschapBetalingen: 'lijst',
  betaalWaarheid: 'kaart', betaalWaarheidMeldingen: 'kaart',
  aanmeldingen: 'lijst', tenants: 'kaart', zaakAbonnement: 'kaart' };

module.exports = ({ db, accounts, bewerkCollectie, betaal, betaalWaarheid, nu, returnUrl }) => {
  async function bereid(accountId, contractId, nr = 1) {
    const voorbereid = await bewerkCollectie(VORM, data => {
      const c = data.contracten.find(c => c.id === contractId && c.accountId === accountId && c.automatischAbonnement);
      if (!c || !valideOndertekening(c, data.onboarding)) throw Error('Een geldige eigen ondertekening ontbreekt.');
      if (nr === 1 ? !['GEACCEPTEERD', 'ACTIEF'].includes(c.status) : !['ACTIEF', 'OPZEGGEND'].includes(c.status))
        throw Error('Deze contractstand mag geen betaling beginnen.');
      if (nr > 1 && (!c.activering || !c.activering.rechtenAt || c.betaalafspraak?.status !== 'gereed'))
        throw Error('De eerste activering of betaalafspraak is nog niet afgerond.');
      if (nr > 1 && data.contracten.some(x => x.id !== c.id && x.verrekening?.bronContractId === c.id &&
          x.verrekening.status === 'GERESERVEERD'))
        throw Error('Rond eerst het lopende upgradevoorstel af of trek het in.');
      const t = termijn(c, nr);
      let rij = data.lidmaatschapBetalingen.find(r => r.contractId === c.id);
      if (nr === 1 && !rij?.termijnen.some(t => t.nr === nr)) controleOrganisatie(data, c, nu);
      if (!rij) data.lidmaatschapBetalingen.push(rij = { aanmeldingId: c.aanmeldingId, contractId: c.id,
        pas: c.pas, naam: '', gestart: c.startAt, termijnen: [] });
      let bestaand = rij.termijnen.find(x => x.nr === nr);
      if (bestaand) return { contract: c, termijn: bestaand };
      if (nr === 1 && c.aanbod.geldigTot && Date.parse(nu()) > Date.parse(c.aanbod.geldigTot))
        throw Error('De verrekenofferte is verlopen; begin geen nieuwe betaling.');
      if (nr > 1 && (Date.parse(t.van) > Date.parse(nu()) ||
          c.eindigtOp && Date.parse(t.van) >= Date.parse(c.eindigtOp)))
        throw Error('Deze termijn is nog niet verschuldigd of valt na het einde.');
      if (nr > 1 && !rij.termijnen.some(x => x.nr === nr - 1 && x.status === 'voldaan'))
        throw Error('Herstel eerst de vorige termijn; geen stapeling van afschrijvingen.');
      bestaand = { ...t, contractId: c.id, maand: nr, vervalt: t.van, centen: t.opbouw.nettoCenten,
        status: 'open', betaalWaarheidId: null, setup: null };
      const toestemmingRef = c.aanbod.hash;
      if (t.brutoCenten > 0) {
        const w = maakWaarheid({ d: () => data, save() {}, crypto, betaal, nu });
        const b = w.maak({ actor: 'acc:' + accountId, idem: 'inv:' + t.invoiceId, soort: 'factuur',
          bronRef: t.invoiceId, centen: t.brutoCenten, valuta: 'eur',
          context: { own: true, accountId, invoiceId: t.invoiceId, wie: 'acc:' + accountId,
            contractId: c.id, termijn: nr, startcontrole: 'abonnement' } });
        if (b.context?.contractId !== c.id || b.context?.termijn !== nr || b.valuta !== 'eur')
          throw Error('Deze betaalsleutel is al aan andere gegevens gebonden.');
        const opties = nr === 1 ? { aanbieder: 'stripe', methode: 'hosted', returnUrl,
          terugkerend: { modus: 'vastleggen', toestemmingRef } }
          : { aanbieder: 'stripe', terugkerend: { modus: 'innen', toestemmingRef,
            customerId: c.betaalafspraak.customerId, paymentMethodId: c.betaalafspraak.paymentMethodId,
            ...(c.betaalafspraak.mandateId ? { mandateId: c.betaalafspraak.mandateId } : {}) } };
        w.bereidVoor(b.id, opties);
        bestaand.betaalWaarheidId = b.id;
      } else if (nr === 1) {
        bestaand.setup = { referentie: 'abonnement:' + c.id, idempotentieSleutel: 'abonnement-setup:' + c.id,
          toestemmingRef, returnUrl, providerId: null };
      }
      rij.termijnen.push(bestaand);
      return { contract: c, termijn: bestaand };
    });
    const { contract: c, termijn: t } = voorbereid;
    const r = await accounts.achtergrondWerk(() => accounts.wijzigMemberState(accountId, md => {
      if (!Array.isArray(md.invoices)) md.invoices = [];
      const oud = md.invoices.find(i => i.id === t.invoiceId), nieuw = factuur(c, t);
      if (oud) {
        if (canon(oud.abonnement) !== canon(nieuw.abonnement) || oud.bijdrage !== nieuw.bijdrage)
          throw Error('De bestaande factuur wijkt af van de getekende termijn.');
        return { bewaar: false, waarde: { ok: true } };
      }
      md.invoices.push(nieuw);
      return { bewaar: true, waarde: { ok: true } };
    }));
    if (!r || !r.ok) throw Error('De eigen factuur is niet bevestigd.');
    return voorbereid;
  }
  async function controleStart(accountId, contractId, nr = 1) {
    if (nr === 1) await bewerkCollectie(VORM, data => {
      const c = data.contracten.find(c => c.id === contractId && c.accountId === accountId);
      const vers = data.lidmaatschapBetalingen.find(r => r.contractId === contractId)?.termijnen.find(x => x.nr === nr);
      if (!c || !vers || !valideOndertekening(c, data.onboarding)) throw Error('De eigen getekende betaalopdracht is veranderd.');
      const w = vers.betaalWaarheidId && data.betaalWaarheid[vers.betaalWaarheidId];
      const gestart = vers.setup?.providerId || w?.providerId ||
        w?.gebeurtenissen?.some(g => g.soort === 'PROVIDER_START' && g.aangeroepen === true);
      if (!gestart) controleOrganisatie(data, c, nu);
    });
  }
  async function begin(accountId, contractId, nr = 1) {
    const { termijn: t } = await bereid(accountId, contractId, nr);
    await controleStart(accountId, contractId, nr);
    if (t.betaalWaarheidId) {
      const w = betaalWaarheid.van(t.betaalWaarheidId);
      if (!w) throw Error('De duurzame betaalopdracht ontbreekt.');
      const r = await betaalWaarheid.begin(w.id, w.start);
      const checkoutUrl = r.actie?.url || r.actie?.checkoutUrl || null;
      if (checkoutUrl) await bewerkCollectie({ lidmaatschapBetalingen: 'lijst' }, data => {
        const x = data.lidmaatschapBetalingen.find(r => r.contractId === contractId)?.termijnen.find(x => x.nr === nr);
        if (x?.betaalWaarheidId !== w.id) throw Error('De betaalopdracht is veranderd.');
        x.checkoutUrl = checkoutUrl;
      });
      return { ok: true, status: r.betaling.status, checkoutUrl };
    }
    if (t.setup) {
      const p = await betaal.maakBetaalafspraak({ aanbieder: 'stripe', ...t.setup });
      await bewerkCollectie({ lidmaatschapBetalingen: 'lijst' }, data => {
        const rij = data.lidmaatschapBetalingen.find(r => r.contractId === contractId);
        const x = rij?.termijnen.find(x => x.nr === 1);
        if (!x?.setup || x.setup.toestemmingRef !== t.setup.toestemmingRef) throw Error('De setupopdracht is veranderd.');
        if (x.setup.providerId && x.setup.providerId !== p.providerId) throw Error('De provider gaf een andere setup terug.');
        Object.assign(x.setup, { providerId: p.providerId, checkoutUrl: p.checkoutUrl || null });
      });
      return { ok: true, status: 'WACHT_OP_KLANT', checkoutUrl: p.checkoutUrl };
    }
    return { ok: true, status: 'VERREKEND' };
  }
  async function voorProvider(w) {
    const x = w.context || {};
    // Een achtergrondretry kan na de collectiecommit maar vóór de afzonderlijke
    // accountcommit landen. Rond dezelfde factuur eerst via haar eigenaar af.
    const r = await bereid(x.accountId, x.contractId, x.termijn);
    if (r.termijn.betaalWaarheidId !== w.id || r.termijn.invoiceId !== w.bronRef)
      throw Error('De providerstart hoort niet bij deze exacte contracttermijn.');
    await controleStart(x.accountId, x.contractId, x.termijn);
  }
  return { bereid, begin, controleStart, voorProvider };
};
