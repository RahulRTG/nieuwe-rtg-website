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
const MAX_OPGEZOCHT = 3;

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
    const ruimte = c.presentatie.werkruimte;
    if (ruimte) { voeg(ruimte.module); voeg(ruimte.id); voeg(ruimte.modus); }
    const assistent = c.presentatie.assistent;
    if (assistent) for (const actie of assistent.mogelijkheden) { voeg(actie.soort); voeg(actie.id); }
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
function handtekening(res, opties) {
  if (!res || res.stand !== 'PASS' || !res.context) return '';
  /* Gaat de vraag NIET over het aangewezen object (./menscontext-relatie.js),
     dan staat het object er wel bij -- zodat "die andere" te lezen blijft --
     maar zonder zijn velden en met de zin dat de vraag er niet over gaat. Het
     scherm helpt lezen; het kiest de taak niet. */
  const los = !!(opties && opties.relatie === 'los');
  const c = res.context, d = [];
  if (c.presentatie.app) d.push('scherm ' + c.presentatie.app);
  if (c.presentatie.scherm) d.push('deel ' + c.presentatie.scherm);
  if (c.presentatie.selectie) d.push('selectie ' + c.presentatie.selectie);
  const ruimte = c.presentatie.werkruimte;
  if (ruimte) d.push(['werkruimte', ruimte.id, ruimte.modus, ruimte.module].filter(Boolean).join(' '));
  const assistent = c.presentatie.assistent;
  if (assistent) d.push('assistentmogelijkheden zonder uitvoerbevoegdheid ' + assistent.mogelijkheden
    .map((actie) => actie.soort + ' ' + actie.id).join(' | '));
  /* De opties staan er UITGESCHREVEN en niet geteld. Een interpretatielaag die
     "twee opties" leest, weet nog steeds niet welke de andere is -- en dan moet
     hij raden, precies wat deze laag moet voorkomen. */
  if (c.interactie) d.push(c.interactie.soort +
    (c.interactie.opties.length ? ': ' + c.interactie.opties.join(' | ') : '') +
    (c.interactie.gekozen ? ' (gekozen: ' + c.interactie.gekozen + ')' : ''));
  if (c.verwijzingen.length) d.push(c.verwijzingen.length + ' verwijzing' +
    (c.verwijzingen.length > 1 ? 'en' : '') + ' naar ' +
    [...new Set(c.verwijzingen.map((v) => v.soort))].join(' en '));
  /* WAT DE SERVER ZELF OPZOCHT (./menscontext-opzoek.js). Alleen CANONIEKE
     verwijzingen, en alleen hun beeld: de velden die het domein op een
     positieve lijst zette, opnieuw gelezen bij deze vraag. Hooguit drie
     objecten -- de vraag blijft het zwaartepunt, niet het dossier. Zonder
     opzoeker staat hier niets, en dan is de regel exact die van voorheen. */
  const opgezocht = (res.verwijzingenUitslag || []).filter((u) => u && u.stand === 'CANONIEK' && u.object)
    .slice(0, MAX_OPGEZOCHT).map((u) => {
      const o = u.object, v = o.velden || {};
      /* Tekst tussen aanhalingstekens: een titel met een komma mag niet als
         twee velden te lezen zijn, en een waarde blijft zichtbaar een waarde. */
      const delen = Object.keys(v).map((k) => k + ' ' + (typeof v[k] === 'string' ? JSON.stringify(v[k]) : v[k]));
      return o.soort + ' ' + o.id + (delen.length ? ' (' + delen.join(', ') + ')' : '');
    });
  if (opgezocht.length && los) d.push('deze vraag gaat niet over het aangewezen object; behandel hem als een nieuwe vraag');
  else if (opgezocht.length) d.push(('opgezocht door RTG: ' + opgezocht.join(' | ')).slice(0, 600));
  return d.join('; ');
}

module.exports = { woordenVan, handtekening, MAX_WOORDEN, MAX_OPGEZOCHT };
