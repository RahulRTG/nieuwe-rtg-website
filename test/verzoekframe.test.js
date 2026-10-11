/* ============================================================================
   HET VERZOEKFRAME (server/opzet/verzoekframe.js) -- Fase 2, besluit B2a, in
   de schaduw.

   Deze toetsen houden de levenscyclus vast: open (correlatie van de server,
   extern begrensd), identificeer EEN keer en alleen via de envelop, sluit (en
   daarna weigert het frame), overdraag (een nieuw frame met de oorzaak, nooit
   stil erven). Daarnaast twee grenzen: de hoedanigheid komt nooit uit
   req.body, en NIEMAND in server/ leest het frame (schaduw) -- de eerste lezer
   is een besluit, geen bijvangst.

   De serverhelft (is het frame op ELK auth-punt aanwezig en eens met de andere
   contexten) is I14 in scripts/contextdoorgifte.js.

   Draai los: node --test test/verzoekframe.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { AsyncResource } = require('node:async_hooks');
const frame = require('../server/opzet/verzoekframe');
const trust = require('../server/kern/bewijsvlak/context');
const envelop = require('../server/opzet/envelop');
const haak = require('../server/kern/kosten/haak');

/* Een nagebootst verzoek langs de echte middleware; `binnen(fn)` draait fn in
   zijn context, `sluit()` doet wat res.finish doet. */
function verzoek(extra) {
  const req = Object.assign({ id: 'srv-' + Math.random().toString(16).slice(2, 10), externeId: 'proxy-1',
    path: '/x', method: 'POST', headers: {}, body: {} }, extra || {});
  const res = new EventEmitter();
  let binnen = null;
  frame.middleware()(req, res, () => { binnen = AsyncResource.bind((fn) => fn()); });
  return { req, res, binnen, sluit: () => res.emit('finish') };
}

test('openen: de correlatie komt van req.id (de server), extern begrensd, hoedanigheid null met reden', () => {
  const v = verzoek();
  const f = v.binnen(() => frame.huidig());
  assert.equal(f.correlatie, v.req.id);
  assert.equal(f.extern, 'proxy-1');
  assert.equal(f.soort, 'verzoek');
  assert.equal(f.stand, 'open');
  assert.equal(f.actor, null);
  assert.equal(f.hoedanigheid.naam, null);
  assert.ok(f.hoedanigheid.reden && f.hoedanigheid.reden.length > 10, 'een lege hoedanigheid draagt haar reden');
  assert.ok(Object.isFrozen(f), 'de afdruk is bevroren: wie hem leest kan het frame niet veranderen');
  assert.equal(frame.huidig(), null, 'buiten het verzoek is er geen frame');
});

test('identificeren: via de envelop, een keer; een andere sleutel daarna is een fout (I13)', () => {
  const v = verzoek();
  const t0 = frame.tellers();
  v.binnen(() => {
    envelop.zet(v.req, { soort: 'lid', id: 'user-1', rol: 'rtg' });
    const f = frame.huidig();
    assert.equal(f.stand, 'geidentificeerd');
    assert.deepEqual({ ...f.actor }, { sleutel: 'user-1', codenaam: null, deur: 'lid', identiteit: 'bewezen', agent: null });
    /* De strenge functie zelf gooit. */
    assert.throws(() => frame.identificeer({ sleutel: 'user-2' }), { code: 'FRAME_AL_GEIDENTIFICEERD' });
    /* Via de envelop gooit hij niet (de envelop gooit nooit), maar het telt en de actor blijft. */
    envelop.zet(v.req, { soort: 'lid', id: 'user-3' });
    assert.equal(frame.huidig().actor.sleutel, 'user-1');
    /* Dezelfde mens scherper bekeken (boardroomAuth na officeAuth) is herkend, geen fout. */
    envelop.zet(v.req, { soort: 'eigenaar', id: 'user-1', gezagBron: 'eigenaar' });
    assert.equal(frame.huidig().actor.deur, 'lid', 'herkennen verandert niets');
  });
  const t1 = frame.tellers();
  assert.equal(t1.tweedeIdentiteit - t0.tweedeIdentiteit, 2);
  assert.equal(t1.herkend - t0.herkend, 1);
});

test('de hoedanigheid komt nooit uit req.body', () => {
  const v = verzoek({ body: { hoedanigheid: 'zaakwaarnemer', machtiging: 'm-1' } });
  v.binnen(() => {
    envelop.zet(v.req, { soort: 'lid', id: 'user-9' });
    assert.equal(frame.huidig().hoedanigheid.naam, null);
  });
  assert.equal(frame.identificeer.length, 1, 'identificeer neemt een actor en geen verzoek');
});

test('na sluiten weigert het frame: geen stille "gelukt" (I5-vorm)', () => {
  const v = verzoek();
  v.sluit();
  const t0 = frame.tellers();
  v.binnen(() => {
    assert.equal(frame.huidig().stand, 'gesloten');
    assert.throws(() => frame.identificeer({ sleutel: 'user-4' }), { code: 'FRAME_GESLOTEN' });
    assert.throws(() => frame.zetDrager('lid:x', 'sessie'), { code: 'FRAME_GESLOTEN' });
    envelop.zet(v.req, { soort: 'lid', id: 'user-4' });   // gooit niet, maar telt
    assert.equal(frame.huidig().actor, null);
  });
  assert.equal(frame.tellers().naSluiten - t0.naSluiten, 3);
});

