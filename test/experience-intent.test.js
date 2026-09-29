/* Tijdelijke bedoeling blijft gescheiden per sessie en doel. Intrekken,
   afronden en verlopen verwijderen de inhoud, zonder stil te herleven. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {create,TTL,MAX}=require('../public/shared/experience-intent');
const constitution=require('../experience/constitution.json');
function fixture(){let clock=1000000,seq=0;const mem=new Map();const storage={getItem:k=>mem.get(k),setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)};
 const make=(owner,purpose)=>create({storage,owner:owner.repeat(64),purpose,now:()=>clock,id:()=>String(++seq)});
 return {a:make('a'),make,mem,advance:ms=>clock+=ms};}
test('de tijdelijke grenzen volgen de grondwet',()=>{assert.equal(TTL,constitution.intent.maxAgeMs);assert.equal(MAX,constitution.intent.maxActive);});
test('meerdere bedoelingen blijven gescheiden; alleen toegestane expliciete velden worden meegenomen',()=>{
 const f=fixture(),a=f.a.begin({date:'2026-10-03',participants:3,search:'Haarlem',token:'secret',diagnosis:'private'}),b=f.a.begin({participants:2});
 f.a.update(b.id,{participants:4});const rows=f.a.list();assert.equal(rows.find(r=>r.id===a.id).fields.participants,3);
 assert.equal(rows.find(r=>r.id===b.id).fields.participants,4);assert.ok(!JSON.stringify(rows).includes('secret'));assert.ok(!JSON.stringify(rows).includes('private'));
});
test('een andere sessie ziet en bewaart geen context van de vorige sessie',()=>{
 const f=fixture();f.a.begin({search:'Haarlem'});assert.deepEqual(f.make('b').list(),[]);assert.ok(!JSON.stringify([...f.mem.values()]).includes('Haarlem'));
});
test('verloop verwijdert context werkelijk; aanpassen verlengt de levensduur niet',()=>{
 const f=fixture(),r=f.a.begin({search:'Haarlem'});f.advance(TTL-1);f.a.update(r.id,{search:'Amsterdam'});f.advance(1);
 assert.deepEqual(f.a.list(),[]);assert.ok(!JSON.stringify([...f.mem.values()]).includes('Amsterdam'));
});
for(const status of ['FULFILLED','ABANDONED','REVOKED','EXPIRED'])test(status+' wist velden en kan niet stil herleven',()=>{
 const f=fixture(),r=f.a.begin({date:'2026-10-03',participants:3});assert.equal(f.a.end(r.id,status),true);
 assert.deepEqual(f.a.list()[0].fields,{});assert.equal(f.a.update(r.id,{participants:8}),null);
 assert.equal(f.a.end(r.id,'FULFILLED'),false);
});
test('ongeldige datum en onmogelijke groepsgrootte worden niet overgenomen',()=>{
 const f=fixture();assert.deepEqual(f.a.begin({date:'2026-02-31',participants:0}).fields,{});
});
test('Travel hervat alleen zijn eigen bedoeling en kan de restaurantcontext niet wijzigen of afronden',()=>{
 const f=fixture(),dinner=f.a.begin({date:'2026-10-03',participants:3,cuisine:'Japans'}),travel=f.make('a','travel');
 assert.deepEqual(travel.list(),[]);
 const t=travel.begin({date:'2026-11-02',participants:4,notitie:'privé',cuisine:'Japans',search:'strand'});
 assert.deepEqual(t.fields,{date:'2026-11-02',participants:4});
 assert.equal(travel.update(dinner.id,{participants:8}),null);
 assert.equal(travel.end(dinner.id,'FULFILLED'),false);
 assert.equal(f.a.list()[0].fields.participants,3);
 assert.equal(f.make('a','travel').list()[0].id,t.id);
 travel.end(t.id,'FULFILLED');assert.equal(f.a.list()[0].status,'ACTIVE');
 assert.equal(travel.list()[0].source,'/apps/reisbureau.html');
});
test('het maximum geldt over alle doelen en een onbekend doel wordt geweigerd',()=>{
 const f=fixture();for(let i=0;i<MAX;i++)f.a.begin({participants:2});
 assert.throws(()=>f.make('a','travel').begin({participants:3}),/Rond eerst/);
 assert.throws(()=>f.make('a','unknown'),/Unknown intent purpose/);
});
