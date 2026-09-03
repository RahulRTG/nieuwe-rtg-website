/* ============================================================================
   WIE ERAAN WERKT -- de teams en de onderwerpen die naar een team wijzen.

   Apart van ./klassen.js omdat dat bestand er over de omvangsgrens van
   keuringsregel 13 mee ging, en de naad ligt op een echte grens: ./klassen.js
   zegt wat een zaak IS (soort, doelgroep, kanaal, stand), dit zegt wie eraan
   werkt en met welke bevoegdheid. Wie een stand toevoegt raakt dit bestand niet
   aan, en omgekeerd.
   ========================================================================== */
'use strict';

/* ------------------------------------------------------------------ teams -- */
/* Wat de melder ziet is "RTG Support". Dit is de binnenkant. Elk team noemt de
   BEVOEGDHEDEN die zijn werk vraagt; ./machtiging.js geeft ze per zaak en
   tijdelijk uit, en nooit permanent aan een mens. */
/* WAAROM HIER OOK ZWAAR WERK IN STAAT. De eerste opzet hield de zware
   capabilities uit deze tabel, "voor de zekerheid". Dat leverde een DODE TAK op:
   ./machtiging.js versmalt naar wat het team nodig heeft, dus kon geen aanvraag
   ooit zwaar werk bevatten, en de tweede-handtekening -- de duurste grendel van
   deze laag -- werd nooit uitgevoerd terwijl de toets groen stond. Dezelfde fout
   als de cap `rooms` uit PLATFORM.md. Zwaar werk staat dus bij het team dat het
   doet; de grendel zit op de HANDELING (./machtiging.js ZWAAR), niet op de tabel. */
const TEAMS = {
  leden:      { naam: 'Service · Leden',        capabilities: ['zaak.lezen', 'lid.dossier', 'gegevens.uitvoer'] },
  betalingen: { naam: 'Service · Betalingen',   capabilities: ['zaak.lezen', 'betaling.stand', 'bank.gegevens', 'geld.compensatie'] },
  toegang:    { naam: 'Service · Toegang',      capabilities: ['zaak.lezen', 'identiteit.uitdaging', 'identiteit.openen'] },
  zakelijk:   { naam: 'Service · Zakelijk',     capabilities: ['zaak.lezen', 'organisatie.stand', 'bank.gegevens'] },
  techniek:   { naam: 'Service · Techniek',     capabilities: ['zaak.lezen', 'incident.koppelen'] },
  concierge:  { naam: 'De Rechterhand',         capabilities: ['zaak.lezen'] },
  veiligheid: { naam: 'Service · Veiligheid',   capabilities: ['zaak.lezen', 'identiteit.openen'] }
};

/* ------------------------------------------------------------ onderwerpen -- */
/* De onderwerpen die de routering kent. Bewust kort: een lijst van veertig
   onderwerpen wordt door de melder verkeerd gekozen en door de router genegeerd.
   `team` is een VOORKEUR -- ./router.js mag ervan afwijken op grond van wie er
   meldt, en legt dat dan uit. */
const ONDERWERPEN = {
  betaling:   { naam: 'Een betaling of uitbetaling', team: 'betalingen' },
  bestelling: { naam: 'Een bestelling of levering',  team: 'leden' },
  reis:       { naam: 'Een reis of boeking',         team: 'leden' },
  account:    { naam: 'Inloggen of mijn account',    team: 'toegang' },
  app:        { naam: 'De app of het scherm',        team: 'techniek' },
  zaak:       { naam: 'Mijn zaak of organisatie',    team: 'zakelijk' },
  veiligheid: { naam: 'Veiligheid of misbruik',      team: 'veiligheid' },
  anders:     { naam: 'Iets anders',                 team: 'leden' }
};

module.exports = { TEAMS, ONDERWERPEN };
