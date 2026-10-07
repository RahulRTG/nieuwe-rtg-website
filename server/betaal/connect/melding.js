/* PARTNERAFREKENING OVER STRIPE CONNECT: wat er AL gebeurde.

   Drie dingen, en geen van drieen maakt een nieuw effect bij Stripe:
     verwerk()        een geverifieerde Connect-melding (payout.paid, payout.failed,
                      payout.canceled, payout.updated, transfer.reversed, ...)
     veeg()           na een herstart of een time-out: de stand van alles wat nog
                      liep bij Stripe OPHALEN, en wat bleef hangen opnieuw
                      indienen -- dat laatste alleen als de vrijgavepoort het
                      toestaat, en altijd met dezelfde sleutel
     reconciliatie()  Stripe naast het grootboek leggen; ieder verschil wordt een
                      zichtbare BEVINDING en nooit een correctie

   WAAROM EEN MELDING NOOIT ZELF GELD CORRIGEERT. Een bedrag dat afwijkt, een
   account dat niet klopt, een stand die terug wil: allemaal bevindingen, en de
   stand blijft staan. Een systeem dat zichzelf rechtzet op grond van een melding,
   laat zich rechtzetten door wie een melding kan maken. Corrigeren doet een
   mens.

   DE HANDTEKENING wordt NIET hier gecontroleerd maar in de route
   (server/opzet/connectwebhook.js), met dezelfde `constructEvent` als de
   gewone betaalwebhook (server/stripe.js, via server/betaal/webhook.js). Wat
   hier binnenkomt is dus al van Stripe. */
'use strict';
const T = require('./toestand');

const PAYOUT = Object.freeze({ 'payout.paid': 'betaald', 'payout.failed': 'mislukt', 'payout.canceled': 'geannuleerd' });
const PAYOUT_STATUS = Object.freeze({ paid: 'betaald', failed: 'mislukt', canceled: 'geannuleerd', pending: 'onderweg', in_transit: 'onderweg' });

