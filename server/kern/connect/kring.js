/* ============================================================================
   DE KRING -- wie mag dit zien. Een POORT, geen etiket.

   Niet iedere gebruiker hoeft vanaf dag een openbaar op het internet te staan.
   Vijf kringen, oplopend: alleenIk -> gezin -> team -> community -> publiek.

   HET WOORD IS AL BEZET EN DAT IS MET OPZET. CONNECTLUS.json vond `kring` op
   drie plekken, en op de plek die ertoe doet betekent hij precies dit:
   kern/veiligheid/opslag.js noemt hem "wie er meekijkt, per lid", en
   kern/levensgraaf/graaf.js heeft een `KRING` die de zichtbaarheid van een
   knoop bepaalt. Een VIERDE betekenis onder dezelfde naam zou de botsing zijn
   die SEMANTIEK.json meet; dezelfde betekenis hergebruiken is het
   tegenovergestelde daarvan. Wie hier iets anders onder `kring` hangt --
   een vriendengroep, een chat -- maakt de naam onleesbaar voor drie lagen.

   POORT EN GEEN ETIKET, en dat is de hele reden dat dit bestand bestaat.
   graaf.js zegt het over `deel`: de motor FILTERT erop, en de bureau-kant
   krijgt nooit meer dan is vrijgegeven. Hier net zo: `magZien()` is de enige
   plek waar zichtbaarheid wordt beslist. Een laag die de kring als veld
   meestuurt en de lezer laat filteren, lekt bij de eerste route die het
   vergeet -- en dat is precies het soort lek dat geen enkele toets ziet, want
   het antwoord ziet er goed uit.

   DE LADDER GAAT EEN KANT OP, EN NIET DE KANT DIE HIJ LIJKT TE GAAN. Dit is de
   enige plek in dit bestand waar ik er echt naast zat, en de fout zag er goed
   uit: `kijker >= doel`, dus een hogere trap ziet meer. Daarmee kon een
   GEZINSLID het publieke werk van zijn eigen kind niet zien.

   De twee getallen meten namelijk niet hetzelfde. De trap van een KRING is
   BEREIK: hoe hoger, hoe meer mensen erbij mogen. De trap van een RELATIE is
   NABIJHEID: hoe lager, hoe dichter iemand bij de maker staat. Wie dichtbij
   staat ziet dus wat verder reikt, en de vergelijking is `nabijheid <=
   bereik`. Twee schalen met dezelfde namen en tegengestelde richting -- precies
   de vorm waarvan BEWIJSMACHINE.md par. 6a zegt dat een proef een geldige
   uitslag kan geven terwijl het verkeerde experiment is uitgevoerd.

   De namen in de handtekening dragen dat verschil daarom uit, en `trapVan`
   heeft twee lezers met twee betekenissen. Wie hier een derde schaal bij zet,
   zet hem naast twee die al tegen elkaar in lopen.

   VERSMALLEN KAN ALTIJD, VERBREDEN NIET ALTIJD. Dat is geen symmetrie die per
   ongeluk ontbreekt:

     - Een BESCHERMD profiel (minderjarig) komt niet voorbij `team`. Niet als
       instelling en niet met een vinkje van een ouder: FOUNDATION.md en de
       progressiegrens van kern/spellen/grens.js zeggen allebei dat de
       bescherming van een kind geen voorkeur is. Wat een kind maakt mag in het
       gezin en in zijn team bestaan; publiek maken is een besluit dat niemand
       namens hem kan nemen omdat het niet terug te draaien is.
     - VERSMALLEN werkt ook als het profiel beschermd is, ook als de kring
       ongeldig was, en ook zonder reden. Een uitweg die voorwaarden heeft, is
       geen uitweg.

   WAT HIER NIET WOONT: wie tot welke kring BEHOORT. Dat is een vraag over
   mensen en die hoort bij de domeinen die de mensen kennen -- het gezin bij
   foundation/gezinshulp.js, het team bij zijn eigen laag. Deze module krijgt de
   relatie als woord mee en zoekt hem nooit zelf op. Zonder die knip zou hier
   een tweede plek ontstaan waar staat wie bij wiens gezin hoort, en dan lopen
   ze uiteen (LAT-regel 4).
   ========================================================================== */
'use strict';

/* De ladder. `trap` is het enige dat de vergelijking gebruikt; de rest staat
   erbij zodat een scherm hem kan tonen zonder de tekst over te typen. */
