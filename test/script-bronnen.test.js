'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), remove = require('../scripts/lib/script-bronnen');
test('owned HTML script replacement respects quoted tag boundaries and preserves other executable source', () => {
  const html = '<script data-note=">" src="/legacy.js">ignored()</script>\n<script src="/keep.js"></script><main>Inhoud</main>';
  assert.equal(remove(html, src => src === '/legacy.js'), '<script src="/keep.js"></script><main>Inhoud</main>');
  assert.equal(remove('<script/src=/legacy.js></script><p>OK</p>',src=>src==='/legacy.js'),'<p>OK</p>');
  assert.equal(remove('<!-- <script src="/legacy.js"></script> --><p>OK</p>',()=>true),'<!-- <script src="/legacy.js"></script> --><p>OK</p>');
  assert.throws(()=>remove('<script src="/legacy.js">',()=>true),/Unclosed/);
});
