#!/usr/bin/env node
/* ============================================================================
   DE ENDPOINT-BEWIJSMATRIX -- niet "heeft dit endpoint een toets", maar
   "welke van de elf dingen die eraan kunnen misgaan is er ooit bewezen?"

   HET PROBLEEM DAT DIT MEET. Er staan twee getallen in NORM.json die naast
   elkaar allebei waar zijn en samen misleiden:

       endpointsNooitAangeraakt  0        (elke route is tijdens de suite geraakt)
       endpointsZonderTest       1158     (de helft komt in geen toetsbestand voor)

   Geraakt is niet bewezen. Een route kan tijdens een heel ander verhaal langs
   zijn gekomen -- iemand logt in, de suite haalt onderweg een lijst op -- zonder
   dat er ook maar iets aan is nagerekend. "Dekking 100%" leest dan als een
   geruststelling die niemand heeft verdiend. De keten achter een route is:

       AUTH -> ACL -> INPUT -> OUTPUT -> STATE -> SIDE EFFECT -> AUDIT
            -> IDEMPOTENCY -> FAILURE -> ROLLBACK -> PRIVACY

   Elf schakels. Eén vinkje per route zegt over hooguit één ervan iets.

   WAT DIT BESTAND WEL EN NIET DOET, en dat onderscheid is de hele opzet.

   Het meet niets zelf. Het is een REGISTER: het legt de elf schakels naast de
   echte routetabel en zegt per cel wie hem bewijst. Vier standen, en alleen de
   eerste is een bewijs:

     bewezen     een instrument heeft het GEMETEN. De cel noemt welk.
     verklaard   het staat in de bron (een bewaker achter de route), maar
                 niemand heeft het aan een draaiende server gevraagd.
     nvt         niet van toepassing (idempotentie van een GET).
     ongemeten   niemand kijkt. Dit is het getal waar het om gaat.

   WAAROM "VERKLAARD" GEEN GROEN IS. `app.post('/api/x', auth, ...)` in de bron
   lezen is precies de fout waar routelog.js en dekking.js al voor bestaan: tekst
   lezen in plaats van waarnemen. Een bewaker die er staat maar door een eerdere
   middleware wordt overgeslagen, leest hier identiek. Verklaard is dus een
   vermoeden met een vindplaats, en het telt in de uitslag apart.

   DE RATEL. Net als NORM.json mag `ongemeten` alleen KRIMPEN. Groeit hij, dan
   gaat de poort dicht (exit 1). Dat is het hele punt: er komen routes bij, en
   zonder ratel komen de gaten er stilletjes bij.

   WAT DIT NIET BEWEERT, en dit hoort er eerlijk bij:

   - Een `bewezen` cel is bewezen op ÉÉN foutklasse, niet op alle. AUTH bewezen
     betekent "een vreemde kwam er niet in", niet "de autorisatie klopt". Twee
     ingelogde leden die bij elkaars dossier kunnen is een ACL-fout en die staat
     in een andere kolom.
   - Een `ongemeten` cel is geen bevinding. Het is de afwezigheid van een
     bewering. Dat is minder erg dan een fout en veel erger dan het lijkt.
   - v1 vult vier van de elf kolommen. De andere zeven staan met opzet leeg in
     plaats van optimistisch: een matrix die zichzelf groen kleurt is precies de
     valse zekerheid die hij moest wegnemen. Zie ONGEMETEN_PLAN hieronder voor
     wat elke lege kolom nodig heeft.

   Draai:  node scripts/bewijsmatrix.js
           node scripts/bewijsmatrix.js --vastleggen
           node scripts/bewijsmatrix.js --json
           node scripts/bewijsmatrix.js --poortwacht=uit.json
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { alleRoutes } = require('./lib/routes');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'BEWIJSMATRIX.json');

const argv = process.argv.slice(2);
const VASTLEGGEN = argv.includes('--vastleggen');
/* DE ENIGE MANIER OM EEN VERSLECHTERING VAST TE LEGGEN, en hij vraagt een reden.

   De ratel verderop weigert een stand waarin "ongemeten" groeit. Dat is goed,
   maar er is een geval waarin die weigering te streng is: de CODEBASE groeit.
   Komen er tweehonderd routes bij, dan groeit het aantal cellen met tweeduizend
   en staat er meer ongemeten -- ook als elke kolom PROPORTIONEEL gelijk bleef of
   vooruitging. Zo stond het er toen de AUDIT-kolom voor het eerst gemeten werd:
   elf kolommen gelijk of beter, AUDIT van 0 naar 13,7 procent, en toch een
   groeiende noemer.

   De kop van dit bestand zei daarover: "pas BEWIJSMATRIX.json met de hand aan
   als dit een bewuste keuze is, dan staat het in de git-historie". Dat klopt als
   principe en deugt niet als handeling -- met de hand een JSON van vierhonderd
   kilobyte bijwerken is precies hoe er stil een cijfer verschuift dat niemand
   heeft gemeten.

   Vandaar deze vlag. Hij legt dezelfde GEMETEN stand vast als --vastleggen, maar
   staat een groei van ongemeten toe EN schrijft de opgegeven reden in het
   bestand. Zonder reden doet hij niets. De reden staat daarmee naast het cijfer
   in plaats van in een commit-tekst die niemand terugzoekt. */
