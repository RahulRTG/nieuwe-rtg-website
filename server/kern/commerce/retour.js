/* ============================================================================
   REVERSE COMMERCE -- de weg terug, met dezelfde bewijslaag als de weg heen.

   DE BEGRIPPEN (gronden, standen, staat, uitkomsten) staan in ./retourlijst.js,
   inclusief waarom dit nieuwbouw is en niet een uitbreiding. Dit bestand is de
   motor: wie mag welke stand zetten, wat er wordt vastgelegd, en wat er
   uitdrukkelijk NIET gebeurt.

   ================== DRIE GRENZEN DIE DIT BESTAND DRAAGT ==================

   1. RTG BESLIST NIETS NAMENS DE VERKOPER. Aanvaarden, afwijzen, beoordelen en
      de uitkomst kiezen zijn alle vier handelingen van de VERKOPER. Deze laag
      houdt de stroom bij en bewaakt de volgorde; ze vult nergens iets in. Dat is
      COMMERCE.md grens 6, en het is dezelfde regel als grens 1 (een mand is
      geen bevestiging namens iemand anders).

   2. GELD WORDT KLAARGEZET, NOOIT VERPLAATST. Een uitkomst met `geldTerug`
      levert een BESLUIT op met een bedrag en een btw-splitsing, en daar houdt
      het op. Een mens voert het uit langs kern/pay, met de bevoegdheid die
      daarvoor bestaat. Automatisch terugboeken zou geld verplaatsen zonder dat
      iemand het besloot -- GELD.md par. 3, en precies de afweging die
      kern/appstore/teruggave.js ook maakt.

   3. DE ORDER BLIJFT VAN HET DOMEIN. Er komt geen tweede orderwaarheid bij.
      Een retour VERWIJST naar (bron, orderRef) en kopieert de order niet. Dat
      betekent ook dat RTG niet KAN nagaan of die order bestaat -- en dat wordt
      niet weggemoffeld: het verzoek draagt `orderGecontroleerd: false` tot de
      verkoper hem in stand `aanvaard` tegen zijn eigen administratie legt. Zo
      werkt een RMA in het echt ook, en het is eerlijker dan een vinkje dat
      niemand heeft gezet.

   ================== WAT ER BEVROREN WORDT, EN WAAROM ==================

   Het BEDRAG en het btw-tarief worden vastgelegd op het moment van aanvragen,
   niet uitgerekend op het moment van afhandelen. Een retour van maart die in
   juni wordt afgehandeld, hoort het tarief van maart te dragen; de landentabel
   is levend (kern/fiscaal/regelwacht.js legt er een overlay overheen zodra een
   tarief verandert). Zonder bevriezing zou de teruggave van een oude aankoop
   stilletjes met een nieuw tarief worden gerekend. Zelfde reden waarom de bon in
   kern/appstore/geld.js onveranderlijk is.
   ========================================================================== */
'use strict';

const { NA, GROND, RETOURSTAND, EINDSTANDEN, NIET_GEBOUWD } = require('./retourlijst');

const MAX = 50000;                       // de tabel blijft begrensd
const VERVAL_DAGEN = 60;                 // een aanvraag die blijft liggen, vervalt

