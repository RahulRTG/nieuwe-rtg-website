/* Het beraad tegen een ECHTE server: elke route onder /api/beraad/ krijgt hier
   een treffer (LAT-regel 17: een nagemaakte app bewijst het handlergedrag, niet
   de montage of de deur). De regels zelf staan in test/beraad.test.js; hier gaat
   het om wat een lid over HTTP werkelijk ziet, en om de melding die aankomt waar
   het lid hem leest (/api/notifications), precies een keer.

   MUTATIES GEZIEN ZAKKEN (elk een keer gedraaid, daarna teruggezet):
   (a) routes/member.js: de regel require('./member/beraad') weggehaald -- alle toetsen zakken (404 op elke route);
   (b) terugkoppeling.js wek(): notify(k, ...) met een TEKST in plaats van een object -- toets 3 zakt
       (de melding komt nooit aan, de trede blijft op klaargezet);
   (c) terugkoppeling.js wek(): notify op `'rtg'` (de pas) in plaats van de sleutel -- toets 3 zakt;
   (d) zicht.js: de tak `r.stand !== 'besloten'` weggehaald -- toets 2 zakt (tussenstand zichtbaar);
   (e) index.js poort(): de lidcontrole weggehaald -- toets 1 zakt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-beraad-'));
const raw = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
});
const post = async (pad, body, token) => { const r = await raw(pad, body, token); return { status: r.status, body: await r.json() }; };

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let teller = 0;
async function lid() {
  const t = Date.now() + '' + (teller++);
  const r = await post('/auth/register', { name: 'Lid ' + t, email: 'br' + t + '@v.test',
    phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-06-06', tier: 'rtg' });
  assert.ok(r.body.token, JSON.stringify(r.body));
  return r.body.token;
}
async function kring(n) {
  const a = await lid();
  const g = await post('/genootschap/richt-op', { naam: 'Beraadkring ' + (teller++), soort: 'openbaar' }, a);
  const anderen = [];
  for (let i = 0; i < n - 1; i++) {
    const t = await lid();
    await post('/genootschap/binnen', { groep: g.body.groep.id }, t);
    anderen.push(t);
  }
  return { a, anderen, groep: g.body.groep.id };
}
const beraadMeldingen = async (token) => (await post('/notifications', {}, token)).body.notifications.filter(n => n.title === 'Beraad');
const laatste = (b) => b.rondes[b.rondes.length - 1];

let K, ID;
test('1. openen, inbrengen en lezen: een lid 200, een buitenstaander 404', async () => {
  K = await kring(6);
  const vreemd = await lid();
  assert.equal((await post('/beraad/open', { drager: { soort: 'genootschap', id: K.groep }, vraag: 'Mag ik?' }, vreemd)).status, 404);
  const o = await post('/beraad/open', { drager: { soort: 'genootschap', id: K.groep }, vraag: 'Gaan we in mei samen naar Gent?' }, K.a);
  assert.equal(o.status, 200, JSON.stringify(o.body));
  ID = o.body.beraad.id;
  assert.equal((await post('/beraad/lees', { beraad: ID }, vreemd)).status, 404);
  assert.equal((await post('/beraad/inbreng', { beraad: ID, tekst: 'Ik ook.' }, vreemd)).status, 404);

  const [b, c] = K.anderen;
  const i = await post('/beraad/inbreng', { beraad: ID, tekst: 'Graag, maar het mag niet te duur worden.' }, b);
  assert.equal(i.status, 200);
  const weg = await post('/beraad/inbreng', { beraad: ID, soort: 'bezwaar', tekst: 'Niet in het weekend.' }, c);
  assert.equal((await post('/beraad/inbreng', { beraad: ID, intrek: weg.body.id }, c)).status, 200);
  const l = await post('/beraad/lees', { beraad: ID }, b);
  assert.equal(l.status, 200);
  assert.equal(laatste(l.body.beraad).bezwaren.length, 1, 'ingetrokken, niet verdwenen');
  assert.ok(laatste(l.body.beraad).bezwaren[0].ingetrokken);
});

test('2. voorstel, naar stemmen, stem en sluit -- zonder tussenstand en zonder andermans stem', async () => {
  const [b, c, d, e] = K.anderen;
  assert.equal((await post('/beraad/stem', { beraad: ID, keuze: 'voor' }, b)).status, 409, 'nog geen voorstel');
  assert.equal((await post('/beraad/voorstel', { beraad: ID, tekst: 'Dinsdag 12 mei, met de trein.' }, K.a)).status, 200);
  assert.equal((await post('/beraad/naar-stemmen', { beraad: ID }, b)).status, 403);
  assert.equal((await post('/beraad/naar-stemmen', { beraad: ID }, K.a)).status, 200);
  assert.equal((await post('/beraad/stem', { beraad: ID, keuze: 'tegen' }, b)).status, 200);

  // een nieuw voorstel zet de stemmen terug
  const v2 = await post('/beraad/voorstel', { beraad: ID, tekst: 'Woensdag 13 mei, met de trein.' }, K.a);
  assert.equal(v2.body.stemmenTerug, true);
  assert.equal(laatste((await post('/beraad/lees', { beraad: ID }, b)).body.beraad).mijnStem, null);
  await post('/beraad/naar-stemmen', { beraad: ID }, K.a);

  for (const [t, s] of [[K.a, 'voor'], [b, 'tegen'], [c, 'voor'], [d, 'voor'], [e, 'onthouding']])
    assert.equal((await post('/beraad/stem', { beraad: ID, keuze: s }, t)).status, 200);
  const tijdens = await post('/beraad/lees', { beraad: ID }, c);
  assert.equal(laatste(tijdens.body.beraad).uitslag, null, 'geen telling tijdens het stemmen');
  assert.equal(laatste(tijdens.body.beraad).mijnStem, 'voor');
  assert.ok(!JSON.stringify(tijdens.body).includes('"stemmen":'), 'geen stemmenkaart');

  assert.equal((await post('/beraad/sluit', { beraad: ID }, b)).status, 403);
  const s = await post('/beraad/sluit', { beraad: ID }, K.a);
  assert.equal(s.status, 200, JSON.stringify(s.body));
  const r = laatste(s.body.beraad);
  assert.equal(r.eindstand.stand, 'aangenomen');
  assert.deepEqual([r.uitslag.voor, r.uitslag.tegen, r.uitslag.onthouding], [3, 1, 1]);
});

test('3. de terugkoppeling komt aan op de sleutel, precies een keer, en gezien is een trede', async () => {
  const [b, c, , , f] = K.anderen;
  assert.equal((await beraadMeldingen(b)).length, 1, 'wie stemde krijgt een melding');
  assert.equal((await beraadMeldingen(c)).length, 1, 'wie inbracht en stemde krijgt er ook precies een');
  assert.equal((await beraadMeldingen(f)).length, 0, 'wie niet meedeed niet');

  const nog = await post('/beraad/sluit', { beraad: ID }, K.a);
  assert.equal(nog.status, 200);
  assert.equal(nog.body.herhaling, true);
  assert.equal((await beraadMeldingen(b)).length, 1, 'een herhaalde sluiting stuurt niets opnieuw');

  const m = await post('/beraad/mijn', {}, b);
  assert.equal(m.status, 200);
  const t = m.body.terugkoppeling.find(x => x.beraad === ID);
  assert.equal(t.trede, 'gewekt');
  assert.equal(t.eindstand, 'aangenomen');
  assert.equal((await post('/beraad/terugkoppeling-gezien', { beraad: ID }, b)).body.bewogen, 1);
  assert.equal((await post('/beraad/mijn', {}, b)).body.terugkoppeling.find(x => x.beraad === ID).trede, 'gezien');
  assert.equal((await post('/beraad/terugkoppeling-gezien', { beraad: ID }, f)).status, 404);
});

test('4. Rahul: drie lezende taken; heropenen is een nieuwe ronde', async () => {
  const [b] = K.anderen;
  const h = await post('/beraad/heropen', { beraad: ID, reden: 'De trein rijdt die dag niet meer.' }, K.a);
  assert.equal(h.status, 200);
  assert.equal(h.body.beraad.rondes.length, 2);
  assert.equal(h.body.beraad.rondes[0].eindstand.stand, 'aangenomen');
  await post('/beraad/inbreng', { beraad: ID, tekst: 'Dan de bus, die is goedkoper.' }, b);
  await post('/beraad/inbreng', { beraad: ID, tekst: 'Wie haalt de kinderen op?' }, K.a);

  const s = await post('/beraad/hulp', { beraad: ID, taak: 'samenvatting' }, b);
  assert.equal(s.status, 200);
  assert.equal(s.body.regels.length, 2, 'elke inbreng van deze ronde');
  assert.ok(s.body.regels.every(x => x.inbrengId && x.zin));
  const p = await post('/beraad/hulp', { beraad: ID, taak: 'perspectieven' }, b);
  assert.ok(p.body.ontbreekt.length > 0);
  const c = await post('/beraad/hulp', { beraad: ID, taak: 'concept' }, b);
  assert.equal(c.body.bewaard, false);
  assert.equal((await post('/beraad/hulp', { beraad: ID, taak: 'stem' }, b)).status, 400);
  assert.equal((await post('/beraad/hulp', { beraad: ID, taak: 'samenvatting' }, await lid())).status, 404);
  const na = await post('/beraad/lees', { beraad: ID }, b);
  assert.equal(laatste(na.body.beraad).voorstel, null, 'het concept is nergens neergezet');
});

test('5. een kleine kring krijgt alleen de eindstand, geen aantallen', async () => {
  const k = await kring(3);
  const o = await post('/beraad/open', { drager: { soort: 'genootschap', id: k.groep }, vraag: 'Een nieuwe kast?' }, k.a);
  const id = o.body.beraad.id;
  await post('/beraad/voorstel', { beraad: id, tekst: 'Ja, een eiken kast.' }, k.a);
  await post('/beraad/naar-stemmen', { beraad: id }, k.a);
  for (const t of [k.a].concat(k.anderen)) await post('/beraad/stem', { beraad: id, keuze: 'voor' }, t);
  const s = await post('/beraad/sluit', { beraad: id }, k.a);
  const r = laatste(s.body.beraad);
  assert.equal(r.eindstand.stand, 'aangenomen');
  assert.equal(r.uitslag.getoond, false);
  assert.equal(r.uitslag.reden, 'te-kleine-groep');
  assert.ok(!('voor' in r.uitslag));
});

/* Elke route twee keer met hetzelfde lijf (de vorm van test/democratie.test.js
   toets 9). Dit is het bewijs onder server/lib/mutatiecontracten-beraad.js en de
   twee idem-bestanden: wat daar staat, is hier gemeten. */
