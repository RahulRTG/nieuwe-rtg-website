    if (rec.length) h += '<div class="card"><div class="tt-h">📖 '+T('vr.recepten','Recepten en marge')+'</div>'+
      rec.map(r => '<div style="border-bottom:1px solid var(--line);padding:0.4rem 0;">'+
        '<div class="st-row"><span><b>'+esc(r.naam)+'</b> <span class="sub">'+geld(r.prijs)+(r.regels.length?' · '+T('vr.kost','kost')+' '+geld(r.kostprijs)+' · '+T('vr.marge','marge')+' '+geld(r.marge)+(r.margePct!=null?' ('+r.margePct+'%)':''):'')+'</span></span>'+
        (mgr?'<button class="obtn ghost" data-vrec="'+r.id+'">'+(r.regels.length?T('vr.rbew','Recept'):T('vr.rzet','+ Recept'))+'</button>':'')+'</div>'+
        (r.regels.length?'<div class="sub">'+r.regels.map(x=>x.hoeveelheid+' '+esc(x.eenheid)+' '+esc(x.naam)).join(' · ')+'</div>':'')+
        '</div>').join('')+
      '<div class="softline" style="margin-top:0.3rem;">'+T('vr.rec.s','Elke kassabon en betaalde bestelling boekt de ingredienten automatisch af via het recept.')+'</div></div>';
    // menu-engineering: volume maal marge, in de klassieke kwadranten
    if (ma && (ma.rijen||[]).some(r => r.verkocht > 0 || r.heeftRecept)){
      const KLASSE = { ster: ['⭐', '#D8B940'], werkpaard: ['🐴', '#69B98B'], puzzel: ['🧩', '#7FA6D9'], hond: ['🐕', '#FF8589'], onbekend: ['·', 'var(--soft)'] };
      h += '<div class="card"><div class="tt-h">📊 '+T('vr.me','Menu-engineering')+' <span class="sub">('+ma.dagen+' '+T('vr.dagen','dagen')+')</span></div>'+
        ma.rijen.map(r => '<div style="border-bottom:1px solid var(--line);padding:0.35rem 0;">'+
          '<div class="st-row"><span><b style="color:'+KLASSE[r.klasse][1]+';">'+KLASSE[r.klasse][0]+' '+esc(r.klasse)+'</b> '+esc(r.naam)+'</span>'+
          '<span class="sub">'+r.verkocht+'× · '+T('vr.marge','marge')+' '+geld(r.marge)+' · '+T('vr.winst','winst')+' '+geld(r.brutowinst)+'</span></div>'+
          '<div class="sub">'+esc(r.advies)+'</div></div>').join('')+
        (mgr?'<button class="bigbtn" id="vrPlan" style="margin-top:0.5rem;">🧠 '+T('vr.plan','Vraag het actieplan')+'</button><div id="vrPlanUit"></div>':'')+'</div>';
    }
    // het logboek: elke beweging herleidbaar
    if ((d.logboek||[]).length) h += '<div class="card"><div class="tt-h">🧾 '+T('vr.log','Laatste bewegingen')+'</div>'+
      d.logboek.slice(0,8).map(l => '<div class="st-row"><span>'+esc(l.artikel)+' <span class="sub">'+esc(l.soort)+' · '+esc(l.oms||'')+' · '+esc(l.wie||'')+'</span></span><b'+(l.delta<0?' style="color:#FF8589;"':' style="color:#69B98B;"')+'>'+(l.delta>0?'+':'')+l.delta+'</b></div>').join('')+'</div>';
    if (mgr) h += '<div class="card"><div class="tt-h">'+T('vr.nieuw','Nieuw item')+'</div>'+
      '<div class="row-gap" style="margin-top:0.5rem;"><input class="st-in" id="vrNaam" placeholder="'+T('vr.naam','Naam, bijv. Cava brut')+'" style="flex:2;">'+
      '<input class="st-in" id="vrAantal" type="number" min="0" placeholder="'+T('vr.aantal','aantal')+'" style="flex:1;">'+
      '<input class="st-in" id="vrMin" type="number" min="0" placeholder="'+T('vr.mindr','min.')+'" style="flex:1;">'+
      '<input class="st-in" id="vrEenheid" placeholder="'+T('vr.eenheid','eenheid (fles, kg...)')+'" style="flex:1;">'+
      '<input class="st-in" id="vrKost" type="number" min="0" step="0.01" placeholder="'+T('vr.kostph','€/eenheid')+'" style="flex:1;"></div>'+
      '<button class="bigbtn" id="vrAdd" style="margin-top:0.5rem;">'+T('vr.voeg','Zet op de lijst')+'</button></div>';
    el.innerHTML = h;
    const doe = async (pad, body) => { try { await API.call(pad, body); renderVoorraad(); } catch(e){ toast(e.message); } };
    // een knop: het advies wordt een echte groothandelsbestelling
    const vb = el.querySelector('#vrBestel'); if (vb) vb.addEventListener('click', async () => {
      try {
        const markt = await API.call('/supplier/inkoop/markt', {});
        const ghs = markt.groothandels || [];
        if (!ghs.length){ toast(T('vr.geengh','Er is nog geen groothandel actief op het platform.')); return; }
        let code = ghs[0].code;
        if (ghs.length > 1){
          const keuze = prompt(T('vr.welkegh','Welke groothandel? ') + ghs.map(g=>g.code+' ('+g.naam+')').join(', '), code);
          if (!keuze) return;
          code = keuze.trim().toUpperCase();
        }
        const r = await API.call('/supplier/keuken/bestel-advies', { groothandelCode: code });
        toast('🛒 '+T('vr.besteld','Bestelling ')+r.order.ref+' '+T('vr.besteld2','geplaatst.')+(r.nietGevonden.length?' '+T('vr.nietgev','Niet in het assortiment: ')+r.nietGevonden.join(', '):''));
        renderVoorraad();
      } catch(e){ toast(e.message); }
    });
    // het actieplan van de chef-adviseur: kwadranten plus derving, in euro's
    const vp = el.querySelector('#vrPlan'); if (vp) vp.addEventListener('click', async () => {
      const uit = el.querySelector('#vrPlanUit');
      uit.innerHTML = '<div class="softline" style="margin-top:0.4rem;">'+T('vr.plan.laden','De adviseur rekent...')+'</div>';
      try {
        const p = await API.call('/supplier/keuken/menu-advies', {});
        uit.innerHTML = '<div class="sub" style="margin-top:0.5rem;">'+esc(p.samenvatting)+'</div>'+
          (p.acties||[]).map(x => '<div style="border-top:1px solid var(--line);padding:0.35rem 0;font-size:0.82rem;">'+
            (x.impact?'<b style="color:var(--gold);">'+geld(x.impact)+'</b> · ':'')+esc(x.tekst)+'</div>').join('');
      } catch(e){ uit.innerHTML = ''; toast(e.message); }
    });
    el.querySelectorAll('[data-vtel]').forEach(b => b.addEventListener('click', () => {
      const g = prompt(T('vr.telvraag','Wat is de getelde stand?')); if (g == null || g === '') return;
      doe('/supplier/keuken/telling', { artikelId: b.dataset.vtel, geteld: Number(String(g).replace(',', '.')) });
    }));
    el.querySelectorAll('[data-vderf]').forEach(b => b.addEventListener('click', () => {
      const hv = prompt(T('vr.derfvraag','Hoeveel is er weg (breuk, derving)?')); if (hv == null || hv === '') return;
      const reden = prompt(T('vr.derfreden','Reden?')) || '';
      doe('/supplier/keuken/verspilling', { artikelId: b.dataset.vderf, hoeveelheid: Number(String(hv).replace(',', '.')), reden });
    }));
    el.querySelectorAll('[data-vlev]').forEach(b => b.addEventListener('click', () => {
      const hv = prompt(T('vr.levvraag','Hoeveel is er geleverd?')); if (hv == null || hv === '') return;
      const k = prompt(T('vr.levkost','Inkoopprijs per eenheid in euro (leeg = ongewijzigd)?'));
      doe('/supplier/keuken/levering', { artikelId: b.dataset.vlev, hoeveelheid: Number(String(hv).replace(',', '.')), kostprijs: k ? Number(String(k).replace(',', '.')) : undefined });
    }));
    el.querySelectorAll('[data-vweg]').forEach(b => b.addEventListener('click', () => doe('/supplier/voorraad/zet', { id: b.dataset.vweg, weg: true })));
    el.querySelectorAll('[data-vrec]').forEach(b => b.addEventListener('click', () => {
      const r = rec.find(x => x.id === b.dataset.vrec); if (!r) return;
      // compact recept-bewerken: "hoeveelheid x artikelnaam" per regel
      const huidig = r.regels.map(x => x.hoeveelheid + ' x ' + x.naam).join('\n');
      const inp = prompt(T('vr.recvraag','Recept voor ') + r.naam + T('vr.recuitleg',': per regel "hoeveelheid x artikelnaam", bijv. "0.2 x Lamsrack".'), huidig);
      if (inp == null) return;
      const regels = inp.split('\n').map(x => {
        const m = /^\s*([\d.,]+)\s*[xX]\s*(.+)$/.exec(x); if (!m) return null;
        const a = vs.find(v => v.naam.toLowerCase() === m[2].trim().toLowerCase());
        return a ? { artikelId: a.id, hoeveelheid: Number(m[1].replace(',', '.')) } : null;
      }).filter(Boolean);
      doe('/supplier/keuken/recept', { menuItemId: r.id, regels });
    }));
    const va = $('#vrAdd'); if (va) va.addEventListener('click', async () => {
      const naam = $('#vrNaam').value.trim(); if (!naam) return;
      try {
        await API.call('/supplier/voorraad/zet', { naam, aantal: Number($('#vrAantal').value)||0, min: Number($('#vrMin').value)||0, eenheid: $('#vrEenheid').value.trim(), kostprijs: Number(String($('#vrKost').value).replace(',', '.'))||0 });
        renderVoorraad();
      } catch(e){ toast(e.message); }
    });
  }

  // ---- meldingen ----
  function renderBell(){
    const unread = notifs.filter(n=>!n.read).length;
    const b = $('#bellBadge'); b.style.display = unread>0?'flex':'none'; b.textContent = unread>9?'9+':unread;
    $('#notifList').innerHTML = notifs.length ? notifs.map(n =>
      '<div class="notif-item'+(n.read?'':' unread')+'"><div class="ic">'+(n.icon||'•')+'</div><div class="tx"><b>'+n.title+'</b><span>'+n.body+'</span><time>'+timeAgo(n.at)+'</time></div></div>'
    ).join('') : '<div class="empty">'+T('sup.nonotif','Nog geen meldingen. Nieuwe bestellingen en betalingen ziet u hier live.')+'</div>';
  }
