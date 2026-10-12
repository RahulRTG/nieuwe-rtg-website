/* BESLUIT 3 VAN DE EIGENAAR (11 oktober 2026): ENFORCE_EXECUTE AAN DE KANTOORDEUR,
   in de volgorde (a) individuele passkey-identificatie aan de deur, (b)
   schaduwmeting, (c) pas daarna afdwingen. Deze toets houdt (a) en (b) vast, op
   een echte server, en bewijst dat (c) NIET stilletjes al is gebeurd.

     1. (a) Een medewerker op naam bewijst zich BUITEN productie op verzoek met
        zijn passkey aan de deur; zijn sessie draagt dan een bewezen individu.
        Zonder dat verzoek blijft de deur zoals hij was: op naam, niet bewezen.
     2. De gedeelde kantoorcode draagt GEEN individu, en een uitvoerende route
        met die code wordt geteld als "zou zakken" -- en gaat gewoon door.
     3. Een LEESroute (NOT_APPLICABLE in het mutatiecontract) telt niet mee.
     4. In de teller staat geen identiteit: geen sleutel, geen codenaam.
     5. Twee P0b-reparaties uit dezelfde ronde: wie er in de paniekkamer spreekt
        en wie een lablogregel schrijft, komt uit de SESSIE en niet uit het lichaam.

   Draai los: node --test test/kantoordeur-uitvoeren.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorKoppelBody } = require('./helper');
const { kantoorPasskey } = require('./kantoorpasskey');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-uitvoeren-'));
const CODE = 'KANTOOR-UITVOEREN-1';
let srv, base, eigenaar, gedeeld, mens, pk;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const telefoon = () => '06' + String(10000000 + Math.floor(Math.random() * 8e7));

/* De schaduw telt na afloop van een antwoord (op 'close'); de volgende vraag kan
   daar net voor komen. Dus wachten tot het beeld er is, met een grens. */
async function uitvoerStand(voorwaarde) {
  let laatste = null;
  for (let i = 0; i < 40; i++) {
    const r = await api('/api/office/beleidsmotor', {}, eigenaar);
    assert.equal(r.status, 200, 'de stand van de beleidsmotor: ' + JSON.stringify(r.body).slice(0, 160));
    laatste = r.body.uitvoeren;
    if (!voorwaarde || voorwaarde(laatste)) return laatste;
    await new Promise(z => setTimeout(z, 50));
  }
  return laatste;
}
const rij = (u, route) => (u.werklijst || []).find(r => r.route === route);

/* EEN BAKEN IN PLAATS VAN EEN SLAAP. Om te bewijzen dat iets NIET is geteld,
   moet de teller klaar zijn met wat ervoor kwam. Een vaste wachttijd gokt
   daarop (test/klokwacht.test.js); dit doet een handeling die WEL telt -- een
   passkey-schrijfactie -- en wacht tot die in de stand staat. Wat ervoor werd
   afgehandeld, staat er dan ook. */
