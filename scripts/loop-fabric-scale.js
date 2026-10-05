#!/usr/bin/env node
/* Meet de huidige minimale Lineage-projectievorm. Dit script simuleert geen
   snellere datastore: het gebruikt dezelfde objectkaart en dezelfde lineaire
   selectie als proof/recall, zodat een capaciteitsgrens zichtbaar blijft. */
'use strict';

const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks');
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
  if (global.gc) global.gc(); const heapBefore=process.memoryUsage().heapUsed,index={},batches=[];let start=performance.now();
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
  return {relations:size,write:{totalMs:ms(writeMs),batch1000Ms:{p50:ms(percentile(batches,.5)),p95:ms(percentile(batches,.95)),
      p99:ms(percentile(batches,.99))}},recallScanMs:{p50:ms(percentile(query,.5)),p95:ms(percentile(query,.95)),
      p99:ms(percentile(query,.99)),matches:found},index:{heapGrowthBytes:heapAfter-heapBefore,estimatedSerializedBytes:estimatedBytes,
      measuredSerializedBytes:serializedBytes},coldStartMs:coldStartMs==null?{status:'not_run',reason:'voorkomt een tweede zeer grote heapkopie'}:ms(coldStartMs),
    rebuild:{ms:ms(rebuildMs),relationsPerSecond:Math.round(size/(rebuildMs/1000)),checksum},
    currentProjectionCapBytes:25*1024*1024,fitsCurrentProjectionCap:estimatedBytes<=25*1024*1024};
}
const started=new Date().toISOString(),results=sizes.map(run),report={format:'rtg-loop-fabric-scale-v1',started,
  finished:new Date().toISOString(),node:process.version,method:'current-object-map-and-linear-scan',results};
const output=path.join(__dirname,'..','.release','loop-fabric-scale.json');fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
