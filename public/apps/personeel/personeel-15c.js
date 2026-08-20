  /* ---- DE WERKVLOER op de PDA: de telefoonkant van de koppellaag ----
     Hier maak je af wat op het bureau begon. Tekenen doe je met je vinger,
     een betaalcode toon je aan de klant, en de checklijsten die met jou
     zijn gedeeld vink je hier af. Geen kopie van het bureau-scherm: dit is
     precies het stuk dat op een telefoon beter gaat. */
  let wvPdaData = null, wvPdaTekent = null, wvPdaPaden = [];

  async function laadWerkvloer(){
    const wrap = $('#wvPda');
    if (!wrap) return;
    try {
      const [k, c, t] = await Promise.all([
        API.call('/werkvloer/koppel', { alleenOpen: false }),
        API.call('/werkvloer/checklijsten', {}),
        API.call('/werkvloer/tafels', {})
      ]);
      wvPdaData = { k, c, t };
      tekenWerkvloer();
    } catch(e){ wrap.innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; }
  }

  function tekenWerkvloer(){
    const wrap = $('#wvPda');
    if (!wrap || !wvPdaData) return;
    const k = wvPdaData.k, c = wvPdaData.c, t = wvPdaData.t;
    const open = k.verzoeken.filter(v => v.status === 'open');
    /* Dezelfde bouwstenen als de rest van de PDA: .card met een .k-kopje,
       .mbrow voor een regel met een knop rechts, .abtn voor de knop zelf.
       Eigen klassen zouden hier als kale blokjes uitkomen. */
    const meta = s => '<div style="font-size:0.72rem;color:var(--soft);line-height:1.45;">' + s + '</div>';
    const leeg = s => '<div style="font-size:0.78rem;color:var(--soft);padding:0.5rem 0;">' + s + '</div>';
    let h = '';

    h += '<div class="card"><div class="k">' + T('pd.wv.open','Van het andere scherm') + ' (' + open.length + ')</div>' +
      (open.length ? open.map(v =>
        '<div class="mbrow"><div><b>' + esc(v.titel) + '</b>' + meta(esc(v.soortLabel) +
          (v.bedrag ? ' · ' + eur(v.bedrag) : '') + (v.ref ? ' · ' + esc(v.ref) : '') +
          ' · ' + T('pd.wv.van','van') + ' ' + esc(v.door)) + '</div>' +
        (v.soort === 'betaal'
          ? '<button class="abtn" data-wvcode="' + esc(v.id) + '">' + T('pd.wv.toon','Toon de code') + '</button>'
          : '<button class="abtn" data-wvteken="' + esc(v.id) + '">' + T('pd.wv.teken','Tekenen') + '</button>') + '</div>'
      ).join('') : leeg(T('pd.wv.niets','Niets klaargezet op het andere scherm.'))) +
      '<div id="wvVak"></div></div>';

    h += '<div class="card"><div class="k">' + T('pd.wv.chk','Mijn checklijsten') + '</div>' +
      (c.lijsten.length ? c.lijsten.map(l =>
        '<div class="h-mt60"><b>' + esc(l.titel) + '</b>' + (l.event ? ' · ' + esc(l.event) : '') +
          meta(l.af + '/' + l.totaal + ' (' + l.pct + '%)') + '</div>' +
        l.items.map(i =>
          '<div class="mbrow"><div>' + (i.klaar ? '✓ ' : '○ ') + esc(i.tekst) +
            (i.klaar ? meta(T('pd.wv.door','door') + ' ' + esc(i.klaar.door)) : '') + '</div>' +
          '<button class="abtn" data-wvv="' + esc(l.id) + '" data-wvi="' + esc(i.id) + '" data-wva="' + (i.klaar ? '0' : '1') + '">' +
            (i.klaar ? T('pd.wv.terug','Terug') : T('pd.wv.af','Af')) + '</button></div>'
        ).join('')
      ).join('') : leeg(T('pd.wv.geenchk','Er is nog geen lijst met je gedeeld.'))) + '</div>';

    h += '<div class="card"><div class="k">' + T('pd.wv.tafels','Tafels: wensen aan tafel invullen') + '</div>' +
      (t.tafels.length ? t.tafels.map(x =>
        '<div class="mbrow"><div><b>' + T('pd.wv.tafel','Tafel') + ' ' + esc(x.tafel) + '</b>' + (x.event ? ' · ' + esc(x.event) : '') +
          meta(x.aantalGasten + ' ' + T('pd.wv.pers','personen') +
          (x.allergenenTotaal ? ' · ' + x.allergenenTotaal + ' ' + T('pd.wv.all','allergieen') : '')) + '</div>' +
        '<button class="abtn" data-wvt="' + esc(x.id) + '">' + T('pd.wv.invul','Invullen') + '</button></div>'
      ).join('') : leeg(T('pd.wv.geentafels','Nog geen tafels op de lijst.'))) +
      '<div id="wvTafelVak"></div></div>';

    wrap.innerHTML = h;
    bindWerkvloer();
  }

  /* Het tekenvlak: een canvas waarop je met je vinger tekent. De paden gaan
     als verhoudingen (0 tot 1) naar de server, dus de handtekening past
     later op elk scherm en op elke afdruk. */
  function tekenvlakOpen(id, titel){
    wvPdaTekent = id; wvPdaPaden = [];
    $('#wvVak').innerHTML = '<div class="h-mt60"><b>' + esc(titel) + '</b>' +
      '<canvas id="wvCanvas" width="600" height="200" style="width:100%;height:120px;border:1px solid var(--line);border-radius:12px;display:block;margin:0.4rem 0;touch-action:none;background:rgba(255,255,255,0.03);"></canvas>' +
      '<div class="row">' +
      '<button class="abtn" id="wvWis">' + T('pd.wv.wis','Wissen') + '</button>' +
      '<button class="abtn" id="wvKlaar" style="border-color:var(--gold);color:var(--rtg-leesgoud,var(--gold));">' + T('pd.wv.zetklaar','Zet mijn handtekening') + '</button></div>' +
      '<div style="font-size:0.72rem;color:var(--soft);margin-top:0.5rem;line-height:1.45;">' +
      T('pd.wv.tekenuit','Uw naam komt automatisch bij de handtekening te staan; het bureau ziet hem meteen.') + '</div></div>';
    const cv = $('#wvCanvas'), ctx = cv.getContext('2d');
    ctx.strokeStyle = '#e8e4dc'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    let pad = null;
    const punt = ev => {
      const r = cv.getBoundingClientRect();
      const p = (ev.touches && ev.touches[0]) || ev;
      return [Math.min(1, Math.max(0, (p.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (p.clientY - r.top) / r.height))];
    };
    const start = ev => { ev.preventDefault(); pad = [punt(ev)]; };
    const gaan = ev => {
      if (!pad) return;
      ev.preventDefault();
      const p = punt(ev); pad.push(p);
      ctx.beginPath();
      const a = pad[pad.length - 2];
      ctx.moveTo(a[0] * cv.width, a[1] * cv.height);
      ctx.lineTo(p[0] * cv.width, p[1] * cv.height);
      ctx.stroke();
    };
    const stop = () => { if (pad && pad.length > 1) wvPdaPaden.push(pad); pad = null; };
    cv.addEventListener('pointerdown', start); cv.addEventListener('pointermove', gaan);
    cv.addEventListener('pointerup', stop); cv.addEventListener('pointerleave', stop);
    $('#wvWis').addEventListener('click', () => { wvPdaPaden = []; ctx.clearRect(0, 0, cv.width, cv.height); });
    $('#wvKlaar').addEventListener('click', async () => {
      try {
        const r = await API.call('/werkvloer/koppel/teken', { id: wvPdaTekent, paden: wvPdaPaden });
        toast(r.gevolg || T('pd.wv.getekend','Getekend.'));
        wvPdaTekent = null; laadWerkvloer();
      } catch(e){ toast(e.message); }
    });
  }

  function bindWerkvloer(){
    document.querySelectorAll('[data-wvteken]').forEach(b => b.addEventListener('click', () => {
      const v = wvPdaData.k.verzoeken.find(x => x.id === b.dataset.wvteken);
      tekenvlakOpen(b.dataset.wvteken, v ? v.titel : '');
    }));
    document.querySelectorAll('[data-wvcode]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/werkvloer/koppel/code', { id: b.dataset.wvcode });
        $('#wvVak').innerHTML = '<div style="margin-top:0.6rem;text-align:center;">' +
          '<div style="font-size:0.8rem;color:var(--muted);">' + esc(d.tonen) + '</div>' +
          '<div id="wvQr" style="display:flex;justify-content:center;margin:0.6rem 0;"></div>' +
          '<b>' + eur(d.bedrag) + '</b></div>';
        /* De RTG-code als beeld: dezelfde tekenaar als de kassa gebruikt.
           Staat die niet klaar, dan tonen we de code als tekst -- de klant
           kan hem dan intypen in zijn eigen app. */
        const vak = $('#wvQr');
        if (window.RTGQRteken && RTGQRteken.tekenRTG) vak.appendChild(RTGQRteken.tekenRTG(d.token, { schaal: 5 }));
        else { vak.style.wordBreak = 'break-all'; vak.textContent = d.token; }
      } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-wvv]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/werkvloer/checklijst/vink', { id: b.dataset.wvv, item: b.dataset.wvi, aan: b.dataset.wva === '1' });
        laadWerkvloer(); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-wvt]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/werkvloer/bedieningskaart', { id: b.dataset.wvt });
        $('#wvTafelVak').innerHTML = '<div class="h-mt60"><b>' + T('pd.wv.tafel','Tafel') + ' ' + esc(d.tafel) + '</b>' +
          d.stoelen.map(s => '<div class="mbrow"><div>' + esc(s.naam) +
            '<div style="font-size:0.72rem;line-height:1.45;color:' + (s.let_op ? 'var(--gold)' : 'var(--soft)') + ';">' +
            esc(s.regel) + '</div></div></div>').join('') +
          '<div style="font-size:0.72rem;color:var(--soft);margin-top:0.5rem;line-height:1.45;">' +
          T('pd.wv.tafeluit','Vul aan tafel aan wat de gast vertelt; de keuken ziet het meteen opgeteld.') + '</div></div>';
      } catch(e){ toast(e.message); }
    }));
  }

  document.querySelectorAll('.tabbar button[data-tab="werkvloer"]').forEach(b => b.addEventListener('click', laadWerkvloer));
