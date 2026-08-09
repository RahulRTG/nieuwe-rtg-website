/* RTG Stadsweefsel, deel "steden": de WORTELS van de boom.

   ./geografie.js bevraagt de boom (waar ligt dit punt, wat staat ernaast, welk
   gebied hoort hierbij). Dit bestand gaat over de laag daarboven: welke steden
   zijn er, bij welke stad hoort een gebied, wat zijn de grenzen van een stad,
   en hoe komt er een bij.

   DE BOOM DROEG EEN STAD, EN DAT WAS EEN AANNAME EN GEEN ONTWERP. De vijf
   niveaus beginnen bij `stad`, dus een tweede wortel paste er altijd al in.
   Wat ontbrak waren drie dingen, en ze staan alle drie hier:

   1. NIEMAND BOUWDE ER EEN. zorgGeografie() stopte zodra er iets stond.
   2. DE BEVRAGINGEN KENDEN GEEN STAD. `namen('zone')` gaf de zones van alles
      bij elkaar, en dat leest als een stad zolang er een is. Met twee steden is
      het stilzwijgend fout -- een veldploeg krijgt dan zones te zien die
      duizend kilometer verderop liggen.
   3. DE GRENZEN WAREN DIE VAN IBIZA. gebiedMaak toetste elk punt aan de vaste
      rechthoek uit kern/navigatie, dus een gebied in een tweede stad viel per
      definitie "buiten de stadsgrenzen" en die stad kon nooit gevuld worden.

   WAT HIER BEWUST NIET GEBEURT: bestaande gegevens verplaatsen. De eerste stad
   houdt haar ids (`G-stad`, `G-marina`, `G-marina-laan`) letterlijk. Gegevens
   verhuizen om een functie toe te voegen is de duurste manier om een fout te
   maken die je pas maanden later ziet. */
'use strict';

module.exports = ({ gebieden, gebied, NIVEAUS, BOUNDS, schoon, coordPaar, zaai, opNaamRuw }) => {
  function stadVan(id) {
    let g = gebied(id);
    for (let i = 0; g && i < NIVEAUS.length + 1; i++) {
      if (g.niveau === 'stad') return g;
      g = g.ouder ? gebied(g.ouder) : null;
    }
    return null;
  }
  /* DRIE ANTWOORDEN EN NIET TWEE, en dat verschil is een echte fout geweest.
     `undefined` betekent "er is geen stad gevraagd" (dan telt alles mee, zoals
     vroeger). `null` betekent "er is een stad gevraagd die niet bestaat" -- en
     dan hoort het antwoord LEEG te zijn.

     Hier stond één `null` voor allebei, en dus gaf een vraag naar de zones van
     een stad die nog niet in het weefsel stond, de zones van ALLE steden terug.
     De stadsstart las dat als "deze stad heeft zes zones" en meldde de
     weefselstap groen terwijl er niets gebouwd was. Gevonden door de routetoets
     (test/commandlagen.test.js), die een stad startte zonder middelpunt. */
  const stadId = (stad) => {
    if (stad == null || stad === '') return undefined;
    const s = String(stad);
    const g = gebied(s) || gebieden().find(x => x.niveau === 'stad' &&
      x.naam.toLowerCase() === s.trim().toLowerCase());
    return g && g.niveau === 'stad' ? g.id : null;
  };
  const steden = () => gebieden().filter(g => g.niveau === 'stad');
  const inStad = (g, wortel) => wortel === undefined ||
    (wortel !== null && (stadVan(g.id) || {}).id === wortel);


  /* De grenzen van een stad: de omhullende van haar eigen wortel, met een
     marge zodat een gebied net buiten de bestaande zones er nog bij mag. Voor
     de eerste stad blijft dat de rechthoek uit kern/navigatie -- daar ligt het
     wegennet, en die twee horen een wereld te zijn. */
  const MARGE = 0.02;
  function grenzenVan(stad) {
    if (!stad) return BOUNDS;
    if (stad.id === 'G-stad') return BOUNDS;
    const p = (stad.geometrie && stad.geometrie.punten) || [];
    if (!p.length) return BOUNDS;
    return {
      lat0: Math.min(...p.map(q => q.lat)) - MARGE, lat1: Math.max(...p.map(q => q.lat)) + MARGE,
      lng0: Math.min(...p.map(q => q.lng)) - MARGE, lng1: Math.max(...p.map(q => q.lng)) + MARGE
    };
  }

  /* EEN STAD ERBIJ. Hij krijgt hetzelfde startraster als de eerste (zes zones,
     drie buurten, drie wijken, twee straatsegmenten per zone) rond een eigen
     middelpunt, met een eigen id-voorvoegsel zodat geen enkele id botst. De
     namen van dat raster zijn generiek en horen hernoemd te worden zodra de
     echte wijknamen bekend zijn; dat staat in de uitslag, want een stad met
     zes zones die "Marina" heten terwijl er geen jachthaven is, is erger dan
     een lege stad. */
  function stadErbij({ naam, lat, lng, sleutel }) {
    /* EERST DE EERSTE STAD. Zonder deze regel hangt het ervan af wie er als
       eerste belt: maakt iemand een tweede stad voordat er ooit een zone is
       opgevraagd, dan is de boom niet meer leeg en zaait zorgGeografie() de
       eerste stad NOOIT meer. Dan staat er een platform met alleen Antwerpen
       erin. Die regel stond er, en viel weg bij het opknippen van
       geografie.js -- de toets vond het meteen. */
    zaai.zorgGeografie();
    const n = schoon(naam, 60);
    if (!n) return { status: 400, error: 'Hoe heet de stad?' };
    const p = coordPaar(lat, lng);
    if (!p) return { status: 400, error: 'Geef een geldig middelpunt (lat en lng).' };
    if (opNaamRuw(n, 'stad')) return { status: 409, error: 'Er is al een stad die zo heet.' };
    const vv = String(sleutel || n).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 24) + '-';
    if (vv === '-' || gebieden().some(g => g.id.startsWith('G-' + vv))) {
      return { status: 409, error: 'Die stadssleutel is al in gebruik.' };
    }
    /* Overlap met een bestaande stad is geen smaakkwestie: dan hoort een punt
       bij twee steden en gaan er twee ploegen naar dezelfde lantaarn. */
    for (const bestaand of steden()) {
      const g = grenzenVan(bestaand);
      if (p.lat >= g.lat0 && p.lat <= g.lat1 && p.lng >= g.lng0 && p.lng <= g.lng1) {
        return { status: 409, error: 'Dat middelpunt ligt binnen ' + bestaand.naam +
          '. Twee steden die elkaar overlappen laten een punt bij allebei horen.' };
      }
    }
    const r = zaai.bouwStad({ voorvoegsel: vv, naam: n, midden: { lat: p.lat, lng: p.lng } });
    return {
      ok: true, stad: { id: r.stad.id, naam: r.stad.naam, sleutel: vv.slice(0, -1) },
      gebieden: r.gebieden.length,
      zones: r.gebieden.filter(g => g.niveau === 'zone').map(g => g.naam),
      let: 'de zes zones dragen de generieke namen van het startraster; hernoem ze zodra de echte ' +
        'wijknamen bekend zijn. En er ligt (nog) geen wegennet onder deze stad -- kern/navigatie kent ' +
        'er een, en dat is die van de eerste stad.'
    };
  }


  return { stadVan, steden, stadId, inStad, grenzenVan, stadErbij };
};
