'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const url=process.env.RTG_LIVING_WORLD_TEST_PG_URL || process.env.DATABASE_URL || process.env.PG_URL;
test('Living World: twee PostgreSQL-instances delen ontvangstbewijzen, revisies en herstel',{
  timeout:30000
},async t=>{
  assert.ok(url,'Deze proef vereist een lege testdatabase via npm run test:pg of RTG_LIVING_WORLD_TEST_PG_URL.');
  const isolated=await require('./lib/living-world-pg-database')(url);
  t.after(isolated.close);
  const {maakPg}=require('../server/pg'),{merge3}=require('../server/db/merge'),kluis=require('../server/kluis');
  const make=require('../server/kern/living-world');
  const a=maakPg({url:isolated.url,merge3,kluis}),b=maakPg({url:isolated.url,merge3,kluis});
  try{
    await a.schema();
    assert.equal(Number((await a.pool.query('SELECT count(*) AS n FROM kv')).rows[0].n),0,'deze proef vereist een lege testdatabase');
    const dataA=await a.laadAlles()||{},dataB=await b.laadAlles()||{};
    const core=(pg,data,fail=false)=>make({db:{data,writable:true},save:()=>{throw new Error('geen alternatieve schrijfweg');},
      bewerkCollectie:(name,fn)=>pg.bewerkCollectie(name,data,s=>{const out=fn(s);if(fail)throw new Error('injected before commit');return out;}),
      sources:{name:k=>k,media:()=>null}});
    const ca=core(a,dataA),cb=core(b,dataB),input={title:'Haven',area:'IJmuiden'};
    const race=await Promise.all([ca.execute('A','place.create',input,'shared-receipt'),cb.execute('A','place.create',input,'shared-receipt')]);
    assert.equal(race.filter(x=>x.ok).length,2);assert.equal(race.filter(x=>x.replay).length,1);
    const id=race[0].result.id;
    const edit={id,revision:1,title:'Een nieuwe titel',area:'IJmuiden'};
    const changed=await Promise.all([ca.execute('A','place.update',edit,'edit-on-A'),cb.execute('A','place.update',edit,'edit-on-B')]);
    assert.equal(changed.filter(x=>x.ok).length,1);assert.equal(changed.filter(x=>x.code==='STALE_VERSION').length,1);
    await assert.rejects(core(a,dataA,true).execute('A','place.publish',{id,revision:2},'publish-receipt'),/injected before commit/);
    const stored=await a.laadAlles();
    assert.equal(stored.livingWorld.places[id].status,'draft');assert.equal(stored.livingWorld.history.length,2);
    const restarted=core(b,await b.laadAlles());
    assert.equal((await restarted.execute('A','place.publish',{id,revision:2},'publish-receipt')).ok,true);
    assert.equal((await restarted.execute('A','place.create',input,'shared-receipt')).replay,true);
    assert.equal((await a.laadAlles()).livingWorld.history.length,3);
    dataA.newCollection=[];dataB.newCollection=[];
    await a.bewerkCollectie('newCollection',dataA,list=>{list.push('A');});
    await b.bewerkCollectie('newCollection',dataB,list=>{list.push('B');});
    assert.deepEqual((await a.laadAlles()).newCollection,['A','B'],'een nieuwe arraycollectie mag evenmin externe toevoegingen wissen');
  }finally{await Promise.all([a.pool.end(),b.pool.end()]);}
});
