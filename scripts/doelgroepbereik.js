#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE BEREIKBAARHEIDSMETER -- kan de verklaarde doelgroep de deur werkelijk open?

   DE REGEL DIE HIJ AFDWINGT, en hij is met opzet smaller dan het productbeginsel
   erboven:

       EEN FUNCTIE WAARVAN DE VERKLAARDE DOELGROEP ZIJN EIGEN PADEN NIET KAN
       BEREIKEN, IS EEN LEUGEN IN HET REGISTER.

   Het beginsel waar hij onder hangt luidt: *een capability die een mens
   inhoudelijk kan helpen maar die voor die mens niet bereikbaar is, telt niet
   als beschikbare capability.* Dat is de goede zin om op te sturen en de
   verkeerde om af te dwingen -- "een mens die geholpen KAN worden" is een
   oordeel en geen meting. Wat hier draait is de helft die een machine kan zien:
   het register zegt WIE, en de deur zegt of die WIE er langskomt.

   WAAROM HIJ NODIG WAS. De Adam-keten vond dat /api/knelpunt voor een
   gezinsprofiel niet bereikbaar is. Het register LIEGT daar niet -- het zegt
   netjes `doelgroepen: LEDEN` -- maar dat werd pas duidelijk door de keten met
   de hand te lopen. Zonder meter is "verklaard" en "bereikbaar" hetzelfde woord
   tot iemand toevallig kijkt.

   TWEE RICHTINGEN, EN DE TWEEDE IS NIET DE MINSTE:

     VERKLAARD_MAAR_ONBEREIKBAAR   het register belooft een doelgroep iets wat
                                   die niet kan openen. De harde fout.
     BEREIKBAAR_ZONDER_VERKLARING  een doelgroep komt ergens binnen waar het
                                   register hem niet noemt. Dat kan een gat in
                                   de autorisatie zijn of een gat in het
                                   register -- welke van de twee zegt deze meter
                                   NIET, want dat is een oordeel.

   DRIE DINGEN DIE HEM EERLIJK HOUDEN:

   1. HIJ BEANTWOORDT GEEN PRODUCTVRAAG. Een doelgroep die niet is verklaard en
      niet binnenkomt, heet `correct-afgesloten` -- ook als je vindt dat hij er
      wel bij zou moeten kunnen. Of de RTFoundation toegang krijgt tot de
      knelpuntmotor is een besluit van de eigenaar; deze meter wordt daar pas
      rood van als de doelgroep is TOEGEVOEGD en de deur dicht blijft.
   2. EEN DOELGROEP ZONDER SESSIE IS NIET "ONBEREIKBAAR". Lukt de inlog niet,
      dan heet die cel `sessie-ontbreekt` en telt hij nergens als bevinding.
      Van een kapotte inlog een registerleugen maken, is precies de vorm die
      scripts/tikken.js verbiedt: niet gemeten mag nooit als een uitslag
      langskomen.
   3. EEN PAD ZONDER DEUR IS EEN EIGEN UITSLAG. Is een route ook ANONIEM te
      bereiken, dan zegt hij niets over doelgroepen -- dan is de doelgroeplijst
      een schakelaar en geen slot. Die cellen heten `geen-deur` en niet
      `bereikbaar-zonder-verklaring`, want anders meldt de meter honderden
      "gaten" die alle honderd openbare routes zijn.

   WAT "BEREIKBAAR" HIER BETEKENT. De deur gaat open zodra het antwoord GEEN 401
   of 403 is. Een 400 (rommelig lichaam), een 404 (dit ding bestaat niet) en zelfs
   een 500 tellen als OPEN: de bewaker liet de aanroep door en de handler is
   begonnen. Dat is met opzet de ruime kant -- deze meter moet geen deur dicht
   noemen die het niet is, want dat zou een registerleugen verzinnen.

   WAT HIJ NIET MEET. Of een doelgroep de functie ook zinnig kan GEBRUIKEN: er
   gaat een leeg lichaam heen, dus dit gaat over de deur en niet over de kamer.
   En hij kijkt per FUNCTIE en niet per route: een functie heet bereikbaar zodra
   EEN van zijn paden opengaat. Dat is de conservatieve kant -- een functie
   waarvan negen van de tien routes dicht zitten, is hier geen leugen.

   Draaien:  npm run doelgroepbereik          (print, zakt op een registerleugen)
             npm run doelgroepbereik:vast     (schrijft DOELGROEPBEREIK.json)
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { start } = require('./lib/wegwerpserver');
const { haalDoelgroepen } = require('./lib/doelgroepsessies');
const { alleRoutes, NIET_AANRAKEN } = require('./lib/routes');
const { FUNCTIES, DOELGROEP_IDS } = require('../server/functies/register');
/* Het VOLLE stempel en niet een kale datum: een datum zegt wanneer, niet
   waartegen. Zonder commit en boomVuil is dit register niet na te lopen -- zie
   de kop van lib/stempel.js. */
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'DOELGROEPBEREIK.json');

