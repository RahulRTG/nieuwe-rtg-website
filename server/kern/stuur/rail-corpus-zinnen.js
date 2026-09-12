/* WAT DE DETERMINISTISCHE RAIL BIJ EEN ZIN DOET -- het script, niet het contract.

   De VERWACHTINGEN staan in ./menstaal.json: per menselijke zin wat er mag
   gebeuren, rail-onafhankelijk. Dit bestand zegt alleen wat DEZE rail doet, en
   kent die verwachtingen niet -- anders zou het corpus zichzelf gelijk geven.
   `test/menstaal.test.js` houdt de twee tegen elkaar: een zin die hier staat en
   niet in het contract, laat de bouw zakken.

   DE SLEUTEL IS DE GENORMALISEERDE ZIN (./rail-corpus.js). Staat een zin er
   niet in, dan is het antwoord NIET_HERKEND en gebeurt er niets. De rail raadt
   niet: dat is geen tekortkoming maar het punt.

   WAAROM DE CONTEXTGEVALLEN HIER NIET STAAN. Ze bestaan wel, sinds fase 4, maar
   in ./rail-corpus-context.js -- want daar is de sleutel vraag PLUS scherm. Dat
   die scheiding er is, is de hele reden dat fase 4 bestond: "die andere"
   normaliseerde zonder context drie keer naar dezelfde sleutel, dus deze rail
   kon er maar EEN van scripten. Nu plakt ./lus.js de gesaneerde handtekening
   van ./menscontext.js onder de vraag, en heeft elke variant zijn eigen sleutel.
   Zet een zin met context dus daar en niet hier: een sleutel die in allebei
   staat is een botsing, en test/menscontext.test.js laat de bouw daarop zakken.

   DE PADEN ZIJN ECHT en staan op de member-allowlist van ./beleid.js. Een
   corpus dat naar een verzonnen of verboden pad wijst, bewijst dat het plan
   terecht zakt en verder niets -- `test/stuurrail.test.js` toets 10 houdt dat
   tegen.

   WAT ER MET OPZET NIET GESCRIPT IS: "waar is mijn bestelling". Er staat geen
   bestel- of orderpad op de member-allowlist, net zomin als een reispad. Een
   pad verzinnen om de dekking op te poetsen is precies de fout die deze hele
   laag moet uitsluiten. */
'use strict';

/* Een zin die alleen antwoord geeft: geen enkele tool, dus geen enkel effect.
   Zo hoort een uitlegvraag door de operationele motor heen te gaan -- namelijk
   niet. */
const uitleg = (projectie) => ({ stappen: [], projectie });

/* Een zin die niet genoeg zegt. Hij stelt EEN vraag en doet niets; taal schept
   geen bevoegdheid, en bij twee plausibele objecten wordt er niet gegokt. */
const verhelder = (projectie) => ({ stappen: [], projectie });

/* Een operationele zin: eerst de kaart (de echte resolver versmalt de
   allowlist), dan het plan (de echte compileer() weegt, de echte voorspel()
   kijkt naar gevolgen). Er staat nooit een `doe` in: dit corpus zet nooit iets
   in gang, het laat de machine wegen. */
const werk = (doel, paden, projectie) => ({
  stappen: [
    { tools: [{ name: 'kaart', input: {} }] },
    { tools: [{ name: 'plan', input: { doel,
      stappen: paden.map((p, i) => ({ id: 's' + (i + 1), capability: p, invoer: {},
        afhankelijkVan: i ? ['s' + i] : [] })) } }] }
  ],
  projectie
});

