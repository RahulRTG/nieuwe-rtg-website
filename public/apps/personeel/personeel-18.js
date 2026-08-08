    wrap.innerHTML = html;
    wrap.querySelectorAll('[data-pkkant]').forEach(b => b.addEventListener('click', () => {
      pdaKant = b.dataset.pkkant;
      try { localStorage.setItem('rtg_pda_kant', pdaKant); } catch(e){}
      renderKeuken();
    }));
    // de voorraadbalk: 86 op advies en derving melden, recht vanaf de vloer
    wrap.querySelectorAll('[data-pk86]').forEach(b => b.addEventListener('click', async () => {
      try {
        await API.call('/supplier/menu/86', { itemId: b.dataset.pk86, op: true });
        toast(''+T('st.86gezet','86 gezet; leden kunnen het niet meer bestellen.'));
        pkWvAt = 0; pkLaadWerkvloer(); await refresh();
      } catch(e){ toast(e.message); }
    }));
    const pkDerf = wrap.querySelector('[data-pkderf]'); if (pkDerf) pkDerf.addEventListener('click', async () => {
      const naam = prompt(T('st.derfwat','Welk artikel is er weg (naam van de voorraadlijst)?')); if (!naam) return;
      const art = ((pkWv && pkWv.artikelen) || []).find(a => a.naam.toLowerCase() === naam.trim().toLowerCase());
      if (!art){ toast(T('st.derfgeen','Dat artikel staat niet op de voorraadlijst.')); return; }
      const hv = prompt(T('vr.derfvraag','Hoeveel is er weg (breuk, derving)?')); if (!hv) return;
      const reden = prompt(T('vr.derfreden','Reden?')) || '';
      try {
        await API.call('/supplier/keuken/verspilling', { artikelId: art.id, hoeveelheid: Number(String(hv).replace(',', '.')), reden });
        toast(''+T('st.derfok','Geboekt in het voorraadlogboek.'));
        pkWvAt = 0; pkLaadWerkvloer();
      } catch(e){ toast(e.message); }
    });
    wrap.querySelectorAll('[data-pkover]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/overschot', { op: 'gebruikt', id: b.dataset.pkover }); await refresh(); openTab('keuken'); } catch(e){ toast(e.message); }
    }));
    // aanmelden op deze kant: het scherm en de coach rekenen met de bezetting
    const lijnBtn = wrap.querySelector('[data-pklijn]'); if (lijnBtn) lijnBtn.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/lijn', { sectie: pdaKant }); toast(d.aangemeld ? ''+T('lijn.aant','Aangemeld op deze kant.') : T('lijn.aftoast','Afgemeld van deze kant.')); await refresh(); openTab('keuken'); } catch(e){ toast(e.message); }
    });
    // de gekozen personen: pas-meldingen (tril + toast) per toestel aan of uit
    const bel = wrap.querySelector('[data-pkbel]'); if (bel) bel.addEventListener('click', () => {
      pdaPasBel = !pdaPasBel;
      try { localStorage.setItem('rtg_pda_pasbel', pdaPasBel ? 'aan' : 'uit'); } catch(e){}
      toast(pdaPasBel ? ''+T('pd.k.belaan','Dit toestel krijgt pas-meldingen.') : ''+T('pd.k.beluit','Pas-meldingen staan uit op dit toestel.'));
      renderKeuken();
    });
    wrap.querySelectorAll('[data-pkgo]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/order/sectie', { ref: b.dataset.pkgo, sectie: pdaKant, phase: b.dataset.phase }); toast(b.dataset.phase==='klaar'?T('pd.k.klaar','Kant klaargemeld; het keukenscherm ziet het direct.'):T('pd.k.gestart','Gestart.')); await refresh(); openTab('keuken'); } catch(e){ toast(e.message); }
    }));
    // de barkant meldt via het station, precies zoals het grote barscherm
    wrap.querySelectorAll('[data-pkbar]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/order/station', { ref: b.dataset.pkbar, station: 'bar', phase: b.dataset.phase }); toast(b.dataset.phase==='klaar'?T('pd.b.klaar','Drankjes klaargemeld; de bediening ziet het direct.'):T('pd.k.gestart','Gestart.')); await refresh(); openTab('keuken'); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-pkdish]').forEach(d => d.addEventListener('click', async () => {
      // gerechtenkennis op zak: tik op het gerecht voor de bereidingswijze
      const open = d.nextElementSibling && d.nextElementSibling.classList.contains('pk-kennis');
      wrap.querySelectorAll('.pk-kennis').forEach(x => x.remove());
      if (open) return;
      const div = document.createElement('div');
      div.className = 'pk-kennis';
      div.style.cssText = 'white-space:pre-line;font-size:0.78rem;color:var(--soft);background:var(--card2,#191715);border:1px solid var(--line);border-radius:10px;padding:0.6rem 0.75rem;margin:0.25rem 0 0.4rem;line-height:1.55;';
      div.textContent = T('ds.laden','De AI-chef schrijft...');
      d.insertAdjacentElement('afterend', div);
      try { const k = await API.call('/supplier/menu/kennis', { itemId: d.dataset.pkdish, soort: 'bereiding' }); div.textContent = k.tekst; } catch(e){ div.textContent = e.message; }
    }));
  }

  /* ---- entree: programma van vandaag + check-in op eigen naam ---- */
  let pdProgramma = null;
  let pdVkLaatst = ''; // de laatste deurverkoop (de entreecode blijft leesbaar na verversen)
  // ---- winkelvloer (retail) ----
  let pdRetail = null;      // retail-toestand van het merk (voorraad, paskamer, apart)
  let winkelKlant = null;   // geopend klantdossier op de vloer
  let winkelCart = [];      // mobiele kassa: [{vsku, naam, kleur, maat, price, aantal}]
  const heeftRetail = () => heeftModule('winkel');
  async function laadWinkel(){
    if (!heeftRetail()) return;
    try { pdRetail = (await API.call('/supplier/retail', {})).retail; } catch(e){ pdRetail = { artikelen:[], paskamer:[], apart:[], klanten:[], stats:{} }; }
    renderWinkel();
  }
  function winkelInput(id, ph){ return '<input id="'+id+'" placeholder="'+ph+'" style="flex:1;background:var(--card2,#191715);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.85rem;font-size:0.95rem;color:var(--txt);outline:none;font-family:inherit;">'; }
  function renderWinkel(){
    const tabBtn = document.getElementById('tabWinkel');
    if (tabBtn) tabBtn.style.display = heeftRetail() ? '' : 'none';
    const wrap = $('#winkelWrap');
    if (!wrap) return;
    if (!heeftRetail()){ wrap.innerHTML = ''; return; }
    if (!pdRetail){ wrap.innerHTML = '<div class="card">…</div>'; laadWinkel(); return; }
    let html = '';
    // mobiele kassa (bon)
    const cartTot = winkelCart.reduce((n, r) => n + r.price * r.aantal, 0);
    html += '<div class="card"><div class="k" style="display:flex;justify-content:space-between;align-items:center;">'+T('pd.w.kassa','Mobiele kassa')+
      (winkelKlant?'<span style="color:var(--gold);font-size:0.66rem;">'+esc(winkelKlant.codenaam||winkelKlant.key)+'</span>':'')+'</div>'+
      (winkelCart.length ? '<div style="margin-top:0.5rem;">'+winkelCart.map((r,i) => '<div class="task"><span class="ic"></span><div class="t"><b>'+esc(r.naam)+'</b><span>'+esc(r.kleur)+' · '+esc(r.maat)+' · '+eur(r.price)+' × '+r.aantal+'</span></div><button class="abtn ghost" data-wcartdel="'+i+'">✕</button></div>').join('')+
        '<div style="display:flex;justify-content:space-between;font-weight:700;margin-top:0.6rem;font-size:1rem;"><span>'+T('pd.w.totaal','Totaal')+'</span><span>'+eur(cartTot)+'</span></div>'+
        '<div style="display:flex;gap:0.5rem;margin-top:0.6rem;"><button class="abtn" data-wbetaal="rtgpay" style="flex:1;">RTG Pay</button><button class="abtn" data-wbetaal="contant" style="flex:1;background:var(--card2);color:var(--txt);border:1px solid var(--line);">'+T('pd.w.contant','Contant')+'</button></div>'+
        '<button class="abtn ghost" id="wCartLeeg" style="margin-top:0.5rem;width:100%;">'+T('pd.w.leeg','Bon leegmaken')+'</button></div>'
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.w.leegbon','Zoek een artikel en tik + om het op de bon te zetten.')+'</div>')+'</div>';
    // voorraad opzoeken
    html += '<div class="card"><div class="k">'+T('pd.w.zoek','Voorraad opzoeken')+'</div>'+
      '<div style="display:flex;gap:0.5rem;margin-top:0.55rem;">'+winkelInput('wZoek', T('pd.w.zoekph','Naam, kleur of maat…'))+'<button class="abtn" id="wZoekBtn">'+T('pd.w.zoekbtn','Zoek')+'</button></div>'+
      '<div id="wZoekUit" style="margin-top:0.5rem;"></div></div>';
    // paskamerverzoeken
    const pk = pdRetail.paskamer || [];
    html += '<div class="card"><div class="k">'+T('pd.w.paskamer','Paskamerverzoeken')+' ('+pk.length+')</div>'+
      (pk.length ? pk.map(v => '<div class="task"><span class="ic"></span><div class="t"><b>'+esc(v.artikelNaam)+' · '+esc(v.maat)+'</b><span>'+esc(v.codenaam||'Gast')+' · '+esc(v.kleur)+(v.paskamer?' · '+esc(v.paskamer):'')+'</span></div><button class="abtn" data-wbreng="'+v.id+'">'+T('pd.w.breng','Gebracht')+'</button></div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.w.geenpk','Geen open verzoeken.')+'</div>')+'</div>';
    // apart gelegd
    const ap = pdRetail.apart || [];
