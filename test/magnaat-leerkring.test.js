'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const H=require('../server/kern/spellen/magnaat/hospitality');
function maak(){const db={data:{}},leren=require('../server/kern/spellen/magnaat/leerkring')({db,crypto,save:()=>{}});return{db,leren}}
function rond(route,keuze){const h=H.nieuw();H.start(h,route);while(h.status==='live'){
  for(const x of h.incidenten.filter(i=>i.status==='open'))H.besluit(h,x.id,keuze&&x.keuzes.includes(keuze)?keuze:x.keuzes[0]);H.stap(h)}return h}

test('Magnaat maakt van herhaald spelgedrag een anonieme testkandidaat',()=>{
  const{db,leren}=maak();for(let i=0;i<3;i++)leren.registreerHospitality({potjeId:'p'+i,simulatie:rond('zwart')});
  const o=leren.overzicht();assert.equal(o.runs,3);assert.ok(o.kandidaten.some(k=>k.soort==='workflow'));
  assert.equal(JSON.stringify(db.data.magnaatLeren).includes('speler'),false);
  assert.equal(JSON.stringify(db.data.magnaatLeren).includes('supplier'),false);
  assert.equal(o.contract.schrijftProductie,false);assert.equal(o.contract.wijzigtCode,false);
});

test('dezelfde run telt eenmaal en alleen een mens maakt er een testopdracht van',()=>{
  const{leren}=maak(),h=rond('zwart');leren.registreerHospitality({potjeId:'zelfde',simulatie:h});
  assert.equal(leren.registreerHospitality({potjeId:'zelfde',simulatie:h}).herhaald,true);
  const k=leren.overzicht().kandidaten[0];assert.ok(k);assert.equal(k.status,'kandidaat');
  assert.equal(leren.besluit(k.id,'automatisch-uitrollen','Rahul').status,400);
  const b=leren.besluit(k.id,'naar-test','Boardroom');assert.equal(b.kandidaat.status,'test-klaar');
  assert.match(b.let,/code en productie zijn niet gewijzigd/);
});

test('veel afgewezen handelingen leveren een bedieningsproef, geen codewijziging',()=>{
  const{leren}=maak();const r=leren.registreerCampagne({potjeId:'eco-1',acties:{open:10},fouten:{open:6}});
  assert.ok(r.kandidaten.length);const k=leren.overzicht().kandidaten[0];
  assert.equal(k.soort,'bediening');assert.match(k.test.dan,/voorwaarde ontbreekt/);
  assert.deepEqual(k.test.invarianten,['geen productie-write','geen persoonsgegevens','menselijk akkoord blijft verplicht']);
});
