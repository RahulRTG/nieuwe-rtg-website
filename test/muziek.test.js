/* RTG Studio: zelf muziek maken. Toetst de drie beloftes van kern/muziek.js --
   alles wordt opgewekt en niets geleend (dus mag je eigen stuk onder je eigen
   clip), Rahul zet neer maar jij bent de maker, en het stuk is een handvol
   getallen die je kunt lezen en meenemen.
   Draai: node --experimental-sqlite --test test/muziek.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');
const I = require('../server/kern/muziek-instrumenten');

let BASE, child, maker, ander, trackId;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-muziek-'));

async function api(pad, body, tok) {
  const headers = { 'Content-Type': 'application/json' };
  if (tok) headers['Authorization'] = 'Bearer ' + tok;
  const r = await fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const t0 = Date.now();
let seq = 0;
async function lid(naam) {
  const u = String(t0 + (++seq)).slice(-8);
  return (await api('/api/auth/register', { name: naam, email: 'mz' + u + '@m.test', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1991-01-01', tier: 'rtg' })).body.token;
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  maker = await lid('Maker');
  ander = await lid('Ander');
  assert.ok(maker && ander, 'twee leden aangemeld');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een nieuw stuk begint niet leeg, want een leeg raster leert niemand iets', async () => {
  const r = await api('/api/muziek/maak', { naam: 'Eerste stuk' }, maker);
  assert.equal(r.status, 200);
  trackId = r.body.track.id;
  const t = r.body.track;
  assert.equal(t.naam, 'Eerste stuk');
  assert.ok(t.kanalen.length >= 3, 'er staat meteen iets klinkends: ' + t.kanalen.length);
  assert.ok(t.kanalen.some(k => (k.stappen || []).length), 'met slagwerk erin');
  assert.ok(t.kanalen.some(k => (k.noten || []).length), 'en met noten erin');
  // wie leeg wil beginnen, mag dat
  const leeg = await api('/api/muziek/maak', { naam: 'Kaal', leeg: true }, maker);
  assert.equal(leeg.body.track.kanalen.length, 0);
});

test('de woordenschat is gedeeld: de lijst instrumenten komt van de server', async () => {
  const r = await api('/api/muziek/mijn', {}, maker);
  assert.equal(r.status, 200);
  assert.ok(r.body.instrumenten.kick && r.body.instrumenten.bas, 'de instrumenten staan erin');
  assert.equal(r.body.instrumenten.kick.soort, 'slag');
  assert.equal(r.body.instrumenten.bas.soort, 'toon');
  assert.equal(r.body.stappenPerMaat, 16, 'een maat is 16 stappen, en dat getal staat op één plek');
  assert.ok(r.body.tracks.length >= 2);
  // de lijst draagt geen noten mee -- dat is het grootste stuk
  assert.equal(r.body.tracks[0].kanalen !== undefined && typeof r.body.tracks[0].kanalen === 'number', true);
});

test('wat niet kan spelen, wordt eruit gehaald in plaats van het stuk te weigeren', async () => {
  // De grenzen komen uit de module zelf. Een test die ze overschrijft, toetst
  // niet de regel maar zijn eigen kopie -- en gaat stuk zodra de regel verandert.
  const laatste = I.stappenVoor(I.MAX_MATEN) - 1;
  const r = await api('/api/muziek/bewaar', { id: trackId, bpm: 999, maten: 99, kanalen: [
    { instrument: 'trompet', stappen: [0, 4] },
    { instrument: 'kick', stappen: [0, 4, 8, 12, -3, 99999] },
    { instrument: 'bas', noten: [
      { stap: 0, toon: 40, lengte: 4 },
      { stap: 3, toon: 200, lengte: 2 },
      { stap: 99999, toon: 40, lengte: 2 }
    ] }
  ] }, maker);
  assert.equal(r.status, 200, 'het stuk blijft bestaan: ' + JSON.stringify(r.body).slice(0, 150));
  const t = r.body.track;
  assert.equal(t.bpm, I.BPM_MAX, 'het tempo is naar de bovengrens gebracht, niet geweigerd');
  assert.equal(t.maten, I.MAX_MATEN, 'en het aantal maten ook');
  /* Een onbekend instrument levert GEEN kanaal op. Er iets anders van maken zou
     betekenen dat de maker iets anders hoort dan hij vroeg zonder dat iemand
     het zegt; dan wordt een fout onhoorbaar en verkeerd tegelijk. */
  assert.deepEqual(t.kanalen.map(k => k.instrument), ['kick', 'bas'],
    'de trompet is er niet, en er is ook geen kick van gemaakt');
  const kick = t.kanalen.find(k => k.instrument === 'kick');
  assert.deepEqual(kick.stappen, [0, 4, 8, 12, laatste],
    'een stap buiten het raster wordt naar de rand gebracht, niet stil weggegooid');
  /* Eén regel voor het hele stuk: wat buiten de grenzen valt gaat NAAR DE RAND,
     het verdwijnt niet stil. Zo blijft het zichtbaar in de notenrol en kan de
     maker het zelf verzetten; een noot die spoorloos weg is, kan hij niet
     terugvinden en niet herstellen. */
  const bas = t.kanalen.find(k => k.instrument === 'bas');
  assert.equal(bas.noten.length, 3, 'alle drie de noten staan er nog');
  assert.equal(bas.noten.some(n => n.toon === I.TOON_MAX), true, 'toon 200 ligt nu op de bovenste toon');
  assert.equal(bas.noten.some(n => n.stap === laatste), true, 'de stap ver voorbij het eind ligt nu op de laatste stap');
  assert.equal(bas.noten.every(n => n.toon >= I.TOON_MIN && n.toon <= I.TOON_MAX && n.stap <= laatste), true);
});

