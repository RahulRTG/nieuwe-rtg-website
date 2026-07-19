/* De Butler-acties (kern/fluister): het doe-deel van de assistent. voerUit
   voert een bevestigd voorstel uit (bestellen, Tik, tickets, behandeling,
   rit, 24-uursblok, reisplan) via exact dezelfde functies als de
   app-knoppen. Het gesprek zelf (fluisterZeg) woont in gesprek.js en
   krijgt voerUit via de context mee. */
module.exports = (ctx) => {
  const { db, save, schoon, anthropic, notify, reserveerTafel, annuleerReservering,
    assetGebruik, zorgVoor, pay, acties, nu, wieBen, lijsten, van,
    fluisterOnthoud, fluisterVergeet, teSnel, fluisterSeintjes, standVan, topFocus, eur, datumInZin,
    butlerExtra, voerReisUit, voerKledingUit } = ctx;

  async function voerUit(key, codenaam, w, sess) {
    // bestellen: plaatsen en direct afrekenen via exact dezelfde functies
    // als de app-knoppen (ledenprijs, 86, leeftijd, zorgprofiel incluis)
    if (w.soort === 'bestelling' && sess && acties && acties.plaatsOrder) {
      const r = acties.plaatsOrder(sess, { supplierCode: w.supplierCode, items: w.items });
      if (r.error) return { tekst: 'Dat lukt niet: ' + r.error };
      const b = acties.betaalOrder(sess, { ref: r.order.ref });
      if (b.error) return { tekst: 'De bestelling staat klaar (' + r.order.ref + '), maar het afrekenen lukte niet: ' + b.error + ' Rond hem af in de Bestellen-tab.', gedaan: true };
      return { tekst: 'Besteld en betaald bij ' + r.order.supplierName + ': ' + w.oms + ', samen ' + eur(b.order.total * 100) + '. Uw ophaalcode is ' + r.order.pickup + '; de zaak gaat er direct mee aan de slag.', gedaan: true };
    }
    if (w.soort === 'blok' && assetGebruik) {
      const r = assetGebruik({ key }, w.assetId, w.datum);
      if (r.error) return { tekst: 'Dat lukt niet: ' + r.error };
      return { tekst: 'Geregeld: uw 24 uur bij ' + r.gebruik.assetNaam + ' staat op ' + w.datum + ' (nog ' + r.dagenTegoed + ' dag(en) tegoed dit jaar). Het team neemt vooraf contact op.', gedaan: true };
    }
    if (w.soort === 'tik' && pay) {
      const r = await pay.stuur({ van: codenaam, aanCodenaam: w.aan, centen: w.centen, oms: 'Via Rahul', soort: 'tik' });
      if (r.error) return { tekst: 'Dat lukt niet: ' + r.error };
      return { tekst: 'Gedaan: ' + eur(w.centen) + ' aan ' + w.aan + ' gestuurd via een Tik. Uw saldo: ' + eur(r.saldo) + '.', gedaan: true };
    }
    // tickets voor een activiteit: boeken en direct afrekenen, entreecode terug
    if (w.soort === 'ticket' && sess && acties && acties.koopTicket) {
      const r = acties.koopTicket(sess, { supplierCode: w.supplierCode, activiteitId: w.activiteitId, datum: w.datum, tijd: w.tijd, personen: w.personen });
      if (r.error) return { tekst: 'Dat lukt niet: ' + r.error };
      const b = acties.betaalBoeking(sess, { ref: r.ticket.ref });
      if (b.error) return { tekst: 'De tickets staan klaar (' + r.ticket.ref + '), maar het afrekenen lukte niet: ' + b.error, gedaan: true };
      return { tekst: 'Geboekt en betaald: ' + w.oms + ' op ' + w.datum + ' om ' + w.tijd + ', samen ' + eur((r.ticket.price || 0) * 100) + '. Uw entreecode is ' + r.ticket.code + '; laat hem bij de deur oplichten.', gedaan: true };
    }
    // een behandeling: boeken en direct afrekenen (het zorgprofiel reist mee)
    if (w.soort === 'behandeling' && sess && acties && acties.boekBehandeling) {
      const r = acties.boekBehandeling(sess, { aanbiederId: w.aanbiederId, behandelingId: w.behandelingId, datum: w.datum, tijd: w.tijd, codenaam });
      if (r.error) return { tekst: 'Dat lukt niet: ' + r.error };
      return { tekst: 'Geboekt en betaald: ' + w.oms + ' op ' + w.datum + ' om ' + w.tijd + ' (referentie ' + r.boeking.ref + '). Uw zorgprofiel reisde mee.' +
        (w.medisch ? ' Wilt u de behandelaar vooraf meer vertellen? Deel een intake in de Care-tab.' : ''), gedaan: true };
    }
    // een rit: aanvragen en (bij vooraf betalen) de offerte direct voldoen
    if (w.soort === 'rit' && sess && acties && acties.vraagRit) {
      const r = acties.vraagRit(sess, { supplierCode: w.supplierCode, to: w.to, toCode: w.toCode, passengers: w.personen, date: w.datum, time: w.tijd });
      if (r.error) return { tekst: 'Dat lukt niet: ' + r.error };
      let slot = '';
      if (r.ride.status === 'wacht-op-betaling') {
        const b = acties.betaalRit(sess, { ref: r.ride.ref });
        if (b.error) return { tekst: 'De rit staat klaar (' + r.ride.ref + '), maar het afrekenen lukte niet: ' + b.error, gedaan: true };
        slot = ' De offerte van ' + eur(r.ride.quote * 100) + ' is betaald;';
      } else slot = ' Offerte: ' + eur(r.ride.quote * 100) + ' (' + r.ride.betaalMoment + ');';
      return { tekst: 'Geregeld: een rit met ' + r.ride.supplierName + ' naar ' + (r.ride.to || 'uw bestemming') + ' voor ' + r.ride.passengers + '.' + slot + ' de chauffeur wordt nu toegewezen en u volgt hem live in Reizen.', gedaan: true };
    }
    if (w.soort === 'klompjes' && pay) {
      let betaald = 0, mis = null;
      for (const id of w.ids || []) {
        const r = await pay.verzoekBetaal({ codenaam, verzoekId: id });
        if (r.error) { mis = r.error; continue; }
        betaald++;
      }
      if (!betaald) return { tekst: 'Dat lukt niet: ' + (mis || 'de verzoeken zijn al weg.') };
      return { tekst: 'Gedaan: ' + betaald + ' verzoek(en) betaald, samen ' + eur(w.totaal) + '.' + (mis ? ' Een verzoek lukte niet: ' + mis : ''), gedaan: true };
    }
    // de reislaag: een hele reis in een keer, of kleding apart leggen
    if (w.soort === 'reisplan' && voerReisUit) return voerReisUit(key, codenaam, w, sess);
    if (w.soort === 'kleding' && voerKledingUit) return voerKledingUit(key, codenaam, w);
    return { tekst: 'Dat voorstel ken ik niet meer; zeg het gerust opnieuw.' };
  }

  const { fluisterZeg } = require('./gesprek')({ ...ctx, voerUit });

  return { voerUit, fluisterZeg };
};
