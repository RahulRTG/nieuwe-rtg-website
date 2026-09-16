#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE HERBOUWPROEF -- IS EEN AFGELEID ARTEFACT EEN HERBOUWPLICHT?

   AFGELEID.json zegt WIE een artefact mag afleiden. Dat is een eigenaarschap,
   geen bewijs. Deze proef stelt de vraag erachter: draai die eigenaar, en komt
   er dan hetzelfde uit?

   HET VERSCHIL DAT DIT OPENT. Een afgeleid artefact dat aantoonbaar herbouwd
   kan worden, is bij een samenvoeging geen conflict maar een HERBOUWPLICHT: je
   neemt geen van beide kanten over, je draait de generator. Een artefact
   waarvan dat NIET vaststaat, moet met de hand worden samengevoegd -- en dan
   ontstaat er een waarheid die geen enkele bron heeft geproduceerd. Bij de
   samenvoeging van 15 september 2026 gold dat voor achttien artefacten
   tegelijk.

   ==== WAAROM DE OPDRACHT WORDT AFGELEID EN NIET VERKLAARD ====

   Er komt hier geen vierde lijst bij (zelfde regel als in scripts/afgeleid.js).
   De aanroep wordt gezocht in deze volgorde, en de HERKOMST staat per artefact
   in de uitslag:

     versheid    scripts/versheid.js REGISTERS noemt per register de opdracht
                 die hem schrijft. Dat is een VERKLARING van een mens en wint.
     package.json  de npm-opdracht die de eigenaar aanroept. Bestaat er een
                 variant die vastlegt (--vastleggen, :vast, :vastleggen), dan
                 die; een --controle- of --toon-variant nooit, want die is met
                 opzet leesloos.
     eigenaar    geen van beide: dan `node <eigenaar>`, want de eigenaar IS het
                 script.

   ==== VIJF UITSLAGEN, EN TWEE ERVAN ZIJN GEEN OORDEEL OVER HET ARTEFACT ====

     gelijk         byte voor byte hetzelfde. Volledig reproduceerbaar.
     alleenStempel  alleen het stempel verschilt (tijd, commit, boomstand). Dat
                    is de normale uitslag voor een gezond register: de INHOUD is
                    reproduceerbaar en het stempel is per definitie een
                    momentopname. Deze twee worden nooit opgeteld -- "gelijk"
                    zou anders betekenen dat een generator zijn eigen meetmoment
                    niet opschrijft, en dat is geen betere eigenschap.
     verschilt      de inhoud kwam anders terug. Dat is een BEVINDING en geen
                    fout van de proef: of de generator is niet deterministisch,
                    of het ingecheckte artefact loopt achter op de bron.
     nietGeschreven de opdracht liep, maar het bestand is niet aangeraakt. Dan
                    zegt "gelijk" niets -- er is niets herbouwd. Dit is de
                    besturingsproef: een instrument dat niet kan uitslaan, is
                    geen instrument.
     nietGedraaid   de opdracht kon hier niet draaien (te langzaam, een fout, of
                    hij vraagt iets dat deze machine niet heeft), MET de reden.

   ==== DE PROEF LAAT NIETS ACHTER, EN DAT WORDT NAGEKEKEN ====

   Elke generator schrijft in de werkboom. De proef begint daarom alleen op een
   schone boom, legt na elke opdracht elk gewijzigd tracked bestand terug, en
   controleert aan het EIND dat de boom weer schoon is. LET OP WAT DAT BETEKENT
   VOOR JEZELF: terwijl hij draait moet je NIETS in de boom veranderen -- dat
   terugleggen kent geen onderscheid tussen de uitvoer van een generator en jouw
   werk, en gooit allebei weg. (Hier woordelijk verdiend: een halve paragraaf
   BEWIJSMACHINE.md verdween op de eerste schone ronde.) Lukt dat laatste niet,
   dan meldt hij dat hardop in plaats van een uitslag te leveren over een
   werkboom die hij zelf heeft veranderd.

   Niet elk artefact is hier in een redelijke tijd te herbouwen: `npm test` voor
   DEKKING.json duurt een uur, VINDBAAR.json vraagt een browser. Die krijgen
   `nietGedraaid` met de reden, en dat is een uitslag en geen gat. De proef
   voegt samen met wat er al in HERBOUWPROEF.json staat (zoals de mutatiemotor
   dat doet), zodat de lijst kan groeien zonder dat er ooit een volle ronde van
   uren nodig is; `--opnieuw` meet wat er al in staat toch opnieuw.

   Draai: node scripts/herbouwproef.js [naam ...] [--opnieuw] [--wacht=180]
                                       [--vastleggen]
   ========================================================================= */

