#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'),OUT=path.join(ROOT,'LOOP-FABRIC-SOURCE-FLOWS.json');
const {FLOWS}=require('./lib/loop-fabric-source-flow-policy');
function build(){
  const coverage=require(path.join(ROOT,'LOOP-FABRIC-COVERAGE.json'));
  const b01=new Set(coverage.capabilities.filter(x=>x.execution.batchId==='B01_PROVEN_CLOSURE').map(x=>x.id));
  const rows=FLOWS.map(x=>({...x}));
  const summary={GO:rows.filter(x=>x.status==='GO').length,PHASE:rows.filter(x=>x.status==='PHASE').length,
    STOP:rows.filter(x=>x.status==='STOP').length};
  return {schemaVersion:1,kind:'RTG_LOOP_FABRIC_SOURCE_FLOW_REGISTRY',sourceOfTruth:false,
    warning:'Flowstatus geeft geen nieuw recht. De brondomeinen blijven eigenaar en alleen een volledige GO-flow mag runtime worden aangesloten.',
    batch:'B01_PROVEN_CLOSURE',capabilities:[...b01].sort(),summary,flows:rows};
}
function main(){const next=JSON.stringify(build(),null,2)+'\n';if(process.argv.includes('--controle')){
  const old=fs.existsSync(OUT)?fs.readFileSync(OUT,'utf8'):'';if(old!==next){console.error('LOOP-FABRIC-SOURCE-FLOWS.json loopt achter.');process.exit(1);}
  console.log('Loop Fabric source flows zijn gelijk aan de bron.');return;}fs.writeFileSync(OUT,next);console.log('LOOP-FABRIC-SOURCE-FLOWS.json geschreven.');}
if(require.main===module)main();module.exports={build,OUT};
