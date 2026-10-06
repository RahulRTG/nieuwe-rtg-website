'use strict';
const M=require('./model'),P=require('./policy'),R=require('./rights');
const {intact}=require('./editions');

const ref=row=>({domain:'library',type:'education-release',id:row.id,version:row.currentVersion});
function latest(row){return row.versions.at(-1);}
function activeVersion(row){const v=latest(row);return v&&v.status==='active'?v:null;}
function requirements(w,e,nodeIds,academyOrganization,academyContext,at){
  const agreement=P.agreement(w),missingRights=R.missingEducation(w,e,nodeIds,agreement,academyOrganization,academyContext,at);
  return {agreement,missingRights};
}
function educationCommand(ctx){
  const {w,data:d,action,id,at,actor}=ctx;
  if(action==='education.release'){
    M.fields(d,['editionId','nodeIds','academyOrganization','academyContext','citation','attribution']);
    P.publisher(ctx);const e=M.get(w.editions,d.editionId);intact(e);
    if(e.status!=='released'||e.distribution.status!=='released')
      M.fail('EDITION_NOT_AVAILABLE','Alleen een actuele vrijgegeven Edition kan voor onderwijs worden vrijgegeven.',409);
    const nodeIds=M.strings(d.nodeIds),available=new Set(e.snapshot.content.map(x=>x.nodeId));
    if(!nodeIds.length||nodeIds.some(nodeId=>!available.has(nodeId)))
      M.fail('EDUCATION_NODE_SCOPE','De release bevat alleen geselecteerde inhoudsankers uit exact deze Edition.',409);
    const academyOrganization=M.text(d.academyOrganization,60),academyContext=M.text(d.academyContext,120);
    const citation=M.text(d.citation,500),attribution=M.text(d.attribution,500);
    const needed=requirements(w,e,nodeIds,academyOrganization,academyContext,at);
    if(needed.missingRights.length)M.fail('EDUCATION_RIGHTS_MISSING','Onderwijsrechten ontbreken voor: '+needed.missingRights.join(', '),409);
    const snapshot={editionRef:{domain:'library',type:'edition',id:e.id,version:e.snapshotHash},workId:w.id,
      contentNodes:nodeIds.map(nodeId=>{const n=e.snapshot.content.find(x=>x.nodeId===nodeId);return {nodeId,revisionHash:n.revision.hash};}),
      academyOrganization,academyContext,economics:'free',citationRequired:true,attributionRequired:true,citation,attribution,
      derivativeScope:'denied',aiScopes:[],futureEditions:false,language:e.language,territory:e.territory,
      rightsGrantIds:Object.values(w.grants).filter(g=>R.educationApplicable(g,e,nodeIds,needed.agreement.publisher,
        academyOrganization,academyContext,at)).map(g=>g.id).sort()};
    const version={version:1,status:'active',snapshot,snapshotHash:M.hash(snapshot),createdAt:at,createdBy:actor};
    w.educationReleases[id]={id,workId:w.id,editionId:e.id,currentVersion:1,versions:[version]};
    return {id,releaseRef:ref(w.educationReleases[id]),snapshotHash:version.snapshotHash};
  }
  if(action==='education.withdraw'){
    M.fields(d,['releaseId','reason']);P.publisher(ctx);const row=M.get(w.educationReleases,d.releaseId),current=activeVersion(row);
    if(!current)M.fail('INVALID_STATE','Deze EducationRelease is niet actief.',409);
    const next={version:row.currentVersion+1,status:'withdrawn',supersedes:row.currentVersion,
      reason:M.text(d.reason,2000),createdAt:at,createdBy:actor,snapshotHash:current.snapshotHash};
    row.versions.push(next);row.currentVersion=next.version;
    return {id:row.id,releaseRef:ref(row),withdrawnVersion:current.version};
  }
  M.fail('UNKNOWN_ACTION','Onbekende onderwijsreleasehandeling.');
}

function resolver({read,time}){
  return function resolve(value){
    try{
      M.fields(value,['releaseRef','academyOrganization','academyContext']);
      const releaseRef=value.releaseRef;
      if(!releaseRef||releaseRef.domain!=='library'||releaseRef.type!=='education-release'||!Number.isSafeInteger(releaseRef.version))
        M.fail('INVALID_RELEASE_REF','Een exacte Library EducationRelease is vereist.',400);
      const s=read();let w,row;
      for(const candidate of Object.values(s.works)){if(candidate.educationReleases&&candidate.educationReleases[releaseRef.id]){w=candidate;row=candidate.educationReleases[releaseRef.id];break;}}
      if(!row)M.fail('RELEASE_NOT_FOUND','De EducationRelease bestaat niet.',404);
      if(row.currentVersion!==releaseRef.version)M.fail('RELEASE_SUPERSEDED','Deze EducationRelease-versie is niet meer actueel.',410);
      const version=activeVersion(row);if(!version)M.fail('RELEASE_WITHDRAWN','De EducationRelease is ingetrokken.',410);
      const snapshot=version.snapshot;
      if(snapshot.academyOrganization!==value.academyOrganization||snapshot.academyContext!==value.academyContext)
        M.fail('RELEASE_AUDIENCE_DENIED','De EducationRelease geldt niet voor deze Academy-context.',403);
      const e=M.get(w.editions,row.editionId);intact(e);
      if(e.status!=='released'||e.distribution.status!=='released')M.fail('SOURCE_UNAVAILABLE','De Library Edition is niet beschikbaar.',410);
      const needed=requirements(w,e,snapshot.contentNodes.map(x=>x.nodeId),snapshot.academyOrganization,snapshot.academyContext,time());
      if(needed.missingRights.length)M.fail('EDUCATION_RIGHTS_REVOKED','Actuele onderwijsrechten ontbreken.',403);
      return {ok:true,release:{releaseRef:ref(row),editionRef:M.clone(snapshot.editionRef),workId:w.id,
        contentNodes:M.clone(snapshot.contentNodes),academyOrganization:snapshot.academyOrganization,
        academyContext:snapshot.academyContext,citation:snapshot.citation,attribution:snapshot.attribution,
        economics:snapshot.economics,derivativeScope:snapshot.derivativeScope,aiScopes:[],futureEditions:false,
        sourceSnapshotHash:version.snapshotHash}};
    }catch(e){return e.library?{ok:false,status:e.status,code:e.code,error:e.message}:{ok:false,status:503,code:'OUTCOME_UNKNOWN',error:'De bron kon niet worden bevestigd.'};}
  };
}
module.exports={command:educationCommand,resolver,ref};