const fs = require('fs');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');
const { stempel, eisSchoneBoom } = require('./lib/stempel.js');
const { zonderCommentaar } = require('./lib/bron.js');

const WORTEL = path.join(__dirname, '..');
const UIT = path.join(WORTEL, 'HERBOUWPROEF.json');

/* Opdrachten die met opzet NIETS schrijven. Ze staan hier op hun vlag en niet
   op hun naam: `--controle` en `--toon` zijn huisbreed de leesloze stand, en
   een proef die er een kiest meet gegarandeerd `nietGeschreven`. */
const LEESLOOS = /(^|\s)--(controle|toon|check|dekking)(\s|$)/;
/* En de omgekeerde: de stand die WEL vastlegt. */
const LEGT_VAST = /(^|\s)--vastleggen(\s|$)|:vast(leggen)?$/;

function git(...args) {
  return execFileSync('git', args, { cwd: WORTEL, encoding: 'utf8' });
}

/* De tracked bestanden die nu afwijken van HEAD. Untracked telt hier NIET mee:
   die kan de proef niet terugzetten zonder te verwijderen, en een proef die
   bestanden weggooit is een gevaarlijker instrument dan het gat dat hij dicht. */
function gewijzigd() {
  return git('status', '--porcelain', '--untracked-files=no')
    .split('\n').filter(Boolean).map(r => r.slice(3).trim()).filter(Boolean);
}

/* ==== DE AANROEP AFLEIDEN ====
   Geeft { opdracht, herkomst } of null. */
function aanroepVan(naam, eigenaar, versheidOpdracht, npmScripts) {
  if (versheidOpdracht && !LEESLOOS.test(versheidOpdracht)) {
    return { opdracht: versheidOpdracht, herkomst: 'versheid' };
  }
  if (eigenaar) {
    const treffers = Object.entries(npmScripts)
      .filter(([, v]) => v.includes(eigenaar))
      .filter(([k, v]) => !LEESLOOS.test(v) && !LEESLOOS.test(k));
    if (treffers.length) {
      /* Legt er een vast, dan die; anders de kortste naam -- dat is huisbreed de
         kale variant en niet een bijzondere stand. */
      const vast = treffers.find(([k, v]) => LEGT_VAST.test(v) || LEGT_VAST.test(k));
      const gekozen = vast || treffers.sort((a, b) => a[0].length - b[0].length)[0];
      return { opdracht: 'npm run ' + gekozen[0], herkomst: 'package.json' };
    }
    return { opdracht: 'node ' + eigenaar, herkomst: 'eigenaar' };
  }
  return null;
}

/* ==== VERGELIJKEN, MET HET STEMPEL APART ====
   Voor een .json-register is het stempel een top-level sleutel; die eruit halen
   is exact en niet heuristisch. Voor een .md is dat niet zo -- daar wordt geen
   stempel weggepoetst, want raden welke regel een tijdstip is, maakt van een
   echt verschil stilletjes een stempelverschil. */
