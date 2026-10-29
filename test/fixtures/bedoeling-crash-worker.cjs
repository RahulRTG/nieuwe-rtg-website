/* Test-only checkpoint om de bestaande domeinfactory. De echte PG-collectie-
   transactie en HTTP-route blijven in gebruik; de ouder doodt het proces. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const moduleNaam=process.env.RTG_BEDOELING_MODULE;
if(!['bureau','werkplek'].includes(moduleNaam))throw Error('Onbekende crashproefmodule');
const pad=require.resolve(path.resolve(__dirname,'../../server/kern',moduleNaam));
const origineel=require(pad),fase=process.env.RTG_BEDOELING_FASE,marker=process.env.RTG_BEDOELING_MARKER;
require.cache[pad].exports=ctx=>origineel({...ctx,bewerkCollectie:async(sleutel,werk)=>{
 const r=await ctx.bewerkCollectie(sleutel,bron=>{
  const uit=werk(bron);
  if(marker&&uit.ok&&fase==='voor-commit'){
   fs.writeFileSync(marker,JSON.stringify({fase,id:(uit.zaak||uit.taak).id}));
   process.kill(process.pid,'SIGKILL');
  }
  return uit;
 });
 if(marker&&r.ok&&fase==='na-commit'){
  fs.writeFileSync(marker,JSON.stringify({fase,id:(r.zaak||r.taak).id}));
  await new Promise(()=>{});
 }
 return r;
}});
require('../../server/server');
