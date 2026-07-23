  // ---- slimme deuren (appartementen) ----
  function renderDoors(){
    const el = $('#doorsWrap'); if (!el) return;
    const doors = state.doors;
    if (!Array.isArray(doors)){ el.innerHTML = ''; return; }
    el.innerHTML = '<div class="card">'+
      (doors.length ? doors.map(d =>
        '<div class="door-row'+(d.locked?'':' open')+'">'+
          '<span class="dl">'+(d.locked?'':'')+'</span>'+
          '<div class="dt"><b>'+d.name+'</b><span>'+(d.locked?T('door.locked','Vergrendeld'):T('door.open','OPEN, vergrendelt zichzelf'))+
            (d.lastBy?' · '+T('door.lastby','laatst:')+' '+d.lastBy+(d.lastAt?', '+timeAgo(d.lastAt):''):'')+'</span></div>'+
          '<button class="obtn'+(d.locked?' primary':' warn')+'" data-door="'+d.id+'">'+(d.locked?T('door.openbtn','Open 10 sec'):T('door.lockbtn','Vergrendel nu'))+'</button>'+
        '</div>'
      ).join('') : '<div class="softline">'+T('door.none','Nog geen digitale deuren gekoppeld.')+'</div>')+
      '<div class="note-soft">'+T('door.note','Elke opening komt in de activiteitenfeed: wie, welke deur, wanneer. Gearriveerde gasten kunnen de voordeur zelf openen via hun app.')+'</div>'+
    '</div>';
    el.querySelectorAll('[data-door]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/door/toggle', { id: b.dataset.door }); await refresh(); openTab('doors'); }
      catch(e){ toast(e.message); }
    }));
  }

  // ---- gasten live volgen (hotel/appartement) ----
  // het zorgprofiel van de gast, kort en leesbaar op een regel
  function zorgTekst(z){
    const parts = [];
    if ((z.allergenen || []).length) parts.push(T('zorg.allergie', 'Allergie') + ': ' + z.allergenen.join(', '));
    if (z.dieet) parts.push(z.dieet);
    if (z.medisch) parts.push(z.medisch);
    return parts.join(' · ');
  }
  // live meekijken met toestemming: de gast wijst de zaak aan, de zaak stopt het
  let gastLoc = null, gastLocBezig = false, gastLocAt = 0;
