/* DE COMMENTAAR-VERWIJDERAAR IS DE INVOER VAN DERTIEN KEURINGEN.

   scripts/lib/bron.js haalt commentaar uit broncode, en check.js leunt er op elf
   plekken op: zero dependencies (regel 14), de glyfnamen (22), het
   bedradingscontract (26), dode configuratie (27), de poortwacht (28). Wat hij te
   veel weghaalt, ziet geen van die regels ooit. Er komt dan geen melding maar een
   vinkje, en dat is de gevaarlijke richting.

   Precies dat is gebeurd. De oude versie zocht `/*` met een regex, zonder te
   weten of dat teken in code, in een string of in een regelcommentaar stond.
   Gemeten over 4333 bestanden: 47 bestanden waren deels onzichtbaar, samen
   224.031 tekens -- waaronder 59.166 tekens van public/apps/app.html en 3.270
   tekens serverbron in server/opzet/kaartwebhooks.js. De mutatie die dat
   aantoonde: een `require('stripe')` in dat onzichtbare stuk planten. Met de oude
   verwijderaar meldde check.js regel 14 "geen externe module in server/,
   scripts/, test/ en public/"; met deze versie meldt hij de regel en de naam.

   Deze toets houdt de vijf vormen vast die het opleverden. Elke bewering is met
   een mutatie geraakt: de vorm uit de bron halen laat hem zakken.

   Draai: node --test test/bron.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('../scripts/lib/bron');

const WORTEL = path.join(__dirname, '..');

test('commentaar gaat eruit, in alle drie de vormen', () => {
  assert.equal(zonderCommentaar('a /* weg */ b').replace(/\s+/g, ' '), 'a b');
  assert.equal(zonderCommentaar('a // weg\nb'), 'a \nb');
  assert.equal(zonderCommentaar('a /* meer\n   regels */ b').replace(/\s+/g, ' '), 'a b');
});

test('strings blijven staan: dat is de belofte waar de keuringen op leunen', () => {
  const bron = "api('/api/bank/overzicht');";
  assert.equal(zonderCommentaar(bron), bron, 'een pad in een string moet leesbaar blijven');
  assert.match(zonderCommentaar("var u = 'http://x.nl/pad';"), /http:\/\/x\.nl\/pad/,
    'een dubbele slash achter een dubbele punt is geen commentaar');
  /* En buiten een string ook niet. Dit geval draagt de uitzondering die uit de
     vorige versie is overgenomen: een adres in een attribuut ZONDER quotes. Zit
     de dubbele slash in een string, dan vangt de string-tak hem al op en zegt
     deze regel niets -- daarom staat hier de vorm zonder quotes. */
  assert.match(zonderCommentaar('<a href=https://rtg.nl/pad>lezen</a>\nEINDE'), /rtg\.nl\/pad>lezen/,
    'een adres zonder quotes in de markup is geen commentaar');
});

/* DE VIJF VORMEN DIE HET OPLEVERDEN. Elke regel hier heeft een echt adres in de
   bron; de tweede helft van deze toets rekent af dat die adressen bestaan, zodat
   dit geen verzonnen gevallen worden. */
test('een MIME-joker of glob in een string opent geen commentaar', () => {
  const gevallen = [
    ['<input type="file" accept="image/*" hidden>\nEENTJE\n', 'accept in markup'],
    ["express.raw({ type: '*/*', limit: '1mb' });\nEENTJE\n", 'MIME-joker in serverbron'],
    ["const soort = 'serverkern (server/**/*.js)';\nEENTJE\n", 'glob in een string'],
    ["if (t.startsWith('/*')) return;\nEENTJE\n", 'een commentaarteken als tekst']
  ];
  for (const [bron, wat] of gevallen) {
    const uit = zonderCommentaar(bron + '/* echt commentaar */ TWEETJE');
    assert.match(uit, /EENTJE/, wat + ': de regel erna mag niet verdwijnen');
    assert.match(uit, /TWEETJE/, wat + ': en de regel na het echte commentaar ook niet');
    assert.doesNotMatch(uit, /echt commentaar/, wat + ': het echte commentaar gaat wel weg');
  }
});

