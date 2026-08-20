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
    let ov = document.getElementById('dp-pick'); if (ov) ov.remove();
    ov = document.createElement('div'); ov.id = 'dp-pick';
    ov.style.cssText = 'position:fixed;inset:0;z-index:130;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    ov.innerHTML = '<div style="width:100%;max-width:460px;max-height:80vh;overflow-y:auto;background:var(--bg);border-radius:0;border:1px solid var(--line);padding:1.1rem 1.2rem 1.4rem;">' +
      '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.8rem;"><b style="font-size:1rem;">' + T('dp.kiespartner','Aan welke partner?') + '</b><button id="dpPickX" style="margin-left:auto;background:none;border:none;color:var(--muted);font-size:1.1rem;cursor:pointer;">✕</button></div>' +
      lijst.map(s => '<button class="js-dppick" data-code="' + s.code + '" style="display:flex;align-items:center;gap:0.6rem;width:100%;text-align:left;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.6rem 0.8rem;margin-bottom:0.4rem;color:var(--txt);font-family:inherit;cursor:pointer;"><span style="font-size:1.1rem;">' + (s.icon || RTGGlyf.svgHTML('gebouw')) + '</span><span><b style="font-size:0.86rem;">' + escT(s.name) + '</b><span style="display:block;font-size:0.68rem;color:var(--soft);">' + escT(s.typeLabel || '') + (s.city ? ' · ' + escT(s.city) : '') + '</span></span></button>').join('') +
      '</div>';
    ov.querySelector('#dpPickX').addEventListener('click', () => ov.remove());
