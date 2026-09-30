#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE PLAATSVORM -- wat verstaat RTG vandaag onder een plaats? (A0a)

   NAVIGATIE.md par. 14, stap A0a. P-01 zegt dat een locatie geen coordinaat is
   maar een plaats met identiteit, toestand, mogelijkheden, toegang, privacy en
   bewijs. Voordat iemand daar een `Place`-type voor bouwt, wordt gemeten wat
   de domeinen er NU onder verstaan -- om dezelfde reden als bij `Asset`,
   `Koopbaar`, `Career`, `Moment`, `Manier` en de planningsgrond: een
   objecttype wordt gevonden in de domeinen, niet eroverheen verklaard
   (DEVELOPERCLOUD.md par. 2). Niet om een schema af te dwingen, maar om de
   inconsistenties zichtbaar te maken.

   DEZELFDE LEZER. De vormen komen uit scripts/objectmodel.js, zodat de
   getallen naast OBJECTMODEL.json, PLANVORM.json en de andere vormmeters te
   leggen zijn. Dat brengt zijn blinde vlek mee, en die staat in de uitslag: de
   lezer ziet alleen objectliteralen MET een `id` en ZONDER geneste accolades.
   Een plaats als `{ id, loc: { lat, lng } }` is voor hem onzichtbaar.

   DE DOMEINLIJST WORDT AFGELEID EN NIET GESCHREVEN. Anders dan bij planvorm is
   hier geen lijst met de hand: een plaatsvorm is een vorm die een plaats
   DRAAGT, en welke domeinen dat doen volgt uit de code. Twee drempels, om
   dezelfde reden als de twee lijsten van carrierevorm en planvorm (een uitslag
   die op de lijst drijft is geen uitslag):

     RUIM   een vorm met een coordinaat OF een plaatsveld (loc, positie, adres,
            plek ...). P-01 zegt dat een plaats meer is dan een punt; een adres
            zonder coordinaat is voor een mens ook een plaats.
     SMAL   een vorm met lat EN lng of lon -- het strengste, het minst
            dubbelzinnige.

   DRIE ASSEN, NOOIT OPGETELD.

     A. DE VORM         delen de plaatsdomeinen velden? (de Asset-vraag)
     B. DE WOORDENSCHAT hoeveel manieren zijn er om een punt te schrijven?
                        (lat/lng, lat/lon, loc, positie, coords ...)
     C. DE ASPECTEN     draagt een plaatsvorm naast zijn plek ook een etiket,
                        een zichtbaarheid of privacy, een toestand, een bewijs
                        of herkomst? Lexicaal op veldnamen, dus een ONDERgrens,
                        graad `vermoed`.

   WAT HIJ NIET MEET: wie een plaats LEEST. Dat is geen eigenschap van de vorm
   maar van de aanroepers, en een vormmeter die het toch invult raadt. Het staat
   in `nietGemeten` met die reden.

   Draaien: npm run plaatsvorm   (vastleggen: npm run plaatsvorm:vast)
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const om = require('./objectmodel.js');
const { stempel, eisSchoneBoom } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'PLAATSVORM.json');

/* De manieren om een punt of plaats te schrijven. Elk woord een eigen
   variant: dat er meer dan een is, IS de bevinding van as B. */
const PUNT = {
  'lat+lng': (v) => v.includes('lat') && v.includes('lng'),
  'lat+lon': (v) => v.includes('lat') && v.includes('lon'),
  latitude: (v) => v.includes('latitude'),
  loc: (v) => v.includes('loc'),
  locatie: (v) => v.includes('locatie') || v.includes('location'),
  positie: (v) => v.includes('positie') || v.includes('position') || v.includes('pos'),
  coords: (v) => v.includes('coords') || v.includes('coord') || v.includes('coordinaat') || v.includes('coordinaten'),
  geo: (v) => v.includes('geo') || v.includes('geometrie') || v.includes('polygoon'),
  plek: (v) => v.includes('plek') || v.includes('punt'),
  adres: (v) => v.includes('adres') || v.includes('address') || v.includes('straat') || v.includes('postcode')
};
const PUNTEN = Object.keys(PUNT);

/* DE VELDEN DIE EEN VORM TOT PLAATSVORM MAKEN, doen niet mee aan de
   vormvergelijking. De eerste ronde meldde onder SMAL "lat en lng staan in alle
   domeinen" -- en dat kon niet anders, want SMAL selecteert op precies die
   twee. Een uitslag die de drempel zelf veroorzaakt is geen meting. De vraag
   van as A is dus wat de domeinen delen NAAST hun punt, en dat is ook de vraag
   van P-01: een locatie is geen coordinaat. */
const DEFINITIE = new Set(['lat', 'lng', 'lon', 'latitude', 'longitude', 'loc', 'locatie', 'location', 'positie',
  'position', 'pos', 'coords', 'coord', 'coordinaat', 'coordinaten', 'geo', 'geometrie', 'polygoon', 'plek',
  'punt', 'adres', 'address', 'straat', 'postcode']);

