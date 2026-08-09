/* RTG Life (kern/life.js): het ene scherm. Wat hier bewezen wordt is vooral wat
   het scherm NIET doet: geen cijfer verzinnen waar geen bron is, geen nul waar
   niets gemeten is, en een kapotte laag niet stil laten verdwijnen achter een
   lege lijst.

   Verder dat het echt leest uit de lagen die er al waren: een doel dat je in
   Doelen zet en een afspraak die je bij de salon maakt, staan hier zonder dat
   Life er iets van heeft vastgelegd.
   Draai los: node --experimental-sqlite --test test/life.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { winstVan } = require('../server/kern/life');

let srv, base, lid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-life-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const overDagen = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const sig = (b, id) => b.signalen.find(s => s.id === id);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier: 'rtg' }) }).then(r => r.json()).then(d => d.token);
  assert.ok(lid);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('nog niets ingevuld is "niet gemeten" en geen nul', async () => {
  const r = await api('life', {}, lid);
  assert.equal(r.status, 200);
  for (const id of ['slaap', 'beweging', 'water']) {
    const s = sig(r.body, id);
    assert.ok(s, id + ' staat op het scherm en wordt niet weggelaten');
    assert.equal(s.gemeten, false);
    assert.equal(s.waarde, undefined, 'een ongemeten signaal draagt geen getal, ook geen 0');
    assert.match(s.reden, /nog niet ingevuld/i, 'en er staat bij waarom er niets is');
    assert.equal(s.herkomst, 'zelf', 'het scherm weet van wie dit getal straks komt');
  }
});

test('voeding is afgeleid, en zegt dat ook; nul keer uit eten IS een meting', async () => {
  /* Hier ligt het onderscheid dat er in deze ronde toe doet. Slaap zonder
     invulling is "niet gemeten": er is geen bron. Voeding is anders -- het
     grootboek is compleet, dus nul bestellingen bij partners is een echte nul en
     geen ontbrekend gegeven. Een scherm dat die twee hetzelfde toont, liegt in
     een van beide richtingen. */
  const s = sig((await api('life', {}, lid)).body, 'voeding');
  assert.equal(s.gemeten, true);
  assert.equal(s.waarde, 0, 'nul keer buiten de deur is een uitkomst, geen leegte');
  assert.equal(s.herkomst, 'afgeleid');
  assert.match(s.uitleg, /afgeleid/i, 'en het scherm krijgt te horen dat dit geen meting is');
});

test('een vers lid krijgt geen verzonnen drukte', async () => {
  const b = (await api('life', {}, lid)).body;
  assert.equal(sig(b, 'doelen').gemeten, false, 'geen doelen is niet nul doelen');
  assert.equal(sig(b, 'afspraken').gemeten, false);
  assert.equal(b.doelen.length, 0);
  assert.equal(b.afspraken.length, 0);
  assert.match(b.winst.tekst, /niets dat om uw aandacht vraagt/i,
    'stilte is een geldige uitkomst; het scherm hoeft niets dringends te vinden');
  assert.deepEqual(b.storingen, [], 'en er is niets stuk');
});

test('Life leest de doelenmotor, zonder zelf iets vast te leggen', async () => {
  await api('doelen/maak', { titel: '10 km hardlopen', reden: 'ik wil het kunnen',
    eenheid: 'km', nulmeting: 2, streef: 10, streefOp: overDagen(60) }, lid);
  await api('doelen/meet', { id: (await api('doelen', {}, lid)).body.doelen[0].id, waarde: 4 }, lid);

  const b = (await api('life', {}, lid)).body;
  const s = sig(b, 'doelen');
  assert.equal(s.gemeten, true);
  assert.equal(s.waarde, 1, 'een doel loopt');
  assert.equal(b.doelen.length, 1);
  assert.equal(b.doelen[0].titel, '10 km hardlopen');
  assert.equal(b.doelen[0].aandeel, 0.25, 'de stand komt uit de doelenmotor, niet uit een eigen telling');

  /* Life mag geen eigen bak hebben: als het scherm iets zou vastleggen, zou het
     doel na een stop nog blijven staan. */
  await api('doelen/stop', { id: (await api('doelen', {}, lid)).body.doelen[0].id }, lid);
  const na = (await api('life', {}, lid)).body;
  assert.equal(na.doelen.length, 0, 'weg bij Doelen is weg bij Life');
  assert.equal(sig(na, 'doelen').gemeten, false);
});

