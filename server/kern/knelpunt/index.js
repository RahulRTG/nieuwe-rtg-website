/* ============================================================================
   DE KNELPUNTMOTOR -- welke weg is open, wat blokkeert hem, en wat is niet
   nagegaan.

   HDI.md par. 7 regel 8, en met opzet NIET wat daar "constraint solver" heet.
   Die naam belooft een optimizer die het beste pad kiest, en dat is precies wat
   dit bestand niet doet en niet mag doen (par. 5.5). Wat het wel doet is de
   vraag beantwoorden waar het voorbeeld van Sarah om draait: *de bottleneck is
   niet motivatie, de bottleneck is kinderopvang.* Vandaar de naam.

   HET RESULTAAT IS EEN DOORSNEDE EN GEEN RANGLIJST. Voor elke aangedragen
   MANIER wordt gekeken welke randvoorwaarden hij nodig heeft en hoe die
   ervoor staan. Meer niet. Er wordt niets gesorteerd, niets aanbevolen en
   niets weggelaten.

   DE VIJF REGELS, EN ALLE VIJF ZIJN ZE EEN GRENS UIT HDI.md par. 5.5:

   1. ER GAAT NOOIT EEN MANIER UIT DE LIJST. Een geblokkeerde weg wordt GETOOND,
      met wat hem zou openen. Wie hem weglaat, zegt "dit is niets voor jou" --
      en dat is precies wat FOUNDATION.md par. 5.3 verbiedt. Een motor die
      alleen mag toevoegen, mag ook niet stilletjes aftrekken.

   2. NIET NAGEGAAN IS NIET VERVULD. Een randvoorwaarde zonder stand heet
      `onbekend` en telt nooit als geregeld. Een weg waarvan drie voorwaarden
      onbekend zijn, heet daarom `onbepaald` en niet `open`.

   3. DE AANNAMES STAAN IN DE UITSLAG. Wat deze motor heeft moeten aannemen om
      tot dit beeld te komen, staat erbij -- zonder die zinnen is een uitkomst
      niet na te rekenen en dus niet te weerleggen.

   4. ER WORDT NIETS GERANGSCHIKT. De volgorde van de manieren is de volgorde
      waarin ze zijn aangeleverd, en dat staat er ook zo bij. Zodra er een
      "beste" uit komt rollen, is de keuze van de mens afgenomen.

   5. EEN KNELPUNT IS EEN EIGENSCHAP VAN EEN RANDVOORWAARDE, NOOIT VAN EEN MENS.
      De telling gaat over hoeveel WEGEN een voorwaarde blokkeert. Er komt hier
      geen getal op een persoon, ook niet als tussenwaarde en ook niet als
      sorteersleutel (LEVEN.md par. 2.4, ONTMOETEN.md par. 4).

   EN DE ZESDE, DIE OVER DE MOTOR ZELF GAAT: HIJ REKENT NIETS UIT WAT HIJ NIET
   WEET. Er zit hier geen opleidingsduur, geen opvangtarief, geen inkomensgrens
   en geen wachttijd in. Dat zijn getallen die dit huis niet heeft, en ze
   verzinnen zou een voorspelling maken die op niets rust -- erger dan geen
   voorspelling, want ernaar handelen kost een mens echt iets
   (kern/levensgraaf/termijnen.js zegt hetzelfde over zijn eigen datums).

   GEEN OPSLAG, GEEN CONTEXT, GEEN DATABASE. Alles komt binnen als argument en
   gaat eruit als antwoord, precies zoals kern/livinglab/graden.js -- en om
   dezelfde reden: een regel die je zonder database kunt uitrekenen, kun je ook
   zonder database TOETSEN.
   ========================================================================== */
'use strict';

/* De standen van een randvoorwaarde. Drie, en `onbekend` is de STANDAARD:
   wie niets zegt, heeft niets nagegaan. */
const W = require('./woorden');

const STANDEN = ['vervuld', 'ontbreekt', 'onbekend'];

/* De standen van een manier. Ze volgen uit de voorwaarden en worden nergens
   gekozen -- zie ./index.js regel 2 hierboven. */
const WEGSTANDEN = ['open', 'geblokkeerd', 'onbepaald'];

const tekst = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 200);

/* ---------------------------------------------------------------------------
   De motor. Krijgt het doel, de randvoorwaarden en de manieren; geeft per
   manier zijn stand met de reden, plus de knelpunten en de aannames.
   ------------------------------------------------------------------------- */
