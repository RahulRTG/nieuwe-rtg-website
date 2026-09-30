'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), crypto=require('node:crypto');
const fs=require('node:fs'), os=require('node:os'), path=require('node:path');
const {startServer,stopHard}=require('./helper');
let server,base,w,beheer,ander,lidId,lidToken;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-praktijk-http-'));
const api=async(p,b={})=>{const r=await fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});return {status:r.status,body:await r.json()};};
const werk=(p,b={})=>api('/api/bedrijf'+p,{werkruimte:w,beheerToken:beheer,...b});
const PRAKTIJK = {
  beeld: '/api/bedrijf/praktijk/beeld', inrichten: '/api/bedrijf/praktijk/inrichten',
  aanbod: '/api/bedrijf/praktijk/aanbod', vraag: '/api/bedrijf/praktijk/vraag',
  stap: '/api/bedrijf/praktijk/stap', delen: '/api/bedrijf/praktijk/delen'
};
const doe=(p,b={})=>api(PRAKTIJK[p],{werkruimte:w,beheerToken:beheer,idem:crypto.randomUUID(),...b});
test.before(async()=>{
  server=await startServer({env:{RTG_DATA_DIR:tmp,SMTP_URL:'',PAYMENT_ENABLED:'false'}});base=server.base;
  let r=await api('/api/bedrijf/werkruimte/maak',{naam:'Bakker en buurthulp',idem:crypto.randomUUID()});
  assert.equal(r.status,200,JSON.stringify(r));w=r.body.werkruimte;beheer=r.body.beheerToken;
  ander=(await api('/api/bedrijf/werkruimte/maak',{naam:'Andere organisatie',idem:crypto.randomUUID()})).body;
  r=await api('/api/bedrijf/lid/aanmeld',{werkruimte:w,naam:'Sam'});lidId=r.body.lidId;lidToken=r.body.lidToken;
  await werk('/lid/besluit',{lidId,akkoord:true});await werk('/lid/rollen',{lidId,rollen:['directie']});
});
test.after(async()=>{if(server)await stopHard(server.child);fs.rmSync(tmp,{recursive:true,force:true});});
let id,versie,sleutel;
test('echte routes: inrichting, meerdere activiteiten, dubbele vraag en scope',async()=>{
  assert.equal((await doe('inrichten',{profiel:'winkel',land:'NL',valuta:'EUR',tijdzone:'Europe/Amsterdam',versie:0})).status,200);
  const a=(await doe('aanbod',{naam:'Taart',soort:'product',prijswijze:'vast',bedragMinor:4200,locatie:'Haarlem'})).body;
  assert.equal((await doe('aanbod',{naam:'Buurtles',soort:'activiteit',prijswijze:'kosteloos',locatie:'Wijkcentrum'})).status,200);
  const body={idem:crypto.randomUUID(),aanbodId:a.aanbodId,klant:'Klant A',vraag:'Verjaardagstaart zaterdag'};
  const q=await doe('vraag',body);assert.equal(q.status,200,JSON.stringify(q));id=q.body.projectId;
  const repeat=await doe('vraag',body);assert.equal(repeat.body.projectId,id);
  let d=(await doe('beeld')).body;assert.equal(d.werk.length,1);assert.equal(d.aanbod.length,2);versie=d.werk[0].versie;
  const leak=await api('/api/bedrijf/praktijk/beeld',{werkruimte:ander.werkruimte,beheerToken:beheer});assert.equal(leak.status,403);
  assert.equal((await api('/api/bedrijf/praktijk/beeld',{})).status,403);
  const wrong=await api('/api/bedrijf/praktijk/stap',{werkruimte:ander.werkruimte,beheerToken:ander.beheerToken,idem:crypto.randomUUID(),projectId:id,versie,stap:'akkoord',toelichting:'Nee'});
  assert.equal(wrong.status,404);
});
test('voorstel en gastakkoord: geen account vereist, geen dubbele beslissing, intrekking is direct',async()=>{
  let r=await doe('stap',{projectId:id,versie,stap:'voorstel',toelichting:'Taart voor 12 personen, afhalen',bedragMinor:4200});assert.equal(r.status,200,JSON.stringify(r));versie=r.body.versie;
  const b={projectId:id,versie,idem:crypto.randomUUID()};r=await doe('delen',b);assert.equal(r.status,200,JSON.stringify(r));sleutel=r.body.link.split('#gast=')[1];
  assert.equal((await doe('delen',b)).status,409,'geheim wordt niet opnieuw uit cache getoond');
  const view=await api('/api/werk-gast/beeld',{sleutel});assert.equal(view.status,200,JSON.stringify(view));assert.equal(view.body.magAntwoorden,true);
  assert.equal(JSON.stringify(view.body).includes('Klant A'),false);assert.equal(view.body.klanten,undefined);
  assert.equal((await api('/api/werk-gast/beeld',{sleutel:sleutel+'x'})).status,404);
  const answers=await Promise.all([1,2].map(()=>api('/api/werk-gast/besluit',{sleutel,versie,keuze:'akkoord'})));
  assert.equal(answers.filter(x=>x.status===200).length,1,JSON.stringify(answers));
  versie=(await doe('beeld')).body.werk[0].versie;
  assert.equal((await doe('delen',{projectId:id,versie,intrekken:true})).status,200);
  assert.equal((await api('/api/werk-gast/beeld',{sleutel})).status,404);
});
test('actuele personeelsrechten: tijdelijke rol en intrekking blokkeren ook herhaling',async()=>{
  const body={werkruimte:w,lidToken,idem:crypto.randomUUID(),naam:'Teamdienst',soort:'dienst',prijswijze:'op-aanvraag'};
  assert.equal((await api('/api/bedrijf/praktijk/aanbod',body)).status,200);
  await werk('/lid/rollen',{lidId,rollen:['extern']});
  assert.equal((await api('/api/bedrijf/praktijk/aanbod',body)).status,403);
  assert.equal((await api('/api/bedrijf/praktijk/beeld',{werkruimte:w,lidToken})).status,403);
  await werk('/lid/rollen',{lidId,rollen:[{id:'directie',van:'2099-01-01'}]});
  assert.equal((await api('/api/bedrijf/praktijk/beeld',{werkruimte:w,lidToken})).status,403);
});
test('werkelijke uitvoer en afronding behouden bestaande bronobjecten',async()=>{
  let r=await doe('stap',{projectId:id,versie,stap:'plannen',datum:'2026-12-01',wie:'Sam',locatie:'Haarlem'});assert.equal(r.status,200);versie=r.body.versie;
  r=await werk('/taken',{projectId:id});assert.equal(r.body.taken.length,1);
  assert.equal((await werk('/project',{projectId:id})).body.project.praktijk,undefined);
  r=await doe('stap',{projectId:id,versie,stap:'uitvoeren',toelichting:'Taart meegegeven aan de klant'});assert.equal(r.status,200);versie=r.body.versie;
  assert.equal((await doe('stap',{projectId:id,versie,stap:'afronden',administratie:'geen-betaling',toelichting:'Niet juist'})).status,400);
  r=await doe('stap',{projectId:id,versie,stap:'afronden',administratie:'extern-vastgelegd',toelichting:'Kassabon 2026-005'});assert.equal(r.status,200);
  assert.equal((await werk('/project',{projectId:id})).body.project.status,'klaar');
});
test('bevestigd werk blijft na een harde herstart terugkomen',async()=>{
  await stopHard(server.child);
  server=await startServer({env:{RTG_DATA_DIR:tmp,SMTP_URL:'',PAYMENT_ENABLED:'false'}});base=server.base;
  const r=await doe('beeld');assert.equal(r.status,200,JSON.stringify(r));
  const x=r.body.werk.find(x=>x.id===id);assert.equal(x.stand,'afgerond');assert.equal(x.administratie.verwijzing,'Kassabon 2026-005');
  assert.equal((await api('/api/werk-gast/beeld',{sleutel})).status,404,'intrekking overleeft herstart');
});

