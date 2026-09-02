/* MEETINSTRUMENTEN -- wat een deelnemer met zijn labpas invult.

   Wat deze toets vastlegt:

     1. Een protocol is een VERSIE. Elke wijziging telt door, en een meting zegt
        welke versie zij beantwoordde -- zonder dat is een reeks van een half
        jaar niet te vergelijken.
     2. Zonder toestemmingsregime wordt er niets van deelnemers verzameld. Dat is
        fail-closed: de ethieklaag komt voor het verzamelen, niet erna.
     3. Een waarde buiten het bereik wordt GEWEIGERD met de grenzen erbij, en
        niet stil bijgesteld. Wie meetwaarden bijschaaft, meet zijn verwachting.
     4. De deelnemer komt binnen op zijn labpas en gaat de meting in als ALIAS.
     5. Een instrumentsoort die er niet is (foto, locatie, geluid, doorlopend
        meten) wordt geweigerd MET de reden -- geen wensenlijst maar een antwoord.
     6. Het venster van een deelnemer toont zijn eigen aantal en nooit dat van
        anderen: wie ziet hoeveel anderen al invulden, wordt daarmee gestuurd.

   Draai los: node --test test/livinglab-instrument.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { SOORTEN, NIET_GEBOUWD } = require('../server/kern/livinglab/instrument');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-instrument-'));
let srv, base, office, labId, studieId, pas, alias;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const PROTOCOL = [
  { sleutel: 'binnentemp', vraag: 'Hoe warm is het binnen?', soort: 'getal', eenheid: 'graden', min: 0, max: 50 },
  { sleutel: 'slaap', vraag: 'Hoe heeft u geslapen?', soort: 'schaal' },
  { sleutel: 'raamopen', vraag: 'Stond het raam open?', soort: 'janee', verplicht: false }
];

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  labId = (await api('/api/lab2/lab/maak', { naam: 'Lab IJmuiden', stad: 'IJmuiden' }, office)).body.lab.id;
  studieId = (await api('/api/lab2/studie/maak', { labId, titel: 'Hittestress in woningen',
    soort: 'leefomgeving', vraagstuk: 'Welke woningen lopen risico bij hitte?', doel: 'inzicht' }, office)).body.studie.id;
  await api('/api/lab2/protocol/zet', { id: studieId, instrumenten: PROTOCOL }, office);
});
test.after(() => stop(srv));

test('1. zonder toestemmingsregime wordt er niets verzameld', async () => {
  /* De studie staat er, het meetvenster staat er, en er is nog geen
     toestemmingsregime. Dan hoort er niets binnen te komen -- ook niet van een
     deelnemer die er wel al zou zijn. */
  const r = await api('/api/lab2/mijn/meting', { pas: 'LABPAS-BESTAATNIET', antwoorden: { slaap: 3 } });
  assert.equal(r.status, 404, 'zonder geldige pas komt er sowieso niets binnen');

  /* En de deelnemerspoort houdt hem ook tegen: de ethieklaag komt eerst. */
  const d = await api('/api/lab2/mens/bij', { id: studieId, rol: 'buurtonderzoeker' }, office);
  assert.equal(d.status, 409);
  assert.match(d.body.error, /risicoklasse/);
});

test('2. de ethieklaag doorlopen, dan pas een deelnemer met een labpas', async () => {
  assert.equal((await api('/api/lab2/ethiek/klasse', { id: studieId, klasse: 'laag', door: 'Sam van RTG' }, office)).status, 200);
  const t = await api('/api/lab2/ethiek/toestemming', { id: studieId, regime: 'mondeling',
    tekst: 'U doet mee aan een onderzoek naar hitte in woningen; u kunt altijd stoppen.', door: 'Sam van RTG' }, office);
  assert.equal(t.status, 200, JSON.stringify(t.body));

  const d = await api('/api/lab2/mens/bij', { id: studieId, rol: 'buurtonderzoeker', toestemming: true }, office);
  assert.equal(d.status, 200, JSON.stringify(d.body));
  pas = d.body.deelnemer.pas;
  alias = d.body.deelnemer.alias;
  assert.match(pas, /^LABPAS-/);
  /* De alias is geen naam: dat is de hele afspraak van dit lab. */
  assert.ok(!/[A-Z][a-z]+ [A-Z]/.test(alias), 'de alias ziet er niet uit als een naam');
});

