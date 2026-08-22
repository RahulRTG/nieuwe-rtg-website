/* HET PLATFORMREGISTER: VAN ELK DING WAT HET IS, WAT HET DOET, AAN OF UIT, EN
   WAT WE ERVAN WETEN.

   Draai los: node --experimental-sqlite --test test/platformregister.test.js

   WAT HIER BEWEZEN WORDT.

   1. DE DEUR. Achter dezelfde kantoordeur als de rest.

   2. ER BLIJFT NIETS ONBENOEMD. Elke route van dit huis hoort bij precies EEN
      ding met een naam en een uitleg. Dit is de kerntoets: zolang er routes
      overblijven, is "wij weten van alles wat het is" niet waar. Ze mogen niet
      stil in een restpost verdwijnen -- dezelfde fout als "bewaker zonder
      bekende rol" en `mw`.

   3. VIER VELDEN PER DING, ALTIJD. wat het is (naam), wat het doet (doet),
      aan/uit (schakel) en status. Een ding dat er een mist, hoort er niet in;
      dan is het een catalogusregel en geen bedieningspaneel.

   4. NIET SCHAKELBAAR DRAAGT ALTIJD EEN REDEN. Een ding zonder schakelaar is
      geen ONTBREKENDE schakelaar. Zonder reden leest het wel zo.

   5. EEN VERZONNEN METING IS ERGER DAN GEEN METING. De schermstatus komt uit
      .schermjournaal. Ligt dat er niet, dan is de status ONGEMETEN -- niet
      "nooit geopend". Dat ging hier echt mis: geopendeSchermen() neemt een pad,
      werd zonder pad aangeroepen, gaf keurig null, en alle 260 schermen kwamen
      als "nooit geopend" uit het register.

   6. HET ZEGT NOOIT "IN ORDE". De bewijsdekking van dit huis is 36%. Een
      register dat daar een geruststellend woord van maakt, meet niet.

   DE MUTATIES (LAT.md regel 2). Vier gedaan; drie beten meteen, en de vierde
   NIET -- en die vierde was de nuttigste van de vier.

     officeAuth van de route halen                     -> toets 1 zakt
     de reden bij een niet-schakelbaar ding leegmaken   -> toets 4 zakt
     de journaalcontrole omzeilen (waarneming nooit
       null, dus een ontbrekend journaal leest als
       "nooit geopend")                                 -> toets 5 zakt

     een prefix uit BEDIENING halen (/api/scim)         -> BEET EERST NIET.

   Die laatste hoorde negen routes onbenoemd te maken en deed niets. De oorzaak:
   padWijzer() had een eigen, LOSSERE kopie van de padregel met als laatste tak
   `pad.startsWith(p)` zonder grens. Met '/' in de bedieningslijst viel daardoor
   ELKE route ergens onder, kwam er nooit iets als onbenoemd terug, en kon toets 2
   principieel niet zakken -- een toets die geruststelde zonder iets te bewaken
   (LAT.md regel 9).

   De reparatie zat een laag dieper dan de toets: server/functies/toegang.js had
   die regel al goed (prefixLengte, met grens) en die wordt nu gedeeld in plaats
   van nagemaakt (LAT.md regel 4). Meteen daarna zakte toets 2 uit zichzelf, en
   dat was terecht: vier routes hoorden werkelijk bij geen enkel ding
   (/scriptbundel.js, /stijlbundel.css, /media/:naam, /werken/:code). Ze staan nu
   met naam en reden in BEDIENING. Pas daarna beet de mutatie zoals hij hoort. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-platformregister-'));

test.before(async () => {
  srv = await startServer({ env: { RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-REGISTER-1' } });
  base = srv.base;
  token = await kantoorAlsPersoon(base);
  assert.ok(token, 'het kantoor logt in');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const vraag = (body, mee) => fetch(base + '/api/office/platformregister', {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' },
    mee === false ? {} : { Authorization: 'Bearer ' + token }),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('1. het platformregister zit achter de kantoordeur', async () => {
  assert.equal((await vraag({}, false)).status, 401);
  assert.equal((await vraag({})).status, 200);
});

test('2. er blijft geen enkele route onbenoemd', async () => {
  const d = (await vraag({ limiet: 1 })).body;
  assert.deepEqual(d.onbenoemd, [],
    'deze routes horen bij geen enkel ding; zolang dat zo is kan niemand zeggen wat ze zijn. ' +
    'Zet hun prefix in de functiecatalogus of in BEDIENING (kern/platformregister.js). ' +
    'Nu onbenoemd: ' + JSON.stringify(d.onbenoemd.slice(0, 10)));
  assert.ok(d.routes > 1000, 'het register gaat over alle routes van het huis (' + d.routes + ')');
  assert.ok(d.totaal > 400, 'en over alle vier de soorten dingen (' + d.totaal + ')');
});

test('3. elk ding draagt alle vier de velden', async () => {
  /* Alles ophalen, niet een pagina: een steekproef zou juist het ding missen
     waar een veld ontbreekt. */
  const d = (await vraag({ limiet: 200, pagina: 1 })).body;
  let gezien = 0;
  for (let p = 1; p <= d.lijst.paginas; p++) {
    const bl = (await vraag({ limiet: 200, pagina: p })).body.lijst.resultaten;
    for (const x of bl) {
      gezien++;
      assert.ok(x.soort, 'soort ontbreekt op ' + JSON.stringify(x).slice(0, 80));
      assert.ok(x.naam, 'WAT HET IS ontbreekt op ' + x.soort + ':' + x.id);
      assert.ok(x.schakel && typeof x.schakel.schakelbaar === 'boolean',
        'AAN/UIT ontbreekt op ' + x.soort + ':' + x.id);
      assert.ok(x.status && x.status.staat,
        'STATUS ontbreekt op ' + x.soort + ':' + x.id);
    }
  }
  assert.equal(gezien, d.totaal, 'alle dingen zijn langsgekomen');
});