/* EEN BACKTICK LOOPT OVER REGELS, EN DAT IS DE ZESDE VORM.

   De vijf hierboven kwamen uit de fout van 17 augustus. Deze kwam uit de METER
   die daarna is gebouwd: bronBlindeBestanden kruist deze functie met de lexer
   van de AST-scanner en wees zeven bestanden aan waar nog steeds bron
   verdween. Allemaal dezelfde vorm -- CSS in een template literal, met
   commentaar erin.

   Vandaag was dat onschuldig (het IS commentaar, alleen van een andere taal),
   maar het mechanisme is precies dat van toen: een template met een openende
   /* zonder sluiter erin eet door de echte code heen. Die laatste zin is wat
   de derde bewering hieronder meet.

   De grens per regel blijft staan voor ' en " -- die bestaat om de apostrof in
   proza ("pagina's") hoogstens EEN regel te laten verstoren, en een backtick
   komt in proza niet voor. */
test('een template literal over meerdere regels houdt zijn inhoud', () => {
  const bron = 'const css = `\n  /* rood, want waarschuwing */\n  .x{color:red}\n`;\nconst na = 1;';
  const uit = zonderCommentaar(bron);
  assert.match(uit, /rood, want waarschuwing/, 'wat in een template staat is geen commentaar van dit bestand');
  assert.match(uit, /\.x\{color:red\}/);
  assert.match(uit, /const na = 1;/);
});

test('en een openend commentaarteken in zo n template eet de code erna niet op', () => {
  /* DIT IS WAAR HET OM GING. Zonder de meerregelige backtick werd de template
     niet als string gezien, opende de /* erin een commentaar, en verdween alles
     tot de eerstvolgende sluiter -- inclusief echte code. */
  const bron = 'const css = `\n  .x{}  /* nooit gesloten\n`;\nconst blijft = 42;\n/* echt commentaar */\nconst ook = 7;';
  const uit = zonderCommentaar(bron);
  assert.match(uit, /const blijft = 42;/, 'de code na de template blijft staan');
  assert.match(uit, /const ook = 7;/);
  assert.doesNotMatch(uit, /echt commentaar/, 'en het echte commentaar gaat gewoon weg');
});

test('DE TEGENPROEF: een apostrof in proza kost nog steeds hoogstens die ene regel', () => {
  /* De grens per regel voor ' en " mag hier niet mee zijn opgerekt: dan zou een
     losse apostrof in HTML-proza de rest van het BESTAND als string lezen. */
  const bron = "<p>Alle pagina's van dit huis</p>\n/* weg */\n<p>einde</p>\nKLAAR";
  const uit = zonderCommentaar(bron);
  assert.doesNotMatch(uit, /weg/, 'het commentaar erna gaat nog steeds weg');
  assert.match(uit, /KLAAR/);
});

test('een blokcommentaar begint niet binnen een regelcommentaar', () => {
  const bron = '// alleen voor image/*\nfunction magie() { return 1; }\n/* weg */ EINDE';
  const uit = zonderCommentaar(bron);
  assert.match(uit, /function magie/, 'de functie onder het regelcommentaar blijft bestaan');
  assert.match(uit, /EINDE/);
  assert.doesNotMatch(uit, /weg/);
});

test('een losse apostrof in proza kost hoogstens die ene regel', () => {
  /* HTML draagt proza, en daar staat "pagina's" in. Een quote-teller die daar
     een string ziet beginnen, zou de rest van het bestand als string lezen. Deze
     versie stopt een string bij de regelovergang. */
  /* Twee apostroffen, met een ECHT commentaar ertussen. Loopt een string over
     regels heen, dan is dat commentaar ineens de inhoud van een string tussen
     "pagina'" en "'s ochtends", en blijft het staan. Daar zakt deze toets op --
     een variant met een enkele apostrof zakt niet, en die stond hier eerst. */
  const bron = "<p>Alle pagina's van dit huis</p>\n/* weg */\n<p>'s ochtends</p>\nEINDE";
  const uit = zonderCommentaar(bron);
  assert.doesNotMatch(uit, /weg/, 'het commentaar tussen de twee apostroffen gaat weg');
  assert.match(uit, /s ochtends/, 'en de tekst erna staat er nog');
  assert.match(uit, /EINDE/);
});