async function baken() {
  const route = 'POST /api/office/kantine/menu-zet';
  const voor = (rij(await uitvoerStand(), route) || { passkey: 0 }).passkey;
  assert.equal((await api('/api/office/kantine/menu-zet', { items: ['Baken'] }, mens.passkey)).status, 200);
  const u = await uitvoerStand(x => ((rij(x, route) || {}).passkey || 0) > voor);
  assert.equal(rij(u, route).passkey, voor + 1, 'het baken is geteld');
  return u;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  base = srv.base;
  pk = kantoorPasskey(base);
  eigenaar = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(eigenaar, 'de eigenaar logt in');
  gedeeld = (await api('/api/office/login', { code: CODE })).body.token;
  assert.ok(gedeeld, 'de gedeelde kantoorcode werkt buiten productie nog (niets gebroken)');
  const u = Date.now().toString(36);
  const reg = await api('/api/auth/register', { name: 'Kantoormens Uitvoeren', email: 'ku' + u + '@voorbeeld.test',
    phone: telefoon(), password: 'Geheim123!', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.body.token, 'medewerker geregistreerd');
  const kop = await api('/api/account/koppel', await kantoorKoppelBody(base, reg.body.token), reg.body.token);
  assert.equal(kop.status, 200, 'kantoorrol gekoppeld: ' + JSON.stringify(kop.body).slice(0, 140));
  mens = { lid: reg.body.token, codenaam: (await api('/api/auth/me', {}, reg.body.token)).body.user.codename };
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. (a) op naam zonder passkey is een naam; met een passkey aan de deur een bewezen individu', async () => {
  const opNaam = await api('/api/account/start', { rol: 'kantoor' }, mens.lid);
  assert.equal(opNaam.status, 200, 'zonder verzoek om een passkey verandert de deur niet');
  mens.opNaam = opNaam.body.token;
  const w1 = await api('/api/office/beleidsmotor/waarom', {}, mens.opNaam);
  assert.equal(w1.status, 200, JSON.stringify(w1.body).slice(0, 160));
  assert.equal(w1.body.identiteit.via, 'opNaam');
  assert.equal(w1.body.identiteit.individueel, true);
  assert.equal(w1.body.identiteit.bewezen, false, 'een naam zonder passkey is geen bewijs');
  assert.equal(w1.body.uitvoeren.uitkomst, 'WEIGEREN', 'ENFORCE_EXECUTE zou deze sessie tegenhouden');
  assert.equal(w1.body.uitvoeren.stand, 'schaduw');

  // vraagt hij om een passkey zonder er een te hebben, dan komt hij NIET stil zonder bewijs binnen
  const zonderSleutel = await api('/api/account/start', { rol: 'kantoor', passkey: true }, mens.lid);
  assert.notEqual(zonderSleutel.status, 200, 'om een bewijs gevraagd, en zonder bewijs binnengelaten: ' +
    JSON.stringify(zonderSleutel.body).slice(0, 160));
  assert.equal(zonderSleutel.body.token, undefined);

  // passkey op zijn EIGEN account, en dan de ceremonie aan de deur
  const sleutel = await pk.zet(mens.lid, 'Geheim123!');   // een passkey toevoegen vraagt het wachtwoord (AUTHZ P1-2)
  const vraag = await api('/api/account/start', { rol: 'kantoor', passkey: true }, mens.lid);
  assert.equal(vraag.status, 401, JSON.stringify(vraag.body).slice(0, 160));
  assert.equal(vraag.body.bevestigingNodig, true);
  assert.ok(vraag.body.bevestiging && vraag.body.bevestiging.ceremonie, 'de deur geeft de ceremonie meteen mee');
  sleutel.teller += 1;
  const antwoord = sleutel.sleutel.loginAntwoord(vraag.body.bevestiging.opties.challenge, new URL(base).origin, sleutel.teller);
  const binnen = await api('/api/account/start', { rol: 'kantoor', ceremonie: vraag.body.bevestiging.ceremonie, antwoord }, mens.lid);
  assert.equal(binnen.status, 200, JSON.stringify(binnen.body).slice(0, 200));
  mens.passkey = binnen.body.token;

  const w2 = await api('/api/office/beleidsmotor/waarom', {}, mens.passkey);
  assert.equal(w2.body.identiteit.via, 'passkey');
  assert.equal(w2.body.identiteit.bewezen, true);
  assert.equal(w2.body.identiteit.graad, 'bewezen');
  assert.equal(w2.body.uitvoeren.uitkomst, 'TOESTAAN', 'een bewezen individu haalt ENFORCE_EXECUTE');
  assert.equal(JSON.stringify(w2.body).includes(mens.codenaam), false, 'de identiteit is een soort, geen naam');

  // een ceremonie wordt opgebruikt: hetzelfde antwoord opent de deur geen tweede keer
  const nogeens = await api('/api/account/start', { rol: 'kantoor', ceremonie: vraag.body.bevestiging.ceremonie, antwoord }, mens.lid);
  assert.notEqual(nogeens.status, 200, 'een gebruikte ceremonie opende de deur opnieuw');
});

