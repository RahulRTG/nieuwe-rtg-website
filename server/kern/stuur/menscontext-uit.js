/* WAT ER UIT DE MENSELIJKE CONTEXT NAAR BUITEN GAAT -- twee afnemers, twee vormen.

   Apart van ./menscontext.js omdat het een ander soort ding is: daar staat wat
   er BINNENKOMT en wat daarvan overblijft (het contract), hier wat de twee
   afnemers ervan krijgen. Die twee schuiven om verschillende redenen -- het
   contract als er een deel bij komt, dit bestand als de resolver of de
   interpretatielaag iets anders nodig heeft. De naad kwam uit de omvangband van
   keuringsregel `omvang` en hij zit hier goed.

   DE TWEE AFNEMERS ZIJN NIET INWISSELBAAR:

     woordenVan()    gaat naar ./resolver.js. Woorden, en verder niets -- de
                     resolver kan met woorden alleen een lijst kleiner maken die
                     hij binnenkrijgt, dus hier ontstaat nooit een vermogen.
     handtekening()  gaat het GESPREK in, onder de vraag van de mens. Dat is een
                     modelprompt, dus hier hoort geen nieuwe regel, geen tab en
                     geen onbegrensde lengte in: daarmee zou een client een
                     tweede instructieblok kunnen openen. */
'use strict';

const MAX_WOORDEN = 12;    /* de vraag blijft het zwaartepunt, niet het scherm */

/* DE WOORDEN, en meer komt er niet naar de interpretatielaag. Ze staan op
   volgorde van hoe dicht ze bij de bedoeling van de mens staan: wat hij heeft
   AANGEWEZEN eerst, waar hij naar KIJKT daarna. */
function woordenVan(c) {
  const uit = [];
  const voeg = (s) => {
    for (const w of String(s || '').toLowerCase().split(/[^a-z0-9]+/))
      if (w.length > 2 && !uit.includes(w)) uit.push(w);
  };
  for (const v of ((c && c.verwijzingen) || [])) voeg(v.soort);
  if (c && c.interactie) {
    voeg(c.interactie.gekozen);
    for (const o of c.interactie.opties) voeg(o);
  }
  if (c && c.presentatie) {
    voeg(c.presentatie.selectie); voeg(c.presentatie.scherm);
    voeg(c.presentatie.app); voeg(c.presentatie.wereld);
  }
  return uit.slice(0, MAX_WOORDEN);
}

/* DE HANDTEKENING -- de ene regel die het gesprek in gaat, zodat een
   interpretatielaag (een model, of de deterministische rail) WEET wat de mens
   voor zich heeft. Afgeleid en begrensd; er gaat geen rauw clientveld in.

   Alleen bij een GESLAAGDE sanering. Bij NOT_RUN of OVERGESLAGEN is de regel
   leeg, en dan plakt ./lus.js er niets onder -- een lege "Actieve context:" zou
   het model laten denken dat het scherm leeg IS. */
function handtekening(res) {
  if (!res || res.stand !== 'PASS' || !res.context) return '';
  const c = res.context, d = [];
  if (c.presentatie.app) d.push('scherm ' + c.presentatie.app);
  if (c.presentatie.scherm) d.push('deel ' + c.presentatie.scherm);
  if (c.presentatie.selectie) d.push('selectie ' + c.presentatie.selectie);
  /* De opties staan er UITGESCHREVEN en niet geteld. Een interpretatielaag die
     "twee opties" leest, weet nog steeds niet welke de andere is -- en dan moet
     hij raden, precies wat deze laag moet voorkomen. */
  if (c.interactie) d.push(c.interactie.soort +
    (c.interactie.opties.length ? ': ' + c.interactie.opties.join(' | ') : '') +
    (c.interactie.gekozen ? ' (gekozen: ' + c.interactie.gekozen + ')' : ''));
  if (c.verwijzingen.length) d.push(c.verwijzingen.length + ' verwijzing' +
    (c.verwijzingen.length > 1 ? 'en' : '') + ' naar ' +
    [...new Set(c.verwijzingen.map((v) => v.soort))].join(' en '));
  return d.join('; ');
}

module.exports = { woordenVan, handtekening, MAX_WOORDEN };