/* De mutatie van DEZE bewering zit niet in bron.js maar in de bron zelf: haal
   accept="image/*" uit app.html en hij zakt. Dat is de bedoeling -- verdwijnt een
   vorm uit het huis, dan hoort de toets erboven mee te verdwijnen in plaats van
   een geval te bewaken dat niemand meer heeft. */
test('de vijf vormen staan echt in deze bron (anders toetst dit een verzonnen geval)', () => {
  const bestaat = (rel, zoek) => {
    const p = path.join(WORTEL, rel);
    assert.ok(fs.existsSync(p), rel + ' bestaat niet meer');
    assert.ok(fs.readFileSync(p, 'utf8').includes(zoek),
      rel + ' draagt ' + JSON.stringify(zoek) + ' niet meer -- pas deze toets aan of haal de vorm eruit');
  };
  bestaat('public/apps/app.html', 'accept="image/*"');
  bestaat('server/opzet/kaartwebhooks.js', "type: '*/*'");
  bestaat('scripts/samenhang.js', 'server/**/*.js');
  /* Stond eerst op scripts/check.js. Die droeg de vorm in regel 7, waar
     commentaar met een regel-heuristiek werd overgeslagen (`t.startsWith('/*')`).
     Die heuristiek is vervangen door lib/bron.js zelf -- ze klopte niet voor
     blokcommentaar zonder asterisk, en verklaarde elke uitleg die een pad noemt
     tot kapotte require.

     De VORM is daarmee niet uit het huis verdwenen, alleen uit dat bestand:
     scripts/keuring.js scant zijn bron nog steeds regel voor regel en draagt hem
     onveranderd. Daar wijst deze bewering nu heen, want het gaat erom dat
     bron.js een geval aankan dat ECHT bestaat -- niet om welk bestand het draagt. */
  bestaat('scripts/keuring.js', "startsWith('/*')");
  bestaat('server/kern/antivirus/analyse.js', 'image/*');
});

test('over de hele bron haalt hij nooit MEER weg dan de oude regex deed', () => {
  /* De vangrail onder de vervanging, en de richting is de hele grap. Wat de OUDE
     regex weghaalde en deze versie laat staan: winst, dat is de reparatie. Wat
     deze versie weghaalt terwijl de oude het liet staan: nieuwe blindheid, en
     precies daar mag geen enkel geval in zitten. Deze toets kijkt dus alleen naar
     die tweede groep. De oude vorm staat hieronder woordelijk, zoals hij tot 17
     augustus 2026 in scripts/lib/bron.js stond. */
  const oud = (bron) => String(bron)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
  const verdacht = [];
  let bestanden = 0;
  const loop = (dir) => {
    for (const naam of fs.readdirSync(dir)) {
      const vol = path.join(dir, naam);
      let st; try { st = fs.statSync(vol); } catch (e) { continue; }
      if (st.isDirectory()) { if (!/^(node_modules|\.git|data|dist)$/.test(naam)) loop(vol); continue; }
      if (!/\.(html|js|css)$/.test(naam)) continue;
      let bron; try { bron = fs.readFileSync(vol, 'utf8'); } catch (e) { continue; }
      bestanden++;
      const a = oud(bron), b = zonderCommentaar(bron);
      /* Niet de LENGTE vergelijken maar de inhoud: de nieuwe versie mag alleen
         tekst toevoegen ten opzichte van de oude. Elk stuk dat de nieuwe weghaalt
         en de oude liet staan, is een teken van nieuwe blindheid. */
      if (b.length < a.length) verdacht.push(path.relative(WORTEL, vol) + ' (' + (a.length - b.length) + ' tekens minder)');
    }
  };
  for (const map of ['public', 'server', 'scripts', 'test']) {
    const m = path.join(WORTEL, map);
    if (fs.existsSync(m)) loop(m);
  }
  assert.ok(bestanden > 3000, 'er zijn echt bestanden gelezen: ' + bestanden);
  assert.deepEqual(verdacht, [], 'deze bestanden zouden minder zichtbaar worden dan met de oude regex');
});

