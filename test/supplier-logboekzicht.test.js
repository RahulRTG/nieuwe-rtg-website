/* KLOKREGELS IN HET ZAAKLOGBOEK: WIE ZE ONTVANGT.

   Bestaande grens, eigenaarsbesluit 11 oktober 2026: wie er aanwezig is mag
   iedereen zien; wanneer een collega in- of uitklokte alleen een manager. En wat
   iemand niet mag ontvangen, stuurt de server hem niet -- verbergen op het
   scherm telt niet. /api/supplier/state gaf elke medewerker de laatste 40
   regels van het zaaklogboek, met "klokte in/uit" + naam + tijdstip, en de
   klokregels van vandaag van iedereen. De beslissing staat nu op een plek:
   server/kern/leverancier/logboekzicht.js.

   Wat hier op een echte server wordt bewezen:
   a. een niet-manager krijgt geen klokregel en geen kloktijd van een collega,
      nergens in het antwoord;
   b. een manager krijgt ze wel;
   c. een gewone logregel blijft voor iedereen;
   d. 5 gewone regels onder 45 klokregels: de niet-manager krijgt de 5, en niets
      in het antwoord verraadt dat er meer was (filter VOOR het afkappen);
   e. het rooster van een beveiligingszaak: de kloktijden van een collega alleen
      voor een manager en de bewaker zelf.
   Plus de bronfunctie los, met regels van voor het soortveld.

   Draai: node --test test/supplier-logboekzicht.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');
const zicht = require('../server/kern/leverancier/logboekzicht');

const kinderen = [];
const tmps = [];
const api = (base, pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let H, tokM, tokA, tokB, idA, idB, naamB;   // horecazaak KIKUNOI
let V, tokVM, tokG0, tokG1, g0;             // beveiligingszaak AEGIS

test.before(async () => {
  const start = async (env) => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-logzicht-')); tmps.push(TMP);
    const s = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '', ...env } });
    kinderen.push(s.child); return s.base;
  };
  [H, V] = await Promise.all([start({ RTG_DEMO: '1' }), start({ DEMO_SUPPLIER: 'AEGIS' })]);

  const roster = (await api(H, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  const vloer = roster.staff.find(x => x.id !== mgr.id);
  idA = vloer.id;
  tokM = (await api(H, '/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  tokA = (await api(H, '/api/supplier/login', { code: 'KIKUNOI', staffId: vloer.id, pin: '5678' })).body.token;
  const nieuw = (await api(H, '/api/supplier/staff/add', { name: 'Bram' }, tokM)).body;
  tokB = (await api(H, '/api/supplier/login', { code: 'KIKUNOI', staffId: nieuw.staff.id, pin: nieuw.pin })).body.token;
  idB = nieuw.staff.id; naamB = nieuw.staff.name;
  assert.ok(tokM && tokA && tokB, 'drie inlogs');

  // eerst 5 gewone regels, daarna 45 klokregels van Bram (in, uit, in, ... -> eindigt ingeklokt)
  for (let i = 0; i < 5; i++) assert.equal((await api(H, '/api/supplier/aanwezig/leeg', { ronde: i }, tokM)).status, 200);
  for (let i = 0; i < 45; i++) {
    const r = await api(H, '/api/staff/clock', {}, tokB);
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }

  const login = await api(V, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
  tokVM = login.body.token;
  const guards = (login.body.state.staff || []).filter(x => x.role === 'staff');
  g0 = guards[0];
  tokG0 = (await api(V, '/api/supplier/login', { code: 'AEGIS', staffId: guards[0].id, pin: '5678' })).body.token;
  tokG1 = (await api(V, '/api/supplier/login', { code: 'AEGIS', staffId: guards[1].id, pin: '5678' })).body.token;
  assert.ok(tokVM && tokG0 && tokG1, 'drie inlogs bij de beveiligingszaak');
});
test.after(() => {
  for (const c of kinderen) try { c.kill('SIGKILL'); } catch (e) {}
  for (const t of tmps) try { fs.rmSync(t, { recursive: true, force: true }); } catch (e) {}
});

const state = async (base, tok) => {
  const r = await api(base, '/api/supplier/state', {}, tok);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  return r.body.state;
};
const isKlokTekst = (t) => /^klokte (in|uit)|klokcorrectie/.test(String(t || ''));

test('a+b. de manager krijgt de klokregels en -tijden van Bram; een collega geen enkele, nergens in het antwoord', async () => {
  const m = await state(H, tokM);
  const mijnKlok = m.activity.filter(r => isKlokTekst(r.text));
  assert.ok(mijnKlok.length >= 30, 'de manager ziet de klokregels: ' + mijnKlok.length);
  assert.ok(mijnKlok.every(r => r.who === naamB && /^klok-(in|uit)$/.test(r.soort)), 'gemarkeerd met een soort');
  const brams = m.klok.vandaag.filter(e => String(e.staffId) === String(idB));
  assert.ok(brams.length >= 20, 'de manager ziet de kloktijden van vandaag: ' + brams.length);

  const a = await state(H, tokA);
  assert.deepEqual(a.activity.filter(r => isKlokTekst(r.text) || r.soort), [], 'geen klokregel voor een collega');
  assert.deepEqual(a.klok.vandaag, [], 'Ayla klokte niet; van een ander krijgt ze geen kloktijden');
  assert.ok(a.klok.binnen.includes(naamB), 'wie er binnen is, mag iedereen zien');
  // geen enkel tijdstip van een kloksactie van Bram, waar dan ook in het antwoord
  const tekst = JSON.stringify(a);
  const tijden = [...brams.flatMap(e => [e.in, e.out]), ...mijnKlok.map(r => r.at)].filter(Boolean);
  assert.ok(tijden.length >= 60);
  assert.deepEqual(tijden.filter(t => tekst.includes(t)), [], 'een kloktijd van een collega lekt via een ander veld');
});

test('c+d. de 5 gewone regels komen door, en niets verraadt de 45 klokregels erboven', async () => {
  const a = await state(H, tokA);
  const gewoon = a.activity.filter(r => r.text === 'zette de aanwezigheidsteller op nul');
  assert.equal(gewoon.length, 5, 'gefilterd VOOR het afkappen op 40: anders zijn de 5 eraf geknipt');
  // precies wat er overblijft van het hele logboek zonder klokregels -- niet 40-minus-iets
  const alles = (await api(H, '/api/supplier/activity', { aantal: 80 }, tokM)).body.activity;
  assert.ok(alles.length > 40, 'het logboek is langer dan 40: ' + alles.length);
  const verwacht = alles.filter(r => !isKlokTekst(r.text)).slice(0, 40);
  assert.deepEqual(a.activity.map(r => r.text + '|' + r.at), verwacht.map(r => r.text + '|' + r.at));
  // geen teller, totaal of cursor naast de lijst, en geen veld dat de manager niet ook heeft
  const m = await state(H, tokM);
  assert.deepEqual(Object.keys(a).sort(), Object.keys(m).sort());
  for (const r of a.activity) assert.deepEqual(Object.keys(r).sort(), ['at', 'text', 'who']);
});

test('c. de logboekroute zelf blijft van de manager, en telt alleen wat hij mag zien', async () => {
  assert.equal((await api(H, '/api/supplier/activity', {}, tokA)).status, 403);
  const r = (await api(H, '/api/supplier/activity', { aantal: 80 }, tokM)).body;
  assert.equal(r.totaal, r.activity.length);
});

test('e. het beveiligingsrooster: inkloktijd voor de manager en de bewaker zelf, de stand voor een collega', async () => {
  const dag = new Date().toISOString().slice(0, 10);
  assert.equal((await api(V, '/api/supplier/beveiliging/planauto', { datum: dag }, tokVM)).status, 200);
  const mijn = (await api(V, '/api/supplier/beveiliging/pda/diensten', {}, tokG0)).body.diensten;
  const d = mijn.find(x => x.datum === dag) || mijn[0];
  assert.ok(d, 'de bewaker heeft een dienst');
  const ink = await api(V, '/api/supplier/beveiliging/pda/inklok', { id: d.id }, tokG0);
  assert.equal(ink.status, 200, JSON.stringify(ink.body));
  const vind = async (tok) => {
    const r = await api(V, '/api/supplier/beveiliging/rooster', { van: d.datum, dagen: 1 }, tok);
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
    for (const p of r.body.dagen[0].posten) for (const sh of p.shifts) for (const x of sh.bezet) if (x.id === d.id) return { x, tekst: JSON.stringify(r.body) };
    return {};
  };
  const m = await vind(tokVM);
  assert.ok(m.x && m.x.inklokAt, 'de manager ziet het inkloktijdstip');
  assert.equal((await vind(tokG0)).x.inklokAt, m.x.inklokAt, 'de bewaker ziet zijn eigen tijd');
  const c = await vind(tokG1);
  assert.equal(c.x.status, 'ingeklokt', 'de stand blijft zichtbaar');
  assert.ok(!('inklokAt' in c.x) && !('uitklokAt' in c.x), 'een collega krijgt de tijden niet');
  assert.ok(!c.tekst.includes(m.x.inklokAt), 'ook niet via een ander veld');

  /* het commandocentrum (opDienst) draagt dezelfde dienst: zonder managerOnly,
     dus dezelfde bron. Gevonden door de tegenlezing van PR #584: een collega
     kreeg hier het inkloktijdstip terwijl het rooster het al wegliet. */
  const cmd = async (tok) => {
    const r = await api(V, '/api/supplier/beveiliging/command', {}, tok);
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
    return { x: (r.body.opDienst || []).find(y => y.id === d.id), tekst: JSON.stringify(r.body) };
  };
  assert.equal((await cmd(tokVM)).x.inklokAt, m.x.inklokAt, 'de manager ziet het op het commandocentrum');
  assert.equal((await cmd(tokG0)).x.inklokAt, m.x.inklokAt, 'de bewaker zelf ook');
  const cc = await cmd(tokG1);
  assert.equal(cc.x.status, 'ingeklokt', 'wie er op dienst is, mag een collega zien');
  assert.ok(!('inklokAt' in cc.x) && !cc.tekst.includes(m.x.inklokAt), 'het commandocentrum geeft een collega de inkloktijd niet');

  // en de logregel van die inklok ("klokte in op <post>") gaat ook alleen naar de manager
  const isPost = (r) => /^klokte in op /.test(r.text);
  assert.ok((await state(V, tokVM)).activity.some(r => isPost(r) && r.soort === 'klok-in'));
  assert.ok(!(await state(V, tokG1)).activity.some(isPost));
});

