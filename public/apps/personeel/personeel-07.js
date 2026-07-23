    const afd = pkDorp.afdelingen.find(a => a.key === pkDorpKant) || pkDorp.afdelingen[0];
    pkDorpKant = afd.key;
    pkLaadTools();
    return '<div class="card"><div class="k" style="display:flex;justify-content:space-between;align-items:center;">'+T('pd.dorp','Afdelingen')+
      '<button class="abtn ghost" id="pkDorpChat" style="font-size:0.66rem;">'+T('pd.dorp.chat','Teamchat')+'</button></div>'+
      '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.4rem;">'+pkDorp.afdelingen.map(a =>
        '<button class="abtn'+(a.key===pkDorpKant?'':' ghost')+'" data-pkdkant="'+a.key+'">'+a.icon+(a.openAantal?' '+a.openAantal:'')+'</button>').join('')+'</div>'+
      '<div style="margin-top:0.45rem;font-size:0.72rem;color:var(--soft);">'+afd.icon+' '+esc(afd.label)+' · '+afd.keten.join(' · ')+'</div>'+
      pkToolsHtml()+
      (afd.open.length ? afd.open.map(p => {
        const i = afd.keten.indexOf(p.status);
        const volgende = i >= 0 && i < afd.keten.length - 1 ? afd.keten[i + 1] : null;
        return '<div class="task"><div class="t"><b>'+(p.waar?esc(p.waar)+' · ':'')+esc(p.tekst)+'</b><span>'+esc(p.status)+' · '+esc(p.door)+' · '+timeAgo(p.updatedAt||p.at)+
          ((p.via||[]).length?' · '+T('pd.dorp.via','via')+' '+p.via.map(esc).join(', '):'')+'</span></div>'+
          '<div style="display:flex;gap:0.3rem;">'+(volgende?'<button class="abtn" data-pkdverder="'+p.id+'">'+esc(volgende)+'</button>':'')+
          '<button class="abtn ghost" data-pkdstuur="'+p.id+'" aria-label="doorsturen">↪</button></div></div>';
      }).join('') : '<div style="margin-top:0.4rem;font-size:0.8rem;color:var(--soft);">'+T('pd.dorp.leeg','Niets open bij deze afdeling.')+'</div>')+
      (pkDorpKant === 'concierge' && pkBuurt && pkBuurt.length
        ? '<div style="margin-top:0.5rem;font-size:0.66rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('pd.dorp.buurt','In de buurt')+'</div>'+
          '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.35rem;">'+pkBuurt.map(b =>
            '<button class="abtn ghost" data-pkdbuurt="'+esc(b.naam)+'" data-soort="'+esc(b.soort)+'" data-km="'+b.km+'">'+b.icon+' '+esc(b.naam)+' · '+b.km+' km</button>').join('')+'</div>'
        : '')+
      '<button class="abtn ghost" data-pkdnieuw style="width:100%;margin-top:0.5rem;">+ '+T('pd.dorp.nieuw','Zet iets op de lijst')+'</button></div>';
  }
  // de buurt voor de concierge-kant op zak
  let pkBuurt = null, pkBuurtBezig = false;
  function pkLaadBuurt(){
    if (pkBuurt || pkBuurtBezig) return;
    pkBuurtBezig = true;
    API.call('/supplier/dorp/buurt').then(d => { pkBuurt = d.buurt || []; pkBuurtBezig = false; renderKamers(); })
      .catch(() => { pkBuurt = []; pkBuurtBezig = false; });
  }
  /* opdrachten: de flow voor schoonmaakbedrijven en zzp'ers. Geen kamerbord
     maar de eigen boekingen: bevestigen, op locatie werken en afronden. */
  function renderOpdrachten(wrap){
    const bs = state.boekingen || [];
    const open = bs.filter(b => b.status === 'aangevraagd');
    const komend = bs.filter(b => b.status === 'bevestigd');
    const kaart = (b, acties) => '<div class="card kamer '+(b.status==='bevestigd'?'bezig':'vuil')+'">'+
      '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:0.6rem;"><b style="font-size:0.98rem;">'+esc(b.service && b.service.name || 'Opdracht')+'</b>'+
      '<span class="hkchip'+(b.status==='bevestigd'?' amber':' rood')+'">'+(b.status==='bevestigd'?T('hk.o.bevestigd','Ingepland'):T('hk.o.nieuw','Nieuw'))+'</span></div>'+
      '<div style="font-size:0.78rem;color:var(--soft);margin-top:0.25rem;">'+esc(b.customerCodename||'')+(b.wanneer?' · '+esc(b.wanneer):'')+(b.price?' · '+eur(b.price):'')+'</div>'+
      (b.note?'<div style="font-size:0.78rem;color:var(--muted);margin-top:0.3rem;">'+esc(b.note)+'</div>':'')+
      (b.zorg?'<div style="font-size:0.76rem;color:#E2B93B;margin-top:0.3rem;">'+esc(pkZorg(b.zorg))+'</div>':'')+
      '<div class="row" style="flex-wrap:wrap;">'+acties+'</div></div>';
    let html = '<div class="card stat"><div><b style="color:#FF8589;">'+open.length+'</b><span>'+T('hk.o.nieuw','Nieuw')+'</span></div>'+
      '<div><b style="color:#E2B93B;">'+komend.length+'</b><span>'+T('hk.o.bevestigd','Ingepland')+'</span></div></div>';
    html += open.map(b => kaart(b, '<button class="abtn" data-bk="'+b.ref+'" data-st="bevestigd">✓ '+T('hk.o.bevestig','Bevestig')+'</button><button class="abtn warn" data-bk="'+b.ref+'" data-st="geweigerd">'+T('hk.o.weiger','Weiger')+'</button>')).join('');
    html += komend.map(b => kaart(b, '<button class="abtn" data-bk="'+b.ref+'" data-st="afgerond">✓ '+T('hk.o.klaar','Rond af')+'</button>')).join('');
    if (!open.length && !komend.length) html += '<div class="card">'+T('hk.o.leeg','Geen open opdrachten. Nieuwe boekingen verschijnen hier vanzelf.')+'</div>';
    wrap.innerHTML = html;
    wrap.querySelectorAll('[data-bk]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/booking/status', { ref: b.dataset.bk, status: b.dataset.st }); await refresh(); } catch(e){ toast(e.message); }
    }));
  }
  function minibarBlok(r){
    const mb = (state.minibar && state.minibar.catalog) || [];
    return '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.5rem;">'+
      mb.map(x => '<div class="mbrow"><span style="font-size:0.86rem;">'+esc(x.name)+' <span style="color:var(--soft);font-size:0.74rem;">'+eur(x.price)+'</span></span>'+
        '<span class="q"><button data-mbmin="'+x.id+'" aria-label="minder">−</button><b>'+(mbTel[x.id]||0)+'</b><button data-mbplus="'+x.id+'" aria-label="meer">+</button></span></div>').join('')+
      '<button class="abtn" data-mbboek="'+esc(r.name)+'" style="width:100%;margin-top:0.4rem;">'+T('hk.boek','Boek op de kamer')+'</button></div>';
  }
  function bindKamers(wrap){
    // het hoteldorp: kant kiezen, posten doorzetten, en er iets bij zetten
    wrap.querySelectorAll('[data-pkdkant]').forEach(b => b.addEventListener('click', () => {
      pkDorpKant = b.dataset.pkdkant;
      try { localStorage.setItem('rtg_pda_dorp', pkDorpKant); } catch(e){}
      renderKamers();
    }));
    // het specialistische gereedschap: logmoment, meter en snelposten
    wrap.querySelectorAll('[data-pkdactie]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/dorp/post', { afdeling: pkDorpKant, waar: '', tekst: b.dataset.pkdactie, directKlaar: true }); toast(T('dorp.geklokt','Geklokt.')); pkDorpAt = 0; pkToolsKant = null; pkLaadDorp(); }
      catch(e){ toast(e.message); }
    }));
    // elke afdeling in een tik bij de teamchat, de collegachat en de teamcall
    const pdc = wrap.querySelector('#pkDorpChat');
    if (pdc) pdc.addEventListener('click', () => openTab('team'));
    // de leeftijdscheck: de paspoort-bevestiging geeft ja/nee, nooit gegevens
    wrap.querySelectorAll('[data-pklft]').forEach(b => b.addEventListener('click', async () => {
      const inp = wrap.querySelector('#pkLftIn'), uit = wrap.querySelector('#pkLftUit');
      const codenaam = (inp && inp.value || '').trim();
      if (!codenaam){ toast(T('pd.lft.leeg','Vul de codenaam van de gast in.')); return; }
      const min = Number(b.dataset.pklft);
      try {
        const r = await API.call('/supplier/paspoort/vraag', { codenaam, niveau: 'bevestiging', minLeeftijd: min });
        const ok = r.bevestiging && r.bevestiging.voldoetLeeftijd === true;
        if (navigator.vibrate) navigator.vibrate(ok ? 80 : [200, 80, 200]);
        uit.innerHTML = ok
          ? '<b style="color:var(--green,#7ecb8f);font-size:1rem;">'+esc(codenaam)+' '+T('pd.lft.ja','is')+' '+min+'+</b>'
          : '<b style="color:#E36385;font-size:1rem;">'+esc(codenaam)+' '+T('pd.lft.nee','is NIET aantoonbaar')+' '+min+'+</b>';
      } catch(e){ uit.innerHTML = '<b style="color:#E36385;">'+esc(e.message)+'</b>'; }
    }));
    wrap.querySelectorAll('[data-pkdmeter]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/dorp/drukte', { afdeling: pkDorpKant, stand: b.dataset.pkdmeter }); pkToolsKant = null; pkLaadTools(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-pkdsnelknop]').forEach(b => b.addEventListener('click', async () => {
      const afd = pkDorp && (pkDorp.afdelingen.find(a => a.key === pkDorpKant) || pkDorp.afdelingen[0]);
      if (!afd) return;
      const waar = prompt(afd.waarHint) || '';
      try { await API.call('/supplier/dorp/post', { afdeling: afd.key, waar, tekst: b.dataset.pkdsnelknop }); toast(afd.icon+' '+T('pd.dorp.gezet','Staat op de lijst.')); pkDorpAt = 0; pkToolsKant = null; pkLaadDorp(); }
      catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-pkdverder]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/dorp/verder', { id: b.dataset.pkdverder }); pkDorpAt = 0; pkToolsKant = null; pkLaadDorp(); } catch(e){ toast(e.message); }
    }));
    // doorsturen: de post reist naar een andere afdeling, met het spoor erbij
    wrap.querySelectorAll('[data-pkdstuur]').forEach(b => b.addEventListener('click', async () => {
