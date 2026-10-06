/* ============================================================================
   ACHTERGRONDWERK: EEN EIGEN FRAME, EEN EIGEN DRAGER, EN DE KETEN VAN RAHUL
   (Fase 2, PR 7; besluiten B4b en B6a, invariant I11).

     1. DE DRAGERSOORT `dienst`. Een achtergronddienst boekt op dienst:<naam>,
        apart per dienst, in de wereld van het huis en met de stand van het
        huis. Elke plek die de dragersoorten opsomt kent hem -- een lijst of
        switch die hem mist is een gat, en toets 2 en 3 vinden dat.
     2. ACHTERGRONDWERK IN DE NULCONTEXT. alsDienst() en overdraag() erven geen
        handeling, AI-sessie of kostendrager van wie ze startte, en dragen een
        NIEUW frame; de drager gaat via de kostenhaak zodat frame en kostenlaag
        dezelfde eigenaar zien.
     3. I11. Rahuls interne aanroep draagt de correlatie van het verzoek waarin
        hij werd gevraagd als oorzaak -- ondertekend met het procesgeheim van
        agentteken, dus niet door een buitenstaander te kiezen.

   Draai los: node --test test/dienstdrager.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const haak = require('../server/kern/kosten/haak');
const werelden = require('../server/kern/economie/werelden');
const beleidkaart = require('../server/kern/kosten/beleidkaart');
const frame = require('../server/opzet/verzoekframe');
const handeling = require('../server/opzet/handeling');
const aic = require('../server/ai-context');
const agentteken = require('../server/kern/agentteken');
const { alsDienst } = require('../server/kern/dienstidentiteit');

const WORTEL = path.join(__dirname, '..');

test('1. dienst is een dragersoort, in de wereld van het huis, met de stand van het huis', () => {
  assert.ok(haak.SOORTEN_DRAGER.includes('dienst'));
  const d = haak.drager('dienst', 'bewaarveger');
  assert.equal(d, 'dienst:bewaarveger', 'apart per dienst, niet op huis');
  assert.deepEqual(haak.ontleed(d), { soort: 'dienst', id: 'bewaarveger' });
  assert.equal(werelden.wereldVan(d), 'rtg-intern');
  assert.equal(werelden.factureerbaar(werelden.wereldVan(d)), false, 'een dienst krijgt nooit een rekening');
  assert.equal(beleidkaart.pasVan(d), 'dienst');
  assert.equal(beleidkaart.BELEID.dienst.stand, 'huis');
  assert.ok(beleidkaart.VAST.dienst, 'en het kantoor kan dat niet omzetten');
});

test('2. elke dragersoort heeft een wereld, een beleid en een bijdrage-antwoord', () => {
  const dekking = require('../server/kern/kosten/dekking')({});
  for (const soort of haak.SOORTEN_DRAGER) {
    assert.ok(werelden.wereldVan(haak.drager(soort, 'x')), soort + ' heeft geen economische wereld');
    if (soort === 'lid') continue;              // een lid heeft een pas; zijn soort is geen pas
    assert.ok(beleidkaart.BELEID[soort], soort + ' heeft geen beleid in kern/kosten/beleidkaart.js -- dan valt hij op "gratis" terug');
  }
  const b = dekking.bijdrageVan('dienst');
  assert.equal(b.centen, null);
  assert.doesNotMatch(b.waarom, /maandprijs/, 'een dienst is geen pas zonder prijs maar het huis');
});

/* De lexicale helft: een bestand dat de dragersoorten OPSOMT (drie of meer als
   letterlijke tekst, waaronder gezin en huis) noemt ze allemaal, of draagt hier
   een uitzondering met de reden. Zo vindt een nieuwe soort de plekken die hem
   moeten kennen in plaats van dat ze stil op een terugval vallen. */
const UITZONDERING = {
  'server/kern/kosten/dekking.js': { lid: 'een lid heeft een pas, en bijdrageVan rekent met die pas en niet met de soort', lab: 'een lab heeft geen pas en geen maandprijs; "geen maandprijs ingesteld" is daar de bestaande uitkomst, en wat een lab bijdraagt is een besluit van de RTFoundation, niet van deze stap' }
};
test('3. wie de dragersoorten opsomt, kent ze allemaal (of zegt waarom niet)', () => {
  const { zonderCommentaar } = require('../scripts/lib/bron');
  const lijst = (map, uit = []) => {
    for (const e of fs.readdirSync(path.join(WORTEL, map), { withFileTypes: true })) {
      const rel = path.join(map, e.name);
      if (e.isDirectory()) { if (!['data', 'node_modules', 'fonts', 'campagne'].includes(e.name)) lijst(rel, uit); }
      else if (/\.(js|html)$/.test(e.name)) uit.push(rel);
    }
    return uit;
  };
  const noemt = (bron, s) => new RegExp('[\'"]' + s + '[\'"]').test(bron);
  const gaten = [], opsommers = [];
  for (const rel of [...lijst('server'), ...lijst('public')]) {
    const bron = zonderCommentaar(fs.readFileSync(path.join(WORTEL, rel), 'utf8'));
    const wel = haak.SOORTEN_DRAGER.filter(s => noemt(bron, s));
    if (!(wel.includes('gezin') && wel.includes('huis') && wel.length >= 3)) continue;
    opsommers.push(rel);
    for (const s of haak.SOORTEN_DRAGER) if (!wel.includes(s) && !((UITZONDERING[rel] || {})[s])) gaten.push(rel + ' kent ' + s + ' niet');
  }
  assert.ok(opsommers.length >= 3, 'de zoeker vindt de opsommers niet meer: ' + opsommers.join(', '));
  assert.deepEqual(gaten, []);
  for (const rel of Object.keys(UITZONDERING)) assert.ok(opsommers.includes(rel), 'een uitzondering voor een bestand dat niets meer opsomt: ' + rel);
});