const REDEN = (argv.find(a => a.startsWith('--reden=')) || '').slice(8);
const JSONUIT = argv.includes('--json');
/* DE REGISTERS WORDEN NU STANDAARD GELEZEN, en dat was een val.

   Ze stonden alleen achter een vlag: zonder `--rolproef=ROLPROEF.json` las de
   matrix dat register niet, ook al lag het er. `npm run bewijsmatrix` meldde dan
   "ACL 999 -> 0, is de meetronde meegeleverd?" en zakte op zijn eigen ratel --
   over invoer die gewoon in de wortel lag. Een commando dat je alleen goed kunt
   draaien als je vier vlaggen onthoudt, wordt verkeerd gedraaid.

   De vlag blijft bestaan om een ANDER bestand aan te wijzen (een ronde uit CI,
   een oudere uitslag om mee te vergelijken). Standaard is nu: lees wat er ligt. */
const inWortel = (naam) => { const p = path.join(WORTEL, naam); return fs.existsSync(p) ? p : ''; };
const POORTWACHT = (argv.find(a => a.startsWith('--poortwacht=')) || '').slice(13) || inWortel('POORTWACHT.json');
const ROLPROEF = (argv.find(a => a.startsWith('--rolproef=')) || '').slice(11) || inWortel('ROLPROEF.json');
const HANDELINGPROEF = (argv.find(a => a.startsWith('--handelingproef=')) || '').slice(17) || inWortel('HANDELINGPROEF.json');
const KETENS = (argv.find(a => a.startsWith('--ketens=')) || '').slice(9) || inWortel('KETENS.json');
const INVOER = (argv.find(a => a.startsWith('--invoer=')) || '').slice(9) || inWortel('INVOERPROEF.json');
const IDEM = (argv.find(a => a.startsWith('--idem=')) || '').slice(7) || inWortel('IDEMPROEF.json');
const AUDIT = (argv.find(a => a.startsWith('--audit=')) || '').slice(8) || inWortel('AUDITPROEF.json');
const STAAT = (argv.find(a => a.startsWith('--staat=')) || '').slice(8) || inWortel('STAATPROEF.json');
const UITVOER = (argv.find(a => a.startsWith('--uitvoer=')) || '').slice(10) || inWortel('UITVOERPROEF.json');
const JOURNAAL = (argv.find(a => a.startsWith('--journaal=')) || '').slice(11) ||
  path.join(WORTEL, '.routejournaal');

/* ---------------------------------------------------------------------------
   DE ELF SCHAKELS.

   `nvtBijLezen` markeert de kolommen die voor een pure leesroute geen betekenis
   hebben. Een GET twee keer doen hoort per definitie hetzelfde te geven, dus
   idempotentie is daar geen belofte maar een definitie; en wat niets muteert
   heeft geen rollback.

   `bron` is wie hem VANDAAG kan bewijzen. Staat er null, dan bestaat dat
   instrument nog niet -- en dan hoort de kolom leeg te blijven staan.
   ------------------------------------------------------------------------- */
const SCHAKELS = [
  { id: 'AUTH', uitleg: 'komt een niet-ingelogde vreemde binnen',
    bron: 'scripts/poortwacht.js --per-route' },
  { id: 'ACL', uitleg: 'komt een INGELOGDE met de verkeerde rol binnen',
    bron: 'scripts/rolproef-route.js' },
  { id: 'INPUT', uitleg: 'wordt rommel geweigerd zonder 5xx',
    bron: 'scripts/invoerproef-route.js (rommel MET de juiste rol; anoniem meet je alleen de voordeur)' },
  { id: 'OUTPUT', uitleg: 'kijkt iemand naar de INHOUD van het antwoord',
    bron: 'scripts/uitvoerproef-route.js (kanaries van een ANDER account in een 2xx-antwoord)',
    nodig: 'de HELFT die hier nog niet in zit: de liegpoort per ROUTE i.p.v. per toetsbestand ' +
      '(RTG_LIEG neemt nu /api/ in een keer). De uitvoerproef toont aan dat een antwoord geen ANDERMANS ' +
      'gegevens bevat; de liegpoort zou aantonen dat het antwoord uit de ECHTE bron komt. Beide horen in OUTPUT.' },
  { id: 'STATE', uitleg: 'staat de toestand na afloop zoals beloofd',
    bron: 'scripts/staatproef-route.js (vingerafdruk voor en na, per route geijkt)', nvtBijLezen: true },
  { id: 'SIDE_EFFECT', uitleg: 'gebeurt er buiten het antwoord om iets (mail, push, betaling)',
    bron: 'scripts/staatproef-route.js (welke COLLECTIES bewogen)', nvtBijLezen: true,
    nodig: 'de uitgaande kanalen (mail, push, betaling bij een derde) staan buiten de database en dus buiten deze meting' },
    { id: 'AUDIT', uitleg: 'blijft er een spoor achter dat niemand kan wissen',
    bron: 'scripts/handelingproef-route.js (klopt aan met de JUISTE rol en kijkt of er een geketende regel verscheen)',
    nodig: 'de voorziening is server/lib/handelingsspoor.js; wat deze kolom NIET zegt is dat het spoor ' +
      'volledig is -- hij kijkt of er een regel verscheen, niet of alles wat erin staat klopt. En het ' +
      'wegknippen van de NIEUWSTE regels valt hier niet op; daarvoor is het anker nodig' },
  { id: 'AUDIT', uitleg: 'blijft er een spoor achter dat niemand kan wissen',
    bron: 'scripts/auditproef-route.js (roept de route aan en vraagt daarna aan het spoor of er een regel bij kwam)',
    nvtBijLezen: true,
    /* HIER STOND "een hashketen over het auditlog; die bestaat nog niet als
       algemene voorziening", en dat klopte maar voor de helft. De hashketen
       bestond wel (kern/command/journaal.js); wat ontbrak was BEREIK -- alleen
       RTG Command schreef erin. server/opzet/auditspoor.js geeft nu elke
       schrijfroute een regel in dezelfde vorm. */
    nodig: 'het kopzegel buiten deze database vastleggen. De keten betrapt een gewijzigde of ' +
      'weggeknipte regel, maar wie de NIEUWSTE regels weggooit houdt een kloppende keten over; ' +
      'alleen een anker bij een derde ziet dat (server/lib/keten-anker.js, bewust niet in bedrijf).' },
  { id: 'IDEMPOTENCY', uitleg: 'dezelfde oproep twee keer doet niet twee keer iets',
    bron: 'scripts/staatproef-route.js (op de TOESTAND), met scripts/idemproef-route.js als terugval (op het ANTWOORD)',
    nvtBijLezen: true },
  { id: 'FAILURE', uitleg: 'faalt hij netjes als er iets onder hem wegvalt',
    bron: 'scripts/ketenronde.js (echte sabotage op de keten waar deze route in zit)' },
  { id: 'ROLLBACK', uitleg: 'laat een half mislukte oproep niets half achter',
    bron: 'scripts/ketenronde.js + scripts/staatproef-route.js (geweigerd, en bleef de toestand gelijk)', nvtBijLezen: true },
  { id: 'PRIVACY', uitleg: 'lekt het antwoord een echte naam, IBAN of e-mailadres',
    bron: 'scripts/rolproef-route.js (op de WEIGERING; nog niet op een geslaagd antwoord)' }
];

