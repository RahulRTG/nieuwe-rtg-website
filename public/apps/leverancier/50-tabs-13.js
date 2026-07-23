  /* Het receptiebord: vandaag in een oogopslag. Aanvragen bevestigen,
     aankomsten inchecken (de logies gaan meteen als kamerlast op de
     rekening), vertrekken uitchecken; staat er nog iets open, dan wijst
     de check-out naar de kassa. */
  async function laadReceptie(){
    const el = $('#receptieWrap'); if (!el) return;
    let r; try { r = await API.call('/supplier/receptie', {}); } catch(e){ el.innerHTML = ''; return; }
    const leeg = !r.aanvragen.length && !r.aankomsten.length && !r.inHuis.length && !r.komend.length;
    const rij = (v, knoppen, sub) => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.6rem;margin-top:0.55rem;font-size:0.82rem;flex-wrap:wrap;" data-vb="'+v.id+'">'+
      '<span><b class="cn">'+esc(v.codenaam)+'</b> · '+esc(v.roomName)+' · '+(sub||v.aankomst+' tot '+v.vertrek+' · '+v.personen+'p · '+eur(v.totaal))+
      (v.notitie?' ·  '+esc(v.notitie):'')+
      (v.zorg?'<span style="display:block;color:#E2B93B;">'+esc(zorgTekst(v.zorg))+'</span>':'')+'</span>'+
      (knoppen?'<span style="display:flex;gap:0.4rem;flex-shrink:0;flex-wrap:wrap;">'+knoppen+'</span>':'')+
    '</div>';
    el.innerHTML = '<div class="card"><div class="tt-h">'+T('rc.h','Receptie vandaag')+'</div>'+
      '<div class="pos-chips" style="margin-top:0.4rem;">'+
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
        T('rc.tot','tot')+' '+v.vertrek+(v.vertrek<=r.datum?' · <b style="color:var(--gold);">'+T('rc.vandaagweg','vertrekt vandaag')+'</b>':'')+(v.openLast?' · '+T('rc.open','rekening')+' <b>'+eur(v.openLast)+'</b>':''))).join(''):'')+
      (r.komend.length?'<div style="margin-top:0.6rem;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('rc.komend','Komende dagen')+'</div>'+r.komend.map(v => rij(v, '')).join(''):'')+
      (leeg?'<div class="softline" style="margin-top:0.5rem;">'+T('rc.leeg','Nog geen verblijven. Zodra een gast boekt, staat het hier.')+'</div>':'')+
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

