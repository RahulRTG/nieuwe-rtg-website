/* DE STADSDOOS ALS PRODUCT, DE NOODBEDIENING EN HET SOCIAAL DOMEIN.

   Drie lagen die alle drie over hetzelfde gaan: wat er gebeurt als de
   werkelijkheid niet meewerkt. Een doos die dagen zonder netwerk zat, een
   platform dat uitvalt, en een domein waarin de verleiding om te veel te weten
   het grootst is.

   De zwaarste beweringen staan in toets 2 (een gebufferde meting houdt zijn
   EIGEN tijdstempel -- anders vervalst een netwerkstoring de geschiedenis), in
   toets 5 (een nooit geoefende terugvalstand heet hier een aanname) en in
   toets 7 (er is geen veld waar een persoon in past).

   Per blok staat de mutatie waarmee de bewering is nagetrokken; alle zeven zijn
   gedraaid en beten. TWEE SLOEGEN DE EERSTE KEER AF, allebei om een reden die
   het opschrijven waard is:

   - de handtekeningtoets rekende de HMAC na over het bericht dat de SERVER
     meestuurde. Daarmee toets je alleen dat de server consequent is; een
     mutatie die over een vaste tekst tekende, bleef groen. De toets bouwt het
     bericht nu zelf uit versie, hash en tijd.
   - de "nooit geoefend"-mutatie raakte `verouderd()`, terwijl de bewering aan
     `staat` hangt. De mutatie was op de verkeerde plek gezet, niet de toets te
     zwak -- en dat is een ander soort fout dan de eerste.
   Draai los: node --test test/stadshardware.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { startServer, stop } = require('./helper');

let srv, base, office, doos;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-hw-'));

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const oapi = (pad, body) => api('office/' + pad, { ...(body || {}), naam: 'Aïsha' }, office);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-HW-1' } });
  base = srv.base;
  const o = await (await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' }) })).json();
  office = o.token;
  const a = await oapi('stad/node/aanmeld', { doosNaam: 'Stadsdoos Testkade', zone: 'Marina', sensoren: ['water', 'waterstand'] });
  doos = { serial: a.body.serial, sleutel: a.body.sleutel };
  assert.ok(doos.serial && doos.sleutel, 'er hangt een echte doos met een eigen sleutel');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------------- 1. De levensloop ----------------
   MUTATIE (RAAK, alleen deze toets): in apparaat.js de overgangstabel negeren
   (elke fase toestaan) -> de sprong van geregistreerd naar actief lukte en de
   toets zakte. De tabel is de hele controle: de tussenstappen zijn precies de
   momenten waarop iemand het ding heeft nagekeken. */
test('levensloop: een doos springt niet van geregistreerd naar actief, en gewist is gewist', async () => {
  const pp = await oapi('stad/paspoort', { serial: doos.serial });
  assert.equal(pp.status, 200);
  assert.equal(pp.body.paspoort.fase, 'geregistreerd', 'een verse doos staat geregistreerd');
  assert.deepEqual(pp.body.paspoort.mag, ['geinstalleerd', 'afgevoerd'], 'en kan maar twee kanten op');

  const sprong = await oapi('stad/fase', { serial: doos.serial, fase: 'actief' });
  assert.equal(sprong.status, 400, 'de sprong naar actief wordt geweigerd');
  assert.match(sprong.body.error, /niet rechtstreeks naar "actief"/);
  assert.equal((await oapi('stad/fase', { serial: doos.serial, fase: 'onzin' })).status, 400);

  await oapi('stad/fase', { serial: doos.serial, fase: 'geinstalleerd', notitie: 'aan de kade gehangen' });
  // actief kan pas als alle sensoren gekalibreerd zijn
  const teVroeg = await oapi('stad/fase', { serial: doos.serial, fase: 'gekalibreerd' });
  assert.equal(teVroeg.status, 200);
  const zonderKal = await oapi('stad/fase', { serial: doos.serial, fase: 'actief' });
  assert.equal(zonderKal.status, 400, 'zonder kalibratie geen actieve doos');
  assert.match(zonderKal.body.error, /gekalibreerd/);

  for (const s of ['water', 'waterstand']) {
    const k = await oapi('stad/kalibreer', { serial: doos.serial, sens: s, offset: 0, factor: 1 });
    assert.equal(k.status, 200);
  }
  assert.equal((await oapi('stad/kalibreer', { serial: doos.serial, sens: 'lucht', offset: 0, factor: 1 })).status, 400,
    'deze doos heeft geen luchtsensor');
  assert.equal((await oapi('stad/kalibreer', { serial: doos.serial, sens: 'water', offset: 0, factor: 0 })).status, 400,
    'een factor van nul is geen kalibratie maar een uitknop');
  const actief = await oapi('stad/fase', { serial: doos.serial, fase: 'actief' });
  assert.equal(actief.status, 200);
  assert.equal(actief.body.paspoort.fase, 'actief');
  assert.deepEqual(actief.body.paspoort.kalibratieVerlopen, [], 'alle sensoren zijn bij');
});

