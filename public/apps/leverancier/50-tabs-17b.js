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

