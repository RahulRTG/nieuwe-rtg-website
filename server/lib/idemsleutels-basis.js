/* DE BASISTABEL VAN DE IDEMPOTENTIESLEUTELS -- de eerste ronde, op zichzelf.

   ./idemsleutels.js droeg deze tabel EN de opzoekweg EN de samenvoeging van de
   acht rondes, en groeide daarmee over de tienkilobytegrens van keuringsregel
   13. De naad ligt voor de hand, want dit huis heeft hem al zeven keer gelegd:
   elke ronde woont in een eigen bestand en komt er via Object.assign bij. Dit
   is diezelfde vorm voor de ronde die er als eerste was.

   Er verandert niets aan het register: de controles in ./idemsleutels-nooit.js
   lopen over het SAMENGEVOEGDE geheel en zien deze regels dus precies zoals
   eerst. Zie de kop van ./idemsleutels.js voor wat de drie soorten verklaring
   (`zelfdeVerzoek`, `nietIdempotent`, `leest`) betekenen en waarom er bij een
   `nietIdempotent` altijd een reden staat. */
'use strict';

const SLEUTELS = {
  /* ---- geverifieerd: de body draagt de identiteit van wat er gemaakt wordt ----

     Van elk van deze routes is de handler nagelezen: er staat een veld in de
     body dat bepaalt WAT er ontstaat (een naam, een titel, een datum). Twee
     woordelijk gelijke verzoeken binnen vijf seconden zijn dan een dubbeltik en
     geen tweede bedoeling. */
  'POST /api/concern/nieuw': { zelfdeVerzoek: true },              // naam
  'POST /api/concern/entiteit/nieuw': { zelfdeVerzoek: true },     // naam + rechtsvorm
  'POST /api/gewoonten/maak': { zelfdeVerzoek: true },             // naam
  'POST /api/genootschap/richt-op': { zelfdeVerzoek: true },       // naam + soort
  'POST /api/agenda/toevoegen': { zelfdeVerzoek: true },           // titel + datum + tijd
  'POST /api/gemeente/meld': { zelfdeVerzoek: true },              // de melding zelf
  'POST /api/member/leren/project-maak': { zelfdeVerzoek: true },  // titel
  'POST /api/mall/lijst/nieuw': { zelfdeVerzoek: true },           // naam, verplicht (kern/mall/lijsten.js)
  'POST /api/mediaos/lijst/maak': { zelfdeVerzoek: true },         // naam, verplicht (kern/mediaos/lijsten.js)
  'POST /api/office/architect/maak': { zelfdeVerzoek: true },      // naam, verplicht (kern/architect/index.js)
  'POST /api/office/atelier/maak': { zelfdeVerzoek: true },        // naam, verplicht (kern/atelier/index.js)
  'POST /api/office/hardware/maak': { zelfdeVerzoek: true },       // naam, verplicht (kern/hardwarelab/index.js)
  'POST /api/office/ideeen/maak': { zelfdeVerzoek: true },         // titel, verplicht (kern/ideeen.js)

  /* De werkruimte bewaart één actuele compositie per lid en het auditspoor
     noteert één brokerhandeling. Een netwerkretry met exact dezelfde inhoud
     mag daarom noch een tweede schrijfbeweging, noch een dubbele auditregel
     veroorzaken. */
  'POST /api/ik/workspace/zet': { zelfdeVerzoek: true },
  'POST /api/ik/workspace/audit/noteer': { zelfdeVerzoek: true },

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

  /* Dezelfde toets als hierboven, andere uitkomst: bij deze vier staat er GEEN
     verplicht veld in de body dat bepaalt wat er ontstaat. Wie zonder inhoud
     een tweede maakt, krijgt met recht een tweede -- en een laag die dat
     opslikt, laat werk verdwijnen. */
  /* DE AI-DATASET EXPORTEREN, en dit is met opzet GEEN dubbeltik.

     De idempotentieproef ziet dat een tweede oproep "het werk opnieuw doet", en
     dat klopt: er komt een tweede regel in het auditlog. Dat is precies wat er
     hoort te gebeuren. De dataset heeft twee keer het gebouw verlaten, en een
     spoor dat de tweede keer verzwijgt is een slechter spoor.

     Het bestand zelf is een download en geen bewaarde bron: er ontstaat geen
     tweede record, alleen een tweede levering. Afvangen zou hier dus niet een
     dubbeling voorkomen maar een uitgifte verbergen (routes/kantoren/geld.js). */
  'POST /api/office/aidata/export': { nietIdempotent: true,
    waarom: 'elke export is een echte uitgifte: de dataset verlaat het gebouw en dat hoort ' +
      'per keer in het auditlog te staan. Er ontstaat geen tweede record, alleen een tweede ' +
      'levering -- afvangen zou een uitgifte verbergen in plaats van een dubbeling voorkomen' },
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
  /* De post naar de tweede machine (server/lib/ankerpost.js). Bijschrijven is
     hier GEEN nevenwerking om tegen te houden: het anker is per ontwerp
     append-only, en twee blokken achter elkaar zijn twee eerlijke momentopnamen
     van dezelfde ketenkop. Wie de tweede opslikt, laat een anker missen. */
  'POST /api/office/anker/post': { nietIdempotent: true,
    waarom: 'brengt het blok van NU weg; twee keer wegbrengen zijn twee ankermomenten, en een laag die ' +
      'de tweede opslikt maakt een gat in precies de reeks die kopafknipping zichtbaar moet maken' },
  'POST /api/office/anker/post/reken': { leest: true },

  /* De objectpagina (kern/objectlaag/pagina.js): tien secties over een object
     dat de laag zelf niet bezit. Een POST die niets verandert. */
  'POST /api/sociaal/object/pagina': { leest: true },

  /* De correctie op een horecarekeningregel. GEEN `zelfdeVerzoek`, en dat is
     een besluit: de route handelt de herhaling ZELF af met een 409 die de
     bestaande correctie meegeeft ("dit is er al mee gebeurd, en door wie").
     Zou de poort de tweede tik opslikken en het eerste antwoord teruggeven, dan
     verdween juist die mededeling -- terwijl een medewerker die twee keer drukt
     wil weten dat er al iets stond. De STAND na twee aanroepen is dezelfde als
     na een (mutatiecontracten-horeca-correctie.js: PROTECTED, gemeten in
     scripts/tafelproef.js storing 6); het ANTWOORD is met opzet anders. */
  'POST /api/supplier/horeca/rekening/regel/corrigeer': { nietIdempotent: true,
    waarom: 'de route weigert de tweede correctie zelf met een 409 die zegt wat er al is gebeurd; ' +
      'de poort die tik laten opslikken zou die mededeling wegnemen bij precies de mens die hem nodig heeft' },
  'POST /api/office/handelingen': { leest: true },
  'POST /api/ik/workspace': { leest: true },
  'POST /api/ik/workspace/audit': { leest: true }
};

module.exports = { SLEUTELS };
