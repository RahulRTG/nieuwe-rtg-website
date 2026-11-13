'use strict';
/* Bounded diagnose van de optionele testprofiler; geen productiehaak. Alleen
   scalars, nooit argumenten/resultaten/SQL/payloads bewaren. De exportwrapper
   mist gesloten save-callbacks: hun kosten blijven expliciet unattributed.
   Nested tijden overlappen; deze velden vormen geen optelbare CPU-boekhouding. */
module.exports = function correlatie(nu = () => performance.now()) {
  const namen = new Set(['trustEvidence','betaalWaarheid','facturen','sessions','securityLog']);
  const fasen = new Set(['exec.begin','exec.commit','exec.rollback','exec.other',
    'checkpoint.PASSIVE','checkpoint.FULL','checkpoint.RESTART','checkpoint.TRUNCATE',
    ...[...namen,'other'].map(k=>'kv.write.'+k)]);
  let actief = null, diepte = 0, id = 0, onderhoud = false;
  const serialisatie = () => ({count:0,ms:0,maxMs:0,chars:0,failures:0,slowest:[]});
  const leeg = () => ({version:1,coverage:'exported-saveSqlite-only',observedCalls:0,
    failedCalls:0,nestedCalls:0,overflow:0,instrumentationErrors:0,
    unattributed:{serialization:serialisatie(),native:[]},
    unattributedMaintenance:{serialization:serialisatie(),native:[]},slowest:[]});
  let uit = leeg();
  const doel = () => actief ? actief.rij : onderhoud ? uit.unattributedMaintenance : uit.unattributed;
  function top(lijst, rij, veld, max) {
    lijst.push(rij); lijst.sort((a,b)=>b[veld]-a[veld]); if(lijst.length>max) lijst.length=max;
  }
  return {
    error() { uit.instrumentationErrors++; },
    maintenance(aan) { onderhoud = aan === true; },
    begin(route, args) {
      const vorige = actief; diepte++; uit.observedCalls++;
      if(diepte>1) uit.nestedCalls++;
      if(diepte>64) { uit.overflow++; actief=null; return {vorige,overflow:true}; }
      const rij = {id:++id,parentId:vorige?.rij.id || null,startedAtMs:nu(),elapsedMs:0,
        route:typeof route==='string'?route.slice(0,160):'overig',
        scope:args[1]===undefined?'unscoped':'scoped',force:args[0]===true,durable:args[3]===true,
        activity:onderhoud?'profiler-maintenance':'application',failed:false,nestedSaveMs:0,
        serialization:serialisatie(),native:[]};
      actief = {vorige,rij}; return actief;
    },
    end(frame, failed) {
      actief=frame.vorige; diepte--;
      if(failed) uit.failedCalls++;
      if(frame.overflow) return;
      const r=frame.rij; r.elapsedMs=Math.max(0,nu()-r.startedAtMs); r.failed=failed===true;
      if(actief) actief.rij.nestedSaveMs+=r.elapsedMs;
      top(uit.slowest,r,'elapsedMs',32);
    },
    serialization(collection, ms, chars, failed) {
      const s=doel().serialization;
      s.count++;s.ms+=ms;s.maxMs=Math.max(s.maxMs,ms);s.chars+=chars;if(failed)s.failures++;
      top(s.slowest,{collection:namen.has(collection)?collection:'other',ms,chars,failed:failed===true},'ms',8);
    },
    native(phase, connection, ms, gelukt, chars) {
      const lijst=doel().native, naam=fasen.has(phase)?phase:'other';
      let r=lijst.find(x=>x.phase===naam);
      if(!r) { r={phase:naam,count:0,ms:0,maxMs:0,failures:0,storedChars:0};lijst.push(r); }
      r.count++;r.ms+=ms;r.maxMs=Math.max(r.maxMs,ms);if(!gelukt)r.failures++;r.storedChars+=chars;
    },
    drain() { const klaar=uit; klaar.activeFrames=diepte; uit=leeg(); return klaar; }
  };
};
