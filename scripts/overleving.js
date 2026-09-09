#!/usr/bin/env node
/* ============================================================================
   DE OVERLEVINGSMETER -- Single Compromise Survivability.

   DE VRAAG DIE HIJ STELT, en het is een andere dan alle andere meters in dit
   huis stellen: niet "houden wij deze aanval tegen" maar "als er EEN ding wordt
   overgenomen -- een wachtwoord, een sessie, de kantoorcode, een apparaat, een
   dienst, de AI, een document, een medewerker -- houdt RTG dan stand?"

   WAAROM DAT EEN ANDERE MEETLAT IS. IDOR.json (1623 routes, 0 doorbraken) en
   GLUURRONDE.json (13.617 verzoeken, 0 gaten) zijn allebei groen, en ze
   beantwoorden allebei de vraag of een NIET-gecompromitteerde buitenstaander
   binnenkomt. Dat is de makkelijke helft. Deze meter gaat ervan uit dat de
   aanvaller al ergens binnen is, en vraagt wat er dan nog overeind blijft --
   want dat is de aanname waar WEERBAARHEID.md op staat.

   VIER UITSLAGEN, EN `onbekend` IS ER EEN VAN.

     ja        er is een grond waaruit volgt dat dit compromis niet volstaat
     deels     er staat iets tussen, maar niet over de volle breedte
     nee       er is een gemeten grond waaruit volgt dat dit compromis volstaat
     onbekend  niemand heeft gemeten; dat is iets ANDERS dan `nee` en het wordt
               nooit als `deels` weggeschreven

   Die vierde is de reden dat deze meter bestaat in plaats van een tabel in een
   document. Een leeg vak in een tabel wordt door de lezer gevuld met zijn eigen
   indruk; `onbekend` MET de reden erbij kan dat niet.

   ER KOMT GEEN SAMENGESTELD CIJFER UIT. Geen "72% weerbaar", geen score, geen
   kleur over het geheel. BEWIJSMACHINE.md verbiedt het enkele READY boven een
   scorecard, en met reden: acht eerlijke uitslagen die worden opgeteld tot een
   getal, verbergen precies welke van de acht bewoog. Wie hier ooit een
   totaalcijfer bij zet, heeft van deze meter een dashboard gemaakt.

   ELKE RIJ LEEST EEN ECHTE BRON. Geen enkele uitslag staat in dit bestand
   ingetypt: elke rij wijst een register of een bronbestand aan, leest daar een
   waarde uit, en leidt zijn uitslag daaruit af. Ontbreekt die bron, dan is de
   rij `onbekend` met de reden -- nooit stil een middenwaarde. Zo beweegt de
   meter mee met het huis in plaats van met de pen van wie hem schreef.

   DRIE RATELS, EN MET OPZET GEEN VIERDE DIE ZE OPTELT (--controle):
     - het aantal `ja` mag niet dalen;
     - het aantal `nee` mag niet stijgen;
     - het aantal `onbekend` mag niet stijgen -- want minder meten is geen
       vooruitgang, en zonder deze derde ratel is een bron weghalen de
       goedkoopste manier om `nee` te laten verdwijnen.

   DE ZELFIJKING (--zelfijking). LAT.md regel 2: een meter die je niet hebt zien
   uitslaan, meet niets. Deze meter voedt zichzelf daarom een vervalste bron
   waarin het probleem is opgelost, en eist dat de uitslag MEEBEWEEGT. Doet hij
   dat niet, dan leest hij zijn bron niet echt en zakt hij op zijn eigen ijking
   -- ook al staan alle acht rijen er dan keurig bij.

   Draai:  node scripts/overleving.js                  (tonen)
           node scripts/overleving.js --vastleggen     (OVERLEVING.json schrijven)
           node scripts/overleving.js --controle       (de drie ratels)
           node scripts/overleving.js --zelfijking     (meet de meter)
           node scripts/overleving.js --json
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'OVERLEVING.json');

const UITSLAGEN = ['ja', 'deels', 'nee', 'onbekend'];

/* ---------------------------------------------------------------- de bronnen

   Elke bron geeft `{ ok: true, ... }` of `{ ok: false, reden }`. Een bron die
   niet te lezen is, is nooit een uitzondering die de meter laat omvallen: hij
   wordt een `onbekend` met die reden in de uitslag. Een meter die crasht op een
   ontbrekend register, wordt uit de keten gehaald; een meter die het meldt,
   niet. */

