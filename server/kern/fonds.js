/* De sociale 30%-stroom als eerste productiecel van de Economic Runtime.

   Een bevestigde abonnementsbetaling wordt op netto waarde 70/20/10 verdeeld.
   Platform, lokaal fonds en RTFoundation zijn drie formele claims; lokaal en
   foundation krijgen elk hun eigen settlement. `fondsAfdrachten` blijft als
   compatibele read projection voor bestaande schermen, niet als geldwaarheid. */
'use strict';

const crypto = require('crypto');
const btw = require('./commercie/btw');
const { naarCenten } = require('./geld/eenheid');
const { maakEconomicRuntime } = require('./economie/runtime');

const AANDEEL = 0.30;
function isAbonnement(desc) { return /lidmaatschap|jaarbijdrage|maandbijdrage/i.test(String(desc || '')); }
function aandeelCenten(bijdrageInclBtw, btwProfiel) {
  const o = btw.overBruto(naarCenten(bijdrageInclBtw) || 0, btwProfiel);
  return Math.round(o.nettoCenten * AANDEEL);
}
function aandeelEuro(bijdrageInclBtw, btwProfiel) { return aandeelCenten(bijdrageInclBtw, btwProfiel) / 100; }

function maakFonds(state) {
  const { db } = state;
  const save = state.save || (() => {});
  const env = state.env || process.env;
  const log = state.log || null;
  const opdrachten = state.betaalOpdrachten || null;
  const runtime = state.economicRuntime || maakEconomicRuntime({ db, save, bijeen: state.bijeen,
    inBundel: state.inBundel, crypto, nu: state.nu });
  const economie = require('./fonds/economie')({ runtime, crypto, env });
  const bewijsVenster = require('./fonds/bewijs-voor')({ db, runtime, actorRef: economie.actorRef });
  const { bewijzenVoor, bewijzenVoorRef } = bewijsVenster;
  const allocatie = require('./commercie/allocatie').maakAllocatie({ db, save, nu: state.nu || (() => Date.now()) });
  const eigen = require('./eigencollectie')({ db, domein: 'kern/fonds', bezit: { fondsAfdrachten: 'lijst' } });
  const lijst = () => eigen.bak('fondsAfdrachten');
  let bankAfdracht = null;
  function koppelBank(fn) { if (typeof fn === 'function') bankAfdracht = fn; }

  function herberekenAfdracht(a) {
    const legs = a.legs || [];
    const statussen = legs.map(l => l.status);
    a.centen = legs.reduce((s, l) => s + (l.centen || 0), 0);
    if (statussen.length && statussen.every(s => s === 'gestort')) a.status = 'gestort';
    else if (statussen.includes('afwikkeling_nodig')) a.status = 'afwikkeling_nodig';
    else if (statussen.includes('gestort')) a.status = 'deels_gestort';
    else if (statussen.length && statussen.every(s => s === 'ingepland' || s === 'gepland')) a.status = 'ingepland';
    else if (statussen.some(s => s === 'ingepland' || s === 'gepland')) a.status = 'deels_ingepland';
    else a.status = 'te_storten';
    const foundation = legs.find(l => l.component === 'foundation');
    a.iban = foundation ? foundation.iban : '';
    a.opdrachtId = foundation ? foundation.opdrachtId : null;
    a.uitbetaalId = foundation ? foundation.providerRef : null;
    return a;
  }

  const { verstuurLeg } = require('./fonds/uitbetalen').maakUitbetaling({
    opdrachten, runtime, save, log, lijst, herbereken: herberekenAfdracht,
    bankGeef: () => bankAfdracht
  });

  function bestemming() {
    const b = economie.bestemmingen();
    return { iban: b.foundation.iban, begunstigde: b.foundation.begunstigde,
      lokaal: b.lokaal, foundation: b.foundation };
  }

  const bundel = async fn => {
    if (typeof state.inBundel === 'function' && state.inBundel()) return fn();
    if (typeof state.bijeen === 'function') return state.bijeen(fn, { duurzaam: true });
    return fn();
  };

  async function boekAfdracht({ invoiceId, wie, bijdrage, betaalId, omschrijving, btwProfiel }) {
    if (!isAbonnement(omschrijving)) return null;
    const rijen = lijst();
    const bestaand = rijen.find(a => a.invoiceId === invoiceId && a.wie === wie);
    if (bestaand) return bestaand;
    let afdracht = null;
    await bundel(async () => {
      const uit = await economie.registreer({ invoiceId, wie, bijdrage, betaalId, btwProfiel });
      if (uit && uit.overslaan) return;
      if (!uit || uit.error) throw new Error((uit && uit.error) || 'Economic intent ontbreekt.');
      const c = uit.berekening;
      afdracht = {
        id: 'RTF-' + crypto.randomBytes(8).toString('hex').toUpperCase(),
        economicIntentId: uit.intent.id, invoiceId: invoiceId || null, wie: wie || null,
        betaalId: betaalId || null, brutoCenten: c.opbouw.brutoCenten,
        nettoCenten: c.opbouw.nettoCenten, centen: c.sociaalTotaal,
        regelVersie: c.verdeling.regelVersie,
        allocation: { platformCenten: c.platformCenten, lokaalCenten: c.sociaal.lokaal,
          foundationCenten: c.sociaal.foundation, afrondingCenten: c.verdeling.afrondingCenten },
        legs: uit.legs, status: 'te_storten', at: new Date().toISOString()
      };
      /* Tijdelijke projection voor bestaande rapportages. De Economic Runtime
         erboven is autoritatief; ids verbinden beide kanten expliciet. */
      const soc = allocatie.reserveer({ bronSoort: 'lidmaatschap', bronId: invoiceId || afdracht.id,
        codenaam: wie, bedragCenten: c.opbouw.nettoCenten });
      if (soc) {
        soc.economicIntentId = uit.intent.id;
        soc.claimIds = uit.intent.claimIds.slice();
        afdracht.allocatieId = soc.id;
      }
      herberekenAfdracht(afdracht);
      rijen.push(afdracht);
      if (rijen.length > 100000) rijen.splice(0, rijen.length - 100000);
      save();
    });
    if (!afdracht) return null;
    for (const leg of afdracht.legs) await verstuurLeg(afdracht, leg, { invoiceId, wie });
    herberekenAfdracht(afdracht); save();
    return afdracht;
  }

  function overzicht() {
    let totaal = 0, teStorten = 0, gestort = 0, ingepland = 0, afwikkelingNodig = 0;
    for (const a of lijst()) {
      totaal += a.centen || 0;
      if (Array.isArray(a.legs)) {
        for (const l of a.legs) {
          if (l.status === 'gestort') gestort += l.centen || 0;
          else if (l.status === 'ingepland' || l.status === 'gepland') ingepland += l.centen || 0;
          else { teStorten += l.centen || 0; if (l.status === 'afwikkeling_nodig') afwikkelingNodig += l.centen || 0; }
        }
      } else if (a.status === 'gestort') gestort += a.centen || 0;
      else if (a.status === 'ingepland') ingepland += a.centen || 0;
      else teStorten += a.centen || 0;
    }
    return { aantal: lijst().length, totaalCenten: totaal, teStortenCenten: teStorten,
      ingeplandCenten: ingepland, gestortCenten: gestort, afwikkelingNodigCenten: afwikkelingNodig,
      bestemming: bestemming(), economicRuntime: runtime.overzicht(),
      recent: lijst().slice(-12).reverse().map(a => ({ id: a.id, economicIntentId: a.economicIntentId || null,
        invoiceId: a.invoiceId, centen: a.centen, status: a.status, legs: a.legs || null, at: a.at })) };
  }

  function socialeStand() {
    const intents = Object.values((db.data.economischeRuntime || {}).intents || {})
      .filter(i => i.purpose === 'MEMBERSHIP.CONTRIBUTION');
    const claims = Object.values((db.data.economischeRuntime || {}).claims || {})
      .filter(c => intents.some(i => i.id === c.intentId) && (c.component === 'local-fund' || c.component === 'foundation'));
    const settlements = Object.values((db.data.economischeRuntime || {}).settlements || {});
    const perDeel = {};
    let open = 0, af = 0;
    for (const c of claims) {
      const p = perDeel[c.component] = perDeel[c.component] || { label: c.component, gereserveerd: 0, betaalbaar: 0, afgewikkeld: 0 };
      const ss = settlements.filter(s => s.claimId === c.id);
      if (c.status === 'SETTLED' || c.status === 'SATISFIED') { p.afgewikkeld += c.amountMinor; af += c.amountMinor; }
      else if (ss.some(s => s.status === 'READY' || s.status === 'IN_PROGRESS')) { p.betaalbaar += c.amountMinor; open += c.amountMinor; }
      else { p.gereserveerd += c.amountMinor; open += c.amountMinor; }
    }
    return { ok: true, aantal: intents.length,
      basisCenten: intents.reduce((s, i) => s + i.requestedValue.amountMinor, 0),
      totaalCenten: claims.reduce((s, c) => s + c.amountMinor, 0), openCenten: open,
      afgewikkeldCenten: af, vervallenCenten: 0, perDeel,
      bewijs: runtime.overzicht() };
  }

  async function reconcileSettlement(input) { return runtime.reconcileSettlement(input); }
  function proof(intentId) { return runtime.proof(intentId); }

  async function herstel({ economicIntentId, component, caseId }) {
    const afdracht = lijst().find(a => a.economicIntentId === economicIntentId);
    const leg = afdracht && (afdracht.legs || []).find(l => l.component === component);
    const claim = runtime.claimVoor(economicIntentId, component);
    if (!afdracht || !leg || !claim) return { status: 404, error: 'Economic claim bestaat niet.' };
    if (!leg.iban) return { status: 409, error: 'Voor deze claim is nog geen uitbetaalbestemming ingesteld.' };
    const p = await runtime.planSettlement({ intentId: economicIntentId, claimId: claim.id,
      destinationRef: leg.destinationRef, rail: 'SEPA', recoveryCaseId: caseId,
      idempotencyKey: 'recovery:' + caseId + ':' + (claim.settlementIds.length + 1) });
    if (!p || p.error) return p;
    leg.settlementId = p.settlement.id; leg.opdrachtId = null; leg.providerRef = null; leg.status = 'gepland'; leg.fout = null;
    await verstuurLeg(afdracht, leg, { invoiceId: afdracht.invoiceId, wie: afdracht.wie });
    return { ok: true, afdracht, settlement: runtime.settlement(leg.settlementId) };
  }

  return { isAbonnement, aandeelCenten, aandeelEuro, boekAfdracht, overzicht, bestemming,
    koppelBank, socialeStand, allocatie, runtime, proof, bewijzenVoor, bewijzenVoorRef,
    reconcileSettlement, herstel, AANDEEL };
}

module.exports = { maakFonds, isAbonnement, aandeelCenten, aandeelEuro, AANDEEL };
