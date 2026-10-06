#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'),OUT=path.join(ROOT,'RTG-LEARNING-CONSTITUTION.json');
const constitution=require('../server/kern/loop-fabric/constitution');
function build(){return {kind:'RTG_LEARNING_CONSTITUTION',...constitution.manifest(),
  enforcement:{eligibility:'server/kern/loop-fabric/learning-eligibility.js',
    projection:'server/kern/loop-fabric/invariants.js',coverage:'scripts/loop-fabric-coverage.js',
    tests:['test/loop-fabric-constitution.test.js','test/loop-fabric-learning-eligibility.test.js','test/loop-fabric-architecture-gate.test.js']}};}
function main(){const next=JSON.stringify(build(),null,2)+'\n';if(process.argv.includes('--controle')){if(!fs.existsSync(OUT)||fs.readFileSync(OUT,'utf8')!==next){console.error('RTG-LEARNING-CONSTITUTION.json loopt achter.');process.exit(1);}console.log('RTG Learning Constitution is gelijk aan de runtimebron.');return;}fs.writeFileSync(OUT,next);console.log('RTG-LEARNING-CONSTITUTION.json geschreven.');}
if(require.main===module)main();module.exports={build,OUT};
