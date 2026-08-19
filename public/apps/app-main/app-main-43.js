    if (user.account) loadSocial(); else { const c = $('#homeContacts'); if (c) c.style.display='none'; }
  }
  // Betaalgeschiedenis van de gratis gebruiker: wat is besteld en betaald.
  async function loadGuestHistory(){
    const el = $('#homePay'); if (!el) return;
    let orders = [];
    try { orders = (await API.call('/orders/mine')).orders || []; } catch(e){}
    const betaald = orders.filter(o => o.paid);
    const som = betaald.reduce((s,o) => s + o.total, 0);
    const open = orders.filter(o => !o.paid);
    el.innerHTML = '<div class="label">'+T('app.guest.history','Mijn bestellingen en betalingen')+'</div>'+
      (orders.length
        ? '<div class="big" style="font-size:1.05rem;">'+eur(som)+' <span style="font-size:0.7rem;color:var(--soft);font-weight:400;">'+T('app.guest.paid','betaald')+'</span></div>'+
          '<div class="meta" style="margin:.2rem 0 .6rem;">'+betaald.length+' '+T('app.guest.paidorders','betaalde bestelling(en)')+(open.length?(' · '+open.length+' '+T('app.guest.open','open')):'')+'</div>'+
          '<div style="display:flex;flex-direction:column;gap:.45rem;">'+orders.slice(0,6).map(o=>{
            const kleur = o.paid ? 'var(--green,#4CAF7D)' : 'var(--gold)';
            const st = o.paid ? T('app.guest.ok','betaald') : T('app.guest.te','te betalen');
            return '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.6rem;font-size:0.78rem;color:var(--muted);">'+
              '<span>'+escT(o.supplierName)+' · '+o.items.reduce((n,i)=>n+i.qty,0)+' '+T('app.items','item(s)')+' · '+timeAgo(o.at)+'</span>'+
              '<span style="flex-shrink:0;white-space:nowrap;">'+eur(o.total)+' · <span style="color:'+kleur+';">'+st+'</span>'+
              (o.paid?'':' <button class="pa" data-guestpay="'+o.ref+'" style="padding:.12rem .5rem;font-size:0.66rem;margin-left:.2rem;">'+T('app.guest.paynow','betaal')+'</button>')+'</span></div>';
          }).join('')+'</div>'
        : '<div class="meta">'+T('app.guest.none','Je hebt nog niets besteld. Betaal bij een partner via Ter plaatse.')+'</div>');
    el.querySelectorAll('[data-guestpay]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/order/pay', { ref: b.dataset.guestpay }); toast(T('app.guest.paid2','Betaald.')); loadGuestHistory(); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---------- RTFoundation: eigen gezinsruimte voor gekoppelde oppas/opa/oma ---------- */
  function esc(t){ return String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function renderFoundation(){
    const homeEl = $('#homeFoundation'), tab = $('#tabGezin'), dot = $('#tabGezinDot');
    if (!user || !user.account){ if(homeEl) homeEl.style.display='none'; if(tab) tab.style.display='none'; return; }
    const g = (rtf.gekoppeld || []), m = (rtf.meldingen || []);
    const ongelezen = m.filter(x=>!x.gelezen).length;
    if (tab) tab.style.display = g.length ? '' : 'none';
    if (dot) dot.style.display = (g.length && ongelezen) ? 'block' : 'none';
    // compacte ingang op Home
    if (homeEl){
      homeEl.style.display='';
      if (!g.length){
        homeEl.innerHTML = '<div class="label">RTFoundation</div>'+
          '<div class="big" style="font-size:1.05rem;line-height:1.4;">Ben je oppas, opa of oma?</div>'+
          '<div class="meta" style="margin:.3rem 0 .7rem;">Volg een RTFoundation-gezin met je pas, dan krijg je hun meldingen hier op je telefoon, zonder een extra app.</div>'+
          '<button class="go" id="rtfKoppelBtn">Koppel een gezin →</button>';
      } else {
        homeEl.innerHTML = '<div class="label">Je gezinsruimte'+(ongelezen?' · <span style="color:var(--rtg-leesgoud,var(--gold))">'+ongelezen+' nieuw</span>':'')+'</div>'+
          '<div class="big" style="font-size:1.05rem;">'+g.map(x=>esc(x.gezinNaam)).join(', ')+'</div>'+
          '<div class="meta" style="margin:.2rem 0 .7rem;">'+(ongelezen? ongelezen+' nieuwe melding'+(ongelezen>1?'en':'') : 'Alles gelezen')+'</div>'+
          '<button class="go" data-goto="gezin">Open je gezinsruimte →</button>';
      }
      const kb = $('#rtfKoppelBtn'); if (kb) kb.addEventListener('click', rtfKoppelStart);
      homeEl.querySelectorAll('[data-goto]').forEach(b=> b.addEventListener('click', ()=> openTab(b.dataset.goto)));
    }
    renderGezin();
  }
  function rtfBerichtHtml(x){
    return '<div style="padding:.55rem .7rem;border:1px solid var(--line);border-radius:12px;margin:.4rem 0;'+(x.gelezen?'':'border-color:var(--burgundy,#C23A5E);')+(x.soort==='hulp'?'background:rgba(194,58,94,.08);':'')+'">'+
      '<div style="font-size:.72rem;color:var(--muted);">'+(x.soort==='hulp'?'':(x.soort==='reis'?'':''))+esc(x.gezin)+' · '+esc(x.van||'')+'</div>'+
      '<div style="font-size:.92rem;line-height:1.4;margin-top:.15rem;white-space:pre-wrap;">'+esc(x.tekst)+'</div></div>';
  }
  function renderGezin(){
    const fam = $('#gezinFamilies'), feed = $('#gezinFeed'); if (!fam || !feed) return;
    const g = (rtf.gekoppeld || []), m = (rtf.meldingen || []);
    $('#gezinSub').textContent = g.length ? 'De RTFoundation-gezinnen die je als oppas of familie volgt.' : 'Je volgt nog geen gezin.';
    fam.innerHTML = '<div class="label">Gevolgde gezinnen</div>'+
      (g.length ? g.map(x=>'<div style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--line);"><b style="flex:1;">'+esc(x.gezinNaam)+'</b><span class="meta">als '+esc(x.profielNaam)+'</span><button class="go" style="background:transparent;color:var(--muted);padding:.2rem .4rem;" data-los="'+x.code+'|'+x.profielId+'">Ontkoppel</button></div>').join('') : '<div class="meta">Nog geen gezin gekoppeld.</div>')+
      '<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.9rem;"><button class="go" id="rtfKoppelBtn2">Koppel een gezin →</button><button class="go" id="rtfPushBtn" style="background:transparent;color:var(--muted);">Meldingen op mijn telefoon</button></div>';
    feed.innerHTML = '<div class="label">Meldingen van het gezin</div>'+
      (m.length ? m.slice(0,30).map(rtfBerichtHtml).join('') : '<div class="meta">Nog geen meldingen. Zodra het gezin iets deelt, zie je het hier en op je telefoon.</div>')+
      (g.length ? '<div style="display:flex;gap:.5rem;margin-top:.8rem;"><input id="rtfReplyIn" placeholder="Antwoord het gezin..." style="flex:1;background:var(--card2,#1B1817);border:1px solid var(--line);border-radius:12px;padding:.6rem .8rem;color:var(--txt);"><button class="go" id="rtfReplyBtn">Stuur</button></div>' : '');
    fam.querySelectorAll('[data-los]').forEach(b=> b.addEventListener('click', async ()=>{ const [code,pid]=b.dataset.los.split('|'); if(!confirm('Dit gezin niet meer volgen?')) return; try{ await API.call('/rtf/ontkoppel',{code,profielId:pid}); toast('Ontkoppeld.'); await refreshState(); renderFoundation(); if(!(rtf.gekoppeld||[]).length) openTab('home'); }catch(e){ toast(e.message); } }));
    const kb=$('#rtfKoppelBtn2'); if(kb) kb.addEventListener('click', rtfKoppelStart);
    const pb=$('#rtfPushBtn'); if(pb) pb.addEventListener('click', ()=> ensurePush(true));
    const rb=$('#rtfReplyBtn'); if(rb) rb.addEventListener('click', rtfReply);
    const ri=$('#rtfReplyIn'); if(ri) ri.addEventListener('keydown', e=>{ if(e.key==='Enter') rtfReply(); });
    if (m.filter(x=>!x.gelezen).length) API.call('/rtf/meldingen/gelezen').catch(()=>{});
    if (g.length){ laadGezinInfo(); laadGezinChat(); } else { const gc=$('#gezinChat'); if(gc) gc.style.display='none'; }
  }
  let grtInit=false, grtActief=null;
  async function laadGezinChat(){
    const box=$('#gezinChat'); if(!box) return;
    const g=(rtf.gekoppeld||[]); if(!g.length){ box.style.display='none'; return; }
    box.style.display='';
    let kan; try{ kan=await API.call('/rtf/kanaal',{ code:g[0].code }); }catch(e){ box.innerHTML='<div class="meta">Chat is nu niet beschikbaar.</div>'; return; }
    if (!grtInit && window.GezinRT){ GezinRT.init({ base:'/api/foundation', code:kan.code, token:kan.token, mijnId:kan.profielId, mijnNaam:'ik', leden:kan.leden, onChat:onGrtChat }); grtInit=true; }
    else if (window.GezinRT){ GezinRT.setLeden(kan.leden); }
    let chats=[]; try{ chats=(await GezinRT.chats()).chats||[]; }catch(e){}
    const byId={}; chats.forEach(c=> byId[c.id]=c);