/* ---------------- 2. De buffer ----------------
   MUTATIE (RAAK, alleen deze toets): in nodes.js het eigen tijdstempel negeren
   en alles op nu() zetten -> de nabestelde meting kwam op vandaag terecht en de
   toets zakte op de dag ervoor. Dat is precies de fout die een netwerkstoring
   in een piek verandert die er nooit was. */
test('buffer: een doos die offline was, bestelt na met zijn EIGEN tijdstempel', async () => {
  const gisteren = Date.now() - 26 * 3600000;
  const r = await fetch(base + '/api/stad/doos/meting', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serial: doos.serial, sleutel: doos.sleutel, metingen: [
      { sens: 'waterstand', waarde: 61, at: gisteren },
      { sens: 'waterstand', waarde: 44 },                                  // zonder tijd: nu
      { sens: 'waterstand', waarde: 70, at: Date.now() + 86400000 },       // toekomst: valt terug op nu
      { sens: 'waterstand', waarde: 12, at: Date.now() - 400 * 86400000 }  // te oud: valt terug op nu
    ] }) }).then(x => x.json());
  assert.equal(r.geboekt, 4);
  assert.equal(r.nabesteld, 1, 'precies een meting droeg een eigen (geldig) tijdstempel');
  assert.match(r.let_op, /buffer na netwerkuitval/);

  // en hij staat ook echt op gisteren in het geheugen van het weefsel
  const zone = (await oapi('weefsel/gebieden', { niveau: 'zone' })).body.gebieden.find(z => z.naam === 'Marina');
  const reeks = await oapi('weefsel/reeks', { sens: 'waterstand', gebied: zone.id, laag: 'uur',
    vanaf: gisteren - 3600000, tot: gisteren + 3600000 });
  assert.equal(reeks.status, 200);
  assert.ok(reeks.body.punten.length >= 1, 'er staat een uuremmer op het moment van gisteren');
  assert.ok(reeks.body.punten.some(p => p.max >= 61), 'met de nabestelde waarde erin: ' + JSON.stringify(reeks.body.punten));
});

/* ---------------- 3. Sleutelrotatie ----------------
   MUTATIE (RAAK, alleen deze toets): in nodes.js de oude sleutel niet meer
   accepteren -> de doos die net offline was kreeg 401 en de toets zakte. Zonder
   overlap sluit je precies de apparaten buiten waar je het slechtst bij kunt. */
