'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { metToestellen } = require('../scripts/lib/proeftoestel');
const { maakSessiewacht } = require('../scripts/lib/sessiewacht');
for (const methode of ['PUT', 'PATCH', 'DELETE']) test('IDOR bewaart '+methode+' bij tekenen, verzenden en sessieherhaling', async () => {
  const oproepen = [], tekenen = [];
  const post = metToestellen(async (pad, lijf, token, koppen, werkelijk) => {
    oproepen.push({pad,lijf,token,koppen,methode:werkelijk});
    return {status:token === 'oud' ? 401 : 403};
  }, {toestellen: ['oud','nieuw'].map(token => ({token, teken:async (m,p) => {tekenen.push([m,p]); return m+'-bewijs';}}))});
  const wacht = maakSessiewacht({post, rollen:{b:{vers:async()=> 'nieuw', leeft:async()=>false}}});
  await wacht.roep('/api/bank/overboeken', {id:'A'}, 'b', 'oud', methode);
  assert.deepEqual(oproepen.map(x=>x.methode), [methode,methode]);
  assert.deepEqual(tekenen.map(x=>x[0]), [methode,methode]);
  assert.deepEqual(oproepen.map(x=>x.lijf), [{id:'A'},{id:'A'}]);
});
const { maakIdorVraag } = require('../scripts/idorproef');
test('IDOR transport rapporteert echte methode en bewaart foutbody zonder redirects te volgen', async () => {
  const vragen = [];
  const vraag = maakIdorVraag('http://voorbeeld.test', async (url,opt) => {
    vragen.push({url,opt}); return {status:500,text:async()=> 'persoonlijke fouttekst'};
  });
  for (const methode of ['POST','PUT','PATCH','DELETE']) {
    const antwoord = await vraag('/api/object', {id:'A'}, 'B', {'x-proof':'signed'}, methode);
    assert.deepEqual(antwoord, {methode,status:500,data:'persoonlijke fouttekst',tekst:'persoonlijke fouttekst'});
    const {opt}=vragen.at(-1);
    assert.equal(opt.method,methode);
    assert.equal(opt.redirect,'manual');
    assert.equal(opt.headers['x-proof'],'signed');
    assert.equal(opt.headers.Authorization,'Bearer B');
    assert.deepEqual(JSON.parse(opt.body),{id:'A'});
  }
});
test('transportuitval behoudt methode zonder een status te verzinnen', async () => {
  const vraag=maakIdorVraag('http://voorbeeld.test', async()=> {throw new Error('offline');});
  assert.deepEqual(await vraag('/api/object',{},'B',{},'DELETE'), {methode:'DELETE',status:0,data:null,tekst:'offline'});
});