test('Life leest de verzorgingsafspraken van de salon', async () => {
  const ov = (await api('verzorging', { datum: overDagen(1) }, lid)).body;
  const salon = ov.aanbieders[0];
  const beh = salon.behandelingen.find(x => x.tijden.length);
  const boek = await api('verzorging/boek', { code: salon.code, behandelingId: beh.id,
    datum: overDagen(1), tijd: beh.tijden[0] }, lid);
  assert.equal(boek.status, 200, JSON.stringify(boek.body));

  const b = (await api('life', {}, lid)).body;
  assert.equal(sig(b, 'afspraken').gemeten, true);
  assert.equal(b.afspraken.length, 1);
  assert.equal(b.afspraken[0].soort, 'verzorging');
  assert.equal(b.afspraken[0].wat, beh.naam);
  assert.match(b.winst.kop, /morgen/i, 'een afspraak van morgen is waar vandaag de aandacht heen gaat');
});

/* ---- de winst-keuze, puur en zonder server ---- */

test('de winst-keuze zwijgt liever dan dat ze iets dringends verzint', () => {
  const leeg = winstVan({ beeld: { vrijeDagen: 6 }, lopend: [], komend: [], vandaag: '2026-08-09' });
  assert.match(leeg.tekst, /niets dat om uw aandacht vraagt/i);

  const vol = winstVan({ beeld: { vrijeDagen: 0 }, lopend: [], komend: [], vandaag: '2026-08-09' });
  assert.equal(vol.kop, 'Rust', 'een volle week is het enige dat ongevraagd om aandacht mag vragen');

  /* Een naderende mijlpaal gaat voor een volle agenda: dat is waar het lid zelf
     om heeft gevraagd toen hij het doel neerzette. */
  const doel = { titel: '10 km', bericht: 'Volgende stap: 6 km rond 2026-08-11',
    mijlpalen: [{ op: '2026-08-11', waarde: 6 }] };
  const stap = winstVan({ beeld: { vrijeDagen: 0 }, lopend: [doel], komend: [], vandaag: '2026-08-09' });
  assert.match(stap.kop, /eerstvolgende stap/i);
  assert.match(stap.tekst, /10 km: 6 km rond 2026-08-11/);

  // een mijlpaal die nog ver weg is, dringt zich niet op
  const ver = winstVan({ beeld: { vrijeDagen: 0 },
    lopend: [{ ...doel, mijlpalen: [{ op: '2026-09-30', waarde: 6 }] }], komend: [], vandaag: '2026-08-09' });
  assert.equal(ver.kop, 'Rust');

  /* De laatste tak: er loopt wel iets, de week is niet vol, en er is niets
     aanstaande. Die stond eerst onder geen enkele toets -- een mutatie die van
     deze regel "Er is vandaag veel te doen" maakte, bleef groen. Precies de
     verzonnen urgentie die dit scherm niet mag hebben. */
  const gewoon = winstVan({ beeld: { vrijeDagen: 3 },
    lopend: [{ ...doel, mijlpalen: [{ op: '2026-09-30', waarde: 6 }] }], komend: [], vandaag: '2026-08-09' });
  assert.equal(gewoon.kop, 'Rustig');
  assert.match(gewoon.tekst, /niets dat om uw aandacht vraagt/i);
});

test('een laag die het niet doet, wordt gemeld en niet stil overgeslagen', () => {
  /* De motor los, met een kern waarin de zorglaag ontbreekt. Zonder deze vorm
     is "geen afspraken" niet te onderscheiden van "de zorglaag deed het niet",
     en dat is precies het verschil dat je wilt zien. */
  const maak = require('../server/kern/life');
  const stuk = maak({ kern: {
    // let op de vorm: kern.balans is een object, de rest hangt plat in de kern
    balans: { balansVoorLid: () => ({ beeld: { vrijeDagen: 3, avonden: 1 }, adviezen: [] }) },
    doelenVan: () => ({ doelen: [] }),
    careMijn: () => { throw new Error('kapot'); },
    verzorgingLeden: { mijn: () => ({ afspraken: [] }) },
    wachtenVan: () => ({ lopend: [] }),
    metingenVan: () => ({ beeld: {} })
  } });
  const b = stuk.lifeVoor('sleutel', 'CODENAAM', new Date('2026-08-09T12:00:00Z'));
  assert.equal(b.storingen.length, 1);
  assert.match(b.storingen[0], /Zorg/i, 'de laag die stukging staat met naam in de melding');

  const heel = maak({ kern: {} });
  const leeg = heel.lifeVoor('sleutel', 'CODENAAM', new Date('2026-08-09T12:00:00Z'));
  assert.equal(leeg.storingen.length, 6, 'zes ontbrekende lagen geven zes meldingen, geen stilte');
  assert.equal(sig(leeg, 'ritme').gemeten, false, 'en het signaal zelf doet ook niet alsof');
});