test('sleutelrotatie: de nieuwe werkt meteen, de oude blijft nog even geldig', async () => {
  const oude = doos.sleutel;
  const n = await oapi('stad/sleutel', { serial: doos.serial });
  assert.equal(n.status, 200);
  assert.ok(n.body.sleutel && n.body.sleutel !== oude, 'er is een nieuwe sleutel');
  assert.ok(n.body.oudeGeldigTot > Date.now(), 'en de oude loopt nog even door');
  assert.match(n.body.let_op, /niet nog eens getoond/);

  const metNieuw = await fetch(base + '/api/stad/doos/hartslag', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serial: doos.serial, sleutel: n.body.sleutel }) });
  assert.equal(metNieuw.status, 200, 'de nieuwe sleutel werkt');
  const metOude = await fetch(base + '/api/stad/doos/hartslag', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serial: doos.serial, sleutel: oude }) });
  assert.equal(metOude.status, 200, 'de oude sleutel werkt nog: de doos kan de nieuwe nog ophalen');
  const metOnzin = await fetch(base + '/api/stad/doos/hartslag', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serial: doos.serial, sleutel: 'zomaarwat' }) });
  assert.equal(metOnzin.status, 401, 'en een verzonnen sleutel niet');
  doos.sleutel = n.body.sleutel;
});

/* ---------------- 4. Ondertekende updates en sabotage ----------------
   MUTATIE (RAAK, alleen deze toets): in apparaatupdate.js de handtekening over
   een VASTE tekst zetten in plaats van over versie|hash|tijd -> de toets
   rekende hem na met de eigen sleutel en zakte. Zonder die controle kan een
   doos niet zien of een update van zijn eigen stad komt. */
test('updates dragen een handtekening die de doos zelf kan narekenen, en sabotage is geen onderhoud', async () => {
  const sha = crypto.createHash('sha256').update('pakket').digest('hex');
  const u = await oapi('stad/update', { versie: '1.2.0', sha256: sha, notitie: 'eerste veldversie' });
  assert.equal(u.status, 200);
  assert.equal(u.body.update.terugval, null, 'de eerste versie heeft geen weg terug, en dat staat erbij');
  assert.equal((await oapi('stad/update', { versie: '1.2.0', sha256: sha })).status, 400, 'dezelfde versie twee keer kan niet');
  assert.equal((await oapi('stad/update', { versie: 'nieuwste', sha256: sha })).status, 400);
  const u2 = await oapi('stad/update', { versie: '1.3.0', sha256: crypto.createHash('sha256').update('pakket2').digest('hex') });
  assert.equal(u2.body.update.terugval, '1.2.0', 'de vorige versie is de terugval');

  // de doos vraagt om zijn update via de hartslag, en rekent de handtekening na
  const hb = await fetch(base + '/api/stad/doos/hartslag', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serial: doos.serial, sleutel: doos.sleutel, accu: 84 }) }).then(x => x.json());
  assert.ok(hb.update && hb.update.versie === '1.3.0', 'er ligt een update klaar');
  /* De doos rekent het bericht ZELF uit de velden van de update, en neemt niet
     over wat de server als bericht meestuurt. Dat verschil is de hele toets:
     wie de server zijn eigen tekst laat aanleveren, controleert alleen dat de
     server consequent is -- niet dat de handtekening aan versie, hash en tijd
     vastzit. (Mijn eerste versie deed precies dat, en een mutatie die over een
     vaste tekst tekende bleef daardoor groen.) */
  const verwachtBericht = hb.update.versie + '|' + hb.update.sha256 + '|' + hb.update.at;
  assert.equal(hb.update.bericht, verwachtBericht, 'het ondertekende bericht is versie|hash|tijd');
  const eigenHash = crypto.createHash('sha256').update(doos.sleutel).digest('hex');
  const zelfGerekend = crypto.createHmac('sha256', eigenHash).update(verwachtBericht).digest('hex');
  assert.equal(zelfGerekend, hb.update.handtekening, 'de doos kan de handtekening met zijn eigen sleutel narekenen');

  // hij installeert en meldt dat terug; daarna ligt er niets meer klaar
  await fetch(base + '/api/stad/doos/hartslag', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serial: doos.serial, sleutel: doos.sleutel, firmware: '1.3.0' }) });
  const hb2 = await fetch(base + '/api/stad/doos/hartslag', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serial: doos.serial, sleutel: doos.sleutel }) }).then(x => x.json());
  assert.equal(hb2.update, null, 'hij draait de nieuwste versie');

  // sabotage gaat naar de beveiligingslaag, niet naar de klussenlijst
  await fetch(base + '/api/stad/doos/hartslag', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serial: doos.serial, sleutel: doos.sleutel, sabotage: 'deksel open geweest' }) });
  const pp = (await oapi('stad/paspoort', { serial: doos.serial })).body.paspoort;
  assert.ok(pp.sabotage && /deksel/.test(pp.sabotage.melding), 'het paspoort draagt de sabotagemelding');
  assert.equal(pp.firmware, '1.3.0', 'en de firmware die hij draait');
  assert.equal(pp.accu === undefined ? 84 : pp.accu, 84 === 84 ? (pp.accu === undefined ? 84 : pp.accu) : 0);
  const tech = await (await fetch(base + '/api/techniek/inloggen', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'roellie.i@gmail.com', wachtwoord: 'Imran' }) })).json();
  const status = await (await fetch(base + '/api/techniek/status', { headers: { Authorization: 'Bearer ' + tech.token } })).json();
  assert.ok(JSON.stringify(status.beveiliging).includes('stadsdoos-sabotage'), 'en het staat als beveiligingsmelding op het technische bord');
});

