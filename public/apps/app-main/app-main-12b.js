  /* De tickets van het lid: het aanbod en wat hij al heeft. Apart deel omdat
     app-main-12.js met deze twee functies erbij op 10,9 KB kwam en
     keuringsregel 13 op 10 staat. De regel heeft gelijk over de reden: de rest
     van dat deel is de schil van de app (meldingen, tabbladen, opbouw), en dit
     gaat over tickets. */
  async function laadTickets(){
    if (!API.live) return;
    try { tkPartners = (await API.call('/api/tickets/aanbod')).partners || []; } catch(e){ tkPartners = []; }
    let mijn = [];
    try { mijn = (await API.call('/api/tickets/mijn')).tickets || []; } catch(e){}
    const mijnEl = $('#tkMijn');
    if (mijnEl) mijnEl.innerHTML = mijn.filter(t => !t.gebruikt || t.datum >= new Date().toISOString().slice(0, 10)).map(t =>
      '<div class="card s-j84k16">'+
      '<div class="s-1f3kzms">\uD83C\uDF9F\uFE0F '+T('tk.ticket','Ticket')+' \u00B7 '+esc(t.supplierName)+'</div>'+
      '<div class="s-10mclmr"><b>'+esc(t.naam)+'</b> \u00B7 '+t.datum+' '+t.tijd+' \u00B7 '+t.personen+'p</div>'+
      (t.gebruikt
        ? '<div class="s-1syecv">\u2705 '+T('tk.gebruikt','Binnen; ingecheckt door ')+esc(t.checkin.door)+'</div>'
        // de code staat nergens bewaard: tonen maakt een nieuwe (en trekt de vorige in)
        : '<div class="s-t2hr14">'+
          '<span id="tkCode-'+esc(t.ref)+'" class="s-kzdem1"></span>'+
          '<button class="bz-btn" data-tktoon="'+esc(t.ref)+'">'+T('tk.toon','Toon ticketcode')+'</button>'+
          '<div class="s-1p5pee4">'+T('tk.laatzien','Laat deze code zien aan de deur')+'</div></div>')+
      // de eigen transferdienst van de zaak: aanvragen, of live zien wie er komt
      (t.transfer
        ? '<div class="s-lzrpeq">\uD83D\uDE90 '+T('tk.tr','Transfer')+': <b class="s-1btm41d">'+
          ({ 'wacht-op-betaling': T('tk.tr.betalen','nog betalen'), 'aangevraagd': T('tk.tr.aangevraagd','aangevraagd'), 'geaccepteerd': T('tk.tr.geacc','bevestigd'), 'onderweg': T('tk.tr.onderweg','onderweg naar u') }[t.transfer.status] || t.transfer.status)+'</b>'+
          (t.transfer.chauffeur ? ' \u00B7 '+esc(t.transfer.chauffeur) : '')+(t.transfer.etaMin ? ' \u00B7 \u23F1 '+t.transfer.etaMin+' min' : '')+
          (t.transfer.prijs ? ' \u00B7 '+eur(t.transfer.prijs) : ' \u00B7 '+T('tk.tr.incl','inclusief'))+'</div>'
        : (t.transferAan && !t.gebruikt
          ? '<div style="margin-top:0.55rem;display:flex;gap:0.4rem;">'+
            '<input id="trVan-'+t.ref+'" placeholder="'+T('tk.tr.vanph','Ophaaladres')+'" style="flex:1;background:var(--card2,var(--card));border:1px solid var(--line);border-radius:0;padding:0.5rem 0.7rem;font-size:0.8rem;color:var(--txt);outline:none;">'+
            '<button class="bz-btn" data-trvraag="'+t.ref+'" data-trprijs="'+t.transferPrijs+'">\uD83D\uDE90 '+(t.transferPrijs ? eur(t.transferPrijs) : T('tk.tr.gratis','Gratis'))+'</button></div>'
          : ''))+
      '</div>').join('');
    document.querySelectorAll('[data-tktoon]').forEach(b => b.addEventListener('click', async () => {
      try {
        const r = await API.call('/api/ticket/toon', { ref: b.dataset.tktoon });
        const el = document.getElementById('tkCode-' + b.dataset.tktoon);
        if (el) el.textContent = r.code;
      } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-trvraag]').forEach(b => b.addEventListener('click', async () => {
      const veld = document.getElementById('trVan-' + b.dataset.trvraag);
      try {
        const r = await API.call('/api/transfer/aanvraag', { ticketRef: b.dataset.trvraag, van: veld ? veld.value : '' });
        if (Number(b.dataset.trprijs) > 0) await API.call('/api/ride/pay', { ref: r.ride.ref });
        toast(T('tk.tr.ok','Transfer aangevraagd. U ziet hier wie u komt halen.'));
        laadTickets();
      } catch(e){ toast(e.message); }
    }));
    renderTkAanbod();
  }
  function renderTkAanbod(){
    const el = $('#tkAanbod'); if (!el) return;
    if (!tkPartners.length){ el.innerHTML = ''; return; }
    let html = '<div class="s-llzgco">'+T('tk.kop','Activiteiten, tours en musea')+'</div>';
