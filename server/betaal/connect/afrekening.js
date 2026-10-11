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
  const iso = () => new Date(nu()).toISOString();
  const { boek, effect, zetStand, effectVoorStand } = require('./effect')({ opslag, boekEffect, audit, iso });

  function poort(ctx) {
    const v = vrijgave || require('../../kern/vrijgave').standaard();
    v.eis('geld.partnerafrekening', ctx);
    v.eis('geld.provider.stripe_connect', { actor: { soort: 'systeem' } });
  }

  /* ASYNCHROON sinds de grootboekkoppeling het echte grootboek van RTG Pay is:
     de reservering is een boeking, en die wacht op de opslag (en in de
     motorstand op de motor). Een aanvraag geeft dus een belofte terug. */
  /* De vorm van een aanvraag, los gevraagd zodat de route hem kan keuren VOOR
     hij een tweede handtekening aanvraagt (server/routes/kantoren/connect.js). */
  function keurAanvraag({ id, account, centen, valuta = 'eur', wie } = {}) {
    if (!S.geldigId(id)) throw fout('Geef een geldig afrekening-id.', 'ONGELDIG', 400);
    if (!/^acct_[A-Za-z0-9]{6,}$/.test(String(account || ''))) throw fout('Geef een verbonden Stripe-account (acct_...).', 'ONGELDIG', 400);
    if (!Number.isSafeInteger(centen) || centen < 1 || centen > 10000000) throw fout('Bedrag in centen, tussen 1 en 10.000.000.', 'ONGELDIG', 400);
    if (!/^[a-z]{3}$/.test(String(valuta))) throw fout('Valuta als drie kleine letters.', 'ONGELDIG', 400);
    if (!/^user-\d+$/.test(String(wie || ''))) throw fout('Een afrekening vraagt een mens op naam.', 'ONGELDIG', 403);
  }

  async function aanvragen({ id, partner, account, centen, valuta = 'eur', wie, reden, bevestigdDoor = null } = {}) {
    keurAanvraag({ id, account, centen, valuta, wie });
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
      aangevraagdDoor: String(wie), bevestigdDoor: bevestigdDoor && /^user-\d+$/.test(String(bevestigdDoor)) ? String(bevestigdDoor) : null,
      reden: String(reden || '').slice(0, 300), op: iso(), pogingen: 0,
      transferId: null, payoutId: null, geschiedenis: [{ op: iso(), van: null, naar: 'aangevraagd', bron: 'kantoor' }] };
    opslag.bewaar(rec);
    /* Het record staat duurzaam VOOR de reservering: een reservering zonder
       record kan na een herstart door niemand worden afgerekend of teruggeboekt.
       Andersom (record zonder effect) haalt de veeg in, met dezelfde sleutel. */
    await opslag.vast();
    try { await effect(rec, 'reservering'); }
    catch (e) {
      /* De reservering is geweigerd (te weinig saldo, of een storing): dan gaat
         er niets naar Stripe. Het record blijft staan als `mislukt`, zodat het
         id niet nog eens met een andere uitkomst kan worden gebruikt. */
      await zetStand(rec, 'mislukt', 'grootboek', String(e && e.message || e).slice(0, 200));
      await opslag.vast();
      throw fout('De reservering van het partnersaldo is geweigerd; er is niets verstuurd.', 'RESERVERING_GEWEIGERD', 409, { nietVerstuurd: true });
    }
    /* De aanvraag en haar reservering staan vast voordat iemand ze indient. */
    await opslag.vast();
    try { audit(String(wie), 'Partnerafrekening ' + id + ' aangevraagd: ' + centen + ' ' + valuta + ' naar ' + account); } catch (e) { /* record staat er al */ }
    return { herhaald: false, afrekening: rec };
  }

  /* Indienen bij Stripe (transfer, dan payout, elk met een eigen sleutel):
     ./indienen.js. */
  const indienen = require('./indienen')({ stripe, opslag, poort, zetStand, iso, definitief });

  return { aanvragen, keurAanvraag, indienen, zetStand, effectVoorStand, poort, opslag, stripe, definitief };
}

module.exports = { maakConnectAfrekening, definitief };