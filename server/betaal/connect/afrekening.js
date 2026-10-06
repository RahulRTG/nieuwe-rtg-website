/* PARTNERAFREKENING OVER STRIPE CONNECT: aanvragen en indienen.

   Wat er gebeurt: RTG maakt een TRANSFER van het platformsaldo naar het
   verbonden account van de partner, en daarna een PAYOUT van dat saldo naar
   zijn bank (met de Stripe-Account-kop). Twee handelingen, twee eigen
   idempotentiesleutels (./sleutel.js), een gesloten standentabel
   (./toestand.js). De meldingen van Stripe, de veeg na een herstart en de
   reconciliatie staan in ./melding.js; die kant VERWERKT wat er al gebeurde,
   deze kant LAAT iets gebeuren.

   DRIE REGELS DIE HIER IN CODE STAAN:

   1. TWEE POORTEN, ALLEBEI GEVRAAGD. `geld.partnerafrekening` EN
      `geld.provider.stripe_connect` (server/kern/vrijgave/). Het register zegt
      al dat de eerste van de tweede afhangt; toch worden ze hier allebei
      genoemd, zodat een fout in het register deze deur niet stil opent.
      Gevraagd bij IEDERE handeling die een nieuw effect maakt -- aanvragen,
      transfer, payout -- en niet bij een melding of een veeg die alleen de
      stand van iets dat al liep bijwerkt. Een noodstop houdt nieuw geld tegen
      en laat het boekhouden van wat al onderweg was gewoon doorgaan.

   2. EERST VASTLEGGEN, DAN BELLEN. Het record (met een opgehoogde poging) staat
      vast VOORDAT Stripe wordt aangeroepen. Valt het proces halverwege om, dan
      vindt de veeg hem terug en probeert hij het met DEZELFDE sleutel opnieuw --
      en geeft Stripe het eerste antwoord terug in plaats van een tweede
      transfer.

   3. GEEN GROOTBOEKKOPPELING, GEEN AFREKENING. Iedere stand heeft een
      economisch effect (reserveren, afrekenen, terugboeken) met een sleutel die
      per gebeurtenis maar een effect kan hebben. Is er geen `boekEffect`
      gekoppeld, dan weigert de aanvraag: geld laten vertrekken zonder dat het
      partnersaldo meebeweegt, is een gat in het grootboek dat er pas bij de
      reconciliatie uitkomt. */
'use strict';
const S = require('./sleutel');
const { fout } = require('./fout');

/* Definitief is een weigering van Stripe zelf (4xx behalve 409/429); al het
   andere -- netwerk, time-out, 5xx, een idempotentiebotsing op een verzoek dat
   nog loopt -- kan bij een volgende poging anders uitvallen. */
const definitief = e => !!e && Number.isInteger(e.status) && e.status >= 400 && e.status < 500 && e.status !== 409 && e.status !== 429;

