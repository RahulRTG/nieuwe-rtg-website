'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {startServer,stopHard}=require('./helper');
test('echte werk-, leveranciers- en betaalroutes: scope, duurzame herhaling, annulering en providercontrole',async()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-praktijk-transacties-'));
  let srv,base,provider,betaald=false,posten=0,verzoeken=[];
  const api=async(p,b={})=>{const r=await fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
    return {status:r.status,body:await r.json()};};
  try {
    provider=http.createServer(async(req,res)=>{
      let body='';for await(const c of req)body+=c;
      if(req.method==='POST'){posten++;verzoeken.push(new URLSearchParams(body));}
      const input=verzoeken[0];res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({id:'cs_werk_fixture',status:betaald?'complete':'open',payment_status:betaald?'paid':'unpaid',
        payment_intent:'pi_werk_fixture',url:'https://checkout.stripe.com/c/pay/fixture',amount_total:4200,currency:'eur',
        client_reference_id:input?.get('client_reference_id')}));
    });
    await new Promise(resolve=>provider.listen(0,'127.0.0.1',resolve));
    const env={RTG_DATA_DIR:tmp,SMTP_URL:'',STRIPE_SECRET_KEY:'sk_test_local_fixture',STRIPE_BASE_URL:'http://127.0.0.1:'+provider.address().port,
      MOLLIE_API_KEY:'',ADYEN_API_KEY:'',PAYMENT_PROVIDER:'stripe',RTG_BETALEN_UIT:'0',RTG_WERK_BETAAL_ORIGIN:'https://rtg.example'};
    srv=await startServer({env});base=srv.base;
    const w=(await api('/api/bedrijf/werkruimte/maak',{naam:'Testbedrijf',idem:crypto.randomUUID()})).body;
    assert.ok(w.beheerToken);
    const context={werkruimte:w.werkruimte,beheerToken:w.beheerToken};
    const doe=(p,b={})=>api('/api/bedrijf/praktijk/'+p,{...context,idem:crypto.randomUUID(),...b});
    assert.equal((await doe('inrichten',{profiel:'dienstverlening',land:'NL',valuta:'EUR',tijdzone:'Europe/Amsterdam',versie:0})).status,200);
    const aanbod=(await doe('aanbod',{naam:'Opdracht',soort:'dienst',prijswijze:'vast',bedragMinor:4200,locatie:'Haarlem'})).body;
    const p=(await doe('vraag',{aanbodId:aanbod.aanbodId,klant:'Privéklant',vraag:'Klantopdracht'})).body.projectId;
    const versie=async()=> (await doe('beeld')).body.werk.find(x=>x.id===p).versie;
    assert.equal((await doe('stap',{projectId:p,versie:await versie(),stap:'voorstel',toelichting:'Totaal afgesproken',bedragMinor:4200})).status,200);
    const klantlink=(await doe('delen',{projectId:p,versie:await versie()})).body.link;
    const sleutel=klantlink.split('#gast=')[1];
    assert.equal((await api('/api/werk-gast/besluit',{sleutel,versie:await versie(),keuze:'akkoord'})).status,200);
    const aanvraag={projectId:p,versie:await versie(),actie:'aanvragen',leverancier:'Lokale leverancier',onderdeel:'Transfer',
      datum:'2026-12-01',locatie:'Afgesproken adres',bedragMinor:2000,voorwaarden:'Twee personen, geen extra kosten',idem:crypto.randomUUID()};
    const a=await api('/api/bedrijf/praktijk/leverancier',{...context,...aanvraag});assert.equal(a.status,200,JSON.stringify(a));
    assert.equal((await doe('leverancier',aanvraag)).status,409,'geen geheim uit herhaalcache');
    const ls=a.body.link.split('#leverancier=')[1];
    assert.equal((await api('/api/werk-gast/beeld',{sleutel:ls})).status,404,'leverancier is geen klant');
    assert.equal((await api('/api/werk-leverancier/beeld',{sleutel})).status,404,'klant is geen leverancier');
    let lb=await api('/api/werk-leverancier/beeld',{sleutel:ls});assert.equal(lb.status,200);assert.equal(lb.body.bedragMinor,2000);
    assert.equal(JSON.stringify(lb.body).includes('Privéklant'),false);
    // Een klantlink vervangen mag geen leverancierslink intrekken.
    const nieuw=(await doe('delen',{projectId:p,versie:await versie()})).body.link.split('#gast=')[1];
    assert.equal((await api('/api/werk-leverancier/beeld',{sleutel:ls})).status,200);
    const beslissing={sleutel:ls,versie:lb.body.versie,keuze:'bevestigen',naam:'Planner',referentie:'T-001'};
    const dubbel=await Promise.all([api('/api/werk-leverancier/besluit',beslissing),api('/api/werk-leverancier/besluit',beslissing)]);
    assert.deepEqual(dubbel.map(x=>x.status).sort(),[200,409]);
    assert.equal((await doe('stap',{projectId:p,versie:await versie(),stap:'annuleren',toelichting:'Nog geboekt'})).status,409);
    const annulering=await doe('leverancier',{projectId:p,versie:await versie(),taakId:a.body.taakId,actie:'annuleren',toelichting:'Klant wil niet meer'});
    const as=annulering.body.link.split('#leverancier=')[1];lb=await api('/api/werk-leverancier/beeld',{sleutel:as});
    assert.equal(lb.body.stand,'annulering-gevraagd');
    assert.equal((await api('/api/werk-leverancier/besluit',{sleutel:as,versie:lb.body.versie,keuze:'weigeren',naam:'Planner',referentie:'Boeking blijft staan'})).status,200);
    assert.equal((await doe('beeld')).body.werk[0].taken[0].externeAfspraak.stand,'bevestigd');
    assert.equal((await doe('betaalverzoek',{projectId:p,versie:await versie(),aan:true})).status,409,'zonder ontvanger gesloten');
    env.RTG_WERK_BETAALONTVANGERS=JSON.stringify({[w.werkruimte]:{soort:'platform',naam:'RTG Testontvanger',aanbieder:'stripe',valutas:['EUR']}});
    await stopHard(srv.child);srv=await startServer({env});base=srv.base;
    assert.equal((await doe('beeld')).body.werk[0].taken[0].externeAfspraak.stand,'bevestigd','duurzaam leveranciersantwoord');
    const lid=(await api('/api/bedrijf/lid/aanmeld',{werkruimte:w.werkruimte,naam:'Financieel bevoegde medewerker'})).body;
    assert.equal((await api('/api/bedrijf/lid/besluit',{...context,lidId:lid.lidId,akkoord:true})).status,200);
    const rollen=rollen=>api('/api/bedrijf/lid/rollen',{...context,lidId:lid.lidId,rollen});
    await rollen(['directie']);
    const betaalverzoek={werkruimte:w.werkruimte,lidToken:lid.lidToken,projectId:p,versie:await versie(),aan:true,idem:crypto.randomUUID()};
    const on=await api('/api/bedrijf/praktijk/betaalverzoek',betaalverzoek);assert.equal(on.status,200,JSON.stringify(on));
    await rollen(['projectleider','verkoop']);
    assert.equal((await api('/api/bedrijf/praktijk/betaalverzoek',betaalverzoek)).status,403,'rechten vóór herhaalcache');
    assert.equal((await api('/api/werk-gast/betaling/start',{sleutel:nieuw,versie:await versie(),akkoord:true})).status,409,'financiële bevoegdheid ingetrokken');
    assert.equal(posten,0);await rollen(['directie']);
    const pay={sleutel:nieuw,versie:await versie(),akkoord:true,bedragMinor:1,aanbieder:'ander'};
    const start=await Promise.all([api('/api/werk-gast/betaling/start',pay),api('/api/werk-gast/betaling/start',pay)]);
    start.forEach(r=>assert.equal(r.status,200,JSON.stringify(r)));
    assert.equal(start[0].body.betaling.id,start[1].body.betaling.id);assert.equal(posten,1);
    assert.equal(verzoeken[0].get('line_items[0][price_data][unit_amount]'),'4200');
    assert.equal(verzoeken[0].get('success_url'),'https://rtg.example/apps/werk.html#betaling-terug');
    assert.equal((await api('/api/werk-gast/betaling/status',{sleutel:as})).status,404);
    assert.equal((await api('/api/werk-gast/betaling/status',{sleutel:nieuw})).body.betaling.stand.status,'WACHT_OP_KLANT');
    await stopHard(srv.child);srv=await startServer({env});base=srv.base;betaald=true;
    const status=await api('/api/werk-gast/betaling/status',{sleutel:nieuw});assert.equal(status.status,200,JSON.stringify(status));
    assert.equal(status.body.betaling.stand.status,'BEVESTIGD');assert.equal(status.body.betaling.stand.afgehandeld,true);assert.equal(posten,1);
    assert.equal((await doe('beeld')).body.werk[0].betaling.stand.status,'BEVESTIGD');
    assert.equal((await api('/api/werk-gast/betaling/start',pay)).status,409,'geen tweede betaling na bevestiging');
    await doe('delen',{projectId:p,versie:await versie(),intrekken:true});
    assert.equal((await api('/api/werk-gast/betaling/status',{sleutel:nieuw})).status,404);
  } finally {if(srv)await stopHard(srv.child);if(provider)await new Promise(r=>provider.close(r));fs.rmSync(tmp,{recursive:true,force:true});}
});
