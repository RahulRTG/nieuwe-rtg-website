/* De eigen boardroom van elk lid (kern/lidboard/ + routes):
   1. een lid ziet zijn bord met vier groepen en zet er functies aan/uit; de
      stand blijft server-side bewaard.
   2. privacy by design: gevoelige deel-functies staan standaard uit.
   3. een ouder/beheerder stuurt de boardroom van zijn beschermde kind bij; de
      voogd-check houdt een vreemde ouder buiten, en kind-functies (paspoort,
      Pay, Care) horen niet op een kinder-bord.

   En de vier dingen die dit bord zakelijk bruikbaar maken:
   4. VERSIE: twee toestellen overschrijven elkaar niet stilzwijgend.
   5. IN EEN KEER: bulk en herstel zijn alles-of-niets, en een vaste functie
      (de wallet met je ledenpas) kan niet uit.
   6. EEN SPOOR: elke omzetting komt in het journaal, ook wat een ouder deed,
      en dat spoor gaat mee in de AVG-export en weg bij "verwijder mij".
   7. REM: een lus met schakelverzoeken loopt tegen een grens.

   Draai los: node --experimental-sqlite --test test/lidboard.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, BASE, techToken;
const OWNER = 'roellie.i@gmail.com'; // standaard-eigenaar (RTG_OWNER_EMAIL)
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lidboard-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  BASE = srv.base;
  // de eigenaar, voor de toets op platform-breed uitgezette functies
  const login = await (await fetch(BASE + '/api/techniek/inloggen', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: OWNER, wachtwoord: 'Imran' })
  })).json();
  techToken = login.token;
});
test.after(() => stop(srv && srv.child));

const json = r => r.json();
function api(pad, body) { return fetch(BASE + '/api/foundation' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); }
function soc(pad, body) { return fetch(BASE + '/api/rtf/social' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); }
async function lid(naam) {
  const reg = await json(await fetch(BASE + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: naam, email: naam.replace(/\s/g, '') + Date.now() + '@voorbeeld.test', phone: '0611122233', password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg' })
  }));
  const call = (pad, body) => fetch(BASE + '/api' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token }, body: JSON.stringify(body || {}) });
  return { token: reg.token, call };
}
async function gezinMetKind(naam) {
  const g = await json(await api('/gezin/maak', { gezinsnaam: naam, naam: 'Ouder ' + naam, pin: '1234' }));
  const kind = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Tiener', rol: 'gezinslid', groep: 'tiener' }));
  const kidToken = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id }))).token;
  const conn = await json(await soc('/connections', { code: g.code, token: kidToken }));
  return { g, kidHandle: conn.me };
}

test('een lid ziet zijn boardroom met vier groepen en de juiste standaarden', async () => {
  const l = await lid('Board Lid');
  const r = await json(await l.call('/member/boardroom', {}));
  const cats = r.bord.categorieen.map(c => c.id);
  assert.deepEqual(cats, ['app', 'privacy', 'ai', 'verbinding'], 'vier groepen in de juiste volgorde');
  const alle = r.bord.categorieen.flatMap(c => c.functies);
  const vind = id => alle.find(f => f.id === id);
  assert.equal(vind('salon').aan, true, 'De Salon staat standaard aan');
  assert.equal(vind('locatie').aan, false, 'Locatie delen staat standaard uit (privacy by design)');
  assert.equal(vind('gps').aan, false, 'GPS staat standaard uit');
  assert.equal(vind('rahul').aan, true, 'Rahul staat standaard aan');
});

test('een lid zet een functie uit en de stand blijft bewaard', async () => {
  const l = await lid('Schakel Lid');
  const zet = await json(await l.call('/member/boardroom/zet', { id: 'spelen', aan: false }));
  assert.equal(zet.ok, true);
  const na = await json(await l.call('/member/boardroom', {}));
  const spelen = na.bord.categorieen.flatMap(c => c.functies).find(f => f.id === 'spelen');
  assert.equal(spelen.aan, false, 'Spelen blijft uit na opnieuw ophalen');
});

test('de boardroom is niet voor gasten (geen account, geen toegang)', async () => {
  const r = await fetch(BASE + '/api/member/boardroom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.notEqual(r.status, 200, 'zonder geldig lid-account geen boardroom');
});

test('handhaving: een uitgezette functie zet ook de API dicht', async () => {
  const l = await lid('Handhaaf Lid');
  // standaard aan: de handhaving grijpt niet in (geen functieUit-markering)
  const voor = await (await l.call('/pay', {})).json().catch(() => ({}));
  assert.notEqual(voor.functieUit, 'pay', 'pay is standaard toegestaan');
  // uitzetten in de eigen boardroom
  await l.call('/member/boardroom/zet', { id: 'pay', aan: false });
  const dicht = await l.call('/pay', {});
  assert.equal(dicht.status, 403, 'pay is nu dicht');
  assert.equal((await dicht.json().catch(() => ({}))).functieUit, 'pay', 'met de juiste reden');
  // de boardroom zelf blijft altijd bereikbaar (niet gemapt)
  assert.equal((await l.call('/member/boardroom', {})).status, 200, 'je bord blijft bereikbaar');
  // weer aanzetten: weer toegankelijk
  await l.call('/member/boardroom/zet', { id: 'pay', aan: true });
  const weer = await (await l.call('/pay', {})).json().catch(() => ({}));
  assert.notEqual(weer.functieUit, 'pay', 'pay is weer toegestaan');
});

test('een ouder stuurt de boardroom van zijn beschermde kind bij', async () => {
  const fam = await gezinMetKind('Schild');
  const bord = await json(await soc('/kind/boardroom', { code: fam.g.code, token: fam.g.token, kindHandle: fam.kidHandle }));
  const ids = bord.bord.categorieen.flatMap(c => c.functies.map(f => f.id));
  assert.ok(ids.includes('salon'), 'het kinder-bord toont De Salon');
  assert.ok(!ids.includes('paspoort'), 'paspoort delen hoort niet op een kinder-bord');
  assert.ok(!ids.includes('pay'), 'RTG Pay hoort niet op een kinder-bord');
  // de ouder zet Spelen uit voor het kind
  const zet = await json(await soc('/kind/boardroom/zet', { code: fam.g.code, token: fam.g.token, kindHandle: fam.kidHandle, id: 'spelen', aan: false }));
  assert.equal(zet.ok, true, 'de ouder mag schakelen voor het eigen kind');
  const na = await json(await soc('/kind/boardroom', { code: fam.g.code, token: fam.g.token, kindHandle: fam.kidHandle }));
  assert.equal(na.bord.categorieen.flatMap(c => c.functies).find(f => f.id === 'spelen').aan, false);
});

test('een vreemde ouder kan de boardroom van andermans kind niet aanraken', async () => {
  const famA = await gezinMetKind('Noord');
  const famB = await gezinMetKind('Zuid');
  // ouder B probeert het kind van gezin A te beheren
  const r = await soc('/kind/boardroom', { code: famB.g.code, token: famB.g.token, kindHandle: famA.kidHandle });
  assert.equal(r.status, 403, 'geen toegang tot een kind van een ander gezin');
  const zet = await soc('/kind/boardroom/zet', { code: famB.g.code, token: famB.g.token, kindHandle: famA.kidHandle, id: 'salon', aan: false });
  assert.equal(zet.status, 403, 'ook schakelen wordt geweigerd');
});

/* ---------------- 4. Versie: twee toestellen, geen stille overschrijving ---------------- */

