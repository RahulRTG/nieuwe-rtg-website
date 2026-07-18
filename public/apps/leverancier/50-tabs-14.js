  function renderRooms(){
    const el = $('#roomsWrap'); if (!el) return;
    const rooms = state.rooms;
    if (!Array.isArray(rooms)){ el.innerHTML = ''; return; }
    let html = '<div id="receptieWrap"></div><div id="planWrap"></div><div class="card">';
    html += rooms.length ? rooms.map(r => {
      const hk = (r.hk && r.hk.status) || 'schoon';
      return '<div class="room-row'+(r.available?'':' off')+'" style="flex-wrap:wrap;">'+
        '<div class="rr-t"><b>'+r.name+' <span class="hk-pill hk-'+hk+'">'+tHk(hk)+'</span>'+
          (r.vroegVrij ? ' <span class="hk-pill hk-schoon">🛎 '+T('hk.vroegvrij','vroege check-in')+'</span>' : '')+'</b>'+
          '<span>'+(r.desc||'')+' · '+eur(r.price)+' '+T('sup.pernight','p.n.')+
          (r.hk && r.hk.by ? ' · '+r.hk.by+(r.hk.at?', '+timeAgo(r.hk.at):'') : '')+
          (r.vroegVrij ? ' · 🛎 '+T('hk.vroegvrij2','vrijgegeven door housekeeping')+' ('+r.vroegVrij.door+')' : '')+
          (hk==='defect' && r.hk.note ? ' · ⚠ '+r.hk.note : '')+'</span></div>'+
        '<button class="rr-toggle'+(r.available?' on':'')+'" data-rtoggle="'+r.id+'" aria-label="aan/uit"><span></span></button>'+
        '<button class="rr-del" data-rdel="'+r.id+'">✕</button>'+
        '<div class="hk-chips">'+['schoon','vuil','bezig','bezet','defect'].map(s =>
          '<button class="hk-chip hk-'+s+(hk===s?' on':'')+'" data-hk="'+r.id+'" data-hkst="'+s+'">'+tHk(s)+'</button>').join('')+'</div>'+
        (hkDefectFor===r.id ? '<div class="tt-add" style="width:100%;"><input id="hkNote" placeholder="'+T('hk.noteph','Wat is er kapot?')+'"><button id="hkNoteOk">'+T('hk.report','Meld defect')+'</button></div>' : '')+
      '</div>';
    }).join('') : '<div class="softline">'+T('sup.norooms','Nog geen kamers. Voeg uw eerste kamer toe.')+'</div>';
    html += '<div class="tt-add" style="flex-wrap:wrap;">'+
      '<input id="rmName" placeholder="'+T('sup.roomname','Kamernaam')+'" style="flex:2;min-width:120px;">'+
      '<input id="rmPrice" type="number" inputmode="decimal" placeholder="€" style="flex:1;min-width:70px;">'+
      '<button id="rmAdd">'+T('team.add','Toevoegen')+'</button></div>';
    html += '<div class="note-soft">'+T('sup.roomnote','Uit = direct onzichtbaar voor gasten en de backoffice, zonder telefoontjes.')+'</div>';
    html += '</div>';
    el.innerHTML = html;
    el.querySelectorAll('[data-rtoggle]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/room/toggle', { id: b.dataset.rtoggle }); await refresh(); openTab('rooms'); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-hk]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.hk, st = b.dataset.hkst;
      if (st === 'defect'){ hkDefectFor = id; renderRooms(); openTab('rooms'); const n = $('#hkNote'); if (n) n.focus(); return; }
      hkDefectFor = null;
      try { await API.call('/supplier/room/hk', { id, status: st }); await refresh(); openTab('rooms'); } catch(e){ toast(e.message); }
    }));
    const hkOk = $('#hkNoteOk'); if (hkOk) hkOk.addEventListener('click', async () => {
      const note = ($('#hkNote').value || '').trim();
      const id = hkDefectFor; hkDefectFor = null;
      try { await API.call('/supplier/room/hk', { id, status: 'defect', note }); toast(T('hk.reported','Defect gemeld, klus staat klaar voor onderhoud en de kamer is uit de verkoop.')); await refresh(); openTab('rooms'); }
      catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-rdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/room/remove', { id: b.dataset.rdel }); toast(T('sup.roomremoved','Kamer verwijderd.')); await refresh(); openTab('rooms'); } catch(e){ toast(e.message); }
    }));
    const add = $('#rmAdd'); if (add) add.addEventListener('click', async () => {
      const name = $('#rmName').value.trim(), price = Number($('#rmPrice').value);
      if (!name || !(price>0)){ toast(T('sup.roomfill','Vul een kamernaam en prijs in.')); return; }
      try { await API.call('/supplier/room/add', { name, price }); toast(T('sup.roomadded','Kamer toegevoegd en direct zichtbaar.')); await refresh(); openTab('rooms'); } catch(e){ toast(e.message); }
    });
    laadReceptie();
    laadPlanning();
  }

  /* De kamerkalender: veertien dagen vooruit, per kamer een rij blokjes.
     Goud = bevestigd, merkrood = ingecheckt; tik-tekst (title) toont wie. */
  async function laadPlanning(){
    const el = $('#planWrap'); if (!el) return;
    let p; try { p = await API.call('/supplier/kamerplanning', {}); } catch(e){ el.innerHTML = ''; return; }
    if (!p.kamers.length){ el.innerHTML = ''; return; }
    const dagLabel = d => d.slice(8, 10);
    el.innerHTML = '<div class="card"><div class="tt-h">🗓 '+T('rc.plan','Kamerkalender')+' <span class="sub">('+p.dagen.length+' '+T('vr.dagen','dagen')+')</span></div>'+
      '<div style="display:flex;gap:2px;margin:0.5rem 0 0.15rem;padding-left:96px;overflow:hidden;">'+p.dagen.map(d => '<span style="width:16px;flex-shrink:0;font-size:0.55rem;color:var(--soft);text-align:center;">'+dagLabel(d)+'</span>').join('')+'</div>'+
      p.kamers.map(k => '<div style="display:flex;align-items:center;gap:0;margin-top:3px;">'+
        '<span style="width:96px;flex-shrink:0;font-size:0.7rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:6px;">'+esc(k.name)+'</span>'+
        '<span style="display:flex;gap:2px;overflow:hidden;">'+k.dagen.map(d =>
          '<span title="'+d.datum+(d.codenaam?', '+esc(d.codenaam):'')+'" style="width:16px;height:16px;flex-shrink:0;border-radius:3px;border:1px solid var(--line);background:'+
          (d.status==='ingecheckt'?'#7F1734':d.status==='bevestigd'?'#A98F1C':'transparent')+';"></span>').join('')+'</span>'+
      '</div>').join('')+
      '<div class="softline" style="margin-top:0.45rem;">'+T('rc.plan.s','Goud is bevestigd, rood slaapt er nu; leeg is vrij om te verkopen.')+'</div></div>';
  }

