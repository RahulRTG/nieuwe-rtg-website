/* Travel-bewijs leest de echte aanvraag, het adviseursbesluit en de projectie.
   Een ledenlogin geeft nooit de bevoegdheid van een reisadviseur mee. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),h=require('./helper');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-experience-travel-'));
let srv,member,other,office;
const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
async function api(route,body={},token=member){const r=await fetch(srv.base+route,{method:'POST',headers:{'content-type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};}
async function register(suffix){
 const email='travel-proof-'+suffix+'-'+Date.now()+'@example.test';
 const r=await api('/api/auth/register',{name:'Reisproef '+suffix,email,phone:'0612345678',password:'geheim12345',geboortedatum:'1980-01-01'},null);
 assert.equal(r.status,200);h.maakBetaaldRtgTestaccount(TMP,email);return r.body.token;
}
async function request(n){const r=await api('/api/reisbureau/boek',{tripId:'ibiza-jetset',personen:3,vertrek:day(n)});assert.equal(r.status,200,JSON.stringify(r.body));return r.body.aanvraag;}
async function agenda(token=member){const r=await api('/api/agenda/mijn',{},token);assert.equal(r.status,200);return r.body.dagen.flatMap(d=>d.items);}
test.before(async()=>{srv=await h.startServer({env:{SMTP_URL:'',RTG_AI_UIT:'1',RTG_DATA_DIR:TMP}});member=await register('one');other=await register('two');office=await h.kantoorAlsPersoon(srv.base);assert.ok(office);});
test.after(async()=>{if(srv)await h.stopHard(srv.child);fs.rmSync(TMP,{recursive:true,force:true});});
test('Travel-aanvraag, besluit in Work en actuele reisagenda: identiteit en status blijven gescheiden',async()=>{
 const a=await request(30);assert.equal(a.status,'aangevraagd');
 assert.equal((await agenda()).find(i=>i.ref===a.ref).status,'aangevraagd');
 assert.ok(!(await agenda(other)).some(i=>i.ref===a.ref));
 assert.equal((await api('/api/office/reisbureau/besluit',{ref:a.ref,besluit:'bevestigd'},member)).status,401);
 assert.equal((await api('/api/reisbureau/annuleer',{ref:a.ref},other)).status,404);
 assert.equal((await api('/api/office/reisbureau/besluit',{ref:a.ref,besluit:'bevestigd',bericht:'Vertrek bevestigd door uw reisadviseur.'},office)).status,200);
 const mine=(await api('/api/reisbureau/mijn')).body.aanvragen.find(r=>r.ref===a.ref);
 assert.equal(mine.status,'bevestigd');assert.equal(mine.besluit.door,undefined);
 const items=(await agenda()).filter(i=>i.ref===a.ref);assert.equal(items.length,1);assert.equal(items[0].status,'bevestigd');
 assert.equal((await api('/api/reisbureau/afzeggen',{ref:a.ref,reden:'Andere planning'})).status,200);
 assert.ok(!(await agenda()).some(i=>i.ref===a.ref));
});
test('een afwijzing vereist een reden en verwijdert de reis uit het programma',async()=>{
 const a=await request(35);
 assert.equal((await api('/api/office/reisbureau/besluit',{ref:a.ref,besluit:'afgewezen'},office)).status,400);
 assert.equal((await api('/api/reisbureau/mijn')).body.aanvragen.find(r=>r.ref===a.ref).status,'aangevraagd');
 assert.equal((await api('/api/office/reisbureau/besluit',{ref:a.ref,besluit:'afgewezen',bericht:'Deze datum is niet beschikbaar.'},office)).status,200);
 assert.equal((await api('/api/reisbureau/mijn')).body.aanvragen.find(r=>r.ref===a.ref).besluit.bericht,'Deze datum is niet beschikbaar.');
 assert.ok(!(await agenda()).some(i=>i.ref===a.ref));
});
test('twee gelijktijdige aanvragen maken één open aanvraag; intrekken ruimt de projectie op',async()=>{
 const body={tripId:'ibiza-jetset',personen:3,vertrek:day(40)};
 const pair=await Promise.all([api('/api/reisbureau/boek',body),api('/api/reisbureau/boek',body)]);
 assert.deepEqual(pair.map(r=>r.status).sort(),[200,409]);
 const open=(await api('/api/reisbureau/mijn')).body.aanvragen.filter(r=>r.status==='aangevraagd');assert.equal(open.length,1);
 assert.equal((await api('/api/reisbureau/annuleer',{ref:open[0].ref})).status,200);
 assert.ok(!(await agenda()).some(i=>i.ref===open[0].ref));
});
test('een verlopen sessie en een verdwenen reis leveren geen aanvraag op',async()=>{
 assert.equal((await api('/api/reisbureau/boek',{tripId:'ibiza-jetset'},'expired-session')).status,401);
 assert.equal((await api('/api/reisbureau/boek',{tripId:'niet-bestaande-reis'})).status,404);
 assert.equal((await api('/api/reisbureau/mijn')).body.aanvragen.filter(r=>r.status==='aangevraagd').length,0);
});