module.exports = {
  /* ---- INFORMATION: acht vragen die niets mogen aanraken ---- */
  'wat is travelos': uitleg('TravelOS is de wereld waarin je reizen worden geregeld: ' +
    'boeken, onderweg zijn, en wat er daarna nog moet gebeuren.'),
  'wat kan rtg': uitleg('RTG regelt je dagelijks leven, je werk, je reizen en je ' +
    'maatschappelijke zaken op een plek. Zeg gewoon wat je nodig hebt.'),
  'hoe werkt betalen': uitleg('Betalen loopt via RTG Pay. Wat geld beweegt wordt altijd ' +
    'eerst klaargezet; bevestigen doe je zelf.'),
  'wat is het verschil tussen de passen': uitleg('De RTG Pass geeft je het hele platform. ' +
    'Lifestyle betekent dat iemand het vóór je doet. Business voegt een eigen werkwereld toe.'),
  'waar staat mijn codenaam voor': uitleg('Je gegevens staan bij ons op een codenaam. Je echte ' +
    'naam ligt apart en wordt alleen gekoppeld wanneer dat echt nodig is.'),
  'wat is de salon': uitleg('De Salon is het besloten sociale netwerk van RTG: wie er lid is, ' +
    'deelt daar wat hij kwijt wil aan mensen die hij kent.'),
  'wat doet de rtfoundation': uitleg('De RTFoundation is de stichting naast RTG. Zij besteedt ' +
    'een deel van de bijdragen aan maatschappelijk werk.'),
  'wie kan mijn gegevens zien': uitleg('Alleen jij, en wie jij daarvoor toestemming geeft. ' +
    'Een medewerker die iets opent, laat daarvan een spoor na.'),

  /* ---- Zinnen die te weinig zeggen: EEN vraag, geen enkel effect ---- */
  'die andere': verhelder('Ik weet niet welke je bedoelt. Waar gaat het over?'),
  'doe maar': verhelder('Er staat op dit moment niets klaar om te doen. Wat wil je?'),
  'liever later': verhelder('Later dan wat? Er loopt nu niets waar ik dat op kan betrekken.'),
  'deze': verhelder('Welke bedoel je, en wat moet ermee gebeuren?'),
  'zelfde als vorige keer': verhelder('Ik zie niet waar je naar terugkijkt. Wat wil je herhalen?'),

  /* ---- ACTION ---- */
  'parijs vrijdag': Object.assign(
    { stappen: [{ tools: [{ name: 'kaart', input: {} }] }] },
    { projectie: 'Parijs · vrijdag\nIk kan je laten zien wat er kan. Waar wil je vertrekken?' }),
  'zet vrijdag in mijn agenda': werk('een afspraak op vrijdag in de agenda zetten',
    ['/api/agenda/mijn', '/api/agenda/toevoegen'],
    'Vrijdag · agenda\nIk heb klaargezet wat er zou veranderen. Bevestigen doe je zelf.'),
  'wat staat er morgen in mijn agenda': werk('zien wat er morgen in de agenda staat',
    ['/api/agenda/mijn'], 'Dit staat er morgen in je agenda.'),
  'plan een afspraak volgende week dinsdag': werk('een afspraak op dinsdag klaarzetten',
    ['/api/agenda/mijn', '/api/agenda/toevoegen'],
    'Dinsdag · agenda\nIk heb de afspraak klaargezet. Bevestigen doe je zelf.'),
  'deel mijn locatie': werk('de eigen locatie delen',
    ['/api/locatie/mijn', '/api/locatie/deel'],
    'Ik heb klaargezet met wie je je locatie zou delen. Bevestigen doe je zelf.'),
  'stop met mijn locatie delen': werk('het delen van de locatie stoppen',
    ['/api/locatie/stop'], 'Ik heb klaargezet om het delen te stoppen. Bevestigen doe je zelf.'),
  'toon mijn documenten': werk('de eigen documenten tonen',
    ['/api/asset/mijn'], 'Dit zijn je documenten.'),
  'wat zijn mijn vakken': werk('de eigen vakken tonen',
    ['/api/leerstof/vakken'], 'Dit zijn je vakken.'),
  'maak een nieuwe site': werk('een nieuwe site klaarzetten',
    ['/api/site/mijn', '/api/site/bewaar'],
    'Ik heb een nieuwe site klaargezet. Bevestigen doe je zelf.'),
  'zet een ontmoeting op': werk('een ontmoeting klaarzetten',
    ['/api/meet/maak'], 'Ik heb de ontmoeting klaargezet. Bevestigen doe je zelf.')
};
