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
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-'));
let child;

function api(pad, body) {
  return fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
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

  // de ouder vult de belangrijke info en agenda in en deelt een locatie
  await api('/gezin/oppasinfo', { code: g.code, token: g.token, allergie: 'Pinda-allergie bij Sanne', eten: 'Bed om 19:30', huisregels: 'Schoenen uit' });
  await api('/gezin/agenda', { code: g.code, token: g.token, titel: 'Zwemles', datum: '2026-09-01', tijd: '16:00' });
  await api('/gezin/locatie', { code: g.code, token: g.token, status: 'op school', lat: 52.1, lon: 5.1 });
  // opa leest alles (allergenen, agenda, waar iedereen is) in de RTG-app
  const ov = await json(await rtgCall('/rtf/overzicht', {}));
  const gz = (ov.gezinnen || []).find(x => x.gezinNaam === 'Fam Steun');
  assert.ok(gz, 'het gekoppelde gezin staat in het overzicht');
  assert.match(gz.oppasinfo.allergie, /Pinda/);
  assert.match(gz.oppasinfo.huisregels, /Schoenen/);
  assert.ok(gz.agenda.some(a => a.titel === 'Zwemles'), 'de agenda is zichtbaar');
  assert.ok(gz.locaties.some(l => l.status === 'op school' && l.lat === 52.1), 'de locatie is zichtbaar');

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

test('WebRTC: de app krijgt ijs-servers (STUN) voor het bellen', async () => {
  const d = await json(await fetch(BASE + '/api/ice'));
  assert.ok(Array.isArray(d.iceServers) && d.iceServers.length >= 1, 'er is minstens een ICE-server');
  assert.ok(JSON.stringify(d.iceServers).includes('stun:'), 'STUN staat aan');
});

test('in de app chatten en bellen tussen gezinsleden', async () => {
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Praat', naam: 'Ma', pin: '2020' }));
  const kind = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Tim', rol: 'kind' }));
  const kt = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id }))).token;
  const maId = (await json(await fetch(BASE + '/api/foundation/gezin/' + g.code + '/mij?token=' + g.token))).profiel.id;

  // Ma stuurt Tim een chatbericht
  assert.equal((await api('/gezin/chat', { code: g.code, token: g.token, naar: kind.profiel.id, tekst: 'Kom je eten?' })).status, 200);
  // Tim leest het gesprek en ziet het (niet van hemzelf)
  const thread = await json(await fetch(BASE + '/api/foundation/gezin/' + g.code + '/chat/' + maId + '?token=' + kt));
  assert.ok(thread.berichten.some(b => b.tekst === 'Kom je eten?' && b.vanMij === false));
  // in Tims chatlijst staat Ma met het laatste bericht (nu gelezen, dus 0 ongelezen)
  const lijst = await json(await fetch(BASE + '/api/foundation/gezin/' + g.code + '/chats?token=' + kt));
  const metMa = lijst.chats.find(c => c.naam === 'Ma');
  assert.equal(metMa.laatste, 'Kom je eten?');
  assert.equal(metMa.ongelezen, 0);
  // Tim antwoordt
  await api('/gezin/chat', { code: g.code, token: kt, naar: maId, tekst: 'Ja!' });
  const maLijst = await json(await fetch(BASE + '/api/foundation/gezin/' + g.code + '/chats?token=' + g.token));
  assert.equal(maLijst.chats.find(c => c.naam === 'Tim').ongelezen, 1);

  // een belsignaal doorgeven lukt (relay); onbekend lid faalt
  assert.equal((await api('/gezin/bel', { code: g.code, token: g.token, naar: kind.profiel.id, kind: 'ring', video: true })).status, 200);
  assert.equal((await api('/gezin/bel', { code: g.code, token: g.token, naar: 'xxx', kind: 'ring' })).status, 404);

  // de gekoppelde oppas krijgt via de RTG-app het kanaal (profieltoken + leden)
  const reg = await json(await (await fetch(BASE + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Oma', email: 'o' + Date.now() + '@v.test', phone: '0612345678', password: 'geheim123', geboortedatum: '1955-01-01', tier: 'rtg' }) })));
  const gast = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Oma', rol: 'gast' }));
  await fetch(BASE + '/api/rtf/koppel', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token }, body: JSON.stringify({ code: g.code, profielId: gast.profiel.id }) });
  const kan = await json(await (await fetch(BASE + '/api/rtf/kanaal', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token }, body: JSON.stringify({ code: g.code }) })));
  assert.ok(kan.token && kan.profielId === gast.profiel.id);
  assert.ok(kan.leden.some(l => l.naam === 'Ma') && kan.leden.some(l => l.naam === 'Tim'));
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

// raw fetch buiten /api/foundation (voor supplier- en rtf-endpoints)
function raw(pad, body, token) {
  return fetch(BASE + '/api' + pad, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  });
}

