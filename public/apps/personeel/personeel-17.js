    if (dr.length) html += '<div class="card"><div class="k">'+T('pd.boer.dieren','Dieren voeren')+'</div>'+
      dr.map(d => { const gevoerd = d.laatsteVoer && d.laatsteVoer.slice(0,10)===vandaag;
        return '<div class="task"><span class="ic">'+(d.soort==='melkkoe'?'🐄':d.soort==='legkip'?'🐔':d.soort==='varken'?'🐖':d.soort==='geit'?'🐐':'🐑')+'</span><div class="t"><b>'+esc(d.soortLabel)+' × '+d.aantal+'</b><span>'+(d.stal?esc(d.stal)+' · ':'')+d.voerKgPerDag+' kg '+T('pd.boer.voer','voer')+(gevoerd?' · ✓ '+T('pd.boer.gevoerd','gevoerd'):'')+'</span></div>'+
        (gevoerd?'<span style="color:#7EE0A3;font-size:1.1rem;">✓</span>':'<button class="abtn" data-bvoer="'+d.id+'">🌾 '+T('pd.boer.voeren','Voeren')+'</button>')+'</div>'; }).join('')+'</div>';
    wrap.innerHTML = html;
    wrap.querySelectorAll('[data-btaak]').forEach(b => b.addEventListener('click', async () => { try { boerPdaToe(await API.call('/supplier/boerderij/taak/klaar', { id: b.dataset.btaak })); toast(T('pd.boer.klaarok','Taak afgerond.')); } catch(e){ toast(e.message); } }));
    wrap.querySelectorAll('[data-boogst]').forEach(b => b.addEventListener('click', async () => { try { const r = await API.call('/supplier/boerderij/oogst', { id: b.dataset.boogst }); toast(T('pd.boer.oogstok','Geoogst: ')+r.opbrengst+' '+r.eenheid); boerPdaToe(r); } catch(e){ toast(e.message); } }));
    wrap.querySelectorAll('[data-bwater]').forEach(b => b.addEventListener('click', async () => { try { boerPdaToe(await API.call('/supplier/boerderij/water', { id: b.dataset.bwater })); toast(T('pd.boer.waterok','Beregend.')); } catch(e){ toast(e.message); } }));
    wrap.querySelectorAll('[data-bvoer]').forEach(b => b.addEventListener('click', async () => { try { const r = await API.call('/supplier/boerderij/voer', { id: b.dataset.bvoer }); toast(T('pd.boer.voerok','Gevoerd.')); boerPdaToe(r); } catch(e){ toast(e.message); } }));
  }

  const heeftEntree = () => !!(state && state.supplier && (state.supplier.caps || []).includes('tickets'));
  async function laadEntree(){
    if (!heeftEntree()) return;
    try { pdProgramma = await API.call('/supplier/programma', {}); } catch(e){ pdProgramma = { datum: '', slots: [] }; }
    renderEntree();
  }
  function renderEntree(){
    const tabBtn = document.getElementById('tabEntree');
    if (tabBtn) tabBtn.style.display = heeftEntree() ? '' : 'none';
    const wrap = $('#entreeWrap');
    if (!wrap) return;
    if (!heeftEntree()){ wrap.innerHTML = ''; return; }
    if (!pdProgramma){ wrap.innerHTML = '<div class="card">\u2026</div>'; laadEntree(); return; }
    const slots = pdProgramma.slots || [];
    const totBinnen = slots.reduce((n, x) => n + x.binnen, 0);
    const totVerkocht = slots.reduce((n, x) => n + x.verkocht, 0);
    wrap.innerHTML =
      '<div class="card"><div class="k">'+T('pd.e.check','Entree-check')+'</div>'+
      '<div style="display:flex;gap:0.5rem;margin-top:0.55rem;">'+
      '<input id="pdCode" placeholder="'+T('pd.e.codeph','Code, bijv. K7M2PX')+'" autocapitalize="characters" style="flex:1;background:var(--card2,#191715);border:1px solid var(--line);border-radius:12px;padding:0.75rem 0.9rem;font-size:1.05rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--txt);outline:none;font-family:inherit;">'+
      '<button class="abtn" id="pdCheck">'+T('pd.e.binnen','Binnen')+'</button></div>'+
      '<div id="pdCheckUit" style="margin-top:0.5rem;font-size:0.84rem;color:var(--muted);"></div></div>'+
      // de kassa aan de deur: kaartje verkopen, contant of met RTG Pay, VIP kan
      (slots.length ? '<div class="card"><div class="k">'+T('pd.e.verkoop','Deurverkoop')+'</div>'+
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">'+
      '<select id="pdVkSlot" style="flex:2;min-width:150px;background:var(--card2,#191715);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.6rem;color:var(--txt);font-family:inherit;">'+
        slots.map((x,i) => '<option value="'+i+'">'+x.tijd+' \u00B7 '+esc(x.naam)+' ('+(x.capaciteit-x.verkocht)+' '+T('pd.e.vrij','vrij')+')</option>').join('')+'</select>'+
      '<input id="pdVkPers" type="number" min="1" max="20" value="1" style="width:64px;background:var(--card2,#191715);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.6rem;color:var(--txt);font-family:inherit;" aria-label="personen">'+
      '<select id="pdVkSoort" style="flex:1;min-width:90px;background:var(--card2,#191715);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.6rem;color:var(--txt);font-family:inherit;"><option value="std">'+T('pd.e.std','Standaard')+'</option><option value="vip">\u2B50 VIP</option></select></div>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.45rem;">'+
      '<button class="abtn" data-pdvk="contant" style="flex:1;">\uD83D\uDCB6 '+T('pd.e.contant','Contant')+'</button>'+
      '<button class="abtn" data-pdvk="rtgpay" style="flex:1;">RTG Pay</button></div>'+
      '<div id="pdVkUit" style="margin-top:0.5rem;font-size:0.84rem;color:var(--muted);">'+(pdVkLaatst||'')+'</div></div>' : '')+
      '<div class="card"><div class="k">'+T('pd.e.prog','Programma vandaag')+' \u00B7 '+totBinnen+'/'+totVerkocht+' '+T('pd.e.binnen2','binnen')+'</div>'+
      (slots.length ? slots.map(x =>
        '<div class="task"><span class="ic">'+(x.binnen>=x.verkocht&&x.verkocht?'\u2705':'\uD83C\uDF9F\uFE0F')+'</span><div class="t"><b>'+x.tijd+' \u00B7 '+esc(x.naam)+'</b>'+
        '<span>'+x.binnen+'/'+x.verkocht+' '+T('pd.e.binnen2','binnen')+' \u00B7 '+T('pd.e.verkocht','verkocht')+' '+x.verkocht+'/'+x.capaciteit+'</span></div></div>'
      ).join('') : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.e.leeg','Vandaag geen tijdsloten.')+'</div>')+'</div>';
    const c = document.getElementById('pdCheck');
    if (c) c.addEventListener('click', async () => {
      const uit = document.getElementById('pdCheckUit');
      try {
        const r = await API.call('/supplier/ticket/checkin', { code: $('#pdCode').value });
        uit.innerHTML = '<b style="color:var(--green);">\u2705 '+(r.ticket.vip?'\u2B50 VIP \u00B7 ':'')+esc(r.ticket.codename)+' \u00B7 '+r.ticket.personen+'p \u00B7 '+esc(r.ticket.naam)+'</b>'+
          (r.ticket.zorg?'<div style="margin-top:0.3rem;color:#E2B93B;">\u26A0 '+esc(pkZorg(r.ticket.zorg))+'</div>':'');
        $('#pdCode').value = '';
        laadEntree();
      } catch(e){ uit.innerHTML = '<b style="color:#E36385;">\u26D4 '+esc(e.message)+'</b>'; }
    });
    // de deurverkoop: het kaartje is meteen betaald en de code kan naar binnen
    wrap.querySelectorAll('[data-pdvk]').forEach(b => b.addEventListener('click', async () => {
      const uit = document.getElementById('pdVkUit');
      const slot = slots[parseInt(($('#pdVkSlot')||{}).value, 10) || 0];
      if (!slot) return;
      const body = {
        activiteitId: slot.activiteitId, tijd: slot.tijd,
        personen: parseInt(($('#pdVkPers')||{}).value, 10) || 1,
        vip: ($('#pdVkSoort')||{}).value === 'vip',
        method: b.dataset.pdvk
      };
      if (body.method === 'rtgpay'){
        // tap to pay als het kan, met altijd de uitweg om de code te typen
        let code = null;
        if (window.TapPay && TapPay.kan() && window.confirm(T('pd.w.tapkeuze','Tap to pay: de klant tikt zijn toestel hiertegen. Liever de code typen (bijv. als NFC niet werkt)? Kies dan Annuleren.'))){
          toast('\uD83D\uDCF3 '+T('pd.w.tap','Tap to pay: laat de klant het toestel hiertegen houden...'));
          code = await TapPay.lees(12000);
          if (!code) toast(T('pd.w.tapmis','Geen tik ontvangen; typ de code van de klant.'));
        }
        if (!code){
          const c = window.prompt(T('pd.w.paycode','Betaalcode van de klant (uit de app):'));
          if (!c) return;
          code = c.trim().toUpperCase();
        }
        body.payCode = code;
        body.idem = 'deur-' + Date.now();
      }
      try {
        const r = await API.call('/supplier/ticket/deurverkoop', body);
        // de code blijft staan als het programma zich ververst
        pdVkLaatst = '<b style="color:var(--green);">\u2705 '+(r.ticket.vip?'\u2B50 VIP \u00B7 ':'')+r.ticket.personen+'p \u00B7 '+esc(r.ticket.naam)+' \u00B7 \u20AC '+r.ticket.total+'</b>'+
          '<div style="margin-top:0.35rem;font-size:1.3rem;letter-spacing:0.22em;font-weight:700;color:var(--gold);">'+esc(r.ticket.code)+'</div>'+
          '<div style="font-size:0.72rem;color:var(--soft);">'+T('pd.e.geefcode','Geef deze entreecode aan de gast.')+'</div>';
        uit.innerHTML = pdVkLaatst;
        laadEntree();
      } catch(e){ uit.innerHTML = '<b style="color:#E36385;">\u26D4 '+esc(e.message)+'</b>'; }
    }));
  }

  // ---- vaart (charter): de schipper handelt de charters van vandaag af ----
  let pdCharters = null;
  const heeftCharter = () => !!(state && state.supplier && (state.supplier.caps || []).includes('charter'));
  const VAART_ST = { 'aangevraagd':'klaar om uit te varen', 'lopend':'op zee', 'afgerond':'afgerond' };
  async function laadVaart(){
