'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {integrity,stable} = require('../../scripts/lib/experience/artifact');
const {sha} = require('../../scripts/lib/experience/evidence');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'rtg-experience-proof-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const write = (name,body) => { fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true}); fs.writeFileSync(path.join(root,name),body); };
  write('test/sample.js','// fixture test source\n');
  const tap = 'ok 1 - visible\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
  const configuration = {browser:'chromium',viewport:{width:390,height:844}};
  const binding = {subjectType:'app',subjectId:'app:test',dimension:'identity',requirement:'signature',
    sourceHash:'source',commit:'candidate',configurationHash:sha(JSON.stringify(stable(configuration))),method:'browser'};
  const body = {version:1,worktreeDirty:false,...binding,configuration,at:new Date().toISOString(),instrument:'test/sample.js',
    checks:[{id:'visible',observed:true,expected:true,passed:true}],result:'passed'};
  const diagnostic = {version:1,instrument:body.instrument,...binding,checks:body.checks,result:body.result};
  const log = tap + '# RTG_EXPERIENCE_OBSERVATION ' + JSON.stringify(diagnostic) + '\n';
  write('artifacts/experience/run.tap',log);
  body.log = {path:'artifacts/experience/run.tap',sha256:sha(log),exitCode:0};
  const record = {...binding,worktreeDirty:false,status:'PROVEN',artifact:'artifacts/experience/proof.json'};
  function save() {const text=JSON.stringify(body);write(record.artifact,text);record.artifactHash=sha(text);}
  save();
  const context = {root,subjectType:binding.subjectType,subjectId:binding.subjectId,requirement:binding.requirement,configurationHash:binding.configurationHash};
  return {root,write,body,record,context,configuration,diagnostic,tap,save,check:()=>integrity(record,'source','candidate','identity',context)};
}

module.exports = {fixture};