test('2. (b) de gedeelde code is geen individu: geteld als "zou zakken", en toch doorgelaten', async () => {
  const route = 'POST /api/office/kantine/menu-zet';
  const voor = rij(await uitvoerStand(), route) || { gedeeld: 0, passkey: 0, opNaam: 0, zouZakken: 0 };
  const zet = await api('/api/office/kantine/menu-zet', { items: ['Dagsoep'] }, gedeeld);
  assert.equal(zet.status, 200, 'de schaduw houdt niets tegen: ' + JSON.stringify(zet.body).slice(0, 160));
  const u = await uitvoerStand(x => (rij(x, route) || {}).gedeeld > voor.gedeeld);
  const na = rij(u, route);
  assert.ok(na, 'de uitvoerende route staat op de werklijst van ENFORCE_EXECUTE');
  assert.equal(na.gedeeld, voor.gedeeld + 1, 'de gedeelde code is geteld als gedeeld');
  assert.equal(na.passkey, voor.passkey, 'en NIET als bewezen individu');
  assert.equal(na.zouZakken, voor.zouZakken + 1);
  assert.equal(na.klasse, 'ongeclassificeerd', 'een route zonder mutatiecontract telt als uitvoerend, niet als lezing');
  assert.ok(u.perKlasse.ongeclassificeerd.gedeeld >= 1, 'per klasse geteld');

  // op naam zonder passkey zou ook zakken; met passkey niet
  assert.equal((await api('/api/office/kantine/menu-zet', { items: ['Roti'] }, mens.opNaam)).status, 200);
  assert.equal((await api('/api/office/kantine/menu-zet', { items: ['Wrap'] }, mens.passkey)).status, 200);
  const u2 = await uitvoerStand(x => (rij(x, route) || {}).opNaam > voor.opNaam && (rij(x, route) || {}).passkey > voor.passkey);
  const r2 = rij(u2, route);
  assert.equal(r2.opNaam, voor.opNaam + 1);
  assert.equal(r2.passkey, voor.passkey + 1);
  assert.equal(r2.zouZakken, voor.zouZakken + 2, 'gedeeld en op naam zakken, de passkey niet');

  /* Het kale eigenaarstoken is GEEN passkey (M1 van de tegenlezing): het telt
     als eigenaarToken en zou bij afdwingen zakken. */
  assert.equal((await api('/api/office/kantine/menu-zet', { items: ['Thee'] }, eigenaar)).status, 200);
  const u3 = await uitvoerStand(x => (rij(x, route) || {}).eigenaarToken > (r2.eigenaarToken || 0));
  const r3 = rij(u3, route);
  assert.equal(r3.eigenaarToken, (r2.eigenaarToken || 0) + 1, 'het eigenaarstoken telde niet als eigenaarToken');
  assert.equal(r3.passkey, r2.passkey, 'het eigenaarstoken telde als een passkey');
  assert.equal(r3.zouZakken, r2.zouZakken + 1);

  // een geweigerd verzoek is geen uitgevoerde handeling
  assert.equal((await api('/api/office/kantine/menu-zet', { items: [] }, gedeeld)).status, 400);
  assert.equal(rij(await baken(), route).gedeeld, voor.gedeeld + 1, 'een 400 telt niet');
});

test('3. een leesroute telt niet mee', async () => {
  for (let i = 0; i < 3; i++) assert.equal((await api('/api/office/kantine/menu', {}, gedeeld)).status, 200);
  const u = await baken();
  assert.equal((u.werklijst || []).some(r => /kantine\/menu$/.test(r.route)), false,
    'POST /api/office/kantine/menu is NOT_APPLICABLE (leest) en hoort niet in de uitvoertelling');
});

test('4. geen identiteit in de teller', async () => {
  const u = await uitvoerStand();
  const tekst = JSON.stringify(u);
  assert.equal(/user-\d+/.test(tekst), false, 'een sessiesleutel in de schaduwteller');
  assert.equal(tekst.includes(mens.codenaam), false, 'een codenaam in de schaduwteller');
  for (const t of [gedeeld, mens.opNaam, mens.passkey]) assert.equal(tekst.includes(t), false, 'een token in de teller');
  for (const r of u.werklijst) assert.deepEqual(Object.keys(r).sort(),
    ['eigenaarToken', 'gedeeld', 'klasse', 'opNaam', 'passkey', 'route', 'zouZakken'], 'alleen getallen per route');
});

