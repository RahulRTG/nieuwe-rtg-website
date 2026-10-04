'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const proef = require('./lib/audit-rijen-fixture');
const { bereidResultaat } = require('../server/db/audit-publicatie');
const journal = p => require('../server/kern/command/journaal').maakJournaal({
  db: p.db, save: p.save, crypto: require('node:crypto'), auditOpslag: p.save.audit.open('apiSpoor')
});

for (const soort of ['frozen', 'getter', 'setter', 'niet-schrijfbaar'])
  test('auditresultaat ' + soort + ' faalt vóór COMMIT; SQL en auditkop blijven onveranderd', async t => {
    const p = proef(t), j = journal(p), voor = p.persistentieStand();
    let geraakt = 0, eerste;
    await assert.rejects(p.bijeen(() => {
      p.db.data.ander.waarde = 2; p.save();
      eerste = j.noteer({ actor: 'sam', actie: 'eerste' }); eerste.actor = 'preview';
      const uit = j.noteer({ actor: 'sam', actie: 'tweede' });
      if (soort === 'frozen') Object.freeze(uit);
      else Object.defineProperty(uit, 'actor', soort === 'niet-schrijfbaar'
        ? { value: 'sam', writable: false }
        : { [soort === 'getter' ? 'get' : 'set']() { geraakt++; throw new Error('caller-accessor'); } });
    }, { duurzaam: true }), /Auditresultaat/);
    assert.equal(geraakt, 0, 'geen caller-code tijdens resultaatpublicatie');
    assert.equal(eerste.actor, 'preview', 'ook het eerste resultaat is niet voortijdig gepubliceerd');
    assert.equal(p.persistentieStand(), voor);
    assert.equal(p.lees('ander').waarde, 1);
    assert.equal(p.lees('apiSpoor').commandJournaalTotaal, 0);
    assert.equal(j.aantal(), 0); assert.equal(j.controleer().heel, true);
    await p.bijeen(() => { j.noteer({ actor: 'sam', actie: 'herhaling' }); p.save(); }, { duurzaam: true });
    assert.equal(p.lees('ander').waarde, 2);
    assert.equal(p.lees('apiSpoor').commandJournaalTotaal, 1);
    assert.equal(j.aantal(), 1); assert.equal(j.controleer().heel, true);
  });

test('getter in het definitieve rewrite-resultaat wordt vóór COMMIT geweigerd zonder hem uit te voeren', async t => {
  const p = proef(t), j = journal(p), poort = p.save.audit.open('apiSpoor');
  let bewerkingen = 0, getters = 0;
  await assert.rejects(p.bijeen(() => {
    p.db.data.ander.waarde = 2; p.save();
    poort.rewrite(() => {
      bewerkingen++;
      return bewerkingen === 1 ? { ok: true } : {
        get ok() { getters++; throw new Error('bron-getter'); }
      };
    });
  }, { duurzaam: true }), /Auditresultaat/);
  assert.equal(bewerkingen, 2, 'fout wordt geïnjecteerd bij de echte transactionele uitvoering');
  assert.equal(getters, 0);
  assert.equal(p.lees('ander').waarde, 1);
  assert.equal(p.lees('apiSpoor').commandJournaalTotaal, 0);
  assert.equal(j.aantal(), 0); assert.equal(j.controleer().heel, true);
});

test('voorbereide data-publicatie bewaart __proto__ als data en voert geen inherited setter uit', () => {
  const doel = {}, prototype = Object.getPrototypeOf(doel);
  const bron = JSON.parse('{"__proto__":{"vervalst":true},"waarde":2}');
  const publiceer = bereidResultaat(doel, bron);
  assert.equal(Object.hasOwn(doel, 'waarde'), false, 'voorbereiding verandert de preview niet');
  publiceer();
  assert.equal(Object.getPrototypeOf(doel), prototype);
  assert.equal(Object.hasOwn(doel, '__proto__'), true);
  assert.equal(doel.vervalst, undefined);
  assert.equal(doel.waarde, 2);
  const dicht = Object.seal({ waarde: 1 });
  bereidResultaat(dicht, { waarde: 3 })();
  assert.equal(dicht.waarde, 3, 'bestaande schrijfbare data blijft geldig');
});

test('Proxy-resultaat en Proxy-bron worden geweigerd zonder traps te bereiken', () => {
  let traps = 0;
  const proxy = new Proxy({}, { ownKeys() { traps++; throw new Error('trap'); },
    getPrototypeOf() { traps++; throw new Error('trap'); } });
  assert.throws(() => bereidResultaat(proxy, { waarde: 1 }), /Auditresultaat/);
  assert.throws(() => bereidResultaat({}, proxy), /Auditresultaat/);
  assert.equal(traps, 0);
});
