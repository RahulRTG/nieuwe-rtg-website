'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,driver,grant}=require('./lib/library-fixture');
const {maakLeerhuis}=require('../server/kern/leerhuis');

const ORG='ACADEMY';const CONTEXT='internal-history';
async function setup(){
  const f=fixture(),d=driver(f.raw,f.query),base=await d.setup(),editionId=await d.edition();
  await d.consent(d.A,editionId);await d.consent(d.B,editionId);await d.release(editionId);
  const educationGrantIds=[];for(const holder of [d.A,d.B])educationGrantIds.push((await d.command(holder,'rights.grant',grant(base.workId,holder,d.A,{
    scope:{type:'edition-nodes',id:editionId,nodeIds:[base.nodeId]},actions:['education'],
    purpose:`education.internal:${ORG}:${CONTEXT}`,conditions:{attributionRequired:true}}))).result.id);
  const release=await d.command(d.A,'education.release',{editionId,nodeIds:[base.nodeId],academyOrganization:ORG,
    academyContext:CONTEXT,citation:'Geschiedenis van IJmuiden, Edition 1, hoofdstuk De haven.',attribution:'Auteur A en Illustrator B'});
  const toets=(releaseRef,academyOrganization,academyContext)=>f.library.education.resolve({releaseRef,academyOrganization,academyContext});
  const academy=maakLeerhuis({db:f.db,save:()=>{},nu:()=>Date.parse('2026-10-05T10:00:00.000Z'),educationReleaseToets:toets});
  assert.equal(academy.doe(ORG,'orgOpen',{id:ORG,soort:'RTG',naam:'Interne Academy',eigenaar:'lid:1'},'lid:1',{sleutel:'academy-open-0001'}).ok,true);
  assert.equal(academy.doe(ORG,'relatieZet',{persoon:'lid:2',soort:'EMPLOYEE'},'lid:1',{sleutel:'academy-rel-00001'}).ok,true);
  assert.equal(academy.doe(ORG,'bestuurZet',{persoon:'lid:2',rol:'CURRICULUM_OWNER',aan:true},'lid:1',{sleutel:'academy-role-0001'}).ok,true);
  return {f,d,base,editionId,releaseRef:release.result.releaseRef,releaseInput:release.input,educationGrantIds,academy};
}
function importCurriculum(x,id='history-course',releaseRef=x.releaseRef,context=CONTEXT,key='academy-import-0001'){
  return x.academy.doe(ORG,'curriculumUitLibrary',{id,titel:'Lokale geschiedenis',releaseRef,academyContext:context,
    vaardigheden:[],kennis:[],fasen:[{fase:'UNDERSTAND',wat:'Lees de geselecteerde bron.'}]},'lid:2',{sleutel:key});
}

test('Library Edition X wordt als begrensde EducationRelease in exact één Academy-curriculumversie gebruikt',async()=>{
  const x=await setup(),before=JSON.stringify((await x.d.work()).editions[x.editionId].snapshot);
  const imported=importCurriculum(x);assert.equal(imported.ok,true,JSON.stringify(imported));
  const c=x.academy.stand(ORG).curricula['history-course'];
  assert.equal(c.versie,1);assert.deepEqual(c.libraryRelease.releaseRef,x.releaseRef);
  assert.deepEqual(c.libraryRelease.contentNodes.map(n=>n.nodeId),[x.base.nodeId]);
  const used=x.academy.doe(ORG,'curriculumLibraryUse',{id:c.id,curriculumVersion:1},'lid:2',{sleutel:'academy-use-000001'});
  assert.equal(used.ok,true,JSON.stringify(used));assert.equal(x.academy.stand(ORG).educationUses.length,1);
  assert.equal(JSON.stringify((await x.d.work()).editions[x.editionId].snapshot),before);
  const feedback=await x.d.command(x.d.A,'feedback.create',{editionId:x.editionId,nodeId:x.base.nodeId,kind:'clarity',
    message:'De Academy vraagt een duidelijker tijdlijn.',evidenceRefs:[]});
  assert.equal(feedback.result.status,'open');assert.equal((await x.d.work()).nodes[x.base.nodeId].revisions.length,1);
});

test('Edition, ContentNode, Academy-context, attribution, derivatives en AI blijven fail-closed',async()=>{
  const x=await setup(),work=await x.d.work();
  assert.equal(importCurriculum(x,'wrong-context',x.releaseRef,'public-course','academy-import-0002').ok,false);
  const input=await x.d.input('education.release',{editionId:x.editionId,nodeIds:['missing-node'],academyOrganization:ORG,
    academyContext:CONTEXT,citation:'Citaat',attribution:'Credits'});
  assert.equal((await x.f.raw(x.d.A,'education.release',input)).code,'EDUCATION_NODE_SCOPE');
  for(const extra of [{attribution:''},{aiScopes:['training']},{aiScopes:['assistance']},{derivativeScope:'allowed'}]){
    const body=await x.d.input('education.release',{editionId:x.editionId,nodeIds:[x.base.nodeId],academyOrganization:ORG,
      academyContext:CONTEXT,citation:'Citaat',attribution:'Credits',...extra});
    assert.ok(['INVALID_INPUT'].includes((await x.f.raw(x.d.A,'education.release',body)).code));
  }
  assert.equal(work.educationReleases[x.releaseRef.id].versions[0].snapshot.derivativeScope,'denied');
  assert.deepEqual(work.educationReleases[x.releaseRef.id].versions[0].snapshot.aiScopes,[]);
});