const LEESMETHODEN = new Set(['GET', 'HEAD']);

/* ---------------------------------------------------------------------------
   DE ROUTETABEL. Uit de DRAAIENDE server, want de bron liegt hier aantoonbaar:
   routes worden op drie manieren opgehangen en de derde stelt zijn pad zelf
   samen. scripts/routekaart.js lost dat al op door de router uit te lezen, dus
   die vragen we -- en we schrijven niet onze eigen tweede scanner, want twee
   lijsten die uiteenlopen is in dit huis al vaker duur geweest.

   Valt de kaart om, dan zeggen we dat en vallen we terug op de bron MET een
   luide notitie in de uitslag. Stil terugvallen zou een kleinere matrix opleveren
   die er net zo uitziet als een goede.
   ------------------------------------------------------------------------- */
function routetabel() {
  try {
    const rauw = execFileSync(process.execPath,
      [path.join(__dirname, 'routekaart.js'), '--json'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180000 });
    const kaart = JSON.parse(rauw);
    const uit = [];
    for (const r of kaart.routes) {
      if (!r.pad.startsWith('/api/')) continue;
      for (const m of (r.methoden && r.methoden.length ? r.methoden : ['POST'])) {
        uit.push({ methode: m === 'ALL' ? 'POST' : m, pad: r.pad });
      }
    }
    return { routes: uit, herkomst: 'routekaart (draaiende server)', gedegradeerd: false };
  } catch (e) {
    const uit = alleRoutes()
      .filter(r => r.pad.startsWith('/api/'))
      .map(r => ({ methode: r.methode, pad: r.pad }));
    return {
      routes: uit,
      herkomst: 'scripts/lib/routes.js (BRON -- de routekaart viel om)',
      gedegradeerd: true,
      reden: String((e && e.message) || e).split('\n')[0].slice(0, 200)
    };
  }
}

/* De bewakers staan alleen in de BRON: daar staat de middleware naast de route.
   Sleutel op METHODE + pad, want dezelfde weg kan met GET open en met POST
   dicht staan. */
function bewakersPerRoute() {
  const kaart = new Map();
  for (const r of alleRoutes()) {
    if (!r.pad.startsWith('/api/')) continue;
    kaart.set(r.methode + ' ' + r.pad, { bewakers: r.bewakers, waar: r.bestand + ':' + r.regel });
  }
  return kaart;
}

/* Het routejournaal: welk patroon heeft de server tijdens de suite echt
   afgehandeld. Dit is GERAAKT en nadrukkelijk geen bewijs -- het staat in de
   uitslag als aparte vlag en niet als kolom, precies omdat het verwarren van die
   twee de reden is dat dit bestand bestaat. */
function geraakt() {
  try {
    return new Set(fs.readFileSync(JOURNAAL, 'utf8').split('\n')
      .map(r => r.trim()).filter(Boolean));
  } catch (e) { return null; }
}

/* De poortwacht met --per-route levert per METHODE+pad een oordeel over de
   voordeur. Zonder dat bestand blijft AUTH op 'verklaard' staan. */
/* De rolproef per route: welke schrijfroutes zijn met een verkeerde rol
   beproefd. Staat een route er NIET in, dan blijven ACL en PRIVACY ongemeten --
   "geen bevinding" is hier geen groen, want er is niet gekeken. */
function rolproefUitslag() {
  if (!ROLPROEF) return null;
  try {
    const j = JSON.parse(fs.readFileSync(ROLPROEF, 'utf8'));
    if (!Array.isArray(j.perRoute)) return null;
    const kaart = new Map();
    for (const r of j.perRoute) kaart.set(r.methode + ' ' + r.pad, r);
    return kaart;
  } catch (e) { return null; }
}

/* De handelingproef per route: liet een geslaagde oproep een geketende regel na
   in het handelingsspoor? Zelfde vorm als de rolproef -- een route die er niet
   in staat is niet beproefd, en dat is ongemeten en geen groen. */
