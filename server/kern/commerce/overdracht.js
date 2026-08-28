/* ============================================================================
   DE OVERDRACHT -- van de mand naar de deur waar WEL bevestigd wordt.

   DIT IS HET SLUITSTUK VAN ./afrekening.js. Die laag zegt met zoveel woorden
   "wij stoppen bij de deur" en wijst met `bevestigBij` naar de pagina waar het
   domein zijn eigen bevestiging al doet. Zonder dit bestand is dat een
   doodlopend eind: de koper landt op /apps/foodcourt.html en begint opnieuw.
   Vier verkopers in een mand is dan geen verbetering maar vier keer zoeken.

   EEN OVERDRACHT DRAAGT DE KEUZE OVER, NOOIT DE BEVESTIGING. Dat is niet een
   voorzichtige formulering maar de hele grens van deze laag: RTG stelt samen en
   zet klaar, een mens bevestigt (LIFE.md par. 4, en kern/mall/bestellingen.js
   lang daarvoor al). Er komt hier dus geen order bij, geen betaling en geen
   tweede orderwaarheid -- er komt een BRIEFJE bij dat het domein kan lezen.

   DE INHOUD KOMT VAN DE SERVER EN NOOIT VAN DE BROWSER. De aanroeper zegt welke
   VERKOPER en welke PAGINA; de regels en de bedragen worden hier uit het
   doorgerekende mandbeeld gehaald. Een overdracht die regels uit een verzoek
   overneemt, is een prijslijst die de koper zelf mag invullen -- precies wat
   ./afrekening.js in zijn kop afwijst, een laag later.

   HET BEDRAG STAAT VAST EN DRAAGT ZIJN DATUM. Anders dan de mand (die met opzet
   geen bedragen bewaart, zie ./mand.js) bevriest een overdracht wel: hij is een
   momentopname die de koper meeneemt naar een ander scherm, en dan hoort er te
   staan wat RTG rekende op het moment dat hij vertrok. Rekent het domein iets
   anders, dan is dat ZICHTBAAR in plaats van weggepoetst -- dezelfde reden
   waarom ./retour.js zijn bedrag bevriest.

   EN HIJ WEET NIET OF HET GELUKT IS. Er is geen stand `bevestigd`. RTG hoort
   niet van het domein of de koper heeft doorgezet, en een stand die dat suggereert
   zou een bewering zijn zonder meting (BESTUUR.md: vervallen bewijs is geen
   bewijs). Een overdracht loopt af, meer niet; de koper haalt zelf uit zijn mand
   wat hij heeft afgerond.
   ========================================================================== */
'use strict';

/* Twee uur. Een overdracht is een oversteek en geen bewaarplek: langer bewaren
   levert een briefje op met de prijs van gisteren, en dat is erger dan geen
   briefje. De mand blijft wel staan (30 dagen) -- die bewaart geen bedrag. */
const VERVAL_MS = 2 * 3600 * 1000;
const MAX_PER_SLEUTEL = 12;
const MAX_TOTAAL = 5000;