test('3. het venster toont de vragen, het onderzoeksnummer en alleen mijn eigen aantal', async () => {
  const v = await api('/api/lab2/mijn/venster', { pas });
  assert.equal(v.status, 200, JSON.stringify(v.body));
  assert.equal(v.body.protocol.versie, 1);
  assert.equal(v.body.protocol.instrumenten.length, 3);
  assert.match(v.body.nummer, /^RTF-IJM-/, 'de deelnemer ziet onder welk nummer dit onderzoek loopt');
  assert.equal(v.body.ik.ingestuurd, 0);
  /* Wat er NIET in staat: hoeveel anderen al hebben ingevuld. */
  const tekst = JSON.stringify(v.body);
  assert.ok(!/deelnemers/.test(tekst) && !/totaal/.test(tekst), 'het venster verklapt niets over anderen');
});

test('4. een meting draagt versie, toestemmingsgrond en alias', async () => {
  const m = await api('/api/lab2/mijn/meting', { pas, antwoorden: { binnentemp: 28.4, slaap: 2 }, meetmoment: 1 });
  assert.equal(m.status, 200, JSON.stringify(m.body));
  assert.equal(m.body.meting.protocolversie, 1);

  const lijst = await api('/api/lab2/metingen', { id: studieId }, office);
  assert.equal(lijst.body.totaal, 1);
  const eerste = lijst.body.metingen[0];
  assert.equal(eerste.alias, alias, 'de meting staat op de alias uit de pas');
  assert.equal(eerste.toestemmingsgrond, 'mondeling', 'waarop deze meting rust, staat erbij en bevriest');
  assert.equal(eerste.meetmoment, 1);
  assert.deepEqual(eerste.antwoorden.map(a => a.sleutel).sort(), ['binnentemp', 'slaap']);
  const temp = eerste.antwoorden.find(a => a.sleutel === 'binnentemp');
  assert.equal(temp.waarde, 28.4, 'de ruwe waarde, ongewijzigd');
  assert.equal(temp.eenheid, 'graden');
});

test('5. buiten het bereik wordt geweigerd en niet bijgesteld', async () => {
  const r = await api('/api/lab2/mijn/meting', { pas, antwoorden: { binnentemp: 99, slaap: 2 } });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /tussen 0 en 50 graden/);
  assert.match(r.body.error, /niet bijgesteld maar geweigerd/);
  const lijst = await api('/api/lab2/metingen', { id: studieId }, office);
  assert.equal(lijst.body.totaal, 1, 'er is niets bewaard');
});

test('6. een nieuwe versie laat oude metingen bij hun eigen versie', async () => {
  const p2 = await api('/api/lab2/protocol/zet', { id: studieId,
    instrumenten: PROTOCOL.concat([{ sleutel: 'ventilator', vraag: 'Gebruikte u een ventilator?', soort: 'janee' }]) }, office);
  assert.equal(p2.status, 200);
  assert.equal(p2.body.protocol.versie, 2);

  await api('/api/lab2/mijn/meting', { pas, antwoorden: { binnentemp: 26, slaap: 4, ventilator: true } });
  const lijst = await api('/api/lab2/metingen', { id: studieId }, office);
  assert.equal(lijst.body.totaal, 2);
  assert.deepEqual(lijst.body.perVersie, { 1: 1, 2: 1 },
    'de oude meting blijft bij versie 1; alleen dan is een reeks te vergelijken');
});

test('7. een verplichte vraag die ontbreekt, is geen halve meting', async () => {
  const r = await api('/api/lab2/mijn/meting', { pas, antwoorden: { slaap: 3, ventilator: false } });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /Hoe warm is het binnen/);
});

