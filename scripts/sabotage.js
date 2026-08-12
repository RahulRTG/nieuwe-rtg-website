#!/usr/bin/env node
/* ============================================================================
   DE SABOTAGE -- zet elke handhaver echt uit, en kijk wie er rood wordt.

   WAAROM DIT ER IS

   Dit huis heeft veel handhavers en een register dat ze opsomt (WETTEN.json,
   `npm run wetten`). Maar een register is een lijst met beweringen, en LAT.md
   regel 2 zegt precies wat zo'n lijst waard is: een toets die je niet hebt zien
   zakken is geen toets, en een keuringsregel die je niet hebt zien afkeuren
   keurt niets. `scripts/samenhang.js` stelt de vraag "kijkt er iemand", deze
   stelt de enige vraag die daarna nog overblijft:

       als ik deze wet WERKELIJK overtreed, wordt er dan iets rood?

   Dus wordt hij overtreden. Niet in een gedachte-experiment maar in de echte
   bestanden: de leeftijdspoort van de spellenlaag gaat open, de bijdrageknoop
   krijgt een bedrag, de status verliest zijn teken, het bordeaux van het logo
   verschuift een groenstap. Daarna draait de wachter die het hoort te merken,
   en daarna gaat alles terug.

   DE VIJF UITKOMSTEN, EN WAAROM HET ER GEEN TWEE ZIJN

     raak         de wachter werd rood. Dit is het enige bewijs dat telt.
     afgeslagen   de sabotage staat er, en de wachter bleef groen. De wet staat
                  opgeschreven en niets houdt hem tegen. Dat is een BEVINDING en
                  geen storing van dit gereedschap.
     blind        de wachter was al rood voordat er iets gebeurde. Dan bewijst
                  zijn rood niets. Zonder deze stand telt elke kapotte toets
                  mee als bewijs, en dat is precies hoe een meter gaat liegen.
     losgeraakt   het aanknopingspunt staat niet meer in de code, of staat er
                  meer dan een keer. Het recept wijst naar iets dat er niet is.
     nietGeprobeerd  overgeslagen.

   WAT DEZE MOTOR NIET BEWEERT, en dit hoort er eerlijk bij:

   - RAAK bewijst dat de wachter GEVOELIG is voor deze ene overtreding. Niet
     dat hij elke overtreding ziet, en niet dat de wet goed geformuleerd is.
   - Een recept dat de HANDHAVER uitzet in plaats van de gedraging (dat gebeurt
     bij de keuringsregels: de regel zelf is daar de wet) bewijst iets zwakkers
     -- dat de regel tanden heeft, niet dat de code eronder deugt. Waar dat zo
     is, staat het als kanttekening bij de wet.
   - Een wet zonder recept staat als `mensenwerk` in het register, met de reden.
     Die telt nooit als bewezen. Dat is de eerlijke stand en geen gat.

   VEILIGHEID, want dit script schrijft in echte bronbestanden.

   Voor elke verandering gaat er eerst een journaal naar server/data/ (staat in
   .gitignore) met het volledige oorspronkelijke bestand erin. Pas daarna wordt
   er geschreven. Valt dit proces om, dan zet `node scripts/sabotage.js
   --opruimen` alles terug; zolang er een journaal ligt weigert de motor te
   starten. Na het terugzetten wordt byte voor byte vergeleken.

   EEN WAARSCHUWING DIE UIT EIGEN ERVARING KOMT: werk niet in de repo terwijl er
   een ronde loopt. De nulmeting wordt EEN keer per wachter gedaan, aan het
   begin -- dat scheelt bij de keuring twintig minuten, maar het betekent ook
   dat een wachter die halverwege door iemand ANDERS rood wordt gemaakt, met een
   groene nulmeting in de boeken staat. Dat is hier echt gebeurd: er kwam een
   toets bij, BEWIJS.md liep hierdoor achter, keuringsregel 41 ging rood, en
   drie wetten kregen een uitslag die niets met hun eigen sabotage te maken had.
   De motor meldde dat wel eerlijk ("de keuring werd rood, maar op andere
   regels") -- juist daarom is die melding er.

   Draai:  node scripts/sabotage.js                (alles; de keuring erbij duurt lang)
           node scripts/sabotage.js --snel         (alles zonder de keuringswachters)
           node scripts/sabotage.js merk-pearl-is-warm   (een wet)
           node scripts/sabotage.js --opruimen     (zet een blijven staan sabotage terug)
           node scripts/sabotage.js --json
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const W = require('./lib/wetboek');

const WORTEL = W.WORTEL;
const JOURNAAL = path.join(WORTEL, 'server', 'data', 'sabotage-journaal.json');
const K = { rood: '\x1b[31m', groen: '\x1b[32m', geel: '\x1b[33m', grijs: '\x1b[90m', vet: '\x1b[1m', uit: '\x1b[0m' };

const argv = process.argv.slice(2);
const vlag = n => argv.includes('--' + n);
const alleenWetten = argv.filter(a => !a.startsWith('--'));

/* ---------------------------------------------------------------------------
   HET JOURNAAL. Eerst opschrijven wat je gaat kapotmaken, dan pas kapotmaken.
   Andersom is de volgorde waarin een afgebroken ronde een bewerkte werkboom
   achterlaat zonder dat iemand weet wat er veranderd is.
   --------------------------------------------------------------------------- */
