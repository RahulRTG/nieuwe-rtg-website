
  /* ---------- tafel-QR's printen ----------
     Elke tafel krijgt een sticker met een QR: het lid scant hem en bestelt en
     betaalt meteen voor die tafel, zonder een code over te typen. De QR bevat
     alleen de zaakcode en de tafelnaam, nooit persoonsdata. */
  function printTafelQRs(){
    if (!window.RTGQRteken || !window.RTGCode){ toast(T('tblqr.nietklaar','Het QR-onderdeel is nog niet geladen.')); return; }
    const code = S && S.code, tafels = (state && state.tables) || [];
    if (!code || !tafels.length){ toast(T('tblqr.geen','Er zijn nog geen tafels om te printen.')); return; }
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
    const naam = (S && S.name) || 'RTG';
    let kaarten = '';
    for (const t of tafels){
      let url = '';
      try { url = RTGQRteken.dataURL(RTGCode.bouwTafel(code, t.name), { schaal: 6, ecc: 'M' }); } catch(e){ continue; }
      kaarten += '<div class="k"><img src="'+url+'" alt=""><div class="n">'+esc(t.name)+'</div><div class="s">'+esc(naam)+' · '+esc(T('tblqr.sub','scan en bestel'))+'</div></div>';
    }
    const w = window.open('', '_blank');
    if (!w){ toast(T('tblqr.popup','Sta pop-ups toe om de tafel-QR’s te printen.')); return; }
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(naam)+' · tafel-QR</title><style>'+
      'body{font-family:Inter,system-ui,sans-serif;margin:0;padding:14mm;color:#0C0C0B;}'+
      'h1{font-family:"Bodoni Moda",Georgia,serif;font-weight:500;font-size:18pt;margin:0 0 6mm;}'+
      '.g{display:grid;grid-template-columns:repeat(3,1fr);gap:8mm;}'+
      '.k{border:1px solid #DEDBD5;border-radius:10px;padding:7mm 4mm;text-align:center;page-break-inside:avoid;}'+
      '.k img{width:100%;max-width:44mm;image-rendering:pixelated;}'+
      '.k .n{font-family:"Bodoni Moda",Georgia,serif;font-size:19pt;margin-top:3mm;}'+
      '.k .s{font-size:8pt;color:#8A8680;margin-top:1mm;letter-spacing:.02em;}'+
      '@media print{.noprint{display:none;}}'+
      '</style></head><body><button class="noprint" onclick="window.print()" style="margin-bottom:7mm;padding:9px 18px;border:1px solid #7F1634;background:#7F1634;color:#fff;border-radius:8px;font:inherit;cursor:pointer;">'+esc(T('tblqr.printknop','Printen'))+'</button>'+
      '<h1>'+esc(naam)+'</h1><div class="g">'+kaarten+'</div></body></html>');
    w.document.close();
  }
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-tblqr]'); if (b) printTafelQRs(); });
