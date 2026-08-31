/* WAT IS "HETZELFDE VERZOEK"? -- deel 2 van de verklaringen.

   Afgesplitst toen ./idemsleutels.js door de 10 KB van keuringsregel 13 ging,
   nadat de idemproef weer kon draaien en twee routes aanwees die om een besluit
   vroegen. De snede loopt langs de sectiegrens en niet op de byte: deel 1 draagt
   de routes waarvan de BODY de identiteit bepaalt, dit deel draagt de twee
   groepen die daar juist tegenover staan -- handelingen die met opzet een tweede
   effect hebben, en POSTs die niets veranderen.

   De uitleg over de vier vormen staat in ./idemsleutels.js en hoort daar; twee
   koppen met dezelfde regels lopen uiteen (LAT.md regel 4). */
'use strict';

module.exports = {
  /* ---- bewust NIET idempotent, met de reden erbij ----

     /api/muziek/maak stond hier eerst als "zelfde verzoek is een herhaling", en
     dat was fout. Hij maakt uit een LEGE body elke keer een nieuw stuk; twee
     oproepen zijn twee stukken. test/mediaos.test.js ving het meteen.

     Dat is precies de fout waar de kop van dit bestand voor waarschuwt, en ik
     liep er zelf in: de verklaring was op de NAAM van de route gebaseerd ("maak"
     klinkt als aanmaken met inhoud) en niet op de handler. Een verklaring die je
     niet hebt nagelezen, is een gok met een net gezicht. */
  'POST /api/muziek/maak': { nietIdempotent: true,
    waarom: 'maakt uit een lege body elke keer een NIEUW stuk; twee oproepen zijn twee stukken, ' +
      'en een laag die de tweede opslikt laat werk verdwijnen zonder dat iemand het merkt' },
  'POST /api/command/sonde/draai': { nietIdempotent: true,
    waarom: 'een sonde draaien is een MEETHANDELING: twee keer draaien hoort twee metingen op te leveren, ' +
      'anders meet de tweede ronde de eerste' },
  'POST /api/command/puls': { nietIdempotent: true,
    waarom: 'de puls is een momentopname; twee keer vragen hoort twee momenten te geven' },
  'POST /api/live/start': { nietIdempotent: true,
    waarom: 'een tweede start is een nieuwe uitzending, niet dezelfde nog eens' },

  /* DEZE TWEE ZIJN DOOR DE IDEMPROEF ZELF GEVONDEN, op de eerste ronde nadat hij
     weer kon draaien (zie scripts/lib/proefsleutels.js: de proeven kwamen negen
     dagen lang niet meer binnen). Van de 1104 beoordeelde routes waren dit de
     enige twee waar een herhaling het werk opnieuw deed -- en ze vragen om
     tegengestelde besluiten. Dat is precies waarom dit bestand bestaat. */
  'POST /api/office/aidata/export': { nietIdempotent: true,
    waarom: 'een export is een GEBEURTENIS: er komt een auditregel bij ("AI-dataset geexporteerd, ' +
      'N records"). Twee keer exporteren hoort twee regels op te leveren, want dat is wat een auditlog ' +
      'van een dataset-export moet vastleggen. De tweede opslikken zou een export onzichtbaar maken -- ' +
      'erger dan het dubbeltik-ongemak dat het oplost' },

  /* Dezelfde toets als hierboven, andere uitkomst: bij deze vier staat er GEEN
     verplicht veld in de body dat bepaalt wat er ontstaat. Wie zonder inhoud
     een tweede maakt, krijgt met recht een tweede -- en een laag die dat
     opslikt, laat werk verdwijnen. */
  'POST /api/office/kantoorpakket/maak': { nietIdempotent: true,
    waarom: 'de titel is optioneel en valt terug op "Nieuw document"; twee lege oproepen zijn ' +
      'twee verse documenten, niet dezelfde nog eens (kern/office/docs.js)' },
  'POST /api/meet/maak': { nietIdempotent: true,
    waarom: 'zonder agendaId ontstaat er elke keer een verse kamer met een eigen toegangscode; ' +
      'MET agendaId dedupliceert de route zelf al (kern/meet.js geeft dan bestond:true terug), ' +
      'dus er valt hier niets te winnen en wel iets te verliezen' },
  'POST /api/concern/opname/maak': { nietIdempotent: true,
    waarom: 'een opname is een momentopname van het concern; twee keer vragen hoort met recht ' +
      'twee momenten op te leveren, anders is de tweede opname stil de eerste' },

  /* ---- routes die niets veranderen ----

     Een POST die alleen leest. Herhalen is per definitie veilig, en er valt
     niets te dedupliceren: de poort doet hier dan ook niets. Ze staan hier
     omdat "geen verklaring" en "verklaard als leesroute" twee verschillende
     dingen zijn, en de schuldteller dat verschil hoort te zien. */
  'POST /api/office/anker': { leest: true },
  'POST /api/office/anker/reken': { leest: true },
  'POST /api/office/handelingen': { leest: true }
};