test('de drager komt van de kostenhaak, met zijn herkomst; zonder opgave onbekend, nooit geraden', () => {
  const v = verzoek();
  v.binnen(() => haak.binnen(haak.drager('gezin', 'GZ1'), () => {
    assert.deepEqual({ ...frame.huidig().drager }, { drager: 'gezin:GZ1', herkomst: 'lichaam' });
  }, 'gezin', 'lichaam'));
  const w = verzoek();
  w.binnen(() => haak.binnen(haak.drager('lid', 'user-5'), () => {
    assert.equal(frame.huidig().drager.herkomst, 'onbekend');
  }));
});

test('overdragen: een nieuw frame met de oorzaak erin; geen actor tenzij meegegeven', () => {
  const v = verzoek();
  v.binnen(() => {
    envelop.zet(v.req, { soort: 'lid', id: 'user-6' });
    frame.overdraag(() => {
      const f = frame.huidig();
      assert.equal(f.soort, 'overdracht');
      assert.equal(f.oorzaak, v.req.id);
      assert.notEqual(f.correlatie, v.req.id);
      assert.equal(f.actor, null, 'achtergrondwerk erft de actor niet stil');
    });
    frame.overdraag(() => assert.equal(frame.huidig().actor.sleutel, 'dienst:proef'),
      { actor: { sleutel: 'dienst:proef', deur: 'dienst', identiteit: 'bewezen' } });
    assert.equal(frame.huidig().actor.sleutel, 'user-6', 'het verzoekframe zelf is ongemoeid');
  });
});

test('hervat: een context die de body-lezer kwijtraakte, krijgt zijn eigen frame terug', () => {
  const req = { id: 'srv-hervat', externeId: null, headers: {} };
  const res = new EventEmitter();
  frame.middleware()(req, res, () => {});
  let gezien = null, keten = null;
  frame.hervat()(req, res, () => { gezien = frame.huidig(); keten = trust.huidige(); });
  assert.equal(gezien && gezien.correlatie, 'srv-hervat');
  assert.equal(keten && keten.chainId, 'chain_srv-hervat', 'ook de trust-keten komt terug, en die volgt het frame');
  assert.equal(keten, req.trustContext, 'dezelfde wortel, geen nieuwe');
});

test('de trust-keten is een lezer van het frame: een naam van wortel tot gebeurtenis', () => {
  const kernEnvelop = require('../server/kern/envelop');
  const req = { id: 'srv-keten', externeId: null, headers: { 'x-rtg-correlation': 'aanvaller' } };
  const res = new EventEmitter(), koppen = {};
  res.setHeader = (k, v) => { koppen[k] = v; };
  frame.middleware()(req, res, () => {
    const wortel = trust.huidige();
    assert.equal(wortel.chainId, 'chain_srv-keten', 'de keten komt uit de correlatie van het frame');
    assert.equal(koppen['X-RTG-Correlation'], wortel.chainId);
    const e = kernEnvelop.maak({ kanaal: 'keten-proef', classificatie: 'intern' });
    kernEnvelop.inKeten(e, () => assert.equal(trust.huidige().chainId, wortel.chainId,
      'een gebeurtenis binnen het verzoek houdt dezelfde keten (vroeger: een tweede naam)'));
  });
});

test('een lezer: de bus-envelop via zetFrameBron; verder niemand in server/ (PR 5)', () => {
  const { zonderCommentaar } = require('../scripts/lib/bron');
  const wortel = path.join(__dirname, '..', 'server');
  const gevonden = [], bronnen = [];
  const loop = (map) => {
    for (const e of fs.readdirSync(map, { withFileTypes: true })) {
      const p = path.join(map, e.name);
      if (e.isDirectory()) { if (e.name !== 'data' && e.name !== 'node_modules') loop(p); continue; }
      if (!e.name.endsWith('.js')) continue;
      const bron = zonderCommentaar(fs.readFileSync(p, 'utf8'));
      if (/verzoekframe['"]/.test(bron)) gevonden.push(path.relative(wortel, p));
      if (/\.zetFrameBron\s*\(/.test(bron)) bronnen.push(path.relative(wortel, p));
    }
  };
  loop(wortel);
  /* kern/dienstidentiteit.js OPENT frames voor achtergronddiensten (PR 7) en leest er niets uit. */
  assert.deepEqual(gevonden.sort(), ['kern/dienstidentiteit.js', 'opzet/envelop.js', 'opzet/verzoekketen.js'],
    'een nieuwe lezer van het verzoekframe is een besluit (Fase 2, PR 5 en later), geen bijvangst');
  assert.deepEqual(bronnen, ['opzet/verzoekframe.js'],
    'de bus-envelop leest het frame op EEN manier, en het frame hangt zich daar zelf in');
  /* En wat die lezer krijgt is identiteit, geen werkstaat. */
  const v = verzoek();
  v.binnen(() => assert.deepEqual(Object.keys(frame.voorBus()).sort(), ['actor', 'correlatie', 'hoedanigheid', 'oorzaak']));
});
