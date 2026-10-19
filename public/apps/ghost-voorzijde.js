/* De Ghost Driver op het RTG Design System (TRAVELOS-MIGRATIE.md par. 1b).
   Dit was het inline script van ghost.html: dezelfde aanroep op de zaak-inlog,
   dezelfde zinnen, dezelfde uitvoer. Het uurbeeld was een rij staafjes met een
   hoogte uit element.style; nu is elk uur een <progress> met zijn kans als
   waarde, en "druk" staat er in woorden bij in plaats van alleen in kleur. Het
   weerbeeld is een demo en heet zo (par. 1d): die zinnen komen van de server. */
(() => {
  const $ = s => document.querySelector(s);
  const token = (() => { try { return localStorage.getItem('rtg_sup_token'); } catch (e) { return null; } })();
  const maak = (tag, klasse, tekst) => { const e = document.createElement(tag);
    if (klasse) e.className = klasse; if (tekst != null) e.textContent = tekst; return e; };
  const leeg = el => { while (el.firstChild) el.removeChild(el.firstChild); };
  /* Meenemen (shared/uitvoer.js): de spookrit levert twee echte reeksen -- de
     waarschuwingen per knooppunt en, als er niets dreigt, het uurbeeld dat
     altijd getekend wordt. Je neemt mee wat er op het scherm staat, met de
     velden los in plaats van de zin "78% kans op opstopping bij Passeig". */
  let GHOST = null;
  if (window.RTGUitvoer) RTGUitvoer.bron(() => {
    if (!GHOST) return null;
    if ((GHOST.waarschuwingen || []).length) {
      return { naam: 'waarschuwingen',
        kolommen: ['tijd', 'knooppunt', 'kans in procenten', 'advies', 'zonder ingrijpen', 'met advies', 'winst'],
        rijen: GHOST.waarschuwingen.map(w => [w.tijd, w.knooppunt, w.kans, w.advies,
          w.simulatie.zonderAdvies, w.simulatie.metAdvies, w.simulatie.winst]) };
    }
    if ((GHOST.uurbeeld || []).length) {
      return { naam: 'uurbeeld',
        kolommen: ['tijd', 'kans in procenten', 'drukste punt', 'regen'],
        rijen: GHOST.uurbeeld.map(u => [u.tijd, u.kans, u.drukPunt || '', u.regen ? 'ja' : 'nee']) };
    }
    return null;
  });

  function uur(u, drempel) {
    const stand = u.kans >= drempel ? 'druk' : u.kans >= 30 ? 'middel' : 'rustig';
    const li = maak('li', 'ds-veldlabel'); li.dataset.uur = u.tijd; li.dataset.stand = stand;
    li.appendChild(maak('span', 'ds-lijst__titel', u.tijd.slice(0, 5) + ' · ' + u.kans + '% · ' + stand));
    const m = maak('progress', 'ds-voortgang'); m.max = 100; m.value = Math.max(0, Math.min(100, u.kans));
    m.setAttribute('aria-label', u.tijd + ': ' + u.kans + '% kans, ' + stand);
    li.appendChild(m);
    return li;
  }

  function waarschuwing(w) {
    const k = maak('article', 'ds-kaart'); k.dataset.knooppunt = w.knooppunt;
    const b = maak('div', 'ds-kaart__inhoud');
    b.appendChild(maak('p', 'ds-label', 'rond ' + w.tijd));
    b.appendChild(maak('h3', 'ds-kaart__titel', w.kans + '% kans op opstopping bij ' + w.knooppunt));
    const ul = maak('ul', 'ds-detail__gegevens');
    for (const o of (w.oorzaken || [])) ul.appendChild(maak('li', 'ds-meta', o));
    b.appendChild(ul);
    const advies = maak('p', 'ds-meta');
    advies.appendChild(maak('b', '', 'Advies: '));
    advies.append(w.advies);
    b.appendChild(advies);
    const sim = maak('ul', 'ds-detail__gegevens');
    for (const [naam, waarde] of [['Zonder ingrijpen', w.simulatie.zonderAdvies], ['Met advies', w.simulatie.metAdvies], ['Winst', w.simulatie.winst]]) {
      const li = maak('li', 'ds-detail__gegeven');
      li.appendChild(maak('span', 'ds-lijst__tekst', naam));
      li.appendChild(maak('strong', '', String(waarde)));
      sim.appendChild(li);
    }
    b.appendChild(sim);
    k.appendChild(b);
    return k;
  }

  (async () => {
    if (!token) { $('#vPoort').hidden = false; return; }
    const r = await fetch('/api/supplier/ghost', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: '{}' })
      .then(async x => ({ status: x.status, body: await x.json().catch(() => ({})) }));
    if (r.status !== 200) { $('#vPoort').hidden = false; return; }
    const d = r.body;
    GHOST = d;
    $('#uitleg').textContent = 'De Ghost Driver rijdt de komende ' + d.horizonUren + ' uur alvast door ' + d.stad +
      ' en meldt uren van tevoren waar het vast dreigt te lopen.';
    const kn = d.knooppunten.slice(0, 8);
    $('#bouwstenen').textContent = d.toelichting + ' Knooppunten (' + d.knooppunten.length + '): ' + kn.join(' · ') +
      (d.knooppunten.length > kn.length ? ' en meer.' : '.');
    const uren = $('#uren'); leeg(uren);
    let drukste = null;
    for (const u of (d.uurbeeld || [])) {
      if (!drukste || u.kans > drukste.kans) drukste = u;
      uren.appendChild(uur(u, d.drempel));
    }
    $('#urenSub').textContent = drukste
      ? 'Drukste uur: ' + drukste.tijd + ' (' + drukste.kans + '%' + (drukste.drukPunt ? ', rond ' + drukste.drukPunt : '') + ')' + (drukste.regen ? ' · regen in het beschikbare weerbeeld (demo)' : '') + '.'
      : '';
    const lijst = $('#lijst'); leeg(lijst);
    if (!d.waarschuwingen.length) {
      lijst.appendChild(maak('p', 'ds-meta', 'De komende ' + d.horizonUren + ' uur ziet de spookrit nergens een opstopping aankomen. Rustig rijden.'));
    }
    for (const w of d.waarschuwingen) lijst.appendChild(waarschuwing(w));
    $('#vGhost').hidden = false;
  })();
})();
