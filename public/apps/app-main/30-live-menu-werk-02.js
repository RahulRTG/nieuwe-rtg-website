      const vol = a.beschikbaar === 0;
      return '<div class="live-start" style="margin-top:0.8rem;">' +
        '<div class="lh">' + a.icon + ' ' + esc(a.naam) + '</div>' +
        '<div class="ld">' + esc(a.beschrijving) + '<br>' + esc(a.waar) + ' · ' + T('as.waarde','objectwaarde') + ' ' + eur(a.waarde) + '</div>' +
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.55rem;font-size:0.72rem;color:var(--soft);">' +
          '<span style="border:1px solid var(--line);border-radius:999px;padding:0.2rem 0.6rem;">' + a.totaal + ' ' + T('as.tickets','tickets') + ' · ' + (vol ? T('as.vol','uitverkocht') : a.beschikbaar + ' ' + T('as.vrij','beschikbaar')) + '</span>' +
          '<span style="border:1px solid var(--line);border-radius:999px;padding:0.2rem 0.6rem;">1 ' + T('as.ticket','ticket') + ' = 24 ' + T('as.uur','uur per jaar') + ' · ' + d.regels.jaren + ' ' + T('as.jaar','jaar') + '</span>' +
          '<span style="border:1px solid var(--line);border-radius:999px;padding:0.2rem 0.6rem;">' + T('as.tw','ticketwaarde nu') + ' ' + eur(a.ticketWaarde) + '</span>' +
        '</div>' +
        (p ? '<div style="margin-top:0.7rem;border:1px solid var(--gold-soft,rgba(201,154,46,0.4));border-radius:12px;padding:0.6rem 0.75rem;font-size:0.78rem;">' +
            '<b>' + T('as.mijn','Mijn positie') + ':</b> ' + p.tickets + ' ' + T('as.tickets','tickets') + ' (' + p.access + ' Access · ' + p.asset + ' Asset)' + (p.tickets ? ' · ' +
            '<b style="color:var(--gold-bright,#C99A2E);">' + p.dagenTegoed + '</b> ' + T('as.dagen','x 24 uur over dit jaar') + ' · ' + T('as.geldig','geldig tot') + ' ' + p.vervaltOp : '') +
            (p.asset ? '<br>' + T('as.uitstapw','Uitstapwaarde vandaag') + ': <b>' + eur(p.uitstapWaarde) + '</b>' : '') +
            ((p.terugkoopOnderweg||[]).length ? '<br>⏳ ' + T('as.tkw','Terugkoop onderweg') + ': ' + p.terugkoopOnderweg.map(v => eur(v.waarde) + ' ' + T('as.uiterlijk','uiterlijk') + ' ' + v.uiterlijk).join(', ') : '') +
            (p.gepland.length ? '<br>📅 ' + T('as.gepland','Gepland') + ': ' + p.gepland.join(', ') : '') +
            '<div style="display:flex;gap:0.45rem;flex-wrap:wrap;margin-top:0.5rem;">' +
              (p.tickets ? '<input type="date" data-asdatum="' + a.id + '" min="' + new Date().toISOString().slice(0,10) + '" style="flex:1;min-width:130px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.6rem;font-size:0.78rem;color:var(--txt);" aria-label="' + T('as.dag','Kies uw dag') + '">' +
              '<button class="mo-code js-asboek" data-id="' + a.id + '">' + T('as.boek','Boek mijn 24 uur') + '</button>' : '') +
              (p.asset ? '<button class="mo-code js-asuit" data-id="' + a.id + '" data-tid="' + p.assetTicketIds[0] + '" data-w="' + p.ticketWaarde + '">' + T('as.uitstap','Stap uit (1 ticket)') + '</button>' : '') +
              ((p.herroepbaar||[]).length ? '<button class="mo-code js-asherroep" data-tid="' + p.herroepbaar[0].id + '" data-p="' + p.herroepbaar[0].prijs + '">↩ ' + T('as.herroep','Herroep (14 dgn)') + '</button>' : '') +
            '</div></div>' : '') +
        (vol
          ? '<div style="margin-top:0.7rem;font-size:0.74rem;color:var(--soft);">' + T('as.volh','De pool is vol.') + ' ' + (a.wachtenden ? a.wachtenden + ' ' + T('as.wachten','op de wachtlijst.') : '') + '</div>' +
            (a.opWachtlijst
              ? '<div style="margin-top:0.4rem;font-size:0.74rem;color:var(--gold-bright,#C99A2E);">✓ ' + T('as.opwl','U staat op de wachtlijst; bij de eerstvolgende uitstapper bent u aan de beurt.') + '</div>'
              : '<button class="live-go js-aswacht" data-id="' + a.id + '" style="margin-top:0.5rem;">' + T('as.wachtknop','Zet mij op de wachtlijst') + '</button>')
          : '<div style="margin-top:0.7rem;font-size:0.72rem;color:var(--soft);line-height:1.6;">' +
            '<b style="color:var(--txt);">Access</b> · ' + eur(a.prijsAccess) + ' · ' + T('as.access.s','dienstenvoucher: alleen het gebruik (25% van de ticketwaarde). Teller reset elk jaar, na tien jaar is het klaar.') + '<br>' +
            '<b style="color:var(--txt);">Asset</b> · ' + eur(a.prijsAsset) + ' · ' + T('as.asset.s','deelnemingsbewijs in') + ' ' + esc(a.entiteit) + ': ' + T('as.asset.s2','zelfde gebruik, plus uw aandeel in de restwaarde. Uitstappen via de wachtlijst, anders koopt RTG terug binnen 30 dagen.') + '<br>' +
            '<span style="font-size:0.66rem;">' + T('as.taxatie','Servicefee') + ' ' + eur(a.serviceFee) + '/' + T('as.perjaar','jaar per ticket') + ' · ' + T('as.bedenk','14 dagen bedenktijd met volledige terugbetaling') + ' · ' + T('as.beweegt','prijzen en uitstapwaarde bewegen mee met de taxatie.') + '</span></div>' +
          '<div style="display:flex;gap:0.45rem;flex-wrap:wrap;margin-top:0.5rem;">' +
            '<input type="number" min="1" max="10" value="1" data-asaantal="' + a.id + '" style="width:64px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.6rem;font-size:0.8rem;color:var(--txt);" aria-label="aantal">' +
            '<button class="live-go js-askoop" data-id="' + a.id + '" data-smaak="access" style="flex:1;margin-top:0;">Access</button>' +
            '<button class="live-go js-askoop" data-id="' + a.id + '" data-smaak="asset" data-ent="' + esc(a.entiteit) + '" data-fee="' + a.serviceFee + '" style="flex:1;margin-top:0;background:var(--gold-bright,#C99A2E);">Asset</button>' +
          '</div>')+
        '<button class="mo-code js-asdoc" data-id="' + a.id + '" style="margin-top:0.5rem;">📄 ' + T('as.doc','Essentiele informatie') + '</button>' +
        '<div data-asdocuit="' + a.id + '" style="display:none;margin-top:0.5rem;font-size:0.7rem;color:var(--soft);line-height:1.6;border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.75rem;"></div>' +
      '</div>';
    }).join('');
    el.querySelectorAll('.js-askoop').forEach(b => b.addEventListener('click', async () => {
      const aantal = parseInt((el.querySelector('[data-asaantal="' + b.dataset.id + '"]') || {}).value, 10) || 1;
      const body = { assetId: b.dataset.id, smaak: b.dataset.smaak, aantal };
      if (b.dataset.smaak === 'asset'){
        // deelnemingsbewijs: uitdrukkelijk akkoord na de kerninformatie
        if (!window.confirm(T('as.akk1','U koopt een deelnemingsbewijs in') + ' ' + b.dataset.ent + '.\n\n' +
          T('as.akk2','De restwaarde beweegt mee met de taxatie en kan dalen. Jaarlijkse servicefee:') + ' ' + eur(Number(b.dataset.fee)) + ' ' + T('as.akk3','per ticket. Uitstappen loopt eerst via de wachtlijst; anders koopt RTG terug binnen 30 dagen. U heeft 14 dagen bedenktijd met volledige terugbetaling.') + '\n\n' +
          T('as.akk4','Gaat u akkoord?'))) return;
        body.akkoord = true;
      }
      try {
        const r = await API.call('/asset/koop', body);
        toast('🎟️ ' + r.tickets.length + ' ticket(s) · ' + eur(r.totaalPrijs) + '. ' + T('as.welkom','Welkom in de pool.'));
        renderAssets();
      } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-aswacht').forEach(b => b.addEventListener('click', async () => {
      try { const r = await API.call('/asset/wachtlijst', { assetId: b.dataset.id }); toast('📋 ' + T('as.wlok','U staat op de wachtlijst, positie') + ' ' + r.positie + '.'); renderAssets(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-asherroep').forEach(b => b.addEventListener('click', async () => {
      if (!window.confirm(T('as.herroepvraag','Herroepen binnen de bedenktijd? U krijgt de volledige koopsom') + ' (' + eur(Number(b.dataset.p)) + ') ' + T('as.herroepvraag2','terug via een Tik.'))) return;
      try { const r = await API.call('/asset/herroep', { ticketId: b.dataset.tid }); toast('↩ ' + T('as.herroepok','Herroepen. De Tik van') + ' ' + eur(r.terug) + ' ' + T('as.uitok2','staat in uw tegoed.')); renderAssets(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-asdoc').forEach(b => b.addEventListener('click', async () => {
      const uit = el.querySelector('[data-asdocuit="' + b.dataset.id + '"]');
      if (!uit) return;
      if (uit.style.display !== 'none'){ uit.style.display = 'none'; return; }
      try {
        const d = (await API.call('/asset/document', { assetId: b.dataset.id })).document;
        uit.innerHTML = '<b style="color:var(--txt);">' + esc(d.object) + '</b> · ' + esc(d.entiteit) + '<br>' +
          esc(d.gebruik) + '<br><b>Access:</b> ' + esc(d.smaken.access.aard) + '<br><b>Asset:</b> ' + esc(d.smaken.asset.aard) + '<br>' +
          esc(d.kosten.serviceFee) + '<br>' + esc(d.kosten.overdracht) + '<br><b>' + T('as.doc.uit','Uitstappen') + ':</b> ' + esc(d.uitstappen) + '<br><b>' + T('as.doc.bed','Bedenktijd') + ':</b> ' + esc(d.bedenktijd) + '<br><b>' + T('as.doc.risico','Risico') + ':</b> ' + esc(d.risico);
        uit.style.display = '';
      } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-asboek').forEach(b => b.addEventListener('click', async () => {
      const datum = (el.querySelector('[data-asdatum="' + b.dataset.id + '"]') || {}).value;
