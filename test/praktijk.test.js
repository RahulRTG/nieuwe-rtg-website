'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const V = require('../server/bedrijf/praktijk-vorm');
function maak() {
  const db = { data: { werkruimtes: {} } }, routes = {};
  const ctx = { db, crypto, save() {}, rechtenVan: () => ['werkruimte','project','klant'], W: () => db.data.werkruimtes,
    app: { post(p, fn) { routes[p] = fn; } }, werkPoort() {},
    rid: (n = 8) => crypto.randomBytes(n).toString('hex'), nu: () => new Date().toISOString(),
    dag: () => new Date().toISOString().slice(0,10), log() {} };
  const api = require('../server/bedrijf/praktijk')(ctx).praktijk;
  const delen = require('../server/bedrijf/praktijk-delen')(ctx);
  const w = { code:'WTEST1',naam:'Eigen werk',leden:{eigenaar:{id:'eigenaar',status:'actief'}},journaal:[] }; db.data.werkruimtes[w.code] = w;
  const g = { w,l:{id:'eigenaar',naam:'Eigenaar'} };
  const doe = (soort,b) => api.wijzig(g,soort,{...b,idem:crypto.randomUUID()},()=>api[soort](g,b));
  const stap = (id,b) => doe('stap',{projectId:id,versie:V.details(w,V.project(w,id)).versie,...b});
  return { db,w,g,api,doe,stap,delen };
}
for (const [profiel,soort] of [['zelfstandig','dienst'],['winkel','product'],['dienstverlening','verhuur'],['vestigingen','activiteit'],['stichting','hulp']]) {
  test(profiel + ': zonder koppelingen van aanbod via vraag naar bewezen uitvoering',()=>{
    const {w,doe,stap} = maak();
    assert.equal(doe('inrichten',{profiel,land:'IT',valuta:'EUR',tijdzone:'Europe/Rome',versie:0}).ok,true);
    const a = doe('aanbod',{naam:'Eigen aanbod',soort,prijswijze:profiel==='stichting'?'kosteloos':'vast',bedragMinor:1500,locatie:'Vestiging Rome'});
    const q = doe('vraag',{aanbodId:a.aanbodId,klant:'Eerste klant',vraag:'Graag een afspraak',datum:'2026-12-10'});
    const id=q.projectId, bedrag = profiel==='stichting'?0:1500;
    assert.ok(w.projecten[id]); assert.equal(Object.keys(w.klanten).length,1); assert.equal(Object.keys(w.kansen).length,1);
    assert.deepEqual(w.projecten[id].herkomst, { werkruimte: w.code, aanbodId: a.aanbodId, aanbodVersie: 1 });
    assert.equal(Object.values(w.kansen)[0].herkomst.projectId, id, 'de prijs blijft aan het bronproject verbonden');
    assert.equal(w.projecten[id].praktijk,undefined,'geen klant/prijsgegevens op algemene projectprojectie');
    assert.equal(stap(id,{stap:'uitvoeren',toelichting:'Onterecht'}).status,409);
    assert.equal(stap(id,{stap:'voorstel',toelichting:'Afgesproken werk',bedragMinor:bedrag}).ok,true);
    assert.equal(stap(id,{stap:'akkoord',toelichting:'Telefonisch op 30 september'}).ok,true);
    assert.equal(stap(id,{stap:'plannen',datum:'2026-01-01',wie:'Eigenaar',locatie:'Rome'}).ok,true);
    assert.equal(V.beeld(w).werk[0].stand,'ingepland','datum in verleden betekent niet uitgevoerd');
    assert.equal(stap(id,{stap:'uitvoeren',toelichting:''}).status,400);
    assert.equal(stap(id,{stap:'uitvoeren',toelichting:'Werk persoonlijk opgeleverd'}).ok,true);
    assert.equal(stap(id,{stap:'afronden',administratie:bedrag?'extern-vastgelegd':'geen-betaling',toelichting:bedrag?'Boekhouding factuur 2026-42':'Vrijwilligerswerk zonder vergoeding'}).ok,true);
    assert.equal(V.beeld(w).werk[0].stand,'afgerond'); assert.equal(w.projecten[id].status,'klaar');
    assert.equal(Object.values(w.taken)[0].kolom,'klaar'); assert.equal(JSON.stringify(w).includes('"paid":true'),false);
  });
}
test('herhaling maakt geen dubbel aanbod; andere inhoud en oude versie worden geweigerd',()=>{
  const {g,api,doe,w} = maak();
  doe('inrichten',{profiel:'winkel',land:'NL',valuta:'EUR',tijdzone:'Europe/Amsterdam',versie:0});
  const b={naam:'Brood',soort:'product',prijswijze:'vast',bedragMinor:350,idem:crypto.randomUUID()};
  const f=()=>api.aanbod(g,b), a=api.wijzig(g,'aanbod',b,f);
  assert.deepEqual(api.wijzig(g,'aanbod',b,f),a); assert.equal(Object.keys(w.praktijkAanbod).length,1);
  assert.equal(api.wijzig(g,'aanbod',{...b,naam:'Anders'},f).status,409);
  assert.equal(doe('aanbod',{...b,aanbodId:a.aanbodId,versie:0}).status,409);
  assert.equal(doe('inrichten',{profiel:'winkel',land:'NL',valuta:'USD',tijdzone:'Europe/Amsterdam',versie:1}).status,409);
});
test('gast ziet alleen afspraak; wijziging, intrekking, verlopen tijd en tenant sluiten de link',()=>{
  const {g,w,db,doe,stap,delen} = maak();
  doe('inrichten',{profiel:'zelfstandig',land:'NL',valuta:'EUR',tijdzone:'Europe/Amsterdam',versie:0});
  const a=doe('aanbod',{naam:'Workshop',soort:'activiteit',prijswijze:'op-aanvraag'});
  const id=doe('vraag',{aanbodId:a.aanbodId,klant:'PRIVE KLANT',vraag:'Workshop in Haarlem'}).projectId;
  stap(id,{stap:'voorstel',toelichting:'Workshop voor drie',bedragMinor:15000});
  const link=()=>doe('delen',{projectId:id,versie:V.details(w,V.project(w,id)).versie});
  let r=link(), sleutel=r.link.split('#gast=')[1], gast=delen.gast({sleutel});
  assert.ok(gast); assert.equal(JSON.stringify(w).includes(sleutel.split('.')[2]),false);
  assert.equal(gast.d.hash.length,64); assert.equal(gast.d.gebruik,0);
  const deur = gast.d;
  for (const [veld, fout] of [['issuer','ander'],['doel','ander'],['uitgegeven',Date.now()+1000],
    ['verloopt',null],['verloopt',deur.uitgegeven+8*864e5]]) {
    const oud = deur[veld]; deur[veld] = fout;
    assert.equal(delen.gast({sleutel}),null,'ongeldig credentialveld: '+veld);
    deur[veld] = oud;
  }
  assert.equal(JSON.stringify(delen.gastBeeld(gast)).includes('PRIVE KLANT'),false);
  assert.equal(delen.gast({sleutel:sleutel+'a'}),null);
  stap(id,{stap:'voorstel',toelichting:'Gewijzigde prijs',bedragMinor:17000}); assert.equal(delen.gast({sleutel}),null);
  r=link(); sleutel=r.link.split('#gast=')[1]; gast=delen.gast({sleutel});
  assert.equal(delen.besluit(gast,{keuze:'akkoord',versie:gast.x.versie}).ok,true);
  assert.equal(gast.d.gebruik,1,'precies één geclaimd besluit');
  assert.equal(delen.besluit(gast,{keuze:'akkoord',versie:gast.x.versie}).status,409);
  doe('delen',{projectId:id,versie:gast.x.versie,intrekken:true}); assert.equal(delen.gast({sleutel}),null);
  r=link(); sleutel=r.link.split('#gast=')[1]; delen.gast({sleutel}).d.verloopt=Date.now()-1; assert.equal(delen.gast({sleutel}),null);
  r=link(); sleutel=r.link.split('#gast=')[1]; db.data.tenants={a:{werkruimtes:[w.code],actief:false}}; assert.equal(delen.gast({sleutel}),null);
});
test('ongeldige invoer schrijft niets, afhankelijkheden blokkeren afronden',()=>{
  const {w,doe,stap} = maak();
  const voor=JSON.stringify(w);
  assert.equal(doe('inrichten',{profiel:'stichting',land:'NL',valuta:'EUR',tijdzone:'verzonnen',versie:0}).status,400);
  assert.equal(JSON.stringify(w),voor);
  doe('inrichten',{profiel:'stichting',land:'NL',valuta:'EUR',tijdzone:'Europe/Amsterdam',versie:0});
  const a=doe('aanbod',{naam:'Hulp',soort:'hulp',prijswijze:'kosteloos'});
  assert.equal(doe('vraag',{aanbodId:a.aanbodId,klant:'A',vraag:'Hulp',datum:'2026-02-30'}).status,400);
  const id=doe('vraag',{aanbodId:a.aanbodId,klant:'A',vraag:'Hulp'}).projectId;
  assert.equal(stap(id,{stap:'voorstel',bedragMinor:1,toelichting:'Niet kosteloos'}).status,400);
  stap(id,{stap:'voorstel',bedragMinor:0,toelichting:'Kosteloos'});
  stap(id,{stap:'akkoord',toelichting:'Besproken'}); stap(id,{stap:'plannen',datum:'2026-12-01',wie:'A',locatie:'Online'});
  w.taken.extra={id:'extra',projectId:id,kolom:'te doen'};
  assert.equal(stap(id,{stap:'uitvoeren',toelichting:'Niet klaar'}).status,409);
});
test('externe afspraken vragen bewijs en blijven open tot uitvoering, zonder externe API',()=>{
  const {w,doe,stap}=maak();
  doe('inrichten',{profiel:'dienstverlening',land:'JP',valuta:'JPY',tijdzone:'Asia/Tokyo',versie:0});
  assert.equal(w.praktijkProfiel.decimalen,0);
  const a=doe('aanbod',{naam:'Evenement',soort:'activiteit',prijswijze:'op-aanvraag'});
  const id=doe('vraag',{aanbodId:a.aanbodId,klant:'Klant',vraag:'Organisatie middag'}).projectId;
  stap(id,{stap:'voorstel',bedragMinor:15000,toelichting:'15000 JPY totaal'});stap(id,{stap:'akkoord',toelichting:'Telefonisch'});
  assert.equal(Object.values(w.kansen)[0].bedragCenten,null,'geen JPY als EUR in een bestaand geldbeeld');
  stap(id,{stap:'plannen',datum:'2026-12-01',locatie:'Tokyo',wie:'Eigenaar'});
  const b={stap:'extern',onderdeel:'Geluid huren',leverancier:'Lokale verhuurder',externeStand:'bevestigd'};
  assert.equal(stap(id,b).status,400);
  const t=stap(id,{...b,bron:'Reservering 123 per telefoon'});assert.equal(t.ok,true);
  assert.equal(stap(id,{stap:'uitvoeren',toelichting:'Te vroeg'}).status,409);
  assert.equal(stap(id,{...b,taakId:t.taakId,externeStand:'uitgevoerd',bron:'Geleverd en retour, bon 456'}).ok,true);
  assert.equal(stap(id,{stap:'uitvoeren',toelichting:'Evenement afgerond'}).ok,true);
});
test('gastlink sluit wanneer de uitgevende medewerker uit dienst gaat',()=>{
  const {w,doe,stap,delen}=maak();
  doe('inrichten',{profiel:'zelfstandig',land:'KW',valuta:'KWD',tijdzone:'Asia/Kuwait',versie:0});
  assert.equal(w.praktijkProfiel.decimalen,3);
  const a=doe('aanbod',{naam:'Dienst',soort:'dienst',prijswijze:'vast',bedragMinor:1234});
  const id=doe('vraag',{aanbodId:a.aanbodId,klant:'Klant',vraag:'Dienst aanvragen'}).projectId;
  stap(id,{stap:'voorstel',bedragMinor:1234,toelichting:'1,234 KWD totaal'});
  const r=doe('delen',{projectId:id,versie:V.details(w,V.project(w,id)).versie}), sleutel=r.link.split('#gast=')[1];
  assert.ok(delen.gast({sleutel}));w.leden.eigenaar.status='uit dienst';assert.equal(delen.gast({sleutel}),null);
});
