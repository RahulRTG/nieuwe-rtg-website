/* De servicedoelen met hun foutbudget (kern/command/slo.js) en de sonde die van
   buitenaf aanklopt (kern/command/sonde.js).

   WAT DEZE TOETS VOORAL BEWAAKT is dat de meter NIET geruststelt als hij niets
   weet. De tellers in server/meting.js beginnen bij elke herstart op nul; een
   vers proces met drie verzoeken en nul fouten staat op 100% beschikbaar, en
   dat als "doel gehaald" tonen is de duurste leugen die dit scherm kan
   vertellen. Vandaar dat hier een geval staat met te weinig verkeer, en dat de
   uitslag daar 'onvoldoende gemeten' MOET zijn en niet 'gehaald'.

   Het tweede dat hier vastligt: binnen en buiten worden nergens bij elkaar
   opgeteld. Een sonde die in het serverproces zelf draait bewijst dat de
   HTTP-laag antwoordt, niet dat een klant erbij kan. Tel je die monsters bij de
   externe op, dan verdwijnt het strenge cijfer in het makkelijke.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de eis `dekking >= minimumDekking` uit `genoeg` weggelaten
     -> "te weinig gemeten heet onvoldoende gemeten en niet gehaald" ZAKT (RAAK)
   - in sonde.meld() de kant uit de melding overgenomen in plaats van vast
     'buiten' -> "een melder mag zijn eigen kant niet kiezen" ZAKT (RAAK)
   - in slo.js het uitrolslot laten aanslaan op onbeoordeelde doelen
     -> "een onbeoordeeld doel houdt de uitrol niet tegen" ZAKT (RAAK)
   - in sonde.js `verwacht.includes(status)` vervangen door `status > 0`
     -> "een onverwachte status is een storing, ook als de server antwoordt"
        ZAKT (RAAK). Die toets kwam er ACHTERAF bij: tegen een gezonde server
        slaagt elke reis toch wel, dus de eerste ronde overleefde deze mutatie
        volledig. Vandaar het weggooiservertje daar dat met opzet een 500 geeft.

   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakSlo } = require('../server/kern/command/slo');
const { maakSonde } = require('../server/kern/command/sonde');
const maakCmdOpslag = require('../server/kern/command/opslag');

/* Een nagemaakte meting. Dezelfde vorm als server/meting.js reeksen() geeft,
   want dat is het contract tussen die twee. */
function meting(opties) {
  const o = opties || {};
  const n = o.aantal == null ? 5000 : o.aantal;
  const fout = o.fout || 0;
  const verzoeken = [
    { methode: 'GET', route: '/api/leden', status: '2xx', aantal: n - fout },
    { methode: 'GET', route: '/api/leden', status: '5xx', aantal: fout },
    { methode: 'POST', route: '/api/auth/login', status: '2xx', aantal: o.login == null ? 800 : o.login },
    { methode: 'POST', route: '/api/auth/login', status: '5xx', aantal: o.loginFout || 0 }
  ];
  /* Het duurhistogram: alles onder de emmer die `snel` aanwijst. */
  const emmers = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
  const tot = o.snel == null ? 5 : o.snel;   // index 5 is 0,25 s
  return {
    reeksen: () => ({
      gestart: Date.now() - (o.gemetenMs == null ? 5 * 86400000 : o.gemetenMs),
      emmers,
      verzoeken,
      duur: [{ methode: 'GET', route: '/api/leden',
        emmers: emmers.map((_, i) => (i >= tot ? n : 0)), som: n * 0.02, aantal: n }]
    })
  };
}

const van = (st, id) => st.doelen.find(d => d.id === id);

test('een doel met genoeg verkeer en geen fouten is gehaald, met budget over', () => {
  const st = maakSlo({ meting: meting() }).stand();
  const b = van(st, 'beschikbaarheid');
  assert.equal(b.oordeel, 'gehaald');
  assert.equal(b.gemeten, 100);
  assert.equal(b.budget.restDeel, 1, 'niets verbruikt, dus het hele budget staat er nog');
  assert.equal(b.budget.op, false);
  assert.equal(st.uitrol.mag, true);
});

test('te weinig gemeten heet onvoldoende gemeten en niet gehaald', () => {
  /* DE KERN. Drie verzoeken zonder fout is rekenkundig 100%, en dat is precies
     het getal dat een vers proces na een herstart laat zien. Als deze toets
     'gehaald' zou accepteren, meet dit scherm de goedgelovigheid van de server. */
  const st = maakSlo({ meting: meting({ aantal: 3, login: 0, gemetenMs: 60000 }) }).stand();
  const b = van(st, 'beschikbaarheid');
  assert.equal(b.oordeel, 'onvoldoende gemeten');
  assert.equal(b.genoeg, false);
  assert.ok(b.venster.dekking < 0.05, 'een minuut is geen 30 dagen: ' + b.venster.dekking);

  /* En ook met genoeg verzoeken blijft het onvoldoende zolang het venster te
     kort is: veel verkeer in tien minuten zegt niets over een maand. */
  const kort = maakSlo({ meting: meting({ gemetenMs: 600000 }) }).stand();
  assert.equal(van(kort, 'beschikbaarheid').oordeel, 'onvoldoende gemeten');
});

