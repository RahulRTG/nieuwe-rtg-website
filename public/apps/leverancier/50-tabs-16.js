  // ---- minibar-telling per kamer ----
  let mbRoom = null;       // gekozen kamer
  let mbQty = {};          // artikel-id -> gebruikt aantal
  function renderMinibar(){
    const el = $('#minibarWrap'); if (!el) return;
    const mb = state.minibar;
    if (!mb){ el.innerHTML = ''; return; }
    const rooms = (state.rooms || []).map(r => r.name);
    if (mbRoom && !rooms.includes(mbRoom)) mbRoom = null;

    // telling invoeren
    let html = '<div class="card"><div class="tt-h">' + T('mb.count','Telling invoeren') + '</div>';
    html += '<div class="mb-rooms">' + rooms.map(r => {
      const done = mb.countedToday.includes(r);
      return '<button class="mb-room' + (mbRoom === r ? ' on' : '') + '" data-mbroom="' + r.replace(/"/g,'&quot;') + '">' + (done ? '✓ ' : '') + r + '</button>';
    }).join('') + '</div>';
    if (mbRoom){
      html += '<div style="margin-top:0.8rem;font-size:0.74rem;color:var(--soft);">' + T('mb.howmany','Hoeveel is er gebruikt uit') + ' ' + mbRoom + '?</div>';
      html += mb.catalog.map(m => {
        const q = mbQty[m.id] || 0;
        return '<div class="mb-item"><div class="mi"><b>' + m.name + '</b><span>' + eur(m.price) + '</span></div>' +
          '<div class="qty"><button data-mbmin="' + m.id + '">−</button><b>' + q + '</b><button data-mbplus="' + m.id + '">+</button></div></div>';
      }).join('');
      const total = mb.catalog.reduce((s, m) => s + m.price * (mbQty[m.id] || 0), 0);
      html += '<button class="bigbtn" id="mbSubmit">' + (total > 0
        ? T('mb.register','Registreer telling') + ', ' + eur(total) + ' ' + T('mb.toroom','op de kamer')
        : T('mb.registerzero','Registreer: niets gebruikt')) + '</button>';
    }
    html += '</div>';

    // vandaag-overzicht
    const notCounted = rooms.filter(r => !mb.countedToday.includes(r));
    html += '<div class="card"><div class="tt-h">' + T('mb.today','Vandaag geteld') + ' (' + mb.countedToday.length + '/' + rooms.length + ')</div>' +
      (notCounted.length
        ? '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--amber);">' + T('mb.todo','Nog tellen:') + ' ' + notCounted.join(', ') + '</div>'
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--green);">✓ ' + T('mb.alldone','Alle kamers zijn vandaag geteld.') + '</div>') +
      (mb.recent.length ? mb.recent.map(e =>
        '<div class="pos-sale"><div><b>' + e.room + '</b><span>' + (e.items.length ? e.items.map(i => i.qty + 'x ' + i.name).join(', ') : T('mb.nothing','niets gebruikt')) + ' · ' + e.actor + ' · ' + timeAgo(e.at) + '</span></div>' +
        '<div class="amt" style="font-family:\'Bodoni Moda\',serif;">' + (e.total ? eur(e.total) : '') + '</div></div>').join('') : '') +
      '</div>';

    // catalogus
    html += '<div class="card"><div class="tt-h">' + T('mb.catalog','Catalogus') + '</div>' +
      mb.catalog.map(m => '<div class="pos-sale"><div><b>' + m.name + '</b></div><div class="row-mid-gap"><span class="amt" style="font-family:\'Bodoni Moda\',serif;">' + eur(m.price) + '</span><button class="rr-del" data-mbdel="' + m.id + '">✕</button></div></div>').join('') +
      '<div class="tt-add"><input id="mbName" placeholder="' + T('mb.newitem','Nieuw artikel') + '" style="flex:2;min-width:110px;"><input id="mbPrice" type="number" inputmode="decimal" placeholder="€" style="flex:1;min-width:60px;"><button id="mbAdd">' + T('team.add','Toevoegen') + '</button></div></div>';

    el.innerHTML = html;
    el.querySelectorAll('[data-mbroom]').forEach(b => b.addEventListener('click', () => { mbRoom = b.dataset.mbroom; mbQty = {}; renderMinibar(); openTab('minibar'); }));
    el.querySelectorAll('[data-mbplus]').forEach(b => b.addEventListener('click', () => { mbQty[b.dataset.mbplus] = (mbQty[b.dataset.mbplus] || 0) + 1; renderMinibar(); openTab('minibar'); }));
    el.querySelectorAll('[data-mbmin]').forEach(b => b.addEventListener('click', () => { mbQty[b.dataset.mbmin] = Math.max(0, (mbQty[b.dataset.mbmin] || 0) - 1); renderMinibar(); openTab('minibar'); }));
    const sub = $('#mbSubmit'); if (sub) sub.addEventListener('click', submitMinibar);
    el.querySelectorAll('[data-mbdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/minibar/item/remove', { id: b.dataset.mbdel }); await refresh(); openTab('minibar'); } catch(e){ toast(e.message); }
    }));
    const add = $('#mbAdd'); if (add) add.addEventListener('click', async () => {
      const name = $('#mbName').value.trim(), price = Number($('#mbPrice').value);
      if (!name || !(price > 0)){ toast(T('mb.fill','Vul een artikel en prijs in.')); return; }
      try { await API.call('/supplier/minibar/item/add', { name, price }); toast(T('mb.added','Artikel toegevoegd.')); await refresh(); openTab('minibar'); } catch(e){ toast(e.message); }
    });
  }
  async function submitMinibar(){
    if (!mbRoom) return;
    const items = Object.entries(mbQty).filter(([,q]) => q > 0).map(([id, qty]) => ({ id, qty }));
    try {
      const d = await API.call('/supplier/minibar/count', { room: mbRoom, items });
      toast(d.charged > 0
        ? T('mb.done','Geteld. ') + eur(d.charged) + ' ' + T('mb.charged','op de kamerrekening gezet.')
        : T('mb.donezero','Geteld: niets gebruikt.'));
      mbRoom = null; mbQty = {};
      await refresh(); openTab('minibar');
    } catch(e){ toast(e.message); }
  }

  // ---- tafelindeling (horeca) ----
  const TBL_NEXT = { vrij:'bezet', bezet:'gereserveerd', gereserveerd:'dicht', dicht:'vrij' };
  const TBL_EN = { vrij:'free', bezet:'occupied', gereserveerd:'reserved', dicht:'closed' };
  const tTbl = s => (lang()==='en' ? (TBL_EN[s]||s) : s);
  function renderTafels(){
    const el = $('#tafelsWrap'); if (!el) return;
    const tables = state.tables;
    if (!Array.isArray(tables)){ el.innerHTML = ''; return; }
    const canEdit = actor().manager;
    const free = tables.filter(t=>t.status==='vrij').length;
    let html = '<div class="card"><div class="tt-h">'+T('tbl.floor','Zaal')+' · '+free+'/'+tables.length+' '+T('tbl.free','vrij')+'</div>'+
      '<div class="tbl-grid">'+tables.map(t =>
        '<button class="tbl tbl-'+t.status+'" data-tbl="'+t.id+'"><b>'+t.name+'</b><span>'+t.seats+' '+T('tbl.pers','pers.')+'</span><i>'+tTbl(t.status)+'</i>'+
        (canEdit?'<em class="tbl-del" data-tdel="'+t.id+'">✕</em>':'')+'</button>'
      ).join('')+'</div>'+
      '<div class="note-soft">'+T('tbl.note','Tik een tafel: vrij, bezet, gereserveerd, dicht. Gasten zien live hoeveel tafels vrij zijn.')+'</div>';
    if (canEdit){
      html += '<div class="tt-add"><input id="tblName" placeholder="'+T('tbl.nameph','Bijv. Tafel 7 of Bar links')+'" style="flex:2;min-width:130px;"><input id="tblSeats" type="number" inputmode="numeric" placeholder="4" style="flex:1;min-width:60px;"><button id="tblAdd">'+T('team.add','Toevoegen')+'</button></div>';
    }
    html += '</div>';
    el.innerHTML = html;
    el.querySelectorAll('[data-tbl]').forEach(b => b.addEventListener('click', async e => {
      if (e.target.classList.contains('tbl-del')) return;
      const t = tables.find(x=>x.id===b.dataset.tbl);
      try { await API.call('/supplier/table/status', { id: t.id, status: TBL_NEXT[t.status]||'vrij' }); await refresh(); openTab('tafels'); } catch(err){ toast(err.message); }
    }));
    el.querySelectorAll('[data-tdel]').forEach(x => x.addEventListener('click', async e => {
      e.stopPropagation();
      try { await API.call('/supplier/table/remove', { id: x.dataset.tdel }); await refresh(); openTab('tafels'); } catch(err){ toast(err.message); }
    }));
    const add = $('#tblAdd'); if (add) add.addEventListener('click', async () => {
      const name = $('#tblName').value.trim(), seats = Number($('#tblSeats').value)||2;
      if (!name){ toast(T('tbl.fill','Geef de tafel een naam.')); return; }
      try { await API.call('/supplier/table/add', { name, seats }); await refresh(); openTab('tafels'); } catch(e){ toast(e.message); }
    });
  }

  // ---- beheer: open/dicht-schakelaars (managers/chefs) ----