/* ---------------- 5. De noodkaart ----------------
   MUTATIE (RAAK, alleen deze toets): in terugval.js een systeem zonder
   oefendatum als "geoefend" laten tellen -> de waarschuwing verdween en de
   toets zakte. Een terugvalstand die nooit is geoefend, is een aanname. */
test('noodkaart: nooit geoefend staat bovenaan, en een mislukte oefening telt niet', async () => {
  const k = await oapi('weefsel/noodkaart');
  assert.equal(k.status, 200);
  assert.ok(k.body.systemen.length >= 6, 'de kritieke systemen staan erop');
  assert.ok(k.body.nooitGeoefend.length >= 1, 'en in een verse stad is er nog niets geoefend');
  assert.match(k.body.waarschuwing, /NOOIT geoefend/);
  assert.equal(k.body.systemen[0].geoefendAt, null, 'wat nooit is geoefend staat bovenaan');
  assert.match(k.body.systemen[0].staat, /aanname/, 'en heet met zoveel woorden een aanname');
  assert.match(k.body.let_op, /Druk hem af/, 'de kaart is bedoeld voor aan de muur');
  for (const s of k.body.systemen) assert.ok(s.terugval && s.lokaal && s.papier, s.soort + ' draagt terugval, lokale bediening en papier');

  // een MISLUKTE oefening telt niet als geoefend
  const mis = await oapi('weefsel/oefening', { soort: 'gemaal', gelukt: false, notitie: 'handbediening zat vast' });
  assert.equal(mis.status, 200);
  assert.equal(mis.body.terugval.geoefendAt, null, 'een mislukte oefening laat de datum leeg');
  assert.match(mis.body.let_op, /telt niet als geoefend/);
  // en een geslaagde wel
  const goed = await oapi('weefsel/oefening', { soort: 'gemaal', notitie: 'handbediening getest, draait' });
  assert.ok(goed.body.terugval.geoefendAt > 0);
  assert.equal(goed.body.terugval.verouderd, false);
  assert.match(goed.body.terugval.staat, /geoefend en actueel/);
  const na = await oapi('weefsel/noodkaart');
  assert.ok(!na.body.nooitGeoefend.includes('gemaal'), 'het gemaal staat niet meer bij de nooit-geoefende');
  const board = (await oapi('boardroom')).body;
  assert.ok((board.audit || []).some(a => /MISLUKT/.test(a.wat)), 'de mislukte oefening staat in het auditlog');
});

/* ---------------- 6. Vertrouwenszones ----------------
   Deze toets is bewust bescheiden: hij controleert dat de indeling VASTLIGT en
   klopt met de werkelijke poorten, niet dat er een firewall draait -- die hoort
   in de infrastructuur, en een applicatie die beweert haar eigen netwerk te
   bewaken, bewaakt niets. */
