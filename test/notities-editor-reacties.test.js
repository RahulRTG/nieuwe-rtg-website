'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const bron = fs.readFileSync(path.join(__dirname, '../public/apps/notities/app/app-02.js'), 'utf8');
function editor() {
  const nodes = new Map(), berichten = [];
  let antwoord, herladen = 0;
  const context = {
    open: {id:'a',vanMij:true}, token:null, stand:{}, document:{},
    $: id => {
      if (!nodes.has(id)) nodes.set(id, {handlers:{}, addEventListener(naam, fn){this.handlers[naam]=fn;},
        classList:{remove(){}}, open:false});
      return nodes.get(id);
    },
    confirm:()=>true, meld:t=>berichten.push(t), laad:()=>herladen++,
    api:()=>new Promise(resolve=>{antwoord=resolve;}),
    window:{RTGDaily:{render(){}},RTGDailyCopy:{value:()=> 'Mislukt'}},
  };
  vm.runInNewContext('(function(){\n'+bron, context);
  return {context,berichten,herladen:()=>herladen,
    verwijder:()=>context.$('#ntWeg').handlers.click(),
    antwoord:async r=>{antwoord(r);await new Promise(resolve=>setImmediate(resolve));}};
}
test('late verwijderfout verschijnt niet in een andere notitie en wijzigt haar concept niet', async()=>{
  const e=editor();e.verwijder();
  const ander={id:'b',titel:'Niet opgeslagen tekst'};e.context.open=ander;
  await e.antwoord({status:503,body:{error:'A kon niet worden verwijderd'}});
  assert.deepEqual(e.berichten,[]);assert.equal(e.context.open,ander);
  assert.equal(ander.titel,'Niet opgeslagen tekst');assert.equal(e.herladen(),0);
});
test('verwijderfout blijft zichtbaar bij dezelfde notitie of na sluiten', async()=>{
  for(const gesloten of [false,true]){
    const e=editor();e.verwijder();if(gesloten)e.context.open=null;
    await e.antwoord({status:400,body:{error:'Niet toegestaan'}});
    assert.deepEqual(e.berichten,['Niet toegestaan']);assert.equal(e.herladen(),0);
  }
});
test('late geslaagde verwijdering vernieuwt het bord zonder een andere editor te sluiten',async()=>{
  const e=editor();e.verwijder();const ander={id:'b'};e.context.open=ander;
  await e.antwoord({status:200,body:{}});
  assert.equal(e.herladen(),1);assert.equal(e.context.open,ander);assert.deepEqual(e.berichten,[]);
});