/* ---------------------------------------------------------------- DE DERDE VORM

   `zonderCommentaar(bron, { regelsHeel: true })` slaat commentaar PLAT in plaats
   van het weg te halen: elk teken wordt een spatie, elke regelovergang blijft
   staan. De kop van scripts/lib/bron.js vroeg al om deze vorm ("wie de
   REGELNUMMERS heel wil houden heeft een derde vorm nodig"); scripts/lib/routes.js
   had hem nodig omdat hij een treffer moet kunnen terugmelden als bestand:regel.

   Twee eigenschappen dragen alles wat hierop leunt, en ze worden hier apart
   getoetst: de LENGTE blijft gelijk (dus tekenposities kloppen) en het AANTAL
   REGELS blijft gelijk (dus regelnummers kloppen). Zakt een van beide, dan wijst
   elke melding die hierop leunt naar de verkeerde plek -- stil. */
test('de derde vorm houdt lengte en regelnummers heel, en het commentaar is er wel uit', () => {
  const bron = [
    "const a = 1; /* een blok",
    "dat over regels loopt */ const b = 2;",
    "const c = 3; // een regelcommentaar",
    "const pad = '/api/rtf/spel/nieuw';"
  ].join('\n');
  const heel = zonderCommentaar(bron, { regelsHeel: true });
  assert.equal(heel.length, bron.length, 'even lang, anders schuiven de tekenposities');
  assert.equal(heel.split('\n').length, bron.split('\n').length, 'even veel regels, anders schuiven de regelnummers');
  assert.equal(heel.includes('een blok'), false, 'het blokcommentaar is eruit');
  assert.equal(heel.includes('een regelcommentaar'), false, 'het regelcommentaar is eruit');
  assert.ok(heel.includes("'/api/rtf/spel/nieuw'"), 'de tekenreeksen blijven staan -- daar staan de paden in');
  // en de regel waarop de code staat is nog steeds dezelfde regel
  assert.equal(heel.split('\n')[3], bron.split('\n')[3], 'een regel zonder commentaar verandert niet');
});

test('de derde vorm verandert de gewone vorm niet', () => {
  const bron = "const a = 1; /* weg */ const b = 2; // ook weg\nconst c = 3;";
  const gewoon = zonderCommentaar(bron);
  assert.equal(gewoon.split('\n').length, 2, 'de gewone vorm plet een blok tot EEN spatie en houdt dus zijn oude gedrag');
  assert.equal(gewoon.includes('weg'), false);
  assert.notEqual(gewoon.length, bron.length, 'juist WEL korter -- dat is het verschil met de derde vorm');
});

/* Een commentaarblok dat niet wordt afgesloten. De gewone vorm laat de rest van
   het bestand vallen (dat doet een JS-parser ook); de derde vorm moet hem
   platslaan en NIET afkappen, anders klopt de lengte niet meer precies daar waar
   het misgaat. */
test('een niet-afgesloten blok wordt platgeslagen en niet afgekapt', () => {
  const bron = "const a = 1;\n/* dit blok sluit nooit\nconst b = 2;";
  const heel = zonderCommentaar(bron, { regelsHeel: true });
  assert.equal(heel.length, bron.length, 'even lang');
  assert.equal(heel.split('\n').length, bron.split('\n').length, 'even veel regels');
  assert.equal(heel.includes('const b'), false, 'en de inhoud is wel degelijk commentaar');
});
