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
  function naar(rec, doel, bron) {
    const m = T.mag(rec.stand, doel);
    if (m.mag) return zetStand(rec, doel, bron);
    const p = T.pad(rec.stand, doel);
    if (!p) return zetStand(rec, doel, bron);    // laat de tabel de bevinding schrijven
    for (const tussen of p) if (!zetStand(rec, tussen, bron + (tussen === doel ? '' : ' (tussenstap)'))) return false;
    return true;
  }

  function verwerk(evt) {
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
      if (doel) uit = naar(rec, doel, 'melding:' + evt.type);
    } else if (evt.type === 'transfer.reversed') {
      /* Gedeeltelijk teruggedraaid is iets anders dan teruggedraaid; daar is geen
         stand voor, dus het wordt een bevinding voor een mens. */
      if (Number(obj.amount_reversed) >= rec.centen || obj.reversed === true) uit = naar(rec, 'teruggedraaid', 'melding:' + evt.type);
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
      if (rec.stand === 'teruggedraaid') { effectVoorStand(rec); continue; }
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
            else naar(nu, doel, 'veeg');
          }
        }
        if (nu.transferId && !['teruggedraaid', 'aangevraagd'].includes(nu.stand)) {
          const t = await stripe.transfers.retrieve(nu.transferId);
          if (t && (t.reversed === true || Number(t.amount_reversed) >= nu.centen)) naar(nu, 'teruggedraaid', 'veeg');
        }
        effectVoorStand(opslag.haal(rec.id));
      } catch (e) { uit.fouten.push({ afrekening: rec.id, fout: String(e && e.message || e).slice(0, 160) }); }
    }
    return uit;
  }

  /* De reconciliatie: per afrekening wat Stripe zegt naast wat RTG vastlegde,
     en of ieder vereist effect precies een keer in het effectjournaal staat. */
  async function reconciliatie() {
    const voor = opslag.bevindingen().length;
    let gecontroleerd = 0;
    const effecten = opslag.effecten();
    const S = require('./sleutel');
    const heeft = (rec, soort) => !!effecten[S.economisch(rec.id, soort)];
    for (const rec of opslag.alle()) {
      gecontroleerd += 1;
      const b = (soort, extra) => opslag.bevinding(Object.assign({ soort, afrekening: rec.id, bron: 'reconciliatie' }, extra || {}));
      if (stripe && rec.transferId) {
        try {
          const t = await stripe.transfers.retrieve(rec.transferId);
          if (!t || t.amount !== rec.centen || String(t.currency).toLowerCase() !== rec.valuta || t.destination !== rec.account)
            b('transfer-wijkt-af', { gezien: t ? { amount: t.amount, currency: t.currency, destination: t.destination } : null });
          if (t && (t.reversed === true || Number(t.amount_reversed) >= rec.centen) && rec.stand !== 'teruggedraaid')
            b('stand-wijkt-af', { stripe: 'teruggedraaid', rtg: rec.stand });
        } catch (e) { b('niet-op-te-halen', { wat: 'transfer', fout: String(e.message || e).slice(0, 120) }); }
      }
      if (stripe && rec.payoutId) {
        try {
          const p = await stripe.payouts.retrieve(rec.payoutId, { stripeAccount: rec.account });
          const doel = p && PAYOUT_STATUS[p.status];
          if (!p || p.amount !== rec.centen) b('payout-wijkt-af', { gezien: p ? { amount: p.amount } : null });
          else if (doel && doel !== rec.stand && rec.stand !== 'teruggedraaid') b('stand-wijkt-af', { stripe: doel, rtg: rec.stand });
        } catch (e) { b('niet-op-te-halen', { wat: 'payout', fout: String(e.message || e).slice(0, 120) }); }
      }
      // het grootboek: welk effect hoort bij deze stand, en staat het er
      if (rec.stand !== 'mislukt' || rec.transferId) {
        if (!heeft(rec, 'reservering')) b('effect-ontbreekt', { effect: 'reservering' });
      }
      if (rec.stand === 'betaald' && !heeft(rec, 'afgerekend')) b('effect-ontbreekt', { effect: 'afgerekend' });
      if (rec.stand === 'teruggedraaid' && heeft(rec, 'reservering') && !heeft(rec, 'teruggeboekt')) b('effect-ontbreekt', { effect: 'teruggeboekt' });
      if ((rec.stand === 'mislukt' || rec.stand === 'geannuleerd') && !rec.transferId && heeft(rec, 'reservering') && !heeft(rec, 'teruggeboekt'))
        b('effect-ontbreekt', { effect: 'teruggeboekt' });
      if (heeft(rec, 'afgerekend') && !['betaald', 'teruggedraaid'].includes(rec.stand)) b('effect-zonder-stand', { effect: 'afgerekend' });
    }
    const nieuw = opslag.bevindingen().slice(voor);
    return { gecontroleerd, nieuweBevindingen: nieuw, sluit: nieuw.length === 0 };
  }

  return { verwerk, veeg, reconciliatie };
}

module.exports = { maakMelding, PAYOUT, PAYOUT_STATUS };