const ISO = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/* WAT TELT ALS MEETMOMENT, en waarom dat op VORM gaat en niet op naam.

   Er lopen twee stempelconventies naast elkaar. De meeste registers dragen een
   `stempel`-object (scripts/lib/stempel.js); COMMERCE.json en OBJECTMODEL.json
   dragen in plaats daarvan een kale `vastgelegd: "2026-09-15"`. Een lijst met
   toegestane veldnamen zou de tweede vorm morgen weer missen -- en erger, hij
   zou een veld dat toevallig zo heet stilzwijgend wegpoetsen.

   De regel is daarom structureel: een top-level veld waarvan de OUDE en de
   NIEUWE waarde allebei een ISO-datum zijn en die verschillen, is een
   meetmoment. Alles wat daar niet aan voldoet blijft een inhoudelijk verschil,
   ook als het `vastgelegd` heet. En wat er als meetmoment is weggestreept staat
   met naam in de uitslag: wegstrepen zonder het te noemen is precies de stille
   verbetering waar dit huis niet aan doet. */
function meetmomentVelden(a, b) {
  const uit = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (JSON.stringify(a[k]) === JSON.stringify(b[k])) continue;
    if (k === 'stempel') { uit.push(k); continue; }
    if (typeof a[k] === 'string' && typeof b[k] === 'string' && ISO.test(a[k]) && ISO.test(b[k])) uit.push(k);
  }
  return uit;
}

function vergelijk(naam, voor, na) {
  if (voor === na) return { uitslag: 'gelijk', verschilIn: [] };
  if (naam.endsWith('.json')) {
    let a, b;
    try { a = JSON.parse(voor); b = JSON.parse(na); }
    catch (e) { return { uitslag: 'verschilt', verschilIn: ['(onleesbaar als JSON: ' + e.message + ')'] }; }
    const moment = meetmomentVelden(a, b);
    const zonder = (o) => { const k = Object.assign({}, o); for (const v of moment) delete k[v]; return k; };
    if (JSON.stringify(zonder(a)) === JSON.stringify(zonder(b))) {
      return { uitslag: 'alleenStempel', verschilIn: moment };
    }
    const sleutels = new Set([...Object.keys(a), ...Object.keys(b)]);
    const anders = [...sleutels].filter(k => !moment.includes(k) &&
      JSON.stringify(a[k]) !== JSON.stringify(b[k]));
    return { uitslag: 'verschilt', verschilIn: anders, meetmoment: moment };
  }
  /* REGELS VERGELIJKEN ALS VERZAMELING EN NIET OP POSITIE, en dat is een
     gemaakte fout. Op index vergeleken meldde BEWIJS.md `1413 regel(s) anders
     van 1958`, terwijl `git diff --stat` 7 toevoegingen en 6 verwijderingen
     telde: EEN ingevoegde regel schuift alles erna op en dan verschilt de rest
     van het bestand per definitie. Een geldig getal uit het verkeerde
     experiment -- par. 6a van BEWIJSMACHINE.md, nu op deze proef zelf. */
  const telOp = (rs) => { const m = new Map(); for (const r of rs) m.set(r, (m.get(r) || 0) + 1); return m; };
  const ma = telOp(voor.split('\n')), mb = telOp(na.split('\n'));
  let erbij = 0, eraf = 0;
  for (const [r, n] of mb) erbij += Math.max(0, n - (ma.get(r) || 0));
  for (const [r, n] of ma) eraf += Math.max(0, n - (mb.get(r) || 0));
  return { uitslag: 'verschilt', verschilIn: [erbij + ' regel(s) erbij, ' + eraf + ' eraf'] };
}

/* WELKE VLAG ZET DEZE GENERATOR AAN HET SCHRIJVEN?

   Vier van de achttien kwamen terug als `nietGeschreven` terwijl ze prima
   schrijven: hun npm-opdracht is de KALE variant, en de writeFileSync staat
   achter `process.argv.includes('--vastleggen')`. `mutatiecontract` heeft
   daarnaast `--afleiden`, een vlag die in geen enkele naamconventie voorkomt.

   Een lijst met toegestane vlaggen zou de volgende weer missen. De vlaggen
   staan al in de BRON van de eigenaar, dus die worden daar gelezen -- zonder
   commentaar, anders leest de proef een vlag uit een voorbeeld in de kop. Ze
   worden daarna een voor een GEPROBEERD; wat er in de uitslag komt is de
   opdracht die aantoonbaar heeft geschreven, en niet een die dat volgens een
   regexp zou moeten doen.

   De leesloze vlaggen vallen af: die schrijven met opzet niet. */
