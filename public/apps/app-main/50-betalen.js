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
    if (!ov){ ov = document.createElement('div'); ov.id = 'dp-ov';
      ov.style.cssText = 'position:fixed;inset:0;z-index:130;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;';
      document.body.appendChild(ov);
      ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    }
    ov.innerHTML = '<div style="width:100%;max-width:460px;background:var(--bg);border-radius:20px 20px 0 0;border:1px solid var(--line);padding:1.1rem 1.2rem 1.4rem;">' +
      '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.2rem;"><b style="font-size:1rem;">' + FID_MINI + T('dp.title','Betaal direct') + '</b>' +
        '<button id="dpX" style="margin-left:auto;background:none;border:none;color:var(--muted);font-size:1.1rem;cursor:pointer;">✕</button></div>' +
      '<div style="font-size:0.8rem;color:var(--soft);margin-bottom:0.8rem;">' + T('dp.naar','Aan') + ' <b style="color:var(--txt);">' + escT(name) + '</b>. ' + T('dp.direct','Het bedrag gaat rechtstreeks naar de partner.') + '</div>' +
      (opts.omschrijving ? '<div style="font-size:0.82rem;margin-bottom:0.6rem;">' + escT(opts.omschrijving) + '</div>' : '') +
      '<label style="font-size:0.72rem;color:var(--soft);">' + T('dp.bedrag','Bedrag (€)') + '</label>' +
      '<input id="dpBedrag" type="number" inputmode="decimal" min="0.50" step="0.50" ' + (opts.bedrag ? 'value="' + opts.bedrag + '"' : '') + ' style="width:100%;font-size:1.3rem;padding:0.6rem 0.8rem;margin:0.25rem 0 0.7rem;background:var(--card);border:1px solid var(--line);border-radius:12px;color:var(--txt);">' +
      '<input id="dpNote" placeholder="' + T('dp.note','Waarvoor? (optioneel)') + '" ' + (opts.omschrijving ? 'value="' + escT(opts.omschrijving) + '"' : '') + ' style="width:100%;padding:0.55rem 0.8rem;margin-bottom:0.9rem;background:var(--card);border:1px solid var(--line);border-radius:12px;color:var(--txt);">' +
      '<button id="dpPay" class="mo-pay" style="width:100%;justify-content:center;padding:0.8rem;">' + FID_MINI + T('app.paywithfid','Betaal met Face ID') + '</button>' +
      (muntOpties && muntOpties.aan ? '<button id="dpMunt" style="width:100%;margin-top:0.5rem;background:none;border:1px solid var(--line);color:var(--muted);border-radius:999px;padding:0.7rem;font-family:inherit;font-size:0.8rem;cursor:pointer;">◈ ' + T('fin.paycoins','Met munten') + '</button>' : '') +
      '</div>';
    ov.querySelector('#dpX').addEventListener('click', () => ov.remove());
    const dpLees = () => {
      const bedrag = Math.round(Number(ov.querySelector('#dpBedrag').value) * 100) / 100;
      if (!(bedrag >= 0.5)) { toast(T('dp.min','Kies een bedrag van minstens € 0,50.')); return null; }
      return { bedrag, note: (ov.querySelector('#dpNote').value || '').trim() };
    };
    ov.querySelector('#dpPay').addEventListener('click', () => {
      const v = dpLees(); if (!v) return;
      ov.remove();
      payWithFaceId(eur(v.bedrag), async () => {
        const d = await API.call('/betaal/direct', { supplierCode: code, bedrag: v.bedrag, omschrijving: v.note, bron: opts.bron || 'app', idem });
        return d.betaling;
      }, { message: b => T('dp.betaald','Betaald aan') + ' ' + name + ': ' + eur((b.bedrag||0)/100), after: () => { if (opts.after) opts.after(); } });
    });
    const dm = ov.querySelector('#dpMunt');
    if (dm) dm.addEventListener('click', () => {
      const v = dpLees(); if (!v) return;
      ov.remove();
      openMuntSheet({
        euro: v.bedrag, titel: name,
        maak: async (munt) => (await API.call('/munt/direct', { supplierCode: code, bedrag: v.bedrag, omschrijving: v.note, munt })).verzoek,
        klaar: async () => { const mine = (await API.call('/betaal/mijn')).betalingen || []; return mine.some(p => p.betaalwijze === 'munt' && p.supplierCode === code && Math.round(p.bedrag) === Math.round(v.bedrag * 100)); }
      });
    });
  }
  // Een betaalverzoek van een partner met Face ID afrekenen.
  function betaalVerzoekPay(v){
    payWithFaceId(eur((v.bedrag||0)/100), async () => {
      const d = await API.call('/betaal/verzoek/pay', { ref: v.ref, idem: 'bv-' + v.ref });
      return d.betaling;
    }, { message: () => T('dp.verzoekbetaald','Betaalverzoek voldaan:') + ' ' + eur((v.bedrag||0)/100), after: () => { laadBetaalVerzoeken(); renderHome(); } });
  }
  // open betaalverzoeken ophalen (aan dit lid gericht)
  let betaalVerzoeken = [];
  async function laadBetaalVerzoeken(){
    if (!user || user.tier === 'guest') { betaalVerzoeken = []; return; }
    try { betaalVerzoeken = (await API.call('/betaal/verzoeken', {})).verzoeken || []; } catch(e){ betaalVerzoeken = []; }
  }

  function renderPay(){
    const open = invoices.filter(i => i.status === 'open');
    const openSum = open.reduce((s,i) => s + i.netto + i.bijdrage, 0);
    // Munt-opties eenmalig laden; zodra bekend, deze weergave opnieuw tekenen
    // (dan verschijnen de munt-knoppen). Verandert niets als acceptatie uit staat.
    if (muntOpties === null && API.live) { laadMuntOpties().then(() => renderPay()); }
    const muntAan = !!(muntOpties && muntOpties.aan && user && user.tier !== 'guest');
    // Business Pass: de volledige, boekhoudklare specificatie onder elke factuur
    // (incl. afboekcode en btw). RTG en Lifestyle houden de rustige weergave.
    const eurC = n => '€ ' + Number(n).toLocaleString(lang() === 'en' ? 'en-US' : 'nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const specRow = (l, v, strong) => '<div style="display:flex;justify-content:space-between;gap:1rem;"><span>' + l + '</span><span style="text-align:right;flex-shrink:0;' + (strong ? 'color:var(--txt);font-weight:600;' : '') + '">' + v + '</span></div>';
    const bizSpec = inv => {
      if (user.tier !== 'business') return '';
      const total = inv.netto + inv.bijdrage;
      return '<div style="margin:0 0 0.9rem;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.8rem 1rem;font-size:0.7rem;color:var(--muted);line-height:1.8;">' +
        '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);margin-bottom:0.3rem;">' + T('inv.spec','Factuurspecificatie') + '</div>' +
        specRow(T('inv.number','Factuurnummer'), inv.id) +
        specRow(T('inv.holder','Op naam van'), user.codename + ' · Business Pass') +
        (inv.netto > 0 ? specRow(T('inv.net','Nettoprijs (inkoop)'), eurC(inv.netto)) : '') +
        specRow(T('inv.contrib','Ledenbijdrage'), eurC(inv.bijdrage)) +
        specRow(T('inv.foundation','waarvan naar de RTFoundation (30%)'), eurC(Math.round(inv.bijdrage / 1.21 * 0.3 * 100) / 100)) +
        specRow(T('inv.vat','Btw 21% (in de bijdrage begrepen)'), eurC(inv.btw || 0)) +
        (inv.netto > 0 ? specRow(T('inv.toms','Reisdeel: btw-margeregeling reisdiensten'), eurC(0)) : '') +
        specRow(T('inv.total','Totaal'), eurC(total), true) +
        specRow(T('inv.ledger','Afboekcode (grootboek)'), '<b style="color:var(--txt);">' + (inv.afboekcode || '4510') + '</b> · ' + (inv.afboeklabel || '')) +
        '<div style="margin-top:0.5rem;border-top:1px solid var(--line);padding-top:0.5rem;font-size:0.64rem;">RTG (Rahul Travel Group) · KvK 82273510 · btw NL002291440B89 · ' + RTG_IBAN + '</div>' +
      '</div>';
    };
    // Financiën in één oogopslag: openstaand, dit jaar betaald, en de eigen
    // bijdrage aan de RTFoundation. Voor elke pas, rustig en zonder uitleg.
    const isContrib = d => /lidmaatschap|jaarbijdrage|maandbijdrage/i.test(d || '');
    const paidInv = invoices.filter(i => i.status === 'paid');
    const betaaldSom = paidInv.reduce((s,i) => s + i.netto + i.bijdrage, 0);
    const rtfBij = paidInv.filter(i => isContrib(i.desc)).reduce((s,i) => s + Math.round(i.bijdrage / 1.21 * 0.3 * 100) / 100, 0);
    const rtfKomt = open.filter(i => isContrib(i.desc)).reduce((s,i) => s + Math.round(i.bijdrage / 1.21 * 0.3 * 100) / 100, 0);
    const btwSom = paidInv.reduce((s,i) => s + (i.btw || 0), 0);
    const tegel = (l, v, klas) => '<div style="flex:1;min-width:6.5rem;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;">' +
      '<div style="font-size:0.56rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">' + l + '</div>' +
      '<div style="font-family:\'Bodoni Moda\',serif;font-size:1.15rem;margin-top:0.15rem;' + (klas === 'g' ? 'color:var(--gold);' : '') + '">' + v + '</div></div>';
    const finKaart = '<div style="margin-bottom:0.9rem;">' +
      '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);margin:0 0 0.5rem;">' + T('fin.title','Uw financiën') + '</div>' +
      '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
        tegel(T('fin.open','Openstaand'), eur(openSum)) +
        tegel(T('fin.paid','Betaald'), eur(betaaldSom)) +
        tegel(T('fin.rtf','Naar de RTFoundation'), eur(rtfBij), 'g') +
        (user.tier === 'business' ? tegel(T('fin.vat','Btw betaald'), eur(btwSom)) : '') +
      '</div>' +
      (rtfKomt > 0 ? '<div style="margin-top:0.5rem;font-size:0.72rem;color:var(--muted);">' + T('fin.rtfnext','Van uw openstaande bijdrage gaat') + ' <b style="color:var(--gold);">' + eur(rtfKomt) + '</b> ' + T('fin.rtfnext2','naar de RTFoundation.') + '</div>' : '') +
      (API.live ? '<button id="dlOverzicht" style="margin-top:0.6rem;background:none;border:1px solid var(--line);color:var(--muted);border-radius:999px;padding:0.35rem 0.85rem;font-size:0.68rem;font-family:inherit;cursor:pointer;">⤓ ' + T('fin.dloverzicht','Download factuuroverzicht (PDF)') + '</button>' : '') +
    '</div>';
    // Filterbalk: op jaar en op soort. Handig zodra er meer facturen zijn.
    const jaarVan = i => (String(i.date || '').match(/\d{4}/) || [''])[0];
    const jaren = [...new Set(invoices.map(jaarVan).filter(Boolean))].sort().reverse();
    const zichtbaar = invoices.filter(i =>
      (payFilterJaar === 'alle' || jaarVan(i) === payFilterJaar) &&
      (payFilterType === 'alle' || (payFilterType === 'abo' ? isContrib(i.desc) : !isContrib(i.desc))));
    const chip = (actief, val, groep, label) => '<button class="js-payfilter" data-groep="' + groep + '" data-val="' + val + '" style="border:1px solid ' + (actief ? 'var(--gold)' : 'var(--line)') + ';color:' + (actief ? 'var(--gold)' : 'var(--soft)') + ';background:none;border-radius:999px;padding:0.25rem 0.7rem;font-size:0.66rem;font-family:inherit;cursor:pointer;">' + label + '</button>';
    const filterBar = (jaren.length > 1 || invoices.length > 3)
      ? '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.7rem;align-items:center;">' +
          chip(payFilterType === 'alle', 'alle', 'type', T('fin.f.alle','Alles')) +
          chip(payFilterType === 'abo', 'abo', 'type', T('fin.f.abo','Abonnement')) +
          chip(payFilterType === 'overig', 'overig', 'type', T('fin.f.overig','Overig')) +
          (jaren.length > 1 ? '<span style="width:1px;height:1rem;background:var(--line);margin:0 0.2rem;"></span>' + chip(payFilterJaar === 'alle', 'alle', 'jaar', T('fin.f.jaren','Alle jaren')) + jaren.map(j => chip(payFilterJaar === j, j, 'jaar', j)).join('') : '') +
        '</div>'
      : '';
    $('#payList').innerHTML = finKaart + filterBar + (zichtbaar.length ? '' : '<div style="color:var(--soft);font-size:0.8rem;padding:0.5rem 0;">' + T('fin.f.leeg','Geen facturen in deze selectie.') + '</div>') + zichtbaar.map(inv => {
      const total = inv.netto + inv.bijdrage;
      return '<div class="rowitem">' +
        '<div class="t"><b>' + inv.desc + '</b><span>' + inv.id + ' · ' + inv.date + '</span></div>' +
        '<div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:0.45rem;">' +
          '<span class="amount">' + eur(total) + '</span>' +
          (inv.status === 'open'
            ? '<button class="btn-pay js-pay" data-inv="' + inv.id + '" data-amt="' + total + '">' + FID + T('app.pay','Betaal') + '</button>' +
              (muntAan ? '<button class="js-munt" data-inv="' + inv.id + '" data-amt="' + total + '" style="background:none;border:1px solid var(--line);color:var(--muted);border-radius:999px;padding:0.3rem 0.75rem;font-size:0.66rem;font-family:inherit;cursor:pointer;">◈ ' + T('fin.paycoins','Met munten') + '</button>' : '')
            : '<span class="pill paid">'+T('app.paid','Betaald')+'</span>') +
          (API.live ? '<button class="js-dlinv" data-inv="' + inv.id + '" style="background:none;border:none;color:var(--soft);font-size:0.66rem;font-family:inherit;cursor:pointer;padding:0.15rem 0;">⤓ ' + T('fin.download','Download factuur') + '</button>' : '') +
        '</div>' +
      '</div>' + bizSpec(inv);
    }).join('');
    document.querySelectorAll('.js-munt').forEach(b =>
      b.addEventListener('click', () => openMuntSheet({
        euro: Number(b.dataset.amt), titel: T('munt.title','Betaal met munten'),
        maak: async (munt) => (await API.call('/munt/verzoek', { invoiceId: b.dataset.inv, munt })).verzoek,
        klaar: async () => { applyState((await API.call('/state')).state); const inv = (invoices || []).find(i => i.id === b.dataset.inv); return !!(inv && inv.status === 'paid'); }
      })));
    document.querySelectorAll('.js-dlinv').forEach(b =>
      b.addEventListener('click', () => downloadPdf('/factuur', { invoiceId: b.dataset.inv }, 'RTG-factuur-' + b.dataset.inv + '.pdf')));
    document.querySelectorAll('.js-payfilter').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.groep === 'type') payFilterType = b.dataset.val; else payFilterJaar = b.dataset.val;
      renderPay();
    }));
    const dlo = $('#dlOverzicht');
    if (dlo) dlo.addEventListener('click', () => downloadPdf('/facturen/overzicht', payFilterJaar !== 'alle' ? { jaar: payFilterJaar } : {}, 'RTG-factuuroverzicht' + (payFilterJaar !== 'alle' ? '-' + payFilterJaar : '') + '.pdf'));
    $('#payAllWrap').innerHTML = (open.length
      ? '<button class="btn-pay payall" id="payAll">' + FID + T('app.payall','Betaal alles') + ', ' + eur(openSum) + '</button>'
      : '') +
      (open.length ? '<div style="margin-top:1rem;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:0.9rem 1.1rem;font-size:0.74rem;color:var(--muted);line-height:1.6;">' +
        '<b style="color:var(--txt);font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;">'+T('app.bank.h','Liever overboeken?')+'</b><br>' +
        T('app.bank.to','Maak het bedrag over naar')+' <b style="color:var(--txt);" id="rtgIban">' + RTG_IBAN + '</b> ' +
        T('app.bank.name','t.n.v. RTG, o.v.v. uw codenaam')+' (<b style="color:var(--gold);">' + user.codename + '</b>) ' +
        T('app.bank.ref','en het factuurnummer. Na ontvangst zetten wij de factuur op betaald.') +
        ' <button id="ibanCopy" style="background:none;border:1px solid var(--line);border-radius:999px;padding:0.25rem 0.7rem;font-size:0.66rem;color:var(--muted);margin-left:0.2rem;">'+T('app.bank.copy','Kopieer IBAN')+'</button></div>' : '');
    document.querySelectorAll('.js-pay').forEach(b =>
      b.addEventListener('click', () => payWithFaceId(eur(Number(b.dataset.amt)), () => executePay(b.dataset.inv))));
    const pa = $('#payAll');
    if (pa) pa.addEventListener('click', () => payWithFaceId(eur(openSum), () => executePay('all')));
    const ic = $('#ibanCopy');
    if (ic) ic.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(RTG_IBAN); toast(T('app.bank.copied','IBAN gekopieerd.')); }
      catch(e){ toast(RTG_IBAN); }
    });
    renderGiftcards();
    renderBoekhouder();
    renderPunten();
  }

  /* RTG-punten + open betaalverzoeken (gesplitste rekeningen) + meldingsvoorkeuren */
  async function renderPunten(){
    if (!API.live || user.tier === 'guest') return;
    let wrap = $('#puntenWrap');
    if (!wrap){
      wrap = document.createElement('div');
      wrap.id = 'puntenWrap';
      $('#payAllWrap').insertAdjacentElement('afterend', wrap);
    }
    let p = null, splitsen = [], vk = null;
    try {
      [p, splitsen, vk] = await Promise.all([
        API.call('/punten').catch(() => null),
        API.call('/splitsen/mijn').then(d => d.splitsen || []).catch(() => []),
        API.call('/meldingen/voorkeur').then(d => d.voorkeur).catch(() => null)
      ]);
    } catch(e){ return; }
    const kaart = inhoud => '<div style="margin-top:1rem;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:0.9rem 1.1rem;">' + inhoud + '</div>';
    let html = '';
    // punten: saldo, tegoed en verzilveren
    if (p) html += kaart(
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.8rem;">' +
        '<div><b style="font-size:0.86rem;">✦ ' + T('erv.punten','RTG-punten') + '</b>' +
        '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.2rem;">' + p.saldo + ' ' + T('erv.puntensaldo','punten') + (p.tegoed ? ' · € ' + p.tegoed + ' ' + T('erv.tegoed','tegoed (verrekent automatisch)') : '') + '</div>' +
        '<div style="font-size:0.64rem;color:var(--soft);margin-top:0.2rem;">' + T('erv.puntenuitleg','1 punt per € 10; 100 punten = € 10 tegoed. RTG legt bij, de zaak ontvangt alles.') + '</div></div>' +
        (p.saldo >= 100 ? '<button class="vbtn" id="pzGo">' + T('erv.verzilver','Verzilver 100') + '</button>' : '') +
      '</div>');
    // open betaalverzoeken: mijn deel van gesplitste rekeningen
    const mijnKey = user.id != null ? 'user-' + user.id : user.tier;
    const echteOpen = splitsen.filter(s => s.delen.some(d2 => !d2.paid)).slice(0, 6);
    if (echteOpen.length) html += kaart(
      '<b style="font-size:0.86rem;">🤝 ' + T('erv.verzoeken','Gesplitste rekeningen') + '</b>' +
      echteOpen.map(s => {
        const mijnDeel = s.delen.find(d2 => d2.key === mijnKey && !d2.paid);
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.6rem;margin-top:0.55rem;font-size:0.78rem;">' +
          '<span>' + s.supplierName + ' · ' + eur(s.totaal) + ' · ' + s.delen.filter(d2 => d2.paid).length + '/' + s.delen.length + ' ' + T('erv.betaald','betaald') + '</span>' +
          (mijnDeel
            ? '<button class="vbtn js-splpay" data-id="' + s.id + '" data-amt="' + mijnDeel.bedrag + '">' + T('erv.betaaldeel','Betaal mijn deel') + '</button>'
            : '<span style="color:var(--soft);font-size:0.68rem;">' + T('erv.wachtop','wacht op vrienden') + '</span>') +
        '</div>';
      }).join(''));
    // meldingsvoorkeuren: per soort aan of uit
    if (vk) html += kaart(
      '<b style="font-size:0.86rem;">🔔 ' + T('erv.meldingen','Meldingen') + '</b>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.5rem 1rem;margin-top:0.55rem;">' +
      [['orders', T('erv.m.orders','Bestellingen')], ['events', T('erv.m.events','Events')], ['salon', 'De Salon'], ['live', T('erv.m.live','Onderweg')], ['wachtlijst', T('erv.wachtlijst','Wachtlijst')]].map(([k, l]) =>
        '<label style="display:inline-flex;align-items:center;gap:0.35rem;font-size:0.76rem;"><input type="checkbox" class="js-vk" data-scope="' + k + '"' + (vk[k] !== false ? ' checked' : '') + '> ' + l + '</label>'
      ).join('') + '</div>');
    wrap.innerHTML = html;
    const pz = $('#pzGo');
    if (pz) pz.addEventListener('click', async () => {
      try { const d = await API.call('/punten/verzilver', { punten: 100 }); toast('✦ ' + T('erv.verzilverd','Verzilverd:') + ' € ' + d.tegoed + ' ' + T('erv.tegoedkort','tegoed.')); renderPunten(); }
      catch(e){ toast(e.message); }
    });
    wrap.querySelectorAll('.js-splpay').forEach(b => b.addEventListener('click', () =>
      payWithFaceId(eur(Number(b.dataset.amt)), async () => { await API.call('/splits/betaal', { id: b.dataset.id }); return null; },
        { message: () => T('erv.deelbetaald','Uw deel is betaald.'), after: () => renderPunten() })));
    wrap.querySelectorAll('.js-vk').forEach(c => c.addEventListener('change', async () => {
      try { await API.call('/meldingen/voorkeur', { zet: { [c.dataset.scope]: c.checked } }); }
      catch(e){ toast(e.message); }
    }));
  }

  // cadeaukaarten: kopen met Face ID, cadeau doen, inwisselen bij de zaak op code
  async function renderGiftcards(){
    const wrap = $('#gcWrap');
    if (!wrap) return;
    let kaarten = [];
    try { kaarten = (await API.call('/giftcards/mine')).kaarten || []; } catch(e){}
    if (!suppliers.length){
      try { suppliers = (await API.call('/suppliers')).suppliers || []; } catch(e){}
    }
    const opties = suppliers.map(s => '<option value="' + s.code + '">' + s.name + '</option>').join('');
    wrap.innerHTML = '<div style="margin-top:1.6rem;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1rem 1.1rem;">' +
      '<div style="font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold);">🎁 ' + T('gc.h','Cadeaukaarten') + '</div>' +
      '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.3rem;line-height:1.5;">' + T('gc.s','Koop een cadeaukaart van een partner en geef de code cadeau. Inwisselen gaat bij de zaak.') + '</div>' +
      (kaarten.length ? kaarten.map(k =>
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.7rem;padding:0.55rem 0;border-bottom:1px solid var(--line);font-size:0.8rem;">' +
        '<span>' + k.supplierName + '<span style="display:block;font-size:0.66rem;color:var(--gold);letter-spacing:0.06em;">' + k.code + '</span></span>' +
        '<b>' + eur(k.saldo) + '</b></div>').join('') : '') +
      '<div style="display:flex;gap:0.5rem;margin-top:0.7rem;flex-wrap:wrap;">' +
      '<select id="gcSup" style="flex:2;min-width:120px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.6rem;color:var(--txt);font-family:inherit;">' + opties + '</select>' +
      '<input id="gcAmt" type="number" placeholder="€ 50" style="flex:1;min-width:70px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.6rem;color:var(--txt);font-family:inherit;">' +
      '<button id="gcBuy" style="background:var(--knop);color:var(--knop-txt);border:none;border-radius:999px;padding:0.6rem 1rem;font-size:0.74rem;font-weight:600;font-family:inherit;">' + T('gc.koop','Koop') + '</button></div></div>';
    const kb = $('#gcBuy');
    if (kb) kb.addEventListener('click', () => {
      const bedrag = Math.round(Number($('#gcAmt').value));
      if (!(bedrag >= 10)) { toast(T('gc.min','Kies een bedrag vanaf € 10.')); return; }
      payWithFaceId(eur(bedrag), async () => {
        const d = await API.call('/giftcard/buy', { supplierCode: $('#gcSup').value, bedrag });
        return d.kaart;
      }, { message: k => T('gc.klaar','Cadeaukaart gekocht. Code:') + ' ' + k.code, after: () => renderGiftcards() });
    });
  }

  // Business Pass: de AI-boekhouder die per land weet wat terug te vorderen is
  function renderBoekhouder(){
    const wrap = $('#bhWrap');
    if (!wrap) return;
    if (user.tier !== 'business'){ wrap.innerHTML = ''; return; }
    let land = 'NL';
    try { land = localStorage.getItem('rtg_boekland') || 'NL'; } catch(e){}
    const landen = [['NL','Nederland'],['BE','Belgie'],['DE','Duitsland'],['FR','Frankrijk'],['ES','Spanje'],['JP','Japan']];
    wrap.innerHTML = '<div style="margin-top:1rem;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1rem 1.1rem;">' +
      '<div style="font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold);">📚 ' + T('bh2.h','AI-boekhouder · Business Pass') + '</div>' +
      '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.3rem;line-height:1.5;">' + T('bh2.s','Kent per land de aftrekregels voor uw zakelijke reiskosten. Uw facturen staan al boekhoudklaar, met afboekcode en btw-specificatie.') + '</div>' +
      '<div style="display:flex;gap:0.5rem;margin-top:0.7rem;">' +
      '<select id="bhLand" style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.55rem;color:var(--txt);font-family:inherit;">' +
      landen.map(l => '<option value="' + l[0] + '"' + (l[0] === land ? ' selected' : '') + '>' + l[1] + '</option>').join('') + '</select>' +
      '<input id="bhQ" placeholder="' + T('bh2.ph','Bijv. kan ik dit diner terugvorderen?') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.8rem;">' +
      '<button id="bhGo" style="background:var(--knop);color:var(--knop-txt);border:none;border-radius:999px;padding:0.55rem 0.95rem;font-size:0.74rem;font-weight:600;font-family:inherit;">' + T('bh2.vraag','Vraag') + '</button></div>' +
      '<div id="bhA" style="display:none;margin-top:0.7rem;border:1px solid var(--gold);border-radius:12px;padding:0.7rem 0.9rem;font-size:0.78rem;line-height:1.6;color:var(--muted);"></div>' +
      // zzp-belastingtool: jaarwinst in, indicatie van aftrek, belasting en netto uit
      '<div style="margin-top:0.9rem;border-top:1px solid var(--line);padding-top:0.9rem;">' +
      '<div style="font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold);">🧮 ' + T('zzp.h','Zzp-belastingtool') + '</div>' +
      '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.3rem;line-height:1.5;">' + T('zzp.s','Voor zelfstandigen: vul uw verwachte jaarwinst in voor een indicatie van uw belasting, nettowinst en wat u maandelijks opzij zet. Het land volgt de keuze hierboven.') + '</div>' +
      '<div style="display:flex;gap:0.5rem;margin-top:0.6rem;">' +
      '<input id="zzpWinst" type="number" placeholder="' + T('zzp.winstph','Jaarwinst, bijv. 60000') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.8rem;">' +
      '<button id="zzpGo" style="background:var(--knop);color:var(--knop-txt);border:none;border-radius:999px;padding:0.55rem 0.95rem;font-size:0.74rem;font-weight:600;font-family:inherit;">' + T('zzp.reken','Reken') + '</button></div>' +
      '<div style="display:flex;gap:1rem;margin-top:0.5rem;font-size:0.72rem;color:var(--muted);flex-wrap:wrap;">' +
      '<label style="display:flex;align-items:center;gap:0.35rem;"><input type="checkbox" id="zzpUren" checked> ' + T('zzp.uren','Urencriterium (1.225 uur)') + '</label>' +
      '<label style="display:flex;align-items:center;gap:0.35rem;"><input type="checkbox" id="zzpStart"> ' + T('zzp.start','Startersaftrek') + '</label></div>' +
      '<div id="zzpRes" style="display:none;margin-top:0.7rem;border:1px solid var(--line);border-radius:12px;padding:0.8rem 0.95rem;font-size:0.76rem;line-height:1.7;color:var(--muted);"></div></div></div>';
    const go = $('#bhGo');
    if (go) go.addEventListener('click', async () => {
      const q = $('#bhQ').value.trim();
      if (!q) return;
      try { localStorage.setItem('rtg_boekland', $('#bhLand').value); } catch(e){}
      const box = $('#bhA');
      box.style.display = 'block';
      box.textContent = '…';
      try { box.textContent = (await API.call('/member/accountant', { question: q, land: $('#bhLand').value })).answer; }
      catch(e){ box.textContent = e.message; }
    });
    const qi = $('#bhQ');
    if (qi) qi.addEventListener('keydown', e => { if (e.key === 'Enter' && go) go.click(); });
    const zg = $('#zzpGo');
    if (zg) zg.addEventListener('click', async () => {
      const winst = Math.round(Number($('#zzpWinst').value));
      const box = $('#zzpRes');
      if (!(winst > 0)) { toast(T('zzp.leeg','Vul eerst uw verwachte jaarwinst in.')); return; }
      try { localStorage.setItem('rtg_boekland', $('#bhLand').value); } catch(e){}
      box.style.display = 'block';
      box.textContent = '…';
      try {
        const d = await API.call('/member/zzp', { winst, land: $('#bhLand').value, urencriterium: $('#zzpUren').checked, starter: $('#zzpStart').checked });
        const rij = (l, v, sterk) => '<div style="display:flex;justify-content:space-between;gap:0.8rem;"><span>' + l + '</span><span style="flex-shrink:0;' + (sterk ? 'color:var(--txt);font-weight:600;' : '') + '">' + v + '</span></div>';
        box.innerHTML =
          '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);margin-bottom:0.35rem;">' + d.regime + ' · ' + d.landNaam + '</div>' +
          rij(T('zzp.winst','Jaarwinst'), eur(d.winst)) +
          d.posten.map(p2 => rij(p2.label, (p2.bedrag < 0 ? '- ' : '') + eur(Math.abs(p2.bedrag)))).join('') +
          rij(T('zzp.belastbaar','Belastbaar (na aftrek)'), eur(d.belastbaar)) +
          rij(T('zzp.teBetalen','Te betalen (indicatie)'), eur(d.belasting), true) +
          rij(T('zzp.netto','Netto over'), eur(d.netto), true) +
          '<div style="margin-top:0.55rem;padding-top:0.55rem;border-top:1px solid var(--line);color:var(--gold);">💡 ' + T('zzp.reserveer','Zet ~') + d.reserveerPct + '% ' + T('zzp.opzij','opzij: ongeveer') + ' ' + eur(d.perMaand) + ' ' + T('zzp.pm','per maand') + '.</div>' +
          '<div style="margin-top:0.5rem;">' + d.regels.map(r => '• ' + r).join('<br>') + '</div>' +
          '<div style="margin-top:0.5rem;font-size:0.64rem;color:var(--soft);">' + T('zzp.disc','Indicatie op jaarbasis; dit is voorlichting, geen bindend fiscaal advies.') + '</div>';
      } catch(e){ box.textContent = e.message; }
    });
  }

