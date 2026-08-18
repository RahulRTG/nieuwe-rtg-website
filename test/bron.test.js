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
  bestaat('scripts/check.js', "startsWith('/*')");
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
