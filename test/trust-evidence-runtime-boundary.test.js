/* Trust-runtimecollecties horen bij dezelfde PostgreSQL-requestkopie als de
   domeinstaat. Geen subsystem mag via een bij configure() vastgehouden object
   eerder zichtbaar worden, een afgewezen request overleven of na een gooiende
   save als spookmutatie in RAM blijven staan. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const verzoekcontext = require('../server/db/verzoekcontext');
const runtime = require('../server/kern/bewijsvlak/runtime');

const AT = '2026-10-01T12:00:00.000Z';
const CAPABILITY = 'hospitality.availability.check';

function harnas(opties) {
  const o = opties || {};
  let raw = { trustEvidence: {} };
  const db = {};
  Object.defineProperty(db, 'data', { get() { return verzoekcontext.dataVoor(raw); } });
  const plane = runtime.configure({ db, mode: 'shadow', nu: () => AT,
    save() {
      if (o.saveFout) throw Object.assign(new Error('opslag stuk'), { code: 'TEST_SAVE_FAILED' });
      return verzoekcontext.noteerSave();
    } });
  return {
    plane,
    raw: () => raw,
    commit(ctx) {
      const wijzigingen = verzoekcontext.wijzigingen(ctx);
      for (const w of wijzigingen) {
        if (w.waardeBestaat) raw[w.sleutel] = JSON.parse(w.waardeJson);
        else delete raw[w.sleutel];
      }
      verzoekcontext.sluit(ctx);
      return wijzigingen;
    }
  };
}

const subsystemen = [
  {
    naam: 'metrics',
    muteer: (plane, suffix) => plane.metrics.record({ capability: CAPABILITY,
      outcome: 'SUCCEEDED', measurementKey: 'meting-' + suffix, durationMs: 4 }),
    aantal: plane => plane.metrics.aggregate(CAPABILITY, 30, AT).attempts
  },
  {
    naam: 'transport',
    muteer: (plane, suffix) => plane.transport.enqueue({ id: 'event-' + suffix,
      type: 'test.runtime-boundary', chainId: 'chain-' + suffix, payload: { suffix } }),
    aantal: plane => plane.transport.stand().pending
  },
  {
    naam: 'provenance',
    muteer: (plane, suffix) => plane.provenance.node('node-' + suffix, { kind: 'test' }),
    aantal: plane => plane.provenance.snapshot().nodes.length
  }
];

for (const subsystem of subsystemen) {
  test(subsystem.naam + ': request B ziet de open werkkopie van A niet en rollback laat geen spook achter', () => {
    const h = harnas();
    const a = verzoekcontext.nieuw({ method: 'POST', path: '/a-' + subsystem.naam });
    verzoekcontext.voer(a, () => {
      subsystem.muteer(h.plane, 'rollback');
      assert.equal(subsystem.aantal(h.plane), 1, 'A ziet zijn eigen werkkopie');
      const b = verzoekcontext.nieuw({ method: 'GET', path: '/b-' + subsystem.naam });
      verzoekcontext.voer(b, () => {
        assert.equal(subsystem.aantal(h.plane), 0,
          'B zag een nog niet gecommitte mutatie van A');
      });
      verzoekcontext.sluit(b);
    });
    assert.deepEqual(verzoekcontext.wijzigingen(a).map(x => x.sleutel), ['trustEvidence']);
    verzoekcontext.sluit(a); // 4xx/5xx/disconnect: responsepoort discardt de kopie
    assert.equal(subsystem.aantal(h.plane), 0,
      'een afgewezen request liet een mutatie in de runtime-root achter');
  });

  test(subsystem.naam + ': een synchrone save-fout herstelt de lokale mutatie', () => {
    const state = {};
    const plane = runtime.configure({ state, mode: 'shadow', nu: () => AT,
      save() { throw Object.assign(new Error('opslag stuk'), { code: 'TEST_SAVE_FAILED' }); } });
    assert.throws(() => subsystem.muteer(plane, 'save-fout'), /opslag stuk/);
    assert.equal(subsystem.aantal(plane), 0,
      'na een save-fout bleef een later alsnog te bewaren mutatie achter');
  });

  test(subsystem.naam + ': een geslaagde requestcommit publiceert precies eenmaal', () => {
    const h = harnas();
    const a = verzoekcontext.nieuw({ method: 'POST', path: '/commit-' + subsystem.naam });
    verzoekcontext.voer(a, () => subsystem.muteer(h.plane, 'commit'));
    const wijzigingen = h.commit(a);
    assert.deepEqual(wijzigingen.map(x => x.sleutel), ['trustEvidence']);
    assert.equal(subsystem.aantal(h.plane), 1);
  });
}
