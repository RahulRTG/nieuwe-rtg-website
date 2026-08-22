  /* ---- backoffice, vervolg van deel 01 ----
     Geknipt op een TOP-NIVEAU grens binnen dezelfde IIFE: de delen worden
     achter elkaar geplakt, dus het resultaat is letter voor letter hetzelfde
     bestand. Geknipt omdat deel 01 door de 10 KB van keuringsregel 13 ging
     nadat de bewaarverzoek-knop erbij kwam. */
  // ---- aanmeldingen per pas: de AI deed alles, alleen ja/nee is aan het personeel ----
  async function loadAanmeldingen(){
    const el = document.getElementById('aanmeldingen'); if (!el) return;
    let lijst = [];
    try { lijst = (await call('/aanmelding/lijst', { status: 'in behandeling' })).aanmeldingen || []; } catch(e){ return; }
    el.innerHTML = lijst.length ? lijst.map(a => {
      const gedaan = (a.reis || []).map(s => s.naam).join(' · ');
      const uitnod = a.viaUitnodiging ? ' <span style="color:var(--rtg-leesgoud,var(--gold));font-size:0.7rem;">op uitnodiging</span>' : '';
      return '<div class="vrow" data-id="'+a.id+'">' +
        '<div class="vi"><div class="nm">'+escHtml(a.naam)+' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(a.pasNaam)+'</span>'+uitnod+'</div>' +
          '<div class="sub">'+escHtml(a.contact||'')+'</div>' +
          '<div class="sub" style="color:var(--soft);">'+T('bo.aanmklaar','AI klaar')+': '+escHtml(gedaan)+'</div></div>' +
        '<button class="vbtn ok" data-ok>'+T('bo.accept','Accepteren')+'</button>' +
        '<button class="vbtn no" data-no>'+T('bo.reject','Afwijzen')+'</button>' +
      '</div>';
    }).join('') : '<div class="empty">'+T('bo.noaanm','Geen openstaande aanmeldingen.')+'</div>';
    el.querySelectorAll('.vrow').forEach(row => {
      const id = row.dataset.id;
      row.querySelector('[data-ok]').addEventListener('click', () => beslisAanm(id, 'geaccepteerd'));
      row.querySelector('[data-no]').addEventListener('click', () => beslisAanm(id, 'afgewezen'));
    });
    // de lopende lidmaatschapsbetalingen: na een akkoord loopt de bijdrage 12
    // maanden automatisch, met de 30%-foundationsplit (20% lokaal, 10% RTF).
    try {
      const b = await call('/aanmelding/betalingen', {});
      const eur = n => '€ ' + (Math.round(Number(n))).toLocaleString('nl-NL');
      if (b && b.aantalLeden) {
        el.insertAdjacentHTML('beforeend',
          '<div style="margin-top:.7rem;border-top:1px solid var(--line,#2a2a2a);padding-top:.6rem;font-size:0.8rem;color:var(--soft);line-height:1.7;">' +
          '<b style="color:var(--txt);">'+b.aantalLeden+'</b> '+T('bo.aanmlopend','lopende lidmaatschap(pen), 12 maanden automatisch.')+'<br>' +
          T('bo.aanmnaarfound','Per jaar naar de RTFoundation')+': <b style="color:var(--rtg-leesgoud,var(--gold));">'+eur(b.totaal.foundation)+'</b> ('+
          T('bo.aanmlokaal','20% lokaal')+' '+eur(b.totaal.lokaal)+' &middot; '+T('bo.aanmrtf','10% RTF')+' '+eur(b.totaal.rtf)+')</div>');
      }
    } catch(e){}
  }
  async function beslisAanm(id, besluit){
    try { await call('/aanmelding/beslis', { id, besluit }); } catch(e){ alert(e.message); return; }
    loadAanmeldingen();
  }

  /* De officiele bronwacht: automatisch ophalen, maar nooit stil juridisch
     versoepelen. Een echte bronwijziging wordt hier een beoordeelbare taak en
     zet geraakte partnerbewijzen op hercontrole. */
  async function loadHandelsRegels(){
    const el = document.getElementById('handelsRegels'); if (!el) return;
    let d; try { d = await call('/office/partner/regels'); }
    catch(e){ el.innerHTML = '<div class="empty">Handelsregelwacht niet beschikbaar.</div>'; return; }
    const open = (d.gebeurtenissen || []).filter(g => g.status === 'open');
    const fouten = (d.bronnen || []).filter(b => String(b.uitslag || '').startsWith('fout'));
    const bronnen = (d.bronnen || []).map(b =>
      '<div class="sub"><a href="'+escHtml(b.url)+'" target="_blank" rel="noopener">'+escHtml(b.naam)+'</a> · '+
      escHtml(b.uitslag || 'nog geen basis')+(b.laatsteCheck?' · '+timeAgo(b.laatsteCheck):'')+'</div>').join('');
    const gebeurtenissen = open.map(g =>
      '<div class="row"><div class="r1"><div><div class="nm">Regelwijziging · '+escHtml(g.naam)+'</div>'+
      '<div class="sub">'+timeAgo(g.at)+' · '+g.aanvragen+' bedrijfs-, '+(g.foundationAanvragen||0)+' FOUNDATION- en '+g.leveranciers+' partnercontrole(s) heropend</div></div>'+
      '<button class="vbtn ok" data-regelbevestig="'+g.id+'">Beoordeling vastleggen</button></div></div>').join('');
    const getroffen = (d.getroffenLeveranciers || []).map(s =>
      '<div class="row"><div><div class="nm">Hercontrole · '+escHtml(s.naam)+' <span style="color:var(--soft);font-weight:400">· '+escHtml(s.land)+'</span></div>'+
      '<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.35rem">'+s.eisen.map(e =>
        '<button class="vbtn" data-regelcode="'+escHtml(s.code)+'" data-regeleis="'+escHtml(e.id)+'">'+escHtml(e.label)+'</button>').join('')+'</div></div></div>').join('');
    el.innerHTML = '<div class="row"><div class="r1"><div><div class="nm">Automatische officiële regelwacht</div><div class="sub">'+
      (d.automatisch?'Actief, iedere '+Math.round(d.intervalMs/3600000)+' uur':'Uitgeschakeld')+' · '+open.length+' open wijziging(en) · '+fouten.length+' bronfout(en)</div></div>'+
      '<button class="vbtn" id="regelCheckNu">Nu controleren</button></div><details style="margin-top:.55rem"><summary class="sub">'+(d.bronnen||[]).length+' officiële bronnen</summary>'+bronnen+'</details></div>'+
      gebeurtenissen+getroffen;
    document.getElementById('regelCheckNu').addEventListener('click', async () => {
      try { await call('/office/partner/regels/check', {}); await loadHandelsRegels(); }
      catch(e){ alert(e.message); }
    });
    el.querySelectorAll('[data-regelbevestig]').forEach(b => b.addEventListener('click', async () => {
      const toelichting = prompt('Wat is gewijzigd en wat betekent dit voor RTG en de betrokken bedrijven?');
      if (!toelichting || toelichting.trim().length < 3) return;
      try { await call('/office/partner/regels/bevestig', { id:b.dataset.regelbevestig, toelichting }); await loadHandelsRegels(); }
      catch(e){ alert(e.message); }
    }));
    el.querySelectorAll('[data-regelcode]').forEach(b => b.addEventListener('click', async () => {
      const referentie = prompt('Welke actuele officiële bron en uitkomst zijn gecontroleerd?');
      if (!referentie || referentie.trim().length < 3) return;
      const geldigTot = prompt('Geldig tot (JJJJ-MM-DD), of leeg als er geen einddatum is:') || '';
      try { await call('/office/partner/regels/hercontrole', { code:b.dataset.regelcode,
        onderdeel:b.dataset.regeleis, referentie, geldigTot }); await loadHandelsRegels(); }
      catch(e){ alert(e.message); }
    }));
  }

  /* FOUNDATION: kijken mag op kantoor; besluiten blijft Boardroomwerk. */
  async function loadFoundationRegistraties(){
    const el=document.getElementById('foundationRegistraties');if(!el)return;
    let d;try{d=await call('/office/foundation/registraties');}catch(e){el.innerHTML='<div class="empty">Registraties niet beschikbaar.</div>';return;}
    const lijst=d.registraties||[];
    el.innerHTML=lijst.length?lijst.map(a=>{
      const eisen=(a.toelating&&a.toelating.eisen)||[];
      const klaar=e=>['geverifieerd','niet_van_toepassing'].includes(e.status)&&!(e.gecontroleerd&&e.gecontroleerd.geldigTot&&Date.parse(e.gecontroleerd.geldigTot)<Date.now());
      const open=eisen.filter(e=>!klaar(e));
      const controles=eisen.map(e=>'<div style="border-left:2px solid '+(klaar(e)?'var(--green)':e.status==='afgekeurd'?'#df6b7d':'var(--gold)')+';padding:.18rem 0 .18rem .5rem;margin-top:.25rem"><div class="sub"><b style="color:var(--text)">'+(klaar(e)?'✓ ':'○ ')+escHtml(e.label)+'</b> · '+escHtml(e.status)+'</div>'+
        (a.status==='nieuw'&&!klaar(e)?'<button class="vbtn ok" data-frcheck="'+a.id+'" data-freis="'+e.id+'">Controleren</button> '+(e.magNietVanToepassing?'<button class="vbtn" data-frnvt="'+a.id+'" data-freis="'+e.id+'">N.v.t.</button>':''):'')+'</div>').join('');
      return '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(a.naam)+' <span style="color:var(--soft);font-weight:400">· '+escHtml(a.typeLabel)+' · '+escHtml(a.plaats)+'</span></div><div class="sub">'+escHtml(a.contactNaam)+' · '+escHtml(a.email)+(a.brin?' · BRIN '+escHtml(a.brin):'')+(a.registratieNummer?' · registratie '+escHtml(a.registratieNummer):'')+' · '+timeAgo(a.at)+'</div>'+controles+'</div>'+
        (a.status==='nieuw'?'<div style="display:flex;gap:.3rem;align-items:flex-start">'+(open.length?'<span class="pill nieuw">'+open.length+' open</span>':'<button class="vbtn ok" data-frok="'+a.id+'">Goedkeuren</button>')+'<button class="vbtn" data-frno="'+a.id+'">Afwijzen</button></div>':'<span class="pill '+(a.status==='goedgekeurd'?'klaar':'bereiding')+'">'+escHtml(a.status)+'</span>')+'</div></div>';
    }).join(''):'<div class="empty">Geen registraties.</div>';
    el.querySelectorAll('[data-frcheck],[data-frnvt]').forEach(b=>b.addEventListener('click',async()=>{const nvt=b.hasAttribute('data-frnvt');const ref=prompt(nvt?'Waarom is dit aantoonbaar niet van toepassing?':'Welke officiële bron en uitkomst zijn gecontroleerd?');if(!ref||ref.trim().length<3)return;try{await call('/office/foundation/registratie/controle',{id:b.dataset.frcheck||b.dataset.frnvt,onderdeel:b.dataset.freis,uitkomst:nvt?'niet_van_toepassing':'geverifieerd',referentie:ref});loadFoundationRegistraties();}catch(e){alert(e.message);}}));
    el.querySelectorAll('[data-frok]').forEach(b=>b.addEventListener('click',async()=>{try{const r=await call('/office/foundation/registratie/besluit',{id:b.dataset.frok,action:'goedkeuren'});alert('Goedgekeurd'+(r.toegang?' · toegang is veilig per e-mail verstrekt.':'.'));loadFoundationRegistraties();}catch(e){alert(e.message);}}));
    el.querySelectorAll('[data-frno]').forEach(b=>b.addEventListener('click',async()=>{const reden=prompt('Waarom wordt deze registratie afgewezen?');if(!reden||reden.trim().length<3)return;try{await call('/office/foundation/registratie/besluit',{id:b.dataset.frno,action:'afwijzen',reden});loadFoundationRegistraties();}catch(e){alert(e.message);}}));
  }
