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

  // een voorstel van Rahul ("even checken...") krijgt echte knoppen
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
    // eerst Rahul-motor: geheugen, seintjes, zoeken en echt regelen
    // (reserveren, het 24-uursblok, een Tik, betaalverzoeken); pakt hij de
    // vraag niet, dan neemt de gewone gesprekslaag het over
    if (API.live){
      let r = null;
      try { r = await API.call('/fluister', { q }); } catch(e){}
      if (r && r.pakte){
        bubble(q, 'user');
        bubble(r.antwoord, 'ai');
        if (!user.account){ chatHistory.push({role:'user', content:q}); chatHistory.push({role:'assistant', content:r.antwoord}); }
        if (r.gedaan) toast('' + T('fl.gedaan','Rahul heeft het geregeld.'));
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
      : T('chat.rahul.deck','Rahul, in uw beveiligde app-lijn. Eén doorlopend gesprek.');
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