const ASPECT = {
  etiket: ['soort', 'type', 'genre', 'categorie', 'tags', 'labels', 'label', 'caps', 'kind', 'cat'],
  zichtbaarheid: ['zichtbaar', 'publiek', 'openbaar', 'prive', 'verborgen', 'deel', 'delen', 'anoniem', 'vindbaar', 'toon', 'afgeschermd'],
  toestand: ['open', 'gesloten', 'drukte', 'beschikbaar', 'actief', 'stand', 'geopend', 'openingstijden', 'uren'],
  bewijs: ['bron', 'herkomst', 'bevestigd', 'geverifieerd', 'graad', 'sinds', 'gemeten', 'door', 'bijgewerkt'],
  termijn: ['tot', 'verloopt', 'vervalt', 'geldigTot', 'ttl', 'bewaar', 'termijn']
};
const ASPECTEN = Object.keys(ASPECT);
const heeft = (velden, woorden) => velden.some(f => woorden.includes(f) || woorden.includes(f.toLowerCase()));

const LIJST = {
  ruim: (v) => PUNTEN.some(p => PUNT[p](v)),
  smal: (v) => PUNT['lat+lng'](v) || PUNT['lat+lon'](v)
};

function ronde(vormen, envelop, drempel) {
  const plaats = vormen.filter(v => drempel(v.velden)).map(v => Object.assign({ domein: om.domeinVan(v.module) }, v));
  const domeinen = [...new Set(plaats.map(v => v.domein))].sort();

  // A. de vorm
  const perDomein = new Map(domeinen.map(d => [d, new Set()]));
  for (const v of plaats) for (const f of v.velden) if (!envelop.has(f) && !DEFINITIE.has(f)) perDomein.get(v.domein).add(f);
  const veldDomein = new Map();
  for (const d of domeinen) for (const f of perDomein.get(d)) {
    if (!veldDomein.has(f)) veldDomein.set(f, []);
    veldDomein.get(f).push(d);
  }
  const n = domeinen.length;
  const inAlle = [...veldDomein].filter(([, ds]) => ds.length === n).map(([f]) => f).sort();
  const inHelft = [...veldDomein].filter(([, ds]) => ds.length * 2 >= n).map(([f]) => f).sort();
  const inEen = [...veldDomein].filter(([, ds]) => ds.length === 1).length;

  // B. de woordenschat
  const varianten = PUNTEN.map(p => ({
    variant: p,
    vormen: plaats.filter(v => PUNT[p](v.velden)).length,
    domeinen: [...new Set(plaats.filter(v => PUNT[p](v.velden)).map(v => v.domein))].sort()
  })).filter(x => x.vormen > 0);
  const domeinenMetMeerdere = domeinen.filter(d =>
    PUNTEN.filter(p => p !== 'adres' && plaats.some(v => v.domein === d && PUNT[p](v.velden))).length > 1);

  // C. de aspecten
  const aspecten = ASPECTEN.map(a => ({
    aspect: a,
    vormen: plaats.filter(v => heeft(v.velden, ASPECT[a])).length,
    domeinen: new Set(plaats.filter(v => heeft(v.velden, ASPECT[a])).map(v => v.domein)).size
  }));
  const kaal = plaats.filter(v => !ASPECTEN.some(a => heeft(v.velden, ASPECT[a])));

  return {
    vormen: plaats.length, domeinen,
    vorm: {
      velden: veldDomein.size, inAlleDomeinen: inAlle, inMinstensHelft: inHelft.length,
      inEenDomeinPct: veldDomein.size ? Number(((inEen / veldDomein.size) * 100).toFixed(1)) : 0
    },
    woordenschat: {
      varianten, aantal: varianten.filter(x => x.variant !== 'adres').length,
      domeinenMetMeerdereSchrijfwijzen: domeinenMetMeerdere
    },
    aspecten,
    kaal: { vormen: kaal.length, pct: plaats.length ? Number(((kaal.length / plaats.length) * 100).toFixed(1)) : 0,
      voorbeelden: kaal.slice(0, 8).map(v => v.module) },
    rijen: plaats.map(v => ({
      module: v.module, domein: v.domein,
      punt: PUNTEN.filter(p => PUNT[p](v.velden)),
      aspecten: ASPECTEN.filter(a => heeft(v.velden, ASPECT[a]))
    })).sort((a, b) => a.module.localeCompare(b.module))
  };
}

