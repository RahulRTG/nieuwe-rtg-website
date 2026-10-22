/* Stroomisolatie accepteert alleen beide positieve eigen eventreeksen en
   expliciete weigering; een groen label, 500 of verkeerde methode bewijst niets. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { oordeel, openStroom } = require('../scripts/lib/stroomisolatie');
const R = require('../scripts/bevoegdronde');
function bewijs() {
  return { gang: 'stroom', bewijsVersie: 1, methode: 'GET', pad: '/api/stream', staat: 'afgebakend',
    proef: { barrieresNaVerzending: true, anoniemTicket: 401, anoniemStream: 403,
      eigen: ['a', 'b'].map(actor => ({actor: actor.repeat(64), ticket: 200, status: 200,
        hello: true, stuur: 200, barriereStuur: 200, herhaal: 401,
        markerIndex: 1, barriereIndex: 2, volgorde: true, kruis: false})) } };
}
test('beide exacte methoden kunnen hetzelfde complete stroomexperiment dragen', () => {
  for (const [methode, pad] of [['GET', '/api/stream'], ['POST', '/api/stroom/ticket']]) {
    const r = { ...bewijs(), methode, pad };
    assert.equal(oordeel(r).stand, 'gemeten');
    assert.equal(R.beoordeelIdorRij(r, { methode, pad }).stand, 'gemeten');
    assert.equal(R.beoordeelIdorRij(r, { methode, pad: pad + '/ander' }).stand, 'open');
  }
});
test('elk ontbrekend positief bewijs, actoronderscheid of eventvolgorde blijft open', () => {
  const wijzigingen = [r=>r.proef.eigen[0]=null, r=>r.proef.eigen[1]='geen bewijs',
    r=>r.proef.eigen[1]=[], r=>delete r.proef, r=>r.bewijsVersie=0, r=>r.proef.eigen.pop(),
    r=>r.proef.eigen[1].actor=r.proef.eigen[0].actor, r=>r.proef.barrieresNaVerzending=false,
    r=>r.methode='POST', r=>r.pad='/api/stream/ander'];
  for (const i of [0, 1]) for (const veld of ['actor','ticket','status','hello','stuur','barriereStuur','herhaal','markerIndex','barriereIndex','volgorde','kruis'])
    wijzigingen.push(r=>delete r.proef.eigen[i][veld]);
  for (const i of [0,1]) wijzigingen.push(r=>r.proef.eigen[i].barriereIndex=0);
  for (const wijzig of wijzigingen) { const r=bewijs(); wijzig(r); assert.equal(oordeel(r).stand,'open',String(wijzig)); }
});
test('foutcodes en redirects worden nooit weigering, lek en toegestane replay zijn gebroken', () => {
  for (const status of [0, 302, 400, 404, 429, 500, 503]) for (const veld of ['anoniemTicket','anoniemStream','herhaal']) {
    const r=bewijs(); if(veld==='herhaal') r.proef.eigen[0].herhaal=status; else r.proef[veld]=status;
    assert.equal(oordeel(r).stand,'open',veld+status);
  }
  for (const wijzig of [r=>r.proef.eigen[0].kruis=true, r=>r.proef.eigen[1].kruis=true,
    r=>r.proef.eigen[0].herhaal=200,r=>r.proef.anoniemTicket=200,r=>r.proef.anoniemStream=200]) {
    const r=bewijs(); wijzig(r); assert.equal(oordeel(r).stand,'gebroken');
  }
  assert.equal(oordeel({gang:'stroom',staat:'afgebakend',methode:'GET',pad:'/api/stream'}).stand,'open');
});
test('SSE-wachten volgt complete events over willekeurige chunks en bewaart volgorde', async () => {
  let controller;
  const body = new ReadableStream({start(c){controller=c;}});
  const enc = new TextEncoder();
  const s=await openStroom('http://test.invalid', {vraag:async()=>({status:200,body}),timeout:1000});
  let gezien=false; const wacht=s.wacht(es=>es.some(e=>e.includes('marker'))).then(()=>{gezien=true;});
  for(const text of ['event: hello\r','\ndata: {}\r\n\r\n','event: msg\ndata: mar','ker\n\n','event: msg\ndata: barriere\n\n']) controller.enqueue(enc.encode(text));
  await wacht; assert.equal(gezien,true); assert.equal(s.events.length,3);
  assert.match(s.events[0],/event: hello/); assert.match(s.events[1],/marker/); assert.match(s.events[2],/barriere/);
  controller.close(); await s.sluit();
});
test('een vroeg gesloten stroom zonder verwacht event is geen positief bewijs', async () => {
  const s=await openStroom('http://test.invalid',{vraag:async()=>new Response('event: hello\ndata: {}\n\n')});
  await assert.rejects(s.wacht(es=>es.some(e=>e.includes('ontbreekt'))),/eindigde/); await s.sluit();
});

test('timeout beëindigt wachten en sluit de SSE-reader zonder vaste sleeps', async () => {
  const s = await openStroom('http://test.invalid', { timeout: 10, vraag: async (_, { signal }) => {
    const body = new ReadableStream({ start(c) {
      signal.addEventListener('abort', () => c.error(new Error('aborted')), { once: true });
    } });
    return {status:200,body};
  } });
  await assert.rejects(s.wacht(es=>es.length>0),/aborted/); await s.sluit();
});

test('een kruismarker tijdens afsluiten wordt vóór het definitieve oordeel meegenomen', async () => {
  const raw = bewijs(), markers = ['eigen-a', 'eigen-b'], barrieres = ['klaar-a', 'klaar-b'];
  const streams = markers.map((marker, i) => ({ events: [marker, barrieres[i]],
    async sluit() { if (i === 0) { await Promise.resolve(); this.events.push(markers[1]); } } }));
  await require('../scripts/lib/stroomisolatie').sluitEnLees(streams, raw.proef, markers, barrieres);
  assert.equal(raw.proef.eigen[0].kruis, true);
  assert.equal(raw.proef.eigen[1].kruis, false);
  assert.equal(oordeel(raw).stand, 'gebroken');
});

test('echte HTTP-streams bewijzen eigen ontvangst, kruisgrens en eenmalige tickets', {timeout:90000}, async t => {
  const w = await require('../scripts/lib/voltooiwereld').maakWereld('stroomisolatie');
  t.after(() => w.klaar());
  const raw = await require('../scripts/lib/stroomisolatie').meet({basis:w.basis,post:w.post});
  assert.equal(raw.staat, 'afgebakend', JSON.stringify(raw));
  for(const [methode,pad] of [['GET','/api/stream'],['POST','/api/stroom/ticket']]) {
    assert.equal(oordeel({...raw,methode,pad}).stand,'gemeten');
    assert.equal(R.beoordeelIdorRij({...raw,methode,pad},{methode,pad}).stand,'gemeten');
  }
});
