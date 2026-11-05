/* de aanwezigheidsteller op nul zetten */
    document.getElementById('awLeeg').addEventListener('click', async () => {
      if (!confirm(T('aw.leegvraag','De teller op nul zetten?'))) return;
      try { const d = await API.call('/supplier/aanwezig/leeg', {}); awToon(d.aanwezig); } catch(e){ toast(e.message); }
    });
  }
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-aanwezig]'); if (b) openAanwezig(); });

  /* ---------- Tafelticket: bonnen van dezelfde tafel op EEN ticket ----------
     De bediening/kassa kiest een tafel, ziet alle openstaande bonnen samengevoegd
     (uitsplitsing per gast + totaal) en rekent in EEN keer af. De beveiliging zit
     op de server: het ticket draagt een HMAC-zegel, en bij het afrekenen wordt dat
     zegel vers gecontroleerd -- een gewijzigde of gemanipuleerde rekening ketst af.
     De AI (Rahul) doet ditzelfde via /api/supplier/tafelticket. */
  let ttHuidig = null; // het laatst opgehaalde ticket (met zegel + at)
  function ttRender(container){
    const t = ttHuidig;
    const gasten = Object.entries(t.perGast || {});
    container.innerHTML =
      '<div class="tt-tot s-1ptwtu"><span>' + (t.table || '') + '</span><span>' + t.aantalBonnen + ' ' + T('tt.bonnen','bon(nen)') + ' · ' + t.aantalGasten + ' ' + T('tt.gasten','gast(en)') + '</span></div>' +
      gasten.map(([naam, som]) => '<div class="tt-gast"><span>' + naam + '</span><span class="n">' + eur(som) + '</span></div>').join('') +
      (t.bonnen || []).map(b => '<div class="tt-bon">• ' + b.ref + ' · ' + b.codename + ' · ' + eur(b.total) + '</div>').join('') +
      '<div class="tt-tot"><span>' + T('tt.totaal','Totaal') + '</span><span>' + eur(t.subtotaal) + '</span></div>' +
      '<div class="tt-zegel">' + T('tt.zegel','Gezegeld ticket') + ': ' + String(t.zegel || '').slice(0, 24) + '…</div>' +
      '<button class="tt-btn" id="ttAfreken">' + T('tt.afrekenen','Reken dit ticket in een keer af (contant)') + '</button>';
    const ab = document.getElementById('ttAfreken');
    if (ab) ab.addEventListener('click', ttAfrekenen);
  }
  async function ttOphalen(table){
    try {
      const d = await API.call('/supplier/tafelticket', { table });
      ttHuidig = d.ticket;
      const box = document.getElementById('ttBody');
      if (box) ttRender(box);
    } catch(e){ ttHuidig = null; const box = document.getElementById('ttBody'); if (box) box.innerHTML = '<div class="tt-bon s-1gbkfgg">' + e.message + '</div>'; }
  }
  async function ttAfrekenen(){
    if (!ttHuidig) return;
    if (!confirm(T('tt.bevestig','Alle bonnen aan ') + (ttHuidig.table || '') + T('tt.bevestig2',' in een keer afrekenen (contant)?'))) return;
    try {
      const d = await API.call('/supplier/tafelticket/afrekenen', { table: ttHuidig.table, zegel: ttHuidig.zegel, at: ttHuidig.at, method: 'contant' });
      toast('' + T('tt.klaar','Tafelticket afgerekend: ') + eur(d.subtotaal) + ' (' + d.aantalBonnen + ' ' + T('tt.bonnen','bon(nen)') + ')');
      const ov = document.getElementById('ttOverlay'); if (ov) ov.remove();
    } catch(e){
      // beveiliging: gewijzigde of gemanipuleerde rekening -> vers ophalen
      toast(e.message);
      if (ttHuidig) ttOphalen(ttHuidig.table);
    }
  }
  function openTafelticket(){
    ttHuidig = null;
    const tafels = (typeof state !== 'undefined' && state.tables) ? state.tables : [];
    const oud = document.getElementById('ttOverlay'); if (oud) oud.remove();
    leverancierOverlayPresentatie();
    const ov = document.createElement('div'); ov.className = 'ds-leverancier-overlay tt-ov'; ov.id = 'ttOverlay';
    ov.innerHTML = '<div class="tt-card" role="dialog" aria-modal="true" aria-label="' + T('tt.titel','Tafel op een ticket') + '">' +
      '<div class="tt-kop"><h3>' + T('tt.titel','Tafel op een ticket') + '</h3><button class="tt-sluit" id="ttSluit" aria-label="Sluiten">✕</button></div>' +
      (tafels.length
        ? '<select class="tt-in" id="ttTafel" aria-label="' + T('tt.tafel','Tafel') + '"><option value="">' + T('tt.kies','Kies een tafel…') + '</option>' +
            tafels.map(t => '<option value="' + t.name + '">' + t.name + '</option>').join('') + '</select>'
        : '<input class="tt-in" id="ttTafel" placeholder="' + T('tt.tafelnr','Tafelnummer of -naam') + '">') +
      '<div class="h-mt80" id="ttBody"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    document.getElementById('ttSluit').addEventListener('click', () => ov.remove());
    const inp = document.getElementById('ttTafel');
    const trigger = () => { const v = String(inp.value || '').trim(); if (v) ttOphalen(v); };
    if (inp) { inp.addEventListener('change', trigger); inp.addEventListener('keydown', e => { if (e.key === 'Enter') trigger(); }); }
  }
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-tafelticket]'); if (b) openTafelticket(); });
  // ---- AI-assistent ----
  let aiMsgs = [];
  function renderAIChips(){
    const el = $('#aiChips'); if (!el) return;
    let chips = [T('ai.c1','Dagomzet'), T('ai.c2','Onbeantwoorde berichten')];
    if (has('bookings')) chips.push(T('ai.c3','Welke kamers zijn vuil?'), T('ai.c4','Welke minibars nog tellen?'));
    if (has('orders')) chips.push(T('ai.c5','Open bestellingen'));
    if (has('doors')) chips.push(T('ai.c6','Open de voordeur'));
    chips.push(T('ai.c7','Wie is er onderweg?'), T('ai.c8','Welke klussen staan open?'));
    el.innerHTML = chips.map(c => '<button class="ai-chip">'+c+'</button>').join('');
    el.querySelectorAll('.ai-chip').forEach(b => b.addEventListener('click', () => { $('#aiInput').value = b.textContent; sendAI(); }));
  }
  function renderAIThread(){
    const t = $('#aiThread'); if (!t) return;
    t.innerHTML = aiMsgs.length ? aiMsgs.map(m =>
      '<div class="tt-msg ' + (m.role === 'user' ? 'me' : 'other') + '">' +
      (m.role === 'ai' ? '<span class="who">AI</span>' : '') +
      m.text.replace(/&/g,'&amp;').replace(/</g,'&lt;') +
      (m.did ? '<span class="ai-did">✓ ' + T('ai.did','uitgevoerd') + '</span>' : '') + '</div>'
    ).join('') : '<div class="pcempty s-cfyima">' + T('ai.empty','Uw assistent kent het hele bedrijf: de kassa, de kamers, de klussen, de gasten. Vraag iets of geef een opdracht.') + '</div>';
    t.scrollTop = t.scrollHeight;
  }
  async function sendAI(){
    const inp = $('#aiInput');
    const q = (inp.value || '').trim();
    if (!q) return;
    inp.value = '';
    aiMsgs.push({ role: 'user', text: q });
    aiMsgs.push({ role: 'ai', text: '…' });
