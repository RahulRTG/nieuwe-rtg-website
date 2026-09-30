'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {fixture,spec} = require('./lib/living-world-fixture');

test('volledige lus: video, plan, overdracht, deelname, review, nieuwe versie, volgende persoon en impact',async()=>{
  const f=fixture(),{placeId,blueprintId}=await f.setup();
  const discovered=f.world.saloon('B').items.find(x=>x.id === 'livingworld:'+blueprintId);
  assert.equal(discovered.actie,'Take me there');
  assert.equal(f.world.mediaLinks('B','video:owned')[0].id,blueprintId);
  const planId=await f.preparePlan(blueprintId);
  assert.equal(f.world.view('A').plans.length,0,'een privéconcept is niet al een aanvraag');
  await f.complete(planId);
  const c=await f.command('B','contribution.create',{placeId,planId,kind:'knowledge',title:'Handige voorbereiding',
    text:'Spreek de ontmoetingsplek vooraf precies af.',observedAt:'2026-10-02T12:00:00.000Z'});
  assert.equal(f.world.view('C').contributions.length,0,'onbeoordeelde kennis niet als feit publiceren');
  const review=f.row('A','contribution',c.id);
  assert.ok(review.actions.some(a=>a.id==='contribution.review'));
  assert.equal(f.world.saloon('A').items.find(x=>x.id==='livingworld:'+c.id).actie,'Beoordeel bijdrage');
  await f.command('A','contribution.review',{id:c.id,revision:1,decision:'accepted',reason:'Gecontroleerd bij de uitvoering.'});
  const b=f.row('A','blueprint',blueprintId);
  await f.command('A','contribution.adopt',{id:c.id,revision:2,blueprintRevision:b.revision});
  assert.equal(f.row('C','blueprint',blueprintId).version,2);
  assert.equal(f.row('C','blueprint',blueprintId).improvements[0].text,'Spreek de ontmoetingsplek vooraf precies af.');
  assert.equal(f.world.view('C').pulse[0].id,c.id);
  const next=await f.preparePlan(blueprintId,'C',{consentImpact:true,knowledgeIds:[c.id]});
  assert.equal(f.row('B','contribution',c.id).impact.usedInPlans,1);
  assert.equal(f.row('B','contribution',c.id).impact.confirmedParticipants,0);
  await f.complete(next,'C');
  assert.equal(f.row('B','contribution',c.id).impact.confirmedParticipants,1);
  const returned=await f.command('C','contribution.create',{placeId,planId:next,kind:'knowledge',title:'Verbetering terug',
    text:'Ook de aankomsttijd gezamenlijk afspreken.',observedAt:f.time()});
  await f.command('A','contribution.review',{id:returned.id,revision:1,decision:'accepted',reason:'Samen nagekeken.'});
  assert.equal(f.row('B','contribution',c.id).impact.returnedContributions,1);
  assert.equal(f.row('B','contribution',c.id).impact.views,null);
  const restarted=fixture(JSON.parse(JSON.stringify(f.db.data)));
  assert.equal(restarted.row('C','plan',next).status,'completed');
  assert.equal(restarted.row('B','contribution',c.id).impact.confirmedParticipants,1);
});

test('preview schrijft niets, replay geeft één gevolg en verkeerde herhaalsleutel faalt',async()=>{
  const f=fixture(), input={title:'Plek',area:'Regio'};
  assert.equal(f.world.prepare('A','place.create',input).ok,true);
  assert.deepEqual(f.db.data,{});
  const one=await f.world.execute('A','place.create',input,'identical-key');
  const two=await f.world.execute('A','place.create',input,'identical-key');
  assert.equal(two.replay,true);assert.equal(one.result.id,two.result.id);
  assert.equal(f.world.view('A').places.length,1);assert.equal(f.db.data.livingWorld.history.length,1);
  assert.equal((await f.world.execute('A','place.create',{...input,title:'Anders'},'identical-key')).status,409);
});

