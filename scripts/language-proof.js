/* Reproducible access-language evidence. Never turns a locale selector into a
   claim of reviewed translations or natural-language semantic equivalence. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
const files=['test/access-language.e2e.js','test/i18n-dictionary.test.js','test/language-foundations.test.js','test/onboarding.test.js'];
const sources=['public/apps/access/meaning.js','public/apps/access/portal.css','public/apps/app.html','public/apps/app-main.js',
  'public/shared/verbinding.js','public/shared/i18n.js','public/shared/rtg-edge-smart-menu.js','public/shared/rtg-edge-library.js','public/shared/rtg-adaptive-edge-controls.js','public/shared/appshell.js','server/talen.js','server/routes/onboarding.js','server/kern/onboarding/lid.js',
  'test/helper.js','scripts/lib/scherm.js','server/translate/batch-model.js','server/translate.js','server/translate/cache.js','server/translate/uitslag.js','server/kern/taalkeuring.js',
  'server/local-ai.js','server/ai.js','scripts/language-proof.js',...files];
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const fingerprints=()=>Object.fromEntries(sources.map(file=>[file,hash(fs.readFileSync(path.join(root,file)))]));
const names=['LANGUAGECAPABILITY.json','MEANINGPARITY.json','LANGUAGEFAILOVER.json'];
if(process.argv.includes('--check')){
  const current=fingerprints();
  for(const name of names){
    const evidence=JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
    if(evidence.testExitCode!==0 || JSON.stringify(evidence.sources)!==JSON.stringify(current))
      throw new Error(name+' is missing a passing run or is stale. Run npm run language:proof.');
  }
  console.log('The three language reports match the tested source. Scope and unmeasured capabilities remain explicit.');
}else{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-language-proof-'));
  const startedAt=new Date().toISOString(),before=fingerprints();
  try {
    const run=spawnSync(process.execPath,['--test','--test-concurrency=1',...files],{
      cwd:root,env:{...process.env,RTG_LANGUAGE_PROOF_OUTPUT:dir},encoding:'utf8',maxBuffer:16*1024*1024,timeout:300000});
    process.stdout.write(run.stdout || '');process.stderr.write(run.stderr || '');
    if(run.status!==0)throw new Error('Language proof failed; reports were not replaced.');
    const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name+'.json'),'utf8'));
    const browser=read('browser'),meaning=read('meaning'),failover=read('failover');
    if(browser.capabilities.length!==114 || meaning.rows.length!==114)throw new Error('Incomplete language measurement.');
    if(JSON.stringify(before)!==JSON.stringify(fingerprints()))throw new Error('Source changed while evidence was collected.');
    const common={schemaVersion:1,startedAt,completedAt:new Date().toISOString(),node:process.version,
      command:'npm run language:proof',testExitCode:run.status,testOutputSha256:hash((run.stdout || '')+(run.stderr || '')),sources:before,
      productionReady114Languages:false};
    const capability={...common,scope:'RTG member account portal and shared language loader; mobile Chromium, synthetic input.',
      browser:browser.browser,viewport:browser.viewport,
      screenCoverage:{nlEn:['welcome','name','email','date of birth','password','agreement','login','recovery','recovery sent'],
        all114:['signup password step, same input and focus across language changes'],
        otherScreens:'NOT_MEASURED',physicalDevices:'NOT_MEASURED'},
      languages:browser.capabilities.map(row=>({code:row.code,
        render:{status:row.title.trim()&&!row.overflow?'PASS':'FAIL',requested:row.code,actual:row.lang,overflow:row.overflow},
        input:{status:'PASS',method:'programmatic Unicode fill and exact read-back',nativeKeyboardAndIME:'NOT_MEASURED'},
        fonts:{family:row.fontFamily,completeGlyphCoverage:'NOT_MEASURED'},
        formatting:row.formatting,rtl:{actual:row.dir,expected:['ar','he','fa','ur','ps','sd','ug','yi','dv'].includes(row.code)?'rtl':'ltr'},
        switching:{statePreserved:row.view==='register',focusPreserved:row.focus==='agIn'},
        dynamicText:{present:!!row.title.trim(),quality:'NOT_REVIEWED'},
        edge:{worldsLabel:row.edge,sourceFallback:row.code!=='nl'&&row.code!=='en'},
        criticalCopy:{source:['nl','en'].includes(row.code)?row.code:'en',modelGenerated:false,
          fallbackNotice:!['nl','en'].includes(row.code),legalConfirmationEnabled:['nl','en'].includes(row.code)},
        translationReadiness:['nl','en'].includes(row.code)?'CODE_CONTROLLED_SOURCE_COPY':'MODEL_DEPENDENT_WITH_EXPLICIT_CRITICAL_FALLBACK'})),
      limitations:['No native-speaker certification for all 114 languages.','The agreement remains its Dutch source text.',
        'Browser Intl may resolve to another locale; resolved locales are recorded, not hidden.',
        'Long dictionary strings over 300 characters and uncatalogued domain/server text are not proven translated.',
        'Payment, mandate and other application domains have not been migrated by this account-portal change.']};
    const parity={...common,...meaning,meaningVersion:1,
      evidenceKinds:['Eight typed, versioned account bindings compared for each of 114 presentation locales.',
        'Unknown IDs/versions/parameters and invalid consent rejected.',
        'Browser account creation and agreement run through real existing server handlers in Dutch/English.',
        'Server rejects absent, malformed or stale contract versions without signing.'],
      limits:['The 912 binding comparisons do not establish 912 human utterance translations.',
        'Authority remains in the existing server handlers; this module does not grant capabilities.']};
    const failure={...common,...failover,browser:{translationEndpoint:'echo plus explicit abort fixture',
      shellSurvived:true,all114ChoicesAvailableWithoutLanguageAPI:true,privateInputExcluded:browser.privateInputExcluded,
      unknownCriticalFallbackVisible:browser.criticalFallbackVisible,unsupportedLegalBlocked:browser.unsupportedLegalBlocked,errors:browser.errors},
      limits:['Synthetic loopback model fixture, not a real model-quality evaluation or production outage.',
        'Full service-worker offline journeys and physical passkey devices are outside this report.']};
    [capability,parity,failure].forEach((report,i)=>fs.writeFileSync(path.join(root,names[i]),JSON.stringify(report,null,2)+'\n'));
    console.log('Wrote '+names.join(', ')+'. Full 114-language production readiness remains false.');
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
}
