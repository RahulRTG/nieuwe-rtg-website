
  /* ---------- Tafelticket: bonnen van dezelfde tafel op EEN ticket ----------
     De bediening/kassa kiest een tafel, ziet alle openstaande bonnen samengevoegd
     (uitsplitsing per gast + totaal) en rekent in EEN keer af. De beveiliging zit
     op de server: het ticket draagt een HMAC-zegel, en bij het afrekenen wordt dat
     zegel vers gecontroleerd -- een gewijzigde of gemanipuleerde rekening ketst af.
     De AI (Rahul) doet ditzelfde via /api/supplier/tafelticket. */
  function ttStijlEenmalig(){
    if (document.getElementById('rtg-tt-stijl')) return;
    const st = document.createElement('style'); st.id = 'rtg-tt-stijl';
    st.textContent = [
      '.tt-ov{position:fixed;inset:0;z-index:100000;background:rgba(12,12,11,.78);display:flex;align-items:flex-end;justify-content:center;}',
      '.tt-card{width:100%;max-width:480px;background:var(--card,#161615);border-radius:20px 20px 0 0;padding:1.3rem 1.2rem calc(1.3rem + env(safe-area-inset-bottom,0));color:var(--txt,#fff);max-height:84vh;overflow-y:auto;}',
      '.tt-kop{display:flex;align-items:baseline;gap:.6rem;margin-bottom:.6rem;}',
      '.tt-kop h3{font-family:"Bodoni Moda",Georgia,serif;font-weight:500;font-size:1.2rem;margin:0;flex:1;}',
      '.tt-in{width:100%;background:var(--bg,#0C0C0B);border:1px solid var(--line,#2a2a28);border-radius:12px;padding:.6rem .8rem;font-size:.9rem;color:var(--txt,#fff);font-family:inherit;}',
      '.tt-gast{display:flex;justify-content:space-between;gap:.8rem;padding:.5rem .1rem;border-top:1px solid var(--line,#2a2a28);font-size:.92rem;}',
      '.tt-gast .n{font-variant-numeric:tabular-nums;font-weight:600;}',
      '.tt-bon{font-size:.74rem;color:var(--soft,#8A8680);padding:.15rem 0 .15rem .6rem;}',
      '.tt-tot{display:flex;justify-content:space-between;gap:.8rem;padding:.7rem .1rem .2rem;border-top:2px solid var(--line,#2a2a28);font-weight:700;font-size:1.05rem;font-variant-numeric:tabular-nums;}',
      '.tt-zegel{font-size:.62rem;color:var(--soft,#8A8680);letter-spacing:.04em;margin:.5rem 0;word-break:break-all;}',
      '.tt-btn{width:100%;border-radius:12px;padding:.75rem;font-family:inherit;font-weight:600;cursor:pointer;border:none;background:#7F1634;color:#fff;font-size:.9rem;margin-top:.6rem;}',
      '.tt-sluit{width:44px;height:44px;border-radius:12px;border:1px solid var(--line,#3a3a38);background:var(--bg,#0C0C0B);color:var(--txt,#fff);font-size:1.1rem;cursor:pointer;}'
    ].join('');
    document.head.appendChild(st);
  }
  let ttHuidig = null; // het laatst opgehaalde ticket (met zegel + at)
  function ttRender(container){
    const t = ttHuidig;
    const gasten = Object.entries(t.perGast || {});
    container.innerHTML =
      '<div class="tt-tot" style="border-top:none;padding-top:0;"><span>' + (t.table || '') + '</span><span>' + t.aantalBonnen + ' ' + T('tt.bonnen','bon(nen)') + ' · ' + t.aantalGasten + ' ' + T('tt.gasten','gast(en)') + '</span></div>' +
      gasten.map(([naam, som]) => '<div class="tt-gast"><span>' + naam + '</span><span class="n">' + eur(som) + '</span></div>').join('') +
      (t.bonnen || []).map(b => '<div class="tt-bon">• ' + b.ref + ' · ' + b.codename + ' · ' + eur(b.total) + '</div>').join('') +
      '<div class="tt-tot"><span>' + T('tt.totaal','Totaal') + '</span><span>' + eur(t.subtotaal) + '</span></div>' +
      '<div class="tt-zegel">🔒 ' + T('tt.zegel','Gezegeld ticket') + ': ' + String(t.zegel || '').slice(0, 24) + '…</div>' +
      '<button class="tt-btn" id="ttAfreken">🧾 ' + T('tt.afrekenen','Reken dit ticket in een keer af (contant)') + '</button>';
    const ab = document.getElementById('ttAfreken');
    if (ab) ab.addEventListener('click', ttAfrekenen);
  }
  async function ttOphalen(table){
    try {
      const d = await API.call('/supplier/tafelticket', { table });
      ttHuidig = d.ticket;
      const box = document.getElementById('ttBody');
      if (box) ttRender(box);
    } catch(e){ ttHuidig = null; const box = document.getElementById('ttBody'); if (box) box.innerHTML = '<div class="tt-bon" style="padding:.6rem .1rem;">' + e.message + '</div>'; }
  }
  async function ttAfrekenen(){
    if (!ttHuidig) return;
    if (!confirm(T('tt.bevestig','Alle bonnen aan ') + (ttHuidig.table || '') + T('tt.bevestig2',' in een keer afrekenen (contant)?'))) return;
    try {
      const d = await API.call('/supplier/tafelticket/afrekenen', { table: ttHuidig.table, zegel: ttHuidig.zegel, at: ttHuidig.at, method: 'contant' });
      toast('🧾 ' + T('tt.klaar','Tafelticket afgerekend: ') + eur(d.subtotaal) + ' (' + d.aantalBonnen + ' ' + T('tt.bonnen','bon(nen)') + ')');
      const ov = document.getElementById('ttOverlay'); if (ov) ov.remove();
    } catch(e){
      // beveiliging: gewijzigde of gemanipuleerde rekening -> vers ophalen
      toast(e.message);
      if (ttHuidig) ttOphalen(ttHuidig.table);
    }
  }
  function openTafelticket(){
    ttStijlEenmalig();
    ttHuidig = null;
    const tafels = (typeof state !== 'undefined' && state.tables) ? state.tables : [];
    const oud = document.getElementById('ttOverlay'); if (oud) oud.remove();
    const ov = document.createElement('div'); ov.className = 'tt-ov'; ov.id = 'ttOverlay';
    ov.innerHTML = '<div class="tt-card" role="dialog" aria-modal="true" aria-label="' + T('tt.titel','Tafel op een ticket') + '">' +
      '<div class="tt-kop"><h3>🧾 ' + T('tt.titel','Tafel op een ticket') + '</h3><button class="tt-sluit" id="ttSluit" aria-label="Sluiten">✕</button></div>' +
      (tafels.length
        ? '<select class="tt-in" id="ttTafel" aria-label="' + T('tt.tafel','Tafel') + '"><option value="">' + T('tt.kies','Kies een tafel…') + '</option>' +
            tafels.map(t => '<option value="' + t.name + '">' + t.name + '</option>').join('') + '</select>'
        : '<input class="tt-in" id="ttTafel" placeholder="' + T('tt.tafelnr','Tafelnummer of -naam') + '">') +
      '<div id="ttBody" style="margin-top:.8rem;"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    document.getElementById('ttSluit').addEventListener('click', () => ov.remove());
    const inp = document.getElementById('ttTafel');
    const trigger = () => { const v = String(inp.value || '').trim(); if (v) ttOphalen(v); };
    if (inp) { inp.addEventListener('change', trigger); inp.addEventListener('keydown', e => { if (e.key === 'Enter') trigger(); }); }
  }
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-tafelticket]'); if (b) openTafelticket(); });
