'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const maakWaarheid=require('../server/kern/betaalwaarheid');
const maakBetalen=require('../server/bedrijf/praktijk-betalen');
function setup() {
  const w={code:'WTEST',naam:'Organisatie',leden:{},projecten:{p:{id:'p',praktijkRef:'k'}},kansen:{k:{praktijk:{
    stand:'bevestigd',versie:3,bedragMinor:12345,valuta:'EUR',decimalen:2}}}};
  const p=w.projecten.p,x=w.kansen.k.praktijk,l={id:'directie',status:'actief',rechten:['werkruimte','project','klant','geld','geld.goedkeuren']};w.leden[l.id]=l;
  let data={werkruimtes:{WTEST:w}},pogingen=[],providerStatus='requires_action',verlies=false;
  const db={get data(){return data;}},g={w,p,x,l,rechten:l.rechten,d:{id:'gastlink'}};
  const betaal={mogelijkheden:()=>({rails:[{id:'stripe',echt:true},{id:'mollie',echt:true}]}),
    async maakBetaling(o){pogingen.push(o);if(verlies)throw Error('Antwoord verloren');return {id:'cs_fixture',aanbieder:'stripe',status:providerStatus,
      bedrag:o.bedrag,valuta:o.valuta,referentie:o.referentie,checkoutUrl:'https://checkout.stripe.com/c/pay/fixture'};},
    async haalBetaling(){return {id:'cs_fixture',aanbieder:'stripe',status:providerStatus,bedrag:x.bedragMinor,valuta:x.valuta};}};
  const env={RTG_WERK_BETAALONTVANGERS:JSON.stringify({WTEST:{soort:'platform',naam:'RTG Testrekening',aanbieder:'stripe',valutas:['EUR','JPY']}}),
    RTG_WERK_BETAAL_ORIGIN:'https://rtg.example'};
  const ctx={db,W:()=>data.werkruimtes,save(){},log(){},rechtenVan:l=>l.rechten,kern:{betaal}};
  function bouw(){ctx.kern.betaalWaarheid=maakWaarheid({d:()=>data,save(){},crypto,betaal});return maakBetalen(ctx,env);}
  let api=bouw();
  const aan=()=>api.instellen(g,{projectId:'p',versie:x.versie,aan:true});
  const start=(b={})=>api.voorbereid(g,{versie:x.versie,akkoord:true,...b});
  return {g,w,p,x,l,env,ctx,aan,start,get api(){return api;},get bw(){return ctx.kern.betaalWaarheid;},pogingen,
    verlies(v){verlies=v;},betaald(){providerStatus='succeeded';},herstart(){data=JSON.parse(JSON.stringify(data));api=bouw();}};
}
test('expliciete ontvanger en financiële bevoegdheid; client kan bedrag of ontvanger niet veranderen',()=>{
  const s=setup();assert.equal(s.api.beeld(s.w,s.p,s.x).magStarten,false);
  s.g.rechten=['project','klant'];assert.equal(s.aan().status,403);s.g.rechten=s.l.rechten;
  assert.equal(s.aan().ok,true);
  assert.equal(s.start({akkoord:false}).status,409);assert.equal(s.start({versie:1}).status,409);
  const r=s.start({bedragMinor:1,aanbieder:'ander',bestemming:'acct_anders'});assert.ok(r.id);
  const waarheid=s.bw.van(r.id);assert.equal(waarheid.centen,12345);assert.equal(waarheid.context.ontvanger.naam,'RTG Testrekening');
  assert.equal(waarheid.start.returnUrl.includes('gastlink'),false);assert.equal(waarheid.start.bestemming,undefined);
  assert.equal(waarheid.gebeurtenissen.some(e=>e.soort==='PROVIDER_START'),true,'duurzame hervatopdracht vóór netwerk');
  assert.equal(s.pogingen.length,0,'voorbereiden doet geen netwerkverkeer');
});
test('geen configuratie, gewijzigd account, betaalstop en niet-passende valuta blijven dicht',()=>{
  for(const env of [{RTG_WERK_BETAALONTVANGERS:'{}'},{RTG_WERK_BETAALONTVANGERS:'geen json'},
    {RTG_BETALEN_UIT:'1'},{RTG_WERK_BETAAL_ORIGIN:'http://onveilig.example'},
    {RTG_WERK_BETAALONTVANGERS:JSON.stringify({WTEST:{soort:'organisatie',naam:'Iemand',aanbieder:'stripe',bestemming:'acct_x',valutas:['EUR']}})}]) {
    const s=setup();Object.assign(s.env,env);assert.equal(s.aan().status,409);assert.equal(s.pogingen.length,0);
  }
  const s=setup();s.aan();s.env.RTG_WERK_BETAALONTVANGERS=s.env.RTG_WERK_BETAALONTVANGERS.replace('Testrekening','Gewijzigd');
  assert.equal(s.start().status,409);s.x.valuta='JPY';s.x.decimalen=0;
  s.env.RTG_WERK_BETAALONTVANGERS=s.env.RTG_WERK_BETAALONTVANGERS.replace('stripe','mollie');
  assert.equal(s.api.beeld(s.w,s.p,s.x).beschikbaar,false,'JPY mag niet door een 2-decimalen rail');
});
test('dubbelklik, verloren providerantwoord en herstart blijven dezelfde economische betaling',async()=>{
  const s=setup();s.aan();const a=s.start(),b=s.start();assert.equal(a.id,b.id);
  s.verlies(true);await assert.rejects(s.bw.begin(a.id,{}));assert.equal(s.bw.publiek(s.bw.van(a.id)).onbekend,true);
  s.herstart();s.verlies(false);
  const r=await Promise.all([s.bw.begin(a.id,{}),s.bw.begin(a.id,{aanbieder:'verkeerd'})]);
  assert.equal(r[0].betaling.id,r[1].betaling.id);assert.equal(s.pogingen.length,2);
  assert.equal(s.pogingen[0].idempotentieSleutel,s.pogingen[1].idempotentieSleutel);
  assert.equal(s.pogingen[1].aanbieder,'stripe');
  s.betaald();const klaar=await s.bw.begin(a.id,{});assert.equal(klaar.betaling.status,'BEVESTIGD');assert.equal(klaar.betaling.afgehandeld,true);
  assert.equal(s.x.stand,'bevestigd','geld ontvangen is niet hetzelfde als werk uitgevoerd');
});
test('actuele personeelsrechten, verkeerde bron en afwijkende providerbedragen geven geen vrijgave',async()=>{
  const s=setup();s.aan();s.l.status='uitdienst';assert.equal(s.start().status,409);s.l.status='actief';
  const r=s.start();await s.bw.begin(r.id,{});
  assert.equal(s.api.record({...s.w,code:'ANDER'},s.p,s.x),null);
  await s.bw.providerMelding({eventId:'afwijking',aanbieder:'stripe',providerId:'cs_fixture',status:'succeeded',bedrag:1,valuta:'eur'});
  assert.equal(s.bw.van(r.id).status,'CONTROLE_NODIG');assert.equal(s.bw.van(r.id).afgehandeldAt,undefined);
  assert.equal(s.api.beeld(s.w,s.p,s.x).magStarten,false);
});
test('betaalstop herkent alleen starten als geldactie; status blijft beschikbaar',()=>{
  const {isBetaalactie}=require('../server/opzet/betaalstop');
  assert.equal(isBetaalactie('POST','/api/werk-gast/betaling/start'),true);
  assert.equal(isBetaalactie('POST','/api/werk-gast/betaling/status'),false);
});
test('afwijkende provider-eenheden worden niet als honderdvoudig of te laag bedrag verstuurd',()=>{
  for(const [aanbieder,valuta] of [['stripe','ISK'],['stripe','UGX'],['adyen','CLP'],['adyen','CVE'],['adyen','IDR'],['adyen','ISK']]) {
    const s=setup();s.ctx.kern.betaal.mogelijkheden=()=>({rails:[{id:aanbieder,echt:true}]});s.x.valuta=valuta;
    s.x.decimalen=new Intl.NumberFormat('nl',{style:'currency',currency:valuta}).resolvedOptions().maximumFractionDigits;
    s.env.RTG_WERK_BETAALONTVANGERS=JSON.stringify({WTEST:{soort:'platform',naam:'Testrekening',aanbieder,valutas:[valuta]}});
    assert.equal(s.api.beeld(s.w,s.p,s.x).beschikbaar,false);assert.equal(s.aan().status,409);assert.equal(s.pogingen.length,0);
  }
});
