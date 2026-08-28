/* DE BETAALDIENSTVERGOEDING: het verschil tussen "verschuldigd" en "geboekt".

   Dit is dezelfde klasse fout als in kern/betaalopdracht/, en het is de moeite
   waard om precies te zeggen waarom. Daar was het verschil tussen "geboekt" en
   "echt weg"; hier is het verschil tussen "de zaak is dit bedrag verschuldigd"
   en "die boeking is gelukt". In kern/pay/kassa.js stond:

       if (kb.error) kosten = 0;

   Mislukte de kostenboeking, dan werden de kosten NUL. Niet uitgesteld, niet
   gemeld, niet in een rij gezet -- gewoon nul, in de teruggave aan de kassa en
   dus op de bon van de klant. Het geld verdween niet uit het grootboek (dat
   sloot netjes, er was immers niets geboekt), maar de vordering van RTG op de
   zaak verdween wel, en niemand kon achteraf zien dat hij ooit bestond. De
   stilste vorm die er is (LAT.md regel 5).

   De oorzaak is niet die ene regel, maar dat "het bedrag uitrekenen" en "het
   bedrag boeken" hetzelfde moment waren terwijl het twee gebeurtenissen zijn.
   Vandaar dat een fee hier VOOR de boekpoging wordt vastgelegd. Valt het proces
   om tijdens het boeken, dan staat er na de herstart nog steeds een openstaande
   rij die zegt dat er iets moet gebeuren.

   DE VIJF STANDEN (de Engelse namen staan erbij omdat ze in elk betaalontwerp
   voorkomen; de code van dit huis is Nederlands):

     GEINCASSEERD   payment_captured   de betaling is geslaagd; de fee is berekend
     OPENSTAAND     fee_pending        vastgelegd als vordering, nog niet geboekt
     GEBOEKT        fee_posted         de grootboekregel staat
     HERKANSING     fee_retry          de boeking mislukte; hij blijft verschuldigd
     AFGESTEMD      fee_reconciled     geboekt EN teruggevonden in het grootboek

   HERKANSING IS GEEN EINDSTAND. Dat is het hele punt: een mislukte boeking laat
   een rij achter die om aandacht vraagt, in plaats van een nul die eruitziet
   alsof er niets te doen was.

   WAAROM DIT GEEN BETAALOPDRACHT IS. Een betaalopdracht gaat over geld dat het
   HUIS verlaat, langs een externe rail, met een idempotentiesleutel omdat een
   herhaling anders een tweede echte betaling wordt. Deze fee blijft binnen: van
   de partnerrekening naar rtg:betaaldienst, twee interne rekeningen in hetzelfde
   grootboek. Er is geen rail die hem kan weigeren en geen buitenwereld die hem
   dubbel kan uitvoeren. Ze delen het patroon en niet de rij; zou deze fee in de
   betaalopdrachtrij komen, dan zou `railOpenCenten` -- het getal dat zegt
   hoeveel er geboekt is maar niet aangekomen -- bedragen gaan tellen die nooit
   ergens heen hoeven.

   WAT DIT NIET IS: een tweede boekhouding. De grootboekregel blijft de waarheid
   over wat er geboekt is; deze rij is de waarheid over wat er VERSCHULDIGD is.
   Lopen die twee uiteen, dan is dat precies wat `openstaand()` hoort te melden. */
'use strict';

/* Tijd komt uit de tijdmachine en niet van het besturingssysteem: alleen zo is
   "wat gebeurt er op 29 februari" een vraag die je kunt stellen (server/lib/klok.js).
   De injecteerbare `nu` blijft bestaan -- toetsen zetten hem -- maar de TERUGVAL
   is de klok en niet Date.now(). */
const klok = require('../../lib/klok');
/* De standen en de overgangstabel staan apart: dit bestand is de administratie.
   Zie ./fee/vorm.js. */
const { STATUS, OVERGANG, OPEN, AF, RIJ_MAX, magOvergaan } = require('./fee/vorm');

