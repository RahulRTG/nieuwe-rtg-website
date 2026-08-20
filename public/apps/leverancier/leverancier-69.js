/* de receptie van vandaag */
    el.innerHTML = '<div class="card"><div class="tt-h">'+T('rc.h','Receptie vandaag')+'</div>'+
      '<div class="pos-chips h-mt40">'+
        '<span>'+r.bezetting.bezet+' / '+r.bezetting.totaal+' '+T('rc.bezet','bezet')+'</span>'+
        (r.bezetting.vuil?'<span>'+r.bezetting.vuil+' '+T('rc.vuil','voor housekeeping')+'</span>':'')+
        (r.aanvragen.length?'<span>'+r.aanvragen.length+' '+T('rc.aanvragen','aanvraag(en)')+'</span>':'')+
      '</div>'+
      ((r.hkEerst||[]).length?'<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--burgundy);border:1px solid rgba(194,58,94,0.35);border-radius:10px;padding:0.45rem 0.6rem;">'+T('rc.hkeerst','Housekeeping eerst:')+' <b>'+r.hkEerst.map(esc).join(', ')+'</b> · '+T('rc.hkeerst2','daar komt vandaag alweer een gast aan.')+'</div>':'')+
      (r.aanvragen.length?'<div style="margin-top:0.6rem;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('rc.nieuw','Aanvragen')+'</div>'+r.aanvragen.map(v => rij(v,
        '<button class="obtn primary js-vbok">'+T('res.ok','Bevestig')+'</button><button class="obtn warn js-vbnee">'+T('sup.reject','Weiger')+'</button>')).join(''):'')+
      (r.aankomsten.length?'<div style="margin-top:0.6rem;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('rc.aankomst','Aankomsten')+'</div>'+r.aankomsten.map(v => rij(v,
        '<button class="obtn primary js-vbin">'+T('rc.checkin','Check-in')+'</button><button class="obtn warn js-vbnoshow">'+T('res.noshow','No-show')+'</button>')).join(''):'')+
      (r.inHuis.length?'<div style="margin-top:0.6rem;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('rc.inhuis','In huis')+'</div>'+r.inHuis.map(v => rij(v,
        '<button class="obtn js-vbuit">'+T('rc.checkout','Check-out')+'</button>',
        T('rc.tot','tot')+' '+v.vertrek+(v.vertrek<=r.datum?' · <b style="color:var(--rtg-leesgoud,var(--gold));">'+T('rc.vandaagweg','vertrekt vandaag')+'</b>':'')+(v.openLast?' · '+T('rc.open','rekening')+' <b>'+eur(v.openLast)+'</b>':''))).join(''):'')+
      (r.komend.length?'<div style="margin-top:0.6rem;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('rc.komend','Komende dagen')+'</div>'+r.komend.map(v => rij(v, '')).join(''):'')+
      (leeg?'<div class="softline h-mt50">'+T('rc.leeg','Nog geen verblijven. Zodra een gast boekt, staat het hier.')+'</div>':'')+
      '</div>';
    el.querySelectorAll('[data-vb]').forEach(elv => {
      const id = elv.dataset.vb;
      const doe = async (pad, body, boodschap) => {
        try { await API.call(pad, Object.assign({ id }, body)); if (boodschap) toast(boodschap); await refresh(); laadReceptie(); }
        catch(e){ toast(e.message); }
      };
      const ok = elv.querySelector('.js-vbok'); if (ok) ok.addEventListener('click', () => doe('/supplier/verblijf/beslis', { actie:'bevestig' }, ''+T('rc.oktoast','Bevestigd; de gast hoort het meteen.')));
      const nee = elv.querySelector('.js-vbnee'); if (nee) nee.addEventListener('click', () => doe('/supplier/verblijf/beslis', { actie:'weiger' }, T('rc.neetoast','Geweigerd.')));
      const inb = elv.querySelector('.js-vbin'); if (inb) inb.addEventListener('click', () => doe('/supplier/verblijf/checkin', {}, ''+T('rc.intoast','Ingecheckt; de logies staan op de kamerrekening.')));
      const uit = elv.querySelector('.js-vbuit'); if (uit) uit.addEventListener('click', () => doe('/supplier/verblijf/checkout', {}, T('rc.uittoast','Uitgecheckt; de kamer staat klaar voor housekeeping.')));
      const ns = elv.querySelector('.js-vbnoshow'); if (ns) ns.addEventListener('click', () => doe('/supplier/verblijf/noshow', {}, T('rc.noshowtoast','Gemeld als no-show; de kamer blijft vrij.')));
    });
  }

  function renderRooms(){
    const el = $('#roomsWrap'); if (!el) return;
    const rooms = state.rooms;
    if (!Array.isArray(rooms)){ el.innerHTML = ''; return; }
    let html = '<div id="receptieWrap"></div><div id="planWrap"></div><div class="card">';
    html += rooms.length ? rooms.map(r => {
      const hk = (r.hk && r.hk.status) || 'schoon';
      return '<div class="room-row'+(r.available?'':' off')+' h-wrap">'+
        '<div class="rr-t"><b>'+r.name+' <span class="hk-pill hk-'+hk+'">'+tHk(hk)+'</span>'+
          (r.vroegVrij ? ' <span class="hk-pill hk-schoon">'+T('hk.vroegvrij','vroege check-in')+'</span>' : '')+'</b>'+
          '<span>'+(r.desc||'')+' · '+eur(r.price)+' '+T('sup.pernight','p.n.')+
          (r.hk && r.hk.by ? ' · '+r.hk.by+(r.hk.at?', '+timeAgo(r.hk.at):'') : '')+
          (r.vroegVrij ? ' ·  '+T('hk.vroegvrij2','vrijgegeven door housekeeping')+' ('+r.vroegVrij.door+')' : '')+
          (hk==='defect' && r.hk.note ? ' ·  '+r.hk.note : '')+'</span></div>'+
        '<button class="rr-toggle'+(r.available?' on':'')+'" data-rtoggle="'+r.id+'" aria-label="aan/uit"><span></span></button>'+
        '<button class="rr-del" data-rdel="'+r.id+'">✕</button>'+
        '<div class="hk-chips">'+['schoon','vuil','bezig','bezet','defect'].map(s =>
          '<button class="hk-chip hk-'+s+(hk===s?' on':'')+'" data-hk="'+r.id+'" data-hkst="'+s+'">'+tHk(s)+'</button>').join('')+'</div>'+
        (hkDefectFor===r.id ? '<div class="tt-add" style="width:100%;"><input id="hkNote" placeholder="'+T('hk.noteph','Wat is er kapot?')+'"><button id="hkNoteOk">'+T('hk.report','Meld defect')+'</button></div>' : '')+
      '</div>';
    }).join('') : '<div class="softline">'+T('sup.norooms','Nog geen kamers. Voeg uw eerste kamer toe.')+'</div>';
    html += '<div class="tt-add h-wrap">'+
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
