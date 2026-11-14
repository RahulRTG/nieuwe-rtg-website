/* Alleen nieuwe, contractgebonden abonnementsfacturen. De BW-bron bewijst geld;
   een betaalde factuur bewijst nog geen voltooide activatie. Accountcommit,
   bestaande fondsboeking en activatie zijn afzonderlijk herstelbare stappen.
   Geen provider-I/O binnen de synchrone accounttransactie. */
'use strict';
const btw = require('../commercie/btw');
const { verdeel, HUIDIGE_VERSIE } = require('../commercie/allocatie/regels');
const fout = (error, status = 409) => ({ ok: false, status, error });
const tekst = s => typeof s === 'string' && s.length > 0 && s.trim() === s;
const positief = n => Number.isSafeInteger(n) && n > 0;
const leeg = l => l == null || Array.isArray(l) && l.length === 0;

module.exports = function maakAbonnementssettlement({ accounts, db, fonds, naAbonnementsbetaling }) {
  const bezig = new Map();

  function bewijs(ctx, betaling) {
    if (!ctx || ctx.soort !== 'factuur' || ctx.own !== true || !positief(ctx.accountId) ||
        !tekst(ctx.invoiceId) || !tekst(ctx.contractId) || !positief(ctx.termijn) ||
        ctx.wie != null && ctx.wie !== 'acc:' + ctx.accountId ||
        !betaling || !tekst(betaling.id) || !positief(betaling.centen))
      return fout('De eigen abonnementsfactuur of betaalcontext ontbreekt.');
    const doos = db && db.data && db.data.betaalWaarheid;
    const w = doos && Object.hasOwn(doos, betaling.id) && doos[betaling.id], c = w && w.context;
    if (!w || w.id !== betaling.id || w.status !== 'BEVESTIGD' || w.soort !== 'factuur' ||
        w.actor !== 'acc:' + ctx.accountId || w.bronRef !== ctx.invoiceId ||
        w.centen !== betaling.centen || w.valuta !== 'eur' || !tekst(w.provider) || !tekst(w.providerId) ||
        w.terugbetaaldCenten !== 0 || !leeg(w.terugbetalingen) || !leeg(w.terugbetaalOpdrachten) ||
        !c || c.own !== true || c.accountId !== ctx.accountId || c.invoiceId !== ctx.invoiceId ||
        c.contractId !== ctx.contractId || c.termijn !== ctx.termijn)
      return fout('Geen exact bevestigd en ongerestitueerd betaalbewijs voor deze abonnementstermijn.');
    return { ok: true };
  }

  function factuur(md, ctx, betaling) {
    const rijen = (Array.isArray(md.invoices) ? md.invoices : []).filter(i => i && i.id === ctx.invoiceId);
    if (rijen.length !== 1) return fout('De eigen abonnementsfactuur ontbreekt of is niet uniek.', 404);
    const inv = rijen[0], a = inv.abonnement;
    if (!a || a.accountId !== ctx.accountId || a.contractId !== ctx.contractId ||
        a.termijn !== ctx.termijn || a.valuta !== 'eur' || a.brutoCenten !== betaling.centen ||
        !positief(a.brutoCenten) || typeof inv.bijdrage !== 'number' || !Number.isFinite(inv.bijdrage) ||
        Math.abs(inv.bijdrage * 100 - a.brutoCenten) > 0.000001 || !['open', 'paid'].includes(inv.status))
      return fout('De factuurprijs of contractbinding wijkt af van de bevestigde betaling.');
    const opbouw = btw.overBruto(a.brutoCenten, inv.btwProfiel);
    if (!Object.hasOwn(btw.PROFIELEN, inv.btwProfiel) || !inv.btwOpbouw ||
        Object.keys(opbouw).some(k => inv.btwOpbouw[k] !== opbouw[k]) ||
        !fonds.isAbonnement(inv.desc))
      return fout('De oorspronkelijke btw-opbouw of abonnementsgrond vereist herstel.');
    const b = inv.betaalBewijzen;
    if (!leeg(b) && (!Array.isArray(b) || b.length !== 1 || b[0].id !== betaling.id || b[0].centen !== betaling.centen))
      return fout('Deze factuur bevat al een ander of inconsistent betaalbewijs.');
    if (inv.status === 'paid' && (leeg(b) || inv.betaalId !== betaling.id || inv.deelbetaald !== betaling.centen) ||
        inv.status === 'open' && (!leeg(b) || inv.deelbetaald != null && inv.deelbetaald !== 0 || inv.betaalId))
      return fout('De factuurstand en betaalbewijzen zijn niet consistent.');
    return { ok: true, inv, opbouw };
  }

  async function afronden(ctx, betaling) {
    // Deze bestaande deur commit accountwerk ook vanuit BW.ronde in PostgreSQL.
    const geboekt = await accounts.achtergrondWerk(() => accounts.wijzigMemberState(ctx.accountId, md => {
      const b = bewijs(ctx, betaling);
      if (!b.ok) return { waarde: b };
      const f = factuur(md, ctx, betaling);
      if (!f.ok) return { waarde: f };
      const inv = f.inv, herhaald = inv.status === 'paid';
      if (!herhaald) {
        inv.betaalBewijzen = [{ id: betaling.id, centen: betaling.centen }];
        inv.deelbetaald = betaling.centen; inv.betaalId = betaling.id;
        inv.status = 'paid'; inv.date = betaling.hoe || 'Bevestigd betaald';
      }
      return { bewaar: !herhaald, waarde: { ok: true, herhaald,
        invoiceId: inv.id, bijdrage: inv.bijdrage, omschrijving: inv.desc,
        btwProfiel: inv.btwProfiel, opbouw: f.opbouw } };
    }));
    if (!geboekt || !geboekt.ok) return geboekt || fout('Factuurcommit is niet bevestigd.', 503);
    const b = bewijs(ctx, betaling); if (!b.ok) return b;
    // De bestaande owner en sleutel (invoiceId, wie) blijven identiek op retry.
    const afdracht = await fonds.boekAfdracht({ invoiceId: geboekt.invoiceId, wie: 'acc:' + ctx.accountId,
      bijdrage: geboekt.bijdrage, betaalId: betaling.id, omschrijving: geboekt.omschrijving,
      btwProfiel: geboekt.btwProfiel });
    const sociaal = verdeel(geboekt.opbouw.nettoCenten, HUIDIGE_VERSIE).totaalCenten;
    if (sociaal > 0 && (!afdracht || afdracht.error || afdracht.invoiceId !== ctx.invoiceId ||
        afdracht.wie !== 'acc:' + ctx.accountId || afdracht.betaalId !== betaling.id ||
        afdracht.nettoCenten !== geboekt.opbouw.nettoCenten || afdracht.brutoCenten !== betaling.centen ||
        afdracht.centen !== sociaal))
      return fout('De bestaande maatschappelijke afdracht is niet bevestigd.', 503);
    const nu = bewijs(ctx, betaling); if (!nu.ok) return nu;
    const uit = await naAbonnementsbetaling(ctx, betaling);
    if (!uit || uit.ok !== true) return uit && uit.error ? uit : fout('De abonnementstermijn is nog niet afgehandeld.', 503);
    return { ok: true, herhaald: geboekt.herhaald };
  }

  return async function settleAbonnement(context, ontvangen) {
    const ctx = { ...context }, betaling = { ...ontvangen };
    const b = bewijs(ctx, betaling); if (!b.ok) return b;
    if (!accounts || typeof accounts.achtergrondWerk !== 'function' || typeof accounts.wijzigMemberState !== 'function' ||
        !fonds || typeof fonds.boekAfdracht !== 'function' || typeof fonds.isAbonnement !== 'function' ||
        typeof naAbonnementsbetaling !== 'function')
      return fout('De volledige abonnementsafhandeling is niet aangesloten.', 503);
    const sleutel = ctx.accountId + ':' + ctx.invoiceId, eerder = bezig.get(sleutel);
    if (eerder) return eerder.id === betaling.id && eerder.centen === betaling.centen
      ? eerder.werk : fout('Er loopt al een andere betaling voor deze factuur.');
    const werk = afronden(ctx, betaling);
    bezig.set(sleutel, { id: betaling.id, centen: betaling.centen, werk });
    try { return await werk; } finally { bezig.delete(sleutel); }
  };
};