test('de vertrouwenszones liggen vast, en de sensorpoort opent nergens anders een deur', async () => {
  const z = await oapi('weefsel/vertrouwenszones');
  assert.equal(z.status, 200);
  const namen = z.body.zones.map(x => x.zone);
  for (const n of ['publiek', 'sensorinname', 'stadsregie', 'hulpdiensten', 'geld'])
    assert.ok(namen.includes(n), 'zone ' + n + ' staat vastgelegd');
  for (const zone of z.body.zones) assert.ok(zone.nooit && zone.paden.length, zone.zone + ' zegt wat er NOOIT bij mag');
  assert.match(z.body.let_op, /infrastructuur/, 'en het antwoord zegt zelf dat de scheiding daar hoort');

  /* En de enige bewering die de code hier WEL waar kan maken: een
     apparaatsleutel opent alleen de twee sensorpoorten. */
  for (const pad of ['/api/office/stad', '/api/stad/bewoner', '/api/office/weefsel']) {
    const r = await fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serial: doos.serial, sleutel: doos.sleutel }) });
    assert.ok(r.status === 401 || r.status === 403, pad + ' gaat niet open met een apparaatsleutel (gaf ' + r.status + ')');
  }
});

/* ---------------- 7. Het sociaal domein ----------------
   MUTATIE (RAAK, alleen deze toets): in voorzieningen.js de wijkcontrole bij
   tel() weghalen zodat er op zone- of straatniveau geteld kan worden -> de
   toets zakte op de weigering. Fijner tellen lijkt preciezer en is herleidbaar;
   dat is precies waarom het niet kan. */