test('een stuk is van jou: een ander komt er niet in', async () => {
  assert.equal((await api('/api/muziek/open', { id: trackId }, ander)).status, 404);
  assert.equal((await api('/api/muziek/bewaar', { id: trackId, naam: 'Gekaapt' }, ander)).status, 404);
  assert.equal((await api('/api/muziek/weg', { id: trackId }, ander)).status, 404);
  // en het staat er nog gewoon
  assert.equal((await api('/api/muziek/open', { id: trackId }, maker)).body.track.naam, 'Eerste stuk');
});

test('Rahul zet neer, maar het blijft een voorstel dat je zelf plaatst', async () => {
  const r = await api('/api/muziek/rahul', { vraag: 'een rustige lounge op 90 bpm', maten: 2 }, maker);
  assert.equal(r.status, 200);
  const v = r.body.voorstel;
  assert.ok(v && v.kanalen.length, 'er komt een patroon uit');
  assert.equal(v.bpm, 90, 'het tempo uit de vraag is gelezen');
  assert.equal(v.stijl, 'lounge');
  assert.ok(v.uitleg.length > 10);
  // het is een VOORSTEL: het stuk zelf is niet aangeraakt
  const na = await api('/api/muziek/open', { id: trackId }, maker);
  assert.equal(na.body.track.naam, 'Eerste stuk');
  assert.notDeepEqual(na.body.track.kanalen, v.kanalen, 'er is niets stilletjes toegepast');
  // en wat eruit komt is gewone, bewerkbare inhoud in hetzelfde formaat
  const gezet = await api('/api/muziek/bewaar', { id: trackId, bpm: v.bpm, maten: v.maten, kanalen: v.kanalen }, maker);
  assert.equal(gezet.status, 200);
  assert.equal(gezet.body.track.kanalen.length, v.kanalen.length, 'het past zonder vertaalslag');
});

test('Rahul jaagt niet op en belooft geen publiek', async () => {
  const r = await api('/api/muziek/rahul', { vraag: 'iets vrolijks', maten: 1 }, maker);
  const plat = JSON.stringify(r.body);
  assert.equal(/populair|scoort|viral|trending|meer luisteraars|volgers/i.test(plat), false, plat.slice(0, 300));
});

test('eigen muziek mag onder een eigen clip; alles daarbuiten niet', async () => {
  const clip = await api('/api/clips/maak', { titel: 'Kade', duurS: 12 }, maker);
  assert.equal(clip.status, 200);
  const cid = clip.body.id;

  // een stuk dat nog niet klaar is, telt niet
  let g = await api('/api/clips/geluid', { id: cid, soort: 'muziek', muziek: trackId }, maker);
  assert.equal(g.status, 400, 'niet-klaar telt niet: ' + JSON.stringify(g.body));

  await api('/api/muziek/bewaar', { id: trackId, klaar: true }, maker);
  g = await api('/api/clips/geluid', { id: cid, soort: 'muziek', muziek: trackId }, maker);
  assert.equal(g.status, 200, JSON.stringify(g.body));
  assert.equal(g.body.muziek.naam, 'Eerste stuk');

  // de feed draagt het stuk mee, zodat de kijker weet wat hij hoort
  const feed = await api('/api/clips/feed', {}, maker);
  const bij = feed.body.mijn.find(c => c.id === cid);
  assert.equal(bij.geluid, 'muziek');
  assert.equal(bij.muziek.naam, 'Eerste stuk');

  // muziek van een ANDER kan niet onder jouw clip
  const vanAnder = await api('/api/muziek/maak', { naam: 'Van de ander' }, ander);
  await api('/api/muziek/bewaar', { id: vanAnder.body.track.id, klaar: true }, ander);
  const kaap = await api('/api/clips/geluid', { id: cid, soort: 'muziek', muziek: vanAnder.body.track.id }, maker);
  assert.equal(kaap.status, 400, 'andermans muziek gaat er niet onder');

  // en een verzonnen id evenmin
  assert.equal((await api('/api/clips/geluid', { id: cid, soort: 'muziek', muziek: 'mdeadbeef' }, maker)).status, 400);

  // terug naar een gewoon geluid haalt de muziek er ook weer af
  const terug = await api('/api/clips/geluid', { id: cid, soort: 'eigen' }, maker);
  assert.equal(terug.body.muziek, null);
});

test('een stuk weghalen kan, en dan is het weg', async () => {
  const r = await api('/api/muziek/maak', { naam: 'Weg ermee' }, maker);
  assert.equal((await api('/api/muziek/weg', { id: r.body.track.id }, maker)).status, 200);
  assert.equal((await api('/api/muziek/open', { id: r.body.track.id }, maker)).status, 404);
});

test('zonder inlog blijft de studio dicht', async () => {
  for (const pad of ['/api/muziek/mijn', '/api/muziek/maak', '/api/muziek/rahul']) {
    const r = await fetch(BASE + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(r.status, 401, pad);
  }
});
