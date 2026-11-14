/* een betaalpartner kiezen */
    ov.querySelectorAll('.js-dppick').forEach(b => b.addEventListener('click', () => {
      const s = lijst.find(x => x.code === b.dataset.code); ov.remove();
      betaalPartner(s.code, s.name, { bron });
    }));
  }
  async function chatSend(q){
    if (!API.live){ bubble(q, 'user'); setTimeout(() => bubble(aiAnswer(q), 'ai'), 400); return; }
    if (rtgDirect) {
      bubble(q, 'user');
      try {
        const titels = { algemeen: T('direct.titel.algemeen','Contact via RTG Direct'),
          passen: T('direct.titel.passen','Vraag over een RTG-formule'),
          organisatie: T('direct.titel.organisatie','Vraag over RTG voor een organisatie'),
          techniek: T('direct.titel.techniek','Vraag over de techniek van RTG') };
        const d = await API.call('/service/open', { onderwerp: rtgDirect === 'techniek' ? 'app' : 'anders',
          titel: titels[rtgDirect] || titels.algemeen, tekst: q });
        await API.call('/service/mens', { id: d.zaak.id,
          tekst: T('direct.mens','Contact via RTG Direct') });
        bubble(T('direct.ok','Uw vraag staat veilig bij RTG als') + ' ' + d.zaak.id + '. ' +
          T('direct.react','Een medewerker reageert hier in de app.'), 'ai');
        rtgDirect = null;
        history.replaceState(null, '', location.pathname + location.search);
      } catch (e) { bubble(T('direct.mis','Versturen lukte nog niet. Uw tekst blijft hieronder staan.'), 'ai'); const i = $('#askInput'); if (i) i.value = q; }
      return;
    }
    try { const d = await API.call('/chat/send', { text: q }); renderChatMsgs(d.messages, user.tier !== 'rtg'); }
    catch (e) { toast(e.message || 'Versturen mislukt.'); }
  }

  /* De websitebrief gaat pas naar de server NADAT de gebruiker in deze app is
     ingelogd. Geen externe berichtendienst of openbaar aanvraag-endpoint:
     de ingelogde Service-lijn. We wissen het
     fragment pas na een geslaagde aanname, zodat een netwerkstoring de aanvraag
     niet stil laat verdwijnen en een herlaad hem opnieuw kan proberen. */
  let websiteAanvraagBezig = false;
  async function verwerkWebsiteAanvraag(){
    if ((!websiteAanvraag && !rtgDirect) || websiteAanvraagBezig || !user.account || !API.live) return;
    websiteAanvraagBezig = true;
    if (rtgDirect && !websiteAanvraag) {
      openTab('ai');
      const invoer = $('#askInput');
      if (invoer) {
        const onderwerp = { algemeen: T('direct.algemeen','Ik wil contact opnemen over: '),
          passen: T('direct.passen','Ik heb een vraag over een RTG-formule: '),
          organisatie: T('direct.organisatie','Ik wil RTG voor mijn organisatie bespreken: '),
          techniek: T('direct.techniek','Ik heb een technische vraag: ') };
        invoer.value = onderwerp[rtgDirect] || onderwerp.algemeen;
        invoer.focus();
      }
      toast(T('direct.schrijf','Schrijf uw vraag. Deze gaat rechtstreeks naar een RTG-medewerker.'));
      websiteAanvraagBezig = false;
      return;
    }
    const regels = [
      'Aanvraag via rtravelgroup.store', '',
      'Wereld / behoefte: ' + websiteAanvraag.requirement,
      '', 'Brief:', websiteAanvraag.message
    ].filter(regel => regel !== null);
    try {
      const d = await API.call('/service/open', { onderwerp: 'anders',
        titel: 'Aanvraag via rtravelgroup.store · ' + websiteAanvraag.requirement,
        tekst: regels.join('\n') });
      await API.call('/service/mens', { id: d.zaak.id,
        tekst: T('aanvraag.service.mens','Aanvraag via de publieke website') });
      openTab('ai');
      bubble(T('aanvraag.service.ok','Uw aanvraag staat veilig bij RTG als') + ' ' + d.zaak.id + '. ' +
        T('aanvraag.service.react','Een medewerker reageert in de app.'), 'ai');
      websiteAanvraag = null;
      history.replaceState(null, '', location.pathname + location.search);
      toast(T('aanvraag.app.ok','Uw aanvraag staat in uw beveiligde RTG-lijn.'));
    } catch(e){
      openTab('ai');
      const invoer = $('#askInput');
      if (invoer) invoer.value = regels.join('\n');
      toast(e.message || T('aanvraag.app.mis','De aanvraag staat klaar; verstuur hem zodra de verbinding terug is.'));
    } finally { websiteAanvraagBezig = false; }
  }

  function standaardChips(){
    const chips = lang()==='en'
      ? ['Yes, arrange it','What do you know about me?','What should I pack?','Plan my day','Arrange a restaurant']
      : ['Ja, regel het','Wat weet je over mij?','Wat moet ik inpakken?','Plan mijn dag','Regel een restaurant'];
    $('#chips').innerHTML = chips.map(c => '<button class="chip">' + c + '</button>').join('');
    document.querySelectorAll('#chips .chip').forEach(c => c.addEventListener('click', () => ask(c.textContent)));
  }
  function renderAI(){
    if (user.account){ renderChat(); return; }
    $('#aiTitle').textContent = user.tier === 'rtg' ? T('ai.title.rtg','Rahul.') : user.tier === 'lifestyle' ? T('ai.title.life','Uw AI.') : T('ai.title.biz','Uw uitvoerende AI.');
    $('#chat').innerHTML = '';
    chatHistory.length = 0;
    const opener = aiOpener();
    bubble(opener, 'ai');
    chatHistory.push({role:'assistant', content:opener});
    standaardChips();
  }
  $('#askBtn').addEventListener('click', () => { ask($('#askInput').value); $('#askInput').value = ''; });
  $('#askInput').addEventListener('keydown', e => { if (e.key === 'Enter'){ ask(e.target.value); e.target.value = ''; } });
  // spreek uw vraag in: de gedeelde spraakmotor luistert, Rahul doet de rest
  if (window.Spraak) Spraak.koppel($('#askMic'), {
    opTekst: zin => { $('#askInput').value = zin; ask(zin); $('#askInput').value = ''; },
    nietVerstaan: () => toast(T('fl.michoor','Ik kon u niet verstaan; probeer het nog eens of typ het gewoon.')),
    kanNiet: () => toast(T('fl.micniet','Spraak werkt niet in deze browser; typen kan altijd.'))
  });

  /* ---------- RTG Zakelijk: het professionele netwerk van de Business Pass ---------- */
  let zakView = 'feed';
  function zakOpen(){ $('#zak-scrim').classList.add('open'); $('#zak-sheet').classList.add('open'); zakRender(); }
  function zakDicht(){ $('#zak-scrim').classList.remove('open'); $('#zak-sheet').classList.remove('open'); }
  $('#zakClose').addEventListener('click', zakDicht);
  $('#zak-scrim').addEventListener('click', zakDicht);
  document.querySelectorAll('.zak-tab').forEach(b => b.addEventListener('click', () => {
    zakView = b.dataset.zaktab;
    document.querySelectorAll('.zak-tab').forEach(x => x.classList.toggle('active', x === b));
    zakRender();
  }));

  const zakStatusKnop = (p) =>
    p.status === 'verbonden' ? '<span class="zak-open s-3heyfw">✓ ' + T('zak.verbonden','Verbonden') + '</span>'
    : p.status === 'aangevraagd' ? '<span class="zak-chip">' + T('zak.wacht','Aangevraagd') + '</span>'
    : p.status === 'wacht-op-u' ? '<span class="zak-chip mijn">' + T('zak.wachtu','Accepteer in Contacten') + '</span>'
    : '<button class="go js-zcon s-xu75cl" data-key="' + escT(p.key) + '">+ ' + T('zak.verbind','Verbind') + '</button>';

  function zakProfielKaart(p){
    const skills = (p.vaardigheden || []).map(v =>
      '<span class="zak-chip' + (p.status === 'verbonden' ? ' klik js-zaanb' : '') + (v.doorMij ? ' mijn' : '') + '"' +
      ' data-key="' + escT(p.key) + '" data-v="' + escT(v.naam) + '">' + escT(v.naam) + (v.aanbevolen ? ' · ' + v.aanbevolen + ' ' : '') + '</span>').join('');
    return '<div class="zak-kaart">' +
      '<div style="display:flex;align-items:center;gap:0.6rem;">' +
        '<div class="grow-min"><b>' + escT(p.naam) + '</b>' +
        (p.pas ? ' <span class="s-1gwpioo">' + (TIER_LABEL[p.pas] || p.pas) + '</span>' : '') +
        (p.openVoorWerk ? ' <span class="zak-open">' + T('zak.open','open voor werk') + '</span>' : '') +
        '<div class="s-1ax41pp">' + escT(p.kop) +
        (p.sector ? ' · ' + escT(p.sector) : '') + (p.plaats ? ' · ' + escT(p.plaats) : '') + '</div>' +
        '<div class="s-1epvdch">' + T('zak.codenaam','codenaam') + ' ' + escT(p.codenaam) +
        (p.gedeeld ? ' · ' + p.gedeeld + ' ' + T('zak.gedeeld','gedeelde connectie(s)') + (p.gedeeldNamen && p.gedeeldNamen.length ? ' (' + p.gedeeldNamen.map(escT).join(', ') + ')' : '') : '') + '</div></div>' +
        zakStatusKnop(p) + '</div>' +
      (p.bio ? '<div class="s-1i1ycbi">' + escT(p.bio) + '</div>' : '') +
      ((p.ervaring || []).length ? '<div class="s-lmgu0k">' + p.ervaring.map(escT).join('<br>') + '</div>' : '') +
      (skills ? '<div class="h-mt35">' + skills +
        (p.status === 'verbonden' ? '<div class="s-1r077af">' + T('zak.tikskill','Tik een vaardigheid aan om hem aan te bevelen.') + '</div>' : '') + '</div>' : '') +
      '</div>';
  }

  async function zakRender(){
    const body = $('#zakBody');