function leesRegister(naam) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(path.join(WORTEL, naam), 'utf8')), naam };
  } catch (e) {
    return { ok: false, reden: naam + ' is niet te lezen (' + e.code + '); draai de meter die hem schrijft' };
  }
}

function leesBron(relPad) {
  try {
    return { ok: true, tekst: fs.readFileSync(path.join(WORTEL, relPad), 'utf8'), naam: relPad };
  } catch (e) {
    return { ok: false, reden: relPad + ' bestaat niet meer; deze rij wees naar code die is verplaatst' };
  }
}

function bronnen() {
  return {
    kantoormacht: leesRegister('KANTOORMACHT.json'),
    isolatieproef: leesRegister('ISOLATIEPROEF.json'),
    vertrouwen: leesRegister('VERTROUWEN.json'),
    lusstap: leesBron('server/kern/stuur/lusstap.js'),
    ceremonieEisen: leesBron('server/kern/isolatie/ceremonie-eisen.js'),
    goedkeuring: leesBron('server/kern/stuur/goedkeuring.js'),
    identiteitVertrouwen: leesBron('server/kern/identiteit/vertrouwen.js'),
    intrekking: leesBron('server/pgaccounts-intrekking.js'),
    webauthnActies: leesBron('server/kern/webauthn-acties.js'),
    bevestiging: leesBron('server/kern/stuur/bevestiging.js'),
    tls: leesBron('server/lib/tls.js'),
    ca: leesBron('server/lib/ca.js'),
    webIndex: leesBron('server/web/index.js')
  };
}

/* ------------------------------------------------------------- de acht rijen

   Volgorde: van hard gemeten naar lexicaal vermoed, zodat wie stopt met lezen
   de stevigste regels heeft gezien. */