test('8. wat er niet is, wordt geweigerd MET de reden', async () => {
  for (const soort of ['foto', 'locatie', 'audio', 'doorlopend']) {
    const r = await api('/api/lab2/protocol/zet', { id: studieId,
      instrumenten: [{ sleutel: 'x', vraag: 'Een vraag die dit vraagt', soort }] }, office);
    assert.equal(r.status, 400, soort + ' kwam er toch door');
    assert.ok(r.body.error.length > 60, 'de weigering legt uit waarom, en niet alleen dat');
  }
  /* En de lijst met redenen staat op één plek, zodat een onderzoeker hem kan
     lezen zonder een inzending te doen. */
  for (const s of Object.keys(NIET_GEBOUWD)) assert.ok(!SOORTEN.some(x => x.soort === s));
});

test('9. een getal zonder eenheid is geen meting', async () => {
  const r = await api('/api/lab2/protocol/zet', { id: studieId,
    instrumenten: [{ sleutel: 'iets', vraag: 'Hoeveel?', soort: 'getal', min: 0, max: 10 }] }, office);
  assert.equal(r.status, 400);
  assert.match(r.body.error, /eenheid/);
});

/* 10. DE GRENS DIE OVER DE LIJN NIET TE BEREIKEN IS, en juist daarom hier.

   Over HTTP kan een deelnemer niet bestaan zonder toestemmingsregime: de
   deelnemerspoort houdt hem al tegen. Daarmee zou de fail-closed regel in
   metingBij() nooit worden geraakt -- en een grens waarvan de zakkende kant
   onbereikbaar is, is geen grens maar een geruststelling (dezelfde les als in
   kern/economie/werelden.js). Dus wordt hij hier op de module getoetst, met een
   studie die er nooit had moeten zijn: protocol wel, toestemming niet. */
test('10. geen toestemmingsgrond, geen meting -- ook als er langs een andere weg een deelnemer is', () => {
  const maak = require('../server/kern/livinglab/instrument');
  const studie = { id: 'S1', labId: 'L1', nummer: 'RTF-XXX-2026-0001', titel: 'Proef',
    dossier: { protocol: { versie: 1, instrumenten: [{ sleutel: 'slaap', vraag: 'Hoe sliep u?', soort: 'schaal', verplicht: true }], at: 'nu', door: 'lab' },
      metingen: [], ethiek: { toestemming: { regime: 'geen', tekst: '' }, stilgelegd: null } } };
  const inst = maak({ nu: () => '2026-08-31T12:00:00.000Z', rid: () => 'M1',
    schoon: (t, n) => String(t == null ? '' : t).slice(0, n), getal: (v) => Number(v) || 0,
    audit: () => {}, vindStudie: () => studie, save: () => {}, apparatuur: {} });

  const geweigerd = inst.metingBij('S1', 'BW-1', { antwoorden: { slaap: 3 } });
  assert.equal(geweigerd.status, 409);
  assert.match(geweigerd.error, /toestemmingsregime/);
  assert.equal(studie.dossier.metingen.length, 0, 'er is niets bewaard');

  /* En met een regime erbij loopt precies dezelfde aanroep wel door -- zodat
     deze toets de grens meet en niet de aanroep. */
  studie.dossier.ethiek.toestemming.regime = 'mondeling';
  const goed = inst.metingBij('S1', 'BW-1', { antwoorden: { slaap: 3 } });
  assert.equal(goed.ok, true);
  assert.equal(studie.dossier.metingen[0].toestemmingsgrond, 'mondeling');

  /* Een stilgelegd onderzoek verzamelt ook niets, en dat is een andere grens met
     een andere reden. */
  studie.dossier.ethiek.stilgelegd = { at: 'nu', door: 'Sam', reden: 'klacht' };
  assert.equal(inst.metingBij('S1', 'BW-1', { antwoorden: { slaap: 4 } }).status, 409);
});