const MAX_PER_CEL = 8;            // hoeveel routes een cel hoogstens probeert

/* 401 EN 403 ZIJN NIET HETZELFDE SOORT NEE, en dat verschil kostte de eerste
   ronde van deze meter 144 verzonnen registerleugens.

   `POST /api/member/dm` antwoordt een gewoon lid met 403 "Je bent nog niet
   verbonden met deze codenaam". Dat is de HANDLER die iets zegt over de lege
   codenaam in het proeflichaam -- de deur ging gewoon open. Wie 403 plat als
   "dicht" leest, noemt dat een leugen in het register terwijl er niets aan de
   hand is. Dezelfde val staat in de kop van scripts/lib/rolproef.js: een 4xx
   bewijst pas iets over autorisatie als je weet welke laag hem gaf.

   DE UITWEG IS VERGELIJKEN MET ANONIEM. Krijgt deze doelgroep exact hetzelfde
   antwoord als een verzoek zonder enige sessie, dan is hij niet verder gekomen
   -- dezelfde weigering, dus dezelfde deur. Wijkt het antwoord af (andere
   status, of dezelfde status met een andere reden), dan is hij er LANGS en
   praat hij met de handler. Dat is geen heuristiek over woorden maar over het
   VERSCHIL: wat verandert er doordat je een sessie meestuurt. */
const WEIGERSTATUS = new Set([401, 403]);

/* DOELGROEPEN DIE MEER DAN EEN SESSIEVORM DEKKEN, en waarom hun dichte deuren
   geen leugen heten.

   `foundation` is in het register een doelgroep en in de praktijk DRIE deuren:
   "Gezinnen, leerlingen en scholen in de RTF-app". Deze meter draagt er een --
   de beheerder van een gezin. Een leerlingroute die voor die sessie dicht zit,
   zegt dus niets over de leerling, en hem een registerleugen noemen is de
   beschuldiging verzinnen die deze meter juist moet voorkomen.

   Dichte cellen van zo'n doelgroep worden daarom `onbepaald` MET de reden. Dat
   kost dekking en dat is de bedoeling: de eerlijke uitslag van een meter die
   een van de drie deuren kent, is dat hij het over de andere twee niet weet.
   Wie hier de leerling- en schoolsessie bijzet, haalt die cellen terug. */
const MEER_SESSIEVORMEN = {
  foundation: 'deze doelgroep dekt gezinnen, leerlingen EN scholen; de meter draagt alleen een gezinssessie'
};

/* De paden die dit huis met opzet niet laat bekruipen (schakelkast,
   onomkeerbaar). Ze komen uit scripts/lib/routes.js zodat er geen tweede lijst
   ontstaat die uit elkaar loopt. */
const VERBODEN = new Set((NIET_AANRAKEN || []).map((n) => n.pad));

/* Hoort dit pad bij dit voorvoegsel? Zelfde regel als functies/doelgroep.js:
   op een padgrens, zodat /api/member niet ook /api/members vangt. */
function onderVoorvoegsel(pad, prefix) {
  if (!pad.startsWith(prefix)) return false;
  const rest = pad.slice(prefix.length);
  return rest === '' || rest[0] === '/';
}

/* Een pad met :parameters is niet op te vragen zoals het er staat. De invulling
   hoeft NIET te kloppen: een 404 uit de handler betekent nog steeds dat de deur
   openging. Voor :code vullen we wel de echte gezinscode in als we die hebben,
   zodat de foundation-routes verder komen dan hun eerste controle. */
function vulPad(pad, gezinCode) {
  /* join('/') en niet join(''). Die ene ontbrekende schuine streep sloeg elk
     pad plat (/api/member/x werd apimemberx), waarna elke fetch faalde en als
     `onbepaald` terugkwam -- 1736 cellen "niet beproefd", en dat las als een
     uitslag over het huis in plaats van als een kapotte meter. */
  return pad.split('/').map((deel) => {
    if (!deel.startsWith(':')) return deel;
    if (/code/i.test(deel) && gezinCode) return gezinCode;
    return 'proef';
  }).join('/');
}

