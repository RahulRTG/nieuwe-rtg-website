    // incident melden
    html += '<div class="card"><div class="tt-h">'+T('pn.incident','Incident: identiteit opeisen')+'</div>'+
      '<p class="ds s-kpqwcd">'+T('pn.incidenttip','Alleen bij een echt incident. RTG-kantoor beoordeelt het verzoek en geeft de identiteit pas daarna vrij. Alles wordt gelogd.')+'</p>'+
      '<div class="field"><label>'+T('pn.codenaam','Codenaam van de gast')+'</label><input id="pnIncCode" placeholder="'+T('pn.codeph','Bijv. Zilveren Valk 12')+'" autocomplete="off"></div>'+
      '<div class="field"><label>'+T('pn.incReden','Wat is er gebeurd?')+'</label><textarea id="pnIncReden" rows="2" '+sel+' placeholder="'+T('pn.incRedenph','Beschrijf het incident (min. 10 tekens)')+'"></textarea></div>'+
      '<div class="field"><label>'+T('pn.incNiveau','Gevraagd niveau')+'</label><select id="pnIncNiveau" '+sel+'><option value="idkaart">'+T('pn.niveau.idkaart','ID-kaart')+'</option><option value="paspoort">'+T('pn.niveau.paspoort','Paspoort')+'</option></select></div>'+
      '<button class="obtn warn h-mt70" id="pnIncMeld">'+T('pn.incMeld','Incident melden bij RTG')+'</button></div>';
    // eigen incidenten
    const inc = paspoortData.incidenten || [];
    if (inc.length) html += '<div class="card"><div class="tt-h">'+T('pn.incidenten','Mijn incidenten')+'</div>'+
      '<div class="h-mt50">'+inc.map(i => '<div class="mitem"><div class="r1"><span class="nm">'+esc(i.codenaam||'\u2013')+'</span>'+pnBadge(i.status)+'</div><div class="ds">'+esc(i.reden)+'</div></div>').join('')+'</div></div>';
    el.innerHTML = html;
    paspoortBind(el);
  }
  function paspoortInzageKaart(inh){
    let body = '';
    if (inh.niveau === 'bevestiging'){
      body = '<div class="s-papaze">'+(inh.geverifieerd?''+T('pn.geverifieerd','RTG-geverifieerd'):''+T('pn.nietgeverifieerd','niet geverifieerd'))+
        (inh.voldoetLeeftijd!=null?'<br>'+(inh.voldoetLeeftijd?''+T('pn.voldoet','voldoet aan de leeftijdseis'):''+T('pn.voldoetniet','voldoet NIET aan de leeftijdseis')):'')+'</div>';
    } else {
      body = '<div class="s-1x95p66">'+
        (inh.foto?'<img src="'+esc(inh.foto)+'" alt="'+T('pn.pasfoto','Pasfoto')+'" class="s-1nxzbro">':'')+
        '<div><div class="s-1hx94wt">'+esc(inh.naam||'')+'</div>'+
        '<div class="ds">'+(inh.nationaliteit?esc(inh.nationaliteit)+' · ':'')+(inh.geboortedatum?esc(inh.geboortedatum):'')+(inh.leeftijd!=null?' ('+inh.leeftijd+')':'')+'</div>'+
        '<div class="ds s-14w8tzk">'+(inh.geverifieerd?''+T('pn.geverifieerd','RTG-geverifieerd'):'')+(inh.gezichtGecontroleerd?' · '+T('pn.gezicht','gezicht gecontroleerd'):'')+'</div></div></div>'+
        (inh.scan?'<div class="h-mt60"><div class="tt-h">'+T('pn.scan','Paspoortscan')+'</div><img src="'+esc(inh.scan)+'" alt="'+T('pn.scan','Paspoortscan')+'" class="s-1bvkg3n"></div>':'');
    }
    return '<div class="card s-1p274fk"><div class="tt-h s-1poh6kx">'+T('pn.inzage','Inzage')+' · '+T('pn.niveau.'+inh.niveau, inh.niveau)+'</div><div class="h-mt50">'+body+'</div>'+
      '<button class="obtn h-mt70" id="pnSluit">'+T('pn.sluit','Sluiten')+'</button></div>';
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
          uit.innerHTML = '<div class="s-1ki64hw">'+
            (be.geverifieerd?''+T('pn.geverifieerd','RTG-geverifieerd'):''+T('pn.nietgeverifieerd','niet geverifieerd'))+
            (be.voldoetLeeftijd!=null?' · '+(be.voldoetLeeftijd?''+be.minLeeftijd+'+':''+T('pn.voldoetniet','voldoet niet')):'')+'</div>';
        } else {
          uit.innerHTML = '<div class="s-emejf6">'+T('pn.verstuurd','Verzoek verstuurd. De gast krijgt een melding en kan het goedkeuren of weigeren.')+'</div>';
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
    const ghChips = '<div class="s-c1fzjn">' +
      (d.functies||[]).map(f => '<button class="js-ghf ' + (f.aan ? 's-is1nsk' : 's-hlj81h') + '" data-id="'+f.id+'" data-aan="'+f.aan+'">'+esc(f.naam)+'</button>').join('') +
      '</div>';
    let h = funcBlok(T('gh.functies','Uw functies (aan/uit)'), d.functies||[], ghChips);
    // binnenkomende orders
    const ink = d.inkomend || { open:[], afgerond:[], omzet:0 };
    h += '<div class="st-sec">'+T('gh.orders','Bestellingen')+' · '+T('gh.omzet','omzet')+' '+eur(ink.omzet||0)+'</div>';
    h += ink.open.length ? ink.open.map(o => ghOrderKaart(o, true)).join('') : '<p class="sub">'+T('gh.geenorders','Geen openstaande bestellingen.')+'</p>';
    if (ink.afgerond.length) h += '<details class="h-mt60"><summary class="sub" style="cursor:pointer;">'+T('gh.afgerond','Afgerond')+' ('+ink.afgerond.length+')</summary>'+ink.afgerond.map(o=>ghOrderKaart(o,false)).join('')+'</details>';
    // assortiment
    h += '<div class="st-sec h-mt100">'+T('gh.assortiment','Assortiment')+' <button class="js-ghnew s-2vt4hk">+ '+T('gh.nieuw','Nieuw product')+'</button></div>';
    h += '<div id="ghForm"></div>';
    h += '<div class="h-mt50">'+(d.producten||[]).map(p =>
      '<div class="s-wx1jrq">'+
      '<div class="h-flex1"><b class="s-2txdhg">'+esc(p.naam)+'</b><span class="sub"> · '+esc(p.categorie)+' · '+T('gh.per','per')+' '+esc(p.eenheid)+'</span>'+
      '<div class="sub">'+T('gh.inkoop','inkoop')+' '+eur(p.inkoopPrijs)+' · '+T('gh.consument','consument')+' '+eur(p.consumentPrijs)+' · '+T('gh.voorraad','voorraad')+' '+p.voorraad+(p.actief?'':' · <span class="s-12itpbj">'+T('gh.uit','uit')+'</span>')+'</div></div>'+
      '<button class="js-ghedit s-nvw2hz" data-id="'+p.id+'">'+T('gh.bewerk','Bewerk')+'</button></div>').join('');
    el.innerHTML = h;
    wireFuncBlok(el);
