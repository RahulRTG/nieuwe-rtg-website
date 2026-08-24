/* ============================================================================
   DE HANDELINGENREGISTER van de Trust Fabric: wat telt er mee, en waarin.

   Dit is bewust DATA en geen code, net als `kern/antivirus/definities.js`. Een
   handeling erbij is een regel erbij; de meter eronder verandert niet mee. Dat
   houdt de meetlogica klein en toetsbaar, en het maakt zichtbaar WELKE
   handelingen dit huis zwaar vindt -- die lijst is zelf een uitspraak.

   DE BELANGRIJKSTE EIGENSCHAP: WAT HIER NIET STAAT, KRIJGT GEEN NUL.

   De verleiding is een onbekende handeling als "licht" te behandelen, want dan
   werkt alles meteen overal. Dat is precies verkeerd om: een handeling die
   niemand heeft gewogen is niet licht, hij is ONGEWOGEN, en het verschil
   daartussen is het hele punt van deze laag (VERTROUWEN.md par. 3.1). Een
   soort die hier ontbreekt levert dus `gemeten: false` met de reden, en de
   step-up-laag erboven mag daar zelf een besluit over nemen -- maar dan wel
   een besluit, en niet een stilte die als groen leest.

   PER HANDELING VIER DINGEN, en ze zeggen elk iets anders:

     eenheid      waarin we tellen. "personen" is geen "records": tien records
                  over een persoon zijn een persoon.
     omkeerbaar   kan RTG het gevolg ongedaan maken? Let op de vangvraag: een
                  EXPORT is niet omkeerbaar. De knop is daarna misschien weg,
                  maar de gegevens zijn het huis uit en dat is niet terug te
                  draaien. Wie hier "true" invult omdat het scherm een
                  ongedaan-knop heeft, liegt tegen de bon van laag 5.
     vast         de absolute grens, voor als er nog geen eigen grondslag is
                  (zie blootstelling.js: koude start).
     gevoelig     raakt het bijzondere persoonsgegevens? Dan telt hetzelfde
                  aantal zwaarder, want de schade per eenheid is groter.
   ========================================================================== */
'use strict';

/* De soorten. Elke regel hier hoort bij iets wat in dit huis ECHT bestaat; een
   soort verzinnen voor de volledigheid maakt de lijst onbetrouwbaar als geheel.
   Groeit de lijst, dan groeit hij met een handeling die er is. */
const SOORTEN = [
  {
    id: 'tenant.uitvoer',
    naam: 'De volledige uitvoer van een werkruimte',
    eenheid: 'objecten',
    omkeerbaar: false,
    waaromNiet: 'De gegevens verlaten het huis. Een uitvoer is niet in te trekken.',
    vast: 2000,
    gevoelig: true
  },
  {
    id: 'mens.uitdienst',
    naam: 'Iemand uit dienst zetten',
    eenheid: 'personen',
    omkeerbaar: true,
    vast: 5,
    gevoelig: false
  },
  {
    id: 'mens.gevoelig.inzage',
    naam: 'Inzage in bijzondere persoonsgegevens',
    eenheid: 'personen',
    omkeerbaar: false,
    waaromNiet: 'Gezien is gezien. Het journaal legt vast dat het gebeurde, niet dat het ongedaan is.',
    vast: 25,
    gevoelig: true
  },
  {
    id: 'rol.geven',
    naam: 'Een rol toekennen',
    eenheid: 'rollen',
    omkeerbaar: true,
    vast: 3,
    gevoelig: false
  },
  {
    id: 'werkruimte.sluiten',
    naam: 'Een werkruimte sluiten',
    eenheid: 'werkruimtes',
    omkeerbaar: true,
    vast: 1,
    gevoelig: false
  },
  {
    id: 'tenant.vernietig',
    naam: 'Een tenant vernietigen',
    eenheid: 'tenants',
    omkeerbaar: false,
    waaromNiet: 'Vernietiging is het doel van de handeling; er is per definitie geen weg terug.',
    vast: 1,
    gevoelig: true
  }
];

/* Wat deze meter NIET meeweegt, met naam. Dezelfde regel als `nietGerekend` in
   bedrijf/gevolg.js: een meting die zwijgt over haar randen leest als een
   volledige risicoanalyse. */
const NIET_GEREKEND = [
  { wat: 'geld', reden: 'Er hangt hier nog geen bedrag aan een handeling; de betaalkant heeft een eigen grens (GELD.md par. 3) en die staat los van deze meter.' },
  { wat: 'de ontvanger', reden: 'Wie de uitvoer daarna krijgt is niet te zien vanaf de server. Een uitvoer naar de eigen laptop en een naar een onbekende telt hier hetzelfde.' },
  { wat: 'samenloop', reden: 'Twee handelingen die elk binnen de grens blijven maar samen niet, worden los gewogen. De blast radius van laag 6 is de plek waar dat wel samenkomt.' }
];

const BIJ_ID = new Map(SOORTEN.map(s => [s.id, s]));

/* Opzoeken levert NOOIT een verzonnen standaard. De aanroeper krijgt undefined
   en moet daar iets mee, en dat is de bedoeling. */
function soort(id) { return BIJ_ID.get(String(id || '')) || null; }

module.exports = { SOORTEN, NIET_GEREKEND, soort };