function handelingproefUitslag() {
  if (!HANDELINGPROEF) return null;
  try {
    const j = JSON.parse(fs.readFileSync(HANDELINGPROEF, 'utf8'));
    if (!Array.isArray(j.perRoute)) return null;
    const kaart = new Map();
    for (const r of j.perRoute) kaart.set(r.methode + ' ' + r.pad, r);
    return kaart;
  } catch (e) { return null; }
}

/* De invoerproef en de idempotentieproef: allebei per METHODE+pad een regel.
   Een route die er niet in staat is niet beproefd, en een route die er met
   'poort' respectievelijk 'ongemeten' in staat is WEL geprobeerd en NIET
   beoordeeld -- dat verschil houden we vast, want het is een werklijst. */
function perRouteKaart(bestand) {
  if (!bestand) return null;
  try {
    const j = JSON.parse(fs.readFileSync(bestand, 'utf8'));
    if (!Array.isArray(j.perRoute)) return null;
    const kaart = new Map();
    for (const r of j.perRoute) kaart.set(r.methode + ' ' + r.pad, r);
    return kaart;
  } catch (e) { return null; }
}

/* De ketenronde: welke ROUTES zitten in een keten die onder echte sabotage is
   beoordeeld. Alleen scenario's die de zevenstappenlat halen tellen -- een
   scenario dat niet zichtbaar of niet herhaalbaar was, is geen bewijs. */
/* DE KETENUITSLAG PER ROUTE -- en drie vlaggen in plaats van een oordeel.

   Hier stond "de STRENGSTE uitkomst telt" in het commentaar, en dat deed de code
   niet: hij OVERSCHREEF bij elk volgend scenario. Voor GELD en NOTITIE betekende
   dat het volgende. Twee sabotages halen de lat: `schrijf-verloren`, waar de
   terugdraaiing werkelijk is aangetoond (PROVEN), en `sterf-na-commit`, waar er
   niets terug te draaien VALT (de commit was al rond) en het veld dus NVT is. De
   laatste won, en zo stonden /api/notities/bewaar en /api/pay/oplaad als GEZAKT
   met "rollback niet bewezen" -- terwijl hij juist wel bewezen was, in het
   scenario waar de vraag van toepassing was.

   NVT IS NIET GEZAKT. Dat is dezelfde regel die deze matrix overal aanhoudt:
   ongemeten en gezakt zijn twee dingen. Vandaar drie vlaggen die OPTELLEN over
   de scenario's, zodat het oordeel pas aan het eind valt:

     proven      ergens is de terugdraaiing echt aangetoond
     beoordeeld  ergens kon er uberhaupt iets over gezegd worden (niet NVT)
     stil        ergens ging er stil iets verloren -- en dat is besmettelijk,
                 want een keten die onder een sabotage stil verlies gaf is niet
                 bewezen omdat een andere sabotage netjes verliep. */
function ketenKaartUit(scenarios) {
  const kaart = new Map();
  for (const sc of scenarios || []) {
    if (!sc.verraad || !(sc.lat && sc.lat.voldoet)) continue;
    for (const pad of (ROUTES_PER_KETEN[sc.keten] || [])) {
      const oud = kaart.get(pad);
      kaart.set(pad, {
        failure: sc.clientAntwoord === 'FAIL' || !!(oud && oud.failure),
        proven: sc.rollback === 'PROVEN' || !!(oud && oud.proven),
        beoordeeld: sc.rollback !== 'NVT' || !!(oud && oud.beoordeeld),
        stil: !!sc.stilVerlies || !!(oud && oud.stil)
      });
    }
  }
  return kaart;
}

function ketenUitslag() {
  if (!KETENS) return null;
  try {
    const j = JSON.parse(fs.readFileSync(KETENS, 'utf8'));
    if (!Array.isArray(j.scenarios)) return null;
    return ketenKaartUit(j.scenarios);
  } catch (e) { return null; }
}

/* Welke schrijfroutes een keten aanraakt. Met de hand, want een keten IS een
   handmatig gekozen verhaal -- hem laten raden welke routes erbij horen zou een
   bewijs uitsmeren over routes die nooit zijn geraakt. */
const ROUTES_PER_KETEN = {
  NOTITIE: ['POST /api/notities/bewaar'],
  GELD: ['POST /api/pay/oplaad'],
  TOESTEMMING: ['POST /api/toestemming/intrek']
};

function poortwachtUitslag() {
  if (!POORTWACHT) return null;
  try {
    const j = JSON.parse(fs.readFileSync(POORTWACHT, 'utf8'));
    if (!Array.isArray(j.perRoute)) return null;
    const kaart = new Map();
    for (const p of j.perRoute) kaart.set(p.methode + ' ' + p.pad, p);
    return kaart;
  } catch (e) { return null; }
}

/* ---------------------------------------------------------------------------
   DE MATRIX ZELF.
   ------------------------------------------------------------------------- */
/* DE INVOER WORDT ERIN GEGEVEN EN NIET OPGEHAALD, en dat is geen stijlkeuze.

   Haalt bouw() zijn eigen routetabel op, dan start elke toets erover een echte
   server via de routekaart -- minuten per aanroep. Wat er dan gebeurt is
   voorspelbaar: er komt geen toets, of er komt er een die het bestand alleen
   laadt. LAT.md regel 9 noemt dat laatste erger dan niets.

   Met de vier bronnen als parameter is de kern een pure functie: vier lijstjes
   erin, een matrix eruit, in milliseconden. Zonder argumenten gedraagt hij zich
   precies als eerst, dus de aanroeper hieronder merkt er niets van. */