function meet(opties) {
  const vormen = (opties && opties.vormen) || om.lees().vormen;
  const envelop = new Set((opties && opties.envelop) ||
    JSON.parse(fs.readFileSync(path.join(WORTEL, 'OBJECTMODEL.json'), 'utf8')).envelop);
  const rondes = {};
  for (const naam of Object.keys(LIJST)) rondes[naam] = ronde(vormen, envelop, LIJST[naam]);

  /* De conclusie wordt afgeleid, hangt aan de VORM-as (hard), en houdt alleen
     stand als beide drempels hem dragen. */
  const namen = Object.keys(rondes);
  const leeg = namen.filter(n => rondes[n].domeinen.length < 2);
  const geenGedeeld = namen.every(n => rondes[n].vorm.inAlleDomeinen.length === 0);
  const eensgezind = new Set(namen.map(n => rondes[n].vorm.inAlleDomeinen.length === 0)).size === 1;
  const conclusie = leeg.length
    ? 'NIET VAST TE STELLEN: onder ' + leeg.join(' en ') + ' vond de lezer minder dan twee plaatsdomeinen.'
    : !eensgezind
      ? 'VERDEELD: de twee drempels geven een ander antwoord; de uitslag drijft op de drempel.'
      : geenGedeeld
        ? 'GEEN GEDEELDE VORM: geen veld (buiten de envelop) staat in alle plaatsdomeinen, onder geen van ' +
          'beide drempels. Een `Place`-OBJECTTYPE is daarmee niet gerechtvaardigd. Wat overleeft is een ' +
          'PROJECTIE met etiketten (kern/levensgraaf/graaf.js): elk domein houdt zijn plaats, en een ' +
          'plaatslaag verwijst ernaar met een herkomst.'
        : 'GEDEELDE VORM GEVONDEN: er staan velden in alle plaatsdomeinen, onder beide drempels. Lees ' +
          '`inAlleDomeinen` voordat er iets op gebouwd wordt: een coordinaat is geen plaats (P-01), en ' +
          'lat/lng delen zegt alleen dat de domeinen een punt kennen.';

  return {
    uitleg: 'Wat verstaat RTG onder een plaats? Elke objectvorm die een plaats draagt, per domein, over drie ' +
      'assen: de vorm (gedeelde velden), de woordenschat (hoeveel manieren om een punt te schrijven) en de ' +
      'aspecten (etiket, zichtbaarheid, toestand, bewijs, termijn naast de plek). Gemeten met de lezer ' +
      'van scripts/objectmodel.js.',
    graad: 'vermoed',
    grens: 'De lezer ziet alleen objectliteralen met een id en zonder geneste accolades: een plaats als ' +
      '{ id, loc: { lat, lng } } is onzichtbaar, en een plaats die in een ROUTE wordt opgebouwd ook. De ' +
      'aspect-as is lexicaal op veldnamen en dus een ondergrens. De drie assen worden nooit opgeteld.',
    nietGemeten: {
      lezers: 'wie een plaats LEEST is een eigenschap van de aanroepers en niet van de vorm; een vormmeter ' +
        'die het invult, raadt. De keten scherm -> route -> bestand staat in SCHERMROUTES.json en ' +
        'AANROEPGRAAF.json.'
    },
    conclusie, geenGedeeldeVorm: geenGedeeld, eensgezind,
    rondes
  };
}

function druk(u) {
  console.log('\nDE PLAATSVORM -- wat verstaat RTG onder een plaats?');
  for (const [naam, r] of Object.entries(u.rondes)) {
    console.log('\n  ' + naam.toUpperCase() + ' -- ' + r.vormen + ' plaatsvormen in ' + r.domeinen.length + ' domeinen');
    console.log('    A. vorm        ' + r.vorm.velden + ' velden, ' + r.vorm.inAlleDomeinen.length + ' in alle domeinen' +
      (r.vorm.inAlleDomeinen.length ? ' (' + r.vorm.inAlleDomeinen.join(', ') + ')' : '') +
      ', ' + r.vorm.inEenDomeinPct + '% in precies een');
    console.log('    B. schrijfwijzen van een punt: ' + r.woordenschat.aantal +
      '; domeinen met meer dan een: ' + r.woordenschat.domeinenMetMeerdereSchrijfwijzen.length);
    for (const v of r.woordenschat.varianten)
      console.log('         ' + v.variant.padEnd(10) + String(v.vormen).padStart(4) + ' vormen in ' + v.domeinen.length + ' domein(en)');
    console.log('    C. aspecten naast de plek');
    for (const a of r.aspecten)
      console.log('         ' + a.aspect.padEnd(14) + String(a.vormen).padStart(4) + ' vormen in ' + a.domeinen + ' domein(en)');
    console.log('         ' + 'geen enkel'.padEnd(14) + String(r.kaal.vormen).padStart(4) + ' vormen (' + r.kaal.pct + '%)');
  }
  console.log('\n' + u.conclusie + '\n');
}

module.exports = { meet, ronde, PUNT, ASPECT, LIJST, DEFINITIE, DOEL };

if (require.main === module) {
  const u = meet();
  druk(u);
  if (process.argv.includes('--vastleggen')) {
    const poort = eisSchoneBoom('plaatsvorm');
    if (!poort.ok) { console.error(poort.reden); process.exitCode = 1; return; }
    fs.writeFileSync(DOEL, JSON.stringify(Object.assign({ stempel: stempel() }, u), null, 2) + '\n');
    console.log('geschreven: PLAATSVORM.json');
  }
}
