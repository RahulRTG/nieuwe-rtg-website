/* Terugbetalingen bij de betaalwaarheid. Zowel een RTG-opdracht als een
   provider-webhook komt hier uit; één provider-refund telt daardoor nooit
   dubbel, ook niet als de webhook opnieuw of na een herstart arriveert. */
'use strict';

module.exports = function teruglaag(ctx) {
  const { d, doos, save, nuIso, gebeurtenis, naar, STATUS, definitiefBetaald,
    publiek, betaal, hash } = ctx;
  const lopend = new Map();
  const ACTIEF = new Set(['VASTGELEGD', 'BIJ_PROVIDER']);

  function opdrachten(r) {
    if (!Array.isArray(r.terugbetaalOpdrachten)) r.terugbetaalOpdrachten = [];
    return r.terugbetaalOpdrachten;
  }

  function opdrachtSleutel(r, invoer, centen) {
    const eigen = String(invoer.idem || '').trim();
    const grond = eigen ? 'idem:' + hash(eigen) : 'stand:' + (r.terugbetaaldCenten || 0) + ':' + centen;
    return 'terug:' + r.id + ':' + hash(grond).slice(0, 24);
  }

  function zoekOpdracht(r, invoer) {
    const lijst = opdrachten(r);
    if (invoer.opdrachtId) return lijst.find(x => x.id === invoer.opdrachtId) || null;
    if (invoer.providerRefundId) {
      const op = lijst.find(x => x.providerRefundId === String(invoer.providerRefundId));
      if (op) return op;
    }
    const c = Math.round(Number(invoer.centen));
    const passend = lijst.filter(x => ACTIEF.has(x.status) && x.centen === c);
    return passend.length === 1 ? passend[0] : null;
  }

  function zetControle(r, invoer, blokkade) {
    r.blokkade = blokkade;
    const op = zoekOpdracht(r, invoer);
    if (op) { op.status = 'CONTROLE_NODIG'; op.bijgewerktAt = nuIso(); }
    naar(r, STATUS.CONTROLE_NODIG, { bron: invoer.aanbieder || r.provider,
      providerRefundId: invoer.providerRefundId || null,
      ontvangenCenten: Math.round(Number(invoer.centen)), valuta: invoer.valuta || null });
    save();
    return false;
  }

  function boek(r, invoer) {
    const providerRefundId = String(invoer.providerRefundId || invoer.id || '');
    if (!Array.isArray(r.terugbetalingen)) r.terugbetalingen = [];
    const op = zoekOpdracht(r, Object.assign({}, invoer, { providerRefundId }));
    if (providerRefundId && r.terugbetalingen.some(x => x.providerRefundId === providerRefundId)) {
      if (op && op.status !== 'BEVESTIGD') {
        op.status = 'BEVESTIGD'; op.providerRefundId = providerRefundId; op.bijgewerktAt = nuIso(); save();
      }
      return true;
    }
    const centen = Math.round(Number(invoer.centen));
    if (invoer.valuta && String(invoer.valuta).toLowerCase() !== r.valuta)
      return zetControle(r, invoer, 'terugbetaalvaluta-wijkt-af');
    const gereserveerd = opdrachten(r).filter(x => x !== op && ACTIEF.has(x.status))
      .reduce((som, x) => som + x.centen, 0);
    const resterend = r.centen - (r.terugbetaaldCenten || 0) - gereserveerd;
    if (!Number.isFinite(centen) || centen <= 0 || centen > resterend) {
      return zetControle(r, Object.assign({}, invoer, { providerRefundId }), 'terugbetaalbedrag-wijkt-af');
    }
    if (r.status !== STATUS.TERUGBETALING_WACHT &&
        !naar(r, STATUS.TERUGBETALING_WACHT, { bron: invoer.aanbieder || r.provider, centen }))
      return zetControle(r, Object.assign({}, invoer, { providerRefundId }), 'terugbetaling-status-wijkt-af');
    r.terugbetaaldCenten = (r.terugbetaaldCenten || 0) + centen;
    r.terugbetalingen.push({ providerRefundId: providerRefundId || null,
      centen, at: nuIso(), aanbieder: invoer.aanbieder || r.provider });
    if (op) {
      op.status = 'BEVESTIGD'; op.providerRefundId = providerRefundId || op.providerRefundId || null;
      op.bijgewerktAt = nuIso();
    }
    naar(r, r.terugbetaaldCenten === r.centen ? STATUS.TERUGBETAALD : STATUS.GEDEELTELIJK_TERUGBETAALD,
      { bron: invoer.aanbieder || r.provider, providerRefundId, centen });
    save(); return true;
  }

  async function terugbetalen(id, invoer) {
    const r = doos()[id];
    if (!r || !definitiefBetaald(r.status)) throw new Error('Alleen bevestigd geld kan terugbetaald worden.');
    const centen = Math.round(Number(invoer.centen));
    const sleutel = opdrachtSleutel(r, invoer, centen);
    let op = opdrachten(r).find(x => x.idemSleutel === sleutel);
    if (op && op.centen !== centen) throw new Error('Deze terugbetaalsleutel hoort al bij een andere opdracht.');
    if (op && op.status === 'BEVESTIGD') return publiek(r);
    if (op && !ACTIEF.has(op.status))
      throw new Error('Deze terugbetaling wacht op menselijke controle en mag niet automatisch opnieuw worden aangeboden.');
    const andereActief = opdrachten(r).find(x => ACTIEF.has(x.status) && x !== op);
    if (andereActief) throw new Error('Er loopt al een terugbetaling voor deze betaling. Wacht op de providerbevestiging.');
    const gereserveerd = opdrachten(r).filter(x => ACTIEF.has(x.status) && x !== op)
      .reduce((som, x) => som + x.centen, 0);
    const resterend = r.centen - (r.terugbetaaldCenten || 0) - gereserveerd;
    if (!Number.isFinite(centen) || centen <= 0 || centen > resterend) throw new Error('Ongeldig terugbetaalbedrag.');
    if (!op) {
      op = { id: 'TR-' + hash(sleutel).slice(0, 16).toUpperCase(), idemSleutel: sleutel,
        centen, reden: String(invoer.reden || '').slice(0, 120), status: 'VASTGELEGD',
        providerRefundId: null, pogingen: 0, at: nuIso(), bijgewerktAt: nuIso() };
      opdrachten(r).push(op);
      if (!naar(r, STATUS.TERUGBETALING_WACHT, { centen, reden: op.reden, opdrachtId: op.id })) {
        opdrachten(r).pop(); throw new Error('De betaling staat niet in een terugbetaalbare toestand.');
      }
      gebeurtenis(r, 'TERUGBETALING_VASTGELEGD', { opdrachtId: op.id, centen });
      save(); /* bedrag is gereserveerd VOORDAT de externe rail wordt gebeld */
    }
    const bezig = lopend.get(op.id);
    if (bezig) return bezig;
    const werk = (async () => {
      op.pogingen += 1; op.bijgewerktAt = nuIso(); save();
      let p;
      try {
        p = await betaal.maakTerugbetaling({ aanbieder: r.provider,
          providerId: r.providerPaymentId || r.providerId, bedrag: centen, valuta: r.valuta,
          referentie: r.id, idempotentieSleutel: sleutel, omschrijving: invoer.reden });
      } catch (e) {
        op.laatsteFout = String(e && e.message || e).slice(0, 180); op.bijgewerktAt = nuIso();
        gebeurtenis(r, 'TERUGBETALING_PROVIDER_FOUT', { opdrachtId: op.id, poging: op.pogingen, fout: op.laatsteFout });
        save(); throw e;
      }
      op.providerRefundId = p.id || op.providerRefundId || null;
      op.providerStatus = p.status || 'wacht'; op.status = 'BIJ_PROVIDER'; op.bijgewerktAt = nuIso();
      if (Number.isFinite(p.bedrag) && Math.round(p.bedrag) !== centen)
        zetControle(r, { opdrachtId: op.id, providerRefundId: p.id, centen: p.bedrag,
          valuta: p.valuta, aanbieder: r.provider }, 'terugbetaalbedrag-wijkt-af');
      else if (p.valuta && String(p.valuta).toLowerCase() !== r.valuta)
        zetControle(r, { opdrachtId: op.id, providerRefundId: p.id, centen,
          valuta: p.valuta, aanbieder: r.provider }, 'terugbetaalvaluta-wijkt-af');
      else if (['refunded', 'succeeded'].includes(String(p.status || '').toLowerCase()))
        boek(r, { opdrachtId: op.id, providerRefundId: p.id, centen, valuta: r.valuta, aanbieder: r.provider });
      else if (['failed', 'canceled', 'cancelled'].includes(String(p.status || '').toLowerCase()))
        zetControle(r, { opdrachtId: op.id, providerRefundId: p.id, centen, valuta: r.valuta,
          aanbieder: r.provider }, 'terugbetaling-mislukt');
      else {
        r.laatsteTerugbetaling = { providerRefundId: p.id || null, centen, status: p.status || 'wacht', at: nuIso() };
        gebeurtenis(r, 'TERUGBETALING_BIJ_PROVIDER', { bron: r.provider, opdrachtId: op.id,
          providerRefundId: p.id || null, centen, providerStatus: p.status || null });
        save();
      }
      return publiek(r);
    })();
    lopend.set(op.id, werk);
    try { return await werk; } finally { lopend.delete(op.id); }
  }

  async function providerTerugbetaling(invoer) {
    const meldingen = d().betaalWaarheidMeldingen || (d().betaalWaarheidMeldingen = {});
    const eventId = String(invoer.eventId || ('refund:' + invoer.providerRefundId));
    if (meldingen[eventId] && meldingen[eventId].verwerktAt) return meldingen[eventId].betalingId || null;
    if (!meldingen[eventId]) meldingen[eventId] = { eventId, aanbieder: invoer.aanbieder,
      providerId: invoer.providerPaymentId || null, ontvangenAt: nuIso(), verwerktAt: null, soort: 'terugbetaling' };
    save();
    const r = Object.values(doos()).find(x =>
      (invoer.providerPaymentId && (x.providerPaymentId === invoer.providerPaymentId || x.providerId === invoer.providerPaymentId)) ||
      (invoer.referentie && x.id === invoer.referentie));
    if (!r) throw new Error('De oorspronkelijke betaling van deze terugbetaling is niet gevonden.');
    const bron = String(invoer.aanbieder || '').trim().toLowerCase();
    const eigenaar = String(r.provider || '').trim().toLowerCase();
    if (!bron || !eigenaar || bron !== eigenaar) {
      /* Een providerreferentie is geen bewijs dat die provider dit geld bezit.
         Een ondertekend Stripe-bericht mag dus nooit via alleen de RTG-
         referentie een Mollie- of Adyen-betaling terugboeken. Dit is een
         semantische mismatch: opnieuw aanbieden verandert hem niet, daarom
         zetten we de waarheid zichtbaar op menselijke controle en sluiten we
         alleen de inboxregel af. Er wordt geen cent geboekt. */
      zetControle(r, invoer, 'terugbetaalprovider-wijkt-af');
    } else if (invoer.gelukt === false) {
      zetControle(r, invoer, 'terugbetaling-mislukt');
    } else boek(r, { providerRefundId: invoer.providerRefundId,
      centen: invoer.centen, valuta: invoer.valuta, aanbieder: invoer.aanbieder });
    meldingen[eventId].betalingId = r.id; meldingen[eventId].verwerktAt = nuIso(); save();
    return r.id;
  }

  return { terugbetalen, providerTerugbetaling };
};