module.exports = ({ db, save, nu }) => {
  const huisklok = require('../../lib/klok').nu;
  const klok = () => (typeof nu === 'function' ? nu() : huisklok());
  const sleutelVan = (s) => String(s == null ? '' : s).slice(0, 120);
  const tekst = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 80);

  function pot() {
    if (!db.data.commerceOverdrachten || typeof db.data.commerceOverdrachten !== 'object') db.data.commerceOverdrachten = {};
    return db.data.commerceOverdrachten;
  }

  /* Opruimen gebeurt op het moment dat er toch al naar de tabel wordt gekeken --
     zelfde patroon als ./mand.js en ./retour.js, en om dezelfde reden: een eigen
     veger zou een tweede plek zijn die weet wanneer iets oud is. */
  function ruim() {
    const p = pot(); const nuMs = klok();
    let weg = 0;
    for (const k of Object.keys(p)) if (!p[k] || !(p[k].vervalt > nuMs)) { delete p[k]; weg++; }
    const over = Object.keys(p);
    if (over.length > MAX_TOTAAL) {
      over.sort((a, b) => (p[a].at || 0) - (p[b].at || 0));
      for (const k of over.slice(0, over.length - MAX_TOTAAL)) { delete p[k]; weg++; }
    }
    return weg;
  }

  /* Aanmaken. `beeld` is het doorgerekende mandbeeld van deze sleutel (uit
     ./index.js), en dat is met opzet een PARAMETER: deze laag rekent zelf niets
     uit en kan dus ook niet per ongeluk een tweede som naast die van
     ./afrekening.js zetten (LAT-regel 4). */
  function maak(sleutel, o) {
    const s = sleutelVan(sleutel);
    if (!s) return { status: 400, error: 'Geen overdracht zonder sleutel.' };
    const beeld = o && o.beeld;
    if (!beeld || !Array.isArray(beeld.afrekeningen) || !beeld.afrekeningen.length) {
      return { status: 409, error: 'Er staat niets in je mand om over te dragen.' };
    }
    const code = tekst(o.verkoper, 40) || '__rtg';
    const a = beeld.afrekeningen.find(x => (x.aanbiederCode || '__rtg') === code);
    if (!a) return { status: 404, error: 'Deze verkoper staat niet in je mand.' };
    /* Een geblokkeerde afrekening wordt niet overgedragen. Iemand met een briefje
       "2 stuks" naar een deur sturen waar er nog 1 is, is de blokkade verplaatsen
       naar de plek waar hij het minst te repareren valt. */
    if (!a.bevestigbaar) {
      return { status: 409, error: 'Er staat nog iets in de weg bij deze verkoper.', blokkades: a.blokkades || [] };
    }

    /* ALLEEN EEN DEUR IN DIT HUIS. `pagina` komt uit een bronmodule van
       kern/mall/aanbod.js, en het scherm stuurt de koper er met een
       `location.assign` heen. Een bron die daar ooit een absoluut adres in zet,
       maakt van deze knop een doorstuurluik naar buiten -- met de naam van RTG
       ervoor. Dat wordt hier geweigerd en niet stil weggefilterd: een deur die
       verdwijnt zonder reden laat een ondernemer zoeken naar een fout in zijn
       aanbod. */
    const eigenPad = (p) => typeof p === 'string' && /^\/[A-Za-z0-9_./?=&%:+-]*$/.test(p) && !p.startsWith('//');
    const vreemd = (a.bevestigBij || []).filter(p => !eigenPad(p));
    if (vreemd.length) return { status: 409, error: 'Deze verkoper wijst naar een adres buiten RTG. Daar stuurt een mand niemand heen.', adressen: vreemd };

    const paginas = a.bevestigBij || [];
    if (!paginas.length) {
      return { status: 409, error: 'Voor deze verkoper is niet bekend waar bevestigd wordt. RTG stuurt je niet naar een deur die hij niet kent.' };
    }
    let pagina = o.pagina ? tekst(o.pagina, 200) : null;
    if (pagina && !paginas.includes(pagina)) return { status: 400, error: 'Deze verkoper bevestigt daar niet.', paginas };
    if (!pagina) {
      /* Twee deuren bij een verkoper is geen randgeval: een zaak kan een tafel in
         de foodcourt en een artikel in de Mall hebben. Kiezen doet de koper. */
      if (paginas.length > 1) return { status: 409, error: 'Deze regels worden op meer dan een plek bevestigd. Kies er een.', paginas };
      pagina = paginas[0];
    }

    const regels = (a.regels || []).filter(r => (r.pagina || null) === pagina).map(r => ({
      koopbaarId: r.koopbaarId, titel: r.titel, type: r.type,
      aantal: r.aantal, stukCenten: r.stukCenten, totaalCenten: r.totaalCenten, gratis: !!r.gratis
    }));
    if (!regels.length) return { status: 409, error: 'Er hoort niets bij deze deur.' };

    ruim();
    const p = pot();
    const mijn = Object.keys(p).filter(k => p[k].sleutel === s);
    if (mijn.length >= MAX_PER_SLEUTEL) {
      mijn.sort((x, y) => (p[x].at || 0) - (p[y].at || 0));
      delete p[mijn[0]];
    }

    const bruto = regels.reduce((n, r) => n + r.totaalCenten, 0);
    const at = klok();
    const r = {
      id: 'ov' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6),
      sleutel: s, at, vervalt: at + VERVAL_MS,
      verkoper: { code: a.aanbiederCode || null, naam: a.aanbiederNaam || 'RTG' },
      pagina, regels, brutoCenten: bruto,
      /* De btw reist mee zoals de afrekening hem gaf; hij wordt hier niet
         opnieuw gesplitst. Zie de kop van ./afrekening.js: het tarief woont in
         kern/fiscaal/tarief.js en nergens anders. */
      btw: a.btw || null, btwOnbekend: a.btwOnbekend || null,
      geopendOp: null
    };
    p[r.id] = r;
    save();
    return { ok: true, overdracht: publiek(r), koopbaarIds: regels.map(x => x.koopbaarId) };
  }

  /* Lezen kan alleen met de sleutel waarop hij is gemaakt. Een overdracht-id in
     een adresbalk is anders een leesbaar briefje voor wie het adres deelt, en
     daar staat in wat iemand koopt en voor hoeveel. */
  function lees(id, sleutel) {
    ruim();
    const r = pot()[tekst(id, 60)];
    if (!r) return { status: 404, error: 'Dit briefje bestaat niet meer. Een overdracht loopt na twee uur af.' };
    if (r.sleutel !== sleutelVan(sleutel)) return { status: 403, error: 'Dit briefje is niet van jou.' };
    if (!r.geopendOp) { r.geopendOp = klok(); save(); }
    return { ok: true, overdracht: publiek(r) };
  }

  const vanSleutel = (sleutel) => {
    ruim();
    const s = sleutelVan(sleutel); const p = pot();
    return Object.keys(p).filter(k => p[k].sleutel === s)
      .map(k => publiek(p[k])).sort((a, b) => b.at - a.at);
  };

  /* Het beeld naar buiten. De sleutel gaat er nooit uit, en de twee zinnen over
     wat RTG hier NIET doet gaan er wel uit: een scherm dat ze zelf moet
     verzinnen, verzint ze een keer anders. */
  function publiek(r) {
    return {
      id: r.id, at: r.at, vervalt: r.vervalt, geopendOp: r.geopendOp || null,
      verkoper: r.verkoper, pagina: r.pagina,
      regels: r.regels, brutoCenten: r.brutoCenten, valuta: 'EUR',
      btw: r.btw, btwOnbekend: r.btwOnbekend,
      bedragVan: 'Dit bedrag rekende RTG uit toen je je mand verliet. Bevestigen doet ' + r.verkoper.naam + ', en die noemt zijn eigen bedrag.',
      rtgBevestigtNiet: 'RTG heeft hier niets besteld en niets betaald. Dit is je keuze, doorgegeven aan de plek waar hij bevestigd wordt.'
    };
  }

  return { maak, lees, vanSleutel, ruim, VERVAL_MS, MAX_PER_SLEUTEL };
};
