/* een uitgiftebundel openen */
    el.querySelectorAll('[data-ugdl]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/supplier/uitgifte/bundel', { id: b.dataset.ugdl });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([d.blad], { type: 'text/plain' }));
        a.download = d.bestandsnaam; a.click(); URL.revokeObjectURL(a.href);
        toast(T('ug.over','Overgeschreven; sla het bestand op de schijf op.')); laadUitgifte();
      } catch(e){ toast(e.message); }
    }));
  }

  // ---- klussen (onderhoud) + gevonden voorwerpen ----
  function renderKlussen(){
    const el = $('#klussenWrap'); if (!el) return;
    if (!has('bookings')){ el.innerHTML = ''; return; }
    const tickets = state.tickets || [];
    const lost = state.lostfound || [];
    const open = tickets.filter(t => t.status !== 'klaar');
    const done = tickets.filter(t => t.status === 'klaar').slice(0, 6);
    const roomOpts = (state.rooms || []).map(r => '<option value="' + r.name.replace(/"/g,'&quot;') + '">' + r.name + '</option>').join('');

    let html = '<div class="card"><div class="tt-h">' + T('tk.open','Openstaande klussen') + ' (' + open.length + ')</div>';
    html += open.length ? open.map(t =>
      '<div class="tk-row"><div class="tk-t"><b>' + t.text + '</b><span>' + (t.room ? t.room + ' · ' : '') + t.by + ' · ' + timeAgo(t.at) + '</span></div>' +
      '<span class="pill ' + (t.status === 'bezig' ? 'bereiding' : 'nieuw') + '">' + (t.status === 'bezig' ? T('tk.busy','bezig') : T('tk.new','open')) + '</span>' +
      (t.status === 'open'
        ? '<button class="obtn primary" data-tk="' + t.id + '" data-tkst="bezig">' + T('tk.pickup','Oppakken') + '</button>'
        : '<button class="obtn primary" data-tk="' + t.id + '" data-tkst="klaar">' + T('tk.done','Klaar') + '</button>') +
      '</div>'
    ).join('') : '<div style="font-size:0.82rem;color:var(--green);padding:0.6rem 0;">✓ ' + T('tk.none','Geen openstaande klussen.') + '</div>';
    html += '<div class="tt-add h-wrap"><input id="tkText" placeholder="' + T('tk.newph','Nieuwe klus, bijv. lamp vervangen') + '" style="flex:2;min-width:140px;">' +
      '<select id="tkRoom" style="background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:0 0.7rem;font-size:0.8rem;color:var(--txt);outline:none;"><option value="">' + T('tk.noroom','Algemeen') + '</option>' + roomOpts + '</select>' +
      '<button id="tkAdd">' + T('team.add','Toevoegen') + '</button></div>';
    if (done.length) html += '<div class="tt-h h-mt100">' + T('tk.donelist','Afgerond') + '</div>' + done.map(t =>
      '<div class="tk-row done"><div class="tk-t"><b>' + t.text + '</b><span>' + (t.doneBy || '') + (t.doneAt ? ' · ' + timeAgo(t.doneAt) : '') + '</span></div><span class="pill klaar">✓</span></div>').join('');
    html += '</div>';

    html += '<div class="card"><div class="tt-h">' + T('lf.h','Gevonden voorwerpen') + '</div>';
    const kept = lost.filter(l => l.status === 'bewaard');
    html += kept.length ? kept.map(l =>
      '<div class="tk-row"><div class="tk-t"><b>' + l.item + '</b><span>' + (l.room ? l.room + ' · ' : '') + (l.storage ? T('lf.at','ligt bij') + ' ' + l.storage + ' · ' : '') + l.by + ' · ' + timeAgo(l.at) + '</span></div>' +
      '<button class="obtn" data-lf="' + l.id + '">' + T('lf.picked','Opgehaald') + '</button></div>'
    ).join('') : '<div class="softline">' + T('lf.none','Niets in bewaring.') + '</div>';
    html += '<div class="tt-add h-wrap"><input id="lfItem" placeholder="' + T('lf.itemph','Voorwerp, bijv. zonnebril') + '" style="flex:2;min-width:120px;">' +
      '<input id="lfStorage" placeholder="' + T('lf.storageph','Bewaarplek') + '" style="flex:1;min-width:90px;">' +
      '<select id="lfRoom" style="background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:0 0.7rem;font-size:0.8rem;color:var(--txt);outline:none;"><option value="">' + T('lf.noroom','Elders') + '</option>' + roomOpts + '</select>' +
      '<button id="lfAdd">' + T('team.add','Toevoegen') + '</button></div></div>';

    el.innerHTML = html;
    el.querySelectorAll('[data-tk]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/ticket/status', { id: b.dataset.tk, status: b.dataset.tkst }); await refresh(); openTab('klussen'); } catch(e){ toast(e.message); }
    }));
    const ta = $('#tkAdd'); if (ta) ta.addEventListener('click', async () => {
      const text = $('#tkText').value.trim();
      if (!text){ toast(T('tk.fill','Omschrijf de klus.')); return; }
      try { await API.call('/supplier/ticket/add', { text, room: $('#tkRoom').value }); toast(T('tk.added','Klus gemeld.')); await refresh(); openTab('klussen'); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-lf]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/lost/done', { id: b.dataset.lf }); toast(T('lf.pickedtoast','Meegegeven en afgemeld.')); await refresh(); openTab('klussen'); } catch(e){ toast(e.message); }
    }));
    const la = $('#lfAdd'); if (la) la.addEventListener('click', async () => {
      const item = $('#lfItem').value.trim();
      if (!item){ toast(T('lf.fill','Omschrijf het voorwerp.')); return; }
      try { await API.call('/supplier/lost/add', { item, storage: $('#lfStorage').value, room: $('#lfRoom').value }); toast(T('lf.added','Geregistreerd.')); await refresh(); openTab('klussen'); } catch(e){ toast(e.message); }
    });
  }

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
  function laadGastLoc(){
    if (gastLocBezig || Date.now() - gastLocAt < 15000) return;
    gastLocBezig = true;
    API.call('/supplier/gastlocaties', {})
      .then(d => { gastLoc = d.gasten || []; gastLocAt = Date.now(); gastLocBezig = false; renderGasten(); })
      .catch(() => { gastLoc = gastLoc || []; gastLocAt = Date.now(); gastLocBezig = false; });
  }
  function gastLocBlok(){
    const lijst = gastLoc || [];
    return '<div class="card"><div class="tt-h">'+T('gl.h','Live meekijken (met toestemming)')+'</div>'+
      '<div style="font-size:0.75rem;color:var(--soft);margin-bottom:0.5rem;">'+T('gl.sub','De gast deelt zelf de live gps-locatie met uw zaak. Zet het uit zodra u het niet meer nodig heeft; de gast krijgt daar direct bericht van.')+'</div>'+
      (lijst.length ? lijst.map(g =>
        '<div class="guest-row" style="flex-wrap:wrap;gap:0.4rem;"><span class="cn">'+esc(g.codenaam)+'</span>'+
        (g.wachtOpLocatie ? '<span class="ge">'+T('gl.wacht','toestemming, wacht op gps')+'</span>'
          : '<span class="ge"><b>'+(g.km!=null?g.km+' km':'')+'</b>'+(g.etaMin!=null?' · ~'+g.etaMin+' min':'')+'</span>')+
        '<button class="obtn" data-glstop="'+g.id+'" style="font-size:0.62rem;">'+T('gl.stop','Niet meer nodig')+'</button>'+
        (g.zorg ? '<div style="flex-basis:100%;font-size:0.74rem;color:#E2B93B;">'+esc(zorgTekst(g.zorg))+'</div>' : '')+
        '</div>').join('')
      : '<div class="softline">'+T('gl.leeg','Nog geen gasten die hun locatie met u delen.')+'</div>')+'</div>';
  }
  function bindGastLoc(el){