/* Een OPEN verzoek met frame, handeling, AI-sessie en kostendrager. */
function inVerzoek(fn) {
  const req = { id: 'srv-' + Math.random().toString(16).slice(2, 10), path: '/x', method: 'POST', ip: '127.0.0.1', headers: {} };
  const res = new EventEmitter();
  let uit;
  frame.middleware()(req, res, () => handeling.middleware({ data: () => null, log: () => {} })(req, res, () =>
    aic.inContext({ ip: req.ip, req }, () => haak.binnen(haak.drager('lid', 'user-8'), () => { uit = fn(req, res); }))));
  return uit;
}

test('4. alsDienst: nulcontext, een eigen frame, en de kosten op dienst:<naam>', () => {
  const geboekt = [];
  const was = haak.meterStaat();
  assert.equal(was, false, 'deze toets hangt zelf een meter aan de haak');
  haak.zetMeter((m) => { geboekt.push(m); return true; });
  try {
    let gezien = null;
    inVerzoek(() => alsDienst('bewaarveger', () => {
      const f = frame.huidig();
      gezien = { soort: f.soort, actor: f.actor.sleutel, drager: f.drager, wie: haak.wieNu(),
        handeling: !!handeling.huidige(), ai: !!aic.huidig(), oorzaak: f.oorzaak };
      haak.meld('verzoek', 1);
    }));
    assert.equal(gezien.soort, 'dienst');
    assert.equal(gezien.actor, 'dienst:bewaarveger');
    assert.deepEqual({ ...gezien.drager }, { drager: 'dienst:bewaarveger', herkomst: 'dienst' });
    assert.equal(gezien.wie, 'dienst:bewaarveger', 'de kostenhaak ziet dezelfde eigenaar als het frame');
    assert.equal(gezien.handeling, false, 'geen handeling van het verzoek dat de dienst startte');
    assert.equal(gezien.ai, false, 'en geen AI-sessie');
    assert.equal(geboekt.length, 1);
    assert.equal(geboekt[0].drager, 'dienst:bewaarveger', 'apart geteld, niet op het lid en niet op huis');
  } finally { haak.zetMeter(null); }
});

test('5. overdraag: nulcontext, het verzoek als oorzaak, de drager via de kostenhaak', () => {
  inVerzoek((req) => {
    frame.overdraag(() => {
      const f = frame.huidig();
      assert.equal(f.soort, 'overdracht');
      assert.equal(f.oorzaak, req.id);
      assert.equal(handeling.huidige(), null, 'de handeling van het verzoek erft niet');
      assert.equal(aic.huidig(), null);
      assert.equal(haak.wieNu(), haak.HUIS, 'zonder opgave geen drager: nooit stil die van het lid');
    });
    frame.overdraag(() => assert.equal(haak.wieNu(), 'zaak:Z1'), { drager: haak.drager('zaak', 'Z1'), herkomst: 'sessie' });
  });
});

test('6. I11: de oorzaak van een interne aanroep is ondertekend en komt in het frame', () => {
  const kop = agentteken.oorzaakKop('a1b2c3d4e5f60718');
  assert.ok(kop && kop.startsWith('a1b2c3d4e5f60718.'));
  const lees = (w) => agentteken.oorzaakVan({ headers: { [agentteken.KOP_OORZAAK]: w } });
  assert.equal(lees(kop), 'a1b2c3d4e5f60718');
  assert.equal(lees('a1b2c3d4e5f60718'), null, 'een kale correlatie is geen oorzaak');
  assert.equal(lees('andere-keten.' + kop.split('.')[1]), null, 'de handtekening hoort bij deze correlatie');
  assert.equal(lees('a1b2c3d4e5f60718.' + '0'.repeat(64)), null, 'een verzonnen handtekening telt niet');
  assert.equal(agentteken.oorzaakKop('x'.repeat(65)), null);

  const metKop = (w) => {
    const req = { id: 'srv-binnen', headers: { [agentteken.KOP_OORZAAK]: w } };
    const res = new EventEmitter(); const koppen = {};
    res.setHeader = (k, v) => { koppen[k.toLowerCase()] = v; };
    let f = null;
    frame.middleware()(req, res, () => { f = frame.huidig(); });
    return { f, koppen };
  };
  const goed = metKop(kop);
  assert.equal(goed.f.oorzaak, 'a1b2c3d4e5f60718', 'het frame van het uitgevoerde verzoek kent zijn oorzaak');
  assert.equal(goed.koppen['x-rtg-oorzaak'], 'a1b2c3d4e5f60718', 'en zegt hem terug aan de interne aanroeper');
  const vals = metKop('a1b2c3d4e5f60718');
  assert.equal(vals.f.oorzaak, null, 'een kop die iedereen kan meesturen zet geen oorzaak');
  assert.equal(vals.koppen['x-rtg-oorzaak'], undefined);
});
