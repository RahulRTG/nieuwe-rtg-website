/* Horeca (kern): HET DOELMOMENT EN DE BAAN -- de pure rekenkant van de cadans.

   WAAROM DIT EEN EIGEN BESTAND IS. ./cadans.js liep over de 10 kB-grens van
   keuringsregel 13 toen de bereidingsstappen erbij kwamen. De snede is niet
   willekeurig: hier staat de rekensom die NIETS van een rekening weet -- wanneer
   een gang op tafel hoort te staan, en in welke baan een gerecht valt. Daarnaast
   staat in cadans.js de PROJECTIE van die som over de rekeningen van een zaak.

   Alles hieronder is pure functie: geen opslag, geen tijdstip uit het niets, en
   geen enkel getal dat niet uit zijn invoer volgt. Zo is het te toetsen zonder
   een zaak te bouwen -- en dat is precies wat test/horeca-cadans.test.js doet. */
'use strict';

const { bereidingsMinuten } = require('./keukenlaag');

/* Twee marges, allebei klein en allebei uitlegbaar. PASMARGE is de tijd tussen
   "alles staat bij de pas" en "het staat op tafel": afwerken, controleren,
   weglopen. STARTVENSTER is hoe ruim "nu" is -- een kok die binnen twee minuten
   moet beginnen, staat in de baan NU en niet in HIERNA, want anders springt een
   gerecht van de ene kolom naar de andere terwijl hij ernaar kijkt. */
const PASMARGE = 2;
const STARTVENSTER = 2;

const MIN = 60000;
const minuten = (ms) => Math.round(ms / MIN);

function hhmm(ms) {
  const d = new Date(ms);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

/* "19:42" op de dag van de vrijgave. Een club serveert om half drie 's nachts,
   dus een tijd die meer dan zes uur vóór de vrijgave ligt, hoort bij de dag
   erna -- anders staat een bestelling van 02:15 vijftien uur in het verleden en
   kleurt het hele bord rood. */
function klokTijdNaarMs(tijd, ankerMs) {
  const m = /^([0-2]?\d):([0-5]\d)$/.exec(String(tijd || '').trim());
  if (!m) return null;
  const uur = Number(m[1]), min = Number(m[2]);
  if (uur > 23) return null;
  const anker = new Date(ankerMs);
  const d = new Date(anker.getFullYear(), anker.getMonth(), anker.getDate(), uur, min, 0, 0);
  let ms = d.getTime();
  if (ms < ankerMs - 6 * 60 * MIN) ms += 24 * 60 * MIN;
  return ms;
}

/* Het doelmoment van een gang. Twee bronnen, en welke het was staat erbij:

   AFSPRAAK -- de zaal heeft bij het vrijgeven een serveertijd meegegeven
   (`serveerOm`). Dat is een afspraak met de gast en die wint altijd.

   AFGELEID -- er is geen afspraak, dus leiden we hem af: vanaf het moment dat
   de gang is vrijgegeven, plus de tijd van het LANGZAAMSTE gerecht erin, plus
   de pasmarge. Dat is de vroegst mogelijke eerlijke belofte; korter kan de
   keuken niet en langer is verzonnen.

   DIE PASMARGE HOORT ER ECHT BIJ, en dat bleek pas uit een toets. Zonder hem is
   het doel `vrijgave + langste`, en dan is het startmoment van juist dat
   langzaamste gerecht `doel - pasmarge - langste` = twee minuten VOOR de
   vrijgave. Elke gang zonder afgesproken tijd kwam daardoor als achterstand
   binnen: de kok kreeg een rode bon op het moment dat de zaal hem vrijgaf.

   Er komt hier nooit een derde bron bij die "ongeveer" is. Wat we niet weten,
   zeggen we niet (HORECA.md, grens 7). */
function doelVanGang(h, regels, nuMs) {
  const afspraak = regels.map((r) => r.serveerOm).find(Boolean);
  const vrijMs = regels.reduce((vroegst, r) => {
    const t = Date.parse(r.vrijAt || '');
    return isNaN(t) ? vroegst : (vroegst === null ? t : Math.min(vroegst, t));
  }, null);
  const anker = vrijMs === null ? nuMs : vrijMs;

  if (afspraak) {
    const ms = klokTijdNaarMs(afspraak, anker);
    if (ms !== null) return { doelMs: ms, bron: 'afspraak',
      rekensom: 'De zaal gaf ' + afspraak + ' door als serveertijd.' };
  }
  const langste = regels.reduce((m, r) => Math.max(m, bereidingsMinuten(h, r)), 0);
  return { doelMs: anker + (langste + PASMARGE) * MIN, bron: 'afgeleid',
    rekensom: 'Geen afgesproken tijd; vrijgegeven plus ' + langste +
      ' min voor het langzaamste gerecht van deze gang, plus ' + PASMARGE +
      ' min bij de pas.' };
}

/* In welke baan hoort dit gerecht op het stationsbord?

   NU      dit moet nu aan, of het staat al aan en loopt op tijd
   HIERNA  hier begin je later aan; gebruik de tijd voor mise-en-place
   WACHT   klaar, maar de gang is nog niet compleet -- bewust vastgehouden
   RISICO  het startmoment is voorbij en het staat nog niet aan, of het loopt
           over zijn eigen norm heen

   De baan volgt uit de GETALLEN en nooit andersom -- zelfde regel als de kleur
   op het keukenbord. Wie de baan niet ziet, leest de minuten. */
function baanVan(regel, startOverMin, looptMin, norm, gangCompleet) {
  if (regel.stand === 'uitgegeven') return 'uitgegeven';
  if (regel.stand === 'klaar') return gangCompleet ? 'nu' : 'wacht';
  const bezig = regel.stand === 'gestart' || regel.stand === 'bereid';
  if (bezig) return looptMin > norm ? 'risico' : 'nu';
  if (startOverMin < -STARTVENSTER) return 'risico';
  if (startOverMin <= STARTVENSTER) return 'nu';
  return 'hierna';
}

module.exports = { PASMARGE, STARTVENSTER, MIN, minuten, hhmm, klokTijdNaarMs, doelVanGang, baanVan };