test('4. niet schakelbaar draagt altijd een reden', async () => {
  const d = (await vraag({ limiet: 200 })).body;
  for (let p = 1; p <= d.lijst.paginas; p++) {
    for (const x of (await vraag({ limiet: 200, pagina: p })).body.lijst.resultaten) {
      if (x.schakel.schakelbaar) continue;
      assert.ok(x.schakel.reden && x.schakel.reden.length > 15,
        x.soort + ':' + x.id + ' valt niet te schakelen maar zegt niet waarom. ' +
        'Zonder reden leest dat als een ontbrekende schakelaar.');
    }
  }
});

test('5. zonder schermjournaal is de schermstatus ONGEMETEN, niet "nooit geopend"', async () => {
  const d = (await vraag({ soort: 'scherm', limiet: 200 })).body;
  const telling = d.perSoort.scherm.telling;
  assert.ok(d.perSoort.scherm.totaal > 100, 'er zijn schermen (' + d.perSoort.scherm.totaal + ')');

  /* Ligt .schermjournaal er niet, dan MOET alles ongemeten zijn. Ligt hij er
     wel, dan mag er van alles staan -- maar niet alles op nooit geopend, want
     dat is precies waar de fout zich als een meting voordeed. */
  const journaal = path.join(__dirname, '..', '.schermjournaal');
  if (!fs.existsSync(journaal)) {
    assert.equal(telling.ongemeten, d.perSoort.scherm.totaal,
      'zonder .schermjournaal hoort ELK scherm ongemeten te zijn; nu: ' + JSON.stringify(telling));
    assert.ok(!telling['nooit geopend'],
      'een ontbrekend journaal mag geen "nooit geopend" opleveren -- dat is een verzonnen meting');
  } else {
    assert.notEqual(telling['nooit geopend'], d.perSoort.scherm.totaal,
      'er ligt een schermjournaal, maar ELK scherm staat op nooit geopend; ' +
      'dat wijst op een journaal dat niet gelezen wordt');
  }
});

test('6. het register zegt nooit "in orde"', async () => {
  /* De bewijsdekking is 36%. Er bestaat geen staat die dat geruststellend
     samenvat, en die hoort er ook niet te komen zolang het niet waar is. */
  const d = (await vraag({ limiet: 200 })).body;
  const staten = new Set();
  for (let p = 1; p <= d.lijst.paginas; p++) {
    for (const x of (await vraag({ limiet: 200, pagina: p })).body.lijst.resultaten) staten.add(x.status.staat);
  }
  for (const s of staten) {
    assert.ok(!/^(in orde|ok|goed|veilig)$/i.test(s),
      'de staat "' + s + '" stelt gerust zonder dat het bewijs dat draagt');
  }
  assert.ok(staten.has('deels bewezen') || staten.has('ongemeten'),
    'de eerlijke staten horen erin te zitten; gezien: ' + [...staten].join(', '));
});

test('7. het aandachtsfilter levert werk op, en minder dan alles', async () => {
  const alles = (await vraag({ limiet: 1 })).body;
  const werk = (await vraag({ alleenAandacht: true, limiet: 1 })).body;
  assert.ok(werk.lijst.totaal > 0, 'er is werk (en zo niet, dan klopt er iets niet)');
  assert.ok(werk.lijst.totaal < alles.lijst.totaal,
    'het filter hoort te filteren: ' + werk.lijst.totaal + ' van ' + alles.lijst.totaal);
});