function journaalSchrijf(rijen) {
  fs.mkdirSync(path.dirname(JOURNAAL), { recursive: true });
  fs.writeFileSync(JOURNAAL, JSON.stringify(rijen, null, 2));
}
function journaalLees() {
  try { return JSON.parse(fs.readFileSync(JOURNAAL, 'utf8')); } catch (e) { return null; }
}
function journaalWeg() { try { fs.unlinkSync(JOURNAAL); } catch (e) {} }

function opruimen(stil) {
  const rijen = journaalLees();
  if (!rijen || !rijen.length) { if (!stil) console.log('\n  Geen journaal: er staat niets open.\n'); journaalWeg(); return 0; }
  let terug = 0;
  for (const r of rijen) {
    const vol = path.join(WORTEL, r.bestand);
    try { fs.writeFileSync(vol, r.origineel); terug++; }
    catch (e) { console.error('  ' + K.rood + 'KON NIET TERUGZETTEN' + K.uit + ': ' + r.bestand + ' -- ' + e.message); return 2; }
  }
  journaalWeg();
  if (!stil) console.log('\n  ' + K.groen + terug + ' bestand(en) teruggezet.' + K.uit + '\n');
  return 0;
}

/* De sabotage zelf, met de twee controles die ertoe doen: het aanknopingspunt
   moet BESTAAN en het moet er PRECIES EEN keer staan. Twee treffers betekent
   dat het recept niet weet wat het raakt, en dan is de uitslag ervan niets
   waard -- dat is een losgeraakt recept en geen geslaagde proef. */
function keurRecept(wet) {
  const rel = wet.sabotage.bestand;
  const vol = path.join(WORTEL, rel);
  let origineel;
  try { origineel = fs.readFileSync(vol, 'utf8'); }
  catch (e) { return { fout: 'het bestand ' + rel + ' bestaat niet (meer)' }; }
  const stukken = origineel.split(wet.sabotage.zoek);
  if (stukken.length === 1) return { fout: 'het aanknopingspunt staat niet in ' + rel };
  if (stukken.length > 2) return { fout: 'het aanknopingspunt staat ' + (stukken.length - 1) + 'x in ' + rel + ' -- te vaag om iets te bewijzen' };
  return { origineel, vol, stukken };
}

function breng(gekeurd, wet) {
  journaalSchrijf([{ bestand: wet.sabotage.bestand, origineel: gekeurd.origineel }]);
  fs.writeFileSync(gekeurd.vol, gekeurd.stukken[0] + wet.sabotage.zet + gekeurd.stukken[1]);
  return gekeurd;
}
function herstel(gebracht) {
  fs.writeFileSync(gebracht.vol, gebracht.origineel);
  const na = fs.readFileSync(gebracht.vol, 'utf8');
  journaalWeg();
  /* Byte voor byte, niet "we hebben geschreven". Een terugzetting die je niet
     hebt nagekeken is een aanname, en dit script laat er echte code voor los. */
  if (na !== gebracht.origineel) throw new Error('het terugzetten van ' + gebracht.vol + ' klopt niet');
}

/* ---------------------------------------------------------------------------
   DE WACHTERS DRAAIEN
   --------------------------------------------------------------------------- */
