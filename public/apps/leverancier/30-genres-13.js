    // incident melden
    html += '<div class="card"><div class="tt-h">'+T('pn.incident','Incident: identiteit opeisen')+'</div>'+
      '<p class="ds" style="margin:0.3rem 0;">'+T('pn.incidenttip','Alleen bij een echt incident. RTG-kantoor beoordeelt het verzoek en geeft de identiteit pas daarna vrij. Alles wordt gelogd.')+'</p>'+
      '<div class="field"><label>'+T('pn.codenaam','Codenaam van de gast')+'</label><input id="pnIncCode" placeholder="'+T('pn.codeph','Bijv. Zilveren Valk 12')+'" autocomplete="off"></div>'+
      '<div class="field"><label>'+T('pn.incReden','Wat is er gebeurd?')+'</label><textarea id="pnIncReden" rows="2" '+sel+' placeholder="'+T('pn.incRedenph','Beschrijf het incident (min. 10 tekens)')+'"></textarea></div>'+
      '<div class="field"><label>'+T('pn.incNiveau','Gevraagd niveau')+'</label><select id="pnIncNiveau" '+sel+'><option value="idkaart">'+T('pn.niveau.idkaart','ID-kaart')+'</option><option value="paspoort">'+T('pn.niveau.paspoort','Paspoort')+'</option></select></div>'+
      '<button class="obtn warn" id="pnIncMeld" style="margin-top:0.7rem;">'+T('pn.incMeld','Incident melden bij RTG')+'</button></div>';
    // eigen incidenten
    const inc = paspoortData.incidenten || [];
    if (inc.length) html += '<div class="card"><div class="tt-h">'+T('pn.incidenten','Mijn incidenten')+'</div>'+
      '<div style="margin-top:0.5rem;">'+inc.map(i => '<div class="mitem"><div class="r1"><span class="nm">'+esc(i.codenaam||'\u2013')+'</span>'+pnBadge(i.status)+'</div><div class="ds">'+esc(i.reden)+'</div></div>').join('')+'</div></div>';
    el.innerHTML = html;
    paspoortBind(el);
  }
  function paspoortInzageKaart(inh){
    let body = '';
    if (inh.niveau === 'bevestiging'){
      body = '<div style="font-size:0.9rem;">'+(inh.geverifieerd?'✅ '+T('pn.geverifieerd','RTG-geverifieerd'):'⛔ '+T('pn.nietgeverifieerd','niet geverifieerd'))+
        (inh.voldoetLeeftijd!=null?'<br>'+(inh.voldoetLeeftijd?'✅ '+T('pn.voldoet','voldoet aan de leeftijdseis'):'⛔ '+T('pn.voldoetniet','voldoet NIET aan de leeftijdseis')):'')+'</div>';
    } else {
      body = '<div style="display:flex;gap:0.8rem;">'+
        (inh.foto?'<img src="'+esc(inh.foto)+'" alt="'+T('pn.pasfoto','Pasfoto')+'" style="width:80px;height:100px;object-fit:cover;border-radius:10px;flex-shrink:0;">':'')+
        '<div><div style="font-weight:700;font-size:0.95rem;">'+esc(inh.naam||'')+'</div>'+
        '<div class="ds">'+(inh.nationaliteit?esc(inh.nationaliteit)+' · ':'')+(inh.geboortedatum?esc(inh.geboortedatum):'')+(inh.leeftijd!=null?' ('+inh.leeftijd+')':'')+'</div>'+
        '<div class="ds" style="margin-top:0.3rem;color:var(--green);">'+(inh.geverifieerd?'✅ '+T('pn.geverifieerd','RTG-geverifieerd'):'')+(inh.gezichtGecontroleerd?' · '+T('pn.gezicht','gezicht gecontroleerd'):'')+'</div></div></div>'+
        (inh.scan?'<div style="margin-top:0.6rem;"><div class="tt-h">'+T('pn.scan','Paspoortscan')+'</div><img src="'+esc(inh.scan)+'" alt="'+T('pn.scan','Paspoortscan')+'" style="width:100%;border-radius:10px;margin-top:0.4rem;"></div>':'');
    }
    return '<div class="card" style="border-color:var(--gold);"><div class="tt-h" style="color:var(--gold);">'+T('pn.inzage','Inzage')+' · '+T('pn.niveau.'+inh.niveau, inh.niveau)+'</div><div style="margin-top:0.5rem;">'+body+'</div>'+
      '<button class="obtn" id="pnSluit" style="margin-top:0.7rem;">'+T('pn.sluit','Sluiten')+'</button></div>';
  }
  function paspoortBind(el){
    el.querySelectorAll('[data-pnvraag]').forEach(b => b.addEventListener('click', async () => {
      const codenaam = ($('#pnCode').value||'').trim(); if (!codenaam) return toast(T('pn.geefcode','Vul een codenaam in.'));
      const body = { codenaam, niveau: b.dataset.pnvraag };
      const lft = $('#pnLeeftijd').value; if (lft) body.minLeeftijd = Number(lft);
      const reden = $('#pnReden').value; if (reden) body.reden = reden;
      try {
        const r = await API.call('/supplier/paspoort/vraag', body);
        const uit = $('#pnUitslag');
        if (r.niveau === 'bevestiging'){
          const be = r.bevestiging;
          uit.innerHTML = '<div style="padding:0.6rem 0.8rem;border:1px solid var(--line);border-radius:12px;font-size:0.88rem;">'+
            (be.geverifieerd?'✅ '+T('pn.geverifieerd','RTG-geverifieerd'):'⛔ '+T('pn.nietgeverifieerd','niet geverifieerd'))+
            (be.voldoetLeeftijd!=null?' · '+(be.voldoetLeeftijd?'✅ '+be.minLeeftijd+'+':'⛔ '+T('pn.voldoetniet','voldoet niet')):'')+'</div>';
        } else {
          uit.innerHTML = '<div style="padding:0.6rem 0.8rem;border:1px solid var(--line);border-radius:12px;font-size:0.85rem;color:var(--amber);">⏳ '+T('pn.verstuurd','Verzoek verstuurd. De gast krijgt een melding en kan het goedkeuren of weigeren.')+'</div>';
          await laadPaspoort();
        }
      } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-pnbekijk]').forEach(b => b.addEventListener('click', async () => {
      try { const r = await API.call('/supplier/paspoort/bekijk', { id: b.dataset.pnbekijk }); paspoortInzage = r.inhoud; renderPaspoort(); const c = $('#paspoortWrap'); if (c) c.scrollTop = 0; }
      catch(e){ toast(e.message); await laadPaspoort(); }
    }));
    const sluit = el.querySelector('#pnSluit'); if (sluit) sluit.addEventListener('click', () => { paspoortInzage = null; renderPaspoort(); });
    const incBtn = el.querySelector('#pnIncMeld');
    if (incBtn) incBtn.addEventListener('click', async () => {
      const codenaam = ($('#pnIncCode').value||'').trim(); const reden = ($('#pnIncReden').value||'').trim();
      if (!codenaam) return toast(T('pn.geefcode','Vul een codenaam in.'));
      if (reden.length < 10) return toast(T('pn.geefreden','Beschrijf het incident (min. 10 tekens).'));
      try { await API.call('/supplier/paspoort/incident', { codenaam, reden, niveau: $('#pnIncNiveau').value }); toast(T('pn.incok','Incident gemeld. RTG beoordeelt het.')); $('#pnIncCode').value=''; $('#pnIncReden').value=''; await laadPaspoort(); }
      catch(e){ toast(e.message); }
    });
  }

  // ---- groothandel: de groothandel beheert assortiment, functies en orders ----
  let ghEdit = null;
  async function renderGroothandel(){
    const el = $('#groothandelWrap'); if (!el) return;
    if (!has('groothandel')){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/groothandel/overzicht'); } catch(e){ return; }
    const cats = d.categorieen || [];
    // functie-schakelaars
    const ghChips = '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;">' +
      (d.functies||[]).map(f => '<button class="js-ghf" data-id="'+f.id+'" data-aan="'+f.aan+'" style="border:1px solid '+(f.aan?'#1f5637':'var(--line)')+';background:'+(f.aan?'#12321f':'var(--card2)')+';color:'+(f.aan?'#7EE0A3':'var(--soft)')+';border-radius:999px;padding:0.32rem 0.7rem;font-size:0.72rem;font-weight:600;font-family:inherit;">'+esc(f.naam)+'</button>').join('') +
      '</div>';
    let h = funcBlok(T('gh.functies','Uw functies (aan/uit)'), d.functies||[], ghChips);
    // binnenkomende orders
    const ink = d.inkomend || { open:[], afgerond:[], omzet:0 };
    h += '<div class="st-sec">'+T('gh.orders','Bestellingen')+' · '+T('gh.omzet','omzet')+' '+eur(ink.omzet||0)+'</div>';
    h += ink.open.length ? ink.open.map(o => ghOrderKaart(o, true)).join('') : '<p class="sub">'+T('gh.geenorders','Geen openstaande bestellingen.')+'</p>';
    if (ink.afgerond.length) h += '<details style="margin-top:0.6rem;"><summary class="sub" style="cursor:pointer;">'+T('gh.afgerond','Afgerond')+' ('+ink.afgerond.length+')</summary>'+ink.afgerond.map(o=>ghOrderKaart(o,false)).join('')+'</details>';
