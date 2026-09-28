/* NIEMAND KWIJT, ONDER STORINGEN -- de verliesproef van fase B (POLITIEK.md par. 18.1).

   De vraag is niet of het gelukte pad werkt, maar: KAN EEN MENS TUSSEN TWEE
   SYSTEMEN VERDWIJNEN? Honderd synthetische kwesties gaan door de lus terwijl
   de server met opzet op de gevaarlijke plekken sterft (server/lib/verraad.js):

     sterf-voor-mutatie   in elke bundel, voor er iets verandert
                          (inbrengen -> voor de opslag, en elke latere stap)
     sterf-na-commit      direct nadat de opslag een vastlegging bevestigde,
                          voor het antwoord (opslag -> voor de behandeling,
                          besluit -> voor de terugkoppeling)
     sterf-voor-bericht   net voor de wek in de berichten van het lid
                          (terugkoppeling -> voor de wek)

   Na elke dood volgt een herstart op DEZELFDE datamap met een andere seed, en
   de ronde gaat verder. Een antwoord dat verloren ging, telt NIET als
   geaccepteerd: wie geen 200 kreeg, weet dat hij het opnieuw moet doen.

   HET CRITERIUM, na een laatste schone herstart:
     1. elke kwestie die een 200 kreeg, is terug te vinden;
     2. elke eindstand die een 200 kreeg, staat er nog, onveranderd;
     3. NIEMAND_KWIJT meldt nul onverklaarde breuken;
     4. wat klaarstond zonder wek, wordt door herbezorgen ingehaald.
   En de proef moet ECHT verraden hebben: een ronde zonder een enkele dood heeft
   niets gemeten (toets 2).

   Draai los: node --test test/democratie-verlies.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, stopHard, stopNet, kantoorAlsPersoon } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dem-verlies-'));
const BASIS = { RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '', SMTP_URL: '', RTG_DATA_DIR: TMP };
const STORM = 'sterf-voor-mutatie:0.03,sterf-na-commit:0.05,sterf-voor-bericht:0.15';
const AANTAL = 100;
const lang = 'Toelichting van ruim vijftien tekens, voor de proef.';

let srv = null;
let seed = 1;
let doden = 0;

function api(pad, body, token) {
  return fetch(srv.base + pad, { method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

async function start(storm) {
  for (let poging = 0; poging < 8; poging++) {
    seed++;
    try {
      srv = await startServer({ env: Object.assign({}, BASIS,
        storm ? { RTG_VERRAAD: STORM, RTG_VERRAAD_SEED: String(seed * 7919) } : {}) });
      return;
    } catch (e) { doden++; }
  }
  throw new Error('de server kwam na acht pogingen niet op');
}

/* Een stap. Sterft de server, dan is het antwoord verloren: null, en herstarten. */
async function doe(pad, body, token) {
  try {
    const r = await api(pad, body, token);
    if (srv.child.exitCode === null && srv.child.signalCode === null) return r;
  } catch (e) { /* verbinding weg: de server is gestorven */ }
  doden++;
  await stopHard(srv.child);
  await start(true);
  return null;
}

test.after(() => { try { stop(srv && srv.child); } catch (e) {} fs.rmSync(TMP, { recursive: true, force: true }); });

test('1. honderd kwesties door een storm van crashes: niemand kwijt', { timeout: 600000 }, async (t) => {
  /* De wereld opzetten zonder storm: tien burgers en een kantoormens. */
  await start(false);
  const leden = [];
  for (let i = 0; i < 10; i++) {
    const u = (Date.now() + i).toString().slice(-8);
    const reg = await api('/api/auth/register', { name: 'Proefburger ' + i, email: 'dv' + u + i + '@x.nl',
      phone: '06' + u, password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
    assert.ok(reg.body.token, 'registratie ' + i);
    leden.push(reg.body.token);
  }
  let kantoor = await kantoorAlsPersoon(srv.base);
  assert.ok(kantoor);
  await stopNet(srv.child);
  await start(true);

  const geaccepteerd = new Map();   // id -> { lid, eindstand }
  for (let i = 0; i < AANTAL; i++) {
    const tok = leden[i % leden.length];
    const r = await doe('/api/member/democratie/kwestie/inbreng', { onderwerp: 'Proefkwestie nummer ' + i + ' in de wijk' }, tok);
    if (r && r.status === 200) geaccepteerd.set(r.body.kwestie.id, { lid: tok, eindstand: null });
  }
  const standen = ['samen-opgelost', 'uitgevoerd', 'onhaalbaar', 'afgewezen', 'doorgestuurd'];
  let n = 0;
  for (const [id, g] of geaccepteerd) {
    n++;
    if (n % 10 < 7) await doe('/api/office/democratie/kwestie/behandel', { id }, kantoor);
    if (n % 2 === 0) {
      const stand = standen[n % standen.length];
      const r = await doe('/api/office/democratie/kwestie/eindstand',
        { id, stand, toelichting: lang, bevoegdheid: 'de wijkraad', naar: 'de gemeente' }, kantoor);
      if (r && r.status === 200) g.eindstand = stand;
    }
    if (n % 4 === 0) await doe('/api/member/democratie/kwestie/gezien', { id }, g.lid);
  }

  /* De laatste herstart is schoon: nu wordt gemeten. */
  await stopHard(srv.child);
  await start(false);
  kantoor = await kantoorAlsPersoon(srv.base);
  const lijst = (await api('/api/office/democratie/kwestie/lijst', {}, kantoor)).body.kwesties;
  const opId = new Map(lijst.map(k => [k.id, k]));

  const kwijt = [...geaccepteerd.keys()].filter(id => !opId.has(id));
  assert.deepEqual(kwijt, [], 'een kwestie die een 200 kreeg, is verdwenen');
  for (const [id, g] of geaccepteerd) {
    if (!g.eindstand) continue;
    const r = opId.get(id).rondes[0];
    assert.equal(r.stand, 'afgesloten', id + ' kreeg een 200 op zijn eindstand en is weer open');
    assert.equal(r.eindstand.stand, g.eindstand, id + ': de eindstand is veranderd');
  }

  let m = (await api('/api/office/democratie/meter', {}, kantoor)).body;
  assert.equal(m.onverklaard, 0, 'onverklaarde breuken na de storm: ' + JSON.stringify(m.breuken));
  assert.equal((await api('/api/office/democratie/kwestie/herbezorg', {}, kantoor)).status, 200);
  m = (await api('/api/office/democratie/meter', {}, kantoor)).body;
  assert.equal(m.staan.besluitWekNogNietUit, 0, 'herbezorgen haalt elke wek in die niet uitging');
  assert.equal(m.onverklaard, 0);
  assert.ok(geaccepteerd.size > AANTAL / 2, 'te weinig kwesties geaccepteerd om iets te meten: ' + geaccepteerd.size);

  t.diagnostic('geaccepteerd ' + geaccepteerd.size + ' van ' + AANTAL + ', doden ' + doden +
    ', met een eindstand ' + [...geaccepteerd.values()].filter(g => g.eindstand).length);
});

test('2. de proef heeft echt verraden: een storm zonder doden meet niets', () => {
  assert.ok(doden >= 3, 'maar ' + doden + ' keer gestorven; de storm stond wel aan maar sloeg niet toe');
});