const TIJD = { test: 600000, e2e: 900000, check: 900000, script: 300000 };

function draai(w) {
  const t0 = Date.now();
  let cmd;
  if (w.soort === 'check') cmd = 'node scripts/check.js 2>&1';
  else if (w.soort === 'script') cmd = w.doel + ' 2>&1';
  else cmd = 'node --experimental-sqlite --test ' + JSON.stringify(w.doel) + ' 2>&1';
  /* Met een shell EN de omleiding, zodat de twee stromen door EEN pijp gaan.
     Twee losse pijpen komen in willekeurige volgorde binnen, en dan staat het
     kruis van keuringsregel 23 zomaar onder de kop van regel 24 -- en wijzen
     we de verkeerde wet als bewezen aan. */
  const r = spawnSync(cmd, { cwd: WORTEL, shell: true, encoding: 'utf8',
    timeout: TIJD[w.soort] || 600000, maxBuffer: 128 * 1024 * 1024 });
  const uitvoer = (r.stdout || '') + (r.error ? '\n' + r.error.message : '');
  return { code: r.status, uitvoer, verlopen: !!(r.error && r.error.code === 'ETIMEDOUT'), ms: Date.now() - t0 };
}

/* WELKE KEURINGSREGELS ZIJN ROOD? Niet "de keuring zakt" -- dan telt elke
   andere regel mee als bewijs voor deze wet, en dat is precies de vorm van
   bewijs waar LAT.md regel 9 voor waarschuwt. Dus: per kop bijhouden of er een
   kruis onder staat. */
function rodeRegels(uitvoer) {
  const rood = new Set();
  let huidig = null;
  for (const regel of uitvoer.split('\n')) {
    const kop = /^(\d+[a-z]?)\)\s/.exec(regel);
    if (kop) { huidig = kop[1]; continue; }
    if (huidig && /^\s*✗/.test(regel)) rood.add(huidig);
  }
  return rood;
}

/* De nulmeting, gedeeld over alle wetten die dezelfde wachter noemen. Een
   wachter die AL rood is, kan niets bewijzen -- daarom wordt hij hier een keer
   eerlijk gedraaid voordat er ook maar iets is aangeraakt. */
const nulmetingen = new Map();
function nulmeting(w) {
  if (nulmetingen.has(w.sleutel)) return nulmetingen.get(w.sleutel);
  const r = draai(w);
  const uit = w.soort === 'check'
    ? { groen: rodeRegels(r.uitvoer).size === 0 && r.code === 0, rood: rodeRegels(r.uitvoer), ms: r.ms,
        waarom: r.verlopen ? 'de keuring liep in zijn tijdslimiet' : 'de keuring meldde al ' + rodeRegels(r.uitvoer).size + ' rode regel(s)' }
    : { groen: r.code === 0, ms: r.ms,
        waarom: r.verlopen ? 'liep in zijn tijdslimiet' : eersteFout(r.uitvoer) };
  nulmetingen.set(w.sleutel, uit);
  return uit;
}
/* WAAROM WERD HIJ ROOD? Die zin komt in SABOTAGE.json en daarmee in het
   overzicht, dus "zonder duidelijke reden" is geen antwoord -- dan staat er in
   het register dat een wet bewezen is zonder dat iemand kan nalezen waarop.

   Eerst zocht dit alleen naar de vormen van de toetsdraaier (`not ok`, `Error:`).
   Een wachter die een gewoon script is, schrijft geen van beide: `node
   scripts/wetten.js --controle` zegt gewoon "Het wetboek klopt niet:". Vandaar
   de terugval op de eerste echte regel van de uitvoer. */
