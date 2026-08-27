/* Vervolg van leverancier-56 (op de 10 kB-leesgrens geknipt toen het
   Meer-scherm er een knop bij kreeg -- RTG Commerce). De bundelvolgorde is
   alfabetisch, dus 56, 56a, 57: de tekst in apps/leverancier.js blijft
   letterlijk dezelfde. Dit deel: de staart van het beveiligingsbord. */
/* de incidenten op het beveiligingsbord */
    if (cmd.incidenten && cmd.incidenten.length){
      h += '<div class="st-sec">'+T('bev.incs','Incidenten')+'</div><div class="card" style="margin-bottom:0.5rem;">'+
        cmd.incidenten.map(x => '<div style="border-bottom:1px solid var(--line);padding:0.4rem 0;display:flex;justify-content:space-between;gap:0.5rem;">'+
          '<span><b'+(x.ernst==='kritiek'||x.ernst==='hoog'?' style="color:var(--rood);"':'')+'>'+(x.sos?'':'')+esc(x.soort)+'</b> · '+esc(x.post)+' · '+esc(x.guardNaam||'')+'<br><span class="sub">'+esc(x.tekst)+'</span></span>'+
          '<button class="bev-inc" data-id="'+x.id+'" style="align-self:flex-start;">'+(x.status==='open'?T('bev.afh','Afhandelen'):T('bev.heropen','Heropen'))+'</button></div>').join('')+'</div>';
    }
    el.innerHTML = h;
    wireFuncBlok(el);
    // bindingen
    el.querySelectorAll('.js-bevf').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/functie', { id:x.dataset.id, aan: x.dataset.aan!=='true' }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    const bind = (id, fn) => { const e2=$('#'+id); if (e2) e2.addEventListener('click', fn); };
    const dagInp = $('#bevDag'); if (dagInp) dagInp.addEventListener('change', () => { bevDatum = dagInp.value || bevVandaag(); renderBeveiliging(); });
    bind('bevAI', async () => { try { const r = await API.call('/supplier/beveiliging/planauto', { datum: bevDatum }); toast(r.uitleg); renderBeveiliging(); } catch(e){ toast(e.message); } });
    bind('bevBudSave', async () => { try { await API.call('/supplier/beveiliging/budget', { periodeUren: $('#bevBudUren').value, tariefUur: $('#bevBudTarief').value }); renderBeveiliging(); } catch(e){ toast(e.message); } });
    bind('bevAvAdd', async () => { try { await API.call('/supplier/beveiliging/aanvraag', { klant:$('#bevAvKlant').value, object:$('#bevAvObject').value, datum:$('#bevAvDatum').value, aantal:$('#bevAvAantal').value }); renderBeveiliging(); } catch(e){ toast(e.message); } });
    bind('bevPostAdd', async () => { try { await API.call('/supplier/beveiliging/post', { naam:$('#bevPostNaam').value, klant:$('#bevPostKlant').value, minMan:$('#bevPostMin').value }); renderBeveiliging(); } catch(e){ toast(e.message); } });
    el.querySelectorAll('.bev-plan').forEach(x => x.addEventListener('click', async () => {
      const gid = prompt(T('bev.wieplan','Welke bewaker? Typ de naam precies.')); if (!gid) return;
      const staff = (state.staff||[]).find(m => m.name.toLowerCase() === gid.trim().toLowerCase());
      if (!staff) { toast(T('bev.geenbewaker','Geen bewaker met die naam.')); return; }
      try { await API.call('/supplier/beveiliging/dienst', { postId:x.dataset.post, shiftId:x.dataset.shift, datum:bevDatum, guardId:staff.id }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-schrap]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/dienst/weg', { id:x.dataset.schrap }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.bev-inc').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/incident/beslis', { id:x.dataset.id }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-postweg]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/post/weg', { id:x.dataset.postweg }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    // de aanvragenlijst los inladen (eigen endpoint met open + afgerond)
    bevLaadAanvragen();
  }
  async function bevLaadAanvragen(){
    const el = $('#bevAvLijst'); if (!el) return;
    let d; try { d = await API.call('/supplier/beveiliging/aanvragen'); } catch(e){ return; }
    if (!d.open.length && !d.afgerond.length){ el.innerHTML = '<div class="softline">'+T('bev.geenav','Nog geen inzetaanvragen.')+'</div>'; return; }
    el.innerHTML = d.open.map(a => '<div style="border-bottom:1px solid var(--line);padding:0.4rem 0;display:flex;justify-content:space-between;gap:0.5rem;">'+
      '<span><b>'+esc(a.klant)+'</b> · '+esc(a.object)+' · '+esc(a.datum)+' · '+a.aantal+'× '+esc(a.shiftId)+'</span>'+
      '<span style="display:flex;gap:0.3rem;"><button class="abtn" data-avplan="'+a.ref+'">'+T('bev.avplan','Inplannen')+'</button>'+
      '<button class="abtn ghost" data-avweg="'+a.ref+'">'+T('bev.avweg','Afwijzen')+'</button></span></div>').join('')+
      (d.afgerond.length? '<div class="sub h-mt40">'+d.afgerond.slice(0,5).map(a=>esc(a.object)+' ('+esc(a.status)+')').join(' · ')+'</div>':'');
    el.querySelectorAll('[data-avplan]').forEach(x => x.addEventListener('click', async () => {
      try { const r = await API.call('/supplier/beveiliging/aanvraag/beslis', { ref:x.dataset.avplan, actie:'plan' }); toast(T('bev.ingepland','Ingepland en op het rooster gezet.')); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-avweg]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/aanvraag/beslis', { ref:x.dataset.avweg, actie:'afwijzen' }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
  }