test('cross-app vrienden: RTF en RTG vinden elkaar op codenaam, chatten, snappen; kind wacht op ouder', async () => {
  const now = Date.now();
  const foto = 'data:image/png;base64,' + Buffer.from('x'.repeat(60)).toString('base64');
  // RTG-lid
  const rtg = await json(await raw('/auth/register', { name: 'Lid Soc', email: 'ls' + now + '@v.test', phone: '06' + String(now).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' }));
  const rtgTok = rtg.token, rtgCn = rtg.state.user.codename;
  await raw('/member/connections', {}, rtgTok); // zet zichzelf in de gids

  // RTF-gezin: een ouder (beheerder) en een kind, beiden met codenaam
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Soc Fam', naam: 'Ouder', pin: '2468', groep: 'volw' }));
  const mij = await json(await fetch(BASE + '/api/foundation/gezin/' + g.code + '/mij?token=' + g.token));
  const ouderCn = mij.profiel.codenaam;
  assert.ok(ouderCn, 'een gezinslid krijgt een codenaam');
  const kind0 = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Sara', rol: 'kind', groep: 'kind' }));
  const kindCn = kind0.profiel.codenaam;

  // RTG vindt de RTF-ouder op codenaam en stuurt een verzoek
  const found = await json(await raw('/member/find', { q: ouderCn.split(' ')[0] }, rtgTok));
  const ouderKey = (found.results.find(r => r.codename === ouderCn) || {}).key;
  assert.ok(ouderKey, 'RTG vindt de RTF-ouder op codenaam');
  assert.equal((await raw('/member/connect', { key: ouderKey }, rtgTok)).status, 200);
  // de ouder ziet en accepteert het verzoek via de RTF-social-endpoints
  const oConns = await json(await raw('/rtf/social/connections', { code: g.code, token: g.token }));
  const verzoek = (oConns.requests || []).find(x => x.codename === rtgCn);
  assert.ok(verzoek, 'de ouder ziet het verzoek van RTG');
  await raw('/rtf/social/respond', { code: g.code, token: g.token, key: verzoek.key, action: 'accept' });
  // nu vrienden: de ouder chat met RTG, RTG leest het
  assert.equal((await raw('/rtf/social/dm/send', { code: g.code, token: g.token, toKey: verzoek.key, text: 'Hoi RTG!' })).status, 200);
  const rtgThread = await json(await raw('/member/dm', { withKey: ouderKey }, rtgTok));
  assert.ok((rtgThread.messages || []).some(m => /Hoi RTG/.test(m.text)), 'RTG leest het bericht van de RTF-ouder');

  // Het KIND (15 of jonger) is beschermd: onvindbaar voor RTG, en alleen de
  // ouder voegt vrienden toe (oudervoeg). Daarna accepteert de RTG-kant gewoon.
  const found2 = await json(await raw('/member/find', { q: kindCn.split(' ')[0] }, rtgTok));
  assert.ok(!found2.results.some(r => r.codename === kindCn), 'een beschermd kind is onvindbaar in het zoeken');
  const bConns = await json(await raw('/rtf/social/connections', { code: g.code, token: g.token }));
  const kindKey = (bConns.kinderen.find(k => k.codenaam === kindCn) || {}).handle;
  assert.ok(kindKey, 'de ouder ziet het kind in zijn meekijk-lijst');
  assert.equal((await raw('/member/connect', { key: kindKey }, rtgTok)).status, 404, 'rechtstreeks verbinden met een beschermd kind kan niet');
  assert.equal((await raw('/member/dm/send', { toKey: kindKey, text: 'hoi' }, rtgTok)).status, 403, 'geen chat zonder vriendschap');
  // de ouder voegt de RTG-vriend toe voor het kind; RTG accepteert
  const voeg = await json(await raw('/rtf/social/oudervoeg', { code: g.code, token: g.token, kindHandle: kindKey, codenaam: rtgCn }));
  assert.ok(voeg.ok, 'de ouder voegt een vriend toe voor het kind');
  const rtgReqs = await json(await raw('/member/connections', {}, rtgTok));
  const vzk = (rtgReqs.requests || []).find(r => r.key === kindKey);
  assert.ok(vzk, 'RTG ziet het door de ouder gestuurde verzoek');
  await raw('/member/connect/respond', { key: kindKey, action: 'accept' }, rtgTok);
  assert.equal((await raw('/member/dm/send', { toKey: kindKey, text: 'hoi vriendje' }, rtgTok)).status, 200, 'na ouder-toevoeging en acceptatie mag de chat');

  // SNAP: RTG snapt naar de ouder; die bekijkt hem een keer en dan is hij weg
  assert.equal((await raw('/member/snap/send', { toKey: ouderKey, foto, tekst: 'kiek' }, rtgTok)).status, 200);
  const snaps = await json(await raw('/rtf/social/snaps', { code: g.code, token: g.token }));
  const snapId = (snaps.snaps[0] || {}).id;
  assert.ok(snapId, 'de ouder ziet een snap binnenkomen');
  assert.ok((await json(await raw('/rtf/social/snap/view', { code: g.code, token: g.token, id: snapId }))).foto, 'de ouder opent de snap');
  const snaps2 = await json(await raw('/rtf/social/snaps', { code: g.code, token: g.token }));
  assert.ok(!snaps2.snaps.some(s => s.id === snapId), 'de snap is weg na bekijken');

  // STORY: de ouder plaatst een 24-uurs verhaal; de RTG-vriend ziet het
  assert.equal((await raw('/rtf/social/story/post', { code: g.code, token: g.token, foto, tekst: 'ons verhaal' })).status, 200);
  const stories = await json(await raw('/member/stories', {}, rtgTok));
  assert.ok(stories.stories.some(s => s.van === ouderCn), 'de RTG-vriend ziet het verhaal van de RTF-vriend');
});

// open een SSE-kanaal en wacht op een benoemd event (voor de belsignalen)
async function openStream(url) {
  const ac = new AbortController();
  const res = await fetch(url, { signal: ac.signal });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const wachters = [];
  (async () => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
          let ev = 'message', data = '';
          for (const l of chunk.split('\n')) {
            if (l.startsWith('event:')) ev = l.slice(6).trim();
            else if (l.startsWith('data:')) data += l.slice(5).trim();
          }
          if (!data) continue;
          let parsed; try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
          for (let i = wachters.length - 1; i >= 0; i--) if (wachters[i].event === ev) { wachters[i].resolve(parsed); wachters.splice(i, 1); }
        }
      }
    } catch (e) {}
  })();
  return {
    wachtOp(event) { return new Promise((resolve, reject) => { const w = { event, resolve }; wachters.push(w); setTimeout(() => { const i = wachters.indexOf(w); if (i >= 0) { wachters.splice(i, 1); reject(new Error('geen ' + event + '-signaal op tijd')); } }, 4000); }); },
    sluit() { try { ac.abort(); } catch (e) {} }
  };
}

