  function renderBeheer(){
    const el = $('#beheerWrap'); if (!el) return;
    if (!actor().manager){
      el.innerHTML = '<div class="card"><div style="font-size:0.84rem;color:var(--muted);">'+T('bh.only','Alleen managers en chefs kunnen instellingen aanpassen. Vraag uw manager.')+'</div></div>';
      return;
    }
    const st = state.settings || { ordersOpen: true, reservationsOpen: true };
    const row = (key, label, sub, on) =>
      '<div class="room-row"><div class="rr-t"><b>'+label+'</b><span>'+sub+'</span></div>'+
      '<button class="rr-toggle'+(on?' on':'')+'" data-set="'+key+'" data-val="'+(!on)+'"><span></span></button></div>';
    el.innerHTML = '<div class="card">'+
      row('ordersOpen', T('bh.orders','Bestellingen'), on1(st.ordersOpen), st.ordersOpen) +
      row('reservationsOpen', T('bh.res','Reserveringen'), on1(st.reservationsOpen), st.reservationsOpen) +
      row('luchtzijde', '✈ '+T('bh.lucht','Luchtzijde'),
        st.luchtzijde ? T('bh.luchtaan','Aan: boarding pass aan de deur, dubbele prijzen op de kassa (+')+(st.luchtToeslagPct==null?15:st.luchtToeslagPct)+'%)'
          : T('bh.luchtuit','Uit: de zaak staat niet op een luchthaven'), !!st.luchtzijde) +
      (st.luchtzijde ? '<div class="tt-add"><input id="bhLuchtPct" type="number" min="0" max="100" inputmode="numeric" value="'+(st.luchtToeslagPct==null?15:st.luchtToeslagPct)+'" style="width:6rem;"><button id="bhLuchtPctZet">'+T('bh.pctzet','Toeslag % opslaan')+'</button></div>' : '')+
      '<div class="note-soft">'+T('bh.note','Dicht = leden kunnen direct niet meer bestellen of reserveren; de kaart blijft zichtbaar. Alles wordt gelogd.')+'</div></div>'+
      '<div class="card"><div class="tt-h">'+T('bh.more','Verder beheren')+'</div>'+
      '<div style="margin-top:0.5rem;font-size:0.82rem;color:var(--muted);line-height:1.7;">'+T('bh.tips','Menukaart bewerken doet u onder Menu. Tafels onder Tafels. Kamers en prijzen onder Kamers. Personeel en pincodes onder Team.')+'</div></div>'+
      '<div class="card"><div class="tt-h">🗄️ '+T('ug.h','Officiele documentatie overschrijven')+'</div>'+
      '<div style="margin-top:0.4rem;font-size:0.78rem;color:var(--muted);line-height:1.6;">'+T('ug.sub','Met een druk op de knop naar uw oude apparatuur of een harde schijf, altijd achter het vier- of zes-ogenprincipe: 4 ogen = twee collega\'s tekenen, 6 ogen = drie. De bundel komt een keer vrij; daarna start u een nieuwe uitgifte.')+'</div>'+
      '<div class="tt-add" style="flex-wrap:wrap;"><select id="ugBron" style="background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:0 0.7rem;font-size:0.8rem;color:var(--txt);outline:none;"></select>'+
      '<select id="ugOgen" style="background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:0 0.7rem;font-size:0.8rem;color:var(--txt);outline:none;"><option value="4">4 ogen (2 pers.)</option><option value="6">6 ogen (3 pers.)</option></select>'+
      '<input id="ugDoel" placeholder="'+T('ug.doel','Doel, bijv. harde schijf archief')+'" style="flex:1;min-width:110px;">'+
      '<button id="ugStart">⬇ '+T('ug.start','Start uitgifte')+'</button></div>'+
      '<div id="ugLijst"></div></div>';
    function on1(v){ return v ? T('bh.open','Open, gasten kunnen dit nu gebruiken') : T('bh.closed','Dicht, tijdelijk niet beschikbaar'); }
    el.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/settings', { [b.dataset.set]: b.dataset.val === 'true' }); toast(T('bh.saved','Opgeslagen, leden zien het direct.')); await refresh(); openTab('beheer'); } catch(e){ toast(e.message); }
    }));
    const lp = $('#bhLuchtPctZet'); if (lp) lp.addEventListener('click', async () => {
      try { await API.call('/supplier/settings', { luchtToeslagPct: Number($('#bhLuchtPct').value) }); toast(T('bh.saved','Opgeslagen, leden zien het direct.')); await refresh(); openTab('beheer'); } catch(e){ toast(e.message); }
    });
    const us = $('#ugStart'); if (us) us.addEventListener('click', async () => {
      try { await API.call('/supplier/uitgifte/start', { bron: $('#ugBron').value, ogen: Number($('#ugOgen').value), doel: $('#ugDoel').value });
        toast(T('ug.gestart','Uitgifte gestart; laat een collega meetekenen.')); laadUitgifte(); } catch(e){ toast(e.message); }
    });
    laadUitgifte();
  }
  /* De documentenuitgifte (4/6-ogen): lijst, meetekenen en de bundel als
     download naar de schijf. Andere ogen = een andere collega logt in en
     tekent; de server bewaakt dat dezelfde naam nooit dubbel telt. */
  async function laadUitgifte(){
    const el = $('#ugLijst'); if (!el) return;
    let r; try { r = await API.call('/supplier/uitgifte', {}); } catch(e){ return; }
    const bron = $('#ugBron');
    if (bron && !bron.options.length) bron.innerHTML = r.bronnen.map(b => '<option value="'+b.id+'">'+b.label+'</option>').join('');
    el.innerHTML = (r.uitgiften||[]).slice(0,6).map(u =>
      '<div class="st-row"><span>'+u.code+' · '+esc(u.bronLabel)+' · '+u.ogen+' ogen<br><span class="sub">'+u.handtekeningen.map(h=>esc(h.door)).join(' + ')+' → '+esc(u.doel)+'</span></span>'+
      (u.status==='wacht-op-ogen' ? '<button class="obtn" data-ugteken="'+u.id+'">✍ '+T('ug.teken','Teken mee')+' ('+u.nogNodig+')</button>'
        : u.status==='vrijgegeven' ? '<button class="obtn primary" data-ugdl="'+u.id+'">⬇ '+T('ug.dl','Overschrijven')+'</button>'
        : '<span class="sub">✓ '+T('ug.klaar','overgeschreven')+'</span>')+'</div>').join('') || '<div class="softline">'+T('ug.leeg','Nog geen uitgiften.')+'</div>';
    el.querySelectorAll('[data-ugteken]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/uitgifte/teken', { id: b.dataset.ugteken }); toast(T('ug.getekend','Getekend.')); laadUitgifte(); } catch(e){ toast(e.message); }
    }));
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
    html += '<div class="tt-add" style="flex-wrap:wrap;"><input id="tkText" placeholder="' + T('tk.newph','Nieuwe klus, bijv. lamp vervangen') + '" style="flex:2;min-width:140px;">' +
      '<select id="tkRoom" style="background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:0 0.7rem;font-size:0.8rem;color:var(--txt);outline:none;"><option value="">' + T('tk.noroom','Algemeen') + '</option>' + roomOpts + '</select>' +
      '<button id="tkAdd">' + T('team.add','Toevoegen') + '</button></div>';
    if (done.length) html += '<div class="tt-h" style="margin-top:1rem;">' + T('tk.donelist','Afgerond') + '</div>' + done.map(t =>
      '<div class="tk-row done"><div class="tk-t"><b>' + t.text + '</b><span>' + (t.doneBy || '') + (t.doneAt ? ' · ' + timeAgo(t.doneAt) : '') + '</span></div><span class="pill klaar">✓</span></div>').join('');
    html += '</div>';

    html += '<div class="card"><div class="tt-h">' + T('lf.h','Gevonden voorwerpen') + '</div>';
    const kept = lost.filter(l => l.status === 'bewaard');
    html += kept.length ? kept.map(l =>
      '<div class="tk-row"><div class="tk-t"><b>' + l.item + '</b><span>' + (l.room ? l.room + ' · ' : '') + (l.storage ? T('lf.at','ligt bij') + ' ' + l.storage + ' · ' : '') + l.by + ' · ' + timeAgo(l.at) + '</span></div>' +
      '<button class="obtn" data-lf="' + l.id + '">' + T('lf.picked','Opgehaald') + '</button></div>'
    ).join('') : '<div class="softline">' + T('lf.none','Niets in bewaring.') + '</div>';
    html += '<div class="tt-add" style="flex-wrap:wrap;"><input id="lfItem" placeholder="' + T('lf.itemph','Voorwerp, bijv. zonnebril') + '" style="flex:2;min-width:120px;">' +
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
          '<span class="dl">'+(d.locked?'🔒':'🔓')+'</span>'+
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