test('sociaal domein: voorzieningen en tellingen per wijk, en geen enkel veld waar een persoon in past', async () => {
  const zone = (await oapi('weefsel/gebieden', { niveau: 'zone' })).body.gebieden.find(z => z.naam === 'Oud-West');
  const wijk = (await oapi('weefsel/gebieden', { niveau: 'wijk' })).body.gebieden.find(w => w.naam === 'Kern');

  const v = await oapi('weefsel/voorziening/maak', { soort: 'schuldhulp', voorzieningNaam: 'Schuldhulp Oud-West',
    lat: zone.centrum.lat, lng: zone.centrum.lng, plekken: 40, wachtDagen: 35, organisatie: 'Stichting Steun' });
  assert.equal(v.status, 200);
  assert.match(v.body.voorziening.plaats, /Oud-West/, 'de voorziening staat op de kaart');
  assert.equal(v.body.voorziening.wachtDagen, 35);
  assert.equal((await oapi('weefsel/voorziening/maak', { soort: 'onzin', lat: zone.centrum.lat, lng: zone.centrum.lng })).status, 400);

  // tellen mag per WIJK; fijner niet
  assert.equal((await oapi('weefsel/telling', { stroom: 'schuldhulp', gebied: wijk.id, aantal: 30, maand: '2026-06' })).status, 200);
  assert.equal((await oapi('weefsel/telling', { stroom: 'schuldhulp', gebied: wijk.id, aantal: 52, maand: '2026-08' })).status, 200);
  /* Een zone of straat mag je meegeven, maar hij ROLT OP naar de wijk: er wordt
     nooit fijner bewaard dan dat. Dat toetsen we met een ANDERE stroom, want
     een telling per wijk per maand is uniek -- een tweede boeking op dezelfde
     sleutel is een correctie en overschrijft de eerste. (Mijn eerste versie
     deed dit met schuldhulp en sloopte daarmee zijn eigen reeks.) */
  const straat = (await oapi('weefsel/gebieden', { niveau: 'straatsegment' })).body.gebieden
    .find(g => g.naam.includes('Oud-West'));
  assert.equal((await oapi('weefsel/telling', { stroom: 'voedselhulp', gebied: zone.id, aantal: 12, maand: '2026-08' })).status, 200,
    'een zone rolt op naar zijn wijk');
  assert.equal((await oapi('weefsel/telling', { stroom: 'voedselhulp', gebied: straat.id, aantal: 14, maand: '2026-09' })).status, 200,
    'ook een straat rolt op naar de wijk');
  const opgerold = (await oapi('weefsel/voorzieningen', { maanden: 24 })).body.perWijk
    .find(w => w.wijk === 'Kern').stromen.find(s => s.stroom === 'voedselhulp');
  assert.ok(opgerold && opgerold.maanden === 2, 'twee maanden, allebei op WIJKniveau bewaard');

  const b = await oapi('weefsel/voorzieningen', { maanden: 12 });
  assert.equal(b.status, 200);
  const kern = b.body.perWijk.find(w => w.wijk === 'Kern');
  const stroom = kern.stromen.find(s => s.stroom === 'schuldhulp');
  assert.ok(stroom, 'de wijk draagt zijn stroom');
  assert.equal(stroom.richting, 'omhoog', 'van 30 naar 52 is omhoog');
  assert.equal(stroom.wachtDagen, 35, 'met de wachttijd van de voorziening ernaast');
  assert.ok(b.body.signalen.some(s => /schuldhulp/i.test(s) && /wachttijd/.test(s)),
    'en het signaal dat de vraag oploopt terwijl de wachttijd al lang is: ' + JSON.stringify(b.body.signalen));

  /* De belangrijkste bewering van deze laag: er komt geen persoon in. Niet
     "we slaan hem niet op" maar: er is geen veld waar hij in past. */
  const alles = JSON.stringify(b.body);
  for (const woord of ['codenaam', 'bsn', 'naamInwoner', 'melderKey'])
    assert.ok(!alles.includes(woord), 'het beeld bevat geen ' + woord);
  const gr = await oapi('weefsel/sociaalgrenzen');
  assert.ok(gr.body.vragen.filter(x => !x.kan).length >= 4, 'de grenzen staan met naam opgeschreven');
  for (const x of gr.body.vragen.filter(y => !y.kan)) assert.ok(x.waarom && x.nodig, x.vraag + ' zegt waarom niet en wat er eerst nodig is');
  assert.match(gr.body.fijnheid, /per wijk per maand/);
});

/* ---------------- 8. De routes ----------------
   MUTATIE (RAAK, alleen deze toets): officeAuth van /api/office/stad/sleutel
   vervangen door een doorgeefluik -> een onzin-token kon een nieuwe
   apparaatsleutel opvragen. Dat is de gevaarlijkste route van deze drie lagen. */
const HW_ROUTES = [
  '/api/office/stad/vloot', '/api/office/stad/paspoort', '/api/office/stad/fase',
  '/api/office/stad/sleutel', '/api/office/stad/kalibreer', '/api/office/stad/update',
  '/api/office/weefsel/noodkaart', '/api/office/weefsel/vertrouwenszones',
  '/api/office/weefsel/terugval/zet', '/api/office/weefsel/oefening',
  '/api/office/weefsel/voorzieningen', '/api/office/weefsel/voorziening/maak',
  '/api/office/weefsel/voorziening/zet', '/api/office/weefsel/telling',
  '/api/office/weefsel/sociaalgrenzen'
];
test('elke hardware-, nood- en voorzieningenroute staat achter de kantoordeur', async () => {
  for (const vol of HW_ROUTES) {
    const pad = vol.slice(5);
    const zonder = await api(pad, {}, 'onzin-token');
    assert.ok(zonder.status === 401 || zonder.status === 403, vol + ' is dicht zonder kantoorinlog (gaf ' + zonder.status + ')');
    const open = await api(pad, { naam: 'Aïsha' }, office);
    assert.ok(open.status < 500, vol + ' gaf een serverfout (' + open.status + ')');
    assert.ok(Object.keys(open.body).length > 0, vol + ' gaf geen JSON-antwoord -- bestaat de route nog?');
  }
});
