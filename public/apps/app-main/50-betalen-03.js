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
