    const aiGo = document.getElementById('factLidAiGo'); if (aiGo){ const doe = async () => { const opdracht = document.getElementById('factLidAiIn').value.trim(); if (!opdracht) return; const out = document.getElementById('factLidAiOut'); out.innerHTML = '<div class="fineprint">…</div>'; try { const r = await API.call('/facturen/ai', { opdracht }); out.innerHTML = '<div class="fineprint" style="color:var(--txt);white-space:pre-wrap;">'+esc(r.antwoord)+'</div>'; document.getElementById('factLidAiIn').value=''; if (r.overzicht){ memberFacturen = r.overzicht; } } catch(e){ out.innerHTML = '<div class="fineprint" style="color:#E0736A;">'+esc(e.message)+'</div>'; } }; aiGo.addEventListener('click', doe); const i2 = document.getElementById('factLidAiIn'); if (i2) i2.addEventListener('keydown', e => { if (e.key==='Enter') doe(); }); }
  }

  /* ---------- de Toestelkluis: eigen kopieen op het eigen toestel ----------
     Elke download (factuur, overzicht) krijgt stil een kopie in de prive
     browseropslag van dit toestel; hier ziet het lid ze, opent of wist ze.
     De server houdt alleen het gezaghebbende record. */
  async function renderKluisLid(host){
    if (!window.Toestelkluis || !Toestelkluis.kan()) return;
    const items = await Toestelkluis.lijst();
    const kaart = document.createElement('div');
    kaart.className = 'zak-kaart';
    kaart.innerHTML = '<b style="font-size:0.8rem;">' + T('kluis.h','Op dit toestel') + '</b>' +
      '<div class="fineprint" style="margin-top:0.25rem;">' + T('kluis.d','Uw eigen kopieen, opgeslagen in de beveiligde opslag van deze browser. Alleen u kunt erbij; er gaat niets over de lijn.') + '</div>' +
      (items.length ? items.slice(0, 10).map(x =>
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;font-size:0.76rem;margin-top:0.4rem;">' +
          '<span>' + esc(x.naam) + '<span style="color:var(--muted);"> · ' + Math.max(1, Math.round(x.bytes/1024)) + ' kB</span></span>' +
          '<span style="white-space:nowrap;"><button class="js-klopen" data-k="' + esc(x.naam) + '" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.15rem 0.45rem;color:var(--txt);font-size:0.68rem;cursor:pointer;">' + T('kluis.open','Open') + '</button> ' +
          '<button class="js-klwis" data-k="' + esc(x.naam) + '" aria-label="' + T('kluis.wis','wis') + '" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.15rem 0.45rem;color:var(--soft);font-size:0.68rem;cursor:pointer;">✕</button></span></div>').join('')
        : '<div class="fineprint" style="margin-top:0.4rem;">' + T('kluis.leeg','Nog leeg. Download een factuur of overzicht en uw kopie verschijnt hier vanzelf.') + '</div>');
    host.appendChild(kaart);
    kaart.querySelectorAll('.js-klopen').forEach(b => b.addEventListener('click', async () => {
      const f = await Toestelkluis.haal(b.dataset.k); if (!f) return;
      const url = URL.createObjectURL(f);
      const a = document.createElement('a'); a.href = url; a.download = b.dataset.k; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }));
    kaart.querySelectorAll('.js-klwis').forEach(b => b.addEventListener('click', async () => {
      await Toestelkluis.wis(b.dataset.k); renderFacturenLid();
    }));
  }

  /* ---------- Mijn backoffice: de slimme accountkamer van elke pas ---------- */
  function boOpen(){ $('#bo-scrim').classList.add('open'); $('#bo-sheet').classList.add('open'); boRender(); }
  function boDicht(){ $('#bo-scrim').classList.remove('open'); $('#bo-sheet').classList.remove('open'); }
  $('#boBtn').addEventListener('click', boOpen);
  $('#boClose').addEventListener('click', boDicht);
  $('#bo-scrim').addEventListener('click', boDicht);
  const naarTab = (naam) => { boDicht(); const b = document.querySelector('#tabbar [data-tab="' + naam + '"]'); if (b) b.click(); };

  async function boRender(){
    const body = $('#boBody');
    $('#boSub').textContent = (TIER_LABEL[user.tier] || '') + ' · ' + (user.codename || user.name || '');
    const kaart = (titel, inhoud) => '<div class="zak-kaart"><b style="font-size:0.8rem;">' + titel + '</b>' + inhoud + '</div>';
    const rij = (l, w) => '<div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-top:0.4rem;"><span style="color:var(--muted);">' + l + '</span><b>' + w + '</b></div>';
    const knopje = (id, tekst) => '<button id="' + id + '" style="margin-top:0.55rem;margin-right:0.4rem;background:none;border:1px solid var(--line);border-radius:999px;padding:0.4rem 0.85rem;color:var(--txt);font-family:inherit;font-size:0.7rem;cursor:pointer;">' + tekst + '</button>';

    // de slimme cijfers: wat er open staat komt bovenaan, met een knop erbij
    const open = invoices.filter(i => i.status === 'open');
    const betaald = invoices.filter(i => i.status === 'paid');
    const totaalBetaald = betaald.reduce((s, i) => s + (i.netto || 0) + (i.bijdrage || 0), 0);
    const fonds = betaald.reduce((s, i) => s + Math.round((i.bijdrage || 0) * 0.3), 0);
    const acties = [];
    if (open.length) acties.push('' + open.length + ' ' + T('bo2.open','openstaande factuur/facturen; betaal in één tik via Betalen.'));
    if (user.account && user.emailVerified === false) acties.push('' + T('bo2.mailniet','Uw e-mailadres is nog niet bevestigd.'));
    if (user.account && user.verified && user.verified !== 'verified') acties.push('' + T('bo2.kyc','Verifieer uw identiteit om in één tik te boeken.'));

    let html = '';
    if (acties.length) html += kaart('' + T('bo2.acties','Nu aandacht nodig'),
      acties.map(a => '<div class="fineprint">' + a + '</div>').join('') +
      (open.length ? knopje('boNaarBetalen', T('bo2.betaalnu','Naar Betalen')) : ''));
    else html += kaart('✓ ' + T('bo2.alsklaar','Alles op orde'), '<div style="font-size:0.76rem;color:var(--muted);margin-top:0.4rem;">' + T('bo2.geen','Geen openstaande zaken op uw account.') + '</div>');

    html += kaart('' + T('bo2.cijfers','Mijn cijfers'),
      rij(T('bo2.betaald','Betaald via RTG'), eur(totaalBetaald)) +
      rij(T('bo2.facturen','Facturen'), betaald.length + ' ' + T('bo2.voldaan','voldaan') + (open.length ? ' · ' + open.length + ' open' : '')) +
      rij('RTFoundation', eur(fonds) + ' ' + T('bo2.viamij','via mijn bijdragen')) +
      (myApps && myApps.length ? rij(T('bo2.sollicitaties','Sollicitaties'), String(myApps.length)) : ''));

    // interactieve AI-agenda
    /* "Vooruit": uw termijnen, voor ELKE pas -- ook de gratis app. De motor
       (kern/levensgraaf) zit niet achter een pas, want een gratis lid heeft ook
       een paspoort dat verloopt en een boeking die komt. Vandaar geen
       tier-controle op deze regel, in tegenstelling tot de twee eronder. */
    html += '<div id="boVooruitCard"></div>';
    if (user.tier !== 'guest') html += '<div id="boAgendaCard"></div>';
    // mijn facturen (automatisch bij elke aankoop)
    if (user.tier !== 'guest') html += '<div id="boFacturenCard"></div>';

    if (user.account){
      html += kaart('' + T('bo2.beveiliging','Beveiliging'),
        rij(T('bo2.lidsinds','Lid sinds'), user.since || '') +
        rij(T('bo2.email','E-mail bevestigd'), user.emailVerified === false ? T('bo2.nee','nee') : T('bo2.ja','ja')) +
        '<div style="font-size:0.68rem;color:var(--soft);margin-top:0.5rem;line-height:1.5;">' + T('bo2.2fa','Wachtwoord vergeten? Dat herstelt u via de website in twee stappen: een link per e-mail plus een code op uw telefoon.') + '</div>' +
        '<div style="display:flex;gap:0.4rem;margin-top:0.55rem;flex-wrap:wrap;">' +
        '<input id="boWwHuidig" type="password" placeholder="' + T('bo2.huidig','Huidig wachtwoord') + '" autocomplete="current-password" style="flex:1;min-width:9rem;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.65rem;color:var(--txt);font-family:inherit;font-size:0.76rem;">' +
        '<input id="boWwNieuw" type="password" placeholder="' + T('bo2.nieuw','Nieuw wachtwoord') + '" autocomplete="new-password" style="flex:1;min-width:9rem;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.65rem;color:var(--txt);font-family:inherit;font-size:0.76rem;">' +
        '</div>' + knopje('boWwZet', T('bo2.wijzig','Wijzig wachtwoord')) +
        (user.emailVerified === false ? knopje('boVerstuur', T('bo2.verstuur','Stuur bevestigingsmail opnieuw')) : ''));
    } else {
      html += kaart('' + T('bo2.beveiliging','Beveiliging'),
        '<div class="fineprint">' + T('bo2.demo','U gebruikt een demoprofiel. Met een echt account beheert u hier uw wachtwoord en tweestapsherstel.') + '</div>');
    }

    // weergave: RTG en Lifestyle kunnen tussen het pas-thema en klassiek donker
