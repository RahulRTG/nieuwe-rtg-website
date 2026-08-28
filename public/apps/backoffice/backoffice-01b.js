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
          '<div style="margin-top:0.75rem;border-top:1px solid var(--line,#2a2a2a);padding-top:.6rem;font-size:0.8rem;color:var(--soft);line-height:1.7;">' +
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

  /* FOUNDATION: kijken mag op kantoor; besluiten blijft Boardroomwerk. */
  async function loadFoundationRegistraties(){
    const el=document.getElementById('foundationRegistraties');if(!el)return;
    let d;try{d=await call('/office/foundation/registraties');}catch(e){el.innerHTML='<div class="empty">Registraties niet beschikbaar.</div>';return;}
    const lijst=d.registraties||[];
    el.innerHTML=lijst.length?lijst.map(a=>{
      const eisen=(a.toelating&&a.toelating.eisen)||[];
      const klaar=e=>['geverifieerd','niet_van_toepassing'].includes(e.status)&&!(e.gecontroleerd&&e.gecontroleerd.geldigTot&&Date.parse(e.gecontroleerd.geldigTot)<Date.now());
      const open=eisen.filter(e=>!klaar(e));
      const controles=eisen.map(e=>'<div class="eis'+(klaar(e)?' ok':e.status==='afgekeurd'?' af':'')+'"><div class="sub"><b>'+(klaar(e)?'✓ ':'○ ')+escHtml(e.label)+'</b> · '+escHtml(e.status)+'</div>'+
        (a.status==='nieuw'&&!klaar(e)?'<button class="vbtn ok" data-frcheck="'+a.id+'" data-freis="'+e.id+'">Controleren</button> '+(e.magNietVanToepassing?'<button class="vbtn" data-frnvt="'+a.id+'" data-freis="'+e.id+'">N.v.t.</button>':''):'')+'</div>').join('');
      return '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(a.naam)+' <span class="zacht">· '+escHtml(a.typeLabel)+' · '+escHtml(a.plaats)+'</span></div><div class="sub">'+escHtml(a.contactNaam)+' · '+escHtml(a.email)+(a.brin?' · BRIN '+escHtml(a.brin):'')+(a.registratieNummer?' · registratie '+escHtml(a.registratieNummer):'')+' · '+timeAgo(a.at)+'</div>'+controles+'</div>'+
        (a.status==='nieuw'?'<div class="knoprij">'+(open.length?'<span class="pill nieuw">'+open.length+' open</span>':'<button class="vbtn ok" data-frok="'+a.id+'">Goedkeuren</button>')+'<button class="vbtn" data-frno="'+a.id+'">Afwijzen</button></div>':'<span class="pill '+(a.status==='goedgekeurd'?'klaar':'bereiding')+'">'+escHtml(a.status)+'</span>')+'</div></div>';
    }).join(''):'<div class="empty">Geen registraties.</div>';
    el.querySelectorAll('[data-frcheck],[data-frnvt]').forEach(b=>b.addEventListener('click',async()=>{const nvt=b.hasAttribute('data-frnvt');const ref=prompt(nvt?'Waarom is dit aantoonbaar niet van toepassing?':'Welke officiële bron en uitkomst zijn gecontroleerd?');if(!ref||ref.trim().length<3)return;try{await call('/office/foundation/registratie/controle',{id:b.dataset.frcheck||b.dataset.frnvt,onderdeel:b.dataset.freis,uitkomst:nvt?'niet_van_toepassing':'geverifieerd',referentie:ref});loadFoundationRegistraties();}catch(e){alert(e.message);}}));
    el.querySelectorAll('[data-frok]').forEach(b=>b.addEventListener('click',async()=>{try{const r=await call('/office/foundation/registratie/besluit',{id:b.dataset.frok,action:'goedkeuren'});alert('Goedgekeurd'+(r.toegang?' · toegang is veilig per e-mail verstrekt.':'.'));loadFoundationRegistraties();}catch(e){alert(e.message);}}));
    el.querySelectorAll('[data-frno]').forEach(b=>b.addEventListener('click',async()=>{const reden=prompt('Waarom wordt deze registratie afgewezen?');if(!reden||reden.trim().length<3)return;try{await call('/office/foundation/registratie/besluit',{id:b.dataset.frno,action:'afwijzen',reden});loadFoundationRegistraties();}catch(e){alert(e.message);}}));
  }
