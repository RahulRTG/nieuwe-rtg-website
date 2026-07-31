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
    const idem = RTGIdem('dp');
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
