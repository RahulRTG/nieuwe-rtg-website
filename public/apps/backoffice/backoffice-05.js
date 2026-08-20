  /* de backoffice: RENDEZ-VOUS -- THE TABLE

     Curatie is mensenwerk: hier stelt het kantoor een tafel samen van zes of
     acht leden. Dit is de enige plek waar een gastenlijst zichtbaar is; de leden
     zelf zien alleen hun eigen uitnodiging (kern/rendezvous-tafels.js legt uit
     waarom die twee kanten uit elkaar staan).

     OP CODENAAM, zoals overal. Wie een echte naam nodig heeft gaat langs de
     kluis, met een reden en een regel in het inzagejournaal. */
  async function laadTafels(){
    const el = $('#rvTafels'); if (!el) return;
    try {
      const d = await call('/office/rendezvous/tafels');
      const lijst = d.tafels || [];
      el.innerHTML = lijst.length ? lijst.map(t =>
        '<div class="row"><div class="rl"><b>'+escHtml(t.naam)+'</b>'+
        '<span class="sub">'+escHtml([t.stad, t.datum, t.tijd].filter(Boolean).join(' · '))+
        (t.thema ? ' · ' + escHtml(t.thema) : '')+'</span>'+
        '<span class="sub">'+t.toegezegd+' van '+t.genodigden.length+' toegezegd, '+t.plaatsen+' plaatsen</span>'+
        '<span class="sub">'+t.genodigden.map(g => escHtml(g.codenaam)+' ('+g.status+')').join(', ')+'</span></div>'+
        '<div class="rr"><input data-nodig="'+escHtml(t.id)+'" placeholder="Codenaam erbij" style="width:11rem;">'+
        '<button class="hbtn" data-nodigknop="'+escHtml(t.id)+'">Uitnodigen</button></div></div>').join('')
        : '<div class="row"><div class="rl"><span class="sub">Nog geen tafels samengesteld.</span></div></div>';
      el.querySelectorAll('[data-nodigknop]').forEach(b => b.addEventListener('click', async () => {
        const inp = el.querySelector('[data-nodig="' + b.dataset.nodigknop + '"]');
        try { await call('/office/rendezvous/tafel/nodig', { id: b.dataset.nodigknop, codenaam: inp.value });
          inp.value = ''; laadTafels(); } catch(e){ alert(e.message); }
      }));
    } catch(e){ el.innerHTML = '<div class="row"><div class="rl"><span class="sub">'+escHtml(e.message)+'</span></div></div>'; }
  }
  function koppelTafelMaak(){
    const b = $('#tfMaak'); if (!b) return;
    b.addEventListener('click', async () => {
      const gasten = String(($('#tfGasten') || {}).value || '').split(',').map(x => x.trim()).filter(Boolean);
      try {
        await call('/office/rendezvous/tafel/maak', {
          naam: $('#tfNaam').value, stad: $('#tfStad').value, datum: $('#tfDatum').value,
          tijd: $('#tfTijd').value, thema: $('#tfThema').value,
          plaatsen: Number($('#tfPlaatsen').value) || 8, genodigden: gasten });
        $('#tfNaam').value = ''; $('#tfGasten').value = ''; $('#tfThema').value = '';
        laadTafels();
      } catch(e){ alert(e.message); }
    });
  }

  /* Alleen de knop koppelen; LADEN gebeurt pas na het inloggen, vanuit
     enterApp() in deel 01 -- net als de andere panelen. Riep dit bestand het
     zelf aan, dan vuurde de backoffice bij elke paginalading een verzoek af
     zonder token: een 401 in de console die echte fouten onder ruis bedelft. */
  koppelTafelMaak();
})();
