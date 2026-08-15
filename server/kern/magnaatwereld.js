/* Magnaat Wereld: de veilige spelbrug tussen de echte RTG-functiecatalogus en
   een realistische kantoor-/ondernemersgame.

   Belangrijkste grens: een spelopdracht roept NOOIT een productie-endpoint aan.
   Elke functie wordt vertaald naar een trainingskopie met synthetische data.
   Daardoor kan iedere RTG-functie wel als spelmechaniek worden geoefend, zonder
   betalingen, berichten, identiteitschecks of partnerwerk echt uit te voeren.

   De Future Engine kijkt naar ontbrekende combinaties in de catalogus en legt
   voorstellen in de controlekamer. Hij mag voorstellen en testplannen maken;
   alleen een mens kan een voorstel naar test of pilot zetten. Ook een pilot
   blijft een Magnaat-sandbox en wijzigt nooit zelfstandig productiecode. */

const VERSIE = 5;
const DAG = 24 * 60 * 60 * 1000;
const DIENST_BONUS = { xp: 300, virtueelBudget: 25000, reputatie: 3 };
const { nu: klokNu } = require('../lib/klok');

/* De eerste volledige verticale werkroute. Dit is bewust geen quiz: de speler
   opent drie bestaande RTG-schermen en legt tussendoor de intake, overdracht en
   terugkoppeling vast. Alle velden eindigen uitsluitend in het synthetische
   Magnaat-dossier. Nieuwe werkprocessen kunnen later uit de Capability Graph
   dezelfde stapsoorten gebruiken. */
const KANTOORWERKPROCESSEN = [{
  id: 'service-reiswijziging', naam: 'Reiswijziging volledig afhandelen',
  afdeling: 'klantenservice', afdelingNaam: 'Klantenservice', rol: 'Service-regisseur',
  codeFamilies: ['/api/member/berichten', '/api/mob/reis', '/api/bedrijf/mijnwerk'],
  spelvorm: 'gesprek', veiligheidsniveau: 'geel',
  briefing: 'Een reiziger heeft een wijziging met een strakke aansluiting. Neem het dossier aan, controleer de reisketen, wijs eigenaarschap toe en koppel de oplossing terug.',
  stappen: [
    { soort: 'software', doel: 'link:berichten', schermNaam: 'Berichten', vraag: 'Open Berichten en lees het beveiligde verzoek.', uitleg: 'Het oefenbericht is geopend zonder echte communicatie te laden.' },
    { soort: 'formulier', vraag: 'Leg de intake vast.', uitleg: 'Een bruikbare intake bevat urgentie, doel en alleen noodzakelijke gegevens.', velden: [
      { id: 'samenvatting', label: 'Kern van de vraag', type: 'tekst', verplicht: true, min: 12, max: 180, placeholder: 'Bijvoorbeeld: aansluiting na routewijziging controleren' },
      { id: 'urgentie', label: 'Urgentie', type: 'keuze', verplicht: true, opties: ['Normaal', 'Vandaag', 'Direct veiligheidsrisico'] },
      { id: 'toestemming', label: 'Alleen noodzakelijke dossiergegevens gebruiken', type: 'vink', verplicht: true }
    ] },
    { soort: 'software', doel: 'tab:reizen', schermNaam: 'Reizen', vraag: 'Open Reizen en controleer de route en afhankelijkheden.', uitleg: 'De synthetische reisketen is gecontroleerd.' },
    { soort: 'formulier', vraag: 'Leg de gecontroleerde oplossing vast.', uitleg: 'De oplossing noemt de route, het controlepunt en een terugvaloptie.', velden: [
      { id: 'oplossing', label: 'Voorgestelde oplossing', type: 'tekst', verplicht: true, min: 16, max: 240, placeholder: 'Nieuwe aansluiting, bevestiging en terugvaloptie' },
      { id: 'ketencheck', label: 'Aansluiting, partner en tijdvenster gecontroleerd', type: 'vink', verplicht: true }
    ] },
    { soort: 'software', doel: 'os:werk', schermNaam: 'Werk', vraag: 'Open Werk en leg de interne overdracht vast.', uitleg: 'De werkvoorraad is geopend in de trainingskopie.' },
    { soort: 'formulier', vraag: 'Wijs een eigenaar en controlemoment toe.', uitleg: 'Een dossier blijft pas beheersbaar als duidelijk is wie en wanneer controleert.', velden: [
      { id: 'eigenaar', label: 'Dossiereigenaar', type: 'keuze', verplicht: true, opties: ['Ikzelf', 'Reisregie', 'Partner-support'] },
      { id: 'controle', label: 'Volgend controlemoment', type: 'keuze', verplicht: true, opties: ['Binnen 15 minuten', 'Binnen 1 uur', 'Voor vertrek'] }
    ] },
    { soort: 'software', doel: 'link:berichten', schermNaam: 'Berichten', vraag: 'Ga terug naar Berichten voor de afsluiting.', uitleg: 'Het beveiligde oefenkanaal is opnieuw geopend.' },
    { soort: 'formulier', vraag: 'Koppel de oplossing terug en sluit het dossier.', uitleg: 'De reiziger weet nu wat is geregeld, wie eigenaar is en wanneer opnieuw wordt gecontroleerd.', velden: [
      { id: 'terugkoppeling', label: 'Bericht aan de reiziger', type: 'tekst', verplicht: true, min: 20, max: 300, placeholder: 'Wat is geregeld, wie bewaakt het en wat is de volgende stap?' },
      { id: 'bevestigd', label: 'Oplossing, eigenaar en volgende stap zijn genoemd', type: 'vink', verplicht: true }
    ] }
  ]
}];

const STEDEN = [
  { id: 'amsterdam', naam: 'Amsterdam', land: 'Nederland', zone: 'Europa', vraag: 78, kosten: 72, impact: 66 },
  { id: 'barcelona', naam: 'Barcelona', land: 'Spanje', zone: 'Europa', vraag: 74, kosten: 61, impact: 69 },
  { id: 'dubai', naam: 'Dubai', land: 'Verenigde Arabische Emiraten', zone: 'Midden-Oosten', vraag: 81, kosten: 77, impact: 48 },
  { id: 'new-york', naam: 'New York', land: 'Verenigde Staten', zone: 'Noord-Amerika', vraag: 88, kosten: 86, impact: 57 },
  { id: 'nairobi', naam: 'Nairobi', land: 'Kenia', zone: 'Afrika', vraag: 67, kosten: 43, impact: 84 },
  { id: 'singapore', naam: 'Singapore', land: 'Singapore', zone: 'Azië', vraag: 83, kosten: 81, impact: 71 },
  { id: 'tokyo', naam: 'Tokyo', land: 'Japan', zone: 'Azië', vraag: 85, kosten: 79, impact: 76 },
  { id: 'sao-paulo', naam: 'São Paulo', land: 'Brazilië', zone: 'Zuid-Amerika', vraag: 72, kosten: 54, impact: 79 }
];

/* Eén transparant wereldsignaal per dag. Plaatsnamen zijn echt; situaties en
   gevolgen blijven speldata. Het signaal bepaalt het eerste dossier van de
   dagdienst en geeft alle drie dossiers een gedeelde operationele context. */
const WERELDGEBEURTENISSEN = [
  {
    id: 'drukte-amsterdam', stadId: 'amsterdam', spelvorm: 'operatie',
    titel: 'Topdrukte rond Amsterdam', label: 'Capaciteit',
    beschrijving: 'Een grote zakelijke aankomstgolf zet partners, personeel en beschikbaarheid tegelijk onder druk.',
    effect: 'Vraag +8 · kosten +3'
  },
  {
    id: 'route-barcelona', stadId: 'barcelona', spelvorm: 'planning',
    titel: 'Routewijzigingen rond Barcelona', label: 'Reisketen',
    beschrijving: 'Meerdere synthetische reisdossiers hebben vandaag een gewijzigde aansluiting en een strakke overdracht nodig.',
    effect: 'Vraag +5 · ketendruk +7'
  },
  {
    id: 'betaalpiek-dubai', stadId: 'dubai', spelvorm: 'controle',
    titel: 'Betaalpiek in Dubai', label: 'Controle',
    beschrijving: 'Een hogere virtuele omzet levert extra signalen op die zorgvuldig moeten worden onderzocht zonder klanten te blokkeren.',
    effect: 'Omzet +9 · risico +4'
  },
  {
    id: 'service-new-york', stadId: 'new-york', spelvorm: 'gesprek',
    titel: 'Servicedruk in New York', label: 'Relatie',
    beschrijving: 'Reizigers stellen tegelijk veel wijzigingsvragen. Snelheid telt, maar privacy en persoonlijk eigenaarschap blijven leidend.',
    effect: 'Berichten +11 · reputatiegevoelig'
  },
  {
    id: 'impact-nairobi', stadId: 'nairobi', spelvorm: 'impact',
    titel: 'Nieuwe Foundation-kans in Nairobi', label: 'Impact',
    beschrijving: 'Een lokale doelgroep heeft behoefte aan een aantoonbaar bruikbare route van leren naar werk.',
    effect: 'Impactkans +12 · bewijs vereist'
  },
  {
    id: 'product-singapore', stadId: 'singapore', spelvorm: 'puzzel',
    titel: 'Productvraag uit Singapore', label: 'Product',
    beschrijving: 'Spelers lopen vast tussen twee bestaande RTG-stappen. De kleinste veilige productverbetering moet worden gevonden.',
    effect: 'Innovatiekans +8 · complexiteit +3'
  }
];

