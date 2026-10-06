'use strict';
const {LEERFASEN}=require('./standen');
const {weiger,eisId,eisBestuur}=require('./hulp');
const tekst=(x,n)=>String(x==null?'':x).slice(0,n||200);
const lijst=x=>Array.isArray(x)?[...new Set(x.map(String))]:[];

function resolve(st,i,door,ctx){
  eisBestuur(st,door,['CURRICULUM_OWNER'],'Library-inhoud in een curriculum gebruiken');
  if(typeof ctx.educationReleaseToets!=='function')weiger('Library EducationRelease-validatie is niet beschikbaar',503);
  const result=ctx.educationReleaseToets(i.releaseRef,st.org.id,String(i.academyContext||''),door);
  if(!result||result.ok!==true)weiger((result&&result.error)||'De Library EducationRelease kon niet worden bevestigd.',(result&&result.status)||403);
  return result.release;
}
module.exports={
  curriculumUitLibrary(st,i,door,ctx){
    eisId(i.id,'curriculum');const oud=st.curricula[i.id];
    if(oud&&!['DRAFT','IMPROVEMENT','ACTIVE','MONITORED'].includes(oud.stand))
      weiger('curriculum '+i.id+' staat op '+oud.stand+' en krijgt geen nieuwe versie',409);
    const source=resolve(st,i,door,ctx);
    if(source.derivativeScope!=='denied'||source.aiScopes.length||source.economics!=='free'||source.futureEditions!==false)
      weiger('Deze eerste Library-release ondersteunt alleen gratis verwijzing zonder derivatives of AI.',409);
    for(const v of lijst(i.vaardigheden))if(!st.vaardigheden[v])weiger('vaardigheid '+v+' bestaat niet',404);
    for(const k of lijst(i.kennis))if(!st.kennis[k])weiger('kennisitem '+k+' bestaat niet',404);
    for(const f of i.fasen||[])if(!LEERFASEN.includes(f.fase))weiger('leerfase: '+LEERFASEN.join(', '),400);
    return [{soort:'curriculum',data:{id:i.id,titel:tekst(i.titel,120),vaardigheden:lijst(i.vaardigheden),
      kennis:lijst(i.kennis),fasen:(i.fasen||[]).map(f=>({fase:f.fase,wat:tekst(f.wat,300)})),vereist:[],
      libraryRelease:{releaseRef:source.releaseRef,editionRef:source.editionRef,contentNodes:source.contentNodes,
        academyContext:source.academyContext,citation:source.citation,attribution:source.attribution,
        sourceSnapshotHash:source.sourceSnapshotHash}}}];
  },
  curriculumLibraryUse(st,i,door,ctx){
    eisBestuur(st,door,['CURRICULUM_OWNER'],'Library-inhoud gebruiken');
    const c=st.curricula[i.id];if(!c||!c.libraryRelease)weiger('Dit curriculum verwijst niet naar een Library EducationRelease.',404);
    if(i.curriculumVersion!==c.versie)weiger('Gebruik exact de actuele curriculumversie.',409);
    const source=resolve(st,{releaseRef:c.libraryRelease.releaseRef,academyContext:c.libraryRelease.academyContext},door,ctx);
    return [{soort:'libraryEducationUse',data:{id:ctx.id(),curriculum:c.id,curriculumVersion:c.versie,
      releaseRef:source.releaseRef,editionRef:source.editionRef,contentNodeIds:source.contentNodes.map(x=>x.nodeId),
      citation:source.citation,attribution:source.attribution,purpose:'internal-academy-education'}}];
  }
};
