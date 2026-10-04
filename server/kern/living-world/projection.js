'use strict';
const M = require('./model'), A = require('./actions');
module.exports = ({read,time,sources}) => {
  function build(key) {
    const s = read(), at = time();
    const context = sources.context ? sources.context(key) : {items:[],unavailable:[]};
    const known = (row,type) => ({id:row.id,revision:row.revision,status:row.status,
      createdAt:row.createdAt,updatedAt:row.updatedAt,mine:row.owner === key,
      author:sources.name(row.owner),url:M.href(type,row.id),actions:A.forObject(type,row,key,s)});
    const placeVisible = id => s.places[id] && M.visible(s.places[id],key);
    const bpVisible = b => b.owner === key || M.visible(b,key) && placeVisible(b.placeId);
    const contributionVisible = c => c.owner === key || placeVisible(c.placeId) && (
      s.places[c.placeId].owner === key || (c.sharing && c.sharing.visibility || 'community') === 'community'
        && ['accepted','superseded'].includes(c.status));
    function contribution(c) {
      const out = {...known(c,'contribution'),placeId:c.placeId,kind:c.kind,title:c.title,text:c.text,
        observedAt:c.observedAt,validUntil:c.validUntil,basis:c.basis,
        current:s.places[c.placeId].status === 'published' && M.activeKnowledge(c,at,s),
        supersedes:c.supersedes,supersededBy:c.supersededBy || null,
        visibility:c.sharing && c.sharing.visibility || 'community',
        purpose:c.sharing && c.sharing.purpose || 'world-memory',
        contests:M.clone(c.contests || []),verificationOf:M.clone(c.verificationOf),assessment:c.assessment || null,
        review:c.review ? {by:sources.name(c.review.by),at:c.review.at,reason:c.review.reason} : null,
        adoptedVersion:c.adoptedVersion || null,blueprintId:c.blueprintId};
      if (c.owner === key) out.impact = contributionImpact(c);
      if (c.owner === key) out.treatmentUpdates = Object.values(s.returns || {}).filter(x=>x.observationId===c.id)
        .map(x=>M.clone(x));
      return out;
    }
    function contributionImpact(c) {
      const plans = Object.values(s.plans).filter(p => p.owner !== c.owner && p.consentImpact &&
        p.knowledge.some(r => r.id === c.id) && !['cancelled','declined'].includes(p.status));
      const completed = plans.filter(p => p.status === 'completed' && p.acknowledgedAt && !p.participation.revokedAt);
      const returned = Object.values(s.contributions).filter(n => n.owner !== c.owner &&
        n.status === 'accepted' && completed.some(p => p.id === n.planId));
      return {usedInPlans:new Set(plans.map(p=>p.owner)).size,
        confirmedParticipants:new Set(completed.map(p=>p.owner)).size,
        returnedContributions:returned.length,views:null,
        basis:'Vrijwillig gekoppelde plannen; deelname bevestigd door organisator en deelnemer.',
        withdrawn:c.status === 'withdrawn'};
    }
    function place(p) {
      const out = {...known(p,'place'),title:p.title,area:p.area,description:p.description};
      if (M.visible(p,key)) out.actions = out.actions.concat(
        A.allowed('blueprint.create',p,key,s) ? [{id:'blueprint.create',intent:'living-world.blueprint.create',label:'Ervaring maken'}] : []);
      out.memory = Object.values(s.contributions).filter(c=>c.placeId === p.id && contributionVisible(c))
        .sort((a,b)=>b.observedAt.localeCompare(a.observedAt)).map(contribution);
      return out;
    }
    function bp(b) {
      const value = M.snapshot(b); let media = null;
      try { if(value.mediaRef) media = sources.media(b.owner,value.mediaRef,key); }
      catch(e) { if(!context.unavailable.includes('media'))context.unavailable.push('media'); }
      const improvements = (value.improvements || []).map(r=>s.contributions[r.id])
        .filter(c=>c && contributionVisible(c) && M.activeKnowledge(c,at,s)).map(contribution);
      const derived = b.derivedFrom && s.blueprints[b.derivedFrom.id];
      return {...known(b,'blueprint'),...M.clone(value),author:sources.name(b.owner),
        placeId:b.placeId,organizer:sources.name(b.organizer),version:b.version,
        sourceWithdrawn:s.places[b.placeId].status !== 'published',
        mediaRef:media ? value.mediaRef : '',media:media ? media.public : null,
        mediaUnavailable:!!value.mediaRef && !media,
        mediaChanged:!!media && media.version !== value.mediaVersion,
        improvements,derivedFrom:derived && bpVisible(derived) ? {id:derived.id,
          version:b.derivedFrom.version,title:M.snapshot(derived).title,author:sources.name(derived.owner)} : null,
        steps:value.steps.map(step=>({...step,label:M.STEPS[step.kind][0],url:M.STEPS[step.kind][1]}))};
    }
    function plan(p) {
      const b = s.blueprints[p.blueprintId], place = s.places[p.placeId];
      const pinned = b.versions.find(v=>v.version === p.blueprintVersion);
      return {...known(p,'plan'),title:p.title,date:p.date,notes:p.notes,preparation:p.preparation,
        placeId:p.placeId,blueprintId:p.blueprintId,blueprintVersion:p.blueprintVersion,
        organizer:sources.name(p.organizer),participant:sources.name(p.owner),isOrganizer:p.organizer === key,
        consentImpact:p.consentImpact,acknowledgedAt:p.acknowledgedAt || null,
        knowledge:M.clone(p.knowledge),
        connections:(p.connections || []).map(r=>{
          if(p.owner !== key)return {private:true,title:'Privéonderdeel van de deelnemer'};
          const source=context.items.find(x=>x.id === r.id);
          return source ? {...source,changed:source.version !== r.version,private:true}
            : {id:r.id,title:'Brononderdeel niet beschikbaar in het actuele overzicht',unavailable:true,private:true};
        }),
        sourceChanged:b.version !== p.blueprintVersion,sourceWithdrawn:b.status !== 'published' || place.status !== 'published',
        requirements:pinned.requirements,steps:pinned.steps.map(step=>({...step,label:M.STEPS[step.kind][0],url:M.STEPS[step.kind][1]})),
        participation:p.participation ? {...p.participation,by:sources.name(p.participation.by)} : null,
        issue:p.issue ? {...p.issue,owner:sources.name(p.issue.owner)} : null,
        decision:p.decision ? {...p.decision,by:sources.name(p.decision.by)} : null,
        resolution:p.resolution ? {...p.resolution,by:sources.name(p.resolution.by)} : null,
        knowledgeChanged:p.knowledge.some(r=>!s.contributions[r.id] ||
          !M.activeKnowledge(s.contributions[r.id],at,s) || s.contributions[r.id].revision !== r.revision)};
    }
    const places = Object.values(s.places).filter(p=>M.visible(p,key)).map(place);
    const blueprints = Object.values(s.blueprints).filter(bpVisible).map(bp);
    const plans = Object.values(s.plans).filter(p=>p.owner === key ||
      (p.organizer === key && p.status !== 'planning')).map(plan);
    const contributions = Object.values(s.contributions).filter(contributionVisible).map(contribution);
    const pulse = contributions.filter(c=>c.current).map(c=>({id:c.id,type:c.kind,title:c.title,
      placeId:c.placeId,observedAt:c.observedAt,validUntil:c.validUntil,url:c.url,source:'community-reviewed'}))
      .sort((a,b)=>b.observedAt.localeCompare(a.observedAt));
    return {ok:true,asOf:at,places,blueprints,plans,contributions,pulse,context,
      graph:blueprints.map(b=>({from:M.ref('blueprint',b.id),relation:'located_at',
        to:M.ref('place',b.placeId),sourceVersion:b.version,observedAt:at,visibility:b.status})),
      capabilities:{paymentsRequired:false,aiRequired:false,pushRequired:false,
        liveTracking:false,viewsMeasured:false},
      createActions:[{id:'place.create',intent:'living-world.place.create',label:'Plek toevoegen'}]};
  }
  function view(key,options={}) {
    const out = build(key);
    if (options.mediaRef) out.blueprints = out.blueprints.filter(b=>b.mediaRef === options.mediaRef);
    const filters = {place:'places',blueprint:'blueprints',plan:'plans',contribution:'contributions'};
    for (const [param,kind] of Object.entries(filters)) if (options[param] &&
      !out[kind].some(x=>x.id === options[param])) return {status:404,error:'Dit onderdeel is niet beschikbaar.'};
    return out;
  }
  const saloon = require('./saloon')(build);
  function mediaLinks(key,id) { return build(key).blueprints.filter(b=>b.mediaRef === id && b.status === 'published'); }
  return {view,saloon,mediaLinks};
};
