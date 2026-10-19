
  /* ---------- deel 3d: samen wandelen (het paar) ----------
     Een verzoek, een ja, en twee pionnen wandelen vast aan elkaar door het
     huis: een gouden draad met een hartje ertussen. Losmaken mag altijd;
     wie wil, wordt via de bestaande vriendenlaag ook echt vrienden. */
  function tekenParen() {
    if (!S.kamer || !S.kamer.paren || !S.kamer.paren.length) return;
    for (const [na, nb] of S.kamer.paren) {
      const a = S.leden.get(na), b = S.leden.get(nb);
      if (!a || !b) continue;
      const ax = isoX(a.rx + 0.5, a.ry + 0.5), ay = isoY(a.rx + 0.5, a.ry + 0.5) - TH * 0.8;
      const bx = isoX(b.rx + 0.5, b.ry + 0.5), by = isoY(b.rx + 0.5, b.ry + 0.5) - TH * 0.8;
      const mx = (ax + bx) / 2, my = (ay + by) / 2 - 14;
      ctx.strokeStyle = 'rgba(201,169,75,0.55)'; ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = KLEUR.bordeauxLicht;
      ctx.fillText('♥', mx, my + 4);
    }
  }

  function zetKnopPaar() {
    $('#knopPaar').textContent = S.paar ? 'Losmaken' : 'Wandel samen';
  }
  $('#knopPaar').addEventListener('click', async () => {
    if (S.paar) {
      try { await api('/api/residentie/paar/los', {}); S.paar = null; zetKnopPaar(); meld('U wandelt weer alleen.'); }
      catch (e) { meld(e.message); }
      return;
    }
    const anderen = [...S.leden.values()].filter(l => l.codenaam !== S.ik);
    if (!anderen.length) return meld('U bent hier nog alleen.');
    $('#spelKeuze').innerHTML = '<h2 class="ds-titel ds-titel--scherm">Samen wandelen</h2><p class="ds-meta">vast aan elkaar door het huis, zolang u allebei hier bent</p>' +
      anderen.map(l => '<button class="ds-veld" data-paar="' + esc(l.codenaam) + '">' + RIJICOON + '<span><span class="ds-veld__label">' + esc(l.codenaam) + '</span></span><span class="ds-meta">vraag</span></button>').join('') +
      '<button class="ds-knop ds-knop--stil ds-knop--breed" id="paarKeuzeWeg" type="button">Toch niet</button>';
    laagOpen('#spelLaag');
    $('#paarKeuzeWeg').addEventListener('click', () => laagDicht('#spelLaag'));
    $('#spelKeuze').querySelectorAll('[data-paar]').forEach(b => b.addEventListener('click', async () => {
      laagDicht('#spelLaag');
      try { await api('/api/residentie/paar/vraag', { codenaam: b.dataset.paar });
        meld('Gevraagd; even wachten op ' + b.dataset.paar + '.'); } catch (e) { meld(e.message); }
    }));
  });

  async function wordVrienden(naam) {
    try {
      const z = await api('/api/member/find', { q: naam });
      const t = (z.results || []).find(r => r.codename === naam) || (z.results || [])[0];
      if (!t) return meld('Niet gevonden in de ledengids.');
      await api('/api/member/connect', { key: t.key });
      meld('Vriendschapsverzoek verstuurd naar ' + naam + '.');
    } catch (e) { meld(e.message); }
  }

  function paarSein(d) {
    if (d.kind === 'paar-verzoek') {
      $('#spelKeuze').innerHTML = '<h2 class="ds-titel ds-titel--scherm">Samen wandelen?</h2>' +
        '<p class="ds-meta">' + esc(d.van) + ' wil vast aan u wandelen, zolang u hier samen bent</p>' +
        '<div class="ds-dialoog__acties">' +
        '<button class="ds-knop ds-knop--primair" id="paarJa" type="button">Graag</button>' +
        '<button class="ds-knop ds-knop--stil" id="paarNee" type="button">Liever niet</button></div>';
      laagOpen('#spelLaag');
      $('#paarJa').addEventListener('click', async () => {
        laagDicht('#spelLaag');
        try { const r = await api('/api/residentie/paar/antwoord', { ja: true }); S.paar = r.paar || d.van; zetKnopPaar(); }
        catch (e) { meld(e.message); }
      });
      $('#paarNee').addEventListener('click', async () => {
        laagDicht('#spelLaag');
        try { await api('/api/residentie/paar/antwoord', { ja: false }); } catch (e) {}
      });
    }
    if (d.kind === 'paar-aan') {
      if (S.kamer && S.kamer.paren && !S.kamer.paren.some(p2 => p2.includes(d.a))) S.kamer.paren.push([d.a, d.b]);
      if (d.a === S.ik || d.b === S.ik) {
        S.paar = d.a === S.ik ? d.b : d.a; zetKnopPaar();
        $('#spelKeuze').innerHTML = '<h2 class="ds-titel ds-titel--scherm">U wandelt samen</h2>' +
          '<p class="ds-meta">met ' + esc(S.paar) + ' · u loopt nu vast aan elkaar door het huis</p>' +
          '<div class="ds-dialoog__acties">' +
          '<button class="ds-knop ds-knop--primair" id="paarVriend" type="button">Word ook vrienden</button>' +
          '<button class="ds-knop ds-knop--stil" id="paarKlaar" type="button">Verder</button></div>';
        laagOpen('#spelLaag');
        $('#paarVriend').addEventListener('click', () => { laagDicht('#spelLaag'); wordVrienden(S.paar); });
        $('#paarKlaar').addEventListener('click', () => laagDicht('#spelLaag'));
      } else meld(d.a + ' en ' + d.b + ' wandelen nu samen.');
    }
    if (d.kind === 'paar-los') {
      if (S.kamer && S.kamer.paren) S.kamer.paren = S.kamer.paren.filter(p2 => !(p2.includes(d.a) || p2.includes(d.b)));
      if (d.a === S.ik || d.b === S.ik || S.paar) { S.paar = null; zetKnopPaar(); meld('Het paar is losgemaakt.'); }
    }
    if (d.kind === 'paar-nee') meld('Nu even niet; misschien straks.');
  }