test('fouten vreten het foutbudget op en dan gaat de uitrol dicht', () => {
  /* 1% van 5000 is 50 fouten; het budget is 0,1%. Dat is tien keer over. */
  const st = maakSlo({ meting: meting({ fout: 50 }) }).stand();
  const b = van(st, 'beschikbaarheid');
  assert.equal(b.oordeel, 'niet gehaald');
  assert.ok(b.brandsnelheid > 1, 'de brandsnelheid staat boven de 1: ' + b.brandsnelheid);
  assert.equal(b.budget.op, true);
  assert.ok(b.budget.restMinuten < 0, 'het budget staat in de min: ' + b.budget.restMinuten);
  assert.equal(st.uitrol.mag, false);
  assert.match(st.uitrol.reden, /foutbudget/);
});

test('een onbeoordeeld doel houdt de uitrol niet tegen', () => {
  /* Bewuste keuze, en hij staat hier zodat hij niet per ongeluk omslaat: een
     slot dat na elke herstart een dag dichtzit, wordt omzeild in plaats van
     gebruikt. Wel moet het antwoord zeggen HOEVEEL er onbeoordeeld is. */
  const st = maakSlo({ meting: meting({ aantal: 3, login: 0, gemetenMs: 60000 }) }).stand();
  assert.equal(st.uitrol.mag, true);
  assert.ok(st.uitrol.onbeoordeeld >= 1, 'en het zegt erbij dat er niets beoordeeld is');
  assert.match(st.uitrol.reden, /nog geen doel voldoende gemeten/);
});

test('een snelheidsdoel geeft een bovengrens en geen verzonnen punt', () => {
  const goed = maakSlo({ meting: meting({ snel: 5 }) }).stand();
  const p90 = van(goed, 'snelheid-p90');
  assert.equal(p90.oordeel, 'gehaald');
  assert.equal(p90.gemeten, 0.25);
  assert.match(p90.uitleg, /op of onder/, 'het antwoord zegt dat het een bovengrens is: ' + p90.uitleg);

  const traag = maakSlo({ meting: meting({ snel: 7 }) }).stand();   // pas vanaf 1 s gevuld
  assert.equal(van(traag, 'snelheid-p90').oordeel, 'niet gehaald');
  assert.equal(van(traag, 'snelheid-p90').budget, undefined, 'een snelheidsdoel heeft geen minutenbudget');
});

test('een doel kiest zijn eigen routes', () => {
  /* Inloggen kijkt alleen naar /api/auth/login, en staat strenger (99,95%) dan
     het brede doel (99,9%). Vier storingen op 800 inlogpogingen is voor het
     inlogdoel tien keer over het budget en voor het brede doel ruim binnen --
     precies het geval waarin een inlogstoring anders in het gemiddelde
     verdwijnt. Dat is de hele reden dat doel 4 apart bestaat. */
  const st = maakSlo({ meting: meting({ login: 796, loginFout: 4 }) }).stand();
  assert.equal(van(st, 'inloggen').oordeel, 'niet gehaald');
  assert.equal(van(st, 'beschikbaarheid').oordeel, 'gehaald');
  assert.equal(van(st, 'inloggen').metingen, 800);
});

/* ---------- de sonde ---------- */

function sonde(monsters) {
  const db = { data: { sondeMonsters: (monsters || []).slice() } };
  return { db, s: maakSonde({ db, opslag: maakCmdOpslag({ db }), save: () => {},
    reizen: () => [{ id: 'gezond', naam: 'De server antwoordt', pad: '/api/health', verwacht: [200], maxMs: 500 }] }) };
}

const monster = (extra) => Object.assign({
  at: new Date().toISOString(), reis: 'gezond', status: 200, ms: 10, gelukt: true, traag: false, reden: null,
  van: 'binnen'
}, extra || {});

test('binnen en buiten worden nergens bij elkaar opgeteld', () => {
  const { s } = sonde([
    monster({ van: 'binnen' }), monster({ van: 'binnen' }),
    monster({ van: 'buiten', gelukt: false, status: 0, reden: 'geen verbinding' })
  ]);
  const st = s.stand(24);
  assert.equal(st.binnen.pogingen, 2);
  assert.equal(st.binnen.deel, 1);
  assert.equal(st.buiten.pogingen, 1);
  assert.equal(st.buiten.deel, 0, 'de externe storing verdwijnt niet in het interne gemiddelde');
  assert.equal(st.storingen.length, 1);
});

