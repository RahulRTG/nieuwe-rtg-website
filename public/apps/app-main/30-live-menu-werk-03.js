      if (!datum){ toast(T('as.kiesdag','Kies eerst een dag.')); return; }
      try { const r = await API.call('/asset/gebruik', { assetId: b.dataset.id, datum }); toast('' + datum + ' ' + T('as.vast','staat vast.') + ' ' + r.dagenTegoed + ' ' + T('as.dagenover','x 24 uur over dit jaar.')); renderAssets(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-asuit').forEach(b => b.addEventListener('click', async () => {
      if (!window.confirm(T('as.uitvraag','Uitstappen? RTG betaalt de actuele ticketwaarde') + ' (' + eur(Number(b.dataset.w)) + ') ' + T('as.uitvraag2','uit via een Tik en het ticket gaat terug in de pool.'))) return;
      try { const r = await API.call('/asset/uitstap', { ticketId: b.dataset.tid }); toast('' + T('as.uitok','Uitgestapt. De Tik van') + ' ' + eur(r.waarde) + ' ' + T('as.uitok2','staat in uw tegoed.')); renderAssets(); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---------- het brein van Rahul: geheugen en seintjes ----------
     Het gesprek zelf loopt via de gewone Rahul-chat op de AI-tab; deze
     kaart toont rustig wat hij weet (wisbaar) en wat hij zelf ziet. */
  let fluisterSyncAt = 0;
  async function renderFluister(){
    const el = $('#fluisterWrap'); if (!el) return;
    if (!API.live){ el.innerHTML = ''; return; }
    // de inklap-laag deelt (alleen) de gebruikstellers, zodat Rahul leert
    if (window.FocusUI && Date.now() - fluisterSyncAt > 60000){
      fluisterSyncAt = Date.now();
      API.call('/fluister/focus', { scores: FocusUI.scores() }).catch(() => {});
    }
    let prof;
    try { prof = await API.call('/fluister/profiel'); } catch(e){ el.innerHTML = ''; return; }
    // de voorspeller: RTG leert uw ritme en zet de beste verwachting klaar
    let vw = null;
    try { vw = await API.call('/voorspel'); } catch(e){}
    const v = vw && (vw.verwachtingen || [])[0];
    // synergie-pakketten: aanbod dat zaken samen hebben samengesteld
    let pk = [];
    try { pk = ((await API.call('/pakketten')).pakketten || []).slice(0, 2); } catch(e){}
    // sparren: gedachten die Rahul heeft geparkeerd om er op een rustig moment
    // op terug te komen
    let sparLijst = [];
    try { sparLijst = ((await API.call('/spar/lijst', {})).spar) || []; } catch(e){}
    el.innerHTML =
      (v
        ? '<div class="live-start" style="margin-bottom:0.8rem;">' +
            '<div class="lh">' + T('vs.h','Rahul verwacht') + '</div>' +
            '<div class="ld">' + esc(v.wat) + ' · ' + esc(v.waarom) + '. ' +
              T('vs.d','Klopt het niet, dan negeert u dit gewoon; Rahul leert vanzelf bij.') + '</div>' +
            '<button class="chip js-vsdoe" style="margin-top:0.5rem;">' + T('vs.doe','Laat Rahul het klaarzetten') + '</button>' +
          '</div>'
        : '') +
      (pk.length
        ? '<div class="live-start" style="margin-bottom:0.8rem;">' +
            '<div class="lh">' + T('pk.h','Pakketten van onze huizen') + '</div>' +
            pk.map(p => '<div style="margin-top:0.45rem;">' +
              '<div style="font-size:0.85rem;"><b>' + esc(p.naam) + '</b> · € ' + (p.prijsCenten/100).toFixed(2).replace('.', ',') + '</div>' +
              '<div style="font-size:0.72rem;color:var(--soft);">' + p.zaken.map(esc).join(' + ') +
                (p.omschrijving ? ' · ' + esc(p.omschrijving) : '') + '</div>' +
              '<button class="chip js-pkboek" data-pk="' + esc(p.id) + '" data-pknaam="' + esc(p.naam) + '" data-pkprijs="' + p.prijsCenten + '" style="margin-top:0.35rem;">' + T('pk.boek','Boek dit pakket') + '</button></div>').join('') +
          '</div>'
        : '') +
      '<div class="live-start" style="margin-bottom:0.8rem;">' +
        '<div class="lh">' + T('fl.h','Wat Rahul weet en ziet') + '</div>' +
        '<div class="ld">' + T('fl.d','Hij onthoudt wat u vertelt ("onthoud dat..."), leert van wat u gebruikt en regelt alles in de chat hieronder: zoeken, reserveren, bestellen en afrekenen, uw 24 uur, een Tik of betaalverzoek. Vraag "wat kun je" voor het hele overzicht; geld gaat nooit zonder uw "ja" de deur uit.') + '</div>' +
        ((prof.seintjes || []).length
          ? '<div style="margin-top:0.55rem;border:1px solid var(--line);border-radius:12px;padding:0.55rem 0.7rem;">' +
              '<div style="font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">' + T('fl.sein','Rahul ziet') + '</div>' +
              prof.seintjes.map(x => '<div style="margin-top:0.3rem;font-size:0.76rem;line-height:1.45;">' + esc(x.icoon) + ' ' + esc(x.tekst) + '</div>').join('') + '</div>'
          : '') +
        (prof.weetjes.length
          ? '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.5rem;">' + prof.weetjes.map((w, i) =>
              '<span style="display:inline-flex;align-items:center;gap:0.35rem;border:1px solid var(--line);border-radius:999px;padding:0.25rem 0.6rem;font-size:0.68rem;color:var(--txt);">' + esc(w.tekst) +
              '<button class="js-flweg" data-i="' + i + '" aria-label="' + T('fl.weg','vergeet dit') + '" style="background:none;border:none;color:var(--soft);cursor:pointer;font-size:0.75rem;padding:0;">✕</button></span>').join('') + '</div>'
          : '<div style="margin-top:0.5rem;font-size:0.68rem;color:var(--soft);">' + T('fl.leeg','Nog geen weetjes. Zeg bijvoorbeeld: "onthoud dat ik cava drink, nooit rode wijn".') + '</div>') +
        (prof.top.length ? '<div style="margin-top:0.4rem;font-size:0.64rem;color:var(--soft);">' + T('fl.top','Ik zie dat u het meest werkt met') + ': ' + prof.top.map(esc).join(', ') + '.</div>' : '') +
        // sparren: samen een idee beter maken; Rahul komt er op een rustig moment op terug
        sparBlokHtml(sparLijst) +
      '</div>';
    el.querySelectorAll('.js-flweg').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/fluister/vergeet', { wat: Number(b.dataset.i) }); renderFluister(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-vsdoe').forEach(b => b.addEventListener('click', () => {
      const tegel = document.querySelector('.os-app[data-tab="ai"]'); if (tegel) tegel.click();
      if (typeof ask === 'function') ask(v.vraag);
    }));
    bindSparBlok(el);
    el.querySelectorAll('.js-pkboek').forEach(b => b.addEventListener('click', async () => {
      const prijs = '€ ' + (Number(b.dataset.pkprijs)/100).toFixed(2).replace('.', ',');
      if (!window.confirm(T('pk.zeker','Pakket boeken voor') + ' ' + prijs + '? ' + T('pk.zeker2','Het bedrag gaat direct van uw RTG Pay-saldo.'))) return;
      try {
        await API.call('/pakket/koop', { id: b.dataset.pk, idem: 'pk' + Date.now() });
        toast('' + T('pk.ok','Geboekt. De zaken weten ervan.'));
        renderFluister();
      } catch(e){ toast(e.message); }
    }));
  }