test('rollen, privacy, versieconflicten en besluit vóór uitvoering worden werkelijk afgedwongen',async()=>{
  const f=fixture(),{blueprintId}=await f.setup(),id=await f.preparePlan(blueprintId);
  assert.equal(f.world.view('C',{plan:id}).status,404);
  let p=f.row('B','plan',id);
  assert.equal((await f.world.execute('C','plan.request',{id,revision:p.revision},'wrong-owner')).status,403);
  assert.equal((await f.world.execute('A','plan.complete',{id,revision:p.revision,statement:'Fake'},'wrong-state')).status,403);
  await f.command('B','plan.request',{id,revision:p.revision});p=f.row('A','plan',id);
  assert.equal((await f.world.execute('A','plan.decide',{id,revision:p.revision,decision:'accepted',reason:'Niet nagekeken'},'unchecked-req')).code,'REQUIREMENTS_UNCHECKED');
  assert.equal(f.row('A','plan',id).status,'requested');
  assert.equal((await f.world.execute('A','plan.decide',{id,revision:1,decision:'accepted',requirementsChecked:true,reason:'Controle'},'stale-version')).code,'STALE_VERSION');
  await f.command('A','plan.decide',{id,revision:p.revision,decision:'accepted',requirementsChecked:true,reason:'Controle'});
  p=f.row('A','plan',id);
  assert.equal((await f.world.execute('A','plan.start',{id,revision:p.revision},'early-start')).code,'TOO_EARLY');
  const all=JSON.stringify(f.world.view('C'));
  assert.equal(all.includes('Eigen voorkeur'),false);assert.equal(all.includes('organizer_attestation'),false);
});

test('bronwijziging en intrekking blokkeren achterhaalde acties; opnieuw publiceren herstelt de bron',async()=>{
  const f=fixture(),{placeId,blueprintId}=await f.setup(),id=await f.preparePlan(blueprintId);
  let b=f.row('A','blueprint',blueprintId);
  const p=f.row('B','plan',id);
  assert.equal(f.world.prepare('B','plan.request',{id,revision:p.revision}).ok,true);
  await f.command('A','blueprint.update',{...spec(),id:blueprintId,revision:b.revision,summary:'Andere route'});
  assert.equal((await f.world.execute('B','plan.request',{id,revision:p.revision},'changed-source')).code,'SOURCE_CHANGED');
  assert.equal(f.row('B','plan',id).sourceChanged,true);
  let place=f.row('A','place',placeId);
  await f.command('A','place.withdraw',{id:placeId,revision:place.revision,reason:'Toegang gesloten'});
  assert.equal(f.world.saloon('C').items.length,0);
  b=f.row('A','blueprint',blueprintId);
  assert.equal((await f.world.execute('C','plan.create',{id:blueprintId,revision:b.revision},'withdrawn-place')).code,'SOURCE_WITHDRAWN');
  place=f.row('A','place',placeId);
  await f.command('A','place.publish',{id:placeId,revision:place.revision});
  assert.equal(f.world.view('C').blueprints.length,1);
});

test('fork bewaart afstamming en kopieert geen boekingen, mediarecht of privéplan',async()=>{
  const f=fixture(),{blueprintId}=await f.setup();await f.preparePlan(blueprintId);
  const b=f.row('B','blueprint',blueprintId);
  const fork=await f.command('B','blueprint.fork',{id:blueprintId,revision:b.revision,title:'Mijn fotografievariant'});
  const own=f.row('B','blueprint',fork.id);
  assert.equal(own.title,'Mijn fotografievariant');assert.equal(own.derivedFrom.id,blueprintId);
  assert.equal(own.mediaRef,'');assert.equal(own.status,'draft');
  assert.equal(f.world.view('C',{blueprint:fork.id}).status,404);
  assert.equal(JSON.stringify(own).includes('Eigen voorkeur'),false);
  assert.equal((await f.world.execute('C','blueprint.create',{...spec(),placeId:b.placeId},'stolen-media')).code,'MEDIA_NOT_ALLOWED');
});