test('5. P0b: wie spreekt en wie logt komt uit de sessie, niet uit het lichaam', async () => {
  const fx = (await api('/api/office/boardroom', {}, eigenaar)).body.functies.flatMap(g => g.functies)[0];
  const v = await api('/api/office/paniek/stel', { functie: fx.id, aan: false, reden: 'proef van de spreker' }, gedeeld);
  assert.equal(v.status, 200, JSON.stringify(v.body).slice(0, 160));
  const b = await api('/api/office/paniek/bericht', { id: v.body.voorstel.id, wie: 'boardroom', tekst: 'Ik ben de boardroom.' }, gedeeld);
  assert.equal(b.status, 200);
  assert.equal(b.body.voorstel.discussie.at(-1).wie, 'paniekkamer', 'de gedeelde code sprak als de boardroom');
  const e = await api('/api/office/paniek/bericht', { id: v.body.voorstel.id, wie: 'paniekkamer', tekst: 'En ik wel.' }, eigenaar);
  assert.equal(e.body.voorstel.discussie.at(-1).wie, 'boardroom', 'wie een boardroomzetel heeft, spreekt als boardroom');
  /* MA van de tegenlezing: op naam is niet genoeg -- zonder boardroomzetel
     spreekt een medewerker op naam als de paniekkamer, wat hij ook typt. */
  const n = await api('/api/office/paniek/bericht', { id: v.body.voorstel.id, wie: 'boardroom', tekst: 'Ik ook?' }, mens.opNaam);
  assert.equal(n.status, 200, JSON.stringify(n.body).slice(0, 160));
  assert.equal(n.body.voorstel.discussie.at(-1).wie, 'paniekkamer', 'een sessie op naam zonder zetel sprak als de boardroom');
  await api('/api/office/paniek/besluit', { id: v.body.voorstel.id, besluit: 'wijs-af' }, eigenaar);

  const p = await api('/api/lab/project/maak', { titel: 'Proef voor de logregel', veld: 'dorp', voorWie: 'samen', doel: 'Wie schrijft' }, eigenaar);
  assert.equal(p.status, 200, JSON.stringify(p.body).slice(0, 160));
  const l = await api('/api/lab/project/log', { id: p.body.project.id, tekst: 'Een regel.', wie: 'De Directeur' }, gedeeld);
  assert.equal(l.status, 200, JSON.stringify(l.body).slice(0, 160));
  assert.notEqual(l.body.project.logboek[0].wie, 'De Directeur', 'de naam kwam uit het verzoek');
  assert.equal(l.body.project.logboek[0].wie, 'lab', 'met de gedeelde code staat er niemand');
});

test('6. P0b: de eigenaar tekent een vakbewijs af onder zijn eigen sleutel, niet onder een getypte naam', async () => {
  const u = (Date.now() + 1).toString(36);
  const lid = (await api('/api/auth/register', { name: 'Vakmens Proef', email: 'vk' + u + '@voorbeeld.test',
    phone: telefoon(), password: 'Geheim123!', geboortedatum: '1991-02-02', tier: 'rtg', pasApp: 'rtg' })).body.token;
  assert.equal((await api('/api/vakbewijs/zet', { wat: 'vog', nummer: 'VOG-P0B-1', tot: '2030-01-01' }, lid)).status, 200);
  const sleutel = (await api('/api/vakbewijs', {}, lid)).body.vakbewijzen.find(v => v.wat === 'vog').sleutel;
  const t = await api('/api/office/vakbewijs/teken', { sleutel, wat: 'vog', door: 'Iemand Anders' }, eigenaar);
  assert.equal(t.status, 200, JSON.stringify(t.body).slice(0, 160));
  assert.notEqual(t.body.vakbewijs.afgetekend.door, 'Iemand Anders', 'de naam onder de aftekening kwam uit het verzoek');
  assert.match(t.body.vakbewijs.afgetekend.door, /^user-\d+$/, 'de sleutel van de eigenaar, uit zijn sessie');
});