module.exports = ({ db, save, nu, btwUit, zaakVan }) => {
  const klok = () => (typeof nu === 'function' ? nu() : require('../../lib/klok').nu());
  const tekst = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 200);

  function pot() {
    if (!Array.isArray(db.data.commerceRetouren)) db.data.commerceRetouren = [];
    return db.data.commerceRetouren;
  }
  const bij = (id) => pot().find(r => r.id === String(id || '')) || null;

  /* Vervallen op het moment dat er toch al naar de tabel wordt gekeken -- zelfde
     keuze als in ./mand.js. Een eigen veger zou een tweede plek zijn die weet
     wanneer iets oud is. */
  function ruim() {
    const grens = klok() - VERVAL_DAGEN * 24 * 3600 * 1000;
    let n = 0;
    for (const r of pot()) {
      if (EINDSTANDEN.includes(r.stand)) continue;
      if ((r.bij || r.at || 0) > grens) continue;
      r.stand = 'vervallen';
      r.stappen.push({ stand: 'vervallen', door: 'termijn', at: klok(),
        reden: 'Er is ' + VERVAL_DAGEN + ' dagen niets gebeurd met deze aanvraag.' });
      r.bij = klok(); n++;
    }
    if (n) save();
    return n;
  }

  /* ---------- 1. de koper vraagt ---------- */

  /* `koopbaar` is het object uit ./koopbaar.js. De eis is niet "er is ooit iets
     gekocht" -- dat weet deze laag niet -- maar "dit ding KAN terug": het
     werkwoord `retour` staat erop. Zonder dat werkwoord is een retourstroom een
     belofte die de verkoper nooit heeft gedaan. */
  function vraag({ sleutel, koopbaar, orderRef, grond, toelichting, centen }) {
    const s = tekst(sleutel, 120);
    if (!s) return { status: 400, error: 'Geen retour zonder sleutel.' };
    if (!koopbaar) return { status: 404, error: 'Dit aanbod bestaat niet (meer).' };
    if (!(koopbaar.werkwoorden || []).includes('retour')) {
      return { status: 409, error: 'Dit kan niet terug. De aanbieder heeft geen retour ingericht, en RTG belooft dat niet namens hem.' };
    }
    const g = GROND.get(tekst(grond, 40));
    if (!g) return { status: 400, error: 'Kies een grond uit de lijst.' };
    const ref = tekst(orderRef, 80);
    if (!ref) return { status: 400, error: 'Welke bestelling? Geef het kenmerk dat je van de verkoper kreeg.' };

    const bedrag = Math.max(0, Math.round(Number(centen) || 0));
    const zaak = koopbaar.aanbieder && koopbaar.aanbieder.code && zaakVan ? zaakVan(koopbaar.aanbieder.code) : null;
    /* Bevroren op nu, niet uitgerekend bij afhandelen -- zie de kop. */
    const btw = (bedrag > 0 && btwUit) ? btwUit(bedrag, zaak) : null;

    ruim();
    const r = {
      id: 'rt' + Math.random().toString(36).slice(2, 10) + klok().toString(36).slice(-4),
      sleutel: s,
      koopbaarId: koopbaar.id, titel: koopbaar.titel, bron: koopbaar.bron,
      verkoper: (koopbaar.aanbieder && koopbaar.aanbieder.code) || null,
      verkoperNaam: (koopbaar.aanbieder && koopbaar.aanbieder.naam) || null,
      /* Zie grens 3: wij verwijzen naar de order van het domein en kopieren hem
         niet, en wij kunnen dus niet nagaan of hij bestaat. */
      orderRef: ref, orderGecontroleerd: false,
      grond: g.id, toelichting: tekst(toelichting, 500) || null,
      centen: bedrag,
      btw: btw ? { tariefProcent: btw.tariefProcent, btwCenten: btw.btwCenten, nettoCenten: btw.nettoCenten } : null,
      btwOnbekend: btw ? null : (bedrag > 0 ? 'Voor deze verkoper is geen btw-tarief vast te stellen; het bedrag staat bruto.' : null),
      stand: 'gevraagd', staat: null, uitkomst: null, besluit: null,
      at: klok(), bij: klok(),
      stappen: [{ stand: 'gevraagd', door: 'koper', at: klok(), grond: g.id }]
    };
    pot().unshift(r);
    if (pot().length > MAX) pot().length = MAX;
    save();
    return { ok: true, retour: publiek(r) };
  }

  /* ---------- 2. de verkoper beweegt hem ---------- */

  /* Wat een scherm te zien krijgt. `besluit` gaat mee inclusief `uitgevoerd:
     false` -- een klaargezet bedrag dat eruitziet als een betaald bedrag is
     precies het soort stilte dat deze laag hoort te vermijden. */
  function publiek(r) {
    return {
      id: r.id, titel: r.titel, verkoper: r.verkoper, verkoperNaam: r.verkoperNaam,
      bron: r.bron, orderRef: r.orderRef, orderGecontroleerd: !!r.orderGecontroleerd,
      orderKenmerk: r.orderKenmerk || null,
      grond: r.grond, grondLabel: (GROND.get(r.grond) || {}).label || r.grond,
      toelichting: r.toelichting,
      stand: r.stand, standLabel: (RETOURSTAND.get(r.stand) || {}).label || r.stand,
      volgende: (NA[r.stand] || []).map(id => ({ id, label: (RETOURSTAND.get(id) || {}).label, door: (RETOURSTAND.get(id) || {}).door })),
      staat: r.staat, voorraadKan: r.voorraadKan == null ? null : !!r.voorraadKan,
      centen: r.centen, btw: r.btw, btwOnbekend: r.btwOnbekend,
      uitkomst: r.uitkomst, besluit: r.besluit,
      at: r.at, bij: r.bij, stappen: r.stappen
    };
  }

  /* De standenmachine woont in ./retourstand.js en krijgt de vijf dingen die
     hij nodig heeft: opslaan, de klok, de schoonmaak van tekst, de opzoeker en
     de publieke vorm.
     Hij kent de tabel zelf. */
  const { zet } = require('./retourstand')({ save, klok, tekst, bij, ruim, publiek });

  const vanKoper = (sleutel) => { ruim(); return pot().filter(r => r.sleutel === String(sleutel || '')).slice(0, 200).map(publiek); };
  const vanVerkoper = (code) => { ruim(); return pot().filter(r => r.verkoper === String(code || '')).slice(0, 200).map(publiek); };

  return { vraag, zet, vanKoper, vanVerkoper, bij: (id) => { const r = bij(id); return r ? publiek(r) : null; },
    ruim, NIET_GEBOUWD, VERVAL_DAGEN };
};
