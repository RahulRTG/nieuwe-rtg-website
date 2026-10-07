  /* ---- backoffice, deel 01a: DE SCAN VAN EEN IDENTITEITSBEWIJS ----

     De scan komt met de sessie in de KOP en niet in het adres: een <img
     src="/api/office/doc?token=..."> zette de kantoorsessie in serverlogs, de
     browsergeschiedenis en een Referer (keuringsregel 29b). Nu haalt fetch hem
     op met Authorization en wordt hij een blob, die bij de volgende scan weer
     wordt vrijgegeven. Deel van dezelfde genaaide bundel (scripts/bundel.js):
     dit bestand is geen module en draait binnen dezelfde IIFE als 01 en 01b. */
  async function toonDocument(file) {
    const img = $('#docImg');
    if (img.dataset.blob) { URL.revokeObjectURL(img.dataset.blob); delete img.dataset.blob; }
    img.removeAttribute('src');
    $('#docScrim').classList.add('open');
    try {
      const r = await fetch('/api/office/doc?file=' + encodeURIComponent(file),
        { headers: { Authorization: 'Bearer ' + API.token }, cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      img.dataset.blob = URL.createObjectURL(await r.blob());
      img.src = img.dataset.blob;
    } catch (x) { img.alt = T('bo.docmissing', 'Dit document kon niet worden geladen.'); }
  }
