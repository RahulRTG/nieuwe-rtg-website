/* de directe berichten openen */
  async function openDm(key, naam){
    dmWith = key; dmNaam = naam;
    $('#dmNaam').textContent = naam;
    $('#dm-sheet').classList.add('open'); $('#dm-scrim').classList.add('open');
    await laadDm();
    loadSocial(); // ongelezen-teller bijwerken
  }
  async function laadDm(){
    if (!dmWith) return;
    try {
      const d = await API.call('/member/dm', { withKey: dmWith });
      $('#dmBody').innerHTML = (d.messages || []).map(m => dmBubbel(m)).join('') ||
        '<div style="font-size:0.78rem;color:var(--soft);text-align:center;margin:auto 0;">' + T('sal.dm.leeg','Nog geen berichten. Zeg hallo.') + '</div>';
      vertaalBubbels($('#dmBody'));
      $('#dmBody').scrollTop = 999999;
    } catch(e){ toast(e.message); }
  }
  // Vertaal binnenkomende berichten naar de gekozen taal van de lezer. Alleen
  // berichten van de ander (.xlate) worden vertaald; eigen berichten niet.
  function vertaalBubbels(root){
    if (!root || !window.Vertaal) return;
    root.querySelectorAll('.xlate:not([data-vt])').forEach(function(el){
      el.setAttribute('data-vt','1');
      Vertaal.vul(el, el.textContent, lang());
    });
  }
  function dmBubbel(m){
    const mijn = m.from === social.me;
    const tijd = new Date(m.at).toLocaleTimeString(lang()==='en'?'en-GB':'nl-NL',{hour:'2-digit',minute:'2-digit'});
    const emo = s => window.RTGEmoji ? RTGEmoji.render(escT(s)) : escT(s);
    const txt = mijn ? emo(m.text) : '<span class="xlate">' + escT(m.text) + '</span>';
    return '<div class="dm-m' + (mijn ? ' mine' : '') + '">' + txt +
      (m.post ? '<div class="dm-post"><b>↗ ' + escT(m.post.author) + ' · ' + escT(m.post.place) + '</b>' + escT(m.post.text) + '…</div>' : '') +
      '<span class="tijd">' + tijd + '</span></div>';
  }
  function dmToevoegen(m){ const b = $('#dmBody'); b.insertAdjacentHTML('beforeend', dmBubbel(m)); vertaalBubbels(b); b.scrollTop = 999999; }
  async function stuurDm(){
    const text = $('#dmInput').value.trim();
    if (!text || !dmWith) return;
