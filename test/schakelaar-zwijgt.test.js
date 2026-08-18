/* WAT EEN BELLER TE HOREN KRIJGT ALS IETS DICHT STAAT -- en waarom de twee
   assen daarin NIET gelijk zijn.

   HOE DIT BEGON. `node scripts/ladder.js`, de trede "de dwaler", die op elke
   deur klopt zonder sleutel. Hij meldde twee keer "een verzoek zonder token gaf
   een serverfout": POST /api/site/domein en POST /api/supplier/site/domein.
   Nagelopen met curl:

     $ curl -X POST /api/site/domein            (geen token)
     503 {"error":"Deze functie is tijdelijk uitgeschakeld door de beheerder.",
          "functie":"dom-eigendomein",
          "naam":"Eigen domein (buiten het RTG-web)","reden":"globaal"}

   terwijl de buurroute /api/site/cijfers -- exact dezelfde `auth`-deur, alleen
   zonder schakelaar -- gewoon 401 gaf.

   WAT DAARVAN EEN REPARATIE WERD, EN WAT EEN BESLUIT BLEEK.

   De BEVOEGDHEIDS-as is gerepareerd. Die vertelt welk vermogen RTG mist, met
   welke reden en wat ervoor nodig is; server/middleware/functieschakelaars.js
   had daar al over geschreven dat hij "nooit voor de deur antwoordt" en dat het
   fout was dat hij "aan een willekeurige beller vertelde welke vermogens dicht
   staan en waarom". Alleen deed de code dat maar half: de alinea belooft ook te
   zwijgen tegen wie "niemand is", en doelgroepVanVerzoek() leidt de doelgroep
   OOK uit het pad af -- /api/supplier, /api/staff, /api/office en
   /api/foundation leveren er een op zonder gebruiker. Een belofte in tekst die
   geen belofte in code was (LAT.md regel 6).

   De SCHAKELAAR-as is NIET veranderd, en dat is de belangrijkste helft van dit
   bestand. Ik had hem eerst ook dichtgezet. Twee bestaande toetsen spraken dat
   tegen, allebei met zoveel woorden "ook zonder inlog": test/boardroom.test.js
   (503 met `functie: 'charter'`) en test/techniek-functies.test.js (hetzelfde
   voor het schoolkanaal). En charter heeft doelgroepen LEDEN -- precies als
   dom-eigendomein -- dus geen enkele regel in de gegevens scheidt het ene geval
   van het andere. Dat maakt het een keuze en geen fout, en niet een die deze
   laag stilletjes hoort te herzien.

   Daarom staat die kant hier ook als PROEF en niet alleen als opmerking: een
   volgende reparatie die dit opnieuw tegenkomt, moet het verschil zien voordat
   hij het verkeerde half dichtzet.

   Draai: node --experimental-sqlite --test test/schakelaar-zwijgt.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const antwoord = require('../server/middleware/schakelaar-antwoord');

/* ==================== 1. DE BEVOEGDHEID ZWIJGT ==================== */

test('een onbekende beller krijgt geen vergunningsgegevens te zien', () => {
  const f = { id: 'bank-krediet', naam: 'Krediet' };
  const oordeel = { uitleg: 'Hiervoor is een vergunning nodig.', vermogen: 'krediet',
    reden: 'geen-vergunning', nodig: 'AFM-registratie' };

  const vreemde = antwoord.bevoegdheid(false, f, oordeel);
  assert.equal(vreemde.error, antwoord.ZIN.globaal, 'de neutrale zin, en verder niets');
  for (const veld of ['functie', 'naam', 'vermogen', 'bevoegdheidReden', 'nodig']) {
    assert.equal(veld in vreemde, false,
      'het veld "' + veld + '" hoort niet naar een beller te gaan die zich niet heeft bekendgemaakt; ' +
      'gekregen: ' + JSON.stringify(vreemde));
  }
});

test('wie zich WEL heeft bekendgemaakt, houdt de volledige uitleg', () => {
  /* De andere helft, en even hard. Een reparatie die de uitleg voor iedereen
     wegneemt is geen beveiliging maar een verslechtering: wie een knop niet ziet
     werken hoort te lezen waarom. */
  const uit = antwoord.bevoegdheid(true, { id: 'bank-krediet', naam: 'Krediet' },
    { uitleg: 'Hiervoor is een vergunning nodig.', vermogen: 'krediet', reden: 'geen-vergunning', nodig: 'AFM' });
  assert.equal(uit.functie, 'bank-krediet');
  assert.equal(uit.vermogen, 'krediet');
  assert.equal(uit.nodig, 'AFM');
});

test('bekendeBeller gaat over WIE er belt, niet over of er iets is meegestuurd', () => {
  /* Zou deze vraag afgaan op "er zat een token in het verzoek", dan is het gat
     met een willekeurige hex-string weer open en heeft de reparatie niets
     opgeleverd. verifyToken() en sessionFor() geven bij een verzonnen token
     allebei niets terug, en dat is precies wat hier binnenkomt. */
  assert.equal(antwoord.bekendeBeller(null, null), false, 'niemand is niemand');
  assert.equal(antwoord.bekendeBeller({ id: 7 }, null), true, 'een geverifieerd account telt');
  assert.equal(antwoord.bekendeBeller(null, { tier: 'gast' }), true, 'een sessie telt: een gast is ook iemand');
});

/* ==================== 2. DE SCHAKELAAR VERTELT HET WEL ====================
   Vastgelegd omdat het een besluit is en geen toeval. Zou iemand deze kant
   "ook maar even" dichtzetten, dan zakken boardroom.test.js en
   techniek-functies.test.js -- maar pas nadat hij de wijziging heeft gemaakt.
   Deze proef zegt het vooraf, op de plek waar hij aan het werk is. */

test('een uitgeschakelde functie noemt zichzelf, ook tegen een beller zonder inlog', () => {
  const uit = antwoord.dicht(false, { id: 'charter', naam: 'Boten & jachten', reden: 'globaal' }, null);
  assert.equal(uit.functie, 'charter', 'dit is bewust zo -- zie de kop van dit bestand');
  assert.equal(uit.naam, 'Boten & jachten');
  assert.equal(uit.reden, 'globaal');
});

/* ==================== 3. DE DEUR BLIJFT DE DEUR ====================
   Tegen een echte server, want de twee helften hierboven zijn functies en zeggen
   niets over de KETEN. Dit is het ijkpunt: een route met een auth-deur en zonder
   schakelaar hoort een anonieme beller gewoon 401 te geven. Verandert daar iets
   aan, dan meet alles hierboven niet meer wat het denkt te meten. */

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-schakelaar-'));
let srv, base;

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }); base = srv.base; });
test.after(async () => { await stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('een route met een deur en zonder schakelaar antwoordt een vreemde met 401', async () => {
  const r = await fetch(base + '/api/site/cijfers', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
  });
  assert.equal(r.status, 401, 'zonder schakelaar hoort de deur zelf te antwoorden');
});
