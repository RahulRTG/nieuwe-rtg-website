/* Alleen een proefcheckpoint op de echte PostgreSQL-COMMIT. Geen vervangende
   opslag: alle drie bankcollecties moeten werkelijk in dezelfde transactie staan. */
'use strict';
const fs=require('node:fs');
const {Client}=require('../../server/pgwire');
const query=Client.prototype.query,standen=new WeakMap();
Client.prototype.query=async function(sql,params){
 const tekst=String(sql).trim(),fase=process.env.RTG_BANK_CRASH_FASE;
 if(/^BEGIN\b/i.test(tekst))standen.set(this,new Set());
 const sleutels=standen.get(this);
 const geraakt=sleutels&&sleutels.has('bankRekeningen')&&sleutels.has('bankIdem')&&sleutels.has('bankIdemAfdruk');
 const commit=/^COMMIT\b/i.test(tekst)&&geraakt&&fase;
 if(commit&&fase==='voor-commit'){
  fs.writeFileSync(process.env.RTG_BANK_CRASH_MARKER,JSON.stringify({fase}));
  process.kill(process.pid,'SIGKILL');
 }
 const uit=await query.call(this,sql,params);
 if(sleutels&&/^INSERT INTO kv\b/i.test(tekst)&&params) sleutels.add(params[0]);
 if(/^COMMIT\b|^ROLLBACK\b/i.test(tekst))standen.delete(this);
 if(commit&&fase==='na-commit'){
  fs.writeFileSync(process.env.RTG_BANK_CRASH_MARKER,JSON.stringify({fase}));
  await new Promise(()=>{});
 }
 return uit;
};
require('../../server/server');
