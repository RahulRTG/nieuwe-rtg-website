/* The installed Pass may cache public interface assets, never API data,
   personal uploads, external resources or HTML masquerading as a script. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code = fs.readFileSync(require('node:path').join(__dirname,'../public/shared/sw-pass-assets.js'),'utf8');
async function warm(urls, clientPath = '/apps/app.html?pas=rtg') {
  let handler, done, reply;
  const fetched = [], stored = [];
  const origin = 'https://rtg.example';
  const self = {location:{origin},clients:{get:async () => ({url:origin+clientPath})},
    addEventListener:(name,fn) => { handler = fn; }};
  vm.runInNewContext(code,{self,URL,Request,Response,Set,Promise,
    caches:{open:async () => ({match:async () => null,put:async url => stored.push(url)})},
    fetch:async req => { fetched.push({url:req.url,credentials:req.credentials});
      return new Response('public interface', {headers:{'content-type':req.url.includes('bad.js') ? 'text/html' : 'text/javascript'}}); }});
  self.RTGPassAssets('test-cache');
  handler({data:{type:'rtg-pass-assets',urls:urls.map(u => u.startsWith('/') ? origin+u : u)},
    source:{id:'pass'},ports:[{postMessage:value => { reply = value; }}],waitUntil:p => { done = p; }});
  await done;
  return {fetched,stored,reply};
}
test('Pass-installatie bewaart alleen openbare bronnen, met exacte bundelquery en zonder inlogcookies', async () => {
  const result = await warm(['/shared/command.js?v=123','/scriptbundel.js?f=abc&i=1&v=xyz',
    '/images/world-homes/living-sfeer.jpg','/shared/interface/world-widget-catalog.json',
    '/api/state','/apps/app.html?pas=rtg','/uploads/personal.jpg',
    '/shared/file.js?token=secret','https://outside.example/shared/test.js','/shared/bad.js']);
  assert.equal(result.stored.length,4);
  assert.equal(result.fetched.length,5, 'API, private photos, documents and unknown query parameters are never fetched');
  assert.ok(result.fetched.every(r => r.credentials === 'omit'));
  assert.ok(result.stored.includes('https://rtg.example/scriptbundel.js?f=abc&i=1&v=xyz'));
  assert.equal(result.reply.ok,false, 'an HTML error page does not count as a cached script');
});
test('een ander scherm kan geen Pass-installatiebericht indienen', async () => {
  const result = await warm(['/shared/command.js'],'/apps/saloon.html');
  assert.deepEqual(result.fetched,[]);
});