test('human owner ontvangt storing en herstel vraagt opnieuw een besluit',async()=>{
  const f=fixture(),{blueprintId}=await f.setup(),id=await f.preparePlan(blueprintId);
  let p=f.row('B','plan',id);await f.command('B','plan.request',{id,revision:p.revision});
  p=f.row('B','plan',id);await f.command('B','plan.issue',{id,revision:p.revision,reason:'Aanbieder bevestigt nog niet'});
  p=f.row('A','plan',id);assert.equal(p.issue.owner,'Member A');
  assert.equal((await f.world.execute('B','plan.resolve',{id,revision:p.revision,reason:'Zelf opgelost'},'wrong-resolver')).status,403);
  await f.command('A','plan.resolve',{id,revision:p.revision,reason:'Contact opgenomen; opnieuw beoordelen'});
  assert.equal(f.row('B','plan',id).status,'requested');
});

test('verlopen condities verdwijnen uit Pulse, correcties blijven in World Memory en zelfreview faalt',async()=>{
  const f=fixture(),{placeId}=await f.setup();
  const c=await f.command('B','contribution.create',{placeId,kind:'condition',title:'Waarneming',
    text:'Actuele situatie door lid gemeld.',observedAt:'2026-10-01T09:00:00.000Z',validUntil:'2026-10-01T11:00:00.000Z'});
  assert.equal((await f.world.execute('B','contribution.review',{id:c.id,revision:1,decision:'accepted',reason:'Eigen oordeel'},'self-review')).status,403);
  await f.command('A','contribution.review',{id:c.id,revision:1,decision:'accepted',reason:'Beoordeeld'});
  assert.equal(f.world.view('C').pulse.length,1);f.clock('2026-10-01T12:00:00.000Z');
  assert.equal(f.world.view('C').pulse.length,0);
  assert.equal(f.row('C','place',placeId).memory.length,1);
  assert.equal(f.row('C','place',placeId).memory[0].current,false);
});

test('intrekking van impacttoestemming en deelnamebewijs werkt door zonder historische records te wissen',async()=>{
  const f=fixture(),{placeId,blueprintId}=await f.setup();
  const c=await f.command('B','contribution.create',{placeId,kind:'knowledge',title:'Tip',
    text:'Een voorbereidingstip.',observedAt:'2026-10-01T09:00:00.000Z'});
  await f.command('A','contribution.review',{id:c.id,revision:1,decision:'accepted',reason:'Gecontroleerd'});
  const id=await f.preparePlan(blueprintId,'C',{consentImpact:true,knowledgeIds:[c.id]});await f.complete(id,'C');
  assert.equal(f.row('B','contribution',c.id).impact.confirmedParticipants,1);
  let p=f.row('C','plan',id);
  await f.command('C','plan.consent',{id,revision:p.revision,enabled:false});
  assert.equal(f.row('B','contribution',c.id).impact.confirmedParticipants,0);
  p=f.row('C','plan',id);await f.command('C','plan.consent',{id,revision:p.revision,enabled:true});
  p=f.row('A','plan',id);
  await f.command('A','plan.revokeEvidence',{id,revision:p.revision,reason:'De verklaring was onjuist'});
  assert.equal(f.row('B','contribution',c.id).impact.confirmedParticipants,0);
  assert.equal(f.row('C','plan',id).participation.revokeReason,'De verklaring was onjuist');
});

test('opslagfout geeft geen succes of half record; media-uitval doet geen verdwenen beeld herleven',async()=>{
  const f=fixture();f.failSave(true);
  await assert.rejects(f.world.execute('A','place.create',{title:'Test',area:'Test'},'failure-test'),/storage unavailable/);
  assert.equal(f.world.view('A').places.length,0);f.failSave(false);
  const {blueprintId}=await f.setup();f.media(false);
  const b=f.row('B','blueprint',blueprintId);assert.equal(b.media,null);assert.equal(b.mediaUnavailable,true);
  assert.equal(f.world.mediaLinks('B','video:owned').length,0);
  assert.equal(f.world.view('B').capabilities.paymentsRequired,false);
  assert.equal(f.world.view('B').capabilities.aiRequired,false);
  assert.equal(f.world.view('B').capabilities.pushRequired,false);
});
