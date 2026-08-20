/* WAT ER BELOOFD IS EN NIET BEWOOG.

   Drie lagen legden een verplichting vast met een bedrag en een status, en bij
   alle drie bleef het daarbij:

     kern/commercie/subsidie.js     "RTG legt bij"  -> status te_verrekenen
     kern/commercie/prijsmelding.js "het verschil wordt voor u rechtgezet"
                                    -> rechtgezetCenten, en verder niets
     kern/commercie/allocatie.js    "30% naar de RTFoundation"
                                    -> GERESERVEERD, en verder niets

   Dat was met opzet: die lagen horen geen grootboek te kennen (zie hun koppen).
   Maar een verplichting die nooit door iets wordt opgepakt, is een boekhouding
   met een wachtkamer waar niemand de deur van opent -- en dan is de belofte
   alsnog een zin op een scherm.

   DIT BESTAND IS DIE DEUR. Het kent de verplichtingen en krijgt een boekfunctie
   mee; het rekent zelf niets uit. Dat onderscheid is het punt: gaat het bedrag
   hier opnieuw door een formule, dan bestaan er twee antwoorden op "hoeveel" en
   is de invariant van subsidie.js niets meer waard.

   DRIE REKENINGEN, en ze heten wat ze zijn:

     rtg:ledenvoordeel   RTG betaalt de korting die het lid kreeg, aan de zaak
     rtg:prijsgarantie   RTG zet een prijsverschil recht bij het lid
     rtg:sociaal         de sociale afdracht, tot de rail hem oppakt

   WAT DIT NIET DOET: geld het huis uit sturen. De sociale afdracht gaat naar een
   externe rekening en dat loopt via kern/fonds.js en de betaalopdracht -- daar
   hoort het, want alleen die laag weet hoe geld terugkomt als een rail hem
   weigert. Wat hier gebeurt is de stap ervoor: de verplichting BETAALBAAR maken
   zodra de bestemming bekend is. Zolang RTF_IBAN leeg is, gebeurt dat niet, en
   dan blijft de rij eerlijk op GERESERVEERD staan.

   EN HET BOEKT NOOIT TWEE KEER. Elke bron draagt zijn eigen stempel zodra hij is
   verrekend (`voordeelOpbouw.status`, `verrekenRef`, de allocatie-status); een
   ronde die twee keer draait, vindt de tweede keer niets. Dat is geen
   optimalisatie maar de enige bescherming: een ronde die per ongeluk twee keer
   loopt, zou anders twee keer betalen. */
'use strict';

/* Tijd komt uit de tijdmachine en niet van het besturingssysteem: alleen zo is
   "wat gebeurt er op 29 februari" een vraag die je kunt stellen (server/lib/klok.js).
   De injecteerbare `nu` blijft bestaan -- toetsen zetten hem -- maar de TERUGVAL
   is de klok en niet Date.now(). */
const klok = require('../../lib/klok');

const REK = {
  ledenvoordeel: 'rtg:ledenvoordeel',
  prijsgarantie: 'rtg:prijsgarantie',
  sociaal: 'rtg:sociaal'
};

const subsidie = require('./subsidie');