const KRINGEN = [
  { id: 'alleenIk',  trap: 0, naam: 'Alleen ik',
    grond: 'Waar alles begint. Wat gemaakt is staat hier tot de maker zelf iets anders kiest -- niet andersom.' },
  { id: 'gezin',     trap: 1, naam: 'Mijn gezin',
    grond: 'De profielen van hetzelfde gezin in FoundationOS. Voor een kind is dit de eerste kring waarin iets kan bestaan zonder dat het buiten huis komt.' },
  { id: 'team',      trap: 2, naam: 'Mijn team',
    grond: 'De mensen met wie iemand aan deze opdracht werkt. Een team is begrensd in tijd en aantal; het is geen publiek.' },
  { id: 'community', trap: 3, naam: 'De community',
    grond: 'Wie hetzelfde onderwerp volgt. Zichtbaar voor veel mensen, maar niet voor het open internet en niet voor een zoekmachine.' },
  { id: 'publiek',   trap: 4, naam: 'Iedereen',
    grond: 'Buiten Foundation leesbaar. Onomkeerbaar in de praktijk: wat eenmaal publiek is geweest, is gekopieerd kunnen zijn.' }
];

const OP_ID = new Map(KRINGEN.map(k => [k.id, k]));
const STANDAARD = 'alleenIk';
const MAX_BESCHERMD = 'team';

const kring = (id) => OP_ID.get(String(id == null ? '' : id)) || null;
const trapVan = (id) => { const k = kring(id); return k ? k.trap : null; };

/* DE POORT. `kringVan` is het BEREIK van het ding, `relatie` de NABIJHEID van
   de kijker -- hetzelfde woord uit dezelfde lijst, maar zie de kop: de twee
   trappen lopen tegen elkaar in. Een onbekende waarde aan welke kant dan ook
   is DICHT en niet open: een typefout in een relatie mag geen publicatie
   worden (kern/stuur/mandaat.js: leeg is dicht). */
function magZien(kringVan, relatie) {
  const bereik = trapVan(kringVan), nabijheid = trapVan(relatie);
  if (bereik == null || nabijheid == null) return false;
  return nabijheid <= bereik;
}

/* De kring ZETTEN. Geeft altijd een uitkomst terug en gooit nooit: een scherm
   dat een kring niet mag verbreden, hoort de reden te kunnen tonen. */
function zet(huidig, gewenst, opties) {
  const o = opties || {};
  const nu = kring(huidig) ? huidig : STANDAARD;
  const naar = kring(gewenst);
  if (!naar) return { ok: false, kring: nu,
    reden: 'Die kring bestaat niet. Kies uit: ' + KRINGEN.map(k => k.id).join(', ') + '.' };

  /* Versmallen mag altijd en staat daarom VOOR elke andere toets. Zou de
     beschermd-regel erboven staan, dan kon een beschermd profiel zijn eigen
     werk niet meer terugtrekken zodra het per ongeluk in `team` stond. Een
     grens die de uitgang meeneemt, is geen bescherming. */
  if (naar.trap <= trapVan(nu)) return { ok: true, kring: naar.id, versmald: naar.trap < trapVan(nu) };

  if (o.beschermd && naar.trap > trapVan(MAX_BESCHERMD)) {
    return { ok: false, kring: nu,
      reden: 'Dit profiel is van iemand onder de achttien. Werk kan hier in het gezin en in een team staan, ' +
        'en niet daarbuiten. Dat is geen instelling: publiek maken is niet terug te draaien, en dat besluit ' +
        'neemt niemand namens een kind.',
      hoogste: MAX_BESCHERMD };
  }
  return { ok: true, kring: naar.id, versmald: false };
}

/* Wat een mens mag KIEZEN, met per kring of hij open staat en zo niet waarom.
   Een grijze knop zonder uitleg komt er niet bij (GRAMMATICA.md). */
function keuzes(opties) {
  const o = opties || {};
  return KRINGEN.map(k => ({
    kring: k.id, naam: k.naam, grond: k.grond,
    kan: !(o.beschermd && k.trap > trapVan(MAX_BESCHERMD)),
    reden: (o.beschermd && k.trap > trapVan(MAX_BESCHERMD))
      ? 'Niet beschikbaar zolang dit profiel van iemand onder de achttien is.' : null
  }));
}

module.exports = { KRINGEN, STANDAARD, MAX_BESCHERMD, kring, trapVan, magZien, zet, keuzes };