function maakFees({ db, save, nu }) {
  const tijd = nu || klok.nu;
  const eigen = require('../eigencollectie')({ db, domein: 'kern/commercie/fee', bezit: { betaaldienstFees: 'lijst' } });
  function rij() { return eigen.bak('betaaldienstFees'); }

  function zet(f, naar, velden) {
    if (!magOvergaan(f.status, naar))
      return { error: 'Een betaaldienstvergoeding kan niet van ' + f.status + ' naar ' + naar + '.' };
    f.status = naar;
    f.bijgewerkt = tijd();
    Object.assign(f, velden || {});
    (f.verloop = f.verloop || []).push({ naar, at: f.bijgewerkt });
    save();
    return { ok: true, fee: f };
  }

  /* Stap 1: de betaling is geslaagd en de fee is berekend. Wordt vastgelegd
     VOORDAT er geboekt wordt -- dat is de hele reparatie. `centen` mag 0 zijn
     (geen tarief ingesteld); dan is er niets verschuldigd en komt er ook geen
     rij, want een vordering van nul is geen vordering. */
  function incasseer({ supplierCode, centen, transactieCenten, ref }) {
    const c = Math.max(0, Math.round(Number(centen) || 0));
    if (c === 0) return null;
    const f = {
      id: 'fee_' + Math.random().toString(36).slice(2, 10) + '_' + rij().length,
      supplierCode: String(supplierCode || ''),
      centen: c,
      transactieCenten: Math.round(Number(transactieCenten) || 0),
      ref: ref || null,
      status: STATUS.GEINCASSEERD,
      pogingen: 0,
      laatsteFout: null,
      ledgerRef: null,
      at: tijd(),
      bijgewerkt: tijd(),
      verloop: [{ naar: STATUS.GEINCASSEERD, at: tijd() }]
    };
    rij().unshift(f);
    if (rij().length > RIJ_MAX) rij().length = RIJ_MAX;
    zet(f, STATUS.OPENSTAAND);
    return f;
  }

  // Stap 2a: de grootboekregel staat.
  function geboekt(f, ledgerRef) {
    if (!f) return { error: 'geen vergoeding' };
    return zet(f, STATUS.GEBOEKT, { ledgerRef: ledgerRef || null, laatsteFout: null });
  }

  /* Stap 2b: de boeking mislukte. De vergoeding BLIJFT verschuldigd; alleen de
     boeking moet over. De fout wordt bewaard, want "het lukte niet" zonder reden
     is een rij waar niemand iets mee kan. */
  function mislukt(f, fout) {
    if (!f) return { error: 'geen vergoeding' };
    return zet(f, STATUS.HERKANSING, {
      pogingen: (f.pogingen || 0) + 1,
      laatsteFout: String((fout && fout.error) || fout || 'onbekend').slice(0, 200)
    });
  }

  /* Stap 3: afgestemd -- geboekt EN teruggevonden in het grootboek. Twee
     verschillende metingen, net als bij de bank: een grootboek kan perfect
     sluiten terwijl deze vordering nooit is geboekt. */
  function stemAf(f) {
    if (!f) return { error: 'geen vergoeding' };
    return zet(f, STATUS.AFGESTEMD);
  }

  /* Wat staat er open, en bij wie. Dit is het getal dat er vroeger niet was:
     mislukte de boeking, dan werd het bedrag nul en wist niemand ervan. */
  function openstaand(supplierCode) {
    const alle = rij().filter(f => OPEN.has(f.status) &&
      (!supplierCode || f.supplierCode === String(supplierCode)));
    return {
      aantal: alle.length,
      centen: alle.reduce((s, f) => s + f.centen, 0),
      herkansingen: alle.filter(f => f.status === STATUS.HERKANSING).length,
      rijen: alle.slice(0, 100).map(publiek)
    };
  }

  function publiek(f) {
    return { id: f.id, supplierCode: f.supplierCode, centen: f.centen, status: f.status,
      pogingen: f.pogingen, laatsteFout: f.laatsteFout, ref: f.ref, at: f.at };
  }

  function lijst(filter) {
    filter = filter || {};
    return rij().filter(f => (!filter.supplierCode || f.supplierCode === filter.supplierCode) &&
      (!filter.status || f.status === filter.status)).slice(0, 200).map(publiek);
  }

  /* DE HERKANSINGSRONDE. Een HERKANSING bleef staan tot iemand keek -- zichtbaar
     in `openstaand`, maar niemand pakte hem op. Deze ronde probeert ze opnieuw.

     `boekFn` komt van de aanroeper omdat deze module geen grootboek kent (zie de
     kop). Hij krijgt de rij mee en geeft een boeking of een fout terug.

     TWEE GRENZEN, allebei uit een echte overweging:
     - `maxPogingen`: na een aantal keer is het geen hapering maar een defect, en
       dan hoort er een mens naar te kijken in plaats van dat de rij elke ronde
       dezelfde fout herhaalt. De rij blijft staan -- opgeven is hier geen
       optie, want de vordering bestaat nog steeds.
     - `maxPerRonde`: een ronde die duizend boekingen in een keer probeert, legt
       de motor om op precies het moment dat hij al moeite heeft. */
  async function herkans(boekFn, opties) {
    const o = opties || {};
    const maxPogingen = Number.isFinite(o.maxPogingen) ? o.maxPogingen : 5;
    const maxPerRonde = Number.isFinite(o.maxPerRonde) ? o.maxPerRonde : 50;
    if (typeof boekFn !== 'function') return { ok: false, error: 'geen boekfunctie' };

    const kandidaten = rij()
      .filter(f => f.status === STATUS.HERKANSING && (f.pogingen || 0) < maxPogingen)
      .slice(0, maxPerRonde);

    let gelukt = 0, mislukking = 0;
    for (const f of kandidaten) {
      let r;
      try { r = await boekFn(f); } catch (e) { r = { error: String((e && e.message) || e) }; }
      if (r && !r.error) { geboekt(f, (r.boeking || {}).id || r.ref || null); gelukt++; }
      else { mislukt(f, r); mislukking++; }
    }
    const vast = rij().filter(f => f.status === STATUS.HERKANSING && (f.pogingen || 0) >= maxPogingen);
    return { ok: true, geprobeerd: kandidaten.length, gelukt, mislukt: mislukking,
      /* Wat de ronde NIET meer probeert. Dit getal hoort op een bord, want een
         rij die stil buiten de ronde valt is net zo onzichtbaar als de nul die
         we hebben weggehaald. */
      vastgelopen: vast.length, vastgelopenCenten: vast.reduce((s, f) => s + f.centen, 0) };
  }

  return { STATUS, OPEN, AF, incasseer, geboekt, mislukt, stemAf, openstaand, lijst, publiek, magOvergaan, herkans };
}

module.exports = { maakFees, STATUS, OVERGANG, OPEN, AF, magOvergaan };