function vlaggenVan(eigenaar) {
  let code;
  try { code = zonderCommentaar(fs.readFileSync(path.join(WORTEL, eigenaar), 'utf8'), { regelsHeel: true }); }
  catch (e) { return []; }
  const uit = new Set();
  for (const m of code.matchAll(/argv[^\n]{0,40}?['"](--[a-z][a-z0-9-]*)['"]/g)) {
    if (!LEESLOOS.test(' ' + m[1] + ' ')) uit.add(m[1]);
  }
  return [...uit];
}

/* DE PROCESKRING OMHALEN, EN CONTROLEREN DAT HIJ WEG IS.

   Signaal sturen is niet hetzelfde als opgeruimd zijn: een proces dat SIGKILL
   krijgt is pas weg als de kernel hem heeft geoogst. Daarom niet alleen kill
   maar ook peilen, met `kill(-pgid, 0)` -- die gooit ESRCH zodra de groep leeg
   is. Lukt dat binnen de tijd niet, dan zegt de proef dat hardop in plaats van
   door te meten op een machine waar zijn vorige poging nog draait. */
function ruimKring(pgid) {
  if (!pgid) return true;
  try { process.kill(-pgid, 'SIGKILL'); } catch (e) { /* al leeg */ }
  const eind = Date.now() + 5000;
  for (;;) {
    try { process.kill(-pgid, 0); } catch (e) { return true; }
    if (Date.now() > eind) return false;
    /* Kort blokkerend wachten: deze functie draait tussen twee metingen in en
       mag de volgende niet beginnen voordat de vorige echt weg is. */
    spawnSync('sleep', ['0.2']);
  }
}

function beproef(naam, aanroep, wachtMs) {
  const pad = path.join(WORTEL, naam);
  if (!fs.existsSync(pad)) return { uitslag: 'nietGedraaid', reden: 'het artefact bestaat niet' };
  const voor = fs.readFileSync(pad, 'utf8');
  const mtimeVoor = fs.statSync(pad).mtimeMs;
  const begon = Date.now();
  /* VIA setsid, EN DAT IS GEEN NETHEID MAAR EEN GEMETEN LEK.

     Met `shell: true` doodt de wachttijd alleen de schil. Nagemeten op
     DEKKING.json: `npm run dekking:vast` liep af op 240s, de proef noteerde
     netjes `nietGedraaid` -- en drie minuten later stonden `npm`, het
     generatorscript EN een `node --test` over de hele toetsmap nog te draaien.
     Die wezen schrijven DEKKING.json af terwijl de proef allang bij het
     volgende artefact is, en dan meet artefact n+1 op de uitvoer van artefact n
     met een tussenpoos die niemand kan reproduceren. Precies de opstapeling die
     scripts/mutatie.js beschrijft.

     `setsid` exect hier in de plaats van het kind (het is nog geen
     groepsleider), dus `r.pid` IS de sessie- en groepsleider en `kill(-pid)`
     haalt de hele kring om. Dat gebeurt ALTIJD en niet alleen na een
     wachttijd -- een generator die een dienst achterlaat, is net zo goed een
     wees. */
  const r = spawnSync('setsid', ['sh', '-c', aanroep.opdracht], {
    cwd: WORTEL, encoding: 'utf8', timeout: wachtMs, killSignal: 'SIGKILL',
    maxBuffer: 64 * 1024 * 1024, env: Object.assign({}, process.env, { RTG_HERBOUWPROEF: '1' })
  });
  const duurMs = Date.now() - begon;
  const kringWeg = ruimKring(r.pid);
  if (r.error && r.error.code === 'ETIMEDOUT') {
    return { uitslag: 'nietGedraaid', duurMs, kringWeg,
      reden: 'over de wachttijd van ' + Math.round(wachtMs / 1000) + 's heen' +
        (kringWeg ? '' : ' -- EN DE PROCESKRING LEEFT NOG') };
  }
  const na = fs.readFileSync(pad, 'utf8');
  const mtimeNa = fs.statSync(pad).mtimeMs;
  /* DE BESTURINGSPROEF. Niet aangeraakt is niet hetzelfde als hetzelfde
     teruggeschreven -- zonder deze regel leest elke leesloze opdracht als een
     perfecte reproductie. De mtime is hier het signaal en niet de inhoud, juist
     omdat een correcte herbouw dezelfde bytes oplevert. */
  if (mtimeNa === mtimeVoor && voor === na) {
    return { uitslag: 'nietGeschreven', duurMs,
      reden: 'de opdracht liep (exitcode ' + r.status + ') maar raakte het bestand niet aan' };
  }
  const uit = vergelijk(naam, voor, na);
  return Object.assign({ duurMs, exitcode: r.status }, uit);
}

function meet(namen, opties) {
  const { REGISTERS } = require('./versheid.js');
  const versheid = new Map(REGISTERS.map(r => [r[0], r[1]]));
  const npmScripts = JSON.parse(fs.readFileSync(path.join(WORTEL, 'package.json'), 'utf8')).scripts || {};
  const register = JSON.parse(fs.readFileSync(path.join(WORTEL, 'AFGELEID.json'), 'utf8'));
  const perNaam = new Map(register.artefacten.map(r => [r.naam, r]));

  const uit = [];
  /* ELKE RIJ PRINT EEN REGEL, ook de rijen die niet aan een opdracht toekomen.
     In de eerste ronde haakten die stil af met een `continue`, en dan telt de
     lijst op het scherm achttien rijen als vijftien -- wat leest als "die is
     niet gemeten" terwijl er wel degelijk een uitslag met een reden ligt. */
  const meld = (rij, waarom) => { console.log('  ' + rij.naam.padEnd(26) + '(overgeslagen)'.padEnd(42) + rij.uitslag + ' -- ' + waarom); return rij; };
  for (const naam of namen) {
    const a = perNaam.get(naam);
    if (!a) { uit.push(meld({ naam, uitslag: 'nietGedraaid', reden: 'staat niet in AFGELEID.json' }, 'staat niet in AFGELEID.json')); continue; }
    if (a.soort !== 'AFGELEID') {
      const reden = 'soort ' + a.soort + ': in zijn geheel herbouwen bestaat niet';
      uit.push(meld({ naam, soort: a.soort, eigenaar: a.eigenaar || null, uitslag: 'nietGedraaid', reden }, reden));
      continue;
    }
    let aanroep = aanroepVan(naam, a.eigenaar, versheid.get(naam), npmScripts);
    if (!aanroep) {
      const reden = 'geen eigenaar, dus geen aanroep om af te leiden';
      uit.push(meld({ naam, soort: a.soort, eigenaar: null, uitslag: 'nietGedraaid', reden }, reden));
      continue;
    }
    /* De regel wordt NA de vlagzoektocht geprint en niet ervoor: anders staat
       er de eerste poging op het scherm met de uitslag van de laatste, en dan
       leest MUTATIECONTRACT.json als "npm run mutatiecontract schrijft" terwijl
       het `-- --afleiden` was. */
    let r = beproef(naam, aanroep, opties.wachtMs);
    /* Schreef hij niets, dan is de VLAG de eerste verdachte en niet de
       generator. Elke kandidaat uit zijn eigen bron krijgt een beurt; de eerste
       die het bestand aanraakt wint, en die opdracht is wat het register
       noteert. Blijft alles leeg, dan staat `nietGeschreven` er met de reden --
       dat is bij norm.js de WAARHEID (hij schrijft alleen als er iets beweegt)
       en geen tekort van de proef. */
    const geprobeerd = [aanroep.opdracht];
    if (r.uitslag === 'nietGeschreven' && a.eigenaar) {
      for (const vlag of vlaggenVan(a.eigenaar)) {
        if (aanroep.opdracht.includes(vlag)) continue;
        /* `npm run x` heeft een `--` nodig om de vlag door te geven, `node x.js`
           niet -- daar zou het scheidingsteken gewoon in argv belanden. */
        const scheiding = /^npm\b/.test(aanroep.opdracht) ? ' -- ' : ' ';
        const met = { opdracht: aanroep.opdracht + scheiding + vlag, herkomst: aanroep.herkomst + '+vlag' };
        geprobeerd.push(met.opdracht);
        const t = beproef(naam, met, opties.wachtMs);
        if (t.uitslag !== 'nietGeschreven') { r = t; aanroep = met; break; }
      }
    }
    console.log('  ' + naam.padEnd(26) + aanroep.opdracht.padEnd(42) +
      r.uitslag + (r.duurMs ? '  (' + Math.round(r.duurMs / 100) / 10 + 's)' : ''));
    /* TERUGLEGGEN, NA ELK ARTEFACT. Een generator schrijft vaak meer dan zijn
       eigen register (norm.js raakt NORM.json, bewijs.js leest MUTATIES.json);
       wat er ook is bewogen, het gaat terug voor de volgende opdracht begint.
       Anders meet artefact n+1 op de uitvoer van artefact n. */
    const vuil = gewijzigd().filter(p => p !== 'HERBOUWPROEF.json');
    if (vuil.length) git('checkout', '--', ...vuil);
    uit.push(Object.assign({ naam, soort: a.soort, eigenaar: a.eigenaar,
      opdracht: aanroep.opdracht, opdrachtHerkomst: aanroep.herkomst,
      geprobeerd: geprobeerd.length > 1 ? geprobeerd : undefined,
      raakteOok: vuil.filter(p => p !== naam) }, r));
  }
  return uit;
}

function samenvatting(rijen) {
  const tel = (u) => rijen.filter(r => r.uitslag === u).length;
  return {
    beproefd: rijen.length,
    gelijk: tel('gelijk'),
    alleenStempel: tel('alleenStempel'),
    verschilt: tel('verschilt'),
    nietGeschreven: tel('nietGeschreven'),
    nietGedraaid: tel('nietGedraaid'),
    /* De enige teller die "het artefact is een herbouwplicht" betekent: de
       inhoud kwam terug zoals hij stond. Stempelverschil hoort erbij, want een
       register dat zijn meetmoment NIET opschrijft is niet beter. */
    herbouwbaar: tel('gelijk') + tel('alleenStempel')
  };
}

function main() {
  const args = process.argv.slice(2);
  const opnieuw = args.includes('--opnieuw');
  const vastleggen = args.includes('--vastleggen');
  const wachtArg = args.find(a => a.startsWith('--wacht='));
  const wachtMs = (wachtArg ? Number(wachtArg.split('=')[1]) : 180) * 1000;
  let namen = args.filter(a => !a.startsWith('--'));

  const staandVuil = gewijzigd().filter(p => p !== 'HERBOUWPROEF.json');
  if (staandVuil.length) {
    console.error('\n  De herbouwproef begint alleen op een schone boom -- hij DRAAIT generatoren\n' +
      '  en legt daarna terug wat er is veranderd. Met openstaand werk in de boom kan hij\n' +
      '  niet zien wat van hem is en wat van jou:\n    ' + staandVuil.join('\n    ') + '\n');
    process.exit(2);
  }

  /* ONLEESBAAR IS NIET AFWEZIG (BEWIJSMACHINE.md par. 6b, BM-B). Hier stond een
     `try { ... } catch { return []; }`, en die maakt van een STUK register een
     LEEG register: de proef zou dan vrolijk opnieuw beginnen en bij het
     vastleggen alles overschrijven wat er stond. Drie standen, en ze worden uit
     elkaar gehouden:

       bestaat niet      eerste ronde, begin met een lege lijst
       bestaat + geldig  voeg samen
       bestaat + stuk    STOP, en zeg het -- de mens beslist of hij hem weggooit

     (Deze regel is hier verdiend en niet overgeschreven: de eerste versie van
     dit bestand liet `stilLezingMeters` met een tand stijgen.) */
  let eerder = [];
  if (fs.existsSync(UIT)) {
    let rauw;
    try { rauw = JSON.parse(fs.readFileSync(UIT, 'utf8')); }
    catch (e) {
      console.error('\n  HERBOUWPROEF.json BESTAAT en is ONLEESBAAR (' + e.message + ').\n' +
        '  Dat is iets anders dan "er is nog niets gemeten", en de proef gokt niet welke van\n' +
        '  de twee het is: opnieuw beginnen zou de vorige ronde overschrijven. Kijk ernaar,\n' +
        '  en verwijder hem met de hand als hij echt weg mag.\n');
      process.exit(2);
    }
    eerder = rauw.artefacten || [];
  }
  const gekend = new Map(eerder.map(r => [r.naam, r]));

  if (!namen.length) {
    const register = JSON.parse(fs.readFileSync(path.join(WORTEL, 'AFGELEID.json'), 'utf8'));
    namen = register.artefacten.filter(r => r.soort === 'AFGELEID' && r.eigenaar).map(r => r.naam);
  }
  const tedoen = opnieuw ? namen : namen.filter(n => !gekend.has(n));

  console.log('\nDE HERBOUWPROEF -- ' + tedoen.length + ' artefact(en), wachttijd ' +
    Math.round(wachtMs / 1000) + 's per stuk\n');
  const verse = tedoen.length ? meet(tedoen, { wachtMs }) : [];
  for (const r of verse) gekend.set(r.naam, r);
  const rijen = [...gekend.values()].sort((a, b) => a.naam.localeCompare(b.naam));
  const gemeten = samenvatting(rijen);

  const rest = gewijzigd().filter(p => p !== 'HERBOUWPROEF.json');
  if (rest.length) {
    console.error('\n  DE PROEF HEEFT IETS ACHTERGELATEN en levert daarom geen uitslag:\n    ' +
      rest.join('\n    ') + '\n  Zet dat eerst terug; een uitslag over een boom die de proef zelf\n' +
      '  heeft veranderd, is geen uitslag.\n');
    process.exit(1);
  }

  console.log('\n  gelijk (byte voor byte)   ' + String(gemeten.gelijk).padStart(4));
  console.log('  alleen het stempel        ' + String(gemeten.alleenStempel).padStart(4));
  console.log('  verschilt                 ' + String(gemeten.verschilt).padStart(4));
  console.log('  niet geschreven           ' + String(gemeten.nietGeschreven).padStart(4));
  console.log('  niet gedraaid             ' + String(gemeten.nietGedraaid).padStart(4));
  console.log('\n  HERBOUWBAAR: ' + gemeten.herbouwbaar + ' van ' + rijen.length + ' beproefde artefacten.');

  for (const r of rijen.filter(r => r.uitslag === 'verschilt')) {
    console.log('    ! ' + r.naam + ' -- ' + (r.verschilIn || []).join(', '));
  }

  if (vastleggen) {
    eisSchoneBoom('HERBOUWPROEF.json');
    fs.writeFileSync(UIT, JSON.stringify({
      stempel: stempel(),
      uitleg: 'Per afgeleid artefact: draai zijn generator-eigenaar uit AFGELEID.json, en komt ' +
        'er hetzelfde uit? Wat herbouwbaar is, is bij een samenvoeging een HERBOUWPLICHT en geen ' +
        'handmatig conflict.',
      grens: 'gelijk en alleenStempel worden nooit opgeteld tot een cijfer over determinisme: een ' +
        'stempel HOORT te bewegen. nietGedraaid is geen oordeel over het artefact maar over deze ' +
        'machine, en nietGeschreven is de besturingsproef -- zonder die stand leest elke leesloze ' +
        'opdracht als een perfecte reproductie.',
      gemeten, artefacten: rijen
    }, null, 2) + '\n');
    console.log('\n  HERBOUWPROEF.json geschreven.\n');
  } else {
    console.log('\n  (niets vastgelegd -- voeg --vastleggen toe)\n');
  }
}

if (require.main === module) main();
module.exports = { aanroepVan, vergelijk, meetmomentVelden, vlaggenVan, beproef, samenvatting, LEESLOOS, LEGT_VAST, UIT };