const SCENARIOS = {
  planning: {
    titel: 'Live operatie',
    briefing: 'Een lid heeft een wijziging in een lopende reis. Houd de keten rustig, controleer afhankelijkheden en communiceer op codenaam.',
    stappen: [
      { vraag: 'Waar begin je?', opties: ['Meteen alles wijzigen', 'Eerst beschikbaarheid en gevolgen controleren', 'Het dossier doorsturen zonder controle'], juist: 1, uitleg: 'Eerst controleren voorkomt dubbele boekingen en onnodige kosten.' },
      { vraag: 'Welke gegevens gebruik je in de werkruimte?', opties: ['Alleen de codenaam en noodzakelijke reisgegevens', 'Een export met alle paspoortgegevens', 'De volledige betaalhistorie'], juist: 0, uitleg: 'Dataminimalisatie geldt ook in een spoedsituatie.' },
      { vraag: 'Wanneer is de operatie klaar?', opties: ['Na de eerste klik', 'Als alleen de partner akkoord is', 'Na bevestiging, controle van de keten en een duidelijke terugkoppeling'], juist: 2, uitleg: 'Een sluitende keten eindigt met controle én communicatie.' }
    ]
  },
  controle: {
    titel: 'Controlekamer',
    briefing: 'Een synthetisch dossier wijkt af van het normale patroon. Onderzoek het signaal zonder een echte betaling of identiteit te raken.',
    stappen: [
      { vraag: 'Wat betekent een afwijkend signaal?', opties: ['Automatisch fraude', 'Een reden om gecontroleerd te onderzoeken', 'Direct blokkeren voor iedereen'], juist: 1, uitleg: 'Een signaal is een onderzoekspunt, geen oordeel.' },
      { vraag: 'Welke actie is in Magnaat toegestaan?', opties: ['Een echte transactie terugboeken', 'Een echte accountkluis openen', 'De trainingskopie markeren en onderbouwen'], juist: 2, uitleg: 'Magnaat blijft altijd buiten productie.' },
      { vraag: 'Wie beslist over een echte vervolgstap?', opties: ['Een bevoegd mens via de bestaande RTG-controle', 'De speler met de hoogste score', 'De Future Engine zelfstandig'], juist: 0, uitleg: 'Geld, identiteit en productie blijven onder menselijke regie.' }
    ]
  },
  gesprek: {
    titel: 'Servicegesprek',
    briefing: 'Een reiziger vraagt hulp via een beveiligd oefengesprek. Los de vraag menselijk op en deel niet meer gegevens dan nodig.',
    stappen: [
      { vraag: 'Wat is de beste eerste reactie?', opties: ['Een korte ontvangstbevestiging en één gerichte vraag', 'Een standaardtekst zonder de vraag te lezen', 'Om alle persoonsgegevens vragen'], juist: 0, uitleg: 'Een gerichte vraag geeft snelheid zonder onnodige gegevens.' },
      { vraag: 'Waar hoort het gesprek?', opties: ['In het beveiligde RTG-kanaal', 'In een openbaar spelersprofiel', 'In de wereldranglijst'], juist: 0, uitleg: 'Service-inhoud hoort niet in publieke speldata.' },
      { vraag: 'Hoe sluit je af?', opties: ['Zonder bevestiging', 'Met oplossing, volgende stap en duidelijk eigenaarschap', 'Door het dossier stil te verwijderen'], juist: 1, uitleg: 'De reiziger moet weten wat geregeld is en wie verder gaat.' }
    ]
  },
  impact: {
    titel: 'Impactmissie',
    briefing: 'De RTFoundation ziet een kans om een groep beter te bereiken. Bouw een kleine proef die meetbaar, eerlijk en lokaal bruikbaar is.',
    stappen: [
      { vraag: 'Wat kies je eerst?', opties: ['Een concreet probleem met een bereikbare doelgroep', 'Een logo', 'Een zo groot mogelijk budget'], juist: 0, uitleg: 'Impact begint bij een duidelijk probleem en de mensen om wie het gaat.' },
      { vraag: 'Welke meting telt het meest?', opties: ['Alleen het aantal kliks', 'Een vooraf gekozen uitkomst voor de doelgroep', 'Hoe vaak het team vergadert'], juist: 1, uitleg: 'Meet het effect dat de doelgroep daadwerkelijk merkt.' },
      { vraag: 'Wat gebeurt na de proef?', opties: ['Altijd wereldwijd uitrollen', 'Resultaten en risico’s laten beoordelen', 'De uitkomst geheimhouden'], juist: 1, uitleg: 'De proef levert bewijs; een mens beslist over het vervolg.' }
    ]
  },
  operatie: {
    titel: 'Werkvloer onder druk',
    briefing: 'Een RTG-partner krijgt tegelijk meer vraag, een roosterprobleem en een kwaliteitsmelding. Breng rust in de operatie.',
    stappen: [
      { vraag: 'Wat pak je eerst vast?', opties: ['De grootste veiligheids- of klantimpact', 'De makkelijkste taak', 'Een willekeurige melding'], juist: 0, uitleg: 'Prioriteren gebeurt op risico en impact.' },
      { vraag: 'Hoe test je de oplossing?', opties: ['Direct bij alle zaken', 'In een afgebakende trainingssituatie met succescriteria', 'Zonder meetpunt'], juist: 1, uitleg: 'Klein en meetbaar testen beperkt schade en levert beter bewijs.' },
      { vraag: 'Wat leg je vast?', opties: ['Besluit, reden, resultaat en eigenaar', 'Alleen de eindscore', 'Niets; het was maar een oefening'], juist: 0, uitleg: 'Een goed logboek maakt leren en verantwoorden mogelijk.' }
    ]
  },
  puzzel: {
    titel: 'Productpuzzel',
    briefing: 'Een gebruiker loopt vast in een RTG-proces. Leg de juiste functie op het juiste moment in de keten.',
    stappen: [
      { vraag: 'Wat is een sterke eerste stap?', opties: ['Het gebruikersdoel vaststellen', 'Meer knoppen toevoegen', 'De fout verbergen'], juist: 0, uitleg: 'Het doel bepaalt welke functie werkelijk nodig is.' },
      { vraag: 'Welke oplossing heeft de voorkeur?', opties: ['De kleinste veilige stap die het probleem oplost', 'De grootste mogelijke verbouwing', 'Een los proces buiten RTG'], juist: 0, uitleg: 'Klein, veilig en geïntegreerd maakt een functie beheersbaar.' },
      { vraag: 'Wanneer is de puzzel geslaagd?', opties: ['Als de knop werkt', 'Als de taak aantoonbaar lukt en de grensgevallen zijn getest', 'Als het scherm mooi is'], juist: 1, uitleg: 'Functionaliteit omvat ook bewijs en grensgevallen.' }
    ]
  }
};