test('zonder een meting van buitenaf zegt het scherm dat met zoveel woorden', () => {
  const { s } = sonde([monster(), monster()]);
  assert.match(s.stand(24).let, /van buitenaf/, 'de waarschuwing staat er: ' + s.stand(24).let);
  assert.equal(s.buitenkort().gemeten, false);

  const { s: met } = sonde([monster({ van: 'buiten' })]);
  assert.equal(met.stand(24).let, null, 'is er wel van buitenaf gemeten, dan is er niets te waarschuwen');
  assert.equal(met.buitenkort().gemeten, true);
});

test('een melder mag zijn eigen kant niet kiezen', () => {
  /* Wie meldt, meldt van buitenaf -- dat is de enige reden dat die ingang
     bestaat. Zou de melding zelf 'binnen' mogen zeggen, dan kan iemand het
     strenge cijfer opvullen met makkelijke metingen. */
  const { s } = sonde([]);
  const r = s.meld({ monsters: [{ reis: 'gezond', status: 200, ms: 12, gelukt: true, van: 'binnen' }] });
  assert.equal(r.aangenomen, 1);
  const st = s.stand(24);
  assert.equal(st.buiten.pogingen, 1, 'de melding telt als buiten');
  assert.equal(st.binnen.pogingen, 0, 'en niet als binnen');
});

test('een melding met een onbekende reis wordt geweigerd', () => {
  const { s } = sonde([]);
  const r = s.meld({ monsters: [{ reis: 'verzonnen', status: 200, gelukt: true }] });
  assert.equal(r.status, 400, 'niets bruikbaars is een fout en geen stille nul');
  assert.equal(s.meld({}).status, 400);

  const half = s.meld({ monsters: [
    { reis: 'gezond', status: 200, gelukt: true },
    { reis: 'verzonnen', status: 200, gelukt: true }
  ] });
  assert.equal(half.aangenomen, 1);
  assert.equal(half.geweigerd, 1, 'en het zegt hoeveel er is weggelaten');
});

/* EEN REIS DIE HOORT TE ZAKKEN. Dit geval stond er eerst niet, en toen
   overleefde een mutatie die `verwacht.includes(status)` verving door
   `status > 0`: alle reizen tegen een gezonde server slaagden immers toch wel.
   Een sonde die elk antwoord goed vindt, meldt tijdens een storing een groene
   maand -- precies waar deze hele laag tegen bedoeld is. */
test('een onverwachte status is een storing, ook als de server antwoordt', async () => {
  const http = require('node:http');
  const srv = http.createServer((req, res) => {
    if (req.url === '/goed') { res.writeHead(200); return res.end('ok'); }
    res.writeHead(500); res.end('stuk');
  });
  await new Promise(k => srv.listen(0, '127.0.0.1', k));
  const basis = 'http://127.0.0.1:' + srv.address().port;
  const db = { data: {} };
  const s = maakSonde({ db, opslag: maakCmdOpslag({ db }), save: () => {}, reizen: () => [
    { id: 'goed', naam: 'Werkt', pad: '/goed', verwacht: [200], maxMs: 2000 },
    { id: 'stuk', naam: 'Stuk', pad: '/stuk', verwacht: [200], maxMs: 2000 }
  ] });
  try {
    const r = await s.draai({ basis });
    const goed = r.monsters.find(m => m.reis === 'goed');
    const stuk = r.monsters.find(m => m.reis === 'stuk');
    assert.equal(goed.gelukt, true);
    assert.equal(stuk.status, 500, 'de server ANTWOORDT wel');
    assert.equal(stuk.gelukt, false, 'maar met de verkeerde status, en dat is een storing');
    assert.match(stuk.reden, /500 terwijl 200/, 'met de reden erbij: ' + stuk.reden);
    assert.equal(r.gelukt, 1);
    assert.equal(r.van, 'binnen', '127.0.0.1 is de binnenkant');
  } finally {
    await new Promise(k => srv.close(k));
  }
});

test('de SLO-stand draagt de externe meting apart mee', () => {
  const { s } = sonde([monster({ van: 'buiten', gelukt: false })]);
  const st = maakSlo({ meting: meting(), sonde: s }).stand();
  assert.equal(st.bron.buiten.gemeten, true);
  assert.equal(st.bron.buiten.mislukt, 1);
  assert.match(st.bron.binnen, /herstart/, 'en het zegt erbij waarom de interne telling beperkt is');
});
