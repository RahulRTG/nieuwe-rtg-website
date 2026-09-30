'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.join(__dirname,'..');
function run(dir,body,fail=false,gate){
  const setup="const d=require('./server/db');d.load();const w=require('./server/kern/living-world')({db:d.db,save:d.save,"+
    "bewerkCollectie:"+(fail?"(name,fn)=>d.bewerkCollectie(name,s=>{fn(s);throw new Error('injected before commit')})":"d.bewerkCollectie")+
    ",sources:{name:k=>k,media:()=>null}});";
  return new Promise((resolve,reject)=>{
    const wait=gate?"process.send('ready');await new Promise(r=>process.once('message',r));process.disconnect();":'';
    const child=spawn(process.execPath,['-e',setup+'(async()=>{'+wait+body+'})().catch(e=>{console.error(e);process.exitCode=1})'],{
      stdio:gate?['ignore','pipe','pipe','ipc']:['ignore','pipe','pipe'],
      cwd:root,env:{...process.env,RTG_STORE:'sqlite',DATABASE_URL:'',PG_URL:'',RTG_DATA_DIR:dir,RTG_ENC_KEY:''}});
    if(gate)child.on('message',()=>gate(child));
    let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);
    child.on('error',reject);child.on('exit',code=>{
      if(code)return reject(new Error(err||out));
      try{resolve(JSON.parse(out.trim().split(/\r?\n/).at(-1)));}catch(e){reject(e);}
    });
  });
}
test('twee echte SQLite-processen: één creatie, één revisiewinnaar, herstel na afgebroken commit',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-world-loop-'));
  try{
    await run(dir,"console.log(JSON.stringify({ready:true}))");
    const create="console.log(JSON.stringify(await w.execute('A','place.create',{title:'Haven',area:'IJmuiden'},'shared-receipt')))";
    const waiting=[],gate=child=>{waiting.push(child);if(waiting.length===2)waiting.forEach(c=>c.send('go'));};
    const first=await Promise.all([run(dir,create,false,gate),run(dir,create,false,gate)]);
    assert.equal(first.filter(x=>x.ok).length,2);assert.equal(first.filter(x=>x.replay).length,1);
    assert.equal(first[0].result.id,first[1].result.id);
    const id=first[0].result.id;
    const update=receipt=>"console.log(JSON.stringify(await w.execute('A','place.update',"+
      JSON.stringify({id,revision:1,title:'Nieuwe titel',area:'IJmuiden'})+','+JSON.stringify(receipt)+')))';
    const race=await Promise.all([run(dir,update('revision-one')),run(dir,update('revision-two'))]);
    assert.equal(race.filter(x=>x.ok).length,1);assert.equal(race.filter(x=>x.code==='STALE_VERSION').length,1);
    const publish="try{await w.execute('A','place.publish',"+JSON.stringify({id,revision:2})+",'publish-receipt')}catch(e){console.log(JSON.stringify({error:e.message}))}";
    assert.equal((await run(dir,publish,true)).error,'injected before commit');
    const after=await run(dir,"console.log(JSON.stringify({view:w.view('A'),history:d.db.data.livingWorld.history.length}))");
    assert.equal(after.view.places.length,1);assert.equal(after.view.places[0].status,'draft');assert.equal(after.view.places[0].revision,2);
    assert.equal(after.history,2,'geen ontvangstbewijs voor een mislukte commit');
    const retry=await run(dir,"console.log(JSON.stringify(await w.execute('A','place.publish',"+JSON.stringify({id,revision:2})+",'publish-receipt')))");
    assert.equal(retry.ok,true);
    const replay=await run(dir,create);assert.equal(replay.replay,true);
    const final=await run(dir,"console.log(JSON.stringify({view:w.view('B'),history:d.db.data.livingWorld.history.length}))");
    assert.equal(final.view.places[0].status,'published');assert.equal(final.history,3);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
