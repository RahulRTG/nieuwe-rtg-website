'use strict';
const assert = require('node:assert/strict');
const make = require('../../server/kern/living-world');
const spec = () => ({title:'North Sea Wreck Day',summary:'Een gezamenlijk voorbereide ervaring.',
  activity:'Duiken',route:'Haven naar wrak en terug',season:'In overleg met organisator',
  equipment:'Door organisator te controleren',transport:'Boot',crew:'Kleine groep',
  requirements:['Organisator controleert geschiktheid voor deze uitvoering'],
  steps:[{kind:'learn',text:'Bespreek uw voorbereiding'},{kind:'equipment',text:'Controleer de uitrusting'}],
  mediaRef:'video:owned',remixAllowed:true});
function fixture(previous) {
  const db = {data:previous || {}};
  let t = '2026-10-01T10:00:00.000Z', seq = 0, failSave = false, media = true, context = {};
  const sources = {name:k=>'Member ' + k,context:key=>context[key] || {items:[],unavailable:[]},media:(owner,id,viewer=owner)=>media && id === 'video:owned' && owner === 'A'
    ? {mine:owner === viewer,shareable:true,version:'media-v1',public:{id,title:'Actionvideo',url:'/apps/media.html#stuk=video:owned'}} : null};
  const world = make({db,save:()=>{if(failSave)throw new Error('storage unavailable');},sources,now:()=>t});
  async function command(key,action,data,receipt) {
    const out = await world.execute(key,action,data,receipt || 'test-receipt-' + (++seq));
    assert.equal(out.ok,true,action + ': ' + JSON.stringify(out));return out.result;
  }
  function row(key,type,id) { return world.view(key)[{place:'places',blueprint:'blueprints',plan:'plans',contribution:'contributions'}[type]].find(x=>x.id === id); }
  async function setup() {
    let p = await command('A','place.create',{title:'IJmuiden',area:'Noord-Holland',description:'De haven en de zee.'});
    await command('A','place.publish',{id:p.id,revision:1});
    let b = await command('A','blueprint.create',{...spec(),placeId:p.id});
    await command('A','blueprint.publish',{id:b.id,revision:1});
    return {placeId:p.id,blueprintId:b.id};
  }
  async function preparePlan(blueprintId,who='B',extra={}) {
    const b = row(who,'blueprint',blueprintId);
    const p = await command(who,'plan.create',{id:b.id,revision:b.revision,...extra});
    await command(who,'plan.update',{id:p.id,revision:1,title:'Mijn wrakdag',
      date:new Date(Date.parse(t)+86400000).toISOString(),notes:'Eigen voorkeur',preparation:['Besproken met organisator'],knowledgeIds:extra.knowledgeIds || []});
    return p.id;
  }
  async function complete(planId,who='B') {
    let p = row(who,'plan',planId);
    await command(who,'plan.request',{id:p.id,revision:p.revision});
    p = row('A','plan',planId);
    await command('A','plan.decide',{id:p.id,revision:p.revision,decision:'accepted',requirementsChecked:true,reason:'Vereisten persoonlijk gecontroleerd.'});
    t = p.date;p = row('A','plan',planId);
    await command('A','plan.start',{id:p.id,revision:p.revision});
    t = new Date(Date.parse(t)+7200000).toISOString();p = row('A','plan',planId);
    await command('A','plan.complete',{id:p.id,revision:p.revision,statement:'Deelnemer heeft de activiteit voltooid.'});
    p = row(who,'plan',planId);
    await command(who,'plan.acknowledge',{id:p.id,revision:p.revision,consentImpact:true});
  }
  return {db,world,command,row,setup,preparePlan,complete,spec,
    clock:v=>{t=v;},time:()=>t,context:v=>{context=v;},failSave:v=>{failSave=v;},media:v=>{media=v;}};
}
module.exports = {fixture,spec};