function maakConnectAfrekening({ stripe, vrijgave, opslag, boekEffect = null, audit = () => {}, nu = () => Date.now() }) {
  const lopend = new Map();
  const iso = () => new Date(nu()).toISOString();
  const { boek, effect, zetStand, effectVoorStand } = require('./effect')({ opslag, boekEffect, audit, iso });

  function poort(ctx) {
    const v = vrijgave || require('../../kern/vrijgave').standaard();
    v.eis('geld.partnerafrekening', ctx);
    v.eis('geld.provider.stripe_connect', { actor: { soort: 'systeem' } });
  }

  function aanvragen({ id, partner, account, centen, valuta = 'eur', wie, reden } = {}) {
    if (!S.geldigId(id)) throw fout('Geef een geldig afrekening-id.', 'ONGELDIG', 400);
    if (!/^acct_[A-Za-z0-9]{6,}$/.test(String(account || ''))) throw fout('Geef een verbonden Stripe-account (acct_...).', 'ONGELDIG', 400);
    if (!Number.isSafeInteger(centen) || centen < 1 || centen > 10000000) throw fout('Bedrag in centen, tussen 1 en 10.000.000.', 'ONGELDIG', 400);
    if (!/^[a-z]{3}$/.test(String(valuta))) throw fout('Valuta als drie kleine letters.', 'ONGELDIG', 400);
    if (!/^user-\d+$/.test(String(wie || ''))) throw fout('Een afrekening vraagt een mens op naam.', 'ONGELDIG', 403);
    const bestaand = opslag.haal(id);
    if (bestaand) {
      /* Hetzelfde id met andere gegevens is NIET dezelfde economische
         gebeurtenis, en mag dus ook niet stil het eerste antwoord krijgen. */
      if (bestaand.account !== account || bestaand.centen !== centen || bestaand.valuta !== valuta || bestaand.partner !== String(partner || ''))
        throw fout('Dit afrekening-id bestaat al met andere gegevens.', 'BOTSING', 409);
      return { herhaald: true, afrekening: bestaand };
    }
    poort({ recht: true, actor: { soort: 'kantoor', wie } });
    if (!boek()) throw fout('Er is geen grootboekkoppeling voor partnerafrekeningen.', 'GROOTBOEK_NIET_GEKOPPELD', 503);
    const rec = { id, partner: String(partner || ''), account, centen, valuta, stand: 'aangevraagd',
      aangevraagdDoor: String(wie), reden: String(reden || '').slice(0, 300), op: iso(), pogingen: 0,
      transferId: null, payoutId: null, geschiedenis: [{ op: iso(), van: null, naar: 'aangevraagd', bron: 'kantoor' }] };
    opslag.bewaar(rec);
    try { effect(rec, 'reservering'); }
    catch (e) {
      /* De reservering is geweigerd (te weinig saldo, of een storing): dan gaat
         er niets naar Stripe. Het record blijft staan als `mislukt`, zodat het
         id niet nog eens met een andere uitkomst kan worden gebruikt. */
      zetStand(rec, 'mislukt', 'grootboek', String(e && e.message || e).slice(0, 200));
      throw fout('De reservering van het partnersaldo is geweigerd; er is niets verstuurd.', 'RESERVERING_GEWEIGERD', 409, { nietVerstuurd: true });
    }
    try { audit(String(wie), 'Partnerafrekening ' + id + ' aangevraagd: ' + centen + ' ' + valuta + ' naar ' + account); } catch (e) { /* record staat er al */ }
    return { herhaald: false, afrekening: rec };
  }

  /* Indienen bij Stripe, in twee stappen, elk met zijn eigen sleutel. Per id
     een slot binnen dit proces; tussen processen beschermen de sleutels. */
  function indienen(id) {
    if (lopend.has(id)) return lopend.get(id);
    const werk = (async () => {
      const rec = opslag.haal(id);
      if (!rec) throw fout('Onbekende afrekening.', 'ONBEKEND', 404);
      if (!stripe) throw fout('Stripe Connect is niet geconfigureerd.', 'PROVIDER_NIET_BESCHIKBAAR', 503);
      if (rec.stand === 'aangevraagd') {
        poort({ actor: { soort: 'systeem' } });
        rec.pogingen += 1; rec.laatstePoging = iso(); opslag.bewaar(rec);
        let t;
        try {
          t = await stripe.transfers.create({ amount: rec.centen, currency: rec.valuta, destination: rec.account,
            transfer_group: 'rtg-' + rec.id, metadata: { afrekening: rec.id } }, { idempotencyKey: S.idemTransfer(rec.id) });
        } catch (e) {
          rec.laatsteFout = String(e && e.message || e).slice(0, 200); opslag.bewaar(rec);
          if (definitief(e)) { zetStand(rec, 'mislukt', 'stripe-transfer', rec.laatsteFout); return rec; }
          throw fout('Stripe gaf geen uitsluitsel over de transfer; de veeg probeert het met dezelfde sleutel opnieuw.', 'OPNIEUW', 503, { opnieuw: true });
        }
        if (!t || !t.id || t.amount !== rec.centen || String(t.currency).toLowerCase() !== rec.valuta || t.destination !== rec.account) {
          opslag.bevinding({ soort: 'transfer-wijkt-af', afrekening: rec.id, gezien: t ? { id: t.id, amount: t.amount, currency: t.currency, destination: t.destination } : null });
          throw fout('Het antwoord van Stripe op de transfer klopt niet met de aanvraag; zie de bevindingen.', 'AFWIJKING', 502);
        }
        rec.transferId = t.id; opslag.bewaar(rec);
        zetStand(rec, 'ingediend', 'stripe-transfer');
      }
      if (rec.stand === 'ingediend' && !rec.payoutId) {
        poort({ actor: { soort: 'systeem' } });
        rec.pogingen += 1; rec.laatstePoging = iso(); opslag.bewaar(rec);
        let p;
        try {
          p = await stripe.payouts.create({ amount: rec.centen, currency: rec.valuta, metadata: { afrekening: rec.id } },
            { idempotencyKey: S.idemPayout(rec.id), stripeAccount: rec.account });
        } catch (e) {
          rec.laatsteFout = String(e && e.message || e).slice(0, 200); opslag.bewaar(rec);
          if (definitief(e)) { zetStand(rec, 'mislukt', 'stripe-payout', rec.laatsteFout); return rec; }
          throw fout('Stripe gaf geen uitsluitsel over de payout; de veeg probeert het met dezelfde sleutel opnieuw.', 'OPNIEUW', 503, { opnieuw: true });
        }
        if (!p || !p.id || p.amount !== rec.centen) {
          opslag.bevinding({ soort: 'payout-wijkt-af', afrekening: rec.id, gezien: p ? { id: p.id, amount: p.amount } : null });
          throw fout('Het antwoord van Stripe op de payout klopt niet met de aanvraag; zie de bevindingen.', 'AFWIJKING', 502);
        }
        rec.payoutId = p.id; opslag.bewaar(rec);
        zetStand(rec, 'onderweg', 'stripe-payout');
        if (p.status === 'paid') zetStand(rec, 'betaald', 'stripe-payout');
      }
      return rec;
    })();
    lopend.set(id, werk);
    const los = () => { lopend.delete(id); };
    werk.then(los, los);
    return werk;
  }

  return { aanvragen, indienen, zetStand, effectVoorStand, poort, opslag, stripe, definitief };
}

module.exports = { maakConnectAfrekening, definitief };