test('bron: de klokregel wordt herkend aan soort EN aan de vaste tekst van voor het soortveld', () => {
  const oud = [
    { who: 'Bram', text: 'klokte in', at: '2026-10-01T08:00:00.000Z' },
    { who: 'Bram', text: 'klokte uit', at: '2026-10-01T17:00:00.000Z' },
    { who: 'Bewaker', text: 'klokte in op Hoofdingang', at: '2026-10-01T08:00:00.000Z' },
    { who: 'Mila', text: 'boekte een klokcorrectie voor Bram', at: '2026-10-01T18:00:00.000Z' }
  ];
  for (const r of oud) assert.equal(zicht.isKlokregel(r), true, r.text);
  assert.equal(zicht.isKlokregel({ who: 'X', text: 'iets', soort: 'klok-uit' }), true);
  for (const t of ['belde een ingeklokte collega (video)', 'zette de aanwezigheidsteller op nul', 'Bram logde in', 'klokteller bijgewerkt'])
    assert.equal(zicht.isKlokregel({ who: 'X', text: t, at: 'x' }), false, t);
  assert.equal(zicht.isKlokregel(null), true, 'een onbekende vorm gaat niet de deur uit');

  const lijst = [...Array.from({ length: 45 }, (_, i) => oud[i % 4]), ...Array.from({ length: 5 }, (_, i) => ({ who: 'X', text: 'gewoon ' + i, at: 'x' }))];
  const mw = zicht.logboekVoor(lijst, { manager: false, staffId: 3 }, 40);
  assert.deepEqual(mw, { regels: lijst.slice(45), totaal: 5 });
  assert.equal(zicht.logboekVoor(lijst, { manager: true }, 40).totaal, 50);
  assert.equal(zicht.logboekVoor(lijst, undefined, 40).totaal, 5, 'zonder actor geen manager');
  assert.deepEqual(zicht.klokVandaagVoor([{ staffId: 3 }, { staffId: 4 }], { manager: false, staffId: '3' }), [{ staffId: 3 }]);
  // wie er binnen is: voor een collega op naam, niet in boekvolgorde (nieuwste inklok eerst)
  const boek = [{ id: 9, name: 'Zoe' }, { id: 4, name: 'Anna' }, { id: 7, name: 'Mila' }];
  assert.deepEqual(zicht.aanwezigVoor(boek, { manager: false }).map(x => x.name), ['Anna', 'Mila', 'Zoe']);
  assert.deepEqual(zicht.aanwezigVoor(['Zoe', 'Anna'], undefined, (n) => n), ['Anna', 'Zoe']);
  assert.deepEqual(zicht.aanwezigVoor(boek, { manager: true }), boek, 'een manager houdt de boekvolgorde');
  assert.deepEqual(zicht.staatDelen({ klok: { Z: [{ name: 'Zoe', in: '2026-10-11T09:00Z' }, { name: 'Anna', in: '2026-10-11T08:00Z' }] } }, 'Z', { manager: false }, '2026-10-11').klok.binnen,
    ['Anna', 'Zoe'], 'de lijst aanwezigen op /state verraadt de inklokvolgorde niet');
});

