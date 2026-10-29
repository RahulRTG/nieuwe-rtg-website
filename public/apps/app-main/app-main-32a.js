/* RTG Shared Assets: een koop is een aanvraag (kern/assets/aanvraag.js). Het lid
   ziet hier wat er met zijn aanvraag gebeurt, betaalt pas na goedkeuring, en
   hoort pas van tickets als de betaling bevestigd is. */
    let aanvragen = [];
    try { aanvragen = (await API.call('/api/asset/aanvragen')).aanvragen || []; } catch(e){}
    const open = aanvragen.filter(x => ['aangevraagd', 'goedgekeurd', 'betaling-loopt'].includes(x.status));
    const STAND = { aangevraagd: T('as.st.aan','wacht op de beoordeling door een mens van RTG; er is niets afgeschreven'),
      goedgekeurd: T('as.st.goed','goedgekeurd; betaal om uw tickets te krijgen'),
      'betaling-loopt': T('as.st.loopt','de betaling wacht op bevestiging; uw tickets komen pas daarna') };
    if (open.length) el.insertAdjacentHTML('afterbegin', '<div class="live-start h-mt80"><div class="lh">' + T('as.aanvragen','Mijn aanvragen') + '</div>' +
      open.map(x => '<div class="ld h-mt50">' + esc(x.assetNaam) + ' · ' + x.aantal + ' ' + esc(x.smaak) + ' · ' + eur(x.totaal) + '<br>' + esc(STAND[x.status] || x.status) +
        '<div class="h-rij h-wrap h-mt40">' +
        (x.status !== 'aangevraagd' ? '<button class="live-go js-asbetaal h-mt0" data-id="' + esc(x.id) + '">' + T('as.betaal','Betaal') + ' ' + eur(x.totaal) + '</button>' : '') +
        (x.status !== 'betaling-loopt' ? '<button class="mo-code js-asintrek" data-id="' + esc(x.id) + '" data-contextactie>' + T('as.intrek','Trek in') + '</button>' : '') +
        '</div></div>').join('') + '</div>');
    el.querySelectorAll('.js-asbetaal').forEach(b => b.addEventListener('click', async () => {
      if (!b.dataset.idem) b.dataset.idem = RTGId('assetbetaal');
      try { await API.call('/api/asset/aanvraag/betaal', { id: b.dataset.id, idem: b.dataset.idem }); toast(T('as.betaald','Betaald en bevestigd. Uw tickets staan klaar; u heeft 14 dagen bedenktijd.')); renderAssets(); }
      catch(e){ delete b.dataset.idem; toast(e.message); renderAssets(); }
    }));
    el.querySelectorAll('.js-asintrek').forEach(b => b.addEventListener('click', async () => {
      try { const r = await API.call('/api/asset/herroep', { id: b.dataset.id }); toast(r.let); renderAssets(); }
      catch(e){ toast(e.message); }
    }));