test('een bord draagt een versie, en die loopt alleen op als er echt iets verandert', async () => {
  const l = await lid('Versie Lid');
  const start = await json(await l.call('/member/boardroom', {}));
  assert.equal(start.bord.versie, 0, 'een vers bord staat op versie 0');
  assert.equal(start.bord.gewijzigd, null, 'en is nog nooit gewijzigd');

  const een = await json(await l.call('/member/boardroom/zet', { id: 'spelen', aan: false }));
  assert.equal(een.bord.versie, 1, 'een echte omzetting hoogt de versie op');
  assert.ok(een.bord.gewijzigd, 'en zet een tijdstempel');

  // dezelfde stand nog eens zetten is geen gebeurtenis
  const weer = await json(await l.call('/member/boardroom/zet', { id: 'spelen', aan: false }));
  assert.equal(weer.bord.versie, 1, 'dezelfde stand nogmaals zetten hoogt de versie niet op');
});

test('schakelen met een verouderde versie botst en geeft de verse stand terug', async () => {
  const l = await lid('Botsing Lid');
  await l.call('/member/boardroom/zet', { id: 'spelen', aan: false }); // versie -> 1

  // het tweede toestel denkt nog dat het bord op 0 staat
  const r = await l.call('/member/boardroom/zet', { id: 'salon', aan: false, versie: 0 });
  assert.equal(r.status, 409, 'een verouderde versie wordt geweigerd');
  const d = await r.json();
  assert.equal(d.conflict, true, 'als botsing gemarkeerd, niet als kapotte invoer');
  assert.equal(d.bord.versie, 1, 'met de verse stand erbij, zodat de app kan bijwerken');

  // en De Salon staat nog gewoon aan: de botsing heeft niets omgezet
  const na = await json(await l.call('/member/boardroom', {}));
  assert.equal(na.bord.categorieen.flatMap(c => c.functies).find(f => f.id === 'salon').aan, true,
    'de geweigerde schakeling heeft niets veranderd');

  // met de juiste versie lukt het wel
  const ok = await json(await l.call('/member/boardroom/zet', { id: 'salon', aan: false, versie: 1 }));
  assert.equal(ok.ok, true, 'met de juiste versie gaat hij gewoon om');
});

