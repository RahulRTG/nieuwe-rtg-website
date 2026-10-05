'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { VERHALEN } = require('../scripts/verhalen');
const verhaal = VERHALEN.find(v=>v.id === 'onderweg-en-aankomen');
async function proef(fout) {
  const paden = [];
  const aankomstAt = '2026-10-05T10:00:00.000Z';
  await verhaal.doe({
    eis: (naam, goed, reden) => assert.ok(goed, naam + ': ' + reden),
    stap: async (naam, methode, pad, token, b) => {
      assert.equal(token,'eigen-lid'); paden.push(pad);
      let live;
      if (pad.endsWith('/start')) live = { active:true, dest:{loc:{lat:52,lng:4}} };
      else if (pad.endsWith('/update')) live = { nabij:b.lat === 52, arrived:false };
      else if (pad.endsWith('/aangekomen') || pad.endsWith('/state')) live = { arrived:true, aankomstDoor:'lid', aankomstAt };
      else assert.fail('onverwachte handeling');
      if (fout) fout(pad,b,live);
      return { data:{live} };
    }
  }, { ploeg:{gast:{token:'eigen-lid'}},supCode:'ZAAK' });
  return paden;
}
test('het aankomstverhaal vraagt een expliciete bevestiging en leest dezelfde waarheid terug',async()=>{
  assert.deepEqual(await proef(),['/api/live/start','/api/live/update','/api/live/update','/api/live/aangekomen','/api/live/state','/api/live/aangekomen']);
});
test('het verhaal ontdekt automatische aankomst, verkeerde afstand en een verloren bevestiging',async()=>{
  for (const fout of [
    (p,b,l)=>{if(p.endsWith('/update'))l.arrived=true;},
    (p,b,l)=>{if(p.endsWith('/update'))l.nabij=true;},
    (p,b,l)=>{if(p.endsWith('/update'))l.nabij=false;},
    (p,b,l)=>{if(p.endsWith('/aangekomen'))l.arrived=false;},
    (p,b,l)=>{if(p.endsWith('/aangekomen'))l.aankomstDoor='server';},
    (p,b,l)=>{if(p.endsWith('/aangekomen'))delete l.aankomstAt;},
    (p,b,l)=>{if(p.endsWith('/state'))l.arrived=false;}
  ]) await assert.rejects(()=>proef(fout),assert.AssertionError);
});
