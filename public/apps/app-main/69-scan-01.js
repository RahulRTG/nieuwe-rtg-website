
  /* ---------- scannen: een tafel-QR opent meteen het menu voor die tafel ----------
     Nu we een eigen QR-codec en camera hebben, hoeft niemand meer een tafelcode
     over te typen: scan de sticker op tafel en je bestelt en betaalt direct. De
     scan blijft op het toestel; we sturen alleen de zaakcode + tafel door. */
  async function scanRoute(tekst){
    const p = (window.RTGCode ? RTGCode.lees(tekst) : { soort: 'tekst', tekst: tekst });
    if (p.soort === 'tafel'){
      try {
        await openMenu(p.code);
        if (menuState){ menuState.table = p.tafel || ''; renderMenuSheet(); }
        toast('\u{1FA91} ' + (p.tafel ? T('scan.tafel','Tafel') + ' ' + p.tafel : T('scan.zaakopen','Menu geopend')));
      } catch(e){ toast(e.message || T('scan.nietgevonden','Deze zaak kon niet worden geopend.')); }
      return;
    }
    if (p.soort === 'kas'){ toast(T('scan.kaseigen','Dit is een betaalcode van een lid; laat de kassa hem scannen.')); return; }
    if (p.soort === 'entree'){ toast(T('scan.entree','Entree-code gescand.')); return; }
    toast(String(p.tekst || '').slice(0, 90));
  }
  const _scanBtn = document.getElementById('scanBtn');
  if (_scanBtn) _scanBtn.addEventListener('click', () => {
    if (!window.RTGScanknop){ toast(T('scan.nietklaar','De scanner is nog niet geladen.')); return; }
    RTGScanknop.open({
      titel: T('scan.titel','Scan een RTG-code'),
      hint: T('scan.hint','Richt op de QR op je tafel om te bestellen, of op een andere RTG-code.'),
      onCode: (c) => { scanRoute(c.tekst); }
    });
  });
