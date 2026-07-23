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
      row('luchtzijde', ''+T('bh.lucht','Luchtzijde'),
        st.luchtzijde ? T('bh.luchtaan','Aan: boarding pass aan de deur, dubbele prijzen op de kassa (+')+(st.luchtToeslagPct==null?15:st.luchtToeslagPct)+'%)'
          : T('bh.luchtuit','Uit: de zaak staat niet op een luchthaven'), !!st.luchtzijde) +
      (st.luchtzijde ? '<div class="tt-add"><input id="bhLuchtPct" type="number" min="0" max="100" inputmode="numeric" value="'+(st.luchtToeslagPct==null?15:st.luchtToeslagPct)+'" style="width:6rem;"><button id="bhLuchtPctZet">'+T('bh.pctzet','Toeslag % opslaan')+'</button></div>' : '')+
      '<div class="note-soft">'+T('bh.note','Dicht = leden kunnen direct niet meer bestellen of reserveren; de kaart blijft zichtbaar. Alles wordt gelogd.')+'</div></div>'+
      '<div class="card"><div class="tt-h">'+T('bh.more','Verder beheren')+'</div>'+
      '<div style="margin-top:0.5rem;font-size:0.82rem;color:var(--muted);line-height:1.7;">'+T('bh.tips','Menukaart bewerken doet u onder Menu. Tafels onder Tafels. Kamers en prijzen onder Kamers. Personeel en pincodes onder Team.')+'</div></div>'+
      '<div class="card"><div class="tt-h">'+T('ug.h','Officiele documentatie overschrijven')+'</div>'+
      '<div style="margin-top:0.4rem;font-size:0.78rem;color:var(--muted);line-height:1.6;">'+T('ug.sub','Met een druk op de knop naar uw oude apparatuur of een harde schijf, altijd achter het vier- of zes-ogenprincipe: 4 ogen = twee collega\'s tekenen, 6 ogen = drie. De bundel komt een keer vrij; daarna start u een nieuwe uitgifte.')+'</div>'+
      '<div class="tt-add" style="flex-wrap:wrap;"><select id="ugBron" style="background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:0 0.7rem;font-size:0.8rem;color:var(--txt);outline:none;"></select>'+
      '<select id="ugOgen" style="background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:0 0.7rem;font-size:0.8rem;color:var(--txt);outline:none;"><option value="4">4 ogen (2 pers.)</option><option value="6">6 ogen (3 pers.)</option></select>'+
      '<input id="ugDoel" placeholder="'+T('ug.doel','Doel, bijv. harde schijf archief')+'" style="flex:1;min-width:110px;">'+
      '<button id="ugStart">'+T('ug.start','Start uitgifte')+'</button></div>'+
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
      (u.status==='wacht-op-ogen' ? '<button class="obtn" data-ugteken="'+u.id+'">'+T('ug.teken','Teken mee')+' ('+u.nogNodig+')</button>'
        : u.status==='vrijgegeven' ? '<button class="obtn primary" data-ugdl="'+u.id+'">'+T('ug.dl','Overschrijven')+'</button>'
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