test('bron: elke klokschrijver markeert zijn regel met een soort uit de gesloten lijst', () => {
  /* Een nieuwe klokschrijver zonder soort valt alleen nog binnen de filter als
     zijn tekst toevallig op een oude lijkt. Daarom: elke logActivity-aanroep die
     een klokhandeling vastlegt draagt een 'klok-'-soort, en die soort staat in
     KLOKSOORTEN. */
  const uit = [];
  const loop = (map) => {
    for (const n of fs.readdirSync(map)) {
      const f = path.join(map, n);
      if (fs.statSync(f).isDirectory()) loop(f);
      else if (n.endsWith('.js')) fs.readFileSync(f, 'utf8').split('\n').forEach((regel, i) => {
        if (/logActivity(\.alleenActiviteit)?\(/.test(regel) && /'klokte |klokcorrectie/.test(regel)) uit.push({ f, i, regel });
      });
    }
  };
  loop(path.join(__dirname, '..', 'server'));
  assert.ok(uit.length >= 3, 'de klokschrijvers zijn gevonden: ' + uit.length);
  for (const { f, i, regel } of uit) {
    const s = regel.match(/'(klok-[a-z-]+)'/) || (/'klok-' \+ actie/.test(regel) ? [0, 'klok-in'] : null);
    assert.ok(s, 'klokregel zonder soort in ' + path.relative(process.cwd(), f) + ':' + (i + 1));
    assert.ok(zicht.isKlokSoort(s[1]), 'onbekende soort ' + s[1]);
  }
  assert.deepEqual(Object.keys(zicht.KLOKSOORTEN).sort(), ['klok-correctie', 'klok-in', 'klok-uit']);
});

test('bron: in een bestand dat het klokboek of een dienstkloktijd SCHRIJFT, draagt elke logregel een soort of een verklaring', () => {
  /* De toets hierboven vindt een klokschrijver aan zijn TEKST, en ziet dus niet
     een nieuwe schrijver met nieuwe woorden ("meldde zich af op <post>" bij het
     uitklokken van een bewaker kwam er zonder soort doorheen -- tegenlezing PR
     #584). Hier gaat het andersom: waar een kloktijd ontstaat, is elke
     logActivity een klokregel (met een soort uit KLOKSOORTEN), tenzij hij
     hieronder met reden staat. */
  const GEEN_KLOKREGEL = {
    'belde een ingeklokte collega (video)': 'een oproep op het moment van bellen; zegt niets over wanneer iemand in- of uitklokte'
  };
  const SCHRIJFT = /(inklokAt|uitklokAt)\s*=[^=]|\.out\s*=\s*new Date|db\.data\.klok\[[^\]]+\]\s*=\s*lijst\.slice/;
  const bestanden = [];
  const loop = (map) => {
    for (const n of fs.readdirSync(map)) {
      const f = path.join(map, n);
      if (fs.statSync(f).isDirectory()) loop(f);
      else if (n.endsWith('.js') && SCHRIJFT.test(fs.readFileSync(f, 'utf8'))) bestanden.push(f);
    }
  };
  loop(path.join(__dirname, '..', 'server'));
  const rel = bestanden.map(f => path.relative(path.join(__dirname, '..'), f)).sort();
  for (const v of ['server/routes/staff/dienst-klok.js', 'server/routes/staff/collega.js', 'server/kern/beveiliging/pda/patrouille.js'])
    assert.ok(rel.includes(v), 'de klokschrijver ' + v + ' wordt niet meer herkend');
  const fout = [];
  for (const f of bestanden) {
    const t = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    for (const m of t.matchAll(/logActivity(?:\.alleenActiviteit)?\(([^;]*)\);/g)) {
      const arg = m[1];
      if (/'klok-(?:[a-z-]+'|' \+ actie)/.test(arg)) continue;
      const tekst = (arg.match(/'([^']+)'/g) || []).map(s => s.slice(1, -1));
      if (tekst.some(s => GEEN_KLOKREGEL[s])) continue;
      fout.push(path.relative(process.cwd(), f) + ': ' + m[0].slice(0, 120));
    }
  }
  assert.deepEqual(fout, [], 'een logregel naast een kloktijd zonder klok-soort valt buiten de filter van logboekzicht.js');
});

test('f. de Vloer (/spatial) en het golfvoorstel verraden de inklokvolgorde niet', async () => {
  /* live() in routes/supplier/horeca/spatial-command.js staat in boekvolgorde,
     nieuwste inklok eerst. Zara klokt NA Bram in, en heet alfabetisch later:
     in boekvolgorde staat zij voor hem, op naam erna. */
  const nieuw = (await api(H, '/api/supplier/staff/add', { name: 'Zara' }, tokM)).body;
  const tokZ = (await api(H, '/api/supplier/login', { code: 'KIKUNOI', staffId: nieuw.staff.id, pin: nieuw.pin })).body.token;
  assert.equal((await api(H, '/api/staff/clock', {}, tokZ)).status, 200);
  const team = async (tok) => {
    const r = await api(H, '/api/supplier/horeca/spatial', {}, tok);
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
    return r.body.team;
  };
  const m = (await team(tokM)).map(x => x.name);
  assert.ok(m.indexOf('Zara') >= 0 && m.indexOf('Zara') < m.indexOf(naamB), 'de manager houdt de boekvolgorde: ' + m);
  const a = (await team(tokA)).map(x => x.name);
  assert.deepEqual(a, a.slice().sort((x, y) => x.localeCompare(y, 'nl')), 'een collega krijgt de aanwezigen op naam: ' + a);
  assert.deepEqual(a.slice().sort(), m.slice().sort(), 'wie er is, ziet iedereen');

  // het golfvoorstel: bij gelijke last wint de eerste op NAAM, voor elke kijker dezelfde
  const missies = (await api(H, '/api/supplier/horeca/missions', {}, tokM)).body.missies || [];
  const last = (id) => missies.filter(x => String(x.voorId) === String(id) && !/klaar|geannuleerd/.test(x.status)).length;
  const lijst = await team(tokM);
  const min = Math.min(...lijst.map(x => last(x.id)));
  const verwacht = lijst.filter(x => last(x.id) === min).map(x => x.name).sort((x, y) => x.localeCompare(y, 'nl'))[0];
  assert.equal(verwacht, naamB, 'Bram en Zara hebben geen missies; Bram komt op naam voor Zara');
  for (const tok of [tokM, tokA]) {
    const v = await api(H, '/api/supplier/horeca/wave/voorstel', {}, tok);
    assert.equal(v.status, 200, JSON.stringify(v.body).slice(0, 200));
    assert.equal(v.body.voorstel.kandidaat && v.body.voorstel.kandidaat.name, verwacht, 'de kandidaat hangt af van de boekvolgorde');
  }
});
