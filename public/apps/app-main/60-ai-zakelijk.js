  /* ---------- AI ---------- */

  const chatHistory = [];

  function aiOpener(){
    const first = user.full.split(' ')[0];
    const lines = [ (lang()==='en'
      ? ('Good day' + (user.tier === 'business' ? '.' : ', ' + first + '.') + ' Your journey to ' + trip.dest + ' begins in ' + trip.days + ' days. I have already thought ahead:')
      : ('Goedendag' + (user.tier === 'business' ? '.' : ', ' + first + '.') + ' Uw reis naar ' + trip.dest + ' begint over ' + trip.days + ' dagen. Ik heb alvast vooruitgedacht:')) ];
    const open = invoices.filter(i => i.status === 'open');
    if (open.length){
      const sum = open.reduce((s,i) => s + i.netto + i.bijdrage, 0);
      lines.push(lang()==='en'
        ? ('• There ' + (open.length === 1 ? 'is 1 payment' : 'are ' + open.length + ' payments') + ' still open (' + eur(sum) + '). One tap in Payments and it is done.')
        : ('• Er ' + (open.length === 1 ? 'staat nog 1 betaling' : 'staan nog ' + open.length + ' betalingen') + ' open (' + eur(sum) + '). Eén tik in Betalen en het is geregeld.'));
    }
    const pending = trip.items.find(i => i.status === 'req');
    if (pending) lines.push(lang()==='en'
      ? ('• ' + pending.title.replace('Diner, ', 'Your table at ') + ' is still being requested; I am watching for the confirmation.')
      : ('• ' + pending.title.replace('Diner, ', 'Uw tafel bij ') + ' is nog in aanvraag; ik bewaak de bevestiging.'));
    lines.push(T('ai.opener.plan','• Zal ik vast een paklijst en een dagplan voor 14 oktober klaarzetten? Eén "ja" is genoeg.'));
    return lines.join('\n');
  }

  function aiAnswer(q){
    const l = q.toLowerCase().trim();
    if (/^(ja|graag|ja graag|doe maar|prima|goed|regel het|ja, regel het|yes|please|go ahead|sure|arrange it)\b/.test(l))
      return T('ai.a.yes','Geregeld. De paklijst staat klaar (lichte kleding, zwemkleding, zonnebrand, lichte trui voor de avond) en het dagplan voor 20 juli is ingepland: 10:00 boot naar Formentera, lunch aan boord, 21:00 tafel bij Sal de Mar.\n\nIk bewaak nu de bevestiging van Sal de Mar. U hoeft niets te doen.');
    if (l.includes('inpak') || l.includes('paklijst') || l.includes('pack'))
      return T('ai.a.pack','Voor Ibiza in juli (25-31°C, zonnig):\n• Lichte kleding + zwemkleding\n• Zonnebrand en een hoed\n• Nette outfit voor Sal de Mar\n• Lichte trui voor de avond\n\nZal ik er een afvinklijst van maken?');
    if (l.includes('visum') || l.includes('paspoort') || l.includes('visa') || l.includes('passport'))
      return T('ai.a.visa','Voor Ibiza (Spanje, EU) heeft u geen visum nodig; een geldige ID-kaart of paspoort volstaat. Ik zet uw boekingsbevestigingen klaar in de app.');
    if (l.includes('weer') || l.includes('weather'))
      return T('ai.a.weather','Ibiza medio juli: 25-31°C, veel zon en warme avonden. Zal ik de boot naar Formentera vroeg in de ochtend laten aanhouden?');
    if (l.includes('plan') || l.includes('dag') || l.includes('day'))
      return T('ai.a.plan','Voorstel voor 20 juli:\n• 10:00 boot naar Formentera\n• 13:00 lunch aan boord\n• 18:00 borrel bij Sunset Ibiza\n• 21:00 diner bij Sal de Mar\n\nZal ik de strandlunch reserveren?');
    if (l.includes('restaurant') || l.includes('diner') || l.includes('eten') || l.includes('dinner') || l.includes('eat'))
      return T('ai.a.rest','Uw tafel bij Sal de Mar (19 jul, 21:00) is in aanvraag, bevestiging volgt doorgaans binnen 48 uur. Wilt u een reservelijst? Ik denk aan een strandrestaurant in Cala Jondal.');
    return T('ai.a.default','Daar kom ik vandaag nog op terug. Ik kan alvast helpen met de paklijst, documenten, het weer of een dagplan, zeg het maar.');
  }

  function bubble(text, who){
    const el = document.createElement('div');
    el.className = 'bubble ' + who;
    el.textContent = text;
    $('#chat').appendChild(el);
    $('#content').scrollTop = $('#content').scrollHeight;
    return el;
  }

  const escHtml = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

  // een voorstel van de Butler ("even checken...") krijgt echte knoppen
  function voorstelChips(aan){
    const box = $('#chips'); if (!box) return;
    if (aan){
      box.dataset.voorstel = '1';
      box.innerHTML = '<button class="chip" id="flJa">✓ ' + T('fl.ja','Ja, doe maar') + '</button>' +
        '<button class="chip" id="flNee">✕ ' + T('fl.nee','Nee, laat maar') + '</button>';
      $('#flJa').addEventListener('click', () => ask('ja'));
      $('#flNee').addEventListener('click', () => ask('nee'));
      return;
    }
    if (!box.dataset.voorstel) return;
    delete box.dataset.voorstel;
    if (user.account && user.tier !== 'guest'){
      box.innerHTML = '<button class="chip" id="aiBetaalChip">' + FID_MINI + T('dp.aichip','Betaal een partner') + '</button>';
      const bc = $('#aiBetaalChip'); if (bc) bc.addEventListener('click', () => kiesPartnerEnBetaal('ai'));
    } else standaardChips();
  }

  async function ask(qIn){
    const q = String(qIn || '').trim();
    if (!q) return;
    // eerst de Butler-motor: geheugen, seintjes, zoeken en echt regelen
    // (reserveren, het 24-uursblok, een Tik, betaalverzoeken); pakt hij de
    // vraag niet, dan neemt de gewone gesprekslaag het over
    if (API.live){
      let r = null;
      try { r = await API.call('/fluister', { q }); } catch(e){}
      if (r && r.pakte){
        bubble(q, 'user');
        bubble(r.antwoord, 'ai');
        if (!user.account){ chatHistory.push({role:'user', content:q}); chatHistory.push({role:'assistant', content:r.antwoord}); }
        if (r.gedaan) toast('🤵 ' + T('fl.gedaan','Rahul heeft het geregeld.'));
        voorstelChips(!!r.voorstel);
        if (typeof renderFluister === 'function') renderFluister();
        $('#content').scrollTop = $('#content').scrollHeight;
        return;
      }
    }
    if (user.account){ chatSend(q); return; }   // echte accounts: gekoppeld gesprek
    bubble(q, 'user');
    chatHistory.push({role:'user', content:q});
    if (API.live){
      const pending = bubble('…', 'ai');
      API.call('/ai', {messages: chatHistory})
        .then(d => { pending.textContent = d.reply; chatHistory.push({role:'assistant', content:d.reply}); })
        .catch(() => { const r = aiAnswer(q); pending.textContent = r; chatHistory.push({role:'assistant', content:r}); })
        .finally(() => { $('#content').scrollTop = $('#content').scrollHeight; });
    } else {
      setTimeout(() => { const r = aiAnswer(q); bubble(r, 'ai'); chatHistory.push({role:'assistant', content:r}); }, 500);
    }
  }

  /* ---------- doorlopend gesprek in de app voor echte accounts ---------- */
  function renderChatMsgs(msgs, concierge){
    const chat = $('#chat');
    if (!msgs.length){
      chat.innerHTML = '';
      bubble(concierge ? T('chat.concierge.hi','Goedendag. Schrijf ons hier in de app; uw concierge helpt u persoonlijk.') : aiOpener(), 'ai');
      return;
    }
    // Met Util.el: de berichttekst (van de gast of de concierge) gaat structureel
    // als tekstknoop, dus altijd veilig ge-escaped, geen escHtml-discipline nodig.
    const E = Util.el;
    const bubbels = msgs.map(m => E('div', { class: 'bubble ' + (m.from === 'member' ? 'user' : 'ai') },
      null,
      m.text));
    const last = msgs[msgs.length - 1];
    if (concierge && last && last.from === 'member'){
      bubbels.push(E('div', { class: 'bubble ai pending' }, T('chat.concierge.pending', 'Uw concierge is ingelicht en reageert zo.')));
    }
    Util.vervang(chat, bubbels);
    $('#content').scrollTop = $('#content').scrollHeight;
  }
  async function renderChat(){
    const concierge = user.tier !== 'rtg';
    $('#aiTitle').textContent = concierge ? T('chat.concierge.title','Uw concierge.') : T('ai.title.rtg','Rahul.');
    const deck = document.querySelector('.view[data-view="ai"] .sub');
    if (deck) deck.textContent = concierge
      ? T('chat.concierge.deck','Uw persoonlijke concierge, in uw beveiligde app-lijn. Eén doorlopend gesprek.')
      : T('chat.butler.deck','Rahul, in uw beveiligde app-lijn. Eén doorlopend gesprek.');
    // Vaste snelactie: alles regelen én afrekenen kan hier. Face ID, direct naar de partner.
    if (user.tier !== 'guest'){
      $('#chips').innerHTML = '<button class="chip" id="aiBetaalChip">' + FID_MINI + T('dp.aichip','Betaal een partner') + '</button>';
      const bc = $('#aiBetaalChip'); if (bc) bc.addEventListener('click', () => kiesPartnerEnBetaal('ai'));
    } else { $('#chips').innerHTML = ''; }
    if (!API.live){ $('#chat').innerHTML = ''; bubble(aiOpener(), 'ai'); return; }
    try { const d = await API.call('/chat/history'); renderChatMsgs(d.messages, concierge); }
    catch (e) { $('#chat').innerHTML = ''; bubble(aiOpener(), 'ai'); }
  }
  // Kies een partner en reken direct met Face ID af (vanuit de AI/concierge).
  function kiesPartnerEnBetaal(bron){
    const lijst = (suppliers || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (!lijst.length){ toast(T('dp.geenpartner','Nog geen partners om aan te betalen.')); return; }
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
  // spreek uw vraag in: de gedeelde spraakmotor luistert, De Butler doet de rest
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
        const d = await API.call('/zakelijk/feed');
        body.innerHTML =
          '<div class="zak-kaart"><textarea id="zakPostTekst" placeholder="' + T('zak.postph','Deel een inzicht, vraag of mijlpaal met het netwerk…') + '" style="width:100%;min-height:64px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.6rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.8rem;"></textarea>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.45rem;">' +
          '<span style="font-size:0.62rem;color:var(--soft);">' + (d.mijnProfiel ? T('zak.alsprof','U post onder uw professionele naam.') : T('zak.eerstprof','Maak eerst uw profiel aan (tab Mijn profiel).')) + '</span>' +
          '<button class="go" id="zakPost" style="padding:0.35rem 0.9rem;font-size:0.7rem;">' + T('zak.plaats','Plaats') + '</button></div></div>' +
          (d.posts.length ? d.posts.map(x =>
            '<div class="zak-kaart"><div style="display:flex;gap:0.5rem;align-items:baseline;"><b style="font-size:0.82rem;">' + escT(x.naam) + '</b>' +
            '<span style="font-size:0.64rem;color:var(--soft);">' + escT(x.kop) + ' · ' + timeAgo(x.at) + '</span>' +
            (x.openVoorWerk ? '<span class="zak-open">' + T('zak.open','open voor werk') + '</span>' : '') + '</div>' +
            '<div style="font-size:0.8rem;line-height:1.55;margin-top:0.35rem;white-space:pre-wrap;">' + msgHTML(x.tekst, x.lang) + '</div>' +
            '<div style="display:flex;gap:0.9rem;margin-top:0.5rem;font-size:0.7rem;color:var(--muted);">' +
            '<button class="js-zlike" data-id="' + x.id + '" style="background:none;border:none;color:' + (x.mijnLike ? 'var(--gold)' : 'var(--muted)') + ';font-family:inherit;cursor:pointer;">👍 ' + x.likes + '</button>' +
            '<span>💬 ' + x.reactiesTotaal + '</span></div>' +
            x.reacties.map(r => '<div style="font-size:0.72rem;margin-top:0.35rem;color:var(--muted);"><b style="color:var(--txt);">' + escT(r.naam) + '</b> ' + msgHTML(r.tekst, r.lang) + '</div>').join('') +
            '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input class="js-zretxt" data-id="' + x.id + '" placeholder="' + T('zak.reageer','Reageer…') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:0.4rem 0.75rem;color:var(--txt);font-family:inherit;font-size:0.72rem;">' +
            '<button class="js-zre" data-id="' + x.id + '" style="background:none;border:1px solid var(--line);border-radius:999px;padding:0.4rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.68rem;cursor:pointer;">↩</button></div></div>').join('')
          : '<div class="zak-kaart" style="color:var(--soft);font-size:0.78rem;">' + T('zak.leeg','Nog geen posts. Wees de eerste: deel waar u aan werkt.') + '</div>');
        $('#zakPost').addEventListener('click', async () => {
          try { await API.call('/zakelijk/post', { tekst: $('#zakPostTekst').value }); zakRender(); }
          catch(e){ if (e.status === 409){ zakView = 'profiel'; document.querySelectorAll('.zak-tab').forEach(x => x.classList.toggle('active', x.dataset.zaktab === 'profiel')); zakRender(); } toast(e.message); }
        });
        body.querySelectorAll('.js-zlike').forEach(b => b.addEventListener('click', async () => {
          try { await API.call('/zakelijk/like', { id: b.dataset.id }); zakRender(); } catch(e){ toast(e.message); }
        }));
        body.querySelectorAll('.js-zre').forEach(b => b.addEventListener('click', async () => {
          const inp = body.querySelector('.js-zretxt[data-id="' + b.dataset.id + '"]');
          try { await API.call('/zakelijk/reactie', { id: b.dataset.id, tekst: inp.value }); zakRender(); } catch(e){ toast(e.message); }
        }));
        hydrateMsgs(body); // zakelijke feed leest per kijker in de eigen taal
      } else if (zakView === 'netwerk'){
        const zoek = async (q) => {
          const d = await API.call('/zakelijk/gids', { q, openVoorWerk: $('#zakFilterWerk') ? $('#zakFilterWerk').checked : false });
          $('#zakGids').innerHTML = d.resultaten.length ? d.resultaten.map(zakProfielKaart).join('')
            : '<div class="zak-kaart" style="color:var(--soft);font-size:0.78rem;">' + T('zak.geen','Geen profielen gevonden. Leden verschijnen hier zodra ze hun zakelijke profiel aanzetten.') + '</div>';
          $('#zakGids').querySelectorAll('.js-zcon').forEach(b => b.addEventListener('click', async () => {
            try { const r = await API.call('/zakelijk/connect', { key: b.dataset.key }); toast(r.status === 'aangevraagd' ? T('zak.gevraagd','Verzoek gestuurd. De ander accepteert in Contacten.') : r.status); zoek($('#zakZoek').value); }
            catch(e){ toast(e.message); }
          }));
          $('#zakGids').querySelectorAll('.js-zaanb').forEach(ch => ch.addEventListener('click', async () => {
            try { const r = await API.call('/zakelijk/aanbevelen', { key: ch.dataset.key, vaardigheid: ch.dataset.v });
              toast(r.aanbevolen ? T('zak.aanbevolen','Aanbevolen') + ': ' + ch.dataset.v : T('zak.ingetrokken','Aanbeveling ingetrokken.')); zoek($('#zakZoek').value); }
            catch(e){ toast(e.message); }
          }));
        };
        body.innerHTML = '<div style="display:flex;gap:0.4rem;margin-top:0.6rem;">' +
          '<input id="zakZoek" placeholder="' + T('zak.zoekph','Zoek op naam, sector of vaardigheid…') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:0.5rem 0.85rem;color:var(--txt);font-family:inherit;font-size:0.76rem;">' +
          '<button class="go" id="zakZoekGo" style="padding:0.35rem 0.9rem;font-size:0.7rem;">' + T('zak.zoek','Zoek') + '</button></div>' +
          '<label style="display:flex;align-items:center;gap:0.4rem;font-size:0.7rem;color:var(--muted);margin-top:0.5rem;"><input type="checkbox" id="zakFilterWerk"> ' + T('zak.filterwerk','Alleen leden die open voor werk zijn') + '</label>' +
          '<div id="zakGids"></div>';
        $('#zakZoekGo').addEventListener('click', () => zoek($('#zakZoek').value));
        $('#zakZoek').addEventListener('keydown', e => { if (e.key === 'Enter') zoek(e.target.value); });
        $('#zakFilterWerk').addEventListener('change', () => zoek($('#zakZoek').value));
        zoek('');
      } else if (zakView === 'kansen'){
        const SOORT_ICO = { opdracht:'🛠️', samenwerking:'🤝', vacature:'📋', investering:'💶', anders:'✨' };
        const laad = async () => {
          const d = await API.call('/zakelijk/kansen', { q: $('#kansZoek').value, soort: $('#kansSoortF').value || undefined });
          const kaart = (k) => '<div class="zak-kaart">' +
            '<div style="display:flex;gap:0.5rem;align-items:baseline;"><span>' + (SOORT_ICO[k.soort] || k.icon || '✨') + '</span>' +
            '<div class="grow-min"><b style="font-size:0.84rem;">' + escT(k.titel) + '</b>' +
            (!k.open ? ' <span class="zak-chip">' + T('zak.k.dicht','vervuld') + '</span>' : '') +
            '<div style="font-size:0.66rem;color:var(--soft);">' +
            (k.bron === 'partner' ? T('zak.k.partner','Vacature bij RTG-partner') : escT(k.naam) + (k.kop ? ' · ' + escT(k.kop) : '')) +
            (k.plaats ? ' · ' + escT(k.plaats) : '') + (k.land ? ' · ' + escT(k.land) : '') + ' · ' + timeAgo(k.at) + '</div></div></div>' +
            (k.omschrijving ? '<div style="font-size:0.76rem;color:var(--muted);line-height:1.5;margin-top:0.35rem;">' + escT(k.omschrijving) + '</div>' : '') +
            ((k.skills || []).length ? '<div style="margin-top:0.3rem;">' + k.skills.map(s => '<span class="zak-chip">' + escT(s) + '</span>').join('') + '</div>' : '') +
            (k.bron === 'partner'
              ? '<div style="font-size:0.64rem;color:var(--soft);margin-top:0.45rem;">' + T('zak.k.sollhint','Solliciteren gaat met uw RTG-cv via Werk & vacatures op het thuisscherm.') + '</div>'
              : (k.vanMij
                ? ((k.reacties || []).map(r => '<div style="font-size:0.72rem;margin-top:0.35rem;color:var(--muted);"><b style="color:var(--txt);">' + escT(r.naam) + '</b> <span style="color:var(--soft);">(' + escT(r.kop || '') + ')</span> ' + escT(r.tekst) + '</div>').join('') +
                  (k.open ? '<button class="js-ksluit" data-id="' + k.id + '" style="margin-top:0.5rem;background:none;border:1px solid var(--line);border-radius:999px;padding:0.35rem 0.8rem;color:var(--muted);font-family:inherit;font-size:0.66rem;cursor:pointer;">✓ ' + T('zak.k.sluit','Markeer als vervuld') + '</button>' : ''))
                : (k.open
                  ? '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input class="js-kretxt" data-id="' + k.id + '" placeholder="' + T('zak.k.reageerph','Reageer met wat u kunt betekenen…') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:0.4rem 0.75rem;color:var(--txt);font-family:inherit;font-size:0.72rem;">' +
                    '<button class="js-kre" data-id="' + k.id + '" style="background:none;border:1px solid var(--line);border-radius:999px;padding:0.4rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.68rem;cursor:pointer;">↩</button></div>' +
                    (k.reactiesTotaal ? '<div style="font-size:0.62rem;color:var(--soft);margin-top:0.3rem;">' + k.reactiesTotaal + ' ' + T('zak.k.reacties','reactie(s)') + '</div>' : '')
                  : ''))) +
            '</div>';
          const alle = (d.kansen || []).concat(d.partnerVacatures || []);
          $('#kansLijst').innerHTML = alle.length ? alle.map(kaart).join('')
            : '<div class="zak-kaart" style="color:var(--soft);font-size:0.78rem;">' + T('zak.k.leeg','Nog geen kansen. Plaats de eerste: een opdracht, samenwerking of investeringsvraag.') + '</div>';
          $('#kansLijst').querySelectorAll('.js-kre').forEach(b => b.addEventListener('click', async () => {
            const inp = $('#kansLijst').querySelector('.js-kretxt[data-id="' + b.dataset.id + '"]');
            try { await API.call('/zakelijk/kans/reageer', { id: b.dataset.id, tekst: inp.value }); toast(T('zak.k.gereageerd','Reactie geplaatst; de plaatser ziet hem direct.')); laad(); }
            catch(e){ toast(e.message); }
          }));
          $('#kansLijst').querySelectorAll('.js-ksluit').forEach(b => b.addEventListener('click', async () => {
            try { await API.call('/zakelijk/kans/sluit', { id: b.dataset.id }); laad(); } catch(e){ toast(e.message); }
          }));
        };
        const opt = (v, l) => '<option value="' + v + '">' + l + '</option>';
        body.innerHTML =
          '<div class="zak-kaart"><b style="font-size:0.8rem;">' + T('zak.k.nieuw','Plaats een kans') + '</b>' +
          '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;">' +
          '<select id="kansSoort" aria-label="' + T('zak.k.soort','Soort kans') + '" style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.5rem;color:var(--txt);font-family:inherit;font-size:0.74rem;">' +
          opt('opdracht','🛠️ ' + T('zak.k.opdracht','Opdracht')) + opt('samenwerking','🤝 ' + T('zak.k.samen','Samenwerking')) +
          opt('vacature','📋 ' + T('zak.k.vac','Vacature')) + opt('investering','💶 ' + T('zak.k.inv','Investering')) + opt('anders','✨ ' + T('zak.k.anders','Anders')) + '</select>' +
          '<input id="kansTitel" placeholder="' + T('zak.k.titelph','Titel, bijv. Fotograaf gezocht voor merkcampagne') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.6rem;color:var(--txt);font-family:inherit;font-size:0.74rem;"></div>' +
          '<textarea id="kansOms" placeholder="' + T('zak.k.omsph','Omschrijf kort wat u zoekt of biedt…') + '" style="width:100%;min-height:52px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);font-family:inherit;font-size:0.74rem;margin-top:0.4rem;"></textarea>' +
          '<div style="display:flex;gap:0.4rem;margin-top:0.4rem;align-items:center;">' +
          '<input id="kansPlaats" placeholder="' + T('zak.k.plaatsph','Plaats (optioneel)') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.6rem;color:var(--txt);font-family:inherit;font-size:0.74rem;">' +
          '<button class="go" id="kansPlaatsBtn" style="padding:0.4rem 0.95rem;font-size:0.7rem;">' + T('zak.plaats','Plaats') + '</button></div></div>' +
          '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;">' +
          '<input id="kansZoek" placeholder="' + T('zak.k.zoekph','Zoek in kansen en vacatures…') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:0.45rem 0.8rem;color:var(--txt);font-family:inherit;font-size:0.74rem;">' +
          '<select id="kansSoortF" aria-label="' + T('zak.k.filter','Filter op soort') + '" style="background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:0.4rem 0.5rem;color:var(--txt);font-family:inherit;font-size:0.7rem;">' +
          '<option value="">' + T('zak.k.alles','Alles') + '</option>' +
          opt('opdracht',T('zak.k.opdracht','Opdracht')) + opt('samenwerking',T('zak.k.samen','Samenwerking')) +
          opt('vacature',T('zak.k.vac','Vacature')) + opt('investering',T('zak.k.inv','Investering')) + '</select></div>' +
          '<div id="kansLijst"></div>';
        $('#kansPlaatsBtn').addEventListener('click', async () => {
          try {
            await API.call('/zakelijk/kans', { soort: $('#kansSoort').value, titel: $('#kansTitel').value,
              omschrijving: $('#kansOms').value, plaats: $('#kansPlaats').value });
            $('#kansTitel').value = ''; $('#kansOms').value = ''; toast(T('zak.k.geplaatst','Kans geplaatst.')); laad();
          } catch(e){
            if (e.status === 409){ zakView = 'profiel'; document.querySelectorAll('.zak-tab').forEach(x => x.classList.toggle('active', x.dataset.zaktab === 'profiel')); zakRender(); }
            toast(e.message);
          }
        });
        $('#kansZoek').addEventListener('keydown', e => { if (e.key === 'Enter') laad(); });
        $('#kansSoortF').addEventListener('change', laad);
        laad();
      } else {
        const d = await API.call('/zakelijk/profiel');
        const p = d.profiel || {};
        const veld = (label, id, val, ph) => '<div class="field"><label>' + label + '</label><input id="' + id + '" value="' + escT(val || '') + '"' + (ph ? ' placeholder="' + ph + '"' : '') + '></div>';
        body.innerHTML =
          '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.6rem;line-height:1.5;">' + T('zak.uitleg','Uw profiel is pas zichtbaar in de gids als u het bewaart. U kiest zelf welke naam u zakelijk gebruikt.') + '</div>' +
          (d.cvSuggestie ? '<button id="zakUitCv" class="zak-chip klik" style="margin-top:0.5rem;">📄 ' + T('zak.uitcv','Vul aan vanuit mijn RTG-cv') + '</button>' : '') +
          veld(T('zak.naam','Professionele naam'), 'zakNaam', p.naam, T('zak.naamph','Standaard: uw codenaam')) +
          veld(T('zak.kop','Kop'), 'zakKop', p.kop, T('zak.kopph','Bijv. Oprichter, Fotograaf, Jurist')) +
          veld(T('zak.sector','Sector'), 'zakSector', p.sector) +
          veld(T('zak.plaats2','Plaats'), 'zakPlaats', p.plaats) +
          '<div class="field"><label>' + T('zak.bio','Over u') + '</label><textarea id="zakBio" style="min-height:70px;">' + escT(p.bio || '') + '</textarea></div>' +
          veld(T('zak.skills','Vaardigheden (komma’s)'), 'zakSkills', (p.vaardigheden || []).map(v => v.naam).join(', ')) +
          '<div class="field"><label>' + T('zak.erv','Ervaring (een regel per rol)') + '</label><textarea id="zakErv" style="min-height:80px;">' + escT((p.ervaring || []).join('\n')) + '</textarea></div>' +
          '<label style="display:flex;align-items:center;gap:0.4rem;font-size:0.76rem;margin-top:0.4rem;"><input type="checkbox" id="zakOpenWerk"' + (p.openVoorWerk ? ' checked' : '') + '> ' + T('zak.openwerk','Open voor werk of opdrachten') + '</label>' +
          '<label style="display:flex;align-items:center;gap:0.4rem;font-size:0.76rem;margin-top:0.3rem;"><input type="checkbox" id="zakZicht"' + (d.zichtbaar !== false ? ' checked' : '') + '> ' + T('zak.zicht','Zichtbaar in de gids') + '</label>' +
          '<button class="ms-order" id="zakBewaar" style="margin-top:0.8rem;width:100%;">' + T('zak.bewaar','Bewaar mijn profiel') + '</button>';
        if (d.cvSuggestie) $('#zakUitCv').addEventListener('click', () => {
          const s = d.cvSuggestie;
          if (!$('#zakKop').value && s.kop) $('#zakKop').value = s.kop;
          if (!$('#zakSkills').value && s.vaardigheden.length) $('#zakSkills').value = s.vaardigheden.join(', ');
          if (!$('#zakErv').value && s.ervaring.length) $('#zakErv').value = s.ervaring.join('\n');
          if (!$('#zakBio').value && s.bio) $('#zakBio').value = s.bio;
          toast(T('zak.cvok','Aangevuld vanuit uw cv. Controleer en bewaar.'));
        });
        $('#zakBewaar').addEventListener('click', async () => {
          try {
            await API.call('/zakelijk/profiel/zet', {
              naam: $('#zakNaam').value, kop: $('#zakKop').value, sector: $('#zakSector').value,
              plaats: $('#zakPlaats').value, bio: $('#zakBio').value,
              vaardigheden: $('#zakSkills').value.split(',').map(s => s.trim()).filter(Boolean),
              ervaring: $('#zakErv').value.split('\n').map(s => s.trim()).filter(Boolean),
              openVoorWerk: $('#zakOpenWerk').checked, zichtbaar: $('#zakZicht').checked
            });
            toast(T('zak.bewaard','Profiel bewaard.'));
          } catch(e){ toast(e.message); }
        });
      }
    } catch(e){
      body.innerHTML = '<div class="zak-kaart" style="color:var(--soft);font-size:0.78rem;">' + escT(e.message) + '</div>';
    }
  }

  /* ---------- interactieve AI-agenda in de backoffice + ballon op boBtn ---------- */
  let memberAgenda = null;
  function agendaBadgeLid(n){
    const btn = document.getElementById('boBtn'); if (!btn) return;
    btn.style.position = 'relative';
    let b = btn.querySelector('.ag-ballon');
    if (n > 0){
      if (!b){ b = document.createElement('span'); b.className = 'ag-ballon'; b.setAttribute('aria-label', T('ag.badge','afspraken op de agenda')); btn.appendChild(b); }
      b.textContent = n > 9 ? '9+' : String(n);
      b.style.cssText = 'position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#E0736A;color:#fff;font-size:10px;font-weight:700;line-height:16px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.4);';
    } else if (b) b.remove();
  }
  async function laadAgendaLid(){ if (!API.live || !API.token) return; try { memberAgenda = await API.call('/agenda/mijn-lijst', {}); } catch(e){ return; } agendaBadgeLid(memberAgenda.telling || 0); }
  function agendaToeLid(r){ if (r && r.items){ memberAgenda = r; agendaBadgeLid(r.telling || 0); } renderAgendaLid(); }
  function renderAgendaLid(){
    const el = document.getElementById('boAgendaCard'); if (!el) return;
    if (!memberAgenda){ el.innerHTML = '<div class="zak-kaart"><b style="font-size:0.8rem;">📅 ' + T('ag.titel','Agenda') + '</b><div class="fineprint">…</div></div>'; laadAgendaLid().then(renderAgendaLid); return; }
    const o = memberAgenda, items = o.items || [];
    const dagLbl = d => { try { return new Date(d+'T12:00:00').toLocaleDateString(lang()==='en'?'en-GB':'nl-NL',{weekday:'short',day:'numeric',month:'short'}); } catch(e){ return d; } };
    const inp = 'style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.55rem;color:var(--txt);font-family:inherit;font-size:0.76rem;"';
    let h = '<div class="zak-kaart"><b style="font-size:0.8rem;">📅 ' + T('ag.titel','Agenda') + (o.telling?' <span style="color:#E0736A;">('+o.telling+')</span>':'') + '</b>';
    h += items.length ? items.map(i => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;font-size:0.78rem;margin-top:0.45rem;opacity:'+(i.gedaan?'0.55':'1')+';"><span>'+(i.gedaan?'✓ ':'')+esc(i.titel)+'<span style="color:var(--muted);"> · '+esc(dagLbl(i.datum))+(i.tijd?' '+esc(i.tijd):'')+'</span></span><span style="white-space:nowrap;">'+(!i.gedaan?'<button class="ag-done" data-agdone="'+i.id+'" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.15rem 0.45rem;color:var(--txt);font-size:0.68rem;cursor:pointer;">✓</button> ':'')+'<button class="ag-del" data-agdel="'+i.id+'" style="background:none;border:none;color:var(--soft);cursor:pointer;">✕</button></span></div>').join('') : '<div class="fineprint" style="margin-top:0.4rem;">'+T('ag.leeg','Nog niets gepland. Typ het of laat de AI het inplannen.')+'</div>';
    h += '<div style="display:flex;gap:0.35rem;margin-top:0.6rem;flex-wrap:wrap;"><input id="agLidTitel" placeholder="'+T('ag.wat','Afspraak')+'" '+inp+' style="flex:1;min-width:7rem;"><input id="agLidDatum" type="date" '+inp+'><input id="agLidTijd" type="time" '+inp+'><button id="agLidAdd" style="background:var(--gold);border:none;border-radius:10px;padding:0.45rem 0.7rem;color:#000;font-weight:700;cursor:pointer;">+</button></div>';
    h += '<div style="margin-top:0.55rem;border-top:1px solid var(--line);padding-top:0.5rem;"><div style="font-size:0.68rem;color:var(--soft);margin-bottom:0.3rem;">✨ '+T('ag.aihint','Of typ het in gewone taal:')+'</div><div id="agLidAiOut"></div><div style="display:flex;gap:0.35rem;margin-top:0.35rem;"><input id="agLidAiIn" placeholder="'+T('ag.aiph','bijv. vergadering morgen om 15u')+'" '+inp+' style="flex:1;"><button id="agLidAiGo" style="background:var(--gold);border:none;border-radius:10px;padding:0.45rem 0.7rem;color:#000;font-weight:700;cursor:pointer;">'+T('ag.plan','Plan')+'</button></div></div>';
    h += '</div>';
    el.innerHTML = h;
    el.querySelectorAll('[data-agdone]').forEach(b => b.addEventListener('click', async () => { try { agendaToeLid(await API.call('/agenda/wijzig', { id: b.dataset.agdone, gedaan: true })); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-agdel]').forEach(b => b.addEventListener('click', async () => { try { agendaToeLid(await API.call('/agenda/verwijder', { id: b.dataset.agdel })); } catch(e){ toast(e.message); } }));
    const add = document.getElementById('agLidAdd'); if (add) add.addEventListener('click', async () => { const titel = document.getElementById('agLidTitel').value.trim(); const datum = document.getElementById('agLidDatum').value; if (!titel||!datum){ toast(T('ag.vulin','Vul een afspraak en datum in.')); return; } try { agendaToeLid(await API.call('/agenda/toevoegen', { titel, datum, tijd: document.getElementById('agLidTijd').value })); } catch(e){ toast(e.message); } });
    const aiGo = document.getElementById('agLidAiGo'); if (aiGo){ const doe = async () => { const opdracht = document.getElementById('agLidAiIn').value.trim(); if (!opdracht) return; const out = document.getElementById('agLidAiOut'); out.innerHTML = '<div class="fineprint">…</div>'; try { const r = await API.call('/agenda/ai', { opdracht }); out.innerHTML = '<div class="fineprint" style="color:'+(r.gedaan?'#7EE0A3':'var(--txt)')+';">'+esc(r.antwoord)+'</div>'; document.getElementById('agLidAiIn').value=''; agendaToeLid(r); } catch(e){ out.innerHTML = '<div class="fineprint" style="color:#E0736A;">'+esc(e.message)+'</div>'; } }; aiGo.addEventListener('click', doe); const i2 = document.getElementById('agLidAiIn'); if (i2) i2.addEventListener('keydown', e => { if (e.key==='Enter') doe(); }); }
  }

  /* ---------- mijn facturen: automatisch bij elke aankoop ---------- */
  let memberFacturen = null;
  async function laadFacturenLid(){ if (!API.live || !API.token) return; try { memberFacturen = await API.call('/facturen/mijn', {}); } catch(e){ return; } renderFacturenLid(); }
  function renderFacturenLid(){
    const el = document.getElementById('boFacturenCard'); if (!el) return;
    if (!memberFacturen){ laadFacturenLid(); return; }
    const o = memberFacturen, items = o.facturen || [];
    const inp = 'style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.55rem;color:var(--txt);font-family:inherit;font-size:0.76rem;"';
    let h = '<div class="zak-kaart"><b style="font-size:0.8rem;">🧾 ' + T('fact.mijn','Mijn facturen') + (o.telling?' <span style="color:var(--gold);">('+o.telling+')</span>':'') + '</b>';
    h += items.length
      ? '<div style="font-size:0.72rem;color:var(--muted);margin:0.3rem 0 0.4rem;">'+T('fact.besteed','Samen besteed')+': '+eur(o.besteed||0)+'</div>' + items.slice(0,30).map(f => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;font-size:0.78rem;margin-top:0.4rem;"><span>'+esc(f.verkoper)+'<span style="color:var(--muted);"> · '+esc(f.datum)+' · '+esc(f.nummer)+'</span></span><span style="white-space:nowrap;"><b>'+eur(f.totaal)+'</b> <button class="fact-pdf" data-fpdf="'+f.id+'" data-nr="'+esc(f.nummer)+'" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.15rem 0.45rem;color:var(--txt);font-size:0.68rem;cursor:pointer;">PDF</button></span></div>').join('')
      : '<div class="fineprint" style="margin-top:0.4rem;">'+T('fact.geenlid','U heeft nog geen facturen. Bij een aankoop op uw codenaam verschijnt hier automatisch de factuur.')+'</div>';
    h += '<div style="margin-top:0.55rem;border-top:1px solid var(--line);padding-top:0.5rem;"><div id="factLidAiOut"></div><div style="display:flex;gap:0.35rem;margin-top:0.35rem;"><input id="factLidAiIn" placeholder="'+T('fact.lidph','Vraag over uw facturen...')+'" '+inp+' style="flex:1;"><button id="factLidAiGo" style="background:var(--gold);border:none;border-radius:10px;padding:0.45rem 0.7rem;color:#000;font-weight:700;cursor:pointer;">'+T('fact.vraag','Vraag')+'</button></div></div>';
    h += '</div>';
    el.innerHTML = h;
    el.querySelectorAll('[data-fpdf]').forEach(b => b.addEventListener('click', () => downloadPdf('/facturen/pdf', { id: b.dataset.fpdf }, (b.dataset.nr||'factuur')+'.pdf')));
    const aiGo = document.getElementById('factLidAiGo'); if (aiGo){ const doe = async () => { const opdracht = document.getElementById('factLidAiIn').value.trim(); if (!opdracht) return; const out = document.getElementById('factLidAiOut'); out.innerHTML = '<div class="fineprint">…</div>'; try { const r = await API.call('/facturen/ai', { opdracht }); out.innerHTML = '<div class="fineprint" style="color:var(--txt);white-space:pre-wrap;">'+esc(r.antwoord)+'</div>'; document.getElementById('factLidAiIn').value=''; if (r.overzicht){ memberFacturen = r.overzicht; } } catch(e){ out.innerHTML = '<div class="fineprint" style="color:#E0736A;">'+esc(e.message)+'</div>'; } }; aiGo.addEventListener('click', doe); const i2 = document.getElementById('factLidAiIn'); if (i2) i2.addEventListener('keydown', e => { if (e.key==='Enter') doe(); }); }
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
    if (open.length) acties.push('💳 ' + open.length + ' ' + T('bo2.open','openstaande factuur/facturen; betaal in één tik via Betalen.'));
    if (user.account && user.emailVerified === false) acties.push('✉️ ' + T('bo2.mailniet','Uw e-mailadres is nog niet bevestigd.'));
    if (user.account && user.verified && user.verified !== 'verified') acties.push('🪪 ' + T('bo2.kyc','Verifieer uw identiteit om in één tik te boeken.'));

    let html = '';
    if (acties.length) html += kaart('⚡ ' + T('bo2.acties','Nu aandacht nodig'),
      acties.map(a => '<div class="fineprint">' + a + '</div>').join('') +
      (open.length ? knopje('boNaarBetalen', T('bo2.betaalnu','Naar Betalen')) : ''));
    else html += kaart('✓ ' + T('bo2.alsklaar','Alles op orde'), '<div style="font-size:0.76rem;color:var(--muted);margin-top:0.4rem;">' + T('bo2.geen','Geen openstaande zaken op uw account.') + '</div>');

    html += kaart('📊 ' + T('bo2.cijfers','Mijn cijfers'),
      rij(T('bo2.betaald','Betaald via RTG'), eur(totaalBetaald)) +
      rij(T('bo2.facturen','Facturen'), betaald.length + ' ' + T('bo2.voldaan','voldaan') + (open.length ? ' · ' + open.length + ' open' : '')) +
      rij('RTFoundation', eur(fonds) + ' ' + T('bo2.viamij','via mijn bijdragen')) +
      (myApps && myApps.length ? rij(T('bo2.sollicitaties','Sollicitaties'), String(myApps.length)) : ''));

    // interactieve AI-agenda
    if (user.tier !== 'guest') html += '<div id="boAgendaCard"></div>';
    // mijn facturen (automatisch bij elke aankoop)
    if (user.tier !== 'guest') html += '<div id="boFacturenCard"></div>';

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

