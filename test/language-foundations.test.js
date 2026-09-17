'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const meaning=require('../public/apps/access/meaning');
const {TALEN}=require('../server/talen');
const samples={
  'identity.account.create':{name:'Synthetic Person',email:'proof@example.test',geboortedatum:'1990-01-01',password:'synthetic-password'},
  'identity.session.open':{login:'proof@example.test',password:'synthetic-password'},
  'identity.second_factor.verify':{bewijs:'synthetic-proof',code:'123456'},
  'identity.passkey.challenge':{},
  'identity.passkey.verify':{ceremonie:'synthetic-ceremony',antwoord:{id:'synthetic-credential'}},
  'identity.recovery.request':{email:'proof@example.test'},
  'identity.password.replace':{token:'synthetic-reset-token',password:'synthetic-password'},
  'identity.agreement.accept':{naam:'Synthetic Person',akkoord:true,contractVersion:1}
};
function report(name,value){
  if(process.env.RTG_LANGUAGE_PROOF_OUTPUT)
    fs.writeFileSync(path.join(process.env.RTG_LANGUAGE_PROOF_OUTPUT,name+'.json'),JSON.stringify(value,null,2));
}
test('114 projections bind to the same eight structured meanings, parameters and existing authority routes',()=>{
  assert.deepEqual(Object.keys(samples),Object.keys(meaning.definitions));
  const rows=[];
  for(const language of TALEN){
    const actions=[];
    for(const [id,parameters] of Object.entries(samples)){
      // Locale is a presentation input only. It is deliberately absent from the plan contract.
      const label=meaning.projection('access.portal.create_my_account','Maak mijn account','Create my account',language.code,'PAY NOW');
      assert.notEqual(label.text,'PAY NOW');
      const expected=meaning.plan(id,parameters,1),actual=meaning.plan(id,JSON.parse(JSON.stringify(parameters)),1);
      assert.deepEqual(actual,expected);
      assert.equal(actual.route,meaning.definitions[id].route);
      actions.push({meaningId:id,version:actual.meaningVersion,route:actual.route,goal:actual.goal,authority:actual.authority,effect:actual.effect,parity:true});
    }
    rows.push({code:language.code,actions});
  }
  report('meaning',{scope:'Structured access UI bindings only. No free-text intent recognition or new execution broker.',naturalLanguageParity:'NOT_MEASURED',rows});
});
test('unknown semantics, versions, fields and consent fail closed; cached definitions hold no personal input',()=>{
  assert.throws(()=>meaning.plan('make.payment',{}),/Unknown/);
  assert.throws(()=>meaning.plan('identity.session.open',samples['identity.session.open'],2),/version/);
  assert.throws(()=>meaning.plan('identity.account.create',{...samples['identity.account.create'],tier:'business'}),/Unknown parameter/);
  for(const consent of [false,'true',1,null])
    assert.throws(()=>meaning.plan('identity.agreement.accept',{...samples['identity.agreement.accept'],akkoord:consent}));
  for(const version of [0,NaN,Infinity,1.2,'1'])
    assert.throws(()=>meaning.plan('identity.agreement.accept',{...samples['identity.agreement.accept'],contractVersion:version}));
  const before=JSON.stringify(meaning.definitions);
  meaning.plan('identity.account.create',samples['identity.account.create']);
  assert.equal(JSON.stringify(meaning.definitions),before);
  assert.ok(Object.isFrozen(meaning.definitions['identity.account.create'].required));
});
test('critical projection ignores model and cache text and marks its source-language fallback',()=>{
  for(const code of TALEN.map(t=>t.code)){
    const result=meaning.projection('access.onb.finish','Bevestig en open mijn RTG','Confirm and open my RTG',code,'Pay 500 euros');
    assert.equal(result.risk,'legal');assert.equal(result.version,1);
    assert.equal(result.text,code==='nl'?'Bevestig en open mijn RTG':'Confirm and open my RTG');
    assert.equal(result.fallback,!['nl','en'].includes(code));
  }
});
test('stop a real loopback model socket: warm translation survives; unknown text falls back and recovers',async()=>{
  const {maakAI}=require('../server/ai');
  const translator=require('../server/translate');
  let calls=0;const warnings=[];
  const model=http.createServer(async(req,res)=>{
    for await(const chunk of req) void chunk;
    calls++;res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({choices:[{message:{role:'assistant',content:JSON.stringify(['Die Verbindung ist bereit.'])},finish_reason:'stop'}]}));
  });
  await new Promise(resolve=>model.listen(0,'127.0.0.1',resolve));
  const port=model.address().port;
  const client=maakAI({localUrl:'http://127.0.0.1:'+port,externUit:true,volgorde:['local'],
    local:{model:'synthetic-fixture',timeout:1500,maxRetries:0},log:{warn:(kind,value)=>warnings.push({kind,...value})}});
  assert.deepEqual(client.aanbieders,['local']);
  translator.setAnthropic(client);
  try {
    const source='The connection is ready.';
    const warm=await translator.translateBatch([source],'de','en');
    assert.equal(warm[0].text,'Die Verbindung ist bereit.');assert.equal(calls,1);
    await new Promise(resolve=>model.close(resolve));
    const cached=await translator.translateBatch([source],'de','en');
    assert.equal(cached[0].text,warm[0].text);assert.equal(calls,1,'cache wins before model inference');
    const unknown='Your saved journey can be reviewed here.';
    const cold=await translator.translateBatch([unknown],'de','en');
    assert.equal(cold[0].text,unknown);assert.equal(cold[0].translated,false);
    assert.ok(warnings.some(w=>w.kind==='ai-uitwijk' && w.van==='local'),'the actual provider connection failed');
    const fallback=meaning.projection('access.onb.finish','Bevestig','Confirm','ar','Invented approval');
    assert.equal(fallback.text,'Confirm');assert.equal(fallback.fallback,true);
    await new Promise(resolve=>model.listen(port,'127.0.0.1',resolve));
    const recovered=await translator.translateBatch([unknown],'de','en');
    assert.equal(recovered[0].translated,true,'failed source was not poisoned into the cache');
    assert.equal(calls,2);
    report('failover',{scope:'Real existing translateBatch → maakAI → LocalAI → loopback HTTP adapter with synthetic response, then closed listening socket; no production service stopped.',
      modelStopped:true,providerFailureObserved:true,providers:client.aanbieders,warmCacheSurvived:true,
      warmCacheAdditionalModelCalls:0,coldFallbackExplicit:true,criticalTextNeverInferred:true,recoveryAfterRestart:true,
      translationQuality:'NOT_MEASURED',externalProviderCalls:0});
  } finally {translator.setAnthropic(null);if(model.listening)await new Promise(resolve=>model.close(resolve));}
});
