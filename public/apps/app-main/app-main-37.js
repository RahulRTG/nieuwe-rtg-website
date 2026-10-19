/* de deur van kamer of entree openen, en een kamer boeken */
    const dk = $('#vbDeurKamer'); if (dk) dk.addEventListener('click', () => deur('kamer'));
    const de = $('#vbDeurEntree'); if (de) de.addEventListener('click', () => deur('entree'));
    // een kamer boeken: datums kiezen, een knop, het huis bevestigt
    $('#msBody').querySelectorAll('[data-vbboek]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/verblijf', {
          supplierCode: s.code, roomId: b.dataset.vbboek,
          aankomst: $('#vbAankomst').value, vertrek: $('#vbVertrek').value,
          personen: Number($('#vbPers').value)
        });
        toast('' + T('vb.ok','Verblijf aangevraagd:') + ' ' + d.verblijf.roomName + ', ' + d.verblijf.nachten + ' ' + T('vb.nachten','nacht(en)') + ' (' + eur(d.verblijf.totaal) + '). ' + T('erv.zaakbevestigt','De zaak bevestigt hem zo.'));
      } catch(e){ toast(e.message); }
    }));
    if (menuState.retail) bindRetailMenu();
    $('#msBody').querySelectorAll('.ms-item').forEach(el => {
      const id = el.dataset.id;
      const plus = el.querySelector('.js-plus'), min = el.querySelector('.js-minus');
      if (plus) plus.addEventListener('click', () => { menuState.qty[id] = (menuState.qty[id]||0)+1; renderMenuSheet(); });
      if (min) min.addEventListener('click', () => { menuState.qty[id] = Math.max(0,(menuState.qty[id]||0)-1); renderMenuSheet(); });
    });
    if (!m.length){ $('#msFoot').innerHTML = ''; return; }
    if (menuState.supplier.ordersOpen === false){
      $('#msFoot').innerHTML = '<div class="s-12zxnen">' + T('app.ms.closed','Bestellingen zijn tijdelijk gesloten. De kaart blijft ter inzage.') + '</div>';
      return;
    }
    const total = m.reduce((s,x) => s + x.price * (menuState.qty[x.id]||0), 0);
    const count = Object.values(menuState.qty).reduce((a,b)=>a+b,0);
    const tafels = menuState.supplier.tableNames || [];
    $('#msFoot').innerHTML =
      (tafels.length ? '<select class="ms-note s-m3b83" id="msTable">'+
        '<option value="">' + T('app.ms.tableq','Aan welke tafel zit u? (optioneel)') + '</option>'+
        tafels.map(t => '<option' + (menuState.table === t ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>' : '') +
      '<input class="ms-note" id="msNote" placeholder="' + T('app.ms.note','Allergie of opmerking (bijv. geen noten)') + '" value="' + menuState.note.replace(/"/g,'&quot;') + '">' +
      '<label class="ms-tag"><input type="checkbox" id="msTag"' + (menuState.tag ? ' checked' : '') + '> ' + T('app.ms.tag','Tag dit voor De Salon (7 dagen na verblijf)') + '</label>' +
      '<select class="ms-note h-mt40" id="msFooi" aria-label="' + T('erv.fooi','Fooi') + '">' +
        '<option value="0">' + T('erv.fooi.geen','Geen fooi') + '</option>' +
        '<option value="p5"' + (menuState.fooi==='p5'?' selected':'') + '>' + T('erv.fooi.team','Fooi voor het team') + ': 5%</option>' +
        '<option value="p10"' + (menuState.fooi==='p10'?' selected':'') + '>' + T('erv.fooi.team','Fooi voor het team') + ': 10%</option>' +
        '<option value="e5"' + (menuState.fooi==='e5'?' selected':'') + '>' + T('erv.fooi.team','Fooi voor het team') + ': € 5</option>' +
      '</select>' +
      '<div style="font-size:0.66rem;color:var(--soft);margin:0.25rem 0;">' + T('app.ms.los','U bestelt rechtstreeks bij deze zaak: een losse overeenkomst, en uw betaling gaat rechtstreeks naar de zaak.') + '</div>' +
      ((menuState.supplier.hasMenu !== false && (menuState.menu || []).some(x => x.station === 'bar'))
        ? '<div class="s-77nxhn">' +
          (menuState.alcohol && menuState.alcohol.mag === false
            ? T('app.ms.geenalc','Alcohol staat voor u uit:') + ' ' + (menuState.alcohol.land || '') + ' ' + T('app.ms.vanaf','hanteert') + ' ' + menuState.alcohol.grens + '+ ' + T('app.ms.pasp','(leeftijd geverifieerd via uw paspoort).')
            : 'Alcohol: ' + ((menuState.alcohol && menuState.alcohol.grens) || 18) + '+; ' + T('app.ms.18b','de zaak kan om legitimatie vragen.')) + '</div>' : '') +
      '<button class="ms-order" id="msOrder"' + (count ? '' : ' disabled') + '>' + (count ? T('app.ms.order','Bestel') + ' ' + count + ' ' + T('app.items','item(s)') + ', ' + eur(total) : T('app.ms.choose','Kies gerechten')) + '</button>' +
      (count ? '<button class="ms-order s-1df46c7" id="msKassa">' + T('app.ms.naarkassa','Stuur naar de kassa, betaal aan de balie') + '</button>' : '');
    const mt = $('#msTable');
    if (mt) mt.addEventListener('change', e => menuState.table = e.target.value);
    $('#msNote').addEventListener('input', e => menuState.note = e.target.value);
    $('#msTag').addEventListener('change', e => menuState.tag = e.target.checked);
    const mf = $('#msFooi');
    if (mf) mf.addEventListener('change', e => menuState.fooi = e.target.value);
    const ob = $('#msOrder');
    if (count) ob.addEventListener('click', () => placeOrder());
    const kb = $('#msKassa');
    if (kb) kb.addEventListener('click', () => placeOrder({ naarKassa: true }));
  }

  // ---- mode-/retailcatalogus in de partner-sheet ----
  function retailMenuBlock(){
    const r = menuState.retail;
    const mijn = menuState.retailMijn || { apart: [], styling: [] };
    let html = '<div class="ms-cat">' + T('rt.m.cat','Collectie') + '</div>';
    // eigen apart-artikelen en stylingvoorstellen bij dit merk
    const apart = (mijn.apart || []).filter(a => a.supplierName === r.supplier.name);
    if (apart.length) html += '<div class="s-vheoej"><div class="s-q9kr8e">' + T('rt.m.apart','Voor u apart gelegd') + '</div>' +
      apart.map(a => '<div class="s-cjhok5">' + esc(a.artikelNaam) + ' · ' + esc(a.kleur) + ', ' + esc(a.maat) + ' <span class="s-1pv2lmv">(' + T('rt.m.tot','tot') + ' ' + esc(a.tot) + ')</span></div>').join('') +
      '<button class="rt-bezorg s-1m7x24a">' + T('mb.laat','Veilig laten bezorgen') + '</button>' +
      '<div class="s-1p5q1dn">' + T('mb.veiliguitleg','Met bezorgcode, live volgen en pas-aan-de-deur. Dure stukken: ID aan de deur.') + '</div></div>';
    // lopende bezorgingen van deze winkel
    const bez = (menuState.modeBezorg || []).filter(b => b.supplierName === r.supplier.name && !['afgeleverd','retour','geannuleerd'].includes(b.status));
    if (bez.length) html += bez.map(b => '<div class="s-1klloxj"><div class="s-q9kr8e">' + T('mb.onderweg','Bezorging') + ' · ' + esc(b.status) + '</div>' +
      '<button data-mbcode="' + esc(b.ref) + '" class="s-wsds8w">' + T('mb.toon','Nieuwe bezorgcode') + '</button>' +
      '<div class="s-12gyt3u">' + (b.koerier ? T('mb.koerieris','Koerier') + ': ' + esc(b.koerier) + (b.etaMin != null ? ' · ETA ' + b.etaMin + ' min' : '') : T('mb.geefcode','Geef deze code alleen aan de RTG-koerier aan de deur.')) + '</div></div>').join('');
    const styling = (mijn.styling || []).filter(v => v.supplierName === r.supplier.name);
    if (styling.length) html += styling.map(v => '<div class="s-vheoej"><div class="s-q9kr8e">' + esc(v.titel) + '</div>' +
      (v.bericht ? '<div class="s-o2xnz3">' + esc(v.bericht) + '</div>' : '') +
      '<div class="s-12wf5w5">' + v.items.map(i => esc(i.naam)).join(' · ') + '</div><div class="s-1k33i11">' + T('rt.m.van','van') + ' ' + esc(v.van) + '</div></div>').join('');
    // de artikelen