test('de echte pijplijn telt EUR en converteert een JPY-voorstel niet stilzwijgend',async()=>{
  const euro = await api('/api/bedrijf/pijplijn', {werkruimte:w,beheerToken:beheer});
  assert.equal(euro.status,200);assert.equal(euro.body.valuta,'EUR');
  assert.equal(euro.body.gewonnen.bedragCenten,4200);assert.equal(euro.body.andereValuta,0);
  const ruimte = (await api('/api/bedrijf/werkruimte/maak',{naam:'Werkplek Japan',idem:crypto.randomUUID()})).body;
  const context = {werkruimte:ruimte.werkruimte,beheerToken:ruimte.beheerToken};
  const jdoe=(p,b={})=>api(PRAKTIJK[p],{...context,idem:crypto.randomUUID(),...b});
  assert.equal((await jdoe('inrichten',{profiel:'zelfstandig',land:'JP',valuta:'JPY',tijdzone:'Asia/Tokyo',versie:0})).status,200);
  const aanbod=(await jdoe('aanbod',{naam:'Workshop',soort:'dienst',prijswijze:'vast',bedragMinor:1234})).body;
  const vraag=(await jdoe('vraag',{aanbodId:aanbod.aanbodId,klant:'Klant Japan',vraag:'Workshop organiseren'})).body;
  assert.ok(vraag.projectId);
  const voorstel=await jdoe('stap',{projectId:vraag.projectId,versie:1,stap:'voorstel',toelichting:'1234 JPY afgesproken',bedragMinor:1234});
  assert.equal(voorstel.status,200,JSON.stringify(voorstel));
  const yen=await api('/api/bedrijf/pijplijn',context);
  assert.equal(yen.status,200);assert.equal(yen.body.andereValuta,1);
  assert.equal(yen.body.open.aantal,0);assert.equal(yen.body.open.bedragCenten,0);
  assert.equal(yen.body.open.gewogenCenten,0,'JPY blijft buiten de EUR-rekensom');
  assert.equal((await api('/api/bedrijf/pijplijn',{werkruimte:ruimte.werkruimte,beheerToken:beheer})).status,403);
});
