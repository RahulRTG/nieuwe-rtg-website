'use strict';
/* Echte HTTP-response gevolgd door SIGKILL. Lange JSON-write-behind
   vergroot het bestaande venster; uitsluitend synthetische kantoorregie. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {once}=require('node:events'),{startServer}=require('./helper');
const CODE='KANTOOR-BANKREGIE-CRASHPROEF';
async function post(base,pad,body,token) {
  const r=await fetch(base+'/api/'+pad,{method:'POST',headers:{'Content-Type':'application/json',
    ...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body||{})});
  return {status:r.status,body:await r.json()};
}
async function dood(srv) {
  if(!srv||srv.child.exitCode!==null||srv.child.signalCode!==null)return;
  const weg=once(srv.child,'exit');srv.child.kill('SIGKILL');
  const [code,signal]=await weg;assert.equal(code,null);assert.equal(signal,'SIGKILL');
}
const gevallen=[
  {naam:'leden-bank',pad:'leden',body:{aan:true},waarde:r=>r.ledenAan===true,spoor:'RTG Bank voor leden LIVE gezet'},
  {naam:'noodstop',pad:'nood',body:{reden:'synthetische crashproef'},waarde:r=>r.nood?.actief===true,
    spoor:'RTG Bank NOODSTOP -- clearing valt terug op de kaart-rails'}
];
for(const store of ['json','sqlite']) for(const geval of gevallen)
  test(store+': '+geval.naam+' en uitvoeringsaudit overleven SIGKILL na HTTP 200',async t=>{
    const map=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-bankregie-crash-'));
    const env={RTG_DATA_DIR:map,RTG_STORE:store,RTG_SAVE_MS:'3600000',OFFICE_CODE:CODE,
      DATABASE_URL:'',PG_URL:'',REDIS_URL:'',RTG_ENC_KEY:'',SMTP_URL:'',RTG_AI_UIT:'1'};
    let srv;t.after(async()=>{await dood(srv);fs.rmSync(map,{recursive:true,force:true});});
    srv=await startServer({env});let login=await post(srv.base,'office/login',{code:CODE});
    assert.ok(login.body.token,JSON.stringify(login));
    const r=await post(srv.base,'office/bank/'+geval.pad,geval.body,login.body.token);
    await dood(srv);srv=null;assert.equal(r.status,200,JSON.stringify(r));
    assert.equal(geval.waarde(r.body),true,'HTTP bevestigde de wijziging');
    let vast;
    if(store==='json') vast=JSON.parse(fs.readFileSync(path.join(map,'db.json'),'utf8'));
    else {
      const conn=new(require('node:sqlite').DatabaseSync)(path.join(map,'store.db'),{readOnly:true});
      try {vast=Object.fromEntries(['bankregie','kantoorAudit'].map(k=>[
        k,JSON.parse(conn.prepare('SELECT val FROM kv WHERE key=? AND deleted=0').get(k)?.val||'null')]));}
      finally{conn.close();}
    }
    const duurzaam={besluit:geval.waarde(vast.bankregie||{}),
      uitvoeringsaudit:(vast.kantoorAudit||[]).some(x=>x.wat===geval.spoor)};
    t.diagnostic(JSON.stringify({store,geval:geval.pad,status:r.status,naSigkill:duurzaam}));
    srv=await startServer({env});login=await post(srv.base,'office/login',{code:CODE});
    const ov=await post(srv.base,'office/bank',{},login.body.token);assert.equal(ov.status,200,JSON.stringify(ov));
    assert.deepEqual({...duurzaam,herstart:geval.waarde(ov.body.regie||{})},
      {besluit:true,uitvoeringsaudit:true,herstart:true},'beslissing en audit blijven samen bestaan');
  });