function bouw(invoer) {
  const inv = invoer || {};
  const tabel = inv.tabel || routetabel();
  const bewakers = inv.bewakers || bewakersPerRoute();
  const journaal = inv.journaal !== undefined ? inv.journaal : geraakt();
  const poort = inv.poort !== undefined ? inv.poort : poortwachtUitslag();
  const rol = inv.rol !== undefined ? inv.rol : rolproefUitslag();
  const keten = inv.keten !== undefined ? inv.keten : ketenUitslag();
  const invoerKaart = inv.invoer !== undefined ? inv.invoer : perRouteKaart(INVOER);
  const idemKaart = inv.idem !== undefined ? inv.idem : perRouteKaart(IDEM);
  const auditKaart = inv.audit !== undefined ? inv.audit : perRouteKaart(AUDIT);
  const staat = inv.staat !== undefined ? inv.staat : perRouteKaart(STAAT);
  const uitvoerKaart = inv.uitvoer !== undefined ? inv.uitvoer : perRouteKaart(UITVOER);
  const handeling = inv.handeling !== undefined ? inv.handeling : handelingproefUitslag();

  const rijen = [];
  for (const r of tabel.routes) {
    const sleutel = r.methode + ' ' + r.pad;
    const bron = bewakers.get(sleutel) || bewakers.get('POST ' + r.pad) || null;
    const lezend = LEESMETHODEN.has(r.methode);
    const cellen = {};

    for (const s of SCHAKELS) {
      if (s.nvtBijLezen && lezend) { cellen[s.id] = { staat: 'nvt', bron: 'leesroute' }; continue; }

      if (s.id === 'AUTH') {
        const gemeten = poort && poort.get(sleutel);
        if (gemeten) {
          /* BEPROEFD EN GEZAKT IS GEEN BEWIJS, en dat stond hier fout: elk
             oordeel van de poortwacht werd als 'bewezen' overgenomen, ook
             'open' -- een route waar een vreemde zonder token binnenkwam. Dan
             telt precies de bevinding waar deze kolom voor bestaat, mee als
             dekking. ACL en PRIVACY hieronder deden het al goed; AUTH niet.
             'onbereikbaar' is evenmin een meting: daar kwam geen antwoord. */
          cellen[s.id] = gemeten.oordeel === 'open'
            ? { staat: 'gezakt', bron: 'poortwacht', reden: 'zonder token binnengekomen (status ' + gemeten.status + ')' }
            : gemeten.oordeel === 'onbereikbaar'
              ? { staat: 'ongemeten', bron: 'poortwacht', reden: 'geen antwoord tijdens de ronde' }
              : { staat: 'bewezen', bron: 'poortwacht', oordeel: gemeten.oordeel };
        } else if (bron && bron.bewakers.length) {
          cellen[s.id] = { staat: 'verklaard', bron: bron.bewakers.join('+'), waar: bron.waar };
        } else {
          cellen[s.id] = { staat: 'ongemeten' };
        }
        continue;
      }

      if (s.id === 'FAILURE' || s.id === 'ROLLBACK') {
        const k = keten && keten.get(sleutel);
        if (k && s.id === 'FAILURE') {
          cellen[s.id] = !k.stil
            ? { staat: 'bewezen', bron: 'ketenronde' }
            : { staat: 'gezakt', bron: 'ketenronde', reden: 'stil verlies' };
          continue;
        }
        /* ROLLBACK IN DRIE STAPPEN, en de derde is de reparatie: kon er NERGENS
           iets over gezegd worden, dan zwijgt de zware bron en mag de lichte
           (de staatproef hieronder) spreken. Eerst gaf hij daar "gezakt" op, en
           dat was ongemeten vermomd als een bevinding. */
        if (k && k.stil) { cellen[s.id] = { staat: 'gezakt', bron: 'ketenronde', reden: 'stil verlies' }; continue; }
        if (k && k.proven) { cellen[s.id] = { staat: 'bewezen', bron: 'ketenronde' }; continue; }
        if (k && k.beoordeeld) {
          cellen[s.id] = { staat: 'gezakt', bron: 'ketenronde', reden: 'rollback niet bewezen' };
          continue;
        }
        /* ROLLBACK HEEFT SINDS DE STAATPROEF EEN TWEEDE BRON, en de volgorde is
           met opzet deze. De ketenronde is het ZWAARSTE bewijs: echte sabotage,
           een herstart, en gemeten of het geld er daarna nog is -- maar hij dekt
           drie routes. De staatproef is lichter (geweigerd, en bewoog de opslag
           niet) en dekt er duizenden. Waar de zware spreekt, telt de zware; waar
           hij zwijgt, mag de lichte iets zeggen. Elke cel noemt zijn bron, dus
           het blijft leesbaar welke van de twee sprak. */
        const st = s.id === 'ROLLBACK' && staat && staat.get(sleutel);
        if (st && st.rollback === 'bewezen') {
          cellen[s.id] = { staat: 'bewezen', bron: 'staatproef', reden: st.reden };
        } else if (st && st.rollback === 'GEZAKT') {
          cellen[s.id] = { staat: 'gezakt', bron: 'staatproef', reden: st.reden };
        } else {
          cellen[s.id] = { staat: 'ongemeten' };
        }
        continue;
      }

      if (s.id === 'STATE' || s.id === 'SIDE_EFFECT') {
        const st = staat && staat.get(sleutel);
        const veld = s.id === 'STATE' ? 'state' : 'sideEffect';
        if (st && st[veld] === 'bewezen') {
          cellen[s.id] = { staat: 'bewezen', bron: 'staatproef',
            ...(s.id === 'SIDE_EFFECT' ? { collecties: st.collecties } : {}) };
        } else if (st) {
          cellen[s.id] = { staat: 'ongemeten', bron: 'staatproef', reden: st.reden };
        } else {
          cellen[s.id] = { staat: 'ongemeten' };
        }
        continue;
      }

      if (s.id === 'AUDIT') {
        const beproefd = handeling && handeling.get(sleutel);
        /* 'ongemeten' in de proef betekent: de oproep gaf geen 2xx, dus er is
           niets gebeurd en er HOORT geen regel te zijn. Dat is geen bewijs en
           ook geen bevinding -- het is niet gemeten. */
        if (beproefd && beproefd.audit === 'bewezen') {
          cellen[s.id] = { staat: 'bewezen', bron: 'handelingproef' };
        } else if (beproefd && beproefd.audit === 'gezakt') {
          cellen[s.id] = { staat: 'gezakt', bron: 'handelingproef', reden: beproefd.reden };
        } else {
          cellen[s.id] = { staat: 'ongemeten' };
        }
        continue;
      }

      if (s.id === 'ACL' || s.id === 'PRIVACY') {
        const beproefd = rol && rol.get(sleutel);
        if (beproefd) {
          /* Beproefd EN doorstaan is bewezen; beproefd en gezakt is een
             bevinding, en die hoort niet als bewijs te tellen. */
          const stuk = s.id === 'ACL' ? beproefd.acl === 'OPEN' : beproefd.privacy === 'LEK';
          cellen[s.id] = stuk
            ? { staat: 'gezakt', bron: 'rolproef', rollen: beproefd.geprobeerd }
            : { staat: 'bewezen', bron: 'rolproef', rollen: beproefd.geprobeerd };
        } else {
          cellen[s.id] = { staat: 'ongemeten' };
        }
        continue;
      }

      if (s.id === 'INPUT') {
        const iv = invoerKaart && invoerKaart.get(sleutel);
        if (iv && iv.invoer === 'dicht') cellen[s.id] = { staat: 'bewezen', bron: 'invoerproef', pogingen: iv.pogingen };
        else if (iv && iv.invoer === 'GEZAKT') cellen[s.id] = { staat: 'gezakt', bron: 'invoerproef', reden: iv.reden };
        /* 'poort' is WEL geprobeerd en NIET beoordeeld: de reden hoort erbij,
           anders is hij niet te onderscheiden van een route waar niemand ooit
           aan heeft geklopt. */
        else if (iv) cellen[s.id] = { staat: 'ongemeten', bron: 'invoerproef', reden: iv.reden };
        else cellen[s.id] = { staat: 'ongemeten' };
        continue;
      }

      if (s.id === 'OUTPUT') {
        const uv = uitvoerKaart && uitvoerKaart.get(sleutel);
        if (uv && uv.uitvoer === 'schoon') cellen[s.id] = { staat: 'bewezen', bron: 'uitvoerproef' };
        else if (uv && uv.uitvoer === 'GEZAKT') cellen[s.id] = { staat: 'gezakt', bron: 'uitvoerproef' };
        /* 'poort' betekent: geprobeerd, nooit een 2xx gekregen, dus niets te
           wegen. Geprobeerd-en-ongemeten hoort zichtbaar te blijven, anders is
           het niet te onderscheiden van een route waar niemand aanklopte. */
        else if (uv) cellen[s.id] = { staat: 'ongemeten', bron: 'uitvoerproef', reden: 'nooit een 2xx' };
        else cellen[s.id] = { staat: 'ongemeten' };
        continue;
      }

      if (s.id === 'AUDIT') {
        /* GEZAKT IS HIER WEL EEN DEFECT-OORDEEL, anders dan bij IDEMPOTENCY. Een
           schrijfhandeling die lukt zonder spoor is achteraf niet terug te
           vinden, en dat is letterlijk wat deze kolom belooft. */
        const a = auditKaart && auditKaart.get(sleutel);
        if (a && a.audit === 'bewezen') cellen[s.id] = { staat: 'bewezen', bron: 'auditproef', reden: a.reden };
        else if (a && a.audit === 'gezakt') cellen[s.id] = { staat: 'gezakt', bron: 'auditproef', reden: a.reden };
        else if (a) cellen[s.id] = { staat: 'ongemeten', bron: 'auditproef', reden: a.reden };
        else cellen[s.id] = { staat: 'ongemeten' };
        continue;
      }

      if (s.id === 'IDEMPOTENCY') {
        /* TWEE INSTRUMENTEN, EEN VOLGORDE. De staatproef kijkt naar de TOESTAND en
           is daarmee strikt sterker dan de idemproef, die het aan het ANTWOORD
           moet aflezen. Waar de staatproef een oordeel heeft, telt dat; waar hij
           zwijgt (de eerste oproep bewoog niets) mag de idemproef nog iets
           zeggen -- die ziet soms een nieuw id in een antwoord waar de opslag
           niet zichtbaar bewoog. Elke cel noemt zijn bron. */
        const stI = staat && staat.get(sleutel);
        if (stI && stI.idempotentie === 'bewezen') { cellen[s.id] = { staat: 'bewezen', bron: 'staatproef', reden: stI.idemReden }; continue; }
        if (stI && stI.idempotentie === 'GEZAKT') { cellen[s.id] = { staat: 'gezakt', bron: 'staatproef', reden: stI.idemReden }; continue; }
        const id = idemKaart && idemKaart.get(sleutel);
        if (id && id.idempotentie === 'beschermd') cellen[s.id] = { staat: 'bewezen', bron: 'idemproef', reden: id.reden };
        /* ONBESCHERMD IS HIER GEZAKT, en dat vraagt uitleg. Het register houdt
           het neutrale woord aan, want twee notities maken op twee keer drukken
           is geen defect. In DEZE kolom is de belofte letterlijk "twee keer doet
           niet twee keer iets", en die gaat er dus niet op. Het is een lijst met
           routes die een idem-sleutel nodig hebben, geen lijst met bugs. */
        else if (id && id.idempotentie === 'onbeschermd') cellen[s.id] = { staat: 'gezakt', bron: 'idemproef', reden: id.reden };
        else if (id) cellen[s.id] = { staat: 'ongemeten', bron: 'idemproef', reden: id.reden };
        else cellen[s.id] = { staat: 'ongemeten' };
        continue;
      }

      cellen[s.id] = { staat: 'ongemeten' };
    }

    rijen.push({
      methode: r.methode,
      pad: r.pad,
      geraakt: journaal ? journaal.has(r.pad) : null,
      cellen
    });
  }

  /* De telling. Per schakel EN in totaal, want een matrix die alleen een
     eindcijfer geeft verbergt precies welke kolom leeg is. */
  const perSchakel = {};
  let ongemeten = 0, bewezen = 0, verklaard = 0, nvt = 0, gezakt = 0;
  for (const s of SCHAKELS) perSchakel[s.id] = { bewezen: 0, verklaard: 0, nvt: 0, ongemeten: 0, gezakt: 0 };
  for (const rij of rijen) {
    for (const s of SCHAKELS) {
      const st = rij.cellen[s.id].staat;
      perSchakel[s.id][st]++;
      if (st === 'ongemeten') ongemeten++;
      else if (st === 'bewezen') bewezen++;
      else if (st === 'verklaard') verklaard++;
      else if (st === 'gezakt') gezakt++;
      else nvt++;
    }
  }

  return {
    herkomst: tabel.herkomst,
    gedegradeerd: tabel.gedegradeerd || false,
    reden: tabel.reden,
    journaalGelezen: journaal ? JOURNAAL.replace(WORTEL + '/', '') : null,
    routes: rijen.length,
    schakels: SCHAKELS.length,
    cellen: rijen.length * SCHAKELS.length,
    telling: { bewezen, verklaard, nvt, ongemeten, gezakt },
    perSchakel,
    rijen
  };
}