function reken(invoer) {
  const b = invoer || {};

  const doel = tekst(b.doel, 200);
  if (!doel) {
    return { status: 400, error: W.GEEN_DOEL };
  }

  /* De randvoorwaarden, op id. Een dubbele id is geen randgeval maar een fout
     die anders stil de eerste overschrijft. */
  const vw = new Map();
  for (const r of (Array.isArray(b.randvoorwaarden) ? b.randvoorwaarden : [])) {
    const id = tekst(r && r.id, 60);
    if (!id) continue;
    if (vw.has(id)) {
      return { status: 400, error: W.dubbel(id) };
    }
    const stand = STANDEN.includes(r.stand) ? r.stand : 'onbekend';
    vw.set(id, { id, wat: tekst(r.wat, 200) || id, stand });
  }

  const manieren = Array.isArray(b.manieren) ? b.manieren : [];
  if (!manieren.length) {
    return { status: 400, error: W.GEEN_MANIEREN };
  }

  /* Wat de motor heeft moeten aannemen. Hij begint bij de vaste twee en groeit
     met wat er onderweg blijkt te ontbreken -- zie regel 3. */
  const aannames = W.AANNAMES_VAST.slice();

  const onbekendeVerwijzingen = new Set();
  const blokkeertHoeveel = new Map();   // randvoorwaarde-id -> aantal wegen dat hij blokkeert

  const uit = manieren.map((m, i) => {
    const id = tekst(m && m.id, 60) || ('manier-' + (i + 1));
    const nodig = (Array.isArray(m && m.nodig) ? m.nodig : []).map(x => tekst(x, 60)).filter(Boolean);

    /* REGEL 2, TOEGEPAST OP DE LIJST IN PLAATS VAN OP DE STANDEN ERIN. "Deze
       weg vergt niets" is een bewering van wie hem aandroeg; "wij weten niet
       wat hij vergt" is het tegenovergestelde. Tot 14 september 2026 waren ze
       hier niet uit elkaar te houden -- allebei stand `open`, met "alles staat
       geregeld" eronder. Voor een weg die dit huis zelf samenstelt (./wegen.js)
       zegt die zin "ga maar" over iets waar niemand naar keek. */
    const voorwaardenOnbekend = !!(m && m.voorwaardenOnbekend);

    const ontbreekt = [], onbekend = [], vervuld = [];
    for (const n of nodig) {
      const r = vw.get(n);
      if (!r) {
        /* Een manier die een voorwaarde noemt die niet is beschreven. Dat is
           geen "vervuld" en ook geen fout die de hele berekening moet stoppen:
           het is precies een ONBEKENDE. Wel wordt hij hieronder als aanname
           genoemd, want anders verdwijnt de slordigheid in het antwoord. */
        onbekendeVerwijzingen.add(n);
        onbekend.push({ id: n, wat: n, stand: 'onbekend' });
        continue;
      }
      if (r.stand === 'ontbreekt') ontbreekt.push(r);
      else if (r.stand === 'onbekend') onbekend.push(r);
      else vervuld.push(r);
    }

    for (const r of ontbreekt) blokkeertHoeveel.set(r.id, (blokkeertHoeveel.get(r.id) || 0) + 1);

    const stand = ontbreekt.length ? 'geblokkeerd'
      : ((onbekend.length || voorwaardenOnbekend) ? 'onbepaald' : 'open');
    return {
      id, wat: tekst(m && m.wat, 200) || id, stand,
      voorwaardenOnbekend,
      /* REGEL 1: een geblokkeerde weg blijft staan, met wat hem zou openen. De
         zin is met opzet in de voorwaardelijke wijs: er staat niet dat het kan,
         er staat wat er dan geregeld zou moeten zijn. */
      zouOpenenAls: ontbreekt.map(r => r.wat),
      nietNagegaan: onbekend.map(r => r.wat),
      alGeregeld: vervuld.map(r => r.wat),
      uitleg: W.uitleg(stand, voorwaardenOnbekend, onbekend.length > 0)
    };
  });

  if (onbekendeVerwijzingen.size) {
    aannames.push(W.aannameOnbekend([...onbekendeVerwijzingen]));
  }
  /* REGEL 3: de stilste aanname hier is een weg zonder gemeten voorwaarden --
     hij ziet er in de lijst uit als elke andere. */
  const zonderGemetenVoorwaarden = uit.filter(m => m.voorwaardenOnbekend).length;
  if (zonderGemetenVoorwaarden) {
    aannames.push(W.aannameOngemeten(zonderGemetenVoorwaarden, uit.length));
  }
  if (manieren.length === 1) {
    /* REGEL: altijd meer dan een weg. Als er maar een is aangeleverd, is dit
       geen keuze maar een gegeven, en dat hoort de lezer te weten -- anders
       leest een lijst van een als een advies. */
    aannames.push(W.AANNAME_EEN_MANIER);
  }

  /* REGEL 5: de telling gaat over VOORWAARDEN. Gelijke aantallen worden niet
     uit elkaar gehaald -- wie dat wel doet, verzint een rangorde. */
  const knelpunten = [...blokkeertHoeveel.entries()]
    .map(([id, n]) => ({ id, wat: (vw.get(id) || {}).wat || id, blokkeertWegen: n }))
    .sort((a, b2) => b2.blokkeertWegen - a.blokkeertWegen || a.id.localeCompare(b2.id));

  return {
    ok: true,
    doel,
    manieren: uit,
    knelpunten,
    aannames,
    /* REGEL 4, en hij staat in het ANTWOORD en niet alleen in dit bestand: een
       lezer die de volgorde voor een oordeel aanziet, doet dat anders alsnog. */
    ordening: W.ordening(b.manierenBron),
    grens: W.GRENS
  };
}

module.exports = { reken, STANDEN, WEGSTANDEN };
