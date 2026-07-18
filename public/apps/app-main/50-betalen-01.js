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
    ov.innerHTML = '<div style="width:100%;max-width:460px;background:var(--bg);border-radius:20px 20px 0 0;border:1px solid var(--line);padding:1.1rem 1.2rem 1.4rem;">' +
      '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;"><b style="font-size:1rem;">◈ ' + escT(cfg.titel || T('munt.title','Betaal met munten')) + '</b>' +
        '<button id="muntX" style="margin-left:auto;background:none;border:none;color:var(--muted);font-size:1.1rem;cursor:pointer;">✕</button></div>' +
      '<div style="font-size:0.78rem;color:var(--soft);margin-bottom:0.8rem;">' + T('munt.bedrag','Te betalen') + ': <b style="color:var(--txt);">' + eur(cfg.euro) + '</b>. ' + T('munt.omzet','RTG zet uw munten meteen om naar euro.') + '</div>' +
      '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.2rem;">' +
        munten.map(m => '<button class="js-muntpick" data-munt="' + m.munt + '" style="flex:1;min-width:5rem;background:var(--card);border:1px solid var(--line);color:var(--txt);border-radius:12px;padding:0.6rem;font-family:inherit;cursor:pointer;"><b style="text-transform:uppercase;">' + m.munt + '</b><br><span style="font-size:0.62rem;color:var(--soft);">' + (naam[m.munt] || m.munt) + '</span></button>').join('') +
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
    catch(e){ if (det) det.innerHTML = '<div style="font-size:0.8rem;color:var(--burgundy);padding:0.6rem 0;">' + (e.message || T('munt.fout','Kon geen adres maken.')) + '</div>'; return; }
    if (!det || !vz) return;
    const dot = '<span style="width:8px;height:8px;border-radius:50%;background:var(--gold);display:inline-block;flex-shrink:0;"></span>';
    det.innerHTML =
      '<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:0.9rem 1rem;margin-top:0.6rem;">' +
        '<div style="font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">' + T('munt.stuur','Stuur exact') + '</div>' +
        '<div style="font-family:\'Bodoni Moda\',serif;font-size:1.5rem;color:var(--gold);margin:0.15rem 0 0.1rem;">' + vz.bedragMunt + ' <span style="text-transform:uppercase;font-size:1rem;">' + munt + '</span></div>' +
        '<div style="font-size:0.66rem;color:var(--muted);">≈ ' + eur((vz.euroCenten || 0) / 100) + ' · ' + T('munt.koers','koers vastgezet') + '</div>' +
        '<div style="font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);margin-top:0.7rem;">' + T('munt.adres','Naar dit adres') + '</div>' +
        '<div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.2rem;">' +
          '<code style="flex:1;font-size:0.66rem;word-break:break-all;color:var(--txt);background:rgba(0,0,0,0.15);border-radius:8px;padding:0.4rem 0.5rem;">' + escT(vz.adres) + '</code>' +
          '<button id="muntCopy" style="flex-shrink:0;background:none;border:1px solid var(--line);border-radius:999px;padding:0.3rem 0.6rem;font-size:0.62rem;color:var(--muted);cursor:pointer;">' + T('munt.kopieer','Kopieer') + '</button>' +
        '</div>' +
        '<div style="margin-top:0.7rem;font-size:0.72rem;color:var(--soft);display:flex;align-items:center;gap:0.4rem;">' + dot + T('munt.wacht','Wachten op bevestiging van het netwerk…') + '</div>' +
      '</div>';
    const cp = document.getElementById('muntCopy');
    if (cp) cp.addEventListener('click', async () => { try { await navigator.clipboard.writeText(vz.adres); toast(T('munt.gekopieerd','Adres gekopieerd.')); } catch(e){ toast(vz.adres); } });
    // Poll: de aanbieder-webhook bevestigt de ontvangst. In demo blijft dit staan
    // tot een echte ontvangst binnenkomt.
    if (typeof cfg.klaar !== 'function') return;
    muntStop();
    let n = 0;
    muntPoll = setInterval(async () => {
      n++;
      try {
        if (await cfg.klaar()){
          muntStop();
          const o = document.getElementById('munt-ov'); if (o) o.remove();
          toast('◈ ' + T('munt.ontvangen','Betaald met munten. Dank u.'));
          renderPay(); renderHome();
        }
      } catch(e){}
      if (n > 150) muntStop(); // na ~10 minuten stoppen met pollen
    }, 4000);
  }

  /* ---------- rechtstreeks betalen aan een partner (Face ID) ----------
     Overal in de app: één bedrag, Face ID, geld gaat direct naar de partner.
     Bereikbaar vanuit de Salon en vanuit de AI/concierge. */
  function betaalPartner(code, name, opts){
    opts = opts || {};
    const idem = 'dp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    let ov = document.getElementById('dp-ov');
