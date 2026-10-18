/* een verkoopslot kiezen */
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
        body.idem = RTGIdem('deur');
      }
      try {
        const r = await API.call('/supplier/ticket/deurverkoop', body);
        // de code blijft staan als het programma zich ververst
        pdVkLaatst = '<b class="s-11zyxj0">\u2705 '+(r.ticket.vip?'\u2B50 VIP \u00B7 ':'')+r.ticket.personen+'p \u00B7 '+esc(r.ticket.naam)+' \u00B7 \u20AC '+r.ticket.total+'</b>'+
          '<div class="s-1dlo5i1">'+esc(r.ticket.code)+'</div>'+
          '<div class="s-9uxsi">'+T('pd.e.geefcode','Geef deze entreecode aan de gast.')+'</div>';
        uit.innerHTML = pdVkLaatst;
        laadEntree();
      } catch(e){ uit.innerHTML = '<b class="s-14oqrbo">\u26D4 '+esc(e.message)+'</b>'; }
    }));
  }

  // ---- vaart (charter): de schipper handelt de charters van vandaag af ----
  let pdCharters = null;
  const heeftCharter = () => heeftModule('vaart');
  const VAART_ST = { 'aangevraagd':'klaar om uit te varen', 'lopend':'op zee', 'afgerond':'afgerond' };
  async function laadVaart(){
    if (!heeftCharter()) return;
    try { pdCharters = (await API.call('/supplier/charter/overzicht', {})).charters; } catch(e){ pdCharters = []; }
    renderVaart();
  }
  function renderVaart(){
    const tabBtn = document.getElementById('tabVaart');
    if (tabBtn) tabBtn.style.display = heeftCharter() ? '' : 'none';
    const wrap = $('#vaartWrap');
    if (!wrap) return;
    if (!heeftCharter()){ wrap.innerHTML = ''; return; }
    if (!pdCharters){ wrap.innerHTML = '<div class="card">…</div>'; laadVaart(); return; }
    wrap.innerHTML = pdCharters.length ? pdCharters.map(c => {
      let knop = '';
      if (c.status === 'aangevraagd') knop =
        '<button class="abtn ghost" data-cvfoto="'+c.ref+'" data-fase="voor">'+T('pd.va.voor','Voor-foto')+' ('+c.fotosVoor+')</button> '+
        '<button class="abtn" data-cvst="'+c.ref+'" data-st="lopend">'+T('pd.va.uitvaren','Uitvaren')+'</button>';
      else if (c.status === 'lopend') knop =
        '<button class="abtn ghost" data-cvfoto="'+c.ref+'" data-fase="na">'+T('pd.va.na','Na-foto')+' ('+c.fotosNa+')</button> '+
        '<button class="abtn" data-cvst="'+c.ref+'" data-st="afgerond">'+T('pd.va.terug','Teruggeven')+'</button>';
      return '<div class="card">'+
        (c.sos && c.sos.length ? '<div class="s-17m9xzd"><b>SOS:</b> '+esc(c.sos[0].bericht)+
          (Number.isFinite(c.sos[0].lat)?' · <a class="s-10ddpjd" target="_blank" rel="noopener" href="geo:'+c.sos[0].lat+','+c.sos[0].lng+'?q='+c.sos[0].lat+','+c.sos[0].lng+'">'+T('pd.va.kaart','kaart')+'</a>':'')+
          ' <button class="abtn" data-cvsosok="'+c.ref+'" style="padding:0.15rem 0.7rem;">'+T('pd.va.sosok','Afgehandeld')+'</button></div>':'')+
        '<div class="k">'+esc(c.boot)+' · '+esc(c.type)+'</div>'+
        '<div class="s-ob87ho">'+esc(c.codename)+' · '+c.van+' → '+c.tot+' · '+(c.gasten?c.gasten+' '+T('pd.va.gasten','gasten')+' · ':'')+(c.metSkipper?''+T('pd.va.metskipper','met schipper'):T('pd.va.bareboat','bareboat'))+' · '+T('pd.va.st.'+c.status, VAART_ST[c.status]||c.status)+'</div>'+
        (c.teruggave ? '<div class="' + (c.teruggave.meerkosten>0 ? 's-15rg78c' : 's-1jfjxko') + '">'+(c.teruggave.meerkosten>0?T('pd.va.meer','Meerkosten')+' '+eur(c.teruggave.meerkosten):'✓ '+T('pd.va.geenmeer','geen meerkosten'))+'</div>':'')+
        (knop?'<div class="s-15zpg3n">'+knop+'</div>':'')+
        '</div>';
    }).join('') : '<div class="card s-1n4m4tb">'+T('pd.va.geen','Geen charters vandaag.')+'</div>';
    wrap.querySelectorAll('[data-cvst]').forEach(b => b.addEventListener('click', async () => {
      const body = { ref: b.dataset.cvst, status: b.dataset.st };
      if (b.dataset.st === 'lopend'){
        const uren = prompt(T('pd.va.qurenstart','Motorurenstand bij uitvaren?')); if (uren == null) return;
        body.urenStart = Number(uren); body.brandstofStart = Number(prompt(T('pd.va.qbrandstart','Brandstof bij uitvaren in achtsten (8 = vol)?'), '8'));
      } else if (b.dataset.st === 'afgerond'){
        const uren = prompt(T('pd.va.qureneind','Motorurenstand bij teruggave?')); if (uren == null) return;
        body.urenEind = Number(uren); body.brandstofEind = Number(prompt(T('pd.va.qbrandeind','Brandstof bij teruggave in achtsten (8 = vol)?'), '8'));
      }
      try { await API.call('/supplier/charter/status', body); toast(T('pd.va.ok','Bijgewerkt.')); await laadVaart(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-cvsosok]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/charter/sos-ok', { ref: b.dataset.cvsosok }); toast(T('pd.va.sosafg','SOS afgehandeld.')); await laadVaart(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-cvfoto]').forEach(b => b.addEventListener('click', () => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';
      inp.onchange = () => { const file = inp.files[0]; if (!file) return; const r = new FileReader();
        r.onload = () => { const img = new Image(); img.onload = async () => {
          const cv = document.createElement('canvas'); const sc = Math.min(1, 1000 / Math.max(img.width, img.height));
          cv.width = img.width * sc; cv.height = img.height * sc; cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          try { await API.call('/supplier/charter/foto', { ref: b.dataset.cvfoto, fase: b.dataset.fase, foto: cv.toDataURL('image/jpeg', 0.7) });
            toast(T('pd.va.fotook','De staat is vastgelegd.')); await laadVaart(); } catch(e){ toast(e.message); } };
          img.src = r.result; };
        r.readAsDataURL(file); };
      inp.click();
    }));
  }

  // ---- autoverkoop op de PDA: proefritten inplannen/rijden en auto's afleveren ----
  let pdVerkoop = null;
  const heeftVerkoop = () => heeftModule('verkoop');
  async function laadVerkoop(){
    if (!heeftVerkoop()) return;
    try { pdVerkoop = await API.call('/supplier/verkoop/overzicht', {}); } catch(e){ pdVerkoop = { pda: [] }; }
    renderVerkoop();
  }
  function renderVerkoop(){
    const tabBtn = document.getElementById('tabVerkoop');
    if (tabBtn) tabBtn.style.display = (heeftVerkoop() && pdVerkoop && pdVerkoop.aan) ? '' : 'none';
    const wrap = $('#verkoopWrap'); if (!wrap) return;
    if (!heeftVerkoop()){ wrap.innerHTML = ''; return; }
    if (!pdVerkoop){ wrap.innerHTML = '<div class="card">…</div>'; laadVerkoop(); return; }
    const lijst = pdVerkoop.pda || [];
