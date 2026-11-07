'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { fixture, tick } = require('./lib/foundation-ds-fixture');
function setup() {
  const f = fixture(); f.add('div').id = 'balk';
  f.add('main').innerHTML = fs.readFileSync('public/apps/foundation/gevoel.html','utf8').match(/<main[^>]*>([\s\S]*?)<\/main>/)[1];
  f.context.navigator = {}; f.context.location.reload = () => { f.reloaded = true; };
  vm.runInContext(fs.readFileSync('public/apps/foundation/gevoel.js','utf8'), f.context);
  f.diary = f.requests.find(r => r.url.endsWith('/welzijn/dagboek'));
  f.switch = change => { const s = JSON.parse(f.storage.get('rtf_sessie')); change(s); f.storage.set('rtf_sessie', JSON.stringify(s)); };
  f.choose = () => f.node('#koppen').querySelectorAll('button')[0].click();
  return f;
}
const day = {dag:'2026-10-31',gevoel:'blij'};
const diary = {ok:true,stemmingen:[day],toestemming:true,zelfToestemming:true,dagVandaag:day};
test('actual Gevoel rejects old diary and blocks dispatch for changed family, token or profile', async () => {
  for (const change of [s=>s.code='ANDER',s=>s.token='NIEUW',s=>s.profiel.id='ANDER',s=>delete s.profiel]) {
    const f=setup(); f.switch(change); f.reply(f.diary,diary); await tick();
    assert.equal(f.node('#dagboekBlok').hidden,true); assert.equal(f.node('#dagboekStrook').textContent,'');
    f.choose(); const count=f.requests.length; f.node('#bewaarKnop').click(); await tick();
    assert.equal(f.requests.length,count); assert.equal(f.node('#bewaarKnop').textContent,'Bewaar in mijn dagboekje');
  }
});
test('actual Gevoel validates body and diary rows before publication without losing choice', async () => {
  for (const body of [null,{}, {ok:true}, {...diary,ok:false}, {...diary,error:'fout'}, {...diary,stemmingen:[{dag:'<img>',gevoel:'blij'}]}]) {
    const f=setup(); f.reply(f.diary,body); await tick();
    assert.equal(f.node('#dagboekBlok').hidden,true);
    f.choose(); f.node('#bewaarKnop').click(); f.reply(f.requests.at(-1),body); await tick();
    assert.equal(f.node('#koppen').querySelector('button').getAttribute('aria-pressed'),'true');
    assert.doesNotMatch(f.node('#bewaarKnop').textContent,/Vandaag bewaard/);
  }
});
test('actual Gevoel keeps consent separate, accepts real responses and rejects late consent or failed save', async () => {
  const f=setup(); f.reply(f.diary,diary); await tick(); assert.equal(f.node('#dagboekBlok').hidden,false);
  f.choose(); f.node('#bewaarKnop').click(); f.reply(f.requests.at(-1),{error:'Apart toestemmen',hoe:'toestemming',zelf:true},409); await tick();
  f.node('#toestemKnop').click(); const req=f.requests.at(-1); f.switch(s=>s.profiel.id='B');
  f.reply(req,{ok:true,toestemming:true}); await tick(); assert.equal(f.requests.at(-1),req,'no follow-up save for old consent');
  const g=setup(); g.choose(); g.node('#bewaarKnop').click(); const save=g.requests.at(-1);
  g.switch(s=>s.token='B'); save.reject(Error('old actor failure')); await tick();
  assert.equal(g.node('#bewaarKnop').textContent,'Bewaar in mijn dagboekje');
  const h=setup(); h.choose(); h.node('#bewaarKnop').click(); h.reply(h.requests.at(-1),{ok:true,dag:day}); await tick();
  assert.ok(h.requests.at(-1).url.endsWith('/dagboek')); h.reply(h.requests.at(-1),diary); await tick();
  assert.match(h.node('#bewaarKnop').textContent,/Vandaag bewaard: blij/);
});

test('late diary does not replace a newly chosen feeling; HTTP failure never counts as saved', async () => {
  const f=setup(); f.choose(); f.reply(f.diary,diary); await tick();
  assert.equal(f.node('#bewaarKnop').disabled,false);
  assert.equal(f.node('#bewaarKnop').textContent,'Bewaar in mijn dagboekje');
  f.node('#bewaarKnop').click(); f.reply(f.requests.at(-1),{ok:true,dag:day},503); await tick();
  assert.doesNotMatch(f.node('#bewaarKnop').textContent,/Vandaag bewaard/);
});

test('save A followed by choice B refreshes diary without claiming unsaved B was saved', async () => {
  const f=setup(); f.choose(); f.node('#bewaarKnop').click(); const save=f.requests.at(-1);
  const buttons=f.node('#koppen').querySelectorAll('button'); buttons[1].click();
  f.reply(save,{ok:true,dag:day}); await tick(); const refresh=f.requests.at(-1);
  assert.ok(refresh.url.endsWith('/dagboek')); f.reply(refresh,diary); await tick();
  assert.equal(f.node('#dagboekBlok').hidden,false);
  assert.equal(buttons[1].getAttribute('aria-pressed'),'true');
  assert.equal(f.node('#bewaarKnop').disabled,false);
  assert.equal(f.node('#bewaarKnop').textContent,'Bewaar in mijn dagboekje');
  f.node('#bewaarKnop').click(); assert.equal(JSON.parse(f.requests.at(-1).opts.body).gevoel,'verdrietig');
});

test('latest diary request wins over a delayed empty initial response', async () => {
  const f=setup(); f.choose(); f.node('#bewaarKnop').click();
  f.reply(f.requests.at(-1),{ok:true,dag:day}); await tick();
  const refresh=f.requests.at(-1); assert.notEqual(refresh,f.diary);
  f.reply(refresh,diary); await tick();
  assert.equal(f.node('#dagboekBlok').hidden,false);
  const shown=f.node('#dagboekStrook').innerHTML;
  f.reply(f.diary,{...diary,stemmingen:[],dagVandaag:null,toestemming:false}); await tick();
  assert.equal(f.node('#dagboekBlok').hidden,false);
  assert.equal(f.node('#dagboekStrook').innerHTML,shown);
  assert.equal(f.node('#toestemIntrek').hidden,false);
  assert.match(f.node('#bewaarKnop').textContent,/Vandaag bewaard: blij/);
});