function maakVerrekening({ db, save, boekAsync, prijsmeldingen, allocatie, rekLid, rekPartner, nu }) {
  const tijd = nu || klok.nu;
  const boek = typeof boekAsync === 'function' ? boekAsync : null;

  function orders() { return (db.data && db.data.orders) || []; }

  /* ---- 1. HET LEDENVOORDEEL: RTG betaalt de zaak wat het lid niet betaalde ----
     De vier bedragen staan al op de bestelling. Hier wordt alleen bewogen wat
     daar staat, en nagerekend of het nog klopt -- een opbouw die onderweg is
     aangepast, hoort niet stilzwijgend uitbetaald te worden. */
  async function verrekenLedenvoordeel({ maxPerRonde = 100 } = {}) {
    if (!boek) return { ok: false, error: 'geen boekfunctie' };
    const open = orders().filter(o => o.voordeelOpbouw &&
      o.voordeelOpbouw.status === 'te_verrekenen').slice(0, maxPerRonde);

    let gelukt = 0, mislukt = 0, afgekeurd = 0, centen = 0;
    for (const o of open) {
      const bezwaar = subsidie.keur(o.voordeelOpbouw);
      if (bezwaar) {
        /* Niet uitbetalen en niet stil overslaan: de rij krijgt een stand die
           zegt dat er iets niet klopt, zodat een mens ernaar kijkt. */
        o.voordeelOpbouw.status = 'afgekeurd';
        o.voordeelOpbouw.bezwaar = bezwaar;
        afgekeurd++;
        continue;
      }
      const bedrag = o.voordeelOpbouw.rtgLegtBijCenten;
      if (!(bedrag > 0)) { o.voordeelOpbouw.status = 'geen_voordeel'; continue; }
      let r;
      try {
        r = await boek({ van: REK.ledenvoordeel, naar: rekPartner(o.supplierCode), centen: bedrag,
          soort: 'ledenvoordeel', oms: 'RTG-ledenvoordeel, bijgelegd', ref: o.ref });
      } catch (e) { r = { error: String((e && e.message) || e) }; }
      if (r && !r.error) {
        o.voordeelOpbouw.status = 'verrekend';
        o.voordeelOpbouw.verrekendOp = tijd();
        o.voordeelOpbouw.boekingRef = (r.boeking || {}).id || null;
        gelukt++; centen += bedrag;
      } else {
        o.voordeelOpbouw.laatsteFout = String((r && r.error) || 'onbekend').slice(0, 200);
        mislukt++;
      }
    }
    save();
    return { ok: true, geprobeerd: open.length, gelukt, mislukt, afgekeurd, centen };
  }

  /* ---- 2. DE PRIJSGARANTIE: het verschil terug naar het lid ----
     Pas als de melding op RECHTGEZET staat -- dat is het moment waarop iemand
     heeft gezegd dat het klopt. `verrekenRef` is het stempel: staat hij er, dan
     is dit bedrag al bewogen. */
  async function verrekenPrijsgarantie({ maxPerRonde = 100 } = {}) {
    if (!boek || !prijsmeldingen) return { ok: false, error: 'geen boekfunctie of meldingen' };
    const rijen = (db.data && db.data.prijsmeldingen) || [];
    const open = rijen.filter(m => m.status === 'RECHTGEZET' && !m.boekingRef &&
      m.rechtgezetCenten > 0).slice(0, maxPerRonde);

    let gelukt = 0, mislukt = 0, centen = 0;
    for (const m of open) {
      let r;
      try {
        r = await boek({ van: REK.prijsgarantie, naar: rekLid(m.codenaam), centen: m.rechtgezetCenten,
          soort: 'prijsgarantie', oms: 'Ledenprijsgarantie, verschil rechtgezet', ref: m.id });
      } catch (e) { r = { error: String((e && e.message) || e) }; }
      if (r && !r.error) {
        m.boekingRef = (r.boeking || {}).id || null;
        m.verrekendOp = tijd();
        gelukt++; centen += m.rechtgezetCenten;
      } else { m.laatsteFout = String((r && r.error) || 'onbekend').slice(0, 200); mislukt++; }
    }
    save();
    return { ok: true, geprobeerd: open.length, gelukt, mislukt, centen };
  }

  /* ---- 3. DE SOCIALE AFDRACHT: betaalbaar maken zodra de bestemming er is ----
     Geen uitbetaling: die loopt via kern/fonds.js en de betaalopdracht, want
     alleen die laag weet hoe geld terugkomt als een rail hem weigert. Wat hier
     gebeurt is de stap ervoor.

     Zonder bestemming gebeurt er NIETS, en dat is het eerlijke gedrag: zolang
     RTF_IBAN leeg is blijft de rij op GERESERVEERD staan, en dat is precies wat
     de claim ook zegt. */
  function maakSociaalBetaalbaar({ lokaal, foundation, maxPerRonde = 200 } = {}) {
    if (!allocatie) return { ok: false, error: 'geen allocatie' };
    if (!lokaal && !foundation)
      return { ok: true, geprobeerd: 0, gelukt: 0, reden: 'geen bestemming bekend' };
    const open = allocatie.lijst({ status: 'GERESERVEERD' }).slice(0, maxPerRonde);
    let gelukt = 0, centen = 0;
    for (const a of open) {
      const r = allocatie.maakBetaalbaar(a, { lokaal, foundation });
      if (r && r.ok) { gelukt++; centen += a.centen; }
    }
    return { ok: true, geprobeerd: open.length, gelukt, centen };
  }

  /* Wat er nog op de plank ligt. Dit is het getal dat er niet was: drie
     verplichtingen die wel bestonden en die niemand optelde. */
  function openstaand() {
    const voordeel = orders().filter(o => o.voordeelOpbouw && o.voordeelOpbouw.status === 'te_verrekenen');
    const afgekeurd = orders().filter(o => o.voordeelOpbouw && o.voordeelOpbouw.status === 'afgekeurd');
    const garantie = ((db.data && db.data.prijsmeldingen) || [])
      .filter(m => m.status === 'RECHTGEZET' && !m.boekingRef);
    const soc = allocatie ? allocatie.stand() : { openCenten: 0 };
    return {
      ledenvoordeel: { aantal: voordeel.length,
        centen: voordeel.reduce((s, o) => s + o.voordeelOpbouw.rtgLegtBijCenten, 0) },
      afgekeurd: { aantal: afgekeurd.length,
        centen: afgekeurd.reduce((s, o) => s + (o.voordeelOpbouw.rtgLegtBijCenten || 0), 0) },
      prijsgarantie: { aantal: garantie.length,
        centen: garantie.reduce((s, m) => s + (m.rechtgezetCenten || 0), 0) },
      sociaal: { centen: soc.openCenten || 0 }
    };
  }

  return { REK, verrekenLedenvoordeel, verrekenPrijsgarantie, maakSociaalBetaalbaar, openstaand };
}

module.exports = { maakVerrekening, REK };