test('een nieuwe Library Edition erft geen onderwijsrelease of onderwijsrecht en authority wordt bij commit herzien',async()=>{
  const x=await setup();
  await x.d.command(x.d.A,'revision.add',{nodeId:x.base.nodeId,kind:'chapter',title:'De haven',content:'Nieuwe editie-inhoud.',changeSummary:'Nieuwe inhoud.'});
  const e2=await x.d.edition(x.editionId);await x.d.consent(x.d.A,e2);await x.d.consent(x.d.B,e2);await x.d.release(e2);
  const attempt=await x.d.input('education.release',{editionId:e2,nodeIds:[x.base.nodeId],academyOrganization:ORG,
    academyContext:CONTEXT,citation:'Nieuwe editie.',attribution:'Auteur A en Illustrator B'});
  assert.equal((await x.f.raw(x.d.A,'education.release',attempt)).code,'EDUCATION_RIGHTS_MISSING');
  const withdraw=await x.d.input('education.withdraw',{releaseId:x.releaseRef.id,reason:'Stop.'});
  x.f.authority(false);
  assert.equal((await x.f.raw(x.d.A,'education.withdraw',withdraw)).code,'AUTHORITY_REVOKED');
  x.f.authority(true);assert.equal((await x.d.work()).educationReleases[x.releaseRef.id].currentVersion,1);
});

test('ingetrokken Library-rechten of Academy-authority blokkeren nieuw gebruik',async()=>{
  const x=await setup();assert.equal(importCurriculum(x).ok,true);
  await x.d.command(x.d.B,'rights.revoke',{grantId:x.educationGrantIds[1],reason:'Onderwijsrecht ingetrokken.'});
  let use=x.academy.doe(ORG,'curriculumLibraryUse',{id:'history-course',curriculumVersion:1},'lid:2',{sleutel:'academy-revoked-right'});
  assert.equal(use.ok,false);assert.match(use.reden,/rechten ontbreken/);
  const y=await setup();assert.equal(importCurriculum(y).ok,true);
  assert.equal(y.academy.doe(ORG,'bestuurZet',{persoon:'lid:2',rol:'CURRICULUM_OWNER',aan:false},'lid:1',{sleutel:'academy-revoke-role'}).ok,true);
  use=y.academy.doe(ORG,'curriculumLibraryUse',{id:'history-course',curriculumVersion:1},'lid:2',{sleutel:'academy-no-role-use'});
  assert.equal(use.ok,false);assert.match(use.reden,/CURRICULUM_OWNER/);
});

test('withdrawal blokkeert nieuw gebruik en nieuwe curriculumversies maar bewaart historische auditcontext',async()=>{
  const x=await setup();assert.equal(importCurriculum(x).ok,true);
  const historical=JSON.stringify(x.academy.stand(ORG).curricula['history-course'].libraryRelease);
  const withdrawn=await x.d.command(x.d.A,'education.withdraw',{releaseId:x.releaseRef.id,reason:'Onderwijsgebruik ingetrokken.'});
  assert.equal(withdrawn.result.withdrawnVersion,1);
  const use=x.academy.doe(ORG,'curriculumLibraryUse',{id:'history-course',curriculumVersion:1},'lid:2',{sleutel:'academy-use-after-withdraw'});
  assert.equal(use.ok,false);assert.match(use.reden,/niet meer actueel|ingetrokken/);
  const next=importCurriculum(x,'history-course',x.releaseRef,CONTEXT,'academy-import-after-withdraw');assert.equal(next.ok,false);
  assert.equal(JSON.stringify(x.academy.stand(ORG).curricula['history-course'].libraryRelease),historical);
  assert.equal(x.academy.stand(ORG).educationUses.length,0);
});

test('release is idempotent, edition-bound en tenant-bound',async()=>{
  const x=await setup(),release=await x.d.work(),row=release.educationReleases[x.releaseRef.id];
  const replay=await x.f.raw(x.d.A,'education.release',x.releaseInput);assert.equal(replay.ok,true);assert.equal(replay.replay,true);
  assert.equal(importCurriculum(x,'cross-tenant',x.releaseRef,CONTEXT,'academy-import-tenant').ok,true);
  const other=maakLeerhuis({db:x.f.db,save:()=>{},educationReleaseToets:(ref,org,ctx)=>x.f.library.education.resolve({releaseRef:ref,academyOrganization:org,academyContext:ctx})});
  assert.equal(other.doe('OTHER','orgOpen',{id:'OTHER',soort:'RTG',naam:'Andere Academy',eigenaar:'lid:1'},'lid:1',{sleutel:'other-open-000001'}).ok,true);
  assert.equal(other.doe('OTHER','relatieZet',{persoon:'lid:2',soort:'EMPLOYEE'},'lid:1',{sleutel:'other-rel-0000001'}).ok,true);
  assert.equal(other.doe('OTHER','bestuurZet',{persoon:'lid:2',rol:'CURRICULUM_OWNER',aan:true},'lid:1',{sleutel:'other-role-000001'}).ok,true);
  const denied=other.doe('OTHER','curriculumUitLibrary',{id:'course',titel:'X',releaseRef:x.releaseRef,academyContext:CONTEXT,
    vaardigheden:[],kennis:[],fasen:[]},'lid:2',{sleutel:'other-import-00001'});
  assert.equal(denied.ok,false);assert.match(denied.reden,/niet voor deze Academy-context/);
  assert.equal(row.editionId,x.editionId);
});