const KANSEN = [
  {
    sleutel: 'toegankelijk-op-reis', spoor: 'rtf', naam: 'RTF Toegankelijk op reis',
    ontbreekt: ['toegankelijkheid', 'ondersteunende-technologie'],
    nodig: ['tickets', 'ov', 'onderweg'],
    probleem: 'Reizigers met een zicht-, gehoor- of prikkelbeperking moeten informatie nu vaak zelf uit meerdere stappen samenvoegen.',
    doelgroep: 'Reizigers die extra ondersteuning nodig hebben',
    oplossing: 'Een rustige reisassistent met stap-voor-stap informatie, toegankelijkheidsvoorkeuren en een menselijke overdracht.',
    impact: 'Meer zelfstandigheid en minder uitval onderweg', risico: 'hoog; toegankelijkheidsclaims moeten met de doelgroep worden getest'
  },
  {
    sleutel: 'groene-reisketen', spoor: 'rtg', naam: 'RTG Reisimpact Planner',
    ontbreekt: ['co2', 'duurzaam', 'emissie'],
    nodig: ['tickets', 'ov', 'onderweg'],
    probleem: 'De reisketen kan vervoer plannen, maar maakt de verwachte milieu-impact nog niet als één begrijpelijke keuze zichtbaar.',
    doelgroep: 'Leden en bedrijven die aantoonbaar bewuster willen reizen',
    oplossing: 'Vergelijk routes op tijd, prijs, toegankelijkheid en geschatte impact, met transparante aannames.',
    impact: 'Betere keuzes en een meetbare verduurzamingsroute', risico: 'middel; brondata en rekenmethode moeten uitlegbaar blijven'
  },
  {
    sleutel: 'foundation-groeipad', spoor: 'rtf', naam: 'RTF GroeiPad',
    ontbreekt: ['mentor', 'groeipad', 'leerroute'],
    nodig: ['foundation-school', 'werk-rtf', 'member-werk'],
    probleem: 'Leren, vrijwilligerswerk en betaald werk bestaan, maar vormen nog geen doorlopende route voor iemand die wil doorgroeien.',
    doelgroep: 'Jongeren, herstarters en mensen met afstand tot werk',
    oplossing: 'Een persoonlijk groeipad dat oefeningen, begeleiding, praktijkervaring en passende vacatures veilig verbindt.',
    impact: 'Van losse kansen naar aantoonbare ontwikkeling', risico: 'middel; voorkom automatische selectie of uitsluiting'
  },
  {
    sleutel: 'kleine-zaak-cockpit', spoor: 'rtg', naam: 'RTG Kleine Zaak Cockpit',
    ontbreekt: ['zzp-cockpit', 'eenmanszaak'],
    nodig: ['supplier-finance', 'supplier-pos', 'staff'],
    probleem: 'Kleine partners hebben dezelfde operationele onderdelen als grote zaken, maar niet dezelfde tijd of specialisten.',
    doelgroep: 'Zelfstandigen en kleine lokale reis- en horecapartners',
    oplossing: 'Eén rustige dagcockpit voor omzet, bezetting, open acties en eenvoudige vooruitblik.',
    impact: 'Minder administratie en snellere bijsturing', risico: 'laag; start alleen met afgeleide, niet-bindende inzichten'
  }
];

