    setTimeout(() => el.classList.remove('on'), 8000);
  }

  function showAlarm(d){
    if (navigator.vibrate) navigator.vibrate([500,150,500,150,800]);
    let el = document.getElementById('alarmOverlay');
    if (!el){
      el = document.createElement('div');
      el.id = 'alarmOverlay';
      document.getElementById('shell').appendChild(el);
      el.addEventListener('click', () => el.classList.remove('on'));
    }
    const locTxt = d.loc ? (d.label ? d.label + ' · ' : '') + d.loc.lat.toFixed(4) + ', ' + d.loc.lng.toFixed(4) : T('pd.noloc','locatie onbekend');
    el.innerHTML = '<div class="bz"><div class="bz-ic"></div><b>'+esc(d.from)+'</b><span>'+(d.note?esc(d.note):T('pd.needs','heeft direct assistentie nodig'))+'</span>'+
      '<span style="margin-top:0.6rem;font-size:0.8rem;">'+esc(locTxt)+'</span><i>'+T('pd.buzzclose','Tik om te bevestigen')+'</i></div>';
    el.classList.add('on');
  }

  // SOS en EHBO-alarm: locatie meesturen als die er is, direct het hele bedrijf
  // alarmeren. Een noodknop mag nooit blijven hangen: als de locatievraag niet
  // (op tijd) beantwoord wordt, gaat het alarm zonder locatie de deur uit.
  async function sendSOS(note, melding){
    let klaar = false;
    const fire = async (lat, lng) => {
      if (klaar) return;
      klaar = true;
      try { await API.call('/supplier/security', { lat, lng, note: note || '' }); toast(melding || (''+T('pd.sossent','Noodoproep verstuurd. Het team en RTG zijn gealarmeerd.'))); }
      catch(e){ toast(e.message); }
    };
    if (navigator.geolocation){
      navigator.geolocation.getCurrentPosition(
        pos => fire(pos.coords.latitude, pos.coords.longitude),
        () => fire(undefined, undefined),
        { timeout: 2500 }
      );
      setTimeout(() => fire(undefined, undefined), 3200);
    } else fire(undefined, undefined);
  }

  /* ---------- de zorgbalie: de behandelaar-agenda (spa of kliniek) ----------
     Alleen zaken die als zorgaanbieder gekoppeld zijn (bijv. Zenith, Clara)
     krijgen deze tab; de agenda toont per behandelaar wie er komt, met de
     zorgcontext (allergenen, intake) die het lid met toestemming deelt. */
  let zbData = null, zbDatum = null;
  async function laadZorgbalie(){
    if (!API.token) return;
    try { zbData = await API.call('/supplier/care/agenda', zbDatum ? { datum: zbDatum } : {}); }
    catch(e){ zbData = null; }
    renderZorgbalie();
  }
  function renderZorgbalie(){
    const tabBtn = document.getElementById('tabZorgbalie');
    if (tabBtn) tabBtn.style.display = zbData ? '' : 'none';
    const wrap = $('#zorgbalieWrap');
    if (!wrap) return;
    if (!zbData){ wrap.innerHTML = ''; return; }
    const dagen = [];
    for (let i = 0; i < 7; i++){
      const dt = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10);
      const aan = dt === zbData.datum;
      dagen.push('<button class="abtn ghost" data-zbdag="'+dt+'" style="padding:0.4rem 0.7rem;'+(aan?'border-color:var(--gold);color:var(--gold);':'')+'"'+(aan?' aria-current="date"':'')+'>'+
        (i===0 ? T('pd.zb.vandaag','vandaag') : dt.slice(8)+'/'+dt.slice(5,7))+'</button>');
    }
    const perBehandelaar = (zbData.behandelaars || []).map(b => {
      const eigen = (zbData.afspraken || []).filter(a => a.behandelaarId === b.id);
      return '<div class="card"><div class="k">'+esc(b.naam)+' · '+esc(b.functie)+'</div>'+
        (eigen.length ? eigen.map(a =>
          '<div class="task"><span class="ic">'+(a.soort==='medisch'?'':'')+'</span><div class="t">'+
            '<b style="font-variant-numeric:tabular-nums;">'+esc(a.tijd)+' · '+esc(a.behandelingNaam)+'</b>'+
            '<span>'+T('pd.zb.gast','Gast')+': '+esc(a.codenaam || '')+' · '+a.duurMin+' min · '+eur(a.prijs)+'</span>'+
            (a.zorg ? '<span style="display:block;color:#E2B93B;">'+esc(pkZorg(a.zorg))+'</span>' : '')+
            (a.intake ? '<span style="display:block;color:#E2B93B;">'+esc(a.intake)+'</span>' : '')+
          '</div>'+
          (a.status === 'afgerond' ? '<span class="pill g">'+T('pd.zb.klaar','Afgerond')+'</span>'
            : '<button class="abtn" data-zbklaar="'+esc(a.ref)+'">'+T('pd.zb.afronden','Afronden')+'</button>')+
          '</div>').join('')
        : '<div style="margin-top:0.5rem;color:var(--soft);font-size:0.8rem;">'+T('pd.zb.leeg','Geen afspraken op deze dag.')+'</div>')+
      '</div>';
    }).join('');
    wrap.innerHTML = '<div class="card"><div class="k">'+esc(zbData.aanbieder || '')+'</div>'+
      '<div class="row" style="flex-wrap:wrap;margin-top:0.5rem;">'+dagen.join('')+'</div></div>' + perBehandelaar;
    wrap.querySelectorAll('[data-zbdag]').forEach(b => b.addEventListener('click', () => { zbDatum = b.dataset.zbdag; laadZorgbalie(); }));
    wrap.querySelectorAll('[data-zbklaar]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/care/afronden', { ref: b.dataset.zbklaar }); toast(T('pd.zb.klaar','Afgerond') + ' '); laadZorgbalie(); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---------- de meldkamer op de PDA: het korps in de binnenzak ----------
     Voor de hulpdiensten (politie, brandweer, ambulance, special forces) de
     open meldingen met de veld-knoppen (ter plaatse, afronden); voor de
     zorg-zaken de medische receptie en de eerste hulp. De tab verschijnt
     alleen als de zaak een korps of zorg-zaak is. */
  let mkHulp = null, mkZorg = null, mkKeten = null, mkKanaal = 'keten', mkGesprek = null;
  async function laadMeldkamerPda(){
    if (!API.token) return;
    try { mkHulp = await API.call('/supplier/hulp/overzicht'); } catch(e){ mkHulp = null; }
    try { mkZorg = await API.call('/supplier/zorg/overzicht'); } catch(e){ mkZorg = null; }
    try { mkKeten = await API.call('/supplier/keten/status'); } catch(e){ mkKeten = null; }
    if (mkKeten && (mkKeten.kanalen || []).length){
      if (!mkKeten.kanalen.some(k => k.id === mkKanaal)) mkKanaal = mkKeten.kanalen[0].id;
      try { mkGesprek = await API.call('/supplier/keten/gesprek', { kanaal: mkKanaal }); } catch(e){ mkGesprek = null; }
    } else mkGesprek = null;
    renderMeldkamerPda();
  }
  function renderMeldkamerPda(){
    const tabBtn = document.getElementById('tabMeldkamer');
    if (tabBtn) tabBtn.style.display = (mkHulp || mkZorg) ? '' : 'none';
    const wrap = $('#meldkamerWrap');
    if (!wrap) return;
    if (!mkHulp && !mkZorg){ wrap.innerHTML = ''; return; }
    let html = '';
    if (mkHulp){
      const open = [...(mkHulp.bijstand || []), ...(mkHulp.meldingen || []).filter(m => m.status !== 'afgerond')];
      html += '<div class="card"><div class="k">'+esc(mkHulp.korps.naam)+' · '+(mkHulp.open || 0)+' '+T('pd.mk.open','open')+'</div>'+
        (open.length ? open.map(m =>
          '<div class="task"><span class="ic">'+(m.prio === 1 ? '' : m.prio === 2 ? '' : '')+'</span><div class="t"><b>'+esc(m.tekst)+'</b>'+
          '<span>'+(m.plek ? esc(m.plek)+' · ' : '')+esc(m.status)+'</span></div>'+
          '<button class="abtn ghost" data-mkst="ter-plaatse" data-mkm="'+m.id+'">'+T('pd.mk.tp','Ter plaatse')+'</button>'+
          '<button class="abtn" data-mkst="afgerond" data-mkm="'+m.id+'">'+T('pd.mk.af','Rond af')+'</button></div>').join('')
        : '<div style="font-size:0.8rem;color:var(--soft);">'+T('pd.mk.rustig','Geen open meldingen; rustig op het bord.')+'</div>')+
        '<div style="margin-top:0.5rem;font-size:0.75rem;color:var(--soft);">'+(mkHulp.eenheden || []).map(e => e.naam+' ('+e.status+')').join(' · ')+'</div></div>';
    }
    if (mkZorg && mkZorg.receptie){
      html += '<div class="card"><div class="k">'+T('pd.mk.receptie','Medische receptie')+'</div>'+
        (mkZorg.receptie.length ? mkZorg.receptie.map(p =>
          '<div class="task"><span class="ic"></span><div class="t"><b>'+esc(p.aanduiding)+'</b><span>'+esc(p.status)+(p.kamer ? ' ('+esc(p.kamer)+')' : '')+'</span></div>'+
          (p.status === 'wacht' ? '<button class="abtn" data-mkroep="'+p.id+'">'+T('pd.mk.roep','Roep op')+'</button>' : '')+
          '<button class="abtn ghost" data-mkpk="'+p.id+'">'+T('pd.mk.klaar','Klaar')+'</button></div>').join('')
        : '<div style="font-size:0.8rem;color:var(--soft);">'+T('pd.mk.wkleeg','De wachtkamer is leeg.')+'</div>')+'</div>';
    }
    if (mkZorg && mkZorg.seh){
      html += '<div class="card"><div class="k">'+T('pd.mk.seh','Eerste hulp')+' · '+mkZorg.seh.length+' '+T('pd.mk.inrij','in de rij')+'</div>'+
        mkZorg.seh.slice(0, 6).map(p => '<div class="task"><span class="ic">'+({rood:'',oranje:'',geel:'',groen:'',blauw:''}[p.triage]||'')+'</span><div class="t"><b>'+esc(p.klacht)+'</b><span>'+esc(p.status)+' · via '+esc(p.via)+'</span></div></div>').join('')+'</div>';
    }
    // de ketenchat: het gedeelde kanaal en de eigen besloten groepen
