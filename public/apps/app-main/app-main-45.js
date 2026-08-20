/* pushmeldingen aanzetten en de sleutel omzetten */
    const raw=atob(b); const arr=new Uint8Array(raw.length); for(let i=0;i<raw.length;i++)arr[i]=raw.charCodeAt(i); return arr;
  }
  async function ensurePush(interactief){
    try{
      if (!('serviceWorker' in navigator) || !('PushManager' in window)){ if(interactief) toast('Push wordt op dit toestel niet ondersteund.'); return; }
      const keyRes = await fetch('/api/push/key').then(r=>r.json()).catch(()=>({}));
      if (!keyRes.key){ if(interactief) toast('Meldingen zijn nu niet beschikbaar.'); return; }
      if (interactief || Notification.permission==='default'){
        const perm = await Notification.requestPermission();
        if (perm !== 'granted'){ if(interactief) toast('Zet meldingen aan in je instellingen om ze te ontvangen.'); return; }
      } else if (Notification.permission !== 'granted'){ return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: urlB64ToUint8(keyRes.key) });
      await API.call('/push/subscribe', { subscription: sub });
      if (interactief) toast('Top! Gezinsmeldingen komen nu ook op je telefoon binnen.');
    }catch(e){ if(interactief) toast('Meldingen aanzetten lukte niet.'); }
  }

  /* ---------- reizen ---------- */

  function renderTrip(){
    $('#tripSub').textContent = trip.dest + ' · ' + trip.dates + ' · ' + T('app.in','over') + ' ' + trip.days + ' ' + T('app.days','dagen');
    $('#tripList').innerHTML = trip.items.map(it =>
      '<div class="rowitem">' +
        '<div class="t"><b>' + it.title + '</b><span>' + it.when + ' · ' + it.sub + '</span></div>' +
        '<span class="pill ' + (it.status === 'paid' ? 'paid' : it.status === 'req' ? 'req' : 'open') + '">' + tLbl(it.label) + '</span>' +
      '</div>').join('');
    renderAgenda();
  }

  /* de reisagenda: alles met een datum (tafels, tickets, ritten, events)
     automatisch samengevoegd tot een dagprogramma onder de reis */
  const AGENDA_ICO = {};  // geen emoji-markers meer; alle items dragen het rustige '·'
  async function renderAgenda(){
    if (!API.live) return;
    let wrap = $('#agendaWrap');
    if (!wrap){
      wrap = document.createElement('div');
      wrap.id = 'agendaWrap';
      $('#tripList').insertAdjacentElement('afterend', wrap);
    }
    let dagen = [];
    try { dagen = (await API.call('/agenda/mijn')).dagen || []; } catch(e){ return; }
    if (!dagen.length){ wrap.innerHTML = ''; return; }
    const dagNaam = d => new Date(d + 'T12:00:00').toLocaleDateString(lang() === 'en' ? 'en-GB' : 'nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
    wrap.innerHTML = '<div class="sec-label h-mt120">' + T('erv.agenda','Mijn programma') + '</div>' +
      dagen.map(d =>
        '<div style="font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--gold);margin:0.7rem 0 0.35rem;">' + dagNaam(d.datum) + '</div>' +
        d.items.map(it =>
          '<div class="rowitem"><div class="t"><b>' + (AGENDA_ICO[it.soort] || '·') + ' ' + it.titel + '</b><span>' + (it.tijd || T('erv.heledag','hele dag')) + ' · ' + tStatus(it.status) + '</span></div></div>'
        ).join('')
      ).join('');
  }

  /* ---------- betalen (Face ID) ---------- */

  const FID = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M6 19 V13 a7 7 0 0 1 7-7 h6"/><path d="M45 6 h6 a7 7 0 0 1 7 7 v6"/>' +
    '<path d="M58 45 v6 a7 7 0 0 1-7 7 h-6"/><path d="M19 58 h-6 a7 7 0 0 1-7-7 v-6"/>' +
    '<circle cx="23.5" cy="26.5" r="2.6" fill="currentColor" stroke="none"/><circle cx="40.5" cy="26.5" r="2.6" fill="currentColor" stroke="none"/>' +
    '<path d="M32 26 v8.5 a2.2 2.2 0 0 1-2.2 2.2"/><path d="M23 42.5 a12.5 8.5 0 0 0 18 0"/></svg>';
  const CHECK = '<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="28" stroke="#2E6B4F" stroke-width="3.5"/>' +
    '<path d="M20 33 l8.5 8.5 L45 23" stroke="#2E6B4F" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  async function executePay(target){
    let foundation = 0;
    if (API.live){
      const data = await API.call('/pay', target === 'all' ? {all:true} : {invoiceId: target});
      foundation = data.foundation;
      applyState(data.state);
    } else {
      const targets = target === 'all' ? invoices.filter(i => i.status === 'open') : invoices.filter(i => i.id === target);
      for (const inv of targets){
        inv.status = 'paid'; inv.date = 'Zojuist betaald';
        foundation += Math.round(inv.bijdrage * 0.3);
        for (const t of trip.items) if (t.invoiceId === inv.id){ t.status = 'paid'; t.label = 'Bevestigd'; }
      }
    }
    return foundation;
  }

  let payBusy = false;
  function payWithFaceId(amount, doPay, opts){
    if (payBusy) return;
    opts = opts || {};
    payBusy = true;
    const pw = $('#paywait'), card = pw.querySelector('.paycard');
    $('#payAmt').textContent = amount;
    $('#payIcon').innerHTML = FID.replace(/currentColor/g, '#0C0C0B');
    $('#payLbl').textContent = T('app.payingfid','Betalen met Face ID…');
    card.classList.add('scanning'); card.classList.remove('done');
    pw.classList.add('open');
    setTimeout(async () => {
      try {
        const result = await doPay();
        card.classList.remove('scanning'); card.classList.add('done');
        $('#payIcon').innerHTML = CHECK;
        $('#payLbl').textContent = T('app.confirmed','Bevestigd');
        setTimeout(() => {
          pw.classList.remove('open');
          payBusy = false;
          if (opts.message) toast(opts.message(result));
          else { toast(T('app.paid','Betaald') + '. ' + eur(result) + ' ' + T('app.tofoundation','gaat naar de RTFoundation.')); renderPay(); renderHome(); renderTrip(); }
          if (opts.after) opts.after(result);
        }, 700);
      } catch (e) {
        pw.classList.remove('open');
        payBusy = false;
        toast(e.message || T('app.payfailed','Betaling mislukt.'));
      }
    }, 1100);
  }

  /* ---------- betalen met munten (crypto) ----------
     Kies een munt, ontvang het exacte bedrag en een adres. RTG zet de munten via
     een vergunninghoudende aanbieder meteen om naar euro; wij houden zelf geen
     crypto vast. Zodra het netwerk bevestigt, zetten we de factuur op betaald. */
  let muntPoll = null;
  function muntStop(){ if (muntPoll){ clearInterval(muntPoll); muntPoll = null; } }
  // cfg: { euro, titel, maak: async(munt)=>verzoek, klaar?: async()=>bool }
  function openMuntSheet(cfg){
    muntStop();
    let ov = document.getElementById('munt-ov');
    if (!ov){ ov = document.createElement('div'); ov.id = 'munt-ov';
      ov.style.cssText = 'position:fixed;inset:0;z-index:130;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;';
      document.body.appendChild(ov);
      ov.addEventListener('click', e => { if (e.target === ov){ muntStop(); ov.remove(); } });
    }
    const munten = (muntOpties && muntOpties.munten) || [];
    const naam = { btc:'Bitcoin', eth:'Ethereum', usdc:'USD Coin', usdt:'Tether' };
    ov.innerHTML = '<div style="width:100%;max-width:460px;background:var(--bg);border-radius:0;border:1px solid var(--line);padding:1.1rem 1.2rem 1.4rem;">' +
      '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;"><b style="font-size:1rem;">◈ ' + escT(cfg.titel || T('munt.title','Betaal met munten')) + '</b>' +
        '<button id="muntX" style="margin-left:auto;background:none;border:none;color:var(--muted);font-size:1.1rem;cursor:pointer;">✕</button></div>' +
      '<div style="font-size:0.78rem;color:var(--soft);margin-bottom:0.8rem;">' + T('munt.bedrag','Te betalen') + ': <b style="color:var(--txt);">' + eur(cfg.euro) + '</b>. ' + T('munt.omzet','RTG zet uw munten meteen om naar euro.') + '</div>' +
      '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.2rem;">' +
        munten.map(m => '<button class="js-muntpick" data-munt="' + m.munt + '" style="flex:1;min-width:5rem;background:var(--card);border:1px solid var(--line);color:var(--txt);border-radius:0;padding:0.6rem;font-family:inherit;cursor:pointer;"><b style="text-transform:uppercase;">' + m.munt + '</b><br><span style="font-size:0.62rem;color:var(--soft);">' + (naam[m.munt] || m.munt) + '</span></button>').join('') +
      '</div>' +
      '<div id="muntDetail"></div></div>';
    ov.querySelector('#muntX').addEventListener('click', () => { muntStop(); ov.remove(); });
    ov.querySelectorAll('.js-muntpick').forEach(b => b.addEventListener('click', () => muntVraag(cfg, b.dataset.munt)));
  }

  async function muntVraag(cfg, munt){
    const det = document.getElementById('muntDetail');
    if (det) det.innerHTML = '<div style="font-size:0.8rem;color:var(--soft);padding:0.6rem 0;">' + T('munt.laden','Adres aanmaken…') + '</div>';
    let vz;
    try { vz = await cfg.maak(munt); }