function maakMelding(kern) {
  const { opslag, zetStand, effectVoorStand, indienen, stripe } = kern;

  function vindRec(obj) {
    const id = obj && obj.metadata && obj.metadata.afrekening;
    if (id && opslag.haal(String(id))) return opslag.haal(String(id));
    if (obj && obj.id) return opslag.alle().find(r => r.payoutId === obj.id || r.transferId === obj.id) || null;
    return null;
  }

  /* Naar een latere stand, eventueel langs de tussenstappen die een gemiste
     melding oversloeg. Nooit door een eindstand heen. */
  async function naar(rec, doel, bron) {
    const m = T.mag(rec.stand, doel);
    if (m.mag) return zetStand(rec, doel, bron);
    const p = T.pad(rec.stand, doel);
    if (!p) return zetStand(rec, doel, bron);    // laat de tabel de bevinding schrijven
    for (const tussen of p) if (!(await zetStand(rec, tussen, bron + (tussen === doel ? '' : ' (tussenstap)')))) return false;
    return true;
  }

  /* ASYNCHROON: een stand kan een boeking in het grootboek betekenen, en de
     melding is pas verwerkt als die boeking EN de stand duurzaam staan
     (`opslag.vast()`). Pas daarna mag de webhook 200 zeggen; anders stuurt
     Stripe hem niet opnieuw en is een betaalde afrekening na een herstart weer
     onderweg. */
  async function verwerk(evt) {
    const uit = await verwerkInGeheugen(evt);
    await opslag.vast();
    return uit;
  }
  async function verwerkInGeheugen(evt) {
    if (!evt || typeof evt.id !== 'string' || typeof evt.type !== 'string') return { genegeerd: 'geen melding' };
    if (opslag.gezien(evt.id)) return { herhaald: true };
    const obj = (evt.data && evt.data.object) || {};
    const relevant = evt.type.startsWith('payout.') || evt.type.startsWith('transfer.');
    if (!relevant) { opslag.markeer(evt.id, 'niet-relevant'); return { genegeerd: evt.type }; }
    const rec = vindRec(obj);
    if (!rec) {
      opslag.bevinding({ soort: 'onbekende-melding', eventId: evt.id, type: evt.type, object: obj.id || null });
      opslag.markeer(evt.id, 'onbekend');
      return { onbekend: true };
    }
    /* Een payoutmelding komt van een verbonden account en draagt dat account in
       `account`. Hoort het niet bij deze afrekening, dan is het een melding over
       iets anders -- of een poging om deze afrekening met een andere te laten
       sluiten. Hoe dan ook: geen standwijziging. */
    if (evt.type.startsWith('payout.') && evt.account && evt.account !== rec.account) {
      opslag.bevinding({ soort: 'account-wijkt-af', afrekening: rec.id, eventId: evt.id, gezien: evt.account });
      opslag.markeer(evt.id, 'account-wijkt-af');
      return { bevinding: 'account-wijkt-af' };
    }
    if (Number.isFinite(obj.amount) && obj.amount !== rec.centen) {
      opslag.bevinding({ soort: 'bedrag-wijkt-af', afrekening: rec.id, eventId: evt.id, gezien: obj.amount, verwacht: rec.centen });
      opslag.markeer(evt.id, 'bedrag-wijkt-af');
      return { bevinding: 'bedrag-wijkt-af' };
    }
    let uit = null;
    if (evt.type.startsWith('payout.')) {
      if (obj.id && !rec.payoutId && rec.transferId) { rec.payoutId = obj.id; opslag.bewaar(rec); }
      const doel = PAYOUT[evt.type] || (evt.type === 'payout.updated' || evt.type === 'payout.created' ? PAYOUT_STATUS[obj.status] : null);
      if (doel) uit = await naar(rec, doel, 'melding:' + evt.type);
    } else if (evt.type === 'transfer.reversed') {
      /* Gedeeltelijk teruggedraaid is iets anders dan teruggedraaid; daar is geen
         stand voor, dus het wordt een bevinding voor een mens. */
      if (Number(obj.amount_reversed) >= rec.centen || obj.reversed === true) uit = await naar(rec, 'teruggedraaid', 'melding:' + evt.type);
      else opslag.bevinding({ soort: 'gedeeltelijk-teruggedraaid', afrekening: rec.id, eventId: evt.id, teruggedraaid: obj.amount_reversed });
    }
    opslag.markeer(evt.id, rec.id);
    return { afrekening: rec.id, stand: rec.stand, toegepast: uit };
  }

  async function veeg() {
    const uit = { bekeken: 0, ingediend: 0, wacht: [], fouten: [] };
    for (const rec of opslag.alle()) {
      /* Teruggedraaid kan nergens meer heen; mislukt en geannuleerd wel (een
         transfer die nadien wordt teruggedraaid), dus die worden nog bekeken. */
      if (rec.stand === 'teruggedraaid') {
        try { await effectVoorStand(rec); await opslag.vast(); }
        catch (e) { uit.fouten.push({ afrekening: rec.id, fout: String(e && e.message || e).slice(0, 160) }); }
        continue;
      }
      uit.bekeken += 1;
      try {
        if (rec.stand === 'aangevraagd' || (rec.stand === 'ingediend' && !rec.payoutId)) {
          try { await indienen(rec.id); uit.ingediend += 1; }
          catch (e) { if (e.code === 'VRIJGAVE_DICHT') uit.wacht.push({ afrekening: rec.id, code: e.vrijgaveCode }); else throw e; }
        }
        if (!stripe) continue;
        const nu = opslag.haal(rec.id);
        if (nu.stand === 'onderweg' && nu.payoutId) {
          const p = await stripe.payouts.retrieve(nu.payoutId, { stripeAccount: nu.account });
          const doel = p && PAYOUT_STATUS[p.status];
          if (doel && doel !== nu.stand) {
            if (p.amount !== nu.centen) opslag.bevinding({ soort: 'bedrag-wijkt-af', afrekening: nu.id, gezien: p.amount, verwacht: nu.centen, bron: 'veeg' });
            else await naar(nu, doel, 'veeg');
          }
        }
        if (nu.transferId && !['teruggedraaid', 'aangevraagd'].includes(nu.stand)) {
          const t = await stripe.transfers.retrieve(nu.transferId);
          if (t && (t.reversed === true || Number(t.amount_reversed) >= nu.centen)) await naar(nu, 'teruggedraaid', 'veeg');
        }
        await effectVoorStand(opslag.haal(rec.id));
        await opslag.vast();
      } catch (e) { uit.fouten.push({ afrekening: rec.id, fout: String(e && e.message || e).slice(0, 160) }); }
    }
    return uit;
  }

  /* De reconciliatie (Stripe naast het grootboek, ieder verschil een
     bevinding): ./reconciliatie.js. */
  const reconciliatie = require('./reconciliatie')({ opslag, stripe, PAYOUT_STATUS });

  return { verwerk, veeg, reconciliatie };
}

module.exports = { maakMelding, PAYOUT, PAYOUT_STATUS };