/* ---------------- 5. In een keer, en wat niet uit kan ---------------- */

test('de wallet met je ledenpas hoort bij de basis en kan niet uit', async () => {
  const l = await lid('Vast Lid');
  const r = await l.call('/member/boardroom/zet', { id: 'wallet', aan: false });
  assert.equal(r.status, 409, 'een vaste functie uitzetten wordt geweigerd');
  assert.match((await r.json()).error, /basis/i, 'met een uitleg waarom');
  const bord = await json(await l.call('/member/boardroom', {}));
  const wallet = bord.bord.categorieen.flatMap(c => c.functies).find(f => f.id === 'wallet');
  assert.equal(wallet.vast, true, 'het bord vertelt zelf dat hij vast staat');
  assert.equal(wallet.aan, true, 'en hij staat gewoon aan');
});

test('alles uit in een keer: een handeling, en de vaste functie blijft staan', async () => {
  const l = await lid('Bulk Lid');
  const r = await json(await l.call('/member/boardroom/zetveel', {
    standen: { reizen: false, salon: false, pay: false, wallet: false }
  }));
  assert.equal(r.ok, true);
  assert.equal(r.gewijzigd, 3, 'drie functies gingen om; de wallet is stil overgeslagen');
  const fn = id => r.bord.categorieen.flatMap(c => c.functies).find(f => f.id === id);
  assert.equal(fn('reizen').aan, false);
  assert.equal(fn('wallet').aan, true, 'de wallet staat nog aan');
  assert.equal(r.bord.versie, 1, 'een bulk-actie is EEN versie-stap, geen drie');
});

test('een bulk met een onbekende functie zet niets om (alles-of-niets)', async () => {
  const l = await lid('Atomair Lid');
  const r = await l.call('/member/boardroom/zetveel', { standen: { salon: false, bestaatniet: false } });
  assert.equal(r.status, 400, 'een onbekende functie laat de hele bulk stranden');
  const na = await json(await l.call('/member/boardroom', {}));
  assert.equal(na.bord.categorieen.flatMap(c => c.functies).find(f => f.id === 'salon').aan, true,
    'De Salon staat nog aan: er is niets half omgegaan');
  assert.equal(na.bord.versie, 0, 'en de versie is niet opgehoogd');
});

test('terug naar de standaard herstelt het bord, inclusief de deel-functies uit', async () => {
  const l = await lid('Herstel Lid');
  await l.call('/member/boardroom/zetveel', { standen: { salon: false, spelen: false, locatie: true, gps: true } });
  const r = await json(await l.call('/member/boardroom/herstel', {}));
  assert.equal(r.ok, true);
  const fn = id => r.bord.categorieen.flatMap(c => c.functies).find(f => f.id === id);
  assert.equal(fn('salon').aan, true, 'De Salon staat weer aan');
  assert.equal(fn('spelen').aan, true, 'Spelen staat weer aan');
  assert.equal(fn('locatie').aan, false, 'en locatie delen staat weer UIT, niet aan');
  assert.equal(fn('gps').aan, false, 'net als GPS: herstel is de standaard, niet "alles aan"');
});

/* ---------------- 6. Het spoor ---------------- */

test('elke omzetting komt in het journaal, met wat er veranderde', async () => {
  const l = await lid('Spoor Lid');
  await l.call('/member/boardroom/zet', { id: 'spelen', aan: false });
  await l.call('/member/boardroom/zetveel', { standen: { salon: false, pay: false } });

  const log = (await json(await l.call('/member/boardroom/logboek', {}))).logboek;
  assert.equal(log.length, 2, 'twee handelingen: de enkele en de bulk (niet drie regels)');
  assert.equal(log[0].wijzigingen.length, 2, 'de bulk staat als EEN regel met twee wijzigingen');
  assert.equal(log[0].door, 'lid', 'gezet door het lid zelf');
  assert.ok(log[0].at, 'met een tijdstip');
  const spelen = log[1].wijzigingen[0];
  assert.equal(spelen.id, 'spelen');
  assert.equal(spelen.van, true, 'van aan');
  assert.equal(spelen.naar, false, 'naar uit');

  // niets veranderen laat het journaal met rust
  await l.call('/member/boardroom/zet', { id: 'spelen', aan: false });
  const log2 = (await json(await l.call('/member/boardroom/logboek', {}))).logboek;
  assert.equal(log2.length, 2, 'een schakeling zonder verschil komt niet in het journaal');
});

