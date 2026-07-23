    let ov = document.getElementById('dp-pick'); if (ov) ov.remove();
    ov = document.createElement('div'); ov.id = 'dp-pick';
    ov.style.cssText = 'position:fixed;inset:0;z-index:130;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    ov.innerHTML = '<div style="width:100%;max-width:460px;max-height:80vh;overflow-y:auto;background:var(--bg);border-radius:20px 20px 0 0;border:1px solid var(--line);padding:1.1rem 1.2rem 1.4rem;">' +
      '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.8rem;"><b style="font-size:1rem;">' + T('dp.kiespartner','Aan welke partner?') + '</b><button id="dpPickX" style="margin-left:auto;background:none;border:none;color:var(--muted);font-size:1.1rem;cursor:pointer;">✕</button></div>' +
      lijst.map(s => '<button class="js-dppick" data-code="' + s.code + '" style="display:flex;align-items:center;gap:0.6rem;width:100%;text-align:left;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.8rem;margin-bottom:0.4rem;color:var(--txt);font-family:inherit;cursor:pointer;"><span style="font-size:1.1rem;">' + (s.icon || '🏛️') + '</span><span><b style="font-size:0.86rem;">' + escT(s.name) + '</b><span style="display:block;font-size:0.68rem;color:var(--soft);">' + escT(s.typeLabel || '') + (s.city ? ' · ' + escT(s.city) : '') + '</span></span></button>').join('') +
      '</div>';
    ov.querySelector('#dpPickX').addEventListener('click', () => ov.remove());
    ov.querySelectorAll('.js-dppick').forEach(b => b.addEventListener('click', () => {
      const s = lijst.find(x => x.code === b.dataset.code); ov.remove();
      betaalPartner(s.code, s.name, { bron });
    }));
  }
  async function chatSend(q){
    if (!API.live){ bubble(q, 'user'); setTimeout(() => bubble(aiAnswer(q), 'ai'), 400); return; }
    try { const d = await API.call('/chat/send', { text: q }); renderChatMsgs(d.messages, user.tier !== 'rtg'); }
    catch (e) { toast(e.message || 'Versturen mislukt.'); }
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
    p.status === 'verbonden' ? '<span class="zak-open" style="color:var(--gold);border-color:var(--gold);">✓ ' + T('zak.verbonden','Verbonden') + '</span>'
    : p.status === 'aangevraagd' ? '<span class="zak-chip">' + T('zak.wacht','Aangevraagd') + '</span>'
    : p.status === 'wacht-op-u' ? '<span class="zak-chip mijn">' + T('zak.wachtu','Accepteer in Contacten') + '</span>'
    : '<button class="go js-zcon" data-key="' + escT(p.key) + '" style="padding:0.25rem 0.7rem;font-size:0.68rem;">+ ' + T('zak.verbind','Verbind') + '</button>';

  function zakProfielKaart(p){
    const skills = (p.vaardigheden || []).map(v =>
      '<span class="zak-chip' + (p.status === 'verbonden' ? ' klik js-zaanb' : '') + (v.doorMij ? ' mijn' : '') + '"' +
      ' data-key="' + escT(p.key) + '" data-v="' + escT(v.naam) + '">' + escT(v.naam) + (v.aanbevolen ? ' · ' + v.aanbevolen + ' 👍' : '') + '</span>').join('');
    return '<div class="zak-kaart">' +
      '<div style="display:flex;align-items:center;gap:0.6rem;">' +
        '<div class="grow-min"><b>' + escT(p.naam) + '</b>' +
        (p.pas ? ' <span style="font-size:0.56rem;letter-spacing:0.08em;color:var(--gold);border:1px solid var(--gold);border-radius:999px;padding:0.08rem 0.4rem;vertical-align:middle;">' + (TIER_LABEL[p.pas] || p.pas) + '</span>' : '') +
        (p.openVoorWerk ? ' <span class="zak-open">' + T('zak.open','open voor werk') + '</span>' : '') +
        '<div style="font-size:0.74rem;color:var(--muted);">' + escT(p.kop) +
        (p.sector ? ' · ' + escT(p.sector) : '') + (p.plaats ? ' · ' + escT(p.plaats) : '') + '</div>' +
        '<div style="font-size:0.62rem;color:var(--soft);">' + T('zak.codenaam','codenaam') + ' ' + escT(p.codenaam) +
        (p.gedeeld ? ' · ' + p.gedeeld + ' ' + T('zak.gedeeld','gedeelde connectie(s)') + (p.gedeeldNamen && p.gedeeldNamen.length ? ' (' + p.gedeeldNamen.map(escT).join(', ') + ')' : '') : '') + '</div></div>' +
        zakStatusKnop(p) + '</div>' +
      (p.bio ? '<div style="font-size:0.76rem;color:var(--muted);margin-top:0.45rem;line-height:1.5;">' + escT(p.bio) + '</div>' : '') +
      ((p.ervaring || []).length ? '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.4rem;">' + p.ervaring.map(escT).join('<br>') + '</div>' : '') +
      (skills ? '<div style="margin-top:0.35rem;">' + skills +
        (p.status === 'verbonden' ? '<div style="font-size:0.6rem;color:var(--soft);margin-top:0.25rem;">' + T('zak.tikskill','Tik een vaardigheid aan om hem aan te bevelen.') + '</div>' : '') + '</div>' : '') +
      '</div>';
  }

  async function zakRender(){
    const body = $('#zakBody');
    body.innerHTML = '<div style="color:var(--soft);font-size:0.8rem;padding:1rem 0;">…</div>';
    try {
      if (zakView === 'feed'){