async function klop(basis, route, drager) {
  const url = basis + vulPad(route.pad, drager && drager.gezinCode);
  const kop = Object.assign({ 'Content-Type': 'application/json' }, (drager && drager.kop) || {});
  const opties = { method: route.methode, headers: kop };
  if (route.methode !== 'GET' && route.methode !== 'HEAD') opties.body = JSON.stringify((drager && drager.lijf) || {});
  const r = await fetch(url, opties).catch(() => null);
  if (!r) return { status: 0, open: false, onbepaald: true };
  /* 429 is geen uitspraak over de deur maar over de snelheid van de proef.
     Hem als dicht tellen zou een registerleugen verzinnen; als open tellen zou
     een gat verzinnen. Dus: onbepaald, en deze route telt niet mee. */
  if (r.status === 429) return { status: 429, open: false, onbepaald: true };
  /* De foutzin hoort bij de meting: zij is het enige waaraan te zien is of een
     403 van de bewaker komt of van de handler. Alleen het `error`-veld, en
     afgekapt -- dit is een vergelijkingssleutel en geen opslag van antwoorden. */
  let reden = '';
  try { const j = await r.clone().json(); reden = String((j && j.error) || '').slice(0, 120); } catch (e) { /* geen json: dan telt alleen de status */ }
  return { status: r.status, reden, onbepaald: false };
}

/* DRIE UITKOMSTEN EN GEEN TWEE, want van buiten is niet altijd te zien WIE er
   weigert. Dat is de tweede fout die deze meter zelf heeft gemaakt.

   De eerste versie las elke 403 als een dichte deur en verzon 144 leugens
   (/api/member/dm weigert een lid met "je bent nog niet verbonden met deze
   codenaam" -- dat is de handler). De tweede versie las elke AFWIJKENDE
   weigering als "langs" en verzon honderden gaten: `auth` antwoordt een
   kantoortoken met "Niet ingelogd als lid." en een anoniem verzoek met "Niet
   ingelogd." -- andere tekst, dezelfde bewaker, nog steeds dicht.

   Beide fouten komen uit dezelfde aanname: dat je van een statuscode kunt
   aflezen welke LAAG hem gaf. Dat kan niet. Dus:

     langs         geen weigering -- de handler heeft geantwoord
     dicht         exact dezelfde weigering als ZONDER sessie. Let op wat dat
                   precies zegt: de sessie van deze doelgroep maakte geen enkel
                   verschil. Meestal is dat een bewaker, maar het kan ook een
                   handler zijn die iedereen gelijk afwijst (/api/bedrijf vraagt
                   een werkruimte in het lichaam en weigert anoniem en zakelijk
                   met dezelfde zin). Sterker dan "de sessie deed er niet toe"
                   is van buiten niet te meten, en dat is precies wat hier staat.
     onbepaald     een ANDERE weigering. Dat kan de handler zijn (langs) of een
                   tweede bewaker (dicht), en van buiten is dat niet te scheiden

   `onbepaald` is hier een eersteklas uitslag naast de andere twee (BESTUUR.md),
   en hij telt NERGENS als bevinding. Een meter die moet kiezen tussen een
   verzonnen leugen en een verzonnen gat, hoort te zeggen dat hij het niet weet. */
const LANGS = 'langs', DICHT = 'dicht', ONBEPAALD = 'onbepaald';
function deurstand(antwoord, anoniemAntwoord) {
  if (!WEIGERSTATUS.has(antwoord.status)) return LANGS;
  if (!anoniemAntwoord || anoniemAntwoord.onbepaald) return ONBEPAALD;
  if (anoniemAntwoord.status === antwoord.status && anoniemAntwoord.reden === antwoord.reden) return DICHT;
  return ONBEPAALD;
}