const RIJEN = [
  {
    id: 'kantoorcode',
    vraag: 'Iemand heeft de gedeelde kantoorcode. Houdt RTG stand?',
    meet(b) {
      if (!b.kantoormacht.ok) return { uitkomst: 'onbekend', graad: 'onbekend', grond: b.kantoormacht.reden };
      const g = b.kantoormacht.data.gemeten || {};
      const vierogen = ((b.kantoormacht.data.machinerie || {}).vierogen || {}).aanKantoorroute;
      const gedeeld = g.deurGedeeld;
      if (typeof gedeeld !== 'number' || typeof vierogen !== 'number') {
        return { uitkomst: 'onbekend', graad: 'onbekend',
          grond: 'KANTOORMACHT.json mist deurGedeeld of machinerie.vierogen' };
      }
      const zwaarOpen = g.zwaarZonderMens;
      if (typeof zwaarOpen !== 'number') {
        return { uitkomst: 'onbekend', graad: 'onbekend',
          grond: 'KANTOORMACHT.json mist zwaarZonderMens; draai npm run kantoormacht:vast' };
      }
      const grond = gedeeld + ' van ' + g.routes + ' kantoorroutes hangen achter de gedeelde code; ' +
        'van de ' + g.zwaar + ' die geld bewegen, rechten verlenen of bulk uitvoeren staan er ' +
        zwaarOpen + ' zonder mens op naam, en ' + vierogen + ' kantoorroutes vragen een tweede ' +
        'handtekening (KANTOORMACHT.json)';
      /* DE LADDER, EN WAAROM `deels` NIET AAN VIEROGEN HANGT. De eerste versie
         zei `deels` zodra er ergens een tweede handtekening stond -- dan zou een
         enkele route de hele rij optillen, en dat is precies het soort
         getalbeweging waar dit huis niet in gelooft. De vraag van deze rij is of
         een gestolen code iets ONOMKEERBAARS kan; het antwoord daarop is het
         aantal zware routes zonder mens, en niet het aantal gedeelde deuren
         (het meeste kantoorwerk is dagelijks werk en hoort met de code te kunnen). */
      if (gedeeld === 0) return { uitkomst: 'ja', graad: 'gemeten', grond };
      if (zwaarOpen === 0) return { uitkomst: 'deels', graad: 'vermoed', grond };
      return { uitkomst: 'nee', graad: 'gemeten', grond };
    },
    nietGemeten: 'wat een gestolen code in de PRAKTIJK oplevert -- dat hangt af van welke 460 routes ' +
      'het zijn, en er is geen risicomodule die dat weegt (KANTOORMACHT.md par. 3)'
  },
  {
    id: 'document',
    vraag: 'Er staat een opdracht verstopt in een document dat de AI leest. Houdt RTG stand?',
    meet(b) {
      if (!b.lusstap.ok) return { uitkomst: 'onbekend', graad: 'onbekend', grond: b.lusstap.reden };
      /* De BRON en niet de omgeving van deze machine: dat deze laptop de vlag
         niet zet, zegt niets over productie. Wat de bron zegt is of er een vlag
         VOOR staat -- en zolang die er staat, is de poort standaard uit. */
      const achterVlag = /RTG_HERKOMST_AFDWINGEN/.test(b.lusstap.tekst);
      const poortHangt = /magMetHerkomst/.test(b.lusstap.tekst);
      const proef = b.isolatieproef.ok
        ? (((b.isolatieproef.data.noemers || {}).herkomst || {}).handhaaft || {})
        : null;
      if (!poortHangt) {
        return { uitkomst: 'onbekend', graad: 'onbekend',
          grond: 'de herkomstpoort is niet meer te vinden in kern/stuur/lusstap.js' };
      }
      if (proef && proef.bijt === true) {
        return { uitkomst: 'ja', graad: 'gemeten',
          grond: 'de herkomstpoort hangt voor de uitvoering en BIJT (ISOLATIEPROEF.json)' };
      }
      return { uitkomst: 'nee', graad: 'gemeten',
        grond: 'de poort hangt voor de uitvoering maar telt alleen' +
          (achterVlag ? ' -- hij bijt pas met RTG_HERKOMST_AFDWINGEN=1' : '') +
          ' (kern/stuur/lusstap.js, ISOLATIEPROEF.json bijt=false)' };
    },
    nietGemeten: 'de dekking van de kanaallabels: van de 13 kanalen in kern/isolatie/herkomst.js meldt ' +
      'er vandaag een zich aan, en die telling zit in ISOLATIEPROEF.json en niet in deze rij'
  },
  {
    id: 'apparaat',
    vraag: 'Het toestel van een lid of medewerker is overgenomen. Houdt RTG stand?',
    meet(b) {
      if (!b.ceremonieEisen.ok) return { uitkomst: 'onbekend', graad: 'onbekend', grond: b.ceremonieEisen.reden };
      const t = b.ceremonieEisen.tekst;
      /* ALLEEN DE EIGEN ENTRY. De eerste versie sneed hier 600 tekens vanaf
         `apparaat:` en liep hij dus door in `wachttijd` en `tweedePaarOgen` --
         die staan allebei op `uitgevoerd: true`, en de rij meldde vrolijk dat
         het toestel wordt gecontroleerd. Een probe die zijn buren meeleest,
         geeft de uitslag van de buren. De entry heeft geen genest accolade-paar,
         dus de eerste sluitaccolade is de zijne. */
      const stap = t.match(/apparaat:\s*\{([\s\S]*?)\}/);
      const apparaatStap = stap && stap[1];
      if (!apparaatStap) {
        return { uitkomst: 'onbekend', graad: 'onbekend',
          grond: 'de ceremoniestap `apparaat` staat niet meer in kern/isolatie/ceremonie-eisen.js' };
      }
      const gecontroleerd = /uitgevoerd:\s*true/.test(apparaatStap);
      if (gecontroleerd) {
        return { uitkomst: 'deels', graad: 'gemeten',
          grond: 'de ceremoniestap `apparaat` wordt gecontroleerd (kern/isolatie/ceremonie-eisen.js)' };
      }
      return { uitkomst: 'onbekend', graad: 'gemeten',
        grond: 'de ceremoniestap `apparaat` draagt `uitgevoerd: false` met de reden erbij: er is geen ' +
          'register van vertrouwde toestellen, dus de stap wordt afgetekend en niet gecontroleerd' };
    },
    nietGemeten: 'wat een webapp uberhaupt over een toestel KAN weten. OS-integriteit, patchstand en ' +
      'jailbreak-signalen zijn niet bereikbaar; een ladder die ze belooft, liegt (WEERBAARHEID.md grens 3)'
  },
  {
    id: 'medewerker',
    vraag: 'Een medewerker handelt te kwader trouw, in zijn eentje. Houdt RTG stand?',
    meet(b) {
      if (!b.kantoormacht.ok) return { uitkomst: 'onbekend', graad: 'onbekend', grond: b.kantoormacht.reden };
      const m = b.kantoormacht.data.machinerie || {};
      const vierogen = (m.vierogen || {}).aanKantoorroute;
      const voornemen = (m.voornemen || {}).aanKantoorroute;
      if (typeof vierogen !== 'number') {
        return { uitkomst: 'onbekend', graad: 'onbekend', grond: 'KANTOORMACHT.json mist machinerie.vierogen' };
      }
      const ceremonie = b.ceremonieEisen.ok && /tweedePaarOgen/.test(b.ceremonieEisen.tekst);
      const grond = vierogen + ' kantoorroutes vragen een tweede handtekening en ' + voornemen +
        ' hangen aan een keurbaar voornemen (KANTOORMACHT.json)' +
        (ceremonie ? '; de ontsluitceremonie kent wel een tweede paar ogen' : '');
      if (vierogen > 0) return { uitkomst: 'deels', graad: 'gemeten', grond };
      return { uitkomst: 'nee', graad: 'gemeten', grond };
    },
    nietGemeten: 'welke handeling vier ogen VERDIENT is een besluit en geen meting -- KANTOORMACHT.json ' +
      'zegt dat met zoveel woorden onder `ongemeten.vierOgenVereist`'
  },
  {
    id: 'ai',
    vraag: 'De AI is gemanipuleerd of zijn sessie is gekaapt. Houdt RTG stand?',
    meet(b) {
      if (!b.goedkeuring.ok) return { uitkomst: 'onbekend', graad: 'onbekend', grond: b.goedkeuring.reden };
      /* Twee dingen moeten allebei waar zijn: het model kan zijn eigen
         goedkeuring niet fabriceren, en de bewijspoort houdt werkelijk iets
         tegen. Het eerste staat; het tweede hangt aan een register dat vandaag
         nul geschorste capabilities telt -- en een poort die niets uitsluit,
         sluit niets uit. */
      /* TWEE BESTANDEN, WANT DE INVARIANT WOONT IN TWEE HELFTEN. goedkeuring.js
         zet pad en body server-side vast en verbruikt het token eenmalig;
         bevestiging.js draagt het Symbol dat niet uit JSON of een modelantwoord
         te maken is. De eerste versie zocht het Symbol in goedkeuring.js, vond
         het niet, en meldde dat de goedkeuring te vervalsen was -- een valse
         `nee`, en die is even schadelijk als een valse `ja`. */
      const eenmalig = /crypto\.randomBytes/.test(b.goedkeuring.tekst) && /open\.delete/.test(b.goedkeuring.tekst);
      const symbool = b.bevestiging.ok && /Symbol/.test(b.bevestiging.tekst);
      const nietTeVervalsen = eenmalig && symbool;
      if (!b.vertrouwen.ok) {
        return { uitkomst: 'onbekend', graad: 'onbekend', grond: b.vertrouwen.reden };
      }
      const geschorst = ((b.vertrouwen.data.telling || {}).geschorst);
      const grond = 'de allowlist is standaard dicht en de goedkeuring is ' +
        (nietTeVervalsen ? 'niet door een model te fabriceren' : 'NIET meer aantoonbaar onvervalsbaar') +
        '; de bewijspoort laat vandaag ' + geschorst + ' capabilities vallen (VERTROUWEN.json)';
      if (!nietTeVervalsen) return { uitkomst: 'nee', graad: 'gemeten', grond };
      if (geschorst > 0) return { uitkomst: 'ja', graad: 'gemeten', grond };
      return { uitkomst: 'deels', graad: 'gemeten', grond };
    },
    nietGemeten: 'wat de AI met de paden die hij WEL mag kan aanrichten; dat is de vraag van ' +
      'kern/stuur/gevolg.js en die staat op 96 van 176 paden `onbekend`'
  },
  {
    id: 'wachtwoord',
    vraag: 'Het wachtwoord van een lid is uitgelekt. Houdt RTG stand?',
    meet(b) {
      if (!b.webauthnActies.ok) return { uitkomst: 'onbekend', graad: 'onbekend', grond: b.webauthnActies.reden };
      /* Hoeveel handelingen staan achter een VERSE passkey -- bezit dat je niet
         kunt doorvertellen. Geteld op de lijst zelf, zodat het getal meebeweegt
         als er een handeling bij komt. */
      /* HET BLOK ZELF, en niet de hele bron. Er stond hier een regexp op
         `'naam':` die nergens op paste (de lijst is een array, geen object) en
         dus nul gaf -- en nul las als "geen enkele zware handeling staat achter
         een passkey". Nu wordt het blok ZWARE_ACTIES afgebakend en daarbinnen
         geteld, zodat het getal meebeweegt als er een handeling bij komt. */
      const blok = b.webauthnActies.tekst.match(/const ZWARE_ACTIES = Object\.freeze\(\[([\s\S]*?)\]\)/);
      const zwaar = blok ? (blok[1].match(/'[^']+'/g) || []).length : 0;
      const grond = zwaar + ' zware handelingen staan achter een verse passkey (kern/webauthn-acties.js); ' +
        'daarbuiten is een wachtwoord genoeg voor wat het lid zelf mag';
      if (zwaar === 0) return { uitkomst: 'nee', graad: 'gemeten', grond };
      return { uitkomst: 'deels', graad: 'gemeten', grond };
    },
    nietGemeten: 'of die zware lijst de JUISTE handelingen bevat. Deze rij telt hoeveel er staan; ' +
      'welke handelingen het horen te zijn, is een besluit en geen meting'
  },
  {
    id: 'sessie',
    vraag: 'Een sessietoken is gestolen. Houdt RTG stand?',
    meet(b) {
      if (!b.identiteitVertrouwen.ok) {
        return { uitkomst: 'onbekend', graad: 'onbekend', grond: b.identiteitVertrouwen.reden };
      }
      const binding = /gebonden:/.test(b.identiteitVertrouwen.tekst);
      const intrekking = b.intrekking.ok;
      if (!binding) {
        return { uitkomst: 'nee', graad: 'gemeten',
          grond: 'de stand `gebonden` bestaat niet meer in kern/identiteit/vertrouwen.js: een gestolen ' +
            'token hangt dan aan geen enkele sleutel' };
      }
      return { uitkomst: 'deels', graad: 'vermoed',
        grond: 'de stand `gebonden` bestaat (een gestolen token alleen levert dan niets op) en ' +
          (intrekking ? 'intrekking wint van eerder verleend vertrouwen (pgaccounts-intrekking.js)'
                      : 'er is GEEN intrekkingsweg gevonden') +
          '; hoeveel sessies die stand werkelijk halen, is nergens geteld' };
    },
    nietGemeten: 'het aandeel sessies dat `gebonden` haalt. De stand wordt met opzet niet opgeslagen ' +
      '(kern/identiteit/vertrouwen.js), dus er is niets om achteraf te tellen -- dat is een besluit ' +
      'en geen gat, maar het betekent wel dat deze rij over de VORM gaat en niet over de praktijk'
  },
  {
    id: 'dienst',
    vraag: 'Een interne dienst of een sleutel in de omgeving is gecompromitteerd. Houdt RTG stand?',
    meet(b) {
      /* HIER IS EEN EERSTE LEZING FOUT GEGAAN, en dat hoort in de meter te
         staan en niet alleen in een commit. Een grep op "mTLS|spiffe|workload"
         gaf een treffer die als ruis werd gelezen, en de conclusie werd "nul
         treffers, interne herkomst is aangenomen". Dat was onwaar: er staat een
         eigen interne CA (server/lib/ca.js) en de TLS-laag ondersteunt
         wederzijdse TLS. De vraag is dus niet of het bestaat maar of het AAN
         staat -- en dat is iets wat je moet nakijken in plaats van greppen. */
      if (!b.tls.ok || !b.ca.ok) {
        return { uitkomst: 'onbekend', graad: 'onbekend',
          grond: (b.tls.reden || b.ca.reden) + ' -- zonder die bron is over interne herkomst niets te zeggen' };
      }
      const ondersteunt = /requestCert/.test(b.tls.tekst) && /rejectUnauthorized/.test(b.tls.tekst);
      if (!ondersteunt) {
        return { uitkomst: 'onbekend', graad: 'gemeten',
          grond: 'server/lib/tls.js kent geen requestCert meer; de mTLS-tak is weg' };
      }
      /* Wordt hij ook bedraad? De webdeur is de enige plek die de TLS-server
         opzet, en zij geeft geen opties mee -- dus daar wordt geen
         clientcertificaat gevraagd. Andere componenten (zaakdoos, noodserver)
         zijn hier niet gemeten; vandaar `deels` en niet `nee`. */
      const webDeurMetCa = b.webIndex.ok && /maakServer\(app,/.test(b.webIndex.tekst);
      const grond = 'er is een eigen interne CA (server/lib/ca.js) en server/lib/tls.js doet mTLS, ' +
        'maar de webdeur roept ' + (webDeurMetCa ? 'maakServer MET opties aan' : 'maakServer(app) ZONDER ca aan') +
        ' (server/web/index.js), dus daar wordt ' + (webDeurMetCa ? 'wel' : 'geen') + ' clientcertificaat gevraagd';
      /* EEN UITKOMST, WANT HET VERSCHIL ZIT IN DE GROND. Ook mét een bedrade
         webdeur blijft dit `deels`: een van de vier ingangen is geen dekking.
         Een if met twee gelijke takken zou suggereren dat hij ooit iets anders
         doet. */
      return { uitkomst: 'deels', graad: 'gemeten', grond };
    },
    nietGemeten: 'of de zaakdoos, de noodserver en losse instances hun mTLS wel bedraden -- die starten ' +
      'niet via server/web/index.js en zijn hier niet nagelopen. En kortlevende werklastidentiteit ' +
      '(een dienst die per keer bewijst wie hij is) bestaat hier niet: een certificaat is een ' +
      'langlevende identiteit'
  }
];

/* -------------------------------------------------------------------- meten */

function meet(b) {
  const rijen = RIJEN.map(r => {
    const uit = r.meet(b);
    if (!UITSLAGEN.includes(uit.uitkomst)) {
      throw new Error('overleving: rij "' + r.id + '" gaf de onbekende uitslag "' + uit.uitkomst + '"');
    }
    return { id: r.id, vraag: r.vraag, uitkomst: uit.uitkomst, graad: uit.graad,
      grond: uit.grond, nietGemeten: r.nietGemeten };
  });
  const tel = u => rijen.filter(r => r.uitkomst === u).length;
  return {
    soort: 'meting',
    uitleg: 'Single Compromise Survivability (WEERBAARHEID.md par. 4): als er EEN ding wordt ' +
      'overgenomen, houdt RTG dan stand? Acht scenario\'s, elk met een bron, een bewijsgraad en wat ' +
      'de rij NIET dekt. Met opzet geen samengesteld cijfer.',
    grens: '`onbekend` is een eersteklas uitslag en betekent nooit "waarschijnlijk goed". Elke rij ' +
      'leest een echte bron; ontbreekt die, dan wordt de rij `onbekend` met de reden en niet stil een ' +
      'middenwaarde. De rijen `sessie` en `dienst` dragen `vermoed`: die gaan over een VORM in de code ' +
      'en niet over wat er in productie gebeurt.',
    stempel: stempel(),
    telling: { ja: tel('ja'), deels: tel('deels'), nee: tel('nee'), onbekend: tel('onbekend'), rijen: rijen.length },
    kroonjuwelen: 'geld bewegen, identiteit wijzigen, de kluis lezen, bulk exporteren. Voor die vier ' +
      'hoort elke rij hieronder op `ja` te staan.',
    rijen
  };
}

/* ---------------------------------------------------------------- zelfijking

   Voedt de kantoorcode-rij een vervalste bron waarin het probleem is opgelost,
   en eist dat de uitslag meebeweegt. Zonder deze proef zou een rij die zijn
   bron nooit echt leest -- een ingetypte `nee` -- er precies zo uitzien. */

function zelfijking(basis) {
  /* `basis` is er voor de TOETS en niet voor de CLI. Zonder injecteerbare
     bronnen is deze functie zelf niet te beproeven: een `bewoog` die altijd
     true teruggeeft ziet er op de echte boom precies zo uit als een die rekent.
     Met een basis waarin het probleem al is opgelost, HOORT hij false te zeggen
     -- en dat is het enige geval dat een liegende ijking ontmaskert. */
  const echt = basis || bronnen();
  const nu = meet(echt);
  const kantoorNu = nu.rijen.find(r => r.id === 'kantoorcode');

  const vervalst = JSON.parse(JSON.stringify({
    gemeten: { routes: 586, deurGedeeld: 0, deurEistMens: 586, zwaar: 17, zwaarZonderMens: 0 },
    machinerie: { vierogen: { aanKantoorroute: 12 }, voornemen: { aanKantoorroute: 12 } }
  }));
  const nep = Object.assign({}, echt, { kantoormacht: { ok: true, data: vervalst, naam: 'verzonnen' } });
  const kantoorNep = meet(nep).rijen.find(r => r.id === 'kantoorcode');

  const bewoog = kantoorNu.uitkomst !== kantoorNep.uitkomst;
  return { bewoog, echt: kantoorNu.uitkomst, vervalst: kantoorNep.uitkomst, verwacht: 'ja' };
}

/* -------------------------------------------------------------------- tonen */

const K = { groen: '\x1b[32m', rood: '\x1b[31m', geel: '\x1b[33m', grijs: '\x1b[90m', vet: '\x1b[1m', uit: '\x1b[0m' };
const KLEUR = { ja: K.groen, deels: K.geel, nee: K.rood, onbekend: K.grijs };

function toon(u) {
  console.log('\n' + K.vet + 'DE OVERLEVINGSMETER' + K.uit + K.grijs +
    ' -- als er EEN ding wordt overgenomen, houdt RTG dan stand?' + K.uit + '\n');
  for (const r of u.rijen) {
    console.log('  ' + KLEUR[r.uitkomst] + r.uitkomst.toUpperCase().padEnd(9) + K.uit +
      r.vraag + K.grijs + '  [' + r.graad + ']' + K.uit);
    console.log('    ' + K.grijs + r.grond + K.uit);
    console.log('    ' + K.grijs + 'niet gemeten: ' + r.nietGemeten + K.uit + '\n');
  }
  const t = u.telling;
  console.log('  ' + K.groen + t.ja + ' ja' + K.uit + K.grijs + ' · ' + K.uit +
    K.geel + t.deels + ' deels' + K.uit + K.grijs + ' · ' + K.uit +
    K.rood + t.nee + ' nee' + K.uit + K.grijs + ' · ' + K.uit +
    K.grijs + t.onbekend + ' onbekend' + K.uit +
    K.grijs + '   (geen samengesteld cijfer, met opzet)' + K.uit);
  console.log('  ' + K.grijs + u.kroonjuwelen + K.uit);
}

function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--zelfijking')) {
    const ij = zelfijking();
    if (!ij.bewoog) {
      console.error('\nGEZAKT op de eigen ijking: de kantoorcode-rij gaf "' + ij.echt +
        '" en gaf op een vervalste bron opnieuw "' + ij.vervalst + '". Deze rij leest zijn bron niet.');
      process.exitCode = 1; return;
    }
    console.log('\n  ijking in orde: de kantoorcode-rij ging van "' + ij.echt + '" naar "' +
      ij.vervalst + '" op een vervalste bron. De meter leest werkelijk.');
    return;
  }

  const u = meet(bronnen());

  if (argv.includes('--json')) { console.log(JSON.stringify(u, null, 2)); return; }
  toon(u);

  if (argv.includes('--vastleggen')) {
    fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
    console.log('\n  vastgelegd in OVERLEVING.json');
    return;
  }

  /* DRIE RATELS, en de derde is de belangrijkste: zonder hem is een bron
     weghalen de goedkoopste manier om een `nee` te laten verdwijnen. */
  if (argv.includes('--controle')) {
    let oud;
    try { oud = JSON.parse(fs.readFileSync(DOEL, 'utf8')); }
    catch (e) {
      console.error('\nGEZAKT: OVERLEVING.json ontbreekt. Draai eerst --vastleggen.');
      process.exitCode = 1; return;
    }
    const gezakt = [];
    if (u.telling.ja < oud.telling.ja) {
      gezakt.push('overleefde scenario\'s ' + oud.telling.ja + ' -> ' + u.telling.ja + ' (mag alleen stijgen)');
    }
    if (u.telling.nee > oud.telling.nee) {
      gezakt.push('scenario\'s die RTG niet overleeft ' + oud.telling.nee + ' -> ' + u.telling.nee +
        ' (mag alleen dalen)');
    }
    if (u.telling.onbekend > oud.telling.onbekend) {
      gezakt.push('ongemeten scenario\'s ' + oud.telling.onbekend + ' -> ' + u.telling.onbekend +
        ' (minder meten is geen vooruitgang)');
    }
    if (gezakt.length) {
      console.error('\nGEZAKT:\n  - ' + gezakt.join('\n  - '));
      process.exitCode = 1; return;
    }
    console.log('\n  in orde: ' + u.telling.ja + ' ja, ' + u.telling.nee + ' nee, ' +
      u.telling.onbekend + ' onbekend -- geen enkele teller ging de verkeerde kant op.');
  }
}

if (require.main === module) main();
module.exports = { meet, bronnen, zelfijking, leesRegister, leesBron, RIJEN, UITSLAGEN };
