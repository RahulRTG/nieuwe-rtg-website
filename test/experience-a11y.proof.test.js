'use strict';

/* Adapter van de bestaande volledige a11y-scan naar EXPERIENCEWERKT. Zonder
   bewijsomgeving is dit een goedkope contracttest. Alleen de Experience-
   executor start de echte scan en kan daardoor procesgebonden receipts maken. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const artifact=require('../scripts/lib/experience/artifact');
const evidence=require('../scripts/lib/experience/evidence');
const coverage=require('../scripts/lib/experience/coverage');
const a11y=require('../scripts/lib/experience/a11y');

const ROOT=path.join(__dirname,'..');
const sourceHash=process.env.RTG_EXPERIENCE_SOURCE;
const commit=process.env.RTG_EXPERIENCE_COMMIT;
const canonical=value=>JSON.stringify(artifact.stable(value));
const screens=coverage.screenInventory(ROOT).sort((a,b)=>a.route.localeCompare(b.route));

if(!sourceHash&&!commit) {
  test('Experience-a11yproducer is exact aan de actuele scherminventaris',()=>{
    assert.equal(screens.length,316);
    assert.equal(new Set(screens.map(row=>row.route)).size,screens.length);
    assert.deepEqual(a11y.expected().states.uitgelogd,{structural:0,contrast:0});
  });
} else {
  assert.match(sourceHash,/^[a-f0-9]{64}$/);
  assert.match(commit,/^[a-f0-9]{40}$/);
  const map=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-experience-a11y-'));
  const meting=path.join(map,'meting.json');
  const run=cp.spawnSync(process.execPath,['scripts/a11y.js','--meting='+meting],{
    cwd:ROOT,env:{...process.env,A11Y_STRICT:'1'},encoding:'utf8',timeout:42*60*1000,maxBuffer:64*1024*1024
  });
  test.after(()=>fs.rmSync(map,{recursive:true,force:true}));
  test('volledige a11y-scan leverde een leesbare meting',()=>{
    assert.equal(run.status,0,(run.stdout||'')+'\n'+(run.stderr||'')+(run.error?'\n'+run.error.message:''));
    assert.equal(fs.existsSync(meting),true,'de scan schreef geen meting');
  });
  const measurement=run.status===0&&fs.existsSync(meting)?JSON.parse(fs.readFileSync(meting,'utf8')):{};
  const result=a11y.validate(measurement,screens.map(row=>row.route));
  test('a11y-meting is volledig, routegebonden en zonder contrast- of structuurgebrek',()=>{
    assert.deepEqual(result.blockers,[]);
    assert.equal(result.status,'PROVEN');
  });
  for(const screen of screens) {
    const check='A11y desktop contrast: '+screen.id;
    test(check,t=>{
      assert.deepEqual(result.observations[screen.route],a11y.expected());
      const configuration=a11y.configuration(measurement.browser?.version||'0.0',screen.id);
      const expected=a11y.expected();
      const observation={version:1,instrument:'test/experience-a11y.proof.test.js',
        subjectType:'screen',subjectId:screen.id,dimension:'accessibility',requirement:'desktop@contrast',
        sourceHash,commit,configurationHash:evidence.sha(canonical(configuration)),method:'browser',
        checks:[{id:check,observed:expected,expected,passed:true}],result:'passed'};
      t.diagnostic('RTG_EXPERIENCE_CONFIGURATION '+JSON.stringify(configuration));
      t.diagnostic('RTG_EXPERIENCE_OBSERVATION '+JSON.stringify(observation));
    });
    for(const device of ['mobile-large','tablet']) {
      const requirement=device+'@touch-targets',touchCheck='A11y '+device+' touch targets: '+screen.id;
      test(touchCheck,t=>{
        const expected=a11y.touchExpected();
        assert.deepEqual(result.touchObservations[screen.route]?.[device],expected);
        const configuration=a11y.touchConfiguration(measurement.browser?.version||'0.0',screen.id,device);
        const observation={version:1,instrument:'test/experience-a11y.proof.test.js',
          subjectType:'screen',subjectId:screen.id,dimension:'accessibility',requirement,
          sourceHash,commit,configurationHash:evidence.sha(canonical(configuration)),method:'browser',
          checks:[{id:touchCheck,observed:expected,expected,passed:true}],result:'passed'};
        t.diagnostic('RTG_EXPERIENCE_CONFIGURATION '+JSON.stringify(configuration));
        t.diagnostic('RTG_EXPERIENCE_OBSERVATION '+JSON.stringify(observation));
      });
    }
    if(screen.profile==='interface') for(const device of ['mobile-large','tablet']) {
      const requirement=device+'@normal',layoutCheck='A11y '+device+' layout: '+screen.id;
      test(layoutCheck,t=>{
        const expected=device==='mobile-large'?a11y.mobileLayoutExpected():a11y.tabletLayoutExpected();
        assert.deepEqual(result.layoutObservations[screen.route]?.[device],expected);
        const configuration=a11y.layoutConfiguration(measurement.browser?.version||'0.0',screen.id,device);
        const observation={version:1,instrument:'test/experience-a11y.proof.test.js',
          subjectType:'screen',subjectId:screen.id,dimension:'adaptability',requirement,
          sourceHash,commit,configurationHash:evidence.sha(canonical(configuration)),method:'browser',
          checks:[{id:layoutCheck,observed:expected,expected,passed:true}],result:'passed'};
        t.diagnostic('RTG_EXPERIENCE_CONFIGURATION '+JSON.stringify(configuration));
        t.diagnostic('RTG_EXPERIENCE_OBSERVATION '+JSON.stringify(observation));
      });
    }
  }
}
