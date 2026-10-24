/* HET ANTWOORDSPOOR -- post-response auditwerk zonder een gesloten verzoekcontext.

   server/lib/antwoordspoor.js bundelt alle schrijvers achter een response in
   registratievolgorde en voert de bundel buiten de AsyncLocalStorage-context
   van het afgeronde verzoek uit. Dit bestand bewaakt beide grenzen:

     1. Meerdere schrijvers delen een bundel en lopen precies eenmaal en in
        registratievolgorde.
     2. Een schrijver na `finish` erft geen gesloten verzoekcontext. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { AsyncLocalStorage } = require('node:async_hooks');
const antwoordspoor = require('../server/lib/antwoordspoor');

test('antwoordspoor bundelt schrijvers eenmaal en in registratievolgorde', () => {
  const res = new EventEmitter();
  const gezien = [];
  let bundels = 0;
  const bundel = werk => { bundels += 1; return werk(); };
  antwoordspoor(res, () => gezien.push('a'), bundel);
  antwoordspoor(res, () => gezien.push('b'), bundel);
  assert.equal(res.listenerCount('finish'), 1);
  res.emit('finish');
  assert.deepEqual(gezien, ['a', 'b']);
  assert.equal(bundels, 1);
});

test('audit na het antwoord erft geen gesloten verzoekcontext', () => {
  const context = new AsyncLocalStorage();
  const res = new EventEmitter();
  let gezien = 'niet-uitgevoerd';
  context.run({ verzoek: 'afgerond' }, () => {
    antwoordspoor(res, () => { gezien = context.getStore(); });
    res.emit('finish');
  });
  assert.equal(gezien, undefined,
    'de schrijver bezit zijn closure, maar niet de AsyncLocalStorage-context van het afgeronde verzoek');
});