async function meet() {
  const uit = {
    stempel: stempel(),
    uitleg: 'Per functie uit het functieregister en per doelgroep: is die doelgroep VERKLAARD, en kan hij de ' +
      'paden van de functie werkelijk bereiken met een echte sessie? De regel die dit afdwingt: een functie ' +
      'waarvan de verklaarde doelgroep zijn eigen paden niet kan bereiken, is een leugen in het register.',
    grens: 'Dit meet de DEUR en niet de kamer: er gaat een leeg lichaam heen, dus of een doelgroep de functie ' +
      'ook zinnig kan gebruiken staat hier niet. Een functie heet bereikbaar zodra EEN van zijn paden opengaat ' +
      '-- negen dichte routes naast een open route zijn hier geen leugen. `dicht` betekent bovendien precies een ' +
      'ding: de sessie van deze doelgroep maakte geen enkel verschil met een anoniem verzoek. Dat is meestal een ' +
      'bewaker en soms een handler die iedereen gelijk afwijst; sterker is van buiten niet te meten. Een doelgroep ' +
      'met meer dan een sessievorm (foundation dekt gezin, leerling en school) krijgt daarom nooit een leugen maar ' +
      'een `onbepaald` met de reden. En hij beantwoordt geen productvraag: ' +
      'een doelgroep die niet is verklaard en niet binnenkomt heet `correct-afgesloten`, ook als iemand vindt ' +
      'dat hij erbij zou moeten kunnen. Dat is een besluit van de eigenaar en geen meetuitslag.',
    doelgroepen: DOELGROEP_IDS, sessies: {}, overgeslagen: [], cellen: [], telling: null
  };

  const srv = await start({ naam: 'bereikbaar', gereed: 'ready',
    env: { NODE_ENV: 'test', RTG_DEMO: '1', OFFICE_CODE: 'RTG-OFFICE' } });
  try {
    const { sessies, overgeslagen } = await haalDoelgroepen(srv.basis);
    uit.overgeslagen = overgeslagen;
    for (const [naam, s] of Object.entries(sessies)) uit.sessies[naam] = s.uitleg;

    /* De dragers een keer klaarzetten; `draag()` geeft per doelgroep de kop en
       het lichaam waarmee hij zich aanmeldt. */
    const dragers = {};
    for (const [naam, s] of Object.entries(sessies)) {
      const d = s.draag();
      dragers[naam] = { kop: d.kop, lijf: d.lijf, gezinCode: d.lijf && d.lijf.code };
    }

    const routes = alleRoutes().filter((r) => r.pad.startsWith('/api/') && !VERBODEN.has(r.pad));
    uit.routesGezien = routes.length;

    /* De anonieme klop een keer per route, en gedeeld door alle cellen. Hij doet
       hier TWEE dingen: hij zegt of er uberhaupt een deur is, en hij is de
       meetlat waartegen elke weigering wordt gehouden (zie kwamLangs). */
    const anoniem = new Map();
    const anoniemVoor = async (r) => {
      const sleutel = r.methode + ' ' + r.pad;
      if (!anoniem.has(sleutel)) anoniem.set(sleutel, await klop(srv.basis, r, null));
      return anoniem.get(sleutel);
    };
    const heeftDeur = (an) => !!an && !an.onbepaald && WEIGERSTATUS.has(an.status);

    for (const f of FUNCTIES) {
      const paden = Array.isArray(f.paden) ? f.paden : [];
      const mijn = routes.filter((r) => paden.some((p) => onderVoorvoegsel(r.pad, p))).slice(0, MAX_PER_CEL);

      for (const d of DOELGROEP_IDS) {
        const verklaard = (f.doelgroepen || []).includes(d);
        const cel = { functie: f.id, naam: f.naam, doelgroep: d, verklaard, routes: mijn.length };

        if (!dragers[d]) { cel.uitslag = 'sessie-ontbreekt'; uit.cellen.push(cel); continue; }
        if (!mijn.length) {
          cel.uitslag = 'niet-beproefd';
          cel.reden = paden.length ? 'geen enkele route van dit huis valt onder ' + paden.join(', ') +
            ' (of ze staan op de niet-aanraken-lijst)' : 'de functie noemt geen paden';
          uit.cellen.push(cel); continue;
        }

        let open = null, openMetDeur = null, gezien = 0, twijfel = 0;
        for (const r of mijn) {
          const a = await klop(srv.basis, r, dragers[d]);
          if (a.onbepaald) continue;
          gezien++;
          const an = await anoniemVoor(r);
          const stand = deurstand(a, an);
          if (stand === ONBEPAALD) { twijfel++; continue; }
          if (stand === DICHT) continue;
          open = r.methode + ' ' + r.pad;
          if (heeftDeur(an)) { openMetDeur = open; break; }   // langs een echte deur is het sterkste bewijs
        }
        cel.beproefd = gezien;
        cel.onbepaaldeRoutes = twijfel;
        cel.open = open;

        if (!gezien) { cel.uitslag = 'niet-beproefd'; cel.reden = 'elke poging gaf een onbepaald antwoord (rem of netwerk)'; }
        else if (open) cel.uitslag = verklaard ? 'waar' : (openMetDeur ? 'bereikbaar-zonder-verklaring' : 'geen-deur');
        /* GEEN ENKELE ROUTE OPEN, MAAR WEL TWIJFEL: dan is dit geen uitspraak.
           Een cel die nergens duidelijk langskwam en wel dubbelzinnige
           weigeringen zag, kan net zo goed binnen zijn als buiten -- en een
           registerleugen melden op zo'n cel is de beschuldiging verzinnen die
           deze meter juist moet voorkomen. */
        else if (twijfel) { cel.uitslag = 'onbepaald'; cel.reden = twijfel + ' van de ' + gezien + ' routes weigerden anders dan anoniem; van buiten niet te zien of dat de bewaker was of de handler'; }
        else if (MEER_SESSIEVORMEN[d]) { cel.uitslag = 'onbepaald'; cel.reden = MEER_SESSIEVORMEN[d]; }
        else cel.uitslag = verklaard ? 'registerleugen' : 'correct-afgesloten';
        uit.cellen.push(cel);
      }
    }
  } finally { srv.klaar(); }

  const t = { cellen: uit.cellen.length, waar: 0, 'correct-afgesloten': 0, registerleugen: 0,
    'bereikbaar-zonder-verklaring': 0, 'geen-deur': 0, onbepaald: 0, 'niet-beproefd': 0, 'sessie-ontbreekt': 0 };
  for (const c of uit.cellen) t[c.uitslag]++;
  uit.telling = t;
  uit.leugens = uit.cellen.filter((c) => c.uitslag === 'registerleugen');
  uit.zonderVerklaring = uit.cellen.filter((c) => c.uitslag === 'bereikbaar-zonder-verklaring');
  /* Twee getallen en geen samengesteld cijfer. `klopt` gaat alleen over de harde
     fout; de andere richting is een triagelijst en geen defect, en die twee bij
     elkaar optellen zou van een vraag een uitslag maken. */
  uit.klopt = t.registerleugen === 0 && uit.overgeslagen.length === 0;
  return uit;
}