/* ---------------------------------------------------------------------------
   DE RATEL. Alleen het TOTAAL ongemeten telt als grens, en bewust niet de
   afzonderlijke kolommen: die verschuiven onderling als een route van GET naar
   POST gaat, en dan zou de poort dichtgaan om een verhuizing.

   Een gedegradeerde ronde (routekaart om) oordeelt NIET. Hij ziet minder routes
   en zou daardoor "verbeterd" melden -- de vervelendste soort vals groen.
   ------------------------------------------------------------------------- */
function vorige() {
  try { return JSON.parse(fs.readFileSync(UITSLAG, 'utf8')); } catch (e) { return null; }
}

/* Zonder de rijen: die maken het bestand tientallen megabytes en de git-diff
   onleesbaar. De rijen zijn met --json altijd op te vragen. */
function zonderRijen(m) {
  const { rijen, ...rest } = m;
  return { ...rest, uitleg: 'Gegenereerd door scripts/bewijsmatrix.js. ongemeten MAG ALLEEN KRIMPEN.' };
}

/* WELKE SCHAKEL IS ACHTERUIT GEGAAN. Zonder dit meldt de ratel alleen een
   getal, en dan is de eerste gedachte altijd "er zijn routes bijgekomen".
   Meestal klopt dat niet: veel waarschijnlijker is dat een MEETRONDE NIET IS
   MEEGELEVERD -- de poortwacht-uitslag ontbreekt, en dan valt AUTH in één klap
   van bewezen terug naar verklaard. Dat is iets heel anders dan een nieuw gat,
   en een ratel die die twee door elkaar haalt leert mensen om hem te negeren. */
