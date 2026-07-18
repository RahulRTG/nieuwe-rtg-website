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
