
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
    $('#spelKeuze').innerHTML = '<h2>Samen wandelen</h2><div class="sub">vast aan elkaar door het huis, zolang u allebei hier bent</div>' +
      anderen.map(l => '<button class="rij-item" data-paar="' + esc(l.codenaam) + '"><span><b>' + esc(l.codenaam) + '</b></span><span class="tel">vraag</span></button>').join('') +
      '<button class="knop2 stil2" id="paarKeuzeWeg" type="button" style="margin-top:0.75rem;width:100%;">Toch niet</button>';
    $('#spelLaag').classList.add('open');
    $('#paarKeuzeWeg').addEventListener('click', () => $('#spelLaag').classList.remove('open'));
    $('#spelKeuze').querySelectorAll('[data-paar]').forEach(b => b.addEventListener('click', async () => {
      $('#spelLaag').classList.remove('open');
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
      $('#spelKeuze').innerHTML = '<h2>Samen wandelen?</h2>' +
        '<div class="sub">' + esc(d.van) + ' wil vast aan u wandelen, zolang u hier samen bent</div>' +
        '<div style="display:flex;gap:.5rem;margin-top:0.75rem;">' +
        '<button class="knop2 h-flex1" id="paarJa" type="button">Graag</button>' +
        '<button class="knop2 stil2 h-flex1" id="paarNee" type="button">Liever niet</button></div>';
      $('#spelLaag').classList.add('open');
      $('#paarJa').addEventListener('click', async () => {
        $('#spelLaag').classList.remove('open');
        try { const r = await api('/api/residentie/paar/antwoord', { ja: true }); S.paar = r.paar || d.van; zetKnopPaar(); }
        catch (e) { meld(e.message); }
      });
      $('#paarNee').addEventListener('click', async () => {
        $('#spelLaag').classList.remove('open');
        try { await api('/api/residentie/paar/antwoord', { ja: false }); } catch (e) {}
      });
    }
    if (d.kind === 'paar-aan') {
      if (S.kamer && S.kamer.paren && !S.kamer.paren.some(p2 => p2.includes(d.a))) S.kamer.paren.push([d.a, d.b]);
      if (d.a === S.ik || d.b === S.ik) {
        S.paar = d.a === S.ik ? d.b : d.a; zetKnopPaar();
        $('#spelKeuze').innerHTML = '<h2>U wandelt samen</h2>' +
          '<div class="sub">met ' + esc(S.paar) + ' · u loopt nu vast aan elkaar door het huis</div>' +
          '<div style="display:flex;gap:.5rem;margin-top:0.75rem;">' +
          '<button class="knop2 h-flex1" id="paarVriend" type="button">Word ook vrienden</button>' +
          '<button class="knop2 stil2 h-flex1" id="paarKlaar" type="button">Verder</button></div>';
        $('#spelLaag').classList.add('open');
        $('#paarVriend').addEventListener('click', () => { $('#spelLaag').classList.remove('open'); wordVrienden(S.paar); });
        $('#paarKlaar').addEventListener('click', () => $('#spelLaag').classList.remove('open'));
      } else meld(d.a + ' en ' + d.b + ' wandelen nu samen.');
    }
    if (d.kind === 'paar-los') {
      if (S.kamer && S.kamer.paren) S.kamer.paren = S.kamer.paren.filter(p2 => !(p2.includes(d.a) || p2.includes(d.b)));
      if (d.a === S.ik || d.b === S.ik || S.paar) { S.paar = null; zetKnopPaar(); meld('Het paar is losgemaakt.'); }
    }
    if (d.kind === 'paar-nee') meld('Nu even niet; misschien straks.');
  }