test('cross-app bellen: RTG en RTF sturen belsignalen over en weer via het live-kanaal', async () => {
  const now = Date.now();
  // RTG-lid en RTF-ouder, bevriend maken
  const rtg = await json(await raw('/auth/register', { name: 'Bel Lid', email: 'bl' + now + '@v.test', phone: '06' + String(now).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' }));
  const rtgTok = rtg.token, rtgCn = rtg.state.user.codename;
  await raw('/member/connections', {}, rtgTok);
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Bel Fam', naam: 'Ouder', pin: '2468', groep: 'volw' }));
  const mij = await json(await fetch(BASE + '/api/foundation/gezin/' + g.code + '/mij?token=' + g.token));
  const ouderCn = mij.profiel.codenaam;
  const found = await json(await raw('/member/find', { q: ouderCn.split(' ')[0] }, rtgTok));
  const ouderKey = (found.results.find(r => r.codename === ouderCn) || {}).key;
  await raw('/member/connect', { key: ouderKey }, rtgTok);
  const oConns = await json(await raw('/rtf/social/connections', { code: g.code, token: g.token }));
  const verzoek = (oConns.requests || []).find(x => x.codename === rtgCn);
  await raw('/rtf/social/respond', { code: g.code, token: g.token, key: verzoek.key, action: 'accept' });
  const rtgKey = verzoek.key; // handle van het RTG-lid

  const rtgStream = await openStream(BASE + '/api/stream?token=' + encodeURIComponent(rtgTok));
  const rtfStream = await openStream(BASE + '/api/rtf/social/stream?code=' + encodeURIComponent(g.code) + '&token=' + encodeURIComponent(g.token));
  try {
    // RTG belt de RTF-ouder: de ouder krijgt het 'ring'-signaal live binnen
    const wachtRtf = rtfStream.wachtOp('call');
    assert.equal((await raw('/member/call', { toKey: ouderKey, kind: 'ring', video: false }, rtgTok)).status, 200);
    const inkRtf = await wachtRtf;
    assert.equal(inkRtf.kind, 'ring');
    assert.equal(inkRtf.codename, rtgCn, 'de ouder ziet wie er belt');

    // RTF belt terug: het RTG-lid krijgt het videosignaal binnen
    const wachtRtg = rtgStream.wachtOp('call');
    assert.equal((await raw('/rtf/social/call', { code: g.code, token: g.token, toKey: rtgKey, kind: 'ring', video: true })).status, 200);
    const inkRtg = await wachtRtg;
    assert.equal(inkRtg.kind, 'ring');
    assert.equal(inkRtg.video, true);
    assert.equal(inkRtg.from, ouderKey, 'het lid weet naar wie het moet terugsignaleren');

    // niet naar een vreemde: alleen vrienden mogen elkaar bellen
    const vreemd = await json(await raw('/auth/register', { name: 'Vreemd', email: 'vr' + now + '@v.test', phone: '06' + String(now + 1).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' }));
    const vKey = (await json(await raw('/member/connections', {}, vreemd.token))).me;
    assert.equal((await raw('/rtf/social/call', { code: g.code, token: g.token, toKey: vKey, kind: 'ring' })).status, 403, 'geen belsignaal naar een niet-vriend');
  } finally {
    rtgStream.sluit(); rtfStream.sluit();
  }
});

test('realtime herstel: gemiste belsignalen worden opnieuw afgespeeld na herverbinden', async () => {
  const now = Date.now();
  const rtg = await json(await raw('/auth/register', { name: 'Herstel Lid', email: 'hl' + now + '@v.test', phone: '06' + String(now).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' }));
  const rtgTok = rtg.token, rtgCn = rtg.state.user.codename;
  const rtgKey = (await json(await raw('/member/connections', {}, rtgTok))).me;
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Herstel Fam', naam: 'Ouder', pin: '2468', groep: 'volw' }));
  const mij = await json(await fetch(BASE + '/api/foundation/gezin/' + g.code + '/mij?token=' + g.token));
  const ouderCn = mij.profiel.codenaam;
  const found = await json(await raw('/member/find', { q: ouderCn.split(' ')[0] }, rtgTok));
  const ouderKey = found.results.find(r => r.codename === ouderCn).key;
  await raw('/member/connect', { key: ouderKey }, rtgTok);
  const oConns = await json(await raw('/rtf/social/connections', { code: g.code, token: g.token }));
  await raw('/rtf/social/respond', { code: g.code, token: g.token, key: oConns.requests.find(x => x.codename === rtgCn).key, action: 'accept' });

  // twee belsignalen terwijl het lid GEEN stream open heeft (worden gebufferd)
  await raw('/rtf/social/call', { code: g.code, token: g.token, toKey: rtgKey, kind: 'ring', video: false });
  await raw('/rtf/social/call', { code: g.code, token: g.token, toKey: rtgKey, kind: 'ring', video: true });

  // het lid verbindt (opnieuw) met since=1: de gemiste signalen worden nagestuurd
  const ac = new AbortController();
  const res = await fetch(BASE + '/api/stream?token=' + encodeURIComponent(rtgTok) + '&since=1', { signal: ac.signal });
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '', calls = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 800) {
    const { value, done } = await Promise.race([reader.read(), new Promise(r => setTimeout(() => r({ value: undefined, done: false }), 300))]);
    if (done) break;
    if (value) buf += dec.decode(value, { stream: true });
    calls = (buf.match(/event: call/g) || []).length;
    if (calls >= 2) break;
  }
  ac.abort();
  assert.ok(calls >= 2, 'beide gemiste belsignalen zijn opnieuw afgespeeld (kreeg ' + calls + ')');
});

test('sociale veiligheid: blokkeren, melden en ouder-meekijk op kindcontacten', async () => {
  const now = Date.now();
  const rtg = await json(await raw('/auth/register', { name: 'Veilig Lid', email: 'vl' + now + '@v.test', phone: '06' + String(now).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' }));
  const rtgTok = rtg.token, rtgCn = rtg.state.user.codename;
  await raw('/member/connections', {}, rtgTok);
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Veilig Fam', naam: 'Ouder', pin: '2468', groep: 'volw' }));
  const mij = await json(await fetch(BASE + '/api/foundation/gezin/' + g.code + '/mij?token=' + g.token));
  const ouderCn = mij.profiel.codenaam;
  const kind0 = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Sam', rol: 'kind', groep: 'kind' }));
  const kindCn = kind0.profiel.codenaam;

  // RTG en ouder worden vrienden
  const found = await json(await raw('/member/find', { q: ouderCn.split(' ')[0] }, rtgTok));
  const ouderKey = found.results.find(r => r.codename === ouderCn).key;
  await raw('/member/connect', { key: ouderKey }, rtgTok);
  const oConns = await json(await raw('/rtf/social/connections', { code: g.code, token: g.token }));
  await raw('/rtf/social/respond', { code: g.code, token: g.token, key: oConns.requests.find(x => x.codename === rtgCn).key, action: 'accept' });

  // BLOKKEREN: het lid blokkeert de ouder; de vriendschap valt weg en de ouder kan niet meer appen
  assert.equal((await raw('/member/block', { key: ouderKey }, rtgTok)).status, 200);
  const naBlok = await json(await raw('/member/connections', {}, rtgTok));
  assert.ok(!(naBlok.connections || []).some(c => c.key === ouderKey), 'na blokkeren is de vriendschap weg');
  assert.equal((await raw('/rtf/social/dm/send', { code: g.code, token: g.token, toKey: (await json(await raw('/rtf/social/connections', { code: g.code, token: g.token }))).me, text: 'hoi' })).status, 403, 'de ouder kan niet meer terugkoppelen');
  // opnieuw verbinden lukt niet zolang de blokkade staat
  assert.equal((await raw('/member/connect', { key: ouderKey }, rtgTok)).status, 403, 'verbinden met een geblokkeerde kan niet');
  await raw('/member/unblock', { key: ouderKey }, rtgTok);
  assert.equal((await raw('/member/connect', { key: ouderKey }, rtgTok)).status, 200, 'na deblokkeren mag het weer');

  // MELDEN: een melding wordt aangenomen
  assert.equal((await raw('/member/report', { key: ouderKey, reden: 'ongepast' }, rtgTok)).status, 200);

  // OUDER-MEEKIJK: het kind is onvindbaar voor het lid; de ouder voegt het lid
  // toe voor het kind, ziet in het meekijken dat het een VOLWASSENE is, en kan
  // het contact ook weer verwijderen.
  const memberKey = (await json(await raw('/member/connections', {}, rtgTok))).me;
  const found2 = await json(await raw('/member/find', { q: kindCn.split(' ')[0] }, rtgTok));
  assert.ok(!found2.results.some(r => r.codename === kindCn), 'het beschermde kind is onvindbaar voor het lid');
  const bConns = await json(await raw('/rtf/social/connections', { code: g.code, token: g.token }));
  const kindKey = (bConns.kinderen.find(k => k.codenaam === kindCn) || {}).handle;
  assert.ok(kindKey, 'de ouder ziet het kind in het meekijk-lijstje');
  assert.ok((await json(await raw('/rtf/social/oudervoeg', { code: g.code, token: g.token, kindHandle: kindKey, codenaam: rtgCn }))).ok);
  // de ouder kijkt de contacten van het kind in: het lid staat er als volwassene
  const contacten = await json(await raw('/rtf/social/kind/contacten', { code: g.code, token: g.token, kindHandle: kindKey }));
  const cc = (contacten.contacten || []).find(c => c.key === memberKey);
  assert.ok(cc, 'de ouder ziet het contact van het kind met het lid');
  assert.equal(cc.volwassene, true, 'en ziet dat het een volwassene is');
  assert.equal((await raw('/rtf/social/kind/verwijder', { code: g.code, token: g.token, kindHandle: kindKey, anderKey: memberKey })).status, 200);
  const na = await json(await raw('/rtf/social/kind/contacten', { code: g.code, token: g.token, kindHandle: kindKey }));
  assert.ok(!(na.contacten || []).some(c => c.key === memberKey), 'na verwijderen is het contact weg');
});

test('automatisch vertalen: bericht komt in de taal van de lezer, beide kanten op', async () => {
  // Nederlands naar Engels (vaste seed-zin) en Engels naar Nederlands (woordniveau)
  const nl2en = await json(await (await fetch(BASE + '/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Snackbar dicht, telefoon uit, ik ben even niemands baas.', to: 'en' }) })));
  assert.equal(nl2en.translated, true);
  assert.match(nl2en.text, /Snack bar closed/);
  const en2nl = await json(await (await fetch(BASE + '/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'hello, thanks for the message', to: 'nl' }) })));
  assert.equal(en2nl.translated, true);
  assert.match(en2nl.text, /hallo|bedankt/);
  // al in de doeltaal: niets te vertalen
  const zelfde = await json(await (await fetch(BASE + '/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'hello there', to: 'en' }) })));
  assert.equal(zelfde.translated, false);
});

test('leeftijdsgroepen: vijf groepen op profielen, mag-solliciteren vanaf 16', async () => {
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Groepen', naam: 'Ouder', pin: '1357', groep: 'volw' }));
  // beheerder is volwassen en mag solliciteren
  const mij = await json(await fetch(BASE + '/api/foundation/gezin/' + g.code + '/mij?token=' + g.token));
  assert.equal(mij.profiel.groep, 'volw');
  assert.equal(mij.profiel.magSolliciteren, true);
  // een kind (5-11): geen solliciteren, wel een nette groepsnaam
  const kind = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Sofie', rol: 'kind', groep: 'kind' }));
  assert.equal(kind.profiel.groep, 'kind');
  assert.equal(kind.profiel.magSolliciteren, false);
  assert.ok(kind.profiel.groepNaam && kind.profiel.groepBereik);
  // een tiener (12-15) mag nog niet solliciteren; een jongvolwassene (16-21) wel
  const jong = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Noor', rol: 'kind', groep: 'jong' }));
  assert.equal(jong.profiel.magSolliciteren, true);
  // een onbekende groep wordt genegeerd
  const raar = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'X', rol: 'kind', groep: 'zomaar' }));
  assert.equal(raar.profiel.groep, null);
});

test('vacatures: partner plaatst, RTF toont en lid solliciteert met cv (vanaf 16)', async () => {
  // partner logt in als bedrijfsaccount (demo) en plaatst een vacature
  const login = await json(await raw('/supplier/login', { username: 'rahul', password: 'Imran' }));
  assert.ok(login.token, 'supplier-login geeft een token');
  const supCode = login.state.supplier.code;
  const vac = await json(await raw('/supplier/vacature', { func: 'Afwasser', soort: 'bijbaan', minLeeftijd: 16, plaats: 'Amsterdam', uren: '8u/week', omschrijving: 'Meehelpen in de keuken.' }, login.token));
  assert.ok(vac.ok && vac.vacatures.length >= 1);
  const vacId = vac.vacatures[0].id;

  // de RTF-app ziet de openstaande vacature (leeftijd 16)
  const lijst = await json(await raw('/rtf/vacatures', { leeftijd: 16 }));
  const gevonden = lijst.vacatures.find(v => v.id === vacId);
  assert.ok(gevonden, 'vacature verschijnt in de RTFoundation');
  assert.equal(gevonden.bedrijf, login.state.supplier.name);
  // internationaal: elke vacature draagt een land, en er is een landenlijst om
  // in het buitenland te zoeken
  assert.ok(gevonden.land && gevonden.landNaam, 'de vacature draagt een land');
  assert.ok(Array.isArray(lijst.landen) && lijst.landen.some(l => l.code === gevonden.land), 'de landenlijst bevat het land');
  // filteren op een land waar niets staat, geeft geen resultaten
  const leegLand = gevonden.land === 'JP' ? 'NL' : 'JP';
  const geenLijst = await json(await raw('/rtf/vacatures', { leeftijd: 16, land: leegLand }));
  assert.ok(!geenLijst.vacatures.some(v => v.id === vacId), 'landfilter sluit andere landen uit');
  // filteren op het juiste land toont de vacature wel
  const welLijst = await json(await raw('/rtf/vacatures', { leeftijd: 16, land: gevonden.land }));
  assert.ok(welLijst.vacatures.some(v => v.id === vacId), 'landfilter toont het juiste land');

  // een gezin met token: solliciteren vereist een geldig gezin-token
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Werkfam', naam: 'Ouder', pin: '2020', groep: 'volw' }));
  const zonderToken = await raw('/rtf/solliciteer', { supplierCode: supCode, vacatureId: vacId, leeftijd: 17, cv: { name: 'X', contact: 'x@v.test', skills: ['x'] } });
  assert.equal(zonderToken.status, 403, 'zonder gezin-token geen sollicitatie');

  // onder de 16 kan niet solliciteren (met geldig token)
  const teJong = await raw('/rtf/solliciteer', { code: g.code, token: g.token, supplierCode: supCode, vacatureId: vacId, leeftijd: 14, cv: { name: 'Jon', contact: 'j@v.test', skills: ['netjes'] } });
  assert.equal(teJong.status, 403);

  // zonder afgerond cv lukt het niet
  const geenCv = await raw('/rtf/solliciteer', { code: g.code, token: g.token, supplierCode: supCode, vacatureId: vacId, leeftijd: 17, cv: { name: 'Sam' } });
  assert.equal(geenCv.status, 409);

  // met cv lukt het en de partner ziet de sollicitatie met cv
  const ok = await raw('/rtf/solliciteer', { code: g.code, token: g.token, supplierCode: supCode, vacatureId: vacId, leeftijd: 17, cv: { name: 'Sam de Jong', contact: 'sam@v.test', headline: 'Leergierig', experience: ['Vrijwilliger buurthuis'], skills: ['samenwerken', 'netjes'], about: 'Ik leer snel.' } });
  assert.equal(ok.status, 200);
  const st = await json(await raw('/supplier/state', {}, login.token));
  const soll = st.state.applications.find(a => a.name === 'Sam de Jong');
  assert.ok(soll, 'sollicitatie staat bij de partner');
  // de werkgever mag NIET zien dat het een RTFoundation-sollicitant is: die
  // verschijnt als een gewoon RTG-lid, met hetzelfde cv en dezelfde markering,
  // en interne velden (sessiesleutel) lekken niet
  assert.equal(soll.viaRTF, undefined, 'de foundation-herkomst is onzichtbaar voor de werkgever');
  assert.equal(soll.viaRTG, true, 'de sollicitant lijkt op een gewoon RTG-lid');
  assert.equal(soll.key, undefined, 'interne sessiesleutel lekt niet naar de werkgever');
  assert.ok(soll.cv && soll.cv.skills.includes('samenwerken'), 'het cv reist mee');

  // dubbel solliciteren op dezelfde vacature wordt geweerd
  const dubbel = await raw('/rtf/solliciteer', { code: g.code, token: g.token, supplierCode: supCode, vacatureId: vacId, leeftijd: 17, cv: { name: 'Sam de Jong', contact: 'sam@v.test', skills: ['samenwerken'] } });
  assert.equal(dubbel.status, 409, 'geen dubbele sollicitatie');

  // "Mijn sollicitaties" toont de eigen sollicitatie met status
  const mijn = await json(await api('/gezin/sollicitaties', { code: g.code, token: g.token }));
  assert.ok(mijn.sollicitaties.some(x => x.func === 'Afwasser' && x.status === 'nieuw'), 'eigen sollicitatie met status zichtbaar');

  // een gesloten vacature levert geen sollicitatie meer op
  await raw('/supplier/vacature/verwijder', { id: vacId, action: 'sluit' }, login.token);
  const dicht = await raw('/rtf/solliciteer', { code: g.code, token: g.token, supplierCode: supCode, vacatureId: vacId, leeftijd: 20, cv: { name: 'Ander', contact: 'a@v.test', skills: ['x'] } });
  assert.equal(dicht.status, 404);
  // en de gesloten vacature staat niet meer in de RTF-lijst
  const lijst2 = await json(await raw('/rtf/vacatures', { leeftijd: 20 }));
  assert.ok(!lijst2.vacatures.find(v => v.id === vacId));
});

test('gratis account met paspoort: bestellen, betalen en de betaalgeschiedenis terugzien', async () => {
  const now = Date.now();
  const reg = await json(await raw('/auth/register', { name: 'Gratis Lid', email: 'gr' + now + '@v.test', phone: '06' + String(now).slice(-8), password: 'geheim123', geboortedatum: '2000-01-01', tier: 'guest' }));
  assert.ok(reg.token, 'gratis registratie met paspoort geeft een token');
  assert.equal(reg.state.user.tier, 'guest', 'het is een gratis (guest) account, geen betaalde pas');
  const gtok = reg.token;
  // bestellen en betalen bij een partner
  const order = await json(await raw('/order', { supplierCode: 'KIKUNOI', items: [{ id: 'm2', qty: 1 }] }, gtok));
  assert.ok(order.order && order.order.ref, 'gratis account plaatst een bestelling');
  assert.equal((await raw('/order/pay', { ref: order.order.ref }, gtok)).status, 200, 'gratis account betaalt');
  // de betaalgeschiedenis blijft bewaard bij het account
  const mine = await json(await raw('/orders/mine', {}, gtok));
  assert.ok(mine.orders.some(o => o.ref === order.order.ref && o.paid), 'de betaalde bestelling staat in de geschiedenis');
});

test('gratis account chat met een bevriend lid; een anonieme gast niet', async () => {
  const now = Date.now();
  const g = await json(await raw('/auth/register', { name: 'Gratis Vriend', email: 'gv' + now + '@v.test', phone: '06' + String(now).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'guest' }));
  const m = await json(await raw('/auth/register', { name: 'RTG Vriend', email: 'rv' + now + '@v.test', phone: '06' + String(now + 11).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' }));
  const gTok = g.token, mTok = m.token, gCn = g.state.user.codename, mCn = m.state.user.codename;
  // allebei even in de codenaam-gids (elke ingelogde call doet dat)
  await raw('/member/connections', {}, gTok); await raw('/member/connections', {}, mTok);
  // het gratis account vindt het lid en stuurt een vriendschapsverzoek
  const found = await json(await raw('/member/find', { q: mCn.split(' ')[0] }, gTok));
  const hit = (found.results || []).find(x => x.codename === mCn);
  assert.ok(hit, 'gratis account vindt het lid in de gids');
  assert.equal((await raw('/member/connect', { key: hit.key }, gTok)).status, 200, 'gratis account stuurt een verzoek');
  // het lid accepteert
  const reqs = await json(await raw('/member/connections', {}, mTok));
  const req = (reqs.requests || []).find(x => x.codename === gCn);
  assert.ok(req, 'het lid ziet het verzoek van het gratis account');
  await raw('/member/connect/respond', { key: req.key, action: 'accept' }, mTok);
  // nu zijn ze vrienden en kan het gratis account chatten
  const gConns = await json(await raw('/member/connections', {}, gTok));
  const vriend = (gConns.connections || []).find(x => x.codename === mCn);
  assert.ok(vriend, 'ze zijn nu vrienden');
  assert.equal((await raw('/member/dm/send', { toKey: vriend.key, text: 'Hoi vriend!' }, gTok)).status, 200, 'gratis account chat met de vriend');
  // het lid leest het bericht van het gratis account
  const mConns = await json(await raw('/member/connections', {}, mTok));
  const gVriend = (mConns.connections || []).find(x => x.codename === gCn);
  const thread = await json(await raw('/member/dm', { withKey: gVriend.key }, mTok));
  assert.ok((thread.messages || []).some(x => /Hoi vriend/.test(x.text)), 'het lid ziet het bericht');
  // een anonieme gast (zonder account) mag niet in de sociale laag
  const anon = await json(await raw('/login', { tier: 'guest' }));
  assert.equal((await raw('/member/connections', {}, anon.token)).status, 403, 'anonieme gast zonder account chat niet');
});

test('gratis gebruiker zonder pas: betalen bij partners en solliciteren mag, liken bij particulieren niet', async () => {
  const supLogin = await json(await raw('/supplier/login', { username: 'rahul', password: 'Imran' }));
  const supCode = supLogin.state.supplier.code;
  const vac = await json(await raw('/supplier/vacature', { func: 'Corvee', soort: 'bijbaan', minLeeftijd: 16 }, supLogin.token));
  const vacId = vac.vacatures[0].id;
  // een partner plaatst een Salon-post (die mag een gast wel waarderen)
  const pp = await json(await raw('/supplier/salon/post', { text: 'Kom langs op ons terras!' }, supLogin.token));
  const partnerPostId = pp.postId;

  // gratis gebruiker (zonder pas)
  const g = await json(await raw('/login', { tier: 'guest' }));
  const gtok = g.token;

  // cv maken en solliciteren mag zonder pas
  assert.equal((await raw('/cv/save', { name: 'Gratis Gebruiker', contact: 'gg@v.test', skills: 'inzet' }, gtok)).status, 200);
  const vlijst = await json(await raw('/member/vacatures', {}, gtok));
  assert.ok(vlijst.vacatures.some(v => v.id === vacId), 'gast ziet de vacatures');
  assert.equal((await raw('/member/apply', { supplierCode: supCode, vacatureId: vacId }, gtok)).status, 200, 'gast mag solliciteren');
  const st = (await json(await raw('/state', {}, gtok))).state;
  assert.ok((st.myApplications || []).some(a => a.func === 'Corvee'), 'gast ziet de eigen sollicitatie met status');

  // liken/reageren bij een particulier mag NIET
  const particulier = (st.posts || []).find(p => !p.partner);
  assert.ok(particulier, 'er is een particulier-post');
  assert.equal((await raw('/like', { postId: particulier.id, liked: true }, gtok)).status, 403, 'gast liket geen particulier');
  assert.equal((await raw('/comment', { postId: particulier.id, text: 'hoi' }, gtok)).status, 403, 'gast reageert niet bij een particulier');
  // een partner-post waarderen mag wel
  assert.equal((await raw('/like', { postId: partnerPostId, liked: true }, gtok)).status, 200, 'gast mag een partner-post liken');
  // betalen bij een partner is niet geblokkeerd voor gasten (geen 403 wegens "geen lid")
  const order = await raw('/order', { supplierCode: supCode, items: [{ id: 'zzz', qty: 1 }] }, gtok);
  assert.notEqual(order.status, 403, 'gast wordt bij bestellen niet als niet-lid geweigerd');
});

test('sollicitatiechat: na uitnodigen praten sollicitant en werkgever samen', async () => {
  const login = await json(await raw('/supplier/login', { username: 'rahul', password: 'Imran' }));
  const supCode = login.state.supplier.code;
  const vac = await json(await raw('/supplier/vacature', { func: 'Bezorger', soort: 'bijbaan', minLeeftijd: 16 }, login.token));
  const vacId = vac.vacatures[0].id;

  // RTG-lid met cv solliciteert op de vacature
  const now = Date.now();
  const reg = await json(await raw('/auth/register', { name: 'Lid Chat', email: 'c' + now + '@v.test', phone: '0612345678', password: 'geheim123', geboortedatum: '2000-01-01', tier: 'rtg' }));
  const tok = reg.token;
  await raw('/cv/save', { name: 'Lid Chat', contact: 'c' + now + '@v.test', skills: 'netjes', experience: 'vrijwilliger' }, tok);
  assert.equal((await raw('/member/apply', { supplierCode: supCode, vacatureId: vacId }, tok)).status, 200);

  // werkgever vindt de sollicitatie en nodigt uit voor een gesprek
  const st = await json(await raw('/supplier/state', {}, login.token));
  const app = st.state.applications.find(a => a.name === 'Lid Chat');
  assert.ok(app);
  const uit = await json(await raw('/supplier/apply/decide', { id: app.id, action: 'uitnodigen' }, login.token));
  assert.ok(uit.chat && uit.chat.berichten.length >= 1, 'chat opent met een eerste bericht van de werkgever');

  // het lid ziet de chat en het openingsbericht, en antwoordt
  const chats = await json(await raw('/member/apply/chats', {}, tok));
  assert.ok(chats.chats.some(c => c.id === app.id), 'de sollicitant ziet de chat');
  const gelezen = await json(await raw('/member/apply/chat', { id: app.id }, tok));
  assert.ok(gelezen.chat.berichten.some(m => m.van === 'werkgever'), 'openingsbericht van de werkgever');
  const antwoord = await json(await raw('/member/apply/chat/send', { id: app.id, text: 'Ik kan morgen om 15u langskomen.' }, tok));
  assert.ok(antwoord.chat.berichten.some(m => m.van === 'sollicitant' && /15u/.test(m.tekst)), 'het antwoord van de sollicitant staat erin');

  // de werkgever ziet het antwoord
  const wz = await json(await raw('/supplier/apply/chat', { id: app.id }, login.token));
  assert.ok(wz.chat.berichten.some(m => m.van === 'sollicitant' && /15u/.test(m.tekst)));

  // een ander lid kan deze chat niet lezen
  const reg2 = await json(await raw('/auth/register', { name: 'Vreemde', email: 'v' + now + '@v.test', phone: '0612345679', password: 'geheim123', geboortedatum: '2000-01-01', tier: 'rtg' }));
  assert.equal((await raw('/member/apply/chat', { id: app.id }, reg2.token)).status, 404, 'geen toegang tot andermans chat');
});

test('impact-momentopname: publiek en geaggregeerd, zonder namen', async () => {
  const d = await json(await fetch(BASE + '/api/foundation/impact'));
  assert.equal(typeof d.opgehaald, 'number', 'opgehaald bedrag');
  assert.equal(typeof d.scholen, 'number', 'aantal scholen');
  assert.equal(typeof d.gezinnen, 'number', 'aantal gezinnen');
  assert.ok(d.boodschap && d.boodschap.length > 0, 'een warme boodschap');
});