module.exports = ({
  db, save, bewerkCollectie = null, crypto, functies,
  partnerstudio = null, codenaamVan = null, sseToCustomer = null
}) => {
  const nu = klokNu;
  const id = voor => voor + '-' + crypto.randomBytes(6).toString('hex');
  const tekst = (v, max = 300) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max);
  const alleFuncties = Array.isArray(functies && functies.FUNCTIES) ? functies.FUNCTIES : [];
  const werkrouteFabriek = require('./magnaat-werkroutefabriek');
  const capabilityScanner = require('./magnaat-capabilities')({
    functies, volledigeWerkprocessen: KANTOORWERKPROCESSEN,
    werkrouteFabriek: werkrouteFabriek.bouw
  });
  let capabilityGraph = capabilityScanner.scan();
  let alleWerkprocessen = KANTOORWERKPROCESSEN.concat(capabilityGraph.automatischeWerkprocessen || []);

  function state() {
    if (!db.data.magnaatWereld || typeof db.data.magnaatWereld !== 'object') {
      db.data.magnaatWereld = { versie: VERSIE, spelers: {}, voorstellen: [], logboek: [], laatsteScan: 0 };
    }
    const s = db.data.magnaatWereld;
    s.versie = VERSIE;
    if (!s.spelers || typeof s.spelers !== 'object') s.spelers = {};
    if (!Array.isArray(s.voorstellen)) s.voorstellen = [];
    if (!Array.isArray(s.logboek)) s.logboek = [];
    if (!s.functieStatistiek || typeof s.functieStatistiek !== 'object') s.functieStatistiek = {};
    if (!s.capabilitySnapshot || typeof s.capabilitySnapshot !== 'object') s.capabilitySnapshot = null;
    return s;
  }

  /* De economie blijft bewust onderdeel van dezelfde geïsoleerde spelstaat.
     Daarmee kan een missie de bedrijfsvoering beïnvloeden zonder ooit orders,
     betalingen of andere productiedata van RTG aan te raken. */
  const economie = require('./magnaat-economie')({ wereldState: state, save });
  const trainingslobbies = require('./magnaat-trainingslobby')({
    db, save, bewerkCollectie, crypto, partnerstudio, codenaamVan, sseToCustomer
  });

  function spelvormVan(f) {
    const bron = [f.id, f.naam, f.categorie, ...(f.paden || [])].join(' ').toLowerCase();
    if (/foundation|school|leren|werk-rtf|fonds/.test(bron)) return 'impact';
    if (/betaal|pay|bank|verific|paspoort|webauthn|finance|factuur|kassa|pos/.test(bron)) return 'controle';
    if (/salon|sociaal|social|dm|chat|contact|meld|bericht/.test(bron)) return 'gesprek';
    if (/ticket|reis|rit|route|ov|onderweg|kamer|hotel|event/.test(bron)) return 'planning';
    if (/supplier|staff|personeel|backoffice|kantoor|contract|verhuur/.test(bron)) return 'operatie';
    return 'puzzel';
  }

  function risicoVan(f) {
    const bron = [f.id, f.naam, f.categorie, ...(f.paden || [])].join(' ').toLowerCase();
    if (/betaal|pay|bank|verific|paspoort|webauthn|identiteit|kluis|office|boardroom|techniek|pos|finance/.test(bron)) return 'rood';
    if (/dm|chat|salon|sociaal|social|contact|personeel|staff|sollicit|partner/.test(bron)) return 'geel';
    return 'groen';
  }

  /* De echte plek in het RTG OS waar deze functie wordt bediend. Het doel is
     bewust een OS-sleutel, geen losse verzonnen game-app: de browserlaag kan
     daardoor exact controleren dat de speler het juiste bestaande scherm
     opende. Alles draait in app.html?magnaat=1, waar de API uit staat en de
     bestaande synthetische demo-dossiers worden gebruikt. */
  function softwareVan(f) {
    const bron = [f.id, f.naam, f.categorie, ...(f.paden || [])].join(' ').toLowerCase();
    if (/member-dm|bericht|chat/.test(bron)) return { sleutel: 'link:berichten', naam: 'Berichten' };
    if (/member-snaps|snaps/.test(bron)) return { sleutel: 'os:snaps', naam: 'Snaps' };
    if (/webauthn|passkey/.test(bron)) return { sleutel: 'link:passkeys', naam: 'Passkeys' };
    if (/foundation|werk-rtf|school/.test(bron)) return { sleutel: 'os:rtf', naam: 'RTFoundation' };
    if (/betalen|pay|bank|finance|factuur|wbw/.test(bron)) return { sleutel: 'tab:betalen', naam: 'RTG Pay' };
    if (/salon|sociaal|social|connect|ontmoet|vonk/.test(bron)) return { sleutel: 'tab:salon', naam: 'De Salon' };
    if (/ticket|reis|rit|route|ov|onderweg|charter|kamer|hotel|rooms/.test(bron)) return { sleutel: 'tab:reizen', naam: 'Reizen' };
    if (/bestel|retail|groothandel|pos|verhuur/.test(bron)) return { sleutel: 'tab:bestellen', naam: 'Bestellen' };
    if (/member-werk|supplier|staff|personeel|contract|office|kantoor|stuur/.test(bron)) return { sleutel: 'os:werk', naam: 'Werk' };
    if (/spellen/.test(bron)) return { sleutel: 'link:spelen', naam: 'Spelen' };
    if (/podium/.test(bron)) return { sleutel: 'link:podium', naam: 'Podium' };
    if (/theater/.test(bron)) return { sleutel: 'link:theater', naam: 'Theater' };
    if (/clips/.test(bron)) return { sleutel: 'link:clips', naam: 'Clips' };
    if (/flits/.test(bron)) return { sleutel: 'link:flits', naam: 'Flits' };
    if (/oog/.test(bron)) return { sleutel: 'link:camera', naam: 'Camera' };
    if (/ghost/.test(bron)) return { sleutel: 'tab:reizen', naam: 'Reizen' };
    return { sleutel: 'tab:ai', naam: 'Rahul' };
  }

  function capability(f) {
    const spelvorm = spelvormVan(f);
    const software = softwareVan(f);
    return {
      id: f.id,
      naam: f.naam,
      categorie: f.categorie,
      uitleg: f.uitleg,
      doelgroepen: (f.doelgroepen || []).slice(),
      apparaten: ['computer', 'pda'],
      voorkeur: spelvorm === 'gesprek' || spelvorm === 'planning' ? 'pda' : 'computer',
      spelvorm,
      software: { sleutel: software.sleutel, naam: software.naam, route: '/apps/app.html?pas=business&magnaat=1' },
      veiligheidsniveau: risicoVan(f),
      omgeving: 'trainingskopie',
      echteActie: false
    };
  }

  const catalogus = alleFuncties.map(capability);
  const opId = Object.fromEntries(catalogus.map(c => [c.id, c]));

  function speler(key) {
    key = tekst(key, 100);
    const s = state();
    if (!s.spelers[key]) s.spelers[key] = { xp: 0, reputatie: 50, virtueelBudget: 250000, taken: [], gestart: nu() };
    const p = s.spelers[key];
    if (!Array.isArray(p.taken)) p.taken = [];
    return p;
  }

  function log(soort, actor, detail) {
    const rij = state().logboek;
    rij.unshift({ id: id('log'), soort, actor: tekst(actor, 100) || 'systeem', detail: tekst(detail, 400), at: nu() });
    if (rij.length > 300) rij.length = 300;
  }

  const controle = require('./magnaat-controle')({
    wereldState: state, getGraph: () => capabilityGraph, save, crypto, nu
  });

  function lidControleContext(key) {
    const p = speler(key);
    return {
      key: tekst(key, 100), boardroom: false,
      kantoorId: p.kantoor && p.kantoor.id || '',
      rol: p.kantoor && p.kantoor.rol || ''
    };
  }

  function boardroomControleContext(actor) {
    return { key: tekst(actor, 100) || 'boardroom', boardroom: true, kantoorId: '', rol: 'Boardroom-regisseur' };
  }

  function publiekeCapabilityGraph() {
    return {
      versie: capabilityGraph.versie,
      gescand: capabilityGraph.gescand,
      vingerafdruk: capabilityGraph.vingerafdruk.slice(0, 12),
      cijfers: Object.assign({}, capabilityGraph.cijfers),
      dekkingsmatrix: {
        percentage: capabilityGraph.dekkingsmatrix.percentage,
        volledig: capabilityGraph.dekkingsmatrix.volledig,
        metGaten: capabilityGraph.dekkingsmatrix.metGaten,
        dimensies: capabilityGraph.dekkingsmatrix.dimensies.map(d => Object.assign({}, d))
      },
      kantoren: capabilityGraph.kantoren.map(k => Object.assign({}, k, {
        rollen: [k.naam + '-medewerker', k.naam + '-coördinator', 'Trainee']
      })),
      domeinen: capabilityGraph.domeinen.slice(),
      werkprocessen: capabilityGraph.workflows.map(w => ({
        id: w.id, naam: w.naam, familie: w.familie, domein: w.domein,
        kantoor: w.kantoor, rol: w.rol, risico: w.risico,
        geregistreerd: w.geregistreerd, actieAantal: w.actieAantal,
        app: w.app, spelstappen: w.spelstappen.slice(), bronstand: w.bronstand,
        signalen: Object.assign({}, w.signalen),
        startbaar: w.dekking.waarden.werkroute === true,
        dekking: { percentage: w.dekking.percentage, volledig: w.dekking.volledig,
          ontbreekt: w.dekking.ontbreekt.slice(), waarden: Object.assign({}, w.dekking.waarden) }
      })),
      volledigeWerkprocessen: KANTOORWERKPROCESSEN.map(w => ({
        id: w.id, naam: w.naam, afdeling: w.afdeling, afdelingNaam: w.afdelingNaam,
        rol: w.rol, stappen: w.stappen.length, veiligheidsniveau: w.veiligheidsniveau,
        codeFamilies: (w.codeFamilies || []).slice(), automatisch: !!w.automatisch
      })),
      automatischeWerkprocessen: capabilityGraph.cijfers.automatischeWerkprocessen || 0
    };
  }

  function integratieVoorstel(workflow, actor, nieuwInCode) {
    const s = state();
    const sleutel = 'code-integratie-' + workflow.id.replace(/[^a-z0-9:-]/gi, '-');
    if (s.voorstellen.some(v => v.sleutel === sleutel)) return false;
    const v = {
      id: id('kans'), sleutel, spoor: /foundation|rtf|labfonds/i.test(workflow.familie) ? 'rtf' : 'rtg',
      naam: 'Magnaat-aansluiting · ' + workflow.naam,
      probleem: (nieuwInCode ? 'De codescan heeft een nieuw RTG-werkproces gevonden. ' : '') +
        workflow.actieAantal + ' API-actie(s) in ' + workflow.familie + ' zijn nog niet als één realistische Magnaat-werkroute gemodelleerd.',
      doelgroep: workflow.kantoor.naam + ' en spelers met de rol ' + workflow.rol,
      oplossing: 'Bundel de acties tot een veilig dossier met intake, controle, uitvoering, dubbelcheck en overdracht in de bestaande RTG-software.',
      impact: 'Meer van de werkelijke RTG-code wordt bruikbaar als realistische, rolgebonden gameplay.',
      risico: workflow.risico + '; alle schrijfacties blijven synthetisch en productie blijft buiten bereik',
      gebruiktFuncties: workflow.functieIds.slice(), ontbreekt: ['magnaat-werkroute'],
      bewijs: { bron: 'Automatische RTG-codescan', familie: workflow.familie, apiActies: workflow.actieAantal, app: workflow.app.pad },
      testplan: [
        'Combineer de API-acties tot een begrijpelijk werkproces, niet tot losse endpoint-minigames.',
        'Voer het proces uit met synthetische dossiers op computer en PDA.',
        'Meet fouten, overdrachten en taakvoltooiing per kantoorrol.',
        'Laat een mens beslissen over iedere koppeling buiten de Magnaat-sandbox.'
      ],
      status: 'voorstel', productie: false, gemaakt: nu(), bijgewerkt: nu(), besluit: null
    };
    s.voorstellen.unshift(v);
    log('codekans-gevonden', actor, v.naam + ' · ' + workflow.actieAantal + ' API-acties');
    return true;
  }

  function verversCapabilityGraph(actor) {
    const s = state();
    const vorig = s.capabilitySnapshot;
    capabilityGraph = capabilityScanner.scan();
    alleWerkprocessen = KANTOORWERKPROCESSEN.concat(capabilityGraph.automatischeWerkprocessen || []);
    const vorigeIds = new Set(vorig && Array.isArray(vorig.workflowIds) ? vorig.workflowIds : []);
    const toegevoegd = vorig ? capabilityGraph.workflows.filter(w => !vorigeIds.has(w.id)) : [];
    const kandidaten = (vorig ? toegevoegd : capabilityGraph.workflows.filter(w => !w.geregistreerd && w.actieAantal >= 2))
      .filter(w => !w.geregistreerd).slice(0, 12);
    let voorstellen = 0;
    for (const workflow of kandidaten) if (integratieVoorstel(workflow, actor, !!vorig)) voorstellen += 1;
    const gewijzigd = !vorig || vorig.vingerafdruk !== capabilityGraph.vingerafdruk;
    s.capabilitySnapshot = {
      vingerafdruk: capabilityGraph.vingerafdruk,
      workflowIds: capabilityGraph.workflows.map(w => w.id),
      appPaden: capabilityGraph.apps.map(a => a.pad),
      apiActies: capabilityGraph.cijfers.apiActies,
      gescand: capabilityGraph.gescand
    };
    const gatenplan = controle.planGaten(boardroomControleContext(actor), { limiet: 25 });
    if (gewijzigd) log('code-scan', actor, capabilityGraph.cijfers.apps + ' apps · ' + capabilityGraph.cijfers.apiActies + ' API-acties · ' + capabilityGraph.cijfers.werkprocessen + ' werkprocessen');
    return { gewijzigd, toegevoegd: toegevoegd.length, voorstellen, cijfers: capabilityGraph.cijfers, gatenplan };
  }

  const datumSleutel = tijd => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(tijd));

  function hashGetal(waarde) {
    return parseInt(crypto.createHash('sha256').update(String(waarde)).digest('hex').slice(0, 8), 16);
  }

  function gebeurtenisVandaag(tijd = nu()) {
    const dagNr = Math.floor(tijd / DAG);
    const bron = WERELDGEBEURTENISSEN[dagNr % WERELDGEBEURTENISSEN.length];
    const stad = STEDEN.find(s => s.id === bron.stadId);
    return Object.assign({}, bron, { stad: stad ? stad.naam : bron.stadId });
  }

  function dienstDossiers(key, datum, gebeurtenis) {
    const rang = catalogus.slice().sort((a, b) =>
      hashGetal(key + datum + a.id) - hashGetal(key + datum + b.id));
    const gekozen = [];
    const primair = rang.find(c => c.spelvorm === gebeurtenis.spelvorm) || rang[0];
    if (primair) gekozen.push(primair);
    for (const c of rang) {
      if (gekozen.length >= 3) break;
      if (gekozen.some(x => x.id === c.id)) continue;
      if (gekozen.some(x => x.categorie === c.categorie)) continue;
      gekozen.push(c);
    }
    for (const c of rang) {
      if (gekozen.length >= 3) break;
      if (!gekozen.some(x => x.id === c.id)) gekozen.push(c);
    }
    return gekozen.map((c, index) => ({
      functieId: c.id, status: 'open', volgorde: index + 1, taakId: null, voltooid: null
    }));
  }

  function publiekeDienst(dienst) {
    if (!dienst) return null;
    const gebeurtenis = WERELDGEBEURTENISSEN.find(g => g.id === dienst.gebeurtenisId) || gebeurtenisVandaag();
    const stad = STEDEN.find(s => s.id === gebeurtenis.stadId);
    const dossiers = (dienst.dossiers || []).map(d => {
      const c = opId[d.functieId];
      return c ? {
        functieId: c.id, naam: c.naam, categorie: c.categorie, spelvorm: c.spelvorm,
        veiligheidsniveau: c.veiligheidsniveau, software: c.software,
        status: d.status, volgorde: d.volgorde, voltooid: d.voltooid || null
      } : null;
    }).filter(Boolean);
    return {
      datum: dienst.datum,
      titel: 'Dagdienst · ' + dienst.datum.split('-').reverse().join('-'),
      gebeurtenis: Object.assign({}, gebeurtenis, { stad: stad ? stad.naam : gebeurtenis.stadId }),
      dossiers,
      doel: dossiers.length,
      voltooid: dossiers.filter(d => d.status === 'klaar').length,
      bonus: Object.assign({}, DIENST_BONUS),
      bonusOntvangen: !!dienst.bonusOntvangen
    };
  }

  function zorgDienst(key, p) {
    const datum = datumSleutel(nu());
    if (p.dienst && p.dienst.datum === datum && Array.isArray(p.dienst.dossiers)) return p.dienst;
    const gebeurtenis = gebeurtenisVandaag();
    p.dienst = {
      datum, gebeurtenisId: gebeurtenis.id,
      dossiers: dienstDossiers(tekst(key, 100), datum, gebeurtenis),
      bonusOntvangen: false, gemaakt: nu()
    };
    log('dienst-geopend', key, gebeurtenis.titel + ' · ' + p.dienst.dossiers.length + ' dossiers');
    save();
    return p.dienst;
  }

  function maakDossier(key, c, dienst) {
    const datum = dienst.datum;
    const getal = hashGetal(key + datum + c.id);
    const codenamen = ['Zilveren Valk', 'Noordelijke Ster', 'Amberen Vos', 'Blauwe Reiger', 'Stille Atlas', 'Gouden Ibis'];
    const gebeurtenis = publiekeDienst(dienst).gebeurtenis;
    const uur = 9 + (getal % 9);
    const minuut = ['00', '15', '30', '45'][Math.floor(getal / 9) % 4];
    const inzet = {
      planning: '€ ' + (900 + (getal % 41) * 75).toLocaleString('nl-NL') + ' virtuele reiswaarde',
      controle: '€ ' + (1200 + (getal % 61) * 100).toLocaleString('nl-NL') + ' synthetisch signaal',
      gesprek: 4 + (getal % 13) + ' open serviceberichten',
      impact: 35 + (getal % 166) + ' deelnemers in de spelproef',
      operatie: 3 + (getal % 18) + ' betrokken werkplekken',
      puzzel: 2 + (getal % 7) + ' gekoppelde processtappen'
    }[c.spelvorm];
    return {
      referentie: 'MW-' + datum.replace(/-/g, '') + '-' + String(getal % 10000).padStart(4, '0'),
      synthetisch: true,
      codenaam: c.spelvorm === 'impact' ? 'Doelgroep ' + String.fromCharCode(65 + (getal % 6)) : codenamen[getal % codenamen.length],
      stad: gebeurtenis.stad,
      tijdvenster: 'Vandaag vóór ' + String(uur).padStart(2, '0') + ':' + minuut,
      inzet,
      onderwerp: c.naam,
      aanleiding: gebeurtenis.titel
    };
  }

  function werkDienstBij(key, p, taak) {
    const dienst = p.dienst;
    if (!dienst || dienst.datum !== datumSleutel(taak.voltooid || nu())) return false;
    const dossier = dienst.dossiers.find(d => d.functieId === taak.functieId && d.status !== 'klaar');
    if (dossier) {
      dossier.status = 'klaar';
      dossier.taakId = taak.id;
      dossier.voltooid = taak.voltooid;
    }
    const klaar = dienst.dossiers.length > 0 && dienst.dossiers.every(d => d.status === 'klaar');
    if (!klaar || dienst.bonusOntvangen) return false;
    dienst.bonusOntvangen = true;
    dienst.afgerond = nu();
    p.xp += DIENST_BONUS.xp;
    p.virtueelBudget += DIENST_BONUS.virtueelBudget;
    p.reputatie = Math.min(100, p.reputatie + DIENST_BONUS.reputatie);
    p.dienstenVoltooid = (p.dienstenVoltooid || 0) + 1;
    log('dienst-voltooid', key, dienst.datum + ' · bonus ' + DIENST_BONUS.xp + ' XP');
    return true;
  }

  function publiekeStap(stap) {
    return stap ? {
      soort: stap.soort || 'keuze', vraag: stap.vraag,
      opties: Array.isArray(stap.opties) ? stap.opties.slice() : [],
      doel: stap.soort === 'software' ? stap.doel : undefined,
      schermNaam: stap.soort === 'software' ? stap.schermNaam : undefined,
      schermPad: stap.soort === 'software' ? stap.schermPad : undefined,
      velden: stap.soort === 'formulier' ? (stap.velden || []).map(v => ({
        id: v.id, label: v.label, type: v.type, verplicht: !!v.verplicht,
        min: v.min, max: v.max, placeholder: v.placeholder,
        opties: Array.isArray(v.opties) ? v.opties.slice() : undefined
      })) : undefined
    } : null;
  }

  function publiekeTaak(taak) {
    const huidig = taak.stappen[taak.stap] || null;
    return {
      id: taak.id, functieId: taak.functieId, functieNaam: taak.functieNaam,
      titel: taak.titel, briefing: taak.briefing, apparaat: taak.apparaat,
      spelvorm: taak.spelvorm, veiligheidsniveau: taak.veiligheidsniveau,
      omgeving: 'trainingskopie', status: taak.status, stap: taak.stap,
      stappen: taak.stappen.length, punten: taak.punten, huidig: publiekeStap(huidig),
      feedback: taak.feedback || '', dagdienst: !!taak.dagdienst,
      workflowId: taak.workflowId || null, afdeling: taak.afdeling || null, rol: taak.rol || null,
      economischEffect: taak.economischEffect ? Object.assign({}, taak.economischEffect) : null,
      dossier: taak.dossier ? Object.assign({}, taak.dossier) : null,
      gestart: taak.gestart, voltooid: taak.voltooid || null
    };
  }

  function taakStart(key, functieId, apparaat) {
    const c = opId[tekst(functieId, 100)];
    if (!c) return { status: 404, error: 'Deze RTG-functie staat niet in de spelbrug.' };
    if (!controle.beschikbaar('functie', c.id) || !controle.beschikbaar('api', 'POST /api/member/magnaat/taak/start')) {
      return { status: 423, error: 'Deze functie staat in de Magnaat-controlekamer tijdelijk uit. Vraag de verantwoordelijke kantoorcoördinator om de status te controleren.' };
    }
    apparaat = apparaat === 'pda' ? 'pda' : 'computer';
    const p = speler(key);
    const dienst = zorgDienst(key, p);
    const bestaand = p.taken.find(t => t.status === 'bezig');
    if (bestaand) return { status: 409, error: 'Maak eerst de actieve opdracht af.', taak: publiekeTaak(bestaand) };
    const basis = SCENARIOS[c.spelvorm] || SCENARIOS.puzzel;
    const dossier = dienst.dossiers.find(d => d.functieId === c.id && d.status !== 'klaar');
    const gebeurtenis = publiekeDienst(dienst).gebeurtenis;
    const dossierData = maakDossier(key, c, dienst);
    const taak = {
      id: id('taak'), functieId: c.id, functieNaam: c.naam,
      titel: basis.titel + ' · ' + c.naam,
      briefing: (dossier ? gebeurtenis.titel + ' in ' + gebeurtenis.stad + '. ' : '') +
        basis.briefing + ' Je gebruikt hierbij de trainingskopie van ' + c.naam + '.',
      apparaat, spelvorm: c.spelvorm, veiligheidsniveau: c.veiligheidsniveau,
      dossier: dossierData, dagdienst: !!dossier, status: 'bezig', stap: 0, punten: 0,
      stappen: [{
        soort: 'software', doel: c.software.sleutel, schermNaam: c.software.naam,
        vraag: 'Open ' + c.software.naam + ' in het echte RTG OS op je ' + apparaat + '.',
        opties: [], uitleg: 'Het juiste RTG-scherm is geopend in de afgeschermde trainingskopie.'
      }].concat(basis.stappen.map(s => ({ soort: 'keuze', vraag: s.vraag, opties: s.opties.slice(), juist: s.juist, uitleg: s.uitleg }))),
      feedback: '', gestart: nu()
    };
    if (dossier) { dossier.status = 'bezig'; dossier.taakId = taak.id; }
    p.taken.unshift(taak);
    if (p.taken.length > 40) p.taken.length = 40;
    log('taak-gestart', key, c.id + ' op ' + apparaat);
    save();
    return { ok: true, taak: publiekeTaak(taak), speler: publiekeSpeler(p) };
  }

  function kiesKantoor(key, kantoorId, rol) {
    const kantoor = capabilityGraph.kantoren.find(k => k.id === tekst(kantoorId, 80));
    if (!kantoor) return { status: 404, error: 'Deze RTG-werkruimte staat niet in de actuele codescan.' };
    const rollen = [kantoor.naam + '-medewerker', kantoor.naam + '-coördinator', 'Trainee'];
    rol = tekst(rol, 80) || rollen[0];
    if (!rollen.includes(rol)) return { status: 400, error: 'Kies een rol die bij deze werkruimte hoort.' };
    const p = speler(key);
    p.kantoor = { id: kantoor.id, naam: kantoor.naam, rol, gekozen: nu() };
    log('kantoor-gekozen', key, kantoor.naam + ' · ' + rol);
    save();
    return { ok: true, kantoor: Object.assign({}, p.kantoor), speler: publiekeSpeler(p) };
  }

  function werkprocesStart(key, workflowId, apparaat) {
    const workflow = alleWerkprocessen.find(w => w.id === tekst(workflowId, 100));
    if (!workflow) return { status: 404, error: 'Dit volledige werkproces bestaat nog niet.' };
    if (!controle.beschikbaar('api', 'POST /api/member/magnaat/werkproces/start')) {
      return { status: 423, error: 'Volledige werkprocessen staan in de Magnaat-trainingsomgeving tijdelijk uit.' };
    }
    const p = speler(key);
    const bestaand = p.taken.find(t => t.status === 'bezig');
    if (bestaand) return { status: 409, error: 'Maak eerst het actieve dossier af.', taak: publiekeTaak(bestaand) };
    apparaat = apparaat === 'pda' ? 'pda' : 'computer';
    p.kantoor = { id: workflow.afdeling, naam: workflow.afdelingNaam, rol: workflow.rol, gekozen: nu() };
    const dienst = zorgDienst(key, p);
    const capability = { id: workflow.id, naam: workflow.naam, spelvorm: workflow.spelvorm };
    const dossier = maakDossier(key, capability, dienst);
    dossier.onderwerp = workflow.naam;
    dossier.werklog = [];
    const taak = {
      id: id('taak'), workflowId: workflow.id, functieId: 'workflow-' + workflow.id,
      functieNaam: workflow.naam, titel: 'Volledig werkdossier · ' + workflow.naam,
      briefing: workflow.briefing, apparaat, spelvorm: workflow.spelvorm,
      veiligheidsniveau: workflow.veiligheidsniveau, afdeling: workflow.afdelingNaam,
      rol: workflow.rol, dossier, dagdienst: false, status: 'bezig', stap: 0, punten: 0,
      stappen: workflow.stappen.map(s => Object.assign({}, s, {
        opties: Array.isArray(s.opties) ? s.opties.slice() : [],
        velden: Array.isArray(s.velden) ? s.velden.map(v => Object.assign({}, v, { opties: Array.isArray(v.opties) ? v.opties.slice() : undefined })) : undefined
      })),
      feedback: '', gestart: nu()
    };
    p.taken.unshift(taak);
    if (p.taken.length > 40) p.taken.length = 40;
    log('werkproces-gestart', key, workflow.naam + ' · ' + workflow.rol);
    save();
    return { ok: true, taak: publiekeTaak(taak), speler: publiekeSpeler(p) };
  }

  function rondTaakAf(key, p, taak) {
    taak.status = 'klaar';
    taak.voltooid = nu();
    p.xp += taak.punten;
    p.reputatie = Math.min(100, p.reputatie + (taak.punten >= 250 ? 2 : 1));
    p.virtueelBudget += taak.punten * 25;
    taak.economischEffect = economie.registreerWerk(key, taak);
    taak.feedback += ' ' + taak.economischEffect.uitleg;
    log('taak-voltooid', key, taak.functieId + ' · ' + taak.punten + ' XP');
    registreerUitkomst(key, taak);
    if (taak.dagdienst) {
      const dienstBonus = werkDienstBij(key, p, taak);
      if (dienstBonus) taak.feedback += ' Dagdienst voltooid: ' + DIENST_BONUS.xp + ' bonus-XP en € ' + (DIENST_BONUS.virtueelBudget / 100) + ' virtueel kapitaal.';
    }
  }

  function taakActie(key, taakId, invoer) {
    const p = speler(key);
    const taak = p.taken.find(t => t.id === tekst(taakId, 100));
    if (!taak) return { status: 404, error: 'Dit dossier bestaat niet.' };
    if (taak.status !== 'bezig') return { status: 409, error: 'Dit dossier is al afgerond.', taak: publiekeTaak(taak) };
    const stap = taak.stappen[taak.stap];
    if (!stap || stap.soort !== 'formulier') return { status: 409, error: 'Open nu eerst het gevraagde RTG-scherm.', taak: publiekeTaak(taak) };
    invoer = invoer && typeof invoer === 'object' ? invoer : {};
    const schoon = {};
    for (const veld of stap.velden || []) {
      const waarde = invoer[veld.id];
      if (veld.type === 'vink') {
        if (veld.verplicht && waarde !== true) return { status: 400, error: 'Bevestig: ' + veld.label + '.' };
        schoon[veld.id] = waarde === true;
        continue;
      }
      const v = tekst(waarde, veld.max || 500);
      if (veld.verplicht && !v) return { status: 400, error: 'Vul in: ' + veld.label + '.' };
      if (veld.min && v.length < veld.min) return { status: 400, error: veld.label + ' is nog te kort om het dossier overdraagbaar te maken.' };
      if (Array.isArray(veld.opties) && !veld.opties.includes(v)) return { status: 400, error: 'Kies een geldige waarde voor ' + veld.label + '.' };
      schoon[veld.id] = v;
    }
    if (!Array.isArray(taak.dossier.werklog)) taak.dossier.werklog = [];
    taak.dossier.werklog.push({ stap: taak.stap + 1, invoer: schoon, at: nu(), synthetisch: true });
    taak.punten += 100;
    taak.feedback = stap.uitleg;
    taak.stap += 1;
    log('dossier-vastgelegd', key, taak.functieId + ' · stap ' + taak.stap);
    if (taak.stap >= taak.stappen.length) rondTaakAf(key, p, taak);
    save();
    return { ok: true, goed: true, feedback: taak.feedback, taak: publiekeTaak(taak), speler: publiekeSpeler(p) };
  }

  function taakAntwoord(key, taakId, keuze) {
    const p = speler(key);
    const taak = p.taken.find(t => t.id === tekst(taakId, 100));
    if (!taak) return { status: 404, error: 'Deze opdracht bestaat niet.' };
    if (taak.status !== 'bezig') return { status: 409, error: 'Deze opdracht is al afgerond.', taak: publiekeTaak(taak) };
    const stap = taak.stappen[taak.stap];
    if (stap.soort === 'software') {
      return { status: 409, error: 'Open eerst ' + stap.schermNaam + ' in het RTG OS.', taak: publiekeTaak(taak) };
    }
    if (stap.soort === 'formulier') return { status: 409, error: 'Vul de dossierhandeling in om verder te gaan.', taak: publiekeTaak(taak) };
    const gekozen = Number(keuze);
    if (!Number.isInteger(gekozen) || gekozen < 0 || gekozen >= stap.opties.length) {
      return { status: 400, error: 'Kies één van de getoonde antwoorden.' };
    }
    const goed = gekozen === stap.juist;
    taak.punten += goed ? 100 : 25;
    taak.feedback = (goed ? 'Sterk. ' : 'Bijna. ') + stap.uitleg;
    taak.stap += 1;
    if (taak.stap >= taak.stappen.length) rondTaakAf(key, p, taak);
    save();
    return { ok: true, goed, feedback: taak.feedback, taak: publiekeTaak(taak), speler: publiekeSpeler(p) };
  }

  function taakHandeling(key, taakId, handeling) {
    const p = speler(key);
    const taak = p.taken.find(t => t.id === tekst(taakId, 100));
    if (!taak) return { status: 404, error: 'Deze opdracht bestaat niet.' };
    if (taak.status !== 'bezig') return { status: 409, error: 'Deze opdracht is al afgerond.', taak: publiekeTaak(taak) };
    const stap = taak.stappen[taak.stap];
    if (!stap || stap.soort !== 'software') return { status: 409, error: 'Beantwoord nu de operationele keuze in het dossier.', taak: publiekeTaak(taak) };
    handeling = tekst(handeling, 100);
    if (handeling !== stap.doel) {
      return { status: 400, error: 'Dit dossier vraagt om ' + stap.schermNaam + ', niet om een ander scherm.', taak: publiekeTaak(taak) };
    }
    taak.punten += 75;
    taak.feedback = stap.uitleg;
    taak.stap += 1;
    log('software-gebruikt', key, taak.functieId + ' via ' + handeling);
    save();
    return { ok: true, goed: true, feedback: taak.feedback, taak: publiekeTaak(taak), speler: publiekeSpeler(p) };
  }

  function publiekeSpeler(p) {
    const klaar = p.taken.filter(t => t.status === 'klaar');
    return {
      xp: p.xp, reputatie: p.reputatie, virtueelBudget: p.virtueelBudget,
      niveau: Math.max(1, Math.floor(p.xp / 600) + 1),
      voltooid: klaar.length,
      dienstenVoltooid: p.dienstenVoltooid || 0,
      kantoor: p.kantoor ? Object.assign({}, p.kantoor) : null,
      dienst: publiekeDienst(p.dienst),
      actieveTaak: p.taken.find(t => t.status === 'bezig') ? publiekeTaak(p.taken.find(t => t.status === 'bezig')) : null,
      recent: klaar.slice(0, 6).map(publiekeTaak)
    };
  }

  /* De Future Engine kijkt niet alleen naar vooraf bekende catalogusgaten,
     maar ook naar terugkerende frictie in de veilige spelmissies. Na minimaal
     drie voltooide dossiers kan een lage gemiddelde kwaliteit automatisch een
     verbeter-voorstel opleveren. Het blijft een voorstel: nooit een codewijziging. */
  function registreerUitkomst(actor, taak) {
    const s = state();
    const c = opId[taak.functieId];
    if (!c) return;
    const stat = s.functieStatistiek[c.id] || { aantal: 0, punten: 0, laatste: 0 };
    stat.aantal += 1;
    stat.punten += taak.punten;
    stat.laatste = taak.voltooid || nu();
    s.functieStatistiek[c.id] = stat;
    const gemiddelde = Math.round((stat.punten / (stat.aantal * 375)) * 100);
    const sleutel = 'spel-frictie-' + c.id;
    if (stat.aantal < 3 || gemiddelde >= 72 || s.voorstellen.some(v => v.sleutel === sleutel)) return;
    const rtf = /foundation|rtf/i.test(c.id + ' ' + c.categorie);
    const v = {
      id: id('kans'), sleutel, spoor: rtf ? 'rtf' : 'rtg',
      naam: 'Verbeterpad · ' + c.naam,
      probleem: 'In ' + stat.aantal + ' synthetische Magnaat-dossiers is de gemiddelde proceskwaliteit ' + gemiddelde + '%. Dat wijst op terugkerende frictie in de huidige gebruikersroute.',
      doelgroep: c.doelgroepen.length ? c.doelgroepen.join(', ') : 'Gebruikers van ' + c.naam,
      oplossing: 'Test een duidelijker stap-voor-stap werkpad, betere overdrachtsinformatie en één zichtbaar herstelmoment binnen de bestaande RTG-software.',
      impact: 'Minder fouten en een beter begrijpelijke uitvoering van ' + c.naam,
      risico: 'laag; de aanwijzing komt uit synthetische speldata en moet met echte gebruikers worden gevalideerd',
      gebruiktFuncties: [c.id], ontbreekt: ['duidelijk-werkpad', 'herstelmoment'],
      bewijs: { bron: 'Magnaat-spelmissies', missies: stat.aantal, gemiddelde },
      testplan: [
        'Maak twee veilige interfacevarianten in Magnaat.',
        'Laat minimaal vijf spelers dezelfde synthetische taak uitvoeren.',
        'Vergelijk fouten, taakvoltooiing en begrijpelijkheid zonder persoonsgegevens.',
        'Leg het resultaat aan een mens voor; pas niets automatisch in productie aan.'
      ],
      status: 'voorstel', productie: false, gemaakt: nu(), bijgewerkt: nu(), besluit: null
    };
    s.voorstellen.unshift(v);
    log('spel-frictie-gevonden', actor, v.naam + ' · ' + gemiddelde + '%');
  }

  function voorstelPubliek(v) {
    return {
      id: v.id, sleutel: v.sleutel, spoor: v.spoor, naam: v.naam,
      probleem: v.probleem, doelgroep: v.doelgroep, oplossing: v.oplossing,
      impact: v.impact, risico: v.risico, gebruiktFuncties: v.gebruiktFuncties,
      ontbreekt: v.ontbreekt, testplan: v.testplan, status: v.status,
      bewijs: v.bewijs || null,
      productie: false, gemaakt: v.gemaakt, bijgewerkt: v.bijgewerkt,
      besluit: v.besluit || null
    };
  }

  function scan(actor = 'Future Engine', geforceerd = false) {
    const s = state();
    /* Een overzicht openen is een leesactie, geen broncode-audit. De oude
       volgorde voerde verversCapabilityGraph() al uit vóór deze daggrens en
       startte daardoor per speler een native scan over duizenden routes. Dat
       maakte het scherm onnodig CPU-zwaar en kon de failover-hartslag onder
       piekbelasting laten wisselen. De boardroom kan nog altijd onmiddellijk
       geforceerd scannen; automatisch gebeurt het eenmaal per dag. */
    if (!geforceerd && s.laatsteScan && nu() - s.laatsteScan < DAG) {
      const codeScan = {
        gewijzigd: false, toegevoegd: 0, voorstellen: 0,
        cijfers: capabilityGraph.cijfers, gatenplan: null
      };
      return { ok: true, nieuw: codeScan.voorstellen, overgeslagen: true, codeScan, capabilityGraph: publiekeCapabilityGraph(), voorstellen: s.voorstellen.map(voorstelPubliek) };
    }
    const codeScan = verversCapabilityGraph(actor);
    const ids = alleFuncties.map(f => f.id.toLowerCase());
    let nieuw = 0;
    for (const kans of KANSEN) {
      const alProduct = kans.ontbreekt.some(term => ids.some(fid => fid.includes(term)));
      const bestaat = s.voorstellen.some(v => v.sleutel === kans.sleutel);
      const bronnen = kans.nodig.filter(fid => opId[fid]);
      if (alProduct || bestaat || bronnen.length < 2) continue;
      const v = {
        id: id('kans'), sleutel: kans.sleutel, spoor: kans.spoor, naam: kans.naam,
        probleem: kans.probleem, doelgroep: kans.doelgroep, oplossing: kans.oplossing,
        impact: kans.impact, risico: kans.risico, gebruiktFuncties: bronnen,
        ontbreekt: kans.ontbreekt.slice(),
        testplan: [
          'Bouw alleen een synthetisch prototype in Magnaat Wereld.',
          'Laat minimaal drie verschillende spelersrollen dezelfde taak uitvoeren.',
          'Meet taakvoltooiing, fouten, begrijpelijkheid en ongewenste uitsluiting.',
          'Leg de uitkomst ter menselijke beslissing voor; geen automatische productie-uitrol.'
        ],
        status: 'voorstel', productie: false, gemaakt: nu(), bijgewerkt: nu(), besluit: null
      };
      s.voorstellen.unshift(v);
      log('kans-gevonden', actor, v.naam + ' · ' + v.spoor.toUpperCase());
      nieuw += 1;
    }
    s.laatsteScan = nu();
    save();
    return { ok: true, nieuw: nieuw + codeScan.voorstellen, overgeslagen: false, codeScan, capabilityGraph: publiekeCapabilityGraph(), voorstellen: s.voorstellen.map(voorstelPubliek) };
  }

  function beslis(voorstelId, actie, actor, notitie) {
    const s = state();
    const v = s.voorstellen.find(x => x.id === tekst(voorstelId, 100));
    if (!v) return { status: 404, error: 'Dit voorstel bestaat niet.' };
    actie = tekst(actie, 30).toLowerCase();
    const overgangen = {
      voorstel: { test: 'test', afwijzen: 'afgewezen', pauze: 'gepauzeerd' },
      test: { pilot: 'pilot', afwijzen: 'afgewezen', pauze: 'gepauzeerd' },
      pilot: { pauze: 'gepauzeerd', afwijzen: 'afgewezen' },
      gepauzeerd: { heropen: 'voorstel', test: 'test', afwijzen: 'afgewezen' },
      afgewezen: { heropen: 'voorstel' }
    };
    const volgende = overgangen[v.status] && overgangen[v.status][actie];
    if (!volgende) return { status: 400, error: 'Deze stap kan niet vanuit de huidige fase.' };
    v.status = volgende;
    v.bijgewerkt = nu();
    v.besluit = { actie, status: volgende, door: tekst(actor, 100) || 'boardroom', notitie: tekst(notitie, 500), at: nu() };
    log('menselijk-besluit', actor, v.naam + ' → ' + volgende);
    save();
    return { ok: true, voorstel: voorstelPubliek(v), waarschuwing: 'Dit besluit verandert alleen de Magnaat-sandbox; productie blijft ongewijzigd.' };
  }

  function wereld() {
    const spelers = Object.values(state().spelers).map(publiekeSpeler);
    const dagNr = Math.floor(nu() / DAG);
    const gebeurtenis = gebeurtenisVandaag();
    return {
      naam: 'Magnaat Wereld',
      soort: 'gedeelde doorlopende simulatie',
      databron: 'echte plaatsnamen; economische cijfers zijn expliciete spelindices',
      online: spelers.length,
      gebeurtenis,
      steden: STEDEN.map((s, i) => Object.assign({}, s, {
        trend: ((dagNr + i * 7) % 11) - 5,
        actief: s.id === gebeurtenis.stadId
      })),
      wereldXp: spelers.reduce((som, p) => som + p.xp, 0),
      missiesVoltooid: spelers.reduce((som, p) => som + p.voltooid, 0)
    };
  }

  function overzicht(key) {
    scan('Future Engine');
    const p = speler(key);
    zorgDienst(key, p);
    return {
      ok: true,
      speler: publiekeSpeler(p),
      catalogus,
      capabilityGraph: publiekeCapabilityGraph(),
      wereld: wereld(),
      partnerWereld: partnerstudio ? partnerstudio.publiekeWereld() : { naam: 'Magnaat Partnerwereld', bedrijven: [], aantal: 0,
        regel: 'Officiële partnerbedrijven verschijnen hier na menselijke RTG-goedkeuring.' },
      teamkamers: trainingslobbies.mijn(key).kamers,
      economie: economie.overzicht(key),
      controle: controle.korteSamenvatting(lidControleContext(key)),
      futureLab: state().voorstellen.map(voorstelPubliek),
      spelbrug: {
        versie: VERSIE,
        functies: catalogus.length,
        regel: 'Alle acties gebruiken synthetische data in een trainingskopie. Geen productie-endpoint wordt aangeroepen.',
        niveaus: { groen: 'lage impact, nog steeds sandbox', geel: 'persoons- of partnercontext, uitsluitend synthetisch', rood: 'geld, identiteit of regie; alleen oefenen' }
      }
    };
  }

  function partnerTrainingStart(key, code) {
    if (!partnerstudio) return { status: 503, error: 'De Partnerwereld is nog niet aangesloten.' };
    return partnerstudio.trainingStart(key, code);
  }

  function partnerTrainingAntwoord(key, trainingId, keuze) {
    if (!partnerstudio) return { status: 503, error: 'De Partnerwereld is nog niet aangesloten.' };
    const r = partnerstudio.trainingAntwoord(key, trainingId, keuze);
    if (r.error || !r.training || r.training.status !== 'voltooid') return r;
    const claim = partnerstudio.trainingClaim(key, trainingId);
    if (!claim.nieuw) return r;
    const p = speler(key), xp = claim.score * 3, virtueelBudget = claim.score * 250;
    p.xp += xp; p.virtueelBudget += virtueelBudget; p.reputatie = Math.min(100, p.reputatie + (claim.score >= 75 ? 2 : 0));
    r.beloning = { xp, virtueelBudget, reputatie: claim.score >= 75 ? 2 : 0 };
    r.speler = publiekeSpeler(p);
    log('partnertraining-voltooid', key, claim.bedrijf.naam + ' · ' + claim.score + '%');
    save();
    return r;
  }

  function kantoorStatus() {
    const s = state();
    const spelers = Object.values(s.spelers);
    const afgerond = spelers.reduce((som, p) => som + p.taken.filter(t => t.status === 'klaar').length, 0);
    return {
      ok: true,
      cijfers: {
        rtgFuncties: alleFuncties.length,
        speelbaar: catalogus.length,
        appsGevonden: capabilityGraph.cijfers.apps,
        apiActies: capabilityGraph.cijfers.apiActies,
        werkprocessen: capabilityGraph.cijfers.werkprocessen,
        kantoren: capabilityGraph.cijfers.kantoren,
        ongedekt: capabilityGraph.cijfers.ongedekteApiActies,
        spelers: spelers.length,
        opdrachtenVoltooid: afgerond,
        voorstellenOpen: s.voorstellen.filter(v => v.status === 'voorstel').length,
        tests: s.voorstellen.filter(v => v.status === 'test').length,
        pilots: s.voorstellen.filter(v => v.status === 'pilot').length
      },
      functieStatistiek: Object.entries(s.functieStatistiek).map(([functieId, x]) => ({
        functieId, aantal: x.aantal, gemiddelde: Math.round((x.punten / (x.aantal * 375)) * 100)
      })),
      veiligheidsgrens: 'De spelbrug schrijft alleen spelstaat. Productieroutes, geld, identiteit en echte communicatie zijn niet bereikbaar.',
      economie: economie.overzicht(),
      controle: controle.korteSamenvatting(boardroomControleContext('boardroom')),
      capabilityGraph: publiekeCapabilityGraph(),
      laatsteScan: s.laatsteScan || null,
      voorstellen: s.voorstellen.map(voorstelPubliek),
      logboek: s.logboek.slice(0, 80)
    };
  }

  // De eerste scan gebeurt vanzelf bij het starten van de applicatie. Dedupe op
  // sleutel maakt dit herstartveilig en voorkomt telkens nieuwe voorstellen.
  scan('Future Engine', !state().laatsteScan);

  return { magnaatWereld: {
    overzicht, taakStart, taakAntwoord, taakHandeling, taakActie,
    werkprocesStart, kiesKantoor, scan, beslis, kantoorStatus, wereld, catalogus,
    partnerTrainingStart, partnerTrainingAntwoord,
    teamkamerMijn: (key, id) => trainingslobbies.mijn(key, id),
    teamkamerMaak: (key, invoer) => trainingslobbies.maak(key, invoer),
    teamkamerDeelnemen: (key, code) => trainingslobbies.deelnemen(key, code),
    teamkamerRol: (key, id, rolId, revisie) => trainingslobbies.kiesRol(key, id, rolId, revisie),
    teamkamerStart: (key, id, revisie, commandoId) => trainingslobbies.start(key, id, revisie, commandoId),
    teamkamerActie: (key, id, invoer) => trainingslobbies.actie(key, id, invoer),
    teamkamerBedien: (key, id, actie, revisie, commandoId) => trainingslobbies.bedien(key, id, actie, revisie, commandoId),
    economieBeslis: (key, invoer) => economie.beslis(key, invoer),
    economieAnalyse: (key, invoer) => economie.analyse(key, invoer),
    economieVolgendeDag: (key, commandoId) => economie.volgendeDagAsync(key, commandoId),
    economieSchok: (key, schokId) => economie.kiesSchok(key, schokId),
    controleOverzicht: (key, filters) => controle.overzicht(lidControleContext(key), filters),
    controleZet: (key, puntId, wijziging) => controle.zet(lidControleContext(key), puntId, wijziging),
    controleTaakMaak: (key, puntId, invoer) => controle.taakMaak(lidControleContext(key), puntId, invoer),
    controleTaakZet: (key, taakId, status, bewijs) => controle.taakZet(lidControleContext(key), taakId, status, bewijs),
    controleZelftest: (key, puntId) => controle.zelftest(lidControleContext(key), puntId),
    boardroomControleOverzicht: (actor, filters) => controle.overzicht(boardroomControleContext(actor), filters),
    boardroomControleZet: (actor, puntId, wijziging) => controle.zet(boardroomControleContext(actor), puntId, wijziging),
    boardroomControleTaakMaak: (actor, puntId, invoer) => controle.taakMaak(boardroomControleContext(actor), puntId, invoer),
    boardroomControleTaakZet: (actor, taakId, status, bewijs) => controle.taakZet(boardroomControleContext(actor), taakId, status, bewijs),
    boardroomControleZelftest: (actor, puntId) => controle.zelftest(boardroomControleContext(actor), puntId),
    boardroomControlePlanGaten: (actor, invoer) => controle.planGaten(boardroomControleContext(actor), invoer),
    capabilityGraph: () => publiekeCapabilityGraph()
  } };
};
