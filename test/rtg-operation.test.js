'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const operation = require('../public/shared/rtg-operation');
const edge = require('../public/shared/rtg-edge-2-context');

test('HTTP, JSON and network failure never become a source confirmation', async () => {
  const cases = [
    async () => { throw new TypeError('offline'); },
    async () => new Response('<html>down</html>', { status: 503 }),
    async () => new Response('{}', { status: 403 }),
    async () => new Response('null', { status: 200 })
  ];
  for (const fetcher of cases) {
    const result = await operation.requestJson(fetcher, '/api/test', {});
    assert.ok(result.body.error);
    assert.equal(result.confirmed, false);
  }
  const read = await operation.requestJson(async () => new Response('{"ok":true}'), '/api/test', {});
  assert.equal(read.confirmed, false, 'the route must interpret its own domain receipt');
});

test('six honest statuses require explicit source evidence for finality', () => {
  const attrs = new Map([['data-rtg-operation-risk','financial']]);
  const element = {getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};
  assert.equal(Object.keys(operation.LABELS).length, 6);
  assert.equal(operation.setState(element,'local'),false);
  assert.equal(operation.setState(element,'confirmed'),false);
  assert.equal(operation.setState(element,'confirmed',{confirmed:true}),false);
  assert.equal(operation.setState(element,'waiting'),true);
  assert.equal(operation.setState(element,'confirmed',{confirmed:true,source:'/api/pay/receipt'}),true);
  assert.equal(attrs.get('data-rtg-operation-source'),'/api/pay/receipt');
  assert.equal(operation.setState(element,'failed'),true);
  assert.equal(attrs.has('data-rtg-operation-source'),false,'old provenance cannot decorate a new failure');
});

test('Edge remembers four choices per route without leaking a global choice', () => {
  const map = new Map();
  const storage = {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
  edge.writePreference(storage,'focus','https://rtg.local/apps/agenda.html');
  edge.writePreference(storage,'auto','https://rtg.local/apps/reizen.html');
  assert.equal(edge.readPreference(storage,'https://rtg.local/apps/agenda.html'),'focus');
  assert.equal(edge.readPreference(storage,'https://rtg.local/apps/reizen.html'),'auto');
  assert.equal(edge.readPreference(storage,'https://rtg.local/apps/kantoor.html'),null);
  assert.ok([...map.keys()].every(k=>!k.includes('https://')));
});


test('only a visible modal blocks Edge Auto', () => {
  const hidden = {getClientRects: () => []};
  const shown = {getClientRects: () => [{}]};
  const doc = {activeElement: null, body: {hasAttribute: () => false}, querySelector: () => null, querySelectorAll: () => [hidden]};
  assert.equal(edge.isBusy(doc, false), false);
  doc.querySelectorAll = () => [hidden, shown];
  assert.equal(edge.isBusy(doc, false), true);
});

test('three pinned actions retain explicit slots across catalog and source changes', () => {
  const dock = require('../public/shared/rtg-action-dock');
  const entries = [['a','Agenda','calendar','/apps/agenda.html'],['b','Bestanden','file','/apps/bestanden.html'],['bad','Unsafe','','https://example.com/']];
  const model = dock.model(entries, ['b','a','b','a']);
  assert.deepEqual(model.slots(), ['b','a',null]);
  assert.equal(model.pin(3,'a'), false);
  assert.equal(model.pin(1,'bad'), false);
  assert.equal(model.pin(2,'a'), true);
  assert.deepEqual(model.slots(), ['b',null,'a']);
  assert.deepEqual(dock.model(entries.slice().reverse(), model.slots()).slots(), model.slots());
});
