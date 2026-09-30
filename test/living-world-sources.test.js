'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./lib/living-world-fixture');

test('plekbeheerder mag eigen bijdragen niet via zelfreview publiceren',async()=>{
  const f=fixture(),{placeId}=await f.setup();
  const c=await f.command('A','contribution.create',{placeId,kind:'knowledge',title:'Eigen tip',text:'Zelf geschreven',observedAt:f.time()});
  const denied=await f.world.execute('A','contribution.review',{id:c.id,revision:1,decision:'accepted',reason:'Zelf nagekeken'},'self-review-owner');
  assert.equal(denied.status,403);assert.equal(f.row('A','contribution',c.id).status,'pending');
  assert.equal(f.world.view('B').pulse.length,0);
});

test('reisverbinding bewaart alleen een verwijzing; wijzigingen, privérechten en verwijdering volgen de bron',async()=>{
  const f=fixture(),{blueprintId}=await f.setup(),id=await f.preparePlan(blueprintId);
  const source={id:'travel:reis:123',kind:'travel',title:'Mijn verblijf',status:'aangevraagd',url:'/apps/reisbureau.html',version:'v1'};
  f.context({B:{items:[source],unavailable:[]}});
  let p=f.row('B','plan',id);
  await f.command('B','plan.connect',{id,revision:p.revision,sourceId:source.id});
  const stored=f.db.data.livingWorld.plans[id].connections[0];
  assert.deepEqual(Object.keys(stored).sort(),['connectedAt','id','version']);
  assert.equal(f.row('B','plan',id).connections[0].status,'aangevraagd');
  f.context({B:{items:[{...source,status:'geannuleerd',version:'v2'}],unavailable:[]}});
  p=f.row('B','plan',id);assert.equal(p.connections[0].changed,true);assert.equal(p.connections[0].status,'geannuleerd');
  await f.command('B','plan.request',{id,revision:p.revision});
  assert.deepEqual(f.row('A','plan',id).connections,[{private:true,title:'Privéonderdeel van de deelnemer'}]);
  p=f.row('B','plan',id);
  assert.equal((await f.world.execute('B','plan.connect',{id,revision:p.revision,sourceId:'travel:another-user'},'foreign-source')).status,404);
  f.context({B:{items:[],unavailable:['reiswereld']}});
  assert.equal(f.row('B','plan',id).connections[0].unavailable,true);
  await f.command('B','plan.connect',{id,revision:p.revision,sourceId:source.id,remove:true});
  assert.deepEqual(f.row('B','plan',id).connections,[]);
});

test('Connect volgt beoordeling, correctie en intrekking van de bron zonder duplicaatdossier',async()=>{
  const f=fixture(),{placeId}=await f.setup();
  const data={placeId,kind:'knowledge',title:'Oude tip',text:'Eerste waarneming',observedAt:f.time()};
  const old=await f.command('B','contribution.create',data);
  assert.deepEqual(f.world.portfolio('B'),[]);
  await f.command('A','contribution.review',{id:old.id,revision:1,decision:'accepted',reason:'Nagekeken'});
  assert.equal(f.world.portfolio('B')[0].id,old.id);
  assert.deepEqual(f.world.portfolio('C'),[]);
  const update=await f.command('B','contribution.create',{...data,kind:'correction',title:'Bijgewerkte tip',supersedes:old.id});
  await f.command('A','contribution.review',{id:update.id,revision:1,decision:'accepted',reason:'Correctie nagetrokken'});
  assert.equal(f.row('C','place',placeId).memory.length,2);
  assert.equal(f.world.view('C').pulse.length,1);
  assert.equal(f.world.portfolio('B')[0].id,update.id);
  let place=f.row('A','place',placeId);
  await f.command('A','place.withdraw',{id:placeId,revision:place.revision,reason:'Plek intrekken'});
  assert.deepEqual(f.world.portfolio('B'),[]);
  assert.equal(f.row('B','contribution',update.id).current,false,'eigen bijdrage blijft terug te vinden als historische kennis');
  assert.equal(f.world.view('C',{contribution:update.id}).status,404);
  place=f.row('A','place',placeId);await f.command('A','place.publish',{id:placeId,revision:place.revision});
  await f.command('B','contribution.withdraw',{id:update.id,revision:2,reason:'Niet langer delen'});
  assert.deepEqual(f.world.portfolio('B'),[]);
});

test('intrekking van deelname blokkeert latere review en verwijdert eerder bewijs uit Connect',async()=>{
  const f=fixture(),{placeId,blueprintId}=await f.setup(),planId=await f.preparePlan(blueprintId);
  await f.complete(planId);
  const data={placeId,planId,kind:'knowledge',title:'Mijn ervaring',text:'Een bijdrage',observedAt:f.time()};
  const accepted=await f.command('B','contribution.create',data),pending=await f.command('B','contribution.create',data);
  await f.command('A','contribution.review',{id:accepted.id,revision:1,decision:'accepted',reason:'Nagekeken'});
  assert.equal(f.world.portfolio('B').length,1);
  const p=f.row('A','plan',planId);
  await f.command('A','plan.revokeEvidence',{id:planId,revision:p.revision,reason:'Verkeerde deelnemer vastgelegd'});
  assert.deepEqual(f.world.portfolio('B'),[]);
  assert.equal(f.world.view('C').pulse.length,0);
  assert.equal((await f.world.execute('A','contribution.review',{id:pending.id,revision:1,decision:'accepted',reason:'Nagekeken'},'revoked-review')).code,'PARTICIPATION_REVOKED');
});
