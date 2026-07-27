    if (vastePas === 'rtg' || vastePas === 'lifestyle'){
      const pasNaam = vastePas === 'rtg' ? T('bo2.thema.bordeaux','Bordeaux (RTG)') : T('bo2.thema.parel','Parelmoer (Lifestyle)');
      const nu = pasThemaHuidig();
      const knop = (val, tekst) => '<button class="js-thema" data-thema="' + val + '" style="margin-top:0.5rem;margin-right:0.4rem;border-radius:999px;padding:0.4rem 0.85rem;font-family:inherit;font-size:0.7rem;cursor:pointer;border:1px solid ' + (nu===val?'var(--gold)':'var(--line)') + ';background:' + (nu===val?'var(--gold)':'none') + ';color:' + (nu===val?'#000':'var(--txt)') + ';">' + tekst + '</button>';
      html += kaart('' + T('bo2.weergave','Weergave'),
        '<div class="fineprint">' + T('bo2.weergave.s','Kies het kleurthema van deze app.') + '</div>' +
        knop(THEMA_STANDAARD[vastePas], pasNaam) + knop('standaard', T('bo2.thema.klassiek','Klassiek (donker)')));
    }

    // pas-specifiek: elke pas zijn eigen slimme snelkoppelingen
    if (user.tier === 'business'){
      html += kaart('' + T('bo2.vb','Voor uw Business Pass'),
        '<div class="fineprint">' + T('bo2.vb.s','Uw facturen zijn boekhoudklaar. De AI-boekhouder en de zzp-belastingtool staan onder Betalen; uw netwerk onder Salon.') + '</div>' +
        knopje('boNaarBoekhouder', '' + T('bo2.boekhouder','AI-boekhouder')) + knopje('boNaarZakelijk', 'RTG Zakelijk'));
    } else if (user.tier === 'lifestyle'){
      html += kaart('' + T('bo2.vl','Voor uw Lifestyle Pass'),
        '<div class="fineprint">' + T('bo2.vl.s','Uw concierge denkt vooruit onder AI; uw professionele netwerk staat onder Salon.') + '</div>' +
        knopje('boNaarAi', '' + T('bo2.concierge','Concierge')) + knopje('boNaarZakelijk', 'RTG Zakelijk'));
    } else {
      html += kaart('' + T('bo2.vr','Voor uw pas'),
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


  /* ---------- Toon je Zegel: officiele ID-/leeftijdscontrole zonder je naam ----------
     Het lid kiest welk FEIT het bewijst (18+, 21+, lid, welke pas) en toont een
     QR. De leverancier scant en verifieert die offline met de publieke sleutel:
     RTG staat met de handtekening garant dat het paspoort is gezien. Er gaat
     nooit een naam, geboortedatum of pasnummer mee; alleen het bewezen feit. */
  function zegelStijlEenmalig(){
    if (document.getElementById('rtg-zegel-stijl')) return;
    const st = document.createElement('style'); st.id = 'rtg-zegel-stijl';
    st.textContent = [
      '.zg-ov{position:fixed;inset:0;z-index:99998;background:rgba(12,12,11,.72);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;}',
      '.zg-card{background:var(--bg,#0C0C0B);color:var(--txt,#fff);width:100%;max-width:520px;border-radius:20px 20px 0 0;padding:1.3rem 1.3rem calc(1.3rem + env(safe-area-inset-bottom,0));max-height:92vh;overflow-y:auto;}',
      '.zg-card h3{font-family:"Bodoni Moda",Georgia,serif;font-weight:500;font-size:1.25rem;margin:.1rem 0 .2rem;}',
      '.zg-sub{color:var(--soft,#8A8680);font-size:.82rem;margin-bottom:1rem;}',
      '.zg-opt{display:flex;align-items:center;gap:.7rem;padding:.7rem .2rem;border-bottom:1px solid var(--line,#26251f);cursor:pointer;font-size:.95rem;}',
      '.zg-opt input{width:20px;height:20px;accent-color:#7F1634;}',
      '.zg-btn{width:100%;margin-top:1rem;background:#7F1634;color:#fff;border:none;border-radius:12px;padding:.85rem;font-weight:600;font-family:inherit;font-size:.95rem;cursor:pointer;}',
      '.zg-btn.sec{background:none;border:1px solid var(--line,#3a3a38);color:var(--soft,#8A8680);}',
      '.zg-qrwrap{text-align:center;}',
      '.zg-qr{background:#fff;display:inline-block;padding:14px;border-radius:14px;margin:.4rem 0;}',
      '.zg-qr canvas{display:block;width:min(64vw,260px);height:auto;image-rendering:pixelated;}',
      '.zg-badge{display:inline-flex;align-items:center;gap:.4rem;background:rgba(133,112,7,.16);color:#C9A227;border:1px solid rgba(133,112,7,.4);border-radius:999px;padding:.3rem .8rem;font-size:.78rem;font-weight:600;margin:.2rem 0;}',
      '.zg-claims{display:flex;flex-wrap:wrap;gap:.4rem;justify-content:center;margin:.6rem 0;}',
      '.zg-claim{background:rgba(194,58,94,.14);color:#C23A5E;border-radius:999px;padding:.25rem .7rem;font-size:.8rem;font-weight:600;}',
      '.zg-tel{font-size:.8rem;color:var(--soft,#8A8680);}'
    ].join('');
    document.head.appendChild(st);
  }
  const ZG_CLAIMS = [
    { id: 'leeftijd18', label: '18 jaar of ouder' },
    { id: 'leeftijd21', label: '21 jaar of ouder' },
    { id: 'lid', label: 'Geldig RTG-lid' },
    { id: 'pas', label: 'Welke pas ik heb' }
  ];
  let zgTimer = null;
  function sluitZegel(){ if (zgTimer){ clearInterval(zgTimer); zgTimer = null; } const o = document.getElementById('zgOverlay'); if (o) o.remove(); }
  function openZegel(){
    if (!window.RTGQRteken){ toast(T('zg.nietklaar','Het QR-onderdeel is nog niet geladen.')); return; }
    zegelStijlEenmalig(); sluitZegel();
    const ov = document.createElement('div'); ov.className = 'zg-ov'; ov.id = 'zgOverlay';
    ov.innerHTML = '<div class="zg-card" role="dialog" aria-modal="true" aria-label="'+T('zg.titel','Toon je Zegel')+'">'+
      '<h3>'+T('zg.titel','Toon je Zegel')+'</h3>'+
      '<div class="zg-sub">'+T('zg.sub','Bewijs een feit aan de zaak zonder je naam te tonen. RTG staat garant dat je paspoort is gezien.')+'</div>'+
      '<div id="zgKies">'+ ZG_CLAIMS.map((c,i) => '<label class="zg-opt"><input type="checkbox" data-claim="'+c.id+'"'+(i<1?' checked':'')+'><span>'+c.label+'</span></label>').join('') +
      '<button class="zg-btn" id="zgMaak">'+T('zg.toon','Toon mijn Zegel')+'</button>'+
      '<button class="zg-btn sec" id="zgAnnuleer">'+T('zg.annuleer','Annuleren')+'</button></div>'+
      '<div id="zgResultaat"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) sluitZegel(); });
    document.getElementById('zgAnnuleer').addEventListener('click', sluitZegel);
    document.getElementById('zgMaak').addEventListener('click', maakZegel);
  }
  async function maakZegel(){
    const gekozen = Array.from(document.querySelectorAll('#zgKies [data-claim]:checked')).map(x => x.dataset.claim);
    if (!gekozen.length){ toast(T('zg.kies','Kies minstens een feit om te bewijzen.')); return; }
    let d;
    try { d = await API.call('/zegel/maak', { claims: gekozen, geldigMin: 5 }); }
    catch(e){ toast(e.message); return; }
    const claims = d.claims || {};
    const bewezen = Object.keys(claims);
    if (!bewezen.length){ toast(T('zg.geen','Geen van deze feiten kon worden bewezen voor jouw account.')); return; }
    // teken de QR met ruime foutcorrectie-marge (niveau L past de meeste combinaties
    // in een scanbare code); lukt het niet, vraag dan om minder feiten tegelijk
    let canvas;
    try { canvas = RTGQRteken.teken(d.token, { schaal: 6, ecc: 'L' }); }
    catch(e){ toast(T('zg.telang','Te veel feiten tegelijk voor een scanbare code. Kies er een of twee.')); return; }
    const labelVoor = k => k === 'pas' ? (T('zg.pas','Pas') + ': ' + claims[k]) : (ZG_CLAIMS.find(c => c.id === k) || {}).label || k;
    const kies = document.getElementById('zgKies'); if (kies) kies.style.display = 'none';
    const res = document.getElementById('zgResultaat');
    res.innerHTML = '<div class="zg-qrwrap"><div class="zg-badge">\u{1F6E1} '+T('zg.geverifieerd','RTG-geverifieerd')+'</div>'+
      '<div class="zg-qr" id="zgQr"></div>'+
      '<div class="zg-claims">'+ bewezen.map(k => '<span class="zg-claim">✓ '+labelVoor(k)+'</span>').join('') +'</div>'+
      '<div class="zg-tel" id="zgTel"></div>'+
      '<button class="zg-btn sec" id="zgSluit">'+T('zg.klaar','Klaar')+'</button></div>';
    document.getElementById('zgQr').appendChild(canvas);
