'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { VERHALEN } = require('../scripts/verhalen');
const verhaal = VERHALEN.find(v=>v.id === 'onderweg-en-aankomen');
async function proef(fout) {
  const paden = [];
  // Het verhaal leest de bevestigde aankomst terug en herhaalt de bevestiging
  // (scripts/verhalen.js); de nagebootste server bewaart haar daarom een keer.
  const AT = '2026-10-04T10:00:00.000Z';
  let bewaard = null;
  await verhaal.doe({
    eis: (naam, goed, reden) => assert.ok(goed, naam + ': ' + reden),
    stap: async (naam, methode, pad, token, b) => {
      assert.equal(token,'eigen-lid'); paden.push(pad);
      let live;
      if (pad.endsWith('/start')) live = { active:true, dest:{loc:{lat:52,lng:4}} };
      else if (pad.endsWith('/update')) live = { nabij:b.lat === 52, arrived:false };
      else if (pad.endsWith('/aangekomen')) live = { ...(bewaard || (bewaard = { arrived:true, aankomstDoor:'lid', aankomstAt:AT })) };
      else if (pad.endsWith('/state')) live = { ...bewaard };
      else assert.fail('onverwachte handeling');
      if (fout) fout(pad,b,live);
      return { data:{live} };
    }
  }, { ploeg:{gast:{token:'eigen-lid'}},supCode:'ZAAK' });
  return paden;
}
test('het aankomstverhaal vraagt een expliciete bevestiging na het nabijheidsvoorstel',async()=>{
  assert.deepEqual(await proef(),['/api/live/start','/api/live/update','/api/live/update','/api/live/aangekomen',
    '/api/live/state','/api/live/aangekomen']);
});
test('het verhaal ontdekt automatische aankomst, verkeerde afstand en een verloren bevestiging',async()=>{
  for (const fout of [
    (p,b,l)=>{if(p.endsWith('/update'))l.arrived=true;},
    (p,b,l)=>{if(p.endsWith('/update'))l.nabij=true;},
    (p,b,l)=>{if(p.endsWith('/update'))l.nabij=false;},
    (p,b,l)=>{if(p.endsWith('/aangekomen'))l.arrived=false;},
    (p,b,l)=>{if(p.endsWith('/aangekomen'))l.aankomstDoor='server';}
  ]) await assert.rejects(()=>proef(fout),assert.AssertionError);
});
