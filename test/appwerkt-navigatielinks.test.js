'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {controleerNavigatielinks,volledigeBediening,meetIngang} = require('../scripts/appwerkt');
const {CONTRACT} = require('../scripts/lib/appcontract');
const doel = {bestemming:'/apps/b.html',inhoud:'main h1',titel:'Document B'};
const leeg = {gevonden:0,geklikt:0,overgeslagen:[]};
const record = {merk:'B|1',naam:'Document B',bestemming:'/apps/b.html',status:200,titel:'Document B'};
const links = {gevonden:1,geklikt:1,aangeraakt:[record],onbewezen:[],fouten:[]};
test('linkcontract is expliciet, gesloten en bevat geen bewijsstatus',()=>{
  assert.equal(controleerNavigatielinks(CONTRACT['link:juridisch'].navigatielinks),null);
  const m=meetIngang({functie:'link:juridisch',pad:'/apps/juridisch.html',ingang:'/apps/juridisch.html'});
  assert.equal(m.navigatielinks.length,4);
  for(const c of [null,[],[doel,doel],[{...doel,bestemming:'https://example.invalid/a.html'}],
    [{...doel,bestemming:'/apps/../a.html'}],[{...doel,status:'BEWEZEN'}],[{...doel,inhoud:''}]])
    assert.ok(controleerNavigatielinks(c));
});
test('volledige linkbediening vereist afzonderlijke concrete en unieke succesrecords',()=>{
  assert.equal(volledigeBediening(leeg),false);
  assert.equal(volledigeBediening({...leeg,navigatie:links}),true);
  assert.equal(volledigeBediening({...leeg,gevonden:1,navigatie:links}),false,'links vullen geen ontbrekend knopbewijs aan');
  for(const onvolledig of [null,{...links,gevonden:-1,geklikt:-1},{...links,gevonden:0,geklikt:0},
    {...links,aangeraakt:undefined},{...links,aangeraakt:[]},
    {...links,gevonden:2,geklikt:2,aangeraakt:[record,record]},
    {...links,aangeraakt:[{...record,status:404}]},{...links,aangeraakt:[{...record,status:'200'}]},
    {...links,aangeraakt:[{...record,titel:''}]},{...links,aangeraakt:[{...record,bestemming:''}]},
    {...links,aangeraakt:[{...record,bestemming:'https://example.invalid/a.html'}]},
    {...links,aangeraakt:[{...record,merk:''}]},{...links,aangeraakt:[null]},
    {...links,onbewezen:['inventaris onvolledig']},{...links,fouten:['JS: kapot']}])
    assert.equal(volledigeBediening({...leeg,navigatie:onvolledig}),false,JSON.stringify(onvolledig));
  assert.equal(volledigeBediening({...leeg,gevonden:-1,geklikt:-1,navigatie:links}),false);
});