function druk(u) {
  const t = u.telling;
  console.log('\nDE BEREIKBAARHEIDSMETER -- ' + t.cellen + ' cellen (functie x doelgroep) over ' +
    u.routesGezien + ' routes\n');
  console.log('  waar (verklaard en bereikbaar)      ' + String(t.waar).padStart(5));
  console.log('  correct afgesloten                  ' + String(t['correct-afgesloten']).padStart(5));
  console.log('  geen deur (ook anoniem bereikbaar)  ' + String(t['geen-deur']).padStart(5));
  console.log('  onbepaald (wie weigerde: onbekend)  ' + String(t.onbepaald).padStart(5));
  console.log('  niet beproefd (met reden)           ' + String(t['niet-beproefd']).padStart(5));
  console.log('  sessie ontbreekt                    ' + String(t['sessie-ontbreekt']).padStart(5));
  console.log('  \x1b[33mbereikbaar zonder verklaring        ' + String(t['bereikbaar-zonder-verklaring']).padStart(5) + '\x1b[0m');
  console.log('  \x1b[31mREGISTERLEUGEN                      ' + String(t.registerleugen).padStart(5) + '\x1b[0m');
  if (u.overgeslagen.length) {
    console.log('\n  DOELGROEPEN ZONDER SESSIE (niet gemeten, en dus niet in orde):');
    for (const o of u.overgeslagen) console.log('    ' + o.doelgroep + ': ' + o.reden);
  }
  if (u.leugens.length) {
    console.log('\n  HET REGISTER BELOOFT WAT DE DEUR NIET GEEFT:');
    for (const c of u.leugens.slice(0, 25))
      console.log('    ' + c.doelgroep.padEnd(12) + c.functie.padEnd(22) + c.naam + '  (' + c.beproefd + ' routes geprobeerd)');
  }
  if (u.zonderVerklaring.length) {
    console.log('\n  BINNEN ZONDER IN HET REGISTER TE STAAN (triage, geen defect):');
    for (const c of u.zonderVerklaring.slice(0, 25))
      console.log('    ' + c.doelgroep.padEnd(12) + c.functie.padEnd(22) + (c.open || ''));
    if (u.zonderVerklaring.length > 25) console.log('    ... en nog ' + (u.zonderVerklaring.length - 25));
  }
  console.log(u.klopt ? '\nGeen registerleugens.' : '\nHET REGISTER KLOPT NIET MET DE DEUREN.');
}

module.exports = { meet, DOEL };

if (require.main === module) {
  meet().then((u) => {
    if (process.argv.includes('--json')) { console.log(JSON.stringify(u)); process.exitCode = u.klopt ? 0 : 1; return; }
    druk(u);
    if (process.argv.includes('--vastleggen')) {
      fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
      console.log('geschreven: DOELGROEPBEREIK.json');
    }
    process.exit(u.klopt ? 0 : 1);
  }).catch((e) => { console.error('de bereikbaarheidsmeter kon niet draaien: ' + ((e && e.message) || e)); process.exit(1); });
}