function eersteFout(uitvoer) {
  const m = /^\s*(?:not ok \d+ - |Error: |.*Error: )(.+)$/m.exec(uitvoer);
  if (m) return m[1].slice(0, 160);
  const regel = uitvoer.split('\n').map(r => r.trim()).find(r => r && !/^[-=*#\s]+$/.test(r));
  return (regel || 'zonder duidelijke reden').slice(0, 160);
}

/* ---------------------------------------------------------------------------
   EEN WET PROBEREN
   --------------------------------------------------------------------------- */
function probeer(wet) {
  const wachters = wet.sabotage.wachters.map(W.ontleedWachter);

  /* EERST HET RECEPT, DAN PAS DE NULMETING. Een recept dat nergens naar wijst is
     een defect in het REGISTER, en dat hoort te blijken ook als de wachter
     toevallig ziek is. Andersom zou een kapot recept jarenlang verstopt kunnen
     zitten achter een rode toets, en dan zegt "blind" iets anders dan er aan de
     hand is. Bovendien kost dit geen enkel proces. */
  const gekeurd = keurRecept(wet);
  if (gekeurd.fout) return { stand: 'losgeraakt', reden: gekeurd.fout };

  // dan de nulmeting van elke wachter: was hij groen voordat wij iets deden?
  for (const w of wachters) {
    const nul = nulmeting(w);
    if (!nul.groen) return { stand: 'blind', wachter: w.soort + ':' + w.doel,
      reden: 'deze wachter was al rood voordat er iets gesaboteerd was (' + nul.waarom + '); zijn rood bewijst hier niets' };
  }

  const gebracht = breng(gekeurd, wet);

  try {
    for (const w of wachters) {
      const r = draai(w);
      if (w.soort === 'check') {
        const rood = rodeRegels(r.uitvoer);
        if (rood.has(w.doel)) return { stand: 'raak', wachter: 'check:' + w.doel, duurMs: r.ms,
          reden: 'keuringsregel ' + w.doel + ' sloeg aan' };
        if (rood.size) return { stand: 'afgeslagen', wachter: 'check:' + w.doel, duurMs: r.ms,
          reden: 'de keuring werd rood, maar op andere regels (' + [...rood].join(', ') + ') -- niet op de regel die deze wet draagt' };
      } else if (r.code !== 0 && !r.verlopen) {
        return { stand: 'raak', wachter: w.soort + ':' + w.doel, duurMs: r.ms, reden: eersteFout(r.uitvoer) };
      } else if (r.verlopen) {
        return { stand: 'blind', wachter: w.soort + ':' + w.doel, duurMs: r.ms,
          reden: 'de wachter liep in zijn tijdslimiet; hij heeft geen oordeel gegeven' };
      }
    }
    return { stand: 'afgeslagen', wachter: wet.sabotage.wachters.join(', '),
      reden: 'de sabotage stond er, en geen enkele genoemde wachter werd rood' };
  } finally {
    herstel(gebracht);
  }
}

/* ---------------------------------------------------------------------------
   DE RONDE
   --------------------------------------------------------------------------- */
function main() {
  if (vlag('opruimen')) return opruimen(false);

  if (journaalLees()) {
    console.error('\n  ' + K.rood + 'Er ligt nog een sabotage-journaal.' + K.uit +
      ' Een vorige ronde is afgebroken en er staat mogelijk nog een\n  verandering in de werkboom. Zet hem eerst terug:\n\n      node scripts/sabotage.js --opruimen\n');
    return 2;
  }

  let boek, vormfouten;
  try { ({ boek, vormfouten } = W.lees()); }
  catch (e) { console.error('\n  ' + K.rood + 'WETTEN.json is niet te lezen: ' + e.message + K.uit + '\n'); return 2; }
  if (vormfouten.length) {
    console.error('\n  ' + K.rood + 'Het wetboek klopt niet van vorm; er wordt niets gesaboteerd:' + K.uit);
    for (const f of vormfouten) console.error('    - ' + f);
    console.error('');
    return 2;
  }

  /* Een ronde mag afgebroken worden -- hij duurt lang. Wat er niet mag, is dat
     een afgebroken ronde een gesaboteerd bestand achterlaat. Het terugzetten
     gaat via het JOURNAAL en niet via een variabele in dit proces: het journaal
     staat er ook nog als dit proces halverwege een schrijfactie omvalt, en een
     variabele niet. */
  const noodstop = () => { opruimen(true); process.exit(130); };
  process.on('SIGINT', noodstop);
  process.on('SIGTERM', noodstop);

  const teDoen = boek.wetten.filter(w => {
    if (alleenWetten.length && !alleenWetten.includes(w.id)) return false;
    return true;
  });

  console.log('\n' + K.vet + 'DE SABOTAGE' + K.uit + K.grijs + ' -- zet elke handhaver echt uit, kijk wie rood wordt' + K.uit + '\n');

  const uitslag = { wetten: {} };
  const telling = { raak: 0, afgeslagen: 0, blind: 0, losgeraakt: 0, nietGeprobeerd: 0, mensenwerk: 0 };

  for (const wet of teDoen) {
    if (wet.mensenwerk) {
      uitslag.wetten[wet.id] = { stand: 'mensenwerk', afdruk: wet.afdruk, reden: wet.mensenwerk };
      telling.mensenwerk++;
      console.log('  ' + K.grijs + 'mensenwerk  ' + wet.id + K.uit);
      continue;
    }
    const soorten = wet.sabotage.wachters.map(w => W.ontleedWachter(w).soort);
    if (vlag('snel') && soorten.includes('check')) {
      uitslag.wetten[wet.id] = { stand: 'nietGeprobeerd', afdruk: wet.afdruk, reden: 'overgeslagen met --snel: deze wet hangt aan de keuring, en die duurt bijna twee minuten per proef' };
      telling.nietGeprobeerd++;
      console.log('  ' + K.grijs + 'overgeslagen ' + wet.id + K.uit);
      continue;
    }

    process.stdout.write('  ' + K.grijs + '... ' + wet.id + K.uit);
    let r;
    try { r = probeer(wet); }
    catch (e) { r = { stand: 'losgeraakt', reden: 'de proef zelf viel om: ' + e.message }; }

    uitslag.wetten[wet.id] = { stand: r.stand, afdruk: wet.afdruk, reden: r.reden, wachter: r.wachter, duurMs: r.duurMs };
    telling[r.stand]++;
    const merk = { raak: K.groen + 'RAAK      ', afgeslagen: K.rood + 'AFGESLAGEN', blind: K.geel + 'BLIND     ',
      losgeraakt: K.rood + 'LOSGERAAKT', nietGeprobeerd: K.grijs + 'OVERGESL. ' }[r.stand];
    process.stdout.write('\r\x1b[2K  ' + merk + K.uit + '  ' + wet.id.padEnd(42) +
      K.grijs + (r.duurMs ? (r.duurMs / 1000).toFixed(1) + 's  ' : '') + (r.reden || '').slice(0, 70) + K.uit + '\n');
  }

  /* De uitslag wordt SAMENGEVOEGD met wat er al lag, zodat een ronde over een
     enkele wet de rest niet wist. Anders wordt "even een wet natrekken" een
     stille manier om veertig metingen weg te gooien. */
  const oud = W.leesUitslag();
  const samen = { uitleg: 'Gemeten uitslag van npm run sabotage: per systeemwet of het uitzetten van zijn handhaver ECHT iets rood maakte. Niet met de hand bijwerken -- npm run wetten vergelijkt de vingerafdruk van het recept en meldt het als de meting verlopen is.',
    wetten: Object.assign({}, oud && oud.wetten, uitslag.wetten) };
  fs.writeFileSync(W.UITSLAG_PAD, JSON.stringify(samen, null, 2) + '\n');

  console.log('\n  ' + K.groen + telling.raak + ' raak' + K.uit + ', ' +
    K.rood + telling.afgeslagen + ' afgeslagen' + K.uit + ', ' +
    K.geel + telling.blind + ' blind' + K.uit + ', ' +
    K.rood + telling.losgeraakt + ' losgeraakt' + K.uit + ', ' +
    K.grijs + telling.nietGeprobeerd + ' overgeslagen, ' + telling.mensenwerk + ' mensenwerk' + K.uit);
  console.log('  ' + K.grijs + 'SABOTAGE.json bijgewerkt. Stand: npm run wetten -- wat dit betekent: npm run zekerheid' + K.uit + '\n');

  if (jsonUit()) console.log(JSON.stringify(samen, null, 2));

  /* Exitcode. LOSGERAAKT is een fout van dit gereedschap en hoort hard te zijn.
     AFGESLAGEN is een BEVINDING over de codebase en geen storing -- die hoort
     in de meter (`wettenOnbewezen`) en niet in een rode ronde, anders wordt
     deze motor uitgezet omdat hij de waarheid vertelt. */
  return telling.losgeraakt ? 1 : 0;
}
function jsonUit() { return vlag('json'); }

if (require.main === module) process.exit(main());
module.exports = { rodeRegels, probeer, opruimen, JOURNAAL };