test('6. herhaling: elke route twee keer met hetzelfde lijf', async () => {
  const k = await kring(2);
  const [b] = k.anderen;
  const twee = async (pad, body, t) => [await post(pad, body, t), await post(pad, body, t)];
  const tel = async () => (await post('/beraad/mijn', {}, k.a)).body.beraden.length;

  const [o1, o2] = await twee('/beraad/open', { drager: { soort: 'genootschap', id: k.groep }, vraag: 'Dubbeltik?' }, k.a);
  assert.equal(o1.status, 200);
  assert.equal(o2.body.beraad.id, o1.body.beraad.id, 'een dubbeltik opent een beraad, niet twee');
  assert.equal(await tel(), 1);
  const id = o1.body.beraad.id;
  const ronde = async () => laatste((await post('/beraad/lees', { beraad: id }, b)).body.beraad);

  await twee('/beraad/inbreng', { beraad: id, tekst: 'Een keer gezegd.' }, b);
  assert.equal((await ronde()).inbreng.length, 1, 'een dubbeltik is een inbreng');
  const [v1, v2] = await twee('/beraad/voorstel', { beraad: id, tekst: 'Zo doen we het.' }, k.a);
  assert.equal(v1.body.versie, 1);
  assert.equal(v2.body.herhaling, true);
  assert.equal((await ronde()).voorstel.versie, 1, 'dezelfde tekst is geen nieuwe versie');
  const [n1, n2] = await twee('/beraad/naar-stemmen', { beraad: id }, k.a);
  assert.equal(n1.status, 200); assert.equal(n2.body.herhaling, true);
  const [s1, s2] = await twee('/beraad/stem', { beraad: id, keuze: 'voor' }, b);
  assert.equal(s1.status, 200); assert.equal(s2.body.herhaling, true);
  // voor, tegen, weer voor binnen een paar seconden: de stem staat op voor (geen afgespeeld antwoord)
  await post('/beraad/stem', { beraad: id, keuze: 'tegen' }, b);
  await post('/beraad/stem', { beraad: id, keuze: 'voor' }, b);
  assert.equal((await ronde()).mijnStem, 'voor');

  const voor = (await beraadMeldingen(b)).length;
  const [c1, c2] = await twee('/beraad/sluit', { beraad: id }, k.a);
  assert.equal(c1.status, 200); assert.equal(c2.body.herhaling, true);
  assert.deepEqual(c2.body.beraad.rondes[0].eindstand, c1.body.beraad.rondes[0].eindstand, 'de eindstand van de eerste blijft');
  assert.equal((await beraadMeldingen(b)).length, voor + 1, 'een bericht, niet twee');

  const [g1, g2] = await twee('/beraad/terugkoppeling-gezien', { beraad: id }, b);
  assert.equal(g1.body.bewogen, 1); assert.equal(g2.body.bewogen, 0);
  const [h1, h2] = await twee('/beraad/heropen', { beraad: id, reden: 'Er is iets nieuws gebeurd sindsdien.' }, k.a);
  assert.equal(h1.status, 200);
  assert.equal(h2.status, 409, 'heropenen weigert een herhaling zolang de nieuwe ronde loopt');
  assert.equal((await ronde()).nr, 2, 'geen derde ronde');

  for (const [pad, body] of [['/beraad/mijn', {}], ['/beraad/lees', { beraad: id }], ['/beraad/hulp', { beraad: id, taak: 'samenvatting' }]]) {
    const [a1, a2] = await twee(pad, body, b);
    assert.equal(a1.status, 200); assert.deepEqual(a2.body, a1.body, pad + ' leest en verandert niets');
  }
});
