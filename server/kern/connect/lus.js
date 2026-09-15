/* ============================================================================
   DE LUS -- een lijst werkwoorden in, een geldige verklaring uit.

   De acht werkwoorden zelf en de reden dat het een lijst is en geen interface,
   staan in ./werkwoordlijst.js. Dit bestand is de motor eromheen, en hij is
   met opzet dezelfde motor als kern/commerce/werkwoorden.js -- niet omdat
   hergebruik netjes staat, maar omdat die vorm een keer duur is betaald: een
   koopbaar dat `retour` beloofde zonder ooit bevestigd te zijn.

   TWEE RICHTINGEN OP DEZELFDE GRAAF, en geen van beide is de omgekeerde van de
   ander. `verklaar` telt op wat een werkwoord VEREIST; `zonder` haalt weg wat
   op een weggevallen werkwoord LEUNDE. Wie denkt met een van de twee toe te
   kunnen, levert of een ontdekking die `deel` aanbiedt zonder dat er iets te
   maken viel, of een deelknop boven werk waarvan `maak` net is ingetrokken.

   DE DERDE UITKOMST IS HET VERSCHIL MET COMMERCE. Naast wat een bron KAN geeft
   deze motor terug wat een mens moet BEVESTIGEN: elk verklaard werkwoord met
   `raaktEenAnder` komt terug in `bevestigtEenMens`. Dat is geen advies aan de
   aanroeper. Het is de plek waar de regel van LIFE.md ("samenstellen en
   klaarzetten -- bevestigen doet de mens") een aanroeper krijgt in plaats van
   een zin in een document. Een route die deze lijst negeert, is de fout die
   INTELLIGENTIE.md beschrijft als het stil promoveren van autonomie.

   EN EEN ONBEKEND WERKWOORD VERDWIJNT NIET STIL. Een bron die `beloon`
   aanmeldt krijgt hem terug in `geweigerd`, met de reden uit NIET_GEBOUWD --
   niet een lijst waar het woord uit is gevallen. Dat is LAT-regel 5, en hier
   weegt hij zwaarder dan elders: de geweigerde woorden zijn precies de vijf
   die botsen met de grens dat de meeteenheid nooit de mens is. Een bron die
   ze stil kwijtraakt, denkt dat hij ze heeft.
   ========================================================================== */
'use strict';

const { WERKWOORDEN, NIET_GEBOUWD } = require('./werkwoordlijst');

const IDS = WERKWOORDEN.map(w => w.id);
const OP_ID = new Map(WERKWOORDEN.map(w => [w.id, w]));
const werkwoord = (id) => OP_ID.get(String(id == null ? '' : id)) || null;
const isWerkwoord = (id) => OP_ID.has(String(id == null ? '' : id));

/* De verklaring van EEN bron: welke werkwoorden, met hun voorwaarden
   afgedwongen. Dit is de enige weg waarlangs een lijst werkwoorden ontstaat.
   Een bron die zijn eigen lijst samenstelt, kan `help` aanbieden zonder
   `verbind` -- en dan staat er een knop "beantwoord dit" boven iets waar
   niemand aan de andere kant staat. */
function verklaar(lijst) {
  const gevraagd = [...new Set((Array.isArray(lijst) ? lijst : []).map(x => String(x || '')))];
  const geweigerd = [];
  const heeft = new Set();
  for (const id of gevraagd) {
    if (!isWerkwoord(id)) {
      geweigerd.push({ werkwoord: id, reden: NIET_GEBOUWD[id] ||
        'Dit werkwoord bestaat niet in kern/connect/werkwoordlijst.js.' });
      continue;
    }
    heeft.add(id);
  }
  /* De voorwaarden, herhaald tot er niets meer verandert. Een ronde is niet
     genoeg: `help` hangt aan `verbind`, en `deel` aan `maak`. Acht
     werkwoorden, dus de lus eindigt gegarandeerd. */
  let veranderd = true;
  const afgeleid = [];
  while (veranderd) {
    veranderd = false;
    for (const id of [...heeft]) {
      for (const nodig of werkwoord(id).vereist) {
        if (heeft.has(nodig)) continue;
        heeft.add(nodig);
        afgeleid.push({ werkwoord: nodig, door: id });
        veranderd = true;
      }
    }
  }
  const uit = IDS.filter(id => heeft.has(id));
  return {
    werkwoorden: uit,
    afgeleid,
    geweigerd,
    /* De drie die een tweede mens bereiken. De aanroeper krijgt ze APART en
       niet als vlag per werkwoord: een lijst waar je doorheen moet lopen om de
       gevaarlijke eruit te halen, is een lijst waar iemand dat vergeet. */
    bevestigtEenMens: uit.filter(id => werkwoord(id).raaktEenAnder),
    /* Wat deze bron NIET aanbiedt. Staat er even groot bij, want een lus die
       bij `doe` ophoudt is geen kapotte lus -- hij is een bron die eerlijk is
       over waar hij stopt. Zonder dit veld leest een korte lijst als een
       gebrek van de laag in plaats van als een eigenschap van de bron. */
    ontbreekt: IDS.filter(id => !heeft.has(id))
  };
}

/* De andere richting: welk werkwoord valt om als `weg` er niet meer is? Nodig
   bij het INTREKKEN -- een maker die zijn werk terughaalt, haalt daarmee ook
   het delen, het helpen erop en het verbinden eraan weg. Een laag die alleen
   `verklaar` kent, laat die drie staan tot iemand erop drukt. */
function zonder(lijst, weg) {
  const basis = new Set(verklaar(lijst).werkwoorden);
  const gevallen = new Set([String(weg || '')].filter(id => basis.has(id)));
  if (!gevallen.size) return { werkwoorden: [...basis].filter(id => IDS.includes(id)), gevallen: [] };
  let veranderd = true;
  while (veranderd) {
    veranderd = false;
    for (const id of basis) {
      if (gevallen.has(id)) continue;
      if (werkwoord(id).vereist.some(n => gevallen.has(n))) { gevallen.add(id); veranderd = true; }
    }
  }
  return {
    werkwoorden: IDS.filter(id => basis.has(id) && !gevallen.has(id)),
    gevallen: IDS.filter(id => gevallen.has(id))
  };
}

/* De uitleg bij EEN werkwoord, zoals een mens hem op het scherm krijgt. Hij
   komt uit dezelfde lijst als de motor en wordt nergens overgetypt: een tweede
   tekst naast de eerste loopt binnen een jaar uit elkaar, en dan staat er op
   het scherm iets anders dan wat de code afdwingt. */
function uitleg(id) {
  const w = werkwoord(id);
  if (!w) return { werkwoord: String(id || ''), bestaat: false,
    reden: NIET_GEBOUWD[String(id || '')] || 'Dit werkwoord bestaat niet in kern/connect/werkwoordlijst.js.' };
  return { werkwoord: w.id, bestaat: true, naam: w.naam, grond: w.grond, nietDit: w.nietDit,
    vereist: w.vereist.slice(), bevestigtEenMens: w.raaktEenAnder };
}

module.exports = { verklaar, zonder, uitleg, werkwoord, isWerkwoord, IDS };