test('wat een ouder omzet, staat als "ouder" in het journaal van het kind', async () => {
  const fam = await gezinMetKind('Spoorgezin');
  await soc('/kind/boardroom/zet', { code: fam.g.code, token: fam.g.token, kindHandle: fam.kidHandle, id: 'spelen', aan: false });
  const bord = await json(await soc('/kind/boardroom', { code: fam.g.code, token: fam.g.token, kindHandle: fam.kidHandle }));
  assert.ok(Array.isArray(bord.logboek), 'de ouder ziet het spoor bij het bord');
  assert.equal(bord.logboek[0].door, 'ouder', 'gezet door de ouder, niet door het kind');
  assert.equal(bord.logboek[0].wijzigingen[0].id, 'spelen');
});

test('de boardroom en zijn spoor gaan mee in de AVG-export', async () => {
  const l = await lid('Export Lid');
  await l.call('/member/boardroom/zet', { id: 'spelen', aan: false });
  const d = await json(await l.call('/privacy/export', {}));
  assert.ok(d.boardroom && Array.isArray(d.boardroom.categorieen), 'het bord zit in de export');
  assert.equal(d.boardroom.versie, 1, 'met de versie erbij');
  assert.ok(Array.isArray(d.boardroomLogboek) && d.boardroomLogboek.length >= 1,
    'en het journaal, anders zie je de stand maar niet wie hem zette');
});

/* ---------------- 7. De rem ---------------- */

test('een lus met schakelverzoeken loopt tegen een grens', async () => {
  const l = await lid('Rem Lid');
  let geremd = 0;
  for (let i = 0; i < 40; i++) {
    const r = await l.call('/member/boardroom/zet', { id: 'spelen', aan: i % 2 === 0 });
    if (r.status === 429) geremd++;
  }
  assert.ok(geremd > 0, 'na tientallen schakelingen in een minuut komt er een 429');
});

/* ---------------- 8. Beheerd door RTG: het bord liegt niet ---------------- */

test('zet RTG een functie platform-breed uit, dan is de knop op je bord beheerd', async () => {
  const l = await lid('Beheerd Lid');
  // de eigenaar zet De Salon uit op de technische pagina (schakelen is een
  // aanvraag; de eigenaar accepteert hem meteen)
  const tech = async (pad, body) => json(await fetch(BASE + '/api/techniek' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + techToken },
    body: JSON.stringify(body || {})
  }));
  const vz = await tech('/functie', { id: 'salon', aan: false });
  await tech('/functie/besluit', { verzoekId: vz.verzoekId });

  try {
    const bord = await json(await l.call('/member/boardroom', {}));
    const salon = bord.bord.categorieen.flatMap(c => c.functies).find(f => f.id === 'salon');
    assert.equal(salon.beheerd, true, 'het bord meldt dat RTG deze functie beheert');
    assert.equal(salon.aan, false, 'en toont hem als uit, want dat is de werkelijkheid');
    assert.match(salon.reden || '', /RTG/, 'met een reden die de gebruiker iets zegt');

    // schakelen wordt geweigerd: een knop die niets doet is erger dan geen knop
    const r = await l.call('/member/boardroom/zet', { id: 'salon', aan: true });
    assert.equal(r.status, 409, 'een beheerde functie kun je niet zelf aanzetten');
    assert.match((await r.json()).error, /RTG/, 'met dezelfde uitleg');
  } finally {
    const aan = await tech('/functie', { id: 'salon', aan: true });
    await tech('/functie/besluit', { verzoekId: aan.verzoekId });
  }
});

/* ---------------- 9. Vergeten: het spoor blijft niet achter ---------------- */

test('"verwijder mijn gegevens" wist ook de boardroom en zijn journaal', async () => {
  const l = await lid('Vergeet Lid');
  await l.call('/member/boardroom/zet', { id: 'spelen', aan: false });
  assert.equal((await json(await l.call('/member/boardroom/logboek', {}))).logboek.length, 1,
    'er staat iets in het journaal om te wissen');

  await l.call('/privacy/delete', {});

  // na verwijderen is de sessie weg; een nieuw lid begint schoon. Wat telt is
  // dat er niets van de vorige boardroom achterblijft: dat controleren we door
  // de export van een vers account leeg te zien beginnen.
  const n = await lid('Na Vergeten');
  const d = await json(await n.call('/privacy/export', {}));
  assert.deepEqual(d.boardroomLogboek, [], 'een vers account begint met een leeg journaal');
  assert.equal(d.boardroom.versie, 0, 'en met een onaangeroerd bord');
});
