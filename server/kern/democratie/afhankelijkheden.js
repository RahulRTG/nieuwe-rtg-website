/* ============================================================================
   WAT DEMOCRATIEOS UIT RTG GEBRUIKT -- en niet genoemd is geen afhankelijkheid.

   WAAROM DIT BESTAAT (POLITIEK.md par. 1.1, proef P3). De vraag is of een
   onafhankelijke organisatie DemocratieOS elders kan voortzetten als RTG morgen
   stopt. Dat kan alleen als bekend is wat hij van RTG nodig heeft. Een
   afhankelijkheid die niemand heeft opgeschreven, wordt pas ontdekt als hij
   ontbreekt -- en dan is het te laat.

   Daarom staat hier ELKE module buiten deze map die de code van DemocratieOS
   laadt, en elke naam die hij van de rest van het huis krijgt. Wat hier niet
   staat, mag er niet zijn: test/democratie-afhankelijk.test.js leest de bron
   en zakt op elke onverklaarde afhankelijkheid (UNDECLARED_RTG_DEPENDENCY = 0).

   Per regel staat erbij WAT het doet en HOE vervangbaar het is. Een lijst
   zonder dat tweede veld zegt alleen dat er afhankelijkheden zijn, niet wat
   een verhuizing kost. */
'use strict';

/* Modules buiten server/kern/democratie/ en server/routes/democratie/. */
const MODULES = {
  '../eigencollectie': { wat: 'bezit van de drie eigen collecties, met een schrijver per collectie',
    vervangbaar: 'ja: een opslag met drie benoemde verzamelingen' },
  '../../lib/duurzaam': { wat: 'pas bevestigen als het vastligt; anders 503',
    vervangbaar: 'ja: elke opslag met een bevestigde commit' },
  '../../lib/keten': { wat: 'hashketen onder de tijdlijn en het journaal',
    vervangbaar: 'ja: zelfstandige functies zonder staat, alleen node:crypto' },
  '../../lib/klok': { wat: 'de tijd, verschuifbaar in toetsen', vervangbaar: 'ja: Date.now()' },
  '../util': { wat: 'invoer inkorten en ontdoen van < en >', vervangbaar: 'ja: een regel code' }
};

/* Namen die de fabriek van buitenaf krijgt (kern/democratie/index.js). */
const GEINJECTEERD = {
  db: { wat: 'de opslag waarin de collecties staan', vervangbaar: 'ja' },
  save: { wat: 'wegschrijven', vervangbaar: 'ja' },
  bijeen: { wat: 'een bundel die in een keer wordt vastgelegd', vervangbaar: 'ja' },
  inBundel: { wat: 'weten of we al in een bundel zitten', vervangbaar: 'ja' },
  crypto: { wat: 'willekeurige nummers voor kwesties en inbrengers', vervangbaar: 'ja: node:crypto' },
  meldLid: { wat: 'een WEK in de berichten van het lid; nooit het bewijs van terugkoppeling',
    vervangbaar: 'ja: elke berichtendienst, of geen -- het leespad is de eigen lijst' },
  codenaamVan: { wat: 'de codenaam van wie een besluit nam, voor DO-09 (macht is zichtbaar)',
    vervangbaar: 'deels: de nieuwe organisatie heeft een eigen identiteitsdienst nodig' }
};

/* Namen die de routes uit de kern-zak van RTG halen. */
const ROUTES = {
  app: { wat: 'de webserver', vervangbaar: 'ja' },
  auth: { wat: 'een ingelogde sessie van een lid', vervangbaar: 'deels: eigen inlog nodig' },
  officeAuth: { wat: 'de kantoordeur', vervangbaar: 'deels: eigen behandelaarsrol nodig' },
  boardroomWie: { wat: 'welke MENS er achter het kantoortoken zit', vervangbaar: 'deels' },
  democratie: { wat: 'deze laag zelf', vervangbaar: 'n.v.t.' }
};

/* De RTG-sleutel van een lid (`user-...`) wordt op PRECIES EEN plek bewaard:
   kern/democratie/koppeling.js. index.js en lid.js geven hem alleen door. Een
   kwestie kent alleen een inbrengersnummer, zodat hij kan verhuizen terwijl de
   persoonsgegevens in hun eigen domein blijven (POLITIEK.md par. 4: een kwestie
   verwijst en bezit niets). test/democratie.test.js controleert dat op de
   opgeslagen kwesties zelf. */

module.exports = { MODULES, GEINJECTEERD, ROUTES };
