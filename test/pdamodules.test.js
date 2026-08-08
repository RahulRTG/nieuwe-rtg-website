/* ============================================================================
   DE PDA-MODULES: EEN LIJN TUSSEN SERVER EN PDA, EN GEEN TWEEDE WAARHEID.

   WAT ER MISGING

   De personeels-PDA bepaalde ZELF welke eigen tabs aangingen, met regels als
   `(state.supplier.caps || []).includes('marina')` verspreid over de delen van
   personeel.js. Daarmee wisten twee plekken hetzelfde: de server welke caps een
   zaak heeft, en de PDA welke cap welke tab verdient. Dat is LAT-regel 4, en bij
   73 genres is de uitkomst voorspelbaar -- een nieuw genre krijgt zijn caps op
   de server en blijft in de PDA onzichtbaar, zonder dat iets klaagt. Een tab die
   er niet is, is stiller dan een tab die stuk is.

   Nu levert de server de lijst (kern/pda/modules.js) en schakelt de PDA daarop.

   WAT DEZE TOETS VASTLEGT

   1. De afbeelding zelf: caps en genre in, modules uit.
   2. De lijst komt echt mee in /api/supplier/state.
   3. DE LIJN. Elke module die de PDA opvraagt, bestaat aan de serverkant. Dit
      is de toets die de scheiding bewaakt: wie in de PDA een tab op een module
      hangt die de server nooit stuurt, bouwt een tab die niemand ooit ziet.
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, stop } = require('./helper');
const { PER_CAP, PER_GENRE, modulesVoor } = require('../server/kern/pda/modules');

const PDA_DELEN = path.join(__dirname, '..', 'public', 'apps', 'personeel');

test('caps en genre bepalen samen de modules', () => {
  assert.deepEqual(modulesVoor({ type: 'marina' }, ['marina', 'location']), ['marina']);
  assert.deepEqual(modulesVoor({ type: 'taxi' }, ['rides', 'location', 'pricing']), ['ritten']);
  // een genre dat niet aan een cap hangt
  assert.deepEqual(modulesVoor({ type: 'verhuur' }, ['huur', 'location']), ['verkoop']);
  assert.deepEqual(modulesVoor({ type: 'beveiliging' }, ['beveiliging', 'location']), ['beveiliging']);
  // meer caps, meer modules, en niets dubbel
  const veel = modulesVoor({ type: 'galerie' }, ['tickets', 'retail', 'location']);
  assert.deepEqual(veel.sort(), ['entree', 'winkel']);
  // een zaak zonder eigen modules is geen fout
  assert.deepEqual(modulesVoor({ type: 'zzp' }, ['services', 'location']), []);
  assert.deepEqual(modulesVoor(null, null), []);
});

test('elke module die de PDA opvraagt, bestaat aan de serverkant', () => {
  /* De lijn tussen de twee kanten. Zonder deze toets kan de PDA een tab op
     heeftModule('reparatiebon') hangen die de server nooit stuurt -- en dan is
     de tab er gewoon nooit, zonder foutmelding. */
  const bekend = new Set([...Object.values(PER_CAP), ...Object.values(PER_GENRE)]);
  const gevraagd = new Map();
  for (const naam of fs.readdirSync(PDA_DELEN)) {
    if (!naam.endsWith('.js')) continue;
    const bron = fs.readFileSync(path.join(PDA_DELEN, naam), 'utf8');
    for (const m of bron.matchAll(/heeftModule\(\s*'([^']+)'\s*\)/g))
      if (!gevraagd.has(m[1])) gevraagd.set(m[1], naam);
  }
  assert.ok(gevraagd.size > 0, 'de PDA hoort modules op te vragen, anders toetst dit niets');
  const onbekend = [...gevraagd].filter(([mod]) => !bekend.has(mod))
    .map(([mod, waar]) => mod + ' (' + waar + ')');
  assert.deepEqual(onbekend, [],
    'de PDA vraagt modules die de server niet kent: ' + onbekend.join(', '));
});

test('de modulelijst komt mee in de zaak-status', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  try {
    /* PORTELL is de marina-demozaak; die hoort de marina-module te krijgen en
       niet de ritten-module. Twee kanten, zodat de bewering niet slaagt door
       een lijst die per ongeluk alles bevat. */
    const post = async (pad, body, tok) => (await fetch(srv.base + '/api' + pad, {
      method: 'POST',
      headers: Object.assign({ 'content-type': 'application/json', 'X-Forwarded-Proto': 'https' },
        tok ? { authorization: 'Bearer ' + tok } : {}),
      body: JSON.stringify(body || {})
    })).json();

    const roster = await post('/supplier/roster', { code: 'PORTELL' });
    assert.ok(roster.staff && roster.staff.length, 'PORTELL hoort personeel te hebben');
    const mgr = roster.staff.find(m => m.role === 'manager') || roster.staff[0];
    const d = await post('/supplier/login', { code: 'PORTELL', staffId: mgr.id, pin: '1234' });
    assert.ok(d.token, 'de demo-inlog van PORTELL hoort te werken (kreeg: ' + JSON.stringify(d).slice(0, 120) + ')');

    const r = await fetch(srv.base + '/api/supplier/state', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + d.token, 'X-Forwarded-Proto': 'https' },
      body: JSON.stringify({})
    });
    const st = (await r.json()).state;
    assert.ok(Array.isArray(st.supplier.modules), 'de status hoort een modulelijst te dragen');
    assert.ok(st.supplier.modules.includes('marina'), 'een marina hoort de marina-module te krijgen');
    assert.equal(st.supplier.modules.includes('ritten'), false, 'een marina rijdt geen ritten');
    assert.equal(st.supplier.industry, 'maritime', 'de sector uit het genre-register hoort mee te komen');
  } finally { await stop(srv); }
});
