/* de zakelijke specificatie op een factuur */
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
    /* Nog nooit een factuur gehad is iets anders dan "niets in deze selectie".
       Een nieuw account begint leeg, dus dit is wat een nieuw lid hier leest:
       niet dat het filter niets vond, maar wat er komt te staan en waarom. */
    const leegTekst = invoices.length
      ? T('fin.f.leeg','Geen facturen in deze selectie.')
      : T('fin.f.nognooit','Hier komen uw facturen te staan: wat RTG voor u regelt, wat u bij partners besteedt en uw maandbijdrage. Btw en afboekcode staan er meteen bij, zodat het zo de boekhouding in kan. Van elke bijdrage gaat 30% naar de RTFoundation.');
    $('#payList').innerHTML = finKaart + filterBar + (zichtbaar.length ? '' : '<div style="color:var(--soft);font-size:0.8rem;padding:0.5rem 0;line-height:1.6;">' + leegTekst + '</div>') + zichtbaar.map(inv => {
      const total = inv.netto + inv.bijdrage;
      return '<div class="rowitem">' +
        '<div class="t"><b>' + inv.desc + '</b><span>' + inv.id + ' · ' + inv.date + '</span></div>' +
        '<div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:0.45rem;">' +
          '<span class="amount">' + eur(total) + '</span>' +
          (inv.status === 'open'
            ? '<button class="btn-pay js-pay" data-inv="' + inv.id + '" data-amt="' + total + '">' + FID + T('app.pay','Betaal') + '</button>' +
              (API.live && user.tier !== 'guest' ? '<button class="js-saldo" data-inv="' + inv.id + '" data-amt="' + total + '" style="background:none;border:1px solid var(--line);color:var(--muted);border-radius:999px;padding:0.3rem 0.75rem;font-size:0.66rem;font-family:inherit;cursor:pointer;">◉ ' + T('fin.paysaldo','Uit RTG Pay-saldo') + '</button>' : '') +
              (muntAan ? '<button class="js-munt" data-inv="' + inv.id + '" data-amt="' + total + '" style="background:none;border:1px solid var(--line);color:var(--muted);border-radius:999px;padding:0.3rem 0.75rem;font-size:0.66rem;font-family:inherit;cursor:pointer;">◈ ' + T('fin.paycoins','Met munten') + '</button>' : '')
            : '<span class="pill paid">'+T('app.paid','Betaald')+'</span>') +
          (API.live ? '<button class="js-dlinv" data-inv="' + inv.id + '" style="background:none;border:none;color:var(--soft);font-size:0.66rem;font-family:inherit;cursor:pointer;padding:0.15rem 0;">⤓ ' + T('fin.download','Download factuur') + '</button>' : '') +
        '</div>' +
      '</div>' + bizSpec(inv);
    }).join('');
    /* Uit het eigen RTG Pay-saldo (de derde betaalweg): dezelfde bevestigde
       betaalflow als de kaart, maar de afschrijving komt uit de wallet. */
    document.querySelectorAll('.js-saldo').forEach(b =>
      b.addEventListener('click', () => payWithFaceId(eur(Number(b.dataset.amt)), async () => {
        const r = await API.call('/pay/saldo', { invoiceId: b.dataset.inv });
        applyState((await API.call('/state')).state);
        return r;
      }, {
        message: r => T('fin.saldobetaald','Betaald uit uw RTG Pay-saldo') + (r && r.bijgeladen ? ' (' + eur(r.bijgeladen / 100) + ' ' + T('fin.bijgeladen','automatisch bijgeladen') + ')' : '') + '.',
        after: () => { renderPay(); renderHome(); renderTrip(); }
      })));
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