function achteruit(nu, oud) {
  if (!oud || !oud.perSchakel) return [];
  const uit = [];
  for (const s of SCHAKELS) {
    const a = oud.perSchakel[s.id], b = nu.perSchakel[s.id];
    if (!a || !b) continue;
    const gatGroeit = b.ongemeten > a.ongemeten;
    /* BEWEZEN DAT KRIMPT IS OOK ACHTERUIT, en dit stond er eerst niet in.

       De eerste versie keek alleen naar `ongemeten`. Een cel die van bewezen
       naar VERKLAARD zakt verandert dat getal niet -- het gat groeit immers
       niet -- dus gleed het er geruisloos langs. Juist dat is de erosie waar
       deze ratel voor bestaat: de meting verdwijnt, de bron-tekst blijft, en
       het register ziet er nog net zo geruststellend uit. De eigen toets van
       dit bestand viel erover, en dat is precies waarvoor hij er is. */
    const bewijsKrimpt = b.bewezen < a.bewezen;
    if (!gatGroeit && !bewijsKrimpt) continue;
    uit.push('    ' + s.id.padEnd(12) +
      (gatGroeit ? 'ongemeten ' + a.ongemeten + ' -> ' + b.ongemeten + '  ' : '') +
      (bewijsKrimpt ? 'bewezen ' + a.bewezen + ' -> ' + b.bewezen +
        '   (is de meetronde meegeleverd?)' : ''));
  }
  return uit;
}

