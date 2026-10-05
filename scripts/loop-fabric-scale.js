#!/usr/bin/env node
/* Meet de huidige minimale Lineage-projectievorm. Dit script simuleert geen
   snellere datastore: het gebruikt dezelfde objectkaart en dezelfde lineaire
   selectie als proof/recall, zodat een capaciteitsgrens zichtbaar blijft. */
'use strict';

const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks');
const D=require('../server/kern/loop-fabric/delivery');
const sizes=(process.argv.find(x=>x.startsWith('--sizes='))||'--sizes=10000,100000,1000000').slice(8).split(',')
  .map(Number).filter(x=>Number.isSafeInteger(x)&&x>0);
const percentile=(rows,p)=>rows.length ? rows.slice().sort((a,b)=>a-b)[Math.min(rows.length-1,Math.floor(rows.length*p))] : null;
const ms=value=>Number(value.toFixed(3));
function relation(i) {
  const group=i%1000,from={domain:'source-'+(i%3),type:'observation',id:'observation-'+i,version:1};
  const to={domain:'workos',type:'procedure',id:'procedure-'+group,version:2};
  return {id:'lin-'+i,from,relation:'informed_decision',to,originatingDomain:to.domain,eventRef:'event-'+i,
    receiptRef:'receipt-'+i,assertedAt:'2026-10-05T10:00:00.000Z',visibility:'restricted',provenance:null,
    causalClaim:false,status:'asserted'};
}
function run(size) {
  if (global.gc) global.gc(); const cpuBefore=process.cpuUsage(),heapBefore=process.memoryUsage().heapUsed,index={},batches=[];
  let start=performance.now();
  for(let i=0;i<size;i++) { const row=relation(i);index[row.id]=row;
    if ((i+1)%1000===0) {const now=performance.now();batches.push(now-start);start=now;}
  }
  const writeMs=batches.reduce((a,b)=>a+b,0),heapAfter=process.memoryUsage().heapUsed;
  const query=[];let found=0;
  for(let q=0;q<3;q++) {const t=performance.now();found=0;
    for(const row of Object.values(index)) if (row.to.id==='procedure-'+((q*347)%1000)) found++;
    query.push(performance.now()-t);
  }
  const sample=Object.fromEntries(Object.entries(index).slice(0,Math.min(size,10000))),sampleBytes=Buffer.byteLength(JSON.stringify(sample));
  const estimatedBytes=Math.round(sampleBytes*(size/Math.max(1,Object.keys(sample).length)));
  let coldStartMs=null,serializedBytes=null;
  if (size<=100000) {const t=performance.now(),json=JSON.stringify(index);JSON.parse(json);coldStartMs=performance.now()-t;serializedBytes=Buffer.byteLength(json);}
  const rebuildStart=performance.now();let checksum=0;
  for(let i=0;i<size;i++) checksum^=relation(i).id.length+i;
  const rebuildMs=performance.now()-rebuildStart;
  const cpu=process.cpuUsage(cpuBefore);
  return {relations:size,write:{totalMs:ms(writeMs),batch1000Ms:{p50:ms(percentile(batches,.5)),p95:ms(percentile(batches,.95)),
      p99:ms(percentile(batches,.99))}},recallScanMs:{p50:ms(percentile(query,.5)),p95:ms(percentile(query,.95)),
      p99:ms(percentile(query,.99)),matches:found},index:{heapGrowthBytes:heapAfter-heapBefore,estimatedSerializedBytes:estimatedBytes,
      measuredSerializedBytes:serializedBytes},coldStartMs:coldStartMs==null?{status:'not_run',reason:'voorkomt een tweede zeer grote heapkopie'}:ms(coldStartMs),
    rebuild:{ms:ms(rebuildMs),relationsPerSecond:Math.round(size/(rebuildMs/1000)),checksum},
    cpuMs:{user:ms(cpu.user/1000),system:ms(cpu.system/1000)},
    currentProjectionCapBytes:25*1024*1024,fitsCurrentProjectionCap:estimatedBytes<=25*1024*1024};
}
function deliveryRun(count=10000) {
  const events=Array.from({length:count},(_,i)=>({id:'scale-event-'+(i+1),sequence:i+1,type:'scale.changed',at:'2026-10-05T10:00:00.000Z'}));
  const delivery={},initial=D.summary(null,count,'2026-10-05T10:00:00.000Z',events),cpuBefore=process.cpuUsage();
  let start=performance.now();
  for (const event of events) {
    const options={at:'2026-10-05T10:00:00.000Z',workerId:'scale-worker',requireNext:true};
    D.claim(delivery,'consumer',event,options);D.complete(delivery,'consumer',event,options);
  }
  const processMs=performance.now()-start,after=D.summary(delivery.consumer,count,'2026-10-05T10:00:00.000Z',events);
  start=performance.now();for (const event of events) D.claim(delivery,'consumer',event,
    {at:'2026-10-05T10:00:00.000Z',workerId:'replay-worker'});
  const replayMs=performance.now()-start,cpu=process.cpuUsage(cpuBefore),collision={};
  const first=D.claim(collision,'consumer',events[0],{at:'2026-10-05T10:00:00.000Z',workerId:'region-a'});
  const second=D.claim(collision,'consumer',events[0],{at:'2026-10-05T10:00:00.000Z',workerId:'region-b'});
  const restarted=D.checkpoint(JSON.parse(JSON.stringify(delivery.consumer)));
  return {events:count,process:{totalMs:ms(processMs),eventsPerSecond:Math.round(count/(processMs/1000))},
    replay:{totalMs:ms(replayMs),eventsPerSecond:Math.round(count/(replayMs/1000))},
    lag:{initialCheckpoint:initial.checkpoint,initialOutboxLag:initial.lag,finalCheckpoint:after.checkpoint,
      finalOutboxLag:after.lag},twoWorkerLease:{firstClaimed:first.claimed,secondBusy:second.busy===true},
    restart:{checkpoint:restarted.sequence,integrity:restarted.sequence===count},
    cpuMs:{user:ms(cpu.user/1000),system:ms(cpu.system/1000)}};
}
const started=new Date().toISOString(),results=sizes.map(run),report={format:'rtg-loop-fabric-scale-v1',started,
  finished:new Date().toISOString(),node:process.version,method:'current-object-map-linear-scan-and-delivery-state-machine',
  results,delivery:deliveryRun()};
const output=path.join(__dirname,'..','.release','loop-fabric-scale.json');fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
