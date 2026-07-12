/* Integratietests voor de RTFoundation-lesapp (gratis onderwijs): de live-les,
   het bord, het schrift, opgaven en de AI-bijles. Draait tegen een echte
   RTG-server in een tijdelijke datamap.

   Draai los: node --experimental-sqlite --test test/foundation.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 3900 + Math.floor(Math.random() * 80);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-'));
let child;

function api(pad, body) {
  return fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
}
const json = r => r.json();

test.before(async () => {
  child = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), RTG_DATA_DIR: TMP, NODE_ENV: 'test', SMTP_URL: '' },
    stdio: ['ignore', 'ignore', 'inherit']
  });
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(BASE + '/api/foundation/health'); if (r.ok) return; } catch (e) {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server startte niet op tijd');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

async function les() {
  const d = await json(await api('/les/maak', { vak: 'Rekenen', naam: 'Juf' }));
  const s = await json(await api('/les/join', { code: d.code, naam: 'Sara' }));
  return { code: d.code, tToken: d.token, sToken: s.token, studentId: s.studentId };
}

test('les maken en meedoen geeft een code en tokens', async () => {
  const d = await json(await api('/les/maak', { vak: 'Taal', naam: 'Meester' }));
  assert.equal(d.code.length, 6);
  assert.ok(d.token);
  const s = await api('/les/join', { code: d.code, naam: 'Kim' });
  assert.equal(s.status, 200);
  assert.ok((await json(s)).token);
  // meedoen met een onbekende code kan niet
  assert.equal((await api('/les/join', { code: 'XXXXXX', naam: 'Kim' })).status, 404);
});

test('het bord: docent tekent, iedereen ziet het; een leerling mag niet op het bord', async () => {
  const L = await les();
  const stroke = { tool: 'pen', kleur: '#ffffff', dikte: 4, points: [[10, 10], [20, 20], [30, 15]] };
  const r = await api('/bord/stroke', { code: L.code, token: L.tToken, stroke });
  assert.equal(r.status, 200);
  const bord = await json(await fetch(BASE + '/api/foundation/bord/' + L.code));
  assert.equal(bord.strokes.length, 1);
  assert.deepEqual(bord.strokes[0].points[0], [10, 10]);
  // een leerling kan niet op het bord tekenen
  assert.equal((await api('/bord/stroke', { code: L.code, token: L.sToken, stroke })).status, 403);
  // wissen mag alleen de docent
  assert.equal((await api('/bord/wis', { code: L.code, token: L.sToken })).status, 403);
  assert.equal((await api('/bord/wis', { code: L.code, token: L.tToken })).status, 200);
  assert.equal((await json(await fetch(BASE + '/api/foundation/bord/' + L.code))).strokes.length, 0);
});

test('opgave klaarzetten, inleveren, en de docent leest het schrift mee', async () => {
  const L = await les();
  const o = await json(await api('/opgave', { code: L.code, token: L.tToken, tekst: 'Hoeveel is 6 x 9?' }));
  assert.ok(o.opgave.id);
  // een leerling kan geen opgave klaarzetten
  assert.equal((await api('/opgave', { code: L.code, token: L.sToken, tekst: 'stiekem' })).status, 403);
  // leerling levert in
  assert.equal((await api('/opgave/inleveren', { code: L.code, token: L.sToken, opgaveId: o.opgave.id, antwoord: '54' })).status, 200);
  const opgaven = await json(await fetch(BASE + '/api/foundation/opgaven/' + L.code + '?token=' + L.tToken));
  assert.equal(Object.keys(opgaven.opgaven[0].inzendingen).length, 1);

  // schrift opslaan en de docent leest mee
  await api('/schrift/opslaan', { code: L.code, token: L.sToken, pages: [{ type: 'tekst', titel: 'Som', inhoud: '6 x 9 = 54' }] });
  const peek = await json(await fetch(BASE + '/api/foundation/schrift/' + L.code + '/' + L.studentId + '?token=' + L.tToken));
  assert.equal(peek.schrift.pages[0].inhoud, '6 x 9 = 54');
  // zonder docent-token mag je niet in andermans schrift
  assert.equal((await fetch(BASE + '/api/foundation/schrift/' + L.code + '/' + L.studentId + '?token=' + L.sToken)).status, 403);
});

test('XSS-preventie: HTML in een naam wordt ontdaan van < en >', async () => {
  const d = await json(await api('/les/maak', { vak: '<img src=x onerror=1>Wiskunde', naam: 'x' }));
  const info = await json(await fetch(BASE + '/api/foundation/les/' + d.code));
  assert.ok(!/[<>]/.test(info.les.vak), 'vak zonder < of >, kreeg: ' + info.les.vak);
});

test('op reis met de foundation: een aanvraag wordt bewaard, onvolledig geweigerd', async () => {
  // onvolledig (geen contact) wordt geweigerd
  assert.equal((await api('/reis/aanvraag', { naam: 'Fatima', waarom: 'zwaar jaar' })).status, 400);
  // volledige aanvraag lukt
  const r = await api('/reis/aanvraag', { soort: 'aanvraag', naam: 'Fatima', contact: 'fatima@voorbeeld.test', gezin: '2 volwassenen, 3 kinderen', waarom: 'Na een zwaar jaar zou even weg heel veel betekenen.' });
  assert.equal(r.status, 200);
  const h = await json(await fetch(BASE + '/api/foundation/health'));
  assert.ok(h.aanvragen >= 1, 'de aanvraag is bewaard');
});

test('het gezin: aanmaken, profiel toevoegen, kiezen met pincode, en een reis-oproep', async () => {
  // een gezin zonder pincode kan niet
  assert.equal((await api('/gezin/maak', { gezinsnaam: 'De Wit', naam: 'Sam' })).status, 400);
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'De Wit', naam: 'Sam', pin: '2468' }));
  assert.equal(g.code.length, 6);
  assert.ok(g.token && g.profiel.beheerder);

  // de beheerder voegt een kind-profiel toe met eigen pincode
  const kind = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Noor', rol: 'kind', pin: '1111' }));
  assert.equal(kind.profiel.naam, 'Noor');
  assert.ok(kind.profiel.heeftPin);
  // zonder beheerder-token mag je geen profiel toevoegen
  assert.equal((await api('/gezin/profiel/maak', { code: g.code, token: 'nep', naam: 'Indringer' })).status, 403);

  // inloggen toont de profielen zonder tokens
  const lijst = await json(await api('/gezin/inloggen', { code: g.code }));
  assert.equal(lijst.profielen.length, 2);
  assert.ok(lijst.profielen.every(p => p.token === undefined));

  // een profiel kiezen met verkeerde pin faalt, met goede pin lukt
  assert.equal((await api('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id, pin: '9999' })).status, 403);
  const open = await json(await api('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id, pin: '1111' }));
  assert.ok(open.token);

  // de beheerder stuurt een reis-oproep aan iedereen; het kind ziet hem
  await api('/gezin/bericht', { code: g.code, token: g.token, naar: 'allen', soort: 'reis', tekst: 'We gaan misschien op reis!' });
  const ber = await json(await fetch(BASE + '/api/foundation/gezin/' + g.code + '/berichten?token=' + open.token));
  assert.ok(ber.berichten.some(b => b.soort === 'reis' && /op reis/.test(b.tekst)));
  // ongelezen-teller staat op 1 voor het kind
  const mij = await json(await fetch(BASE + '/api/foundation/gezin/' + g.code + '/mij?token=' + open.token));
  assert.equal(mij.ongelezen, 1);

  // de laatste beheerder kan niet worden verwijderd
  const beheerders = lijst.profielen.filter(p => p.beheerder);
  assert.equal((await api('/gezin/profiel/verwijder', { code: g.code, token: g.token, profielId: beheerders[0].id })).status, 400);
});

test('samen vooruit: een spaardoel vullen tot het gehaald is, en een droom aanmoedigen', async () => {
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Groei', naam: 'Ouder', pin: '3690' }));
  const kind = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Tim', rol: 'kind' }));
  const kt = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id }))).token;

  // spaardoel maken en samen vullen
  const doel = await json(await api('/gezin/spaardoel/maak', { code: g.code, token: g.token, naam: 'Een fiets', doel: 100 }));
  assert.equal(doel.doel.nu, 0);
  // een leeg bedrag telt niet
  assert.equal((await api('/gezin/spaardoel/bijdrage', { code: g.code, token: kt, doelId: doel.doel.id, bedrag: 0 })).status, 400);
  await api('/gezin/spaardoel/bijdrage', { code: g.code, token: kt, doelId: doel.doel.id, bedrag: 60 });
  const laatste = await json(await api('/gezin/spaardoel/bijdrage', { code: g.code, token: g.token, doelId: doel.doel.id, bedrag: 50 }));
  assert.ok(laatste.doel.klaar, 'het doel is gehaald');
  assert.ok(laatste.gevierd, 'net gehaald geeft een feestje');
  // een kind kan geen spaardoel verwijderen, de beheerder wel
  assert.equal((await api('/gezin/spaardoel/verwijder', { code: g.code, token: kt, doelId: doel.doel.id })).status, 403);

  // dromenbord: kind plaatst, ouder moedigt aan
  const droom = await json(await api('/gezin/droom/maak', { code: g.code, token: kt, tekst: 'Ik wil leren zwemmen' }));
  const m = await json(await api('/gezin/droom/moedig', { code: g.code, token: g.token, droomId: droom.droom.id }));
  assert.equal(m.aantal, 1);
  assert.ok(m.aangemoedigd);
  // eigenaar vinkt hem af als gehaald
  const af = await json(await api('/gezin/droom/behaald', { code: g.code, token: kt, droomId: droom.droom.id }));
  assert.ok(af.droom.behaald);
  // iemand anders (geen eigenaar/beheerder) kan de droom niet weghalen: hier heeft de ouder wel beheerderrecht, dus test met een tweede kind
  const kind2 = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'San', rol: 'kind' }));
  const k2 = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: kind2.profiel.id }))).token;
  assert.equal((await api('/gezin/droom/verwijder', { code: g.code, token: k2, droomId: droom.droom.id })).status, 403);

  // gezinshulp-AI werkt voor een ingelogd profiel, niet zonder token
  const hulp = await api('/hulp/ai', { code: g.code, token: kt, kind: 'hulp', messages: [{ role: 'user', content: 'Ik heb hulp nodig met eten' }] });
  assert.equal(hulp.status, 200);
  assert.ok((await json(hulp)).text.length > 5);
  assert.equal((await api('/hulp/ai', { code: g.code, token: 'nep', kind: 'geld', messages: [{ role: 'user', content: 'hoi' }] })).status, 403);
  // de bespaartip en gesprekskaart laden
  assert.ok((await json(await fetch(BASE + '/api/foundation/bespaartip'))).tip.length > 5);
  assert.ok((await json(await fetch(BASE + '/api/foundation/gesprekskaart'))).kaart.length > 5);
});

test('rol-hulp: kind deelt locatie en stuurt een hulpvraag, en de coaches werken per rol', async () => {
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Zorg', naam: 'Pap', pin: '4820' }));
  const kind = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Lot', rol: 'kind' }));
  const kt = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id }))).token;

  // kind deelt status + locatie; ouder ziet het
  const loc = await api('/gezin/locatie', { code: g.code, token: kt, status: 'op school', lat: 52.37, lon: 4.9 });
  assert.equal(loc.status, 200);
  const lijst = await json(await fetch(BASE + '/api/foundation/gezin/' + g.code + '/locaties?token=' + g.token));
  const vanLot = lijst.locaties.find(l => l.naam === 'Lot');
  assert.ok(vanLot && vanLot.lat === 52.37 && vanLot.status === 'op school');
  // een rare lat wordt niet opgeslagen als coordinaat, wel de status
  await api('/gezin/locatie', { code: g.code, token: kt, status: 'onderweg', lat: 999, lon: 4.9 });
  const lijst2 = await json(await fetch(BASE + '/api/foundation/gezin/' + g.code + '/locaties?token=' + g.token));
  assert.equal(lijst2.locaties.find(l => l.naam === 'Lot').lat, undefined);
  // stoppen met delen haalt de locatie weg
  await api('/gezin/locatie/stop', { code: g.code, token: kt });
  const lijst3 = await json(await fetch(BASE + '/api/foundation/gezin/' + g.code + '/locaties?token=' + g.token));
  assert.ok(!lijst3.locaties.find(l => l.naam === 'Lot'));

  // kind stuurt een hulpvraag (soort hulp) die de ouder bij zijn berichten ziet
  await api('/gezin/bericht', { code: g.code, token: kt, naar: 'allen', soort: 'hulp', tekst: 'Ik wil praten' });
  const ber = await json(await fetch(BASE + '/api/foundation/gezin/' + g.code + '/berichten?token=' + g.token));
  assert.ok(ber.berichten.some(b => b.soort === 'hulp' && b.tekst === 'Ik wil praten'));

  // de rol-coaches geven antwoord voor een ingelogd profiel
  for (const kindsoort of ['opvoeden', 'steun', 'studie', 'pesten']) {
    const r = await api('/hulp/ai', { code: g.code, token: kt, kind: kindsoort, messages: [{ role: 'user', content: 'hoi, help me' }] });
    assert.equal(r.status, 200, kindsoort + ' antwoordt');
    assert.ok((await json(r)).text.length > 5);
  }
  // zonder geldig token geen coach
  assert.equal((await api('/hulp/ai', { code: g.code, token: 'nep', kind: 'opvoeden', messages: [{ role: 'user', content: 'hoi' }] })).status, 403);
});

test('gastrol: een oppas/familielid mag meehelpen maar niet bij de privezaken', async () => {
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Open Huis', naam: 'Mam', pin: '1470' }));
  const gast = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Oma', rol: 'gast' }));
  assert.ok(gast.profiel.gast === true, 'de gastvlag staat aan');
  const gt = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: gast.profiel.id }))).token;

  // WEL: berichten sturen en lezen (contact met het gezin)
  assert.equal((await api('/gezin/bericht', { code: g.code, token: gt, naar: 'allen', tekst: 'Ik ben er, alles rustig' })).status, 200);
  const ber = await json(await fetch(BASE + '/api/foundation/gezin/' + g.code + '/berichten?token=' + gt));
  assert.ok(ber.berichten.some(b => b.tekst === 'Ik ben er, alles rustig'));
  // WEL: locatie delen en het overzicht zien (weten waar de kinderen zijn)
  assert.equal((await api('/gezin/locatie', { code: g.code, token: gt, status: 'op school' })).status, 200);
  assert.equal((await fetch(BASE + '/api/foundation/gezin/' + g.code + '/locaties?token=' + gt)).status, 200);

  // NIET: geld, dromen en de persoonlijke coaches
  assert.equal((await api('/gezin/spaardoel/maak', { code: g.code, token: gt, naam: 'stiekem', doel: 10 })).status, 403);
  assert.equal((await fetch(BASE + '/api/foundation/gezin/' + g.code + '/spaardoelen?token=' + gt)).status, 403);
  assert.equal((await api('/gezin/droom/maak', { code: g.code, token: gt, tekst: 'stiekem' })).status, 403);
  assert.equal((await fetch(BASE + '/api/foundation/gezin/' + g.code + '/dromen?token=' + gt)).status, 403);
  assert.equal((await api('/hulp/ai', { code: g.code, token: gt, kind: 'geld', messages: [{ role: 'user', content: 'hoi' }] })).status, 403);

  // een gewoon gezinslid mag dit wel, ter controle
  const lid = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Broer', rol: 'gezinslid' }));
  const lt = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: lid.profiel.id }))).token;
  assert.equal((await api('/gezin/spaardoel/maak', { code: g.code, token: lt, naam: 'fiets', doel: 50 })).status, 200);

  // belangrijke gezinsinfo: de ouder vult in, de gast (oppas) mag het lezen maar niet wijzigen
  assert.equal((await api('/gezin/oppasinfo', { code: g.code, token: gt, allergie: 'stiekem' })).status, 403);
  const bewaard = await api('/gezin/oppasinfo', { code: g.code, token: g.token,
    noodcontacten: [{ naam: 'Mam', wie: 'Moeder', telefoon: '06 12 34 56 78' }, { naam: '', telefoon: '' }],
    allergie: 'Sanne is allergisch voor pinda\'s', eten: 'Bed om 19:30', huisregels: 'Schoenen uit' });
  assert.equal(bewaard.status, 200);
  // de gast leest het overzicht: lege contacten zijn eruit gefilterd
  const gezien = await json(await fetch(BASE + '/api/foundation/gezin/' + g.code + '/oppasinfo?token=' + gt));
  assert.equal(gezien.oppasinfo.noodcontacten.length, 1);
  assert.equal(gezien.oppasinfo.noodcontacten[0].naam, 'Mam');
  assert.match(gezien.oppasinfo.allergie, /pinda/);
  assert.equal(gezien.magBewerken, false, 'een gast mag niet bewerken');
});

test('privacy: gevoelige data ligt versleuteld op schijf en het gezin kan alles wissen', async () => {
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Privacy', naam: 'Ouder', pin: '9753' }));
  const kind = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Kai', rol: 'kind' }));
  const kt = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id }))).token;

  // gevoelige zaken achterlaten: locatie, gezondheidsinfo en een bericht
  await api('/gezin/locatie', { code: g.code, token: kt, status: 'op school', lat: 52.31337, lon: 4.94211 });
  await api('/gezin/oppasinfo', { code: g.code, token: g.token, allergie: 'GEHEIM-ALLERGIE-PINDAKAAS', eten: '', huisregels: '' });
  await api('/gezin/bericht', { code: g.code, token: kt, naar: 'allen', soort: 'hulp', tekst: 'GEHEIM-BERICHT-IK-WIL-PRATEN' });
  await new Promise(r => setTimeout(r, 200)); // even wachten tot alles is weggeschreven

  // het ruwe databasebestand mag deze gegevens niet leesbaar bevatten
  const ruw = fs.readFileSync(path.join(TMP, 'db.json'), 'utf8');
  assert.ok(ruw.includes('enc:'), 'er staat versleutelde data in de database');
  assert.ok(!ruw.includes('GEHEIM-ALLERGIE-PINDAKAAS'), 'de allergie-info staat niet leesbaar op schijf');
  assert.ok(!ruw.includes('GEHEIM-BERICHT-IK-WIL-PRATEN'), 'het bericht staat niet leesbaar op schijf');
  assert.ok(!ruw.includes('52.31337'), 'de exacte locatie staat niet leesbaar op schijf');
  // maar via de app is alles gewoon leesbaar
  const info = await json(await fetch(BASE + '/api/foundation/gezin/' + g.code + '/oppasinfo?token=' + kt));
  assert.match(info.oppasinfo.allergie, /PINDAKAAS/);
  const loc = await json(await fetch(BASE + '/api/foundation/gezin/' + g.code + '/locaties?token=' + g.token));
  assert.equal(loc.locaties.find(l => l.naam === 'Kai').lat, 52.31337);

  // AVG: wissen kan alleen de beheerder met de juiste pincode
  assert.equal((await api('/gezin/wissen', { code: g.code, token: kt, pin: '9753' })).status, 403); // kind mag niet
  assert.equal((await api('/gezin/wissen', { code: g.code, token: g.token, pin: '0000' })).status, 403); // foute pin
  assert.equal((await api('/gezin/wissen', { code: g.code, token: g.token, pin: '9753' })).status, 200);
  // daarna bestaat het gezin niet meer
  assert.equal((await api('/gezin/inloggen', { code: g.code })).status, 404);
});

test('twee volwassenen: verwijderen vraagt toestemming van de tweede', async () => {
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Samen', naam: 'Ouder A', pin: '1212' }));
  // tweede volwassene toevoegen (ouder) met eigen pin
  const b = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Ouder B', rol: 'ouder', pin: '3434' }));
  const bt = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: b.profiel.id, pin: '3434' }))).token;

  // A vraagt verwijderen aan: dat wist niet meteen, maar wacht op toestemming
  const verzoek = await json(await api('/gezin/wissen', { code: g.code, token: g.token, pin: '1212' }));
  assert.ok(verzoek.wachtOpToestemming && !verzoek.verwijderd);
  // A kan niet zelf bevestigen
  assert.equal((await api('/gezin/wissen/bevestig', { code: g.code, token: g.token, pin: '1212' })).status, 403);
  // B ziet het verzoek en bevestigt met zijn pin
  const mijB = await json(await fetch(BASE + '/api/foundation/gezin/' + g.code + '/mij?token=' + bt));
  assert.equal(mijB.wisVerzoek.doorNaam, 'Ouder A');
  assert.equal(mijB.wisVerzoek.vanMij, false);
  const weg = await api('/gezin/wissen/bevestig', { code: g.code, token: bt, pin: '3434' });
  assert.equal(weg.status, 200);
  assert.equal((await api('/gezin/inloggen', { code: g.code })).status, 404);

  // met maar een volwassene wist het wel meteen
  const g2 = await json(await api('/gezin/maak', { gezinsnaam: 'Alleen', naam: 'Solo', pin: '5656' }));
  await api('/gezin/profiel/maak', { code: g2.code, token: g2.token, naam: 'Kind', rol: 'kind' });
  assert.ok((await json(await api('/gezin/wissen', { code: g2.code, token: g2.token, pin: '5656' }))).verwijderd);
});

test('oppas met RTG-pas: koppelt zijn gastprofiel en krijgt de gezinsmeldingen in de RTG-app', async () => {
  // een echt RTG-account aanmaken (de oppas/opa), met token
  const reg = await json(await (await fetch(BASE + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Opa Jan', email: 'opa' + Date.now() + '@voorbeeld.test', phone: '0612345678', password: 'geheim123', geboortedatum: '1958-04-10', tier: 'lifestyle' })
  })));
  const rtgToken = reg.token;
  const rtgCall = (pad, body) => fetch(BASE + '/api' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + rtgToken }, body: JSON.stringify(body || {}) });

  // gezin met een gastprofiel voor opa
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Fam Steun', naam: 'Ma', pin: '2323' }));
  const gast = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Opa', rol: 'gast' }));

  // opa ziet de gastprofielen en koppelt het zijne vanuit zijn RTG-app
  const prof = await json(await rtgCall('/rtf/profielen', { code: g.code }));
  assert.ok(prof.profielen.some(p => p.naam === 'Opa'));
  const kop = await rtgCall('/rtf/koppel', { code: g.code, profielId: gast.profiel.id });
  assert.equal(kop.status, 200);

  // de beheerder stuurt een oproep aan iedereen -> komt in opa's RTG-app binnen
  await api('/gezin/bericht', { code: g.code, token: g.token, naar: 'allen', soort: 'reis', tekst: 'We gaan misschien op reis!' });
  const st = await json(await rtgCall('/state', {}));
  assert.ok(st.state.foundation, 'de RTG-app-state bevat foundation');
  assert.equal(st.state.foundation.gekoppeld.length, 1);
  assert.ok(st.state.foundation.meldingen.some(x => /op reis/.test(x.tekst) && x.gezin === 'Fam Steun'), 'de melding staat in de RTG-app');

  // opa antwoordt het gezin vanuit de RTG-app; het komt in de gezinsberichten
  assert.equal((await rtgCall('/rtf/bericht', { code: g.code, tekst: 'Wat leuk, ik pas graag op!' })).status, 200);
  const ber = await json(await fetch(BASE + '/api/foundation/gezin/' + g.code + '/berichten?token=' + g.token));
  assert.ok(ber.berichten.some(b => b.vanNaam === 'Opa' && /pas graag op/.test(b.tekst)), 'het antwoord staat in de gezinsberichten');

  // ontkoppelen kan, daarna geen nieuwe meldingen meer
  assert.equal((await rtgCall('/rtf/ontkoppel', { code: g.code, profielId: gast.profiel.id })).status, 200);
  const st2 = await json(await rtgCall('/state', {}));
  assert.equal(st2.state.foundation.gekoppeld.length, 0);
});

test('gezinsagenda en klusjes: plannen samen en sterren verdienen', async () => {
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Actief', naam: 'Pap', pin: '8989' }));
  const kind = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Loes', rol: 'kind' }));
  const kt = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id }))).token;
  const gast = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Opa', rol: 'gast' }));
  const gt = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: gast.profiel.id }))).token;

  // agenda: ouder plant, gast mag lezen maar niet toevoegen
  assert.equal((await api('/gezin/agenda', { code: g.code, token: g.token, titel: 'Loes naar voetbal', datum: '2026-08-01', tijd: '17:00' })).status, 200);
  assert.equal((await api('/gezin/agenda', { code: g.code, token: gt, titel: 'stiekem', datum: '2026-08-01' })).status, 403);
  const agGast = await json(await fetch(BASE + '/api/foundation/gezin/' + g.code + '/agenda?token=' + gt));
  assert.ok(agGast.agenda.some(a => a.titel === 'Loes naar voetbal'));
  assert.equal(agGast.magBewerken, false);

  // klusjes: ouder zet klaar, kind doet, ouder keurt goed -> sterren
  const klus = await json(await api('/gezin/klus', { code: g.code, token: g.token, titel: 'Tafel dekken', sterren: 3, voor: kind.profiel.id }));
  // een kind kan geen klus klaarzetten, een gast geen klus afvinken
  assert.equal((await api('/gezin/klus', { code: g.code, token: kt, titel: 'nee', sterren: 1 })).status, 403);
  assert.equal((await api('/gezin/klus/gedaan', { code: g.code, token: gt, klusId: klus.klus.id })).status, 403);
  // kind vinkt af, ouder keurt goed
  assert.equal((await api('/gezin/klus/gedaan', { code: g.code, token: kt, klusId: klus.klus.id })).status, 200);
  assert.equal((await api('/gezin/klus/keur', { code: g.code, token: g.token, klusId: klus.klus.id, goed: true })).status, 200);
  const kl = await json(await fetch(BASE + '/api/foundation/gezin/' + g.code + '/klussen?token=' + g.token));
  assert.equal(kl.sterren.find(x => x.naam === 'Loes').sterren, 3);
  assert.equal(kl.klussen[0].status, 'goedgekeurd');
  // een gast mag de klusjes niet inzien
  assert.equal((await fetch(BASE + '/api/foundation/gezin/' + g.code + '/klussen?token=' + gt)).status, 403);
});

test('AI-bijles: alleen voor wie meedoet, en de tip laadt', async () => {
  const L = await les();
  const goed = await api('/ai', { code: L.code, token: L.sToken, messages: [{ role: 'user', content: 'Help met breuken' }] });
  assert.equal(goed.status, 200);
  assert.ok((await json(goed)).text.length > 5);
  // zonder geldig lestoken geen hulp
  assert.equal((await api('/ai', { code: L.code, token: 'nep', messages: [{ role: 'user', content: 'hoi' }] })).status, 403);
  const tip = await json(await fetch(BASE + '/api/foundation/tip'));
  assert.ok(tip.tip && tip.tip.length > 5);
});
