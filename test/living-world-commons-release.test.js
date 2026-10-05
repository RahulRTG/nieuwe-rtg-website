'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,commonsSharing}=require('./lib/living-world-fixture');

test('een contribution is private-first en wordt geen learning artifact zonder release',async()=>{
  const f=fixture(),{placeId,blueprintId}=await f.setup();
  const planId=await f.preparePlan(blueprintId);await f.complete(planId);
  const contribution=await f.command('B','contribution.create',{placeId,planId,kind:'knowledge',title:'Privénotitie',
    text:'Dit blijft bij de maker.',observedAt:f.time()});
  await f.command('A','contribution.review',{id:contribution.id,revision:1,decision:'accepted',reason:'Broninhoud beoordeeld.'});
  assert.equal(f.row('B','contribution',contribution.id).visibility,'private');
  assert.equal(f.world.view('C').contributions.length,0);
  assert.equal(f.db.data.livingWorld.history.filter(x=>x.objectRef.id===contribution.id).every(x=>!x.protocol),true);
  const row=f.row('B','contribution',contribution.id),blueprint=f.row('A','blueprint',blueprintId);
  const denied=await f.world.execute('A','contribution.adopt',{id:row.id,revision:row.revision,
    blueprintRevision:blueprint.revision},'private-adopt-denied');
  assert.equal(denied.code,'STRUCTURAL_RELEASE_REQUIRED');
  assert.equal(f.row('A','blueprint',blueprintId).version,1);
});

test('Commons vraagt een afzonderlijke versioned release en publiceert niet impliciet',async()=>{
  const f=fixture(),{placeId}=await f.setup(),base={placeId,kind:'knowledge',title:'Publieke tip',
    text:'Een bewust vrijgegeven tip.',observedAt:f.time()};
  const noRelease=await f.world.execute('B','contribution.create',{...base,sharing:{visibility:'community',purpose:'world-memory',
    recipients:[],consent:true,returnUpdates:false}},'commons-without-release');
  assert.equal(noRelease.code,'COMMONS_RELEASE_REQUIRED');
  const paidRank=await f.world.execute('B','contribution.create',{...base,sharing:{...commonsSharing(),
    release:{...commonsSharing().release,reuse:['pay-to-rank']}}},'commons-paid-rank');
  assert.equal(paidRank.code,'COMMONS_RELEASE_REQUIRED');
  const created=await f.command('B','contribution.create',{...base,sharing:commonsSharing()});
  await f.command('A','contribution.review',{id:created.id,revision:1,decision:'accepted',reason:'Beoordeeld.'});
  const stored=f.db.data.livingWorld.contributions[created.id];
  assert.equal(stored.sharing.release.currentVersion,1);
  assert.deepEqual(stored.sharing.release.versions[0].reuse,['read','cite']);
  assert.equal(stored.sharing.release.versions[0].aiScopes.length,0);
  assert.equal(f.world.view('C').contributions.some(x=>x.id===created.id),true);
  await f.command('B','contribution.withdraw',{id:created.id,revision:2,reason:'Commons-release ingetrokken.'});
  const withdrawn=f.db.data.livingWorld.contributions[created.id];
  assert.equal(withdrawn.sharing.release.currentVersion,2);
  assert.equal(withdrawn.sharing.release.versions[1].status,'withdrawn');
  assert.equal(f.world.view('C').contributions.some(x=>x.id===created.id),false);
});

test('AI-assistentie en training worden niet afgeleid uit een Commons-release',async()=>{
  const f=fixture(),{placeId}=await f.setup(),base={placeId,kind:'knowledge',title:'Tip',text:'Inhoud',observedAt:f.time()};
  for(const aiScopes of [['assistance'],['training']]){
    const out=await f.world.execute('B','contribution.create',{...base,sharing:{...commonsSharing(),
      release:{...commonsSharing().release,aiScopes}}},'commons-ai-'+aiScopes[0]);
    assert.equal(out.code,'COMMONS_RELEASE_REQUIRED');
  }
});
