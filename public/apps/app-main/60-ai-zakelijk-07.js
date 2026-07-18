    if (user.account){
      html += kaart('🔐 ' + T('bo2.beveiliging','Beveiliging'),
        rij(T('bo2.lidsinds','Lid sinds'), user.since || '') +
        rij(T('bo2.email','E-mail bevestigd'), user.emailVerified === false ? T('bo2.nee','nee') : T('bo2.ja','ja')) +
        '<div style="font-size:0.68rem;color:var(--soft);margin-top:0.5rem;line-height:1.5;">' + T('bo2.2fa','Wachtwoord vergeten? Dat herstelt u via de website in twee stappen: een link per e-mail plus een code op uw telefoon.') + '</div>' +
        '<div style="display:flex;gap:0.4rem;margin-top:0.55rem;flex-wrap:wrap;">' +
        '<input id="boWwHuidig" type="password" placeholder="' + T('bo2.huidig','Huidig wachtwoord') + '" autocomplete="current-password" style="flex:1;min-width:9rem;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.65rem;color:var(--txt);font-family:inherit;font-size:0.76rem;">' +
        '<input id="boWwNieuw" type="password" placeholder="' + T('bo2.nieuw','Nieuw wachtwoord') + '" autocomplete="new-password" style="flex:1;min-width:9rem;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.65rem;color:var(--txt);font-family:inherit;font-size:0.76rem;">' +
        '</div>' + knopje('boWwZet', T('bo2.wijzig','Wijzig wachtwoord')) +
        (user.emailVerified === false ? knopje('boVerstuur', T('bo2.verstuur','Stuur bevestigingsmail opnieuw')) : ''));
    } else {
      html += kaart('🔐 ' + T('bo2.beveiliging','Beveiliging'),
        '<div class="fineprint">' + T('bo2.demo','U gebruikt een demoprofiel. Met een echt account beheert u hier uw wachtwoord en tweestapsherstel.') + '</div>');
    }

    // weergave: RTG en Lifestyle kunnen tussen het pas-thema en klassiek donker
    if (vastePas === 'rtg' || vastePas === 'lifestyle'){
      const pasNaam = vastePas === 'rtg' ? T('bo2.thema.bordeaux','Bordeaux (RTG)') : T('bo2.thema.parel','Parelmoer (Lifestyle)');
      const nu = pasThemaHuidig();
      const knop = (val, tekst) => '<button class="js-thema" data-thema="' + val + '" style="margin-top:0.5rem;margin-right:0.4rem;border-radius:999px;padding:0.4rem 0.85rem;font-family:inherit;font-size:0.7rem;cursor:pointer;border:1px solid ' + (nu===val?'var(--gold)':'var(--line)') + ';background:' + (nu===val?'var(--gold)':'none') + ';color:' + (nu===val?'#000':'var(--txt)') + ';">' + tekst + '</button>';
      html += kaart('🎨 ' + T('bo2.weergave','Weergave'),
        '<div class="fineprint">' + T('bo2.weergave.s','Kies het kleurthema van deze app.') + '</div>' +
        knop(THEMA_STANDAARD[vastePas], pasNaam) + knop('standaard', T('bo2.thema.klassiek','Klassiek (donker)')));
    }

    // pas-specifiek: elke pas zijn eigen slimme snelkoppelingen
    if (user.tier === 'business'){
      html += kaart('💼 ' + T('bo2.vb','Voor uw Business Pass'),
        '<div class="fineprint">' + T('bo2.vb.s','Uw facturen zijn boekhoudklaar. De AI-boekhouder en de zzp-belastingtool staan onder Betalen; uw netwerk onder Salon.') + '</div>' +
        knopje('boNaarBoekhouder', '📚 ' + T('bo2.boekhouder','AI-boekhouder')) + knopje('boNaarZakelijk', '💼 RTG Zakelijk'));
    } else if (user.tier === 'lifestyle'){
      html += kaart('🌙 ' + T('bo2.vl','Voor uw Lifestyle Pass'),
        '<div class="fineprint">' + T('bo2.vl.s','Uw concierge denkt vooruit onder AI; uw professionele netwerk staat onder Salon.') + '</div>' +
        knopje('boNaarAi', '✨ ' + T('bo2.concierge','Concierge')) + knopje('boNaarZakelijk', '💼 RTG Zakelijk'));
    } else {
      html += kaart('🎫 ' + T('bo2.vr','Voor uw pas'),
        '<div class="fineprint">' + T('bo2.vr.s','Boeken, betalen, vrienden en De Salon zitten in uw pas. Lifestyle en Business voegen de concierge, de AI-boekhouder en RTG Zakelijk toe.') + '</div>');
    }
    body.innerHTML = html;
    renderAgendaLid();
    renderFacturenLid();

    const bind = (id, fn) => { const e = document.getElementById(id); if (e) e.addEventListener('click', fn); };
    bind('boNaarBetalen', () => naarTab('betalen'));
    bind('boNaarBoekhouder', () => naarTab('betalen'));
    bind('boNaarAi', () => naarTab('ai'));
    bind('boNaarZakelijk', () => { boDicht(); naarTab('salon'); setTimeout(() => { const z = document.getElementById('zakOpenBtn'); if (z) z.click(); }, 150); });
    body.querySelectorAll('.js-thema').forEach(b => b.addEventListener('click', () => { pasThemaZet(b.dataset.thema); boRender(); }));
    bind('boVerstuur', async () => {
      try { const d = await API.call('/auth/resend'); toast(T('bo2.gestuurd','Bevestigingsmail verstuurd.')); if (d.devVerifyUrl) console.log('verify:', d.devVerifyUrl); }
      catch(e){ toast(e.message); }
    });
    bind('boWwZet', async () => {
      try {
        await API.call('/auth/password', { huidig: $('#boWwHuidig').value, nieuw: $('#boWwNieuw').value });
        $('#boWwHuidig').value = ''; $('#boWwNieuw').value = '';
        toast(T('bo2.gewijzigd','Wachtwoord gewijzigd.'));
      } catch(e){ toast(e.message); }
    });
  }

