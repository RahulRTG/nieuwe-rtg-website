/* Een algemene reserveringsschakelaar geeft RTG geen toestemming voor een
   Connection-programma. De serverprojectie bepaalt de beschikbare keuzes. */
  function kaartConnection(){
    const c = state && state.connectionParticipation;
    if (!c || !Array.isArray(c.programs)) return '';
    const dag = [T('cp.sun','Zo'),T('cp.mon','Ma'),T('cp.tue','Di'),T('cp.wed','Wo'),T('cp.thu','Do'),T('cp.fri','Vr'),T('cp.sat','Za')];
    const dienst = { koffie:T('cp.coffee','Koffie'), borrel:T('cp.drinks','Borrel'), diner:T('cp.dinner','Diner'),
      cultuur:T('cp.culture','Cultuur'), verblijf:T('cp.stay','Verblijf'), vervoer:T('cp.transport','Vervoer'), activiteit:T('cp.activity','Activiteit') };
    const programma = { vonk:T('cp.program.vonk','Vonk-dates'), rendezvous:T('cp.program.rendezvous','Rendez-vous-arrangementen'),
      table:T('cp.program.table','The Table'), concierge:T('cp.program.concierge','Concierge') };
    const programmas = c.programs.map(p => {
      const locaties = (c.locations||[]).map(l => '<label class="gs-rij"><input class="gs-vink" type="checkbox" data-cp-location="'+esc(p.id)+'" value="'+esc(l.id)+'"'+((p.locations||[]).includes(l.id)?' checked':'')+'><span><b class="gs-naam">'+esc(l.label)+'</b></span></label>').join('');
      const diensten = (p.servicesAvailable||[]).map(s => '<label class="gs-rij"><input class="gs-vink" type="checkbox" data-cp-service="'+esc(p.id)+'" value="'+esc(s)+'"'+((p.services||[]).includes(s)?' checked':'')+'><span><b class="gs-naam">'+esc(dienst[s]||s)+'</b></span></label>').join('');
      const dagen = dag.map((d,i) => '<label class="gs-rij"><input class="gs-vink" type="checkbox" data-cp-day="'+esc(p.id)+'" value="'+i+'"'+((p.days||[]).includes(i)?' checked':'')+'><span><b class="gs-naam">'+d+'</b></span></label>').join('');
      return '<details class="card" data-cp-program="'+esc(p.id)+'"'+(p.enabled?' open':'')+'><summary class="tt-h">'+esc(programma[p.id]||p.label)+' · '+(p.enabled?T('cp.on','neemt deel'):T('cp.off','doet niet mee'))+'</summary>'+ 
        '<label class="room-row"><span class="rr-t"><b>'+T('cp.join','Deelnemen')+'</b><span>'+T('cp.join.sub','Alleen nieuwe voorstellen; bestaande bevestigingen blijven staan.')+'</span></span><input class="gs-vink" type="checkbox" data-cp-enabled="'+esc(p.id)+'"'+(p.enabled?' checked':'')+'></label>'+
        '<div class="tt-h">'+T('cp.locations','Locaties')+'</div><div class="gs-grid">'+(locaties||'<div class="note-soft">'+T('cp.nolocation','Voeg eerst een bedrijfslocatie toe.')+'</div>')+'</div>'+
        '<div class="tt-h">'+T('cp.services','Wat u aanbiedt')+'</div><div class="gs-grid">'+diensten+'</div>'+
        '<div class="tt-h">'+T('cp.days','Beschikbare dagen')+'</div><div class="gs-grid">'+dagen+'</div>'+
        '<div class="tt-add"><label>'+T('cp.from','Vanaf')+'<input type="time" data-cp-from="'+esc(p.id)+'" value="'+esc(p.from)+'"></label><label>'+T('cp.to','Tot')+'<input type="time" data-cp-to="'+esc(p.id)+'" value="'+esc(p.to)+'"></label><label>'+T('cp.capacity','Max. per tijdslot')+'<input type="number" min="1" max="100" data-cp-max="'+esc(p.id)+'" value="'+Number(p.maxPerSlot||1)+'"></label></div>'+
        '<div class="tt-add"><label>'+T('cp.pause','Gepauzeerd tot en met')+'<input type="date" data-cp-pause="'+esc(p.id)+'" value="'+esc(p.pausedUntil||'')+'"></label></div></details>';
    }).join('');
    return '<div class="card"><div class="tt-h">'+T('cp.title','Connection-programma’s')+'</div><div class="note-soft">'+
      T('cp.explain','U bepaalt per programma en locatie of u meedoet. Zonder uw keuze verschijnt uw bedrijf nergens als date-, Society- of conciergepartner.')+
      '</div></div>'+programmas+'<div class="card"><div class="tt-add"><button id="cpZet" class="obtn primary">'+T('cp.save','Deelname opslaan')+'</button></div></div>';
  }
  function koppelConnection(el, klaar){
    const b=el.querySelector('#cpZet');if(!b)return;
    b.addEventListener('click',async()=>{
      const programs={};
      el.querySelectorAll('[data-cp-program]').forEach(box=>{
        const id=box.dataset.cpProgram, values=sel=>Array.prototype.slice.call(box.querySelectorAll(sel)).filter(x=>x.checked).map(x=>x.value);
        programs[id]={enabled:!!box.querySelector('[data-cp-enabled="'+id+'"]:checked'),locations:values('[data-cp-location="'+id+'"]'),
          services:values('[data-cp-service="'+id+'"]'),days:values('[data-cp-day="'+id+'"]:checked').map(Number),
          from:(box.querySelector('[data-cp-from="'+id+'"]')||{}).value,to:(box.querySelector('[data-cp-to="'+id+'"]')||{}).value,
          maxPerSlot:Number((box.querySelector('[data-cp-max="'+id+'"]')||{}).value||1),pausedUntil:(box.querySelector('[data-cp-pause="'+id+'"]')||{}).value||''};
      });
      try{await API.call('/supplier/settings',{connectionParticipation:{programs}});toast(T('cp.saved','Deelname bijgewerkt. Nieuwe voorstellen volgen deze keuze direct.'));if(klaar)klaar();}
      catch(e){toast(e.message);}
    });
  }

  restoreSession();
  if ('serviceWorker' in navigator && (location.protocol==='http:'||location.protocol==='https:')) navigator.serviceWorker.register('/sw.js').catch(()=>{});
})();
