  /* ---- het hoteldorp: negen afdelingen, een motor ----
     Elke afdeling (front office, guest manager, concierge, parking, security,
     gym, spa, klusjesman, IT) heeft dezelfde lichte lijst: waar + wat + wie,
     met een eigen statusketen. Een tik zet de post een stap verder. */
  let dorpKant = (() => { try { return localStorage.getItem('rtg_dorp_kant') || 'frontoffice'; } catch(e){ return 'frontoffice'; } })();
  async function renderDorp(){
    const el = $('#dorpWrap'); if (!el) return;
    // kamers geven het hoteldorp; nachtzaken, restaurants en beachclubs hun eigen dorp
    if (!Array.isArray(state.rooms) && !['bar', 'club', 'beachclub', 'restaurant'].includes(S && S.type)){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/dorp', {}); } catch(e){ el.innerHTML = ''; return; }
    const afd = d.afdelingen.find(a => a.key === dorpKant) || d.afdelingen[0];
    dorpKant = afd.key;
    const rij = p => {
      const i = afd.keten.indexOf(p.status);
      const volgende = i >= 0 && i < afd.keten.length - 1 ? afd.keten[i + 1] : null;
      return '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.6rem;margin-top:0.55rem;font-size:0.82rem;flex-wrap:wrap;" data-dpost="'+p.id+'">'+
        '<span>'+(p.waar?'<b>'+esc(p.waar)+'</b> · ':'')+esc(p.tekst)+' <span class="sub">'+esc(p.door)+' · '+timeAgo(p.updatedAt||p.at)+
          ((p.via||[]).length?' · '+T('dorp.via','via')+' '+p.via.map(esc).join(', '):'')+'</span></span>'+
        (volgende
          ? '<span style="display:flex;gap:0.4rem;align-items:center;flex-shrink:0;"><span class="pill bereiding">'+esc(p.status)+'</span><button class="obtn primary js-dverder">'+esc(volgende)+'</button><button class="obtn js-dstuur" title="'+T('dorp.stuur','Stuur door naar een andere afdeling')+'">↪</button></span>'
          : '<span class="pill klaar" style="flex-shrink:0;">'+esc(p.status)+'</span>')+
      '</div>';
    };
    // het specialistische gereedschap van deze afdeling (dagstaat, wachtrij...)
    let tools = null;
    try { tools = await API.call('/supplier/dorp/tools', { afdeling: dorpKant }); } catch(e){}
    const kop = t => '<div style="margin-top:0.6rem;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+t+'</div>';
    // de gereedschapskist: generieke widgets (cijfers, lijst, knoppen, actie, meter)
    let toolsBlok = '';
    if (tools && Array.isArray(tools.tools)) toolsBlok = tools.tools.map(w => {
      if (w.type === 'cijfers') return kop(esc(w.titel))+'<div class="pos-chips" style="margin-top:0.35rem;">'+
        w.items.map(i => '<span>'+esc(i.label)+' · <b>'+esc(String(i.waarde))+'</b></span>').join('')+'</div>';
      if (w.type === 'lijst') return kop(esc(w.titel))+((w.rijen||[]).length ? w.rijen.map(r =>
        '<div class="st-row"><span>'+(r.icoon?r.icoon+' ':'')+esc(r.tekst)+(r.sub?'<span class="sub" style="display:block;">'+esc(r.sub)+'</span>':'')+'</span>'+
        (r.rechts?'<b style="color:'+(r.rood?'var(--burgundy)':'var(--gold)')+';white-space:nowrap;">'+esc(r.rechts)+'</b>':'')+'</div>').join('')
        : '<div class="softline" style="margin-top:0.35rem;">'+esc(w.leeg||'')+'</div>');
      if (w.type === 'knoppen') return kop(esc(w.titel))+'<div class="pos-chips" style="margin-top:0.35rem;">'+
        w.knoppen.map(k => '<span><button class="obtn js-dsnel" data-snel="'+esc(k)+'" style="padding:0.15rem 0.55rem;">'+esc(k)+'</button></span>').join('')+'</div>';
      if (w.type === 'actie') return kop(esc(w.titel))+'<button class="obtn primary js-dactie" data-tekst="'+esc(w.tekst)+'" style="margin-top:0.35rem;">'+esc(w.knop)+'</button>';
      if (w.type === 'meter') return kop(esc(w.titel))+'<div class="pos-chips" style="margin-top:0.35rem;">'+
        w.opties.map(o => '<span><button class="obtn'+(w.stand&&w.stand.stand===o?' primary':'')+'" data-meter="'+esc(o)+'" style="padding:0.15rem 0.55rem;">'+esc(o)+'</button></span>').join('')+'</div>'+
        (w.stand?'<div class="softline" style="margin-top:0.25rem;">'+T('gy.nu','Nu')+' '+esc(w.stand.stand)+' · '+esc(w.stand.door)+', '+timeAgo(w.stand.at)+'</div>':'');
      // de leeftijdscheck aan de deur: ja/nee op codenaam, zonder gegevens
      if (w.type === 'leeftijd') return kop(esc(w.titel))+
        '<div class="tt-add" style="margin-top:0.35rem;flex-wrap:wrap;"><input id="dorpLftIn" placeholder="'+T('dorp.lft.ph','Codenaam van de gast')+'" style="flex:2;min-width:140px;">'+
        '<button class="obtn js-dlft" data-min="18">18+?</button><button class="obtn js-dlft" data-min="21">21+?</button></div>'+
        '<div id="dorpLftUit" class="softline" style="margin-top:0.3rem;">'+esc(w.hint||'')+'</div>';
      return '';
    }).join('');
    // de buurt op het conciergescherm: partners om de hoek, op afstand gesorteerd
    let buurtBlok = '';
    if (dorpKant === 'concierge'){
      if (!renderDorp.buurt){
        try { renderDorp.buurt = (await API.call('/supplier/dorp/buurt', {})).buurt || []; } catch(e){ renderDorp.buurt = []; }
      }
      if (renderDorp.buurt.length) buurtBlok = '<div style="margin-top:0.7rem;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('dorp.buurt','In de buurt')+'</div>'+
        '<div class="pos-chips" style="margin-top:0.35rem;">'+renderDorp.buurt.map(b =>
          '<span><button class="obtn js-dbuurt" data-naam="'+esc(b.naam)+'" data-soort="'+esc(b.soort)+'" data-km="'+b.km+'" style="padding:0.15rem 0.5rem;">'+b.icon+' '+esc(b.naam)+' · '+b.km+' km</button></span>').join('')+'</div>'+
        '<div class="softline" style="margin-top:0.3rem;">'+T('dorp.buurt.s','Een tik zet de naam alvast in de wens.')+'</div>';
    }
    el.innerHTML =
      '<div class="card" style="display:flex;gap:0.4rem;flex-wrap:wrap;">'+d.afdelingen.map(a =>
        '<button class="obtn'+(a.key===dorpKant?' primary':'')+'" data-dkant="'+a.key+'">'+a.icon+' '+esc(a.label)+(a.openAantal?' · '+a.openAantal:'')+'</button>').join('')+'</div>'+
      '<div class="card"><div class="tt-h">'+afd.icon+' '+esc(afd.label)+' <span class="sub">('+afd.keten.join(' · ')+')</span></div>'+
        toolsBlok+
        (afd.open.length ? afd.open.map(rij).join('') : '<div class="softline" style="margin-top:0.5rem;">'+T('dorp.leeg','Niets open bij deze afdeling.')+'</div>')+
        buurtBlok+
        (afd.klaar.length ? '<div style="margin-top:0.6rem;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('dorp.klaar','Net afgerond')+'</div>'+afd.klaar.map(rij).join('') : '')+
        '<div class="tt-add" style="flex-wrap:wrap;margin-top:0.7rem;">'+
          '<input id="dorpWaar" placeholder="'+esc(afd.waarHint)+'" style="flex:1;min-width:110px;">'+
          '<input id="dorpTekst" placeholder="'+esc(afd.watHint)+'" style="flex:2;min-width:160px;">'+
          '<button id="dorpAdd">'+T('dorp.zet','Zet erbij')+'</button></div>'+
      '</div>';
    el.querySelectorAll('[data-dkant]').forEach(b => b.addEventListener('click', () => {
      dorpKant = b.dataset.dkant;
      try { localStorage.setItem('rtg_dorp_kant', dorpKant); } catch(e){}
      renderDorp();
    }));
    el.querySelectorAll('[data-dpost]').forEach(elp => {
      const knop = elp.querySelector('.js-dverder');
      if (knop) knop.addEventListener('click', async () => {
        try { await API.call('/supplier/dorp/verder', { id: elp.dataset.dpost }); renderDorp(); } catch(e){ toast(e.message); }
      });
      // afdelingen praten met elkaar: de post reist door, met het spoor erbij
      const stuurKnop = elp.querySelector('.js-dstuur');
      if (stuurKnop) stuurKnop.addEventListener('click', async () => {
        const naar = window.prompt(T('dorp.stuurwaar','Naar welke afdeling?')+' ('+d.afdelingen.map(a=>a.key).join(', ')+')');
        if (!naar) return;
        try {
          const r = await API.call('/supplier/dorp/stuurdoor', { id: elp.dataset.dpost, naar: naar.trim().toLowerCase() });
          const doel = d.afdelingen.find(a => a.key === r.post.afdeling);
          toast((doel?doel.icon+' ':'')+T('dorp.gestuurd','Doorgestuurd naar')+' '+(doel?doel.label:r.post.afdeling)+'.');
          renderDorp();
        } catch(e){ toast(e.message); }
      });
    });
    // de buurt: een tik zet de naam alvast in de wens van de concierge
    el.querySelectorAll('.js-dbuurt').forEach(b => b.addEventListener('click', () => {
      const inp = el.querySelector('#dorpTekst');
      if (inp){ inp.value = T('dorp.regelbij','Regel bij')+' '+b.dataset.naam+' ('+b.dataset.soort+', '+b.dataset.km+' km): '; inp.focus(); }
    }));
    // de leeftijdscheck: de paspoort-bevestiging geeft ja/nee, nooit gegevens
    el.querySelectorAll('.js-dlft').forEach(b => b.addEventListener('click', async () => {
      const inp = el.querySelector('#dorpLftIn'), uit = el.querySelector('#dorpLftUit');
      const codenaam = (inp && inp.value || '').trim();
      if (!codenaam){ toast(T('dorp.lft.leeg','Vul de codenaam van de gast in.')); return; }
      const min = Number(b.dataset.min);
      try {
        const r = await API.call('/supplier/paspoort/vraag', { codenaam, niveau: 'bevestiging', minLeeftijd: min });
        const ok = r.bevestiging && r.bevestiging.voldoetLeeftijd === true;
        uit.innerHTML = ok
          ? '<b style="color:var(--green,#7ecb8f);font-size:1rem;">'+esc(codenaam)+' '+T('dorp.lft.ja','is')+' '+min+'+</b>'
          : '<b style="color:var(--burgundy,#C23A5E);font-size:1rem;">'+esc(codenaam)+' '+T('dorp.lft.nee','is NIET aantoonbaar')+' '+min+'+</b>';
      } catch(e){ uit.innerHTML = '<b style="color:var(--burgundy,#C23A5E);">'+esc(e.message)+'</b>'; }
    }));
    // het logmoment: een tik en het staat geklokt als afgeronde post
    el.querySelectorAll('.js-dactie').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/dorp/post', { afdeling: dorpKant, waar: '', tekst: b.dataset.tekst, directKlaar: true }); toast(afd.icon+' '+T('dorp.geklokt','Geklokt.')); renderDorp(); }
      catch(e){ toast(e.message); }
    }));
    // de meter van de afdeling: drukte, voorraad, seizoen
    el.querySelectorAll('[data-meter]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/dorp/drukte', { afdeling: dorpKant, stand: b.dataset.meter }); renderDorp(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-dsnel').forEach(b => b.addEventListener('click', () => {
      const inp = el.querySelector('#dorpTekst');
      if (inp){ inp.value = b.dataset.snel+' '; inp.focus(); }
    }));
    const add = el.querySelector('#dorpAdd'); if (add) add.addEventListener('click', async () => {
      const waar = el.querySelector('#dorpWaar').value.trim();
      const tekst = el.querySelector('#dorpTekst').value.trim();
      if (!tekst){ toast(T('dorp.vul','Schrijf kort op wat er speelt.')); return; }
      try { await API.call('/supplier/dorp/post', { afdeling: dorpKant, waar, tekst }); toast(afd.icon+' '+T('dorp.gezet','Staat op de lijst van')+' '+afd.label+'.'); renderDorp(); }
      catch(e){ toast(e.message); }
    });
  }