const CONTROL = {
  control: 'ENDPOINT-BEWIJS',
  wat: 'per route is vastgelegd welke van de elf schakels bewezen is en door wie',
  eigenaar: 'Techniek',
  bewijs: ['test/bewijsmatrix.test.js'],
  bewijsstuk: 'BEWIJSMATRIX.json -- elf schakels per route, met bron per bewezen cel',
  dekking: { register: 'BEWIJSMATRIX.json', beproefd: 'telling.bewezen',
    totaal: 'cellen', eenheid: 'cellen',
    tellers: { ongemeten: 'telling.ongemeten', gezakt: 'telling.gezakt' } },
  grens: 'het register MEET niets zelf; het verzamelt wat andere instrumenten meten. ' +
    'Vier van de elf kolommen hebben vandaag een instrument, zeven staan leeg.'
};

module.exports = { bouw, achteruit, SCHAKELS, LEESMETHODEN, ketenKaartUit, CONTROL };

/* Alleen doen als iemand dit bestand DRAAIT. Wordt het geladen (door een toets,
   of straks door de keuring), dan hoort er niets te gebeuren en al helemaal geen
   process.exit -- dat nam vroeger de hele testrunner mee. */
if (require.main !== module) return;

const matrix = bouw();

if (JSONUIT) { console.log(JSON.stringify(matrix, null, 1)); process.exit(0); }

const oud = vorige();
console.log('\n=== DE ENDPOINT-BEWIJSMATRIX ===\n');
console.log('  routes            : ' + matrix.routes + '   (' + matrix.herkomst + ')');
console.log('  schakels          : ' + matrix.schakels);
console.log('  cellen            : ' + matrix.cellen);
console.log('');
console.log('  bewezen           : ' + matrix.telling.bewezen);
console.log('  verklaard         : ' + matrix.telling.verklaard + '   (staat in de bron, niemand heeft het gevraagd)');
console.log('  niet van toepassing: ' + matrix.telling.nvt);
console.log('  ONGEMETEN         : ' + matrix.telling.ongemeten);
console.log('\n  per schakel:');
for (const s of SCHAKELS) {
  const p = matrix.perSchakel[s.id];
  console.log('    ' + s.id.padEnd(12) + 'bewezen ' + String(p.bewezen).padStart(5) +
    '   verklaard ' + String(p.verklaard).padStart(5) +
    '   nvt ' + String(p.nvt).padStart(5) +
    '   ongemeten ' + String(p.ongemeten).padStart(5) +
    (s.bron ? '' : '   <- geen instrument'));
}

if (matrix.gedegradeerd) {
  console.log('\n  !! GEDEGRADEERD: de routekaart viel om (' + matrix.reden + ').');
  console.log('     Deze ronde ziet mogelijk minder routes en velt daarom GEEN oordeel.');
  process.exit(0);
}

if (VASTLEGGEN) {
  const slechter = achteruit(matrix, oud);
  if (oud && (matrix.telling.ongemeten > oud.telling.ongemeten || slechter.length)) {
    console.log('\n  GEWEIGERD: ongemeten ' + oud.telling.ongemeten + ' -> ' + matrix.telling.ongemeten +
      ', bewezen ' + oud.telling.bewezen + ' -> ' + matrix.telling.bewezen + '.');
    for (const r of slechter) console.log(r);
    if (!REDEN) {
      console.log('  De ratel legt geen verslechtering vast. Is dit een bewuste keuze --');
      console.log('  bijvoorbeeld omdat de codebase groeide en elke kolom proportioneel');
      console.log('  gelijk bleef -- leg hem dan vast MET een reden:');
      console.log('    node scripts/bewijsmatrix.js --vastleggen --reden="..."');
      console.log('  Die reden komt in BEWIJSMATRIX.json te staan, naast het cijfer.');
      process.exit(1);
    }
    matrix.verslechteringToegestaan = { reden: REDEN, cellenVoor: oud.routes * 11, cellenNa: matrix.routes * 11 };
    console.log('\n  VASTGELEGD MET REDEN: ' + REDEN);
  }
  fs.writeFileSync(UITSLAG, JSON.stringify(zonderRijen(matrix), null, 2) + '\n');
  console.log('\n  vastgelegd in BEWIJSMATRIX.json');
  process.exit(0);
}

if (!oud) {
  console.log('\n  Nog geen BEWIJSMATRIX.json. Leg de stand vast met --vastleggen.');
  process.exit(0);
}
/* De poort gaat dicht bij ALLEBEI de vormen van achteruitgang: een gat dat
   groeit, en bewijs dat verdwijnt. Zie achteruit() voor waarom die tweede er
   apart in staat. */
const waarAchteruit = achteruit(matrix, oud);
if (matrix.telling.ongemeten > oud.telling.ongemeten || waarAchteruit.length) {
  console.log('\n  ZAKT: ongemeten ' + oud.telling.ongemeten + ' -> ' + matrix.telling.ongemeten +
    ', bewezen ' + oud.telling.bewezen + ' -> ' + matrix.telling.bewezen + '.');
  const waar = waarAchteruit;
  if (waar.length) { console.log('\n  achteruit op:'); for (const r of waar) console.log(r); }
  console.log('\n  Meet ze, of leg de verslechtering met de hand vast in BEWIJSMATRIX.json');
  console.log('  met een reden. Ontbreekt er een meetronde, geef hem dan mee:');
  console.log('    node scripts/poortwacht.js --json --per-route > pw.json');
  console.log('    node scripts/bewijsmatrix.js --poortwacht=pw.json');
  process.exit(1);
}
if (matrix.telling.ongemeten < oud.telling.ongemeten) {
  console.log('\n  BETER: ongemeten ' + oud.telling.ongemeten + ' -> ' + matrix.telling.ongemeten +
    '. Zet de ratel strakker met --vastleggen.');
  process.exit(0);
}
console.log('\n  De stand is gelijk aan BEWIJSMATRIX.json.');
process.exit(0);
