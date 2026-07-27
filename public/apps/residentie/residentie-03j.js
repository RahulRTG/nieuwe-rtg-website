
  /* ---------- deel 3j: de renbaan-scene ----------
     De Grand Prix: startlicht, kerbstones en karts met gemaskerde
     coureurs; het tik-tempo is het gas. */
  function kart(c, x, y, eigen, s) { // een kart van achteren, met gemaskerde coureur
    c.fillStyle = '#0A0908';
    c.fillRect(x - 11 * s, y - 3 * s, 5 * s, 8 * s); c.fillRect(x + 6 * s, y - 3 * s, 5 * s, 8 * s);
    c.fillStyle = eigen ? '#7F1634' : '#1E1910';
    c.fillRect(x - 8 * s, y - 8 * s, 16 * s, 11 * s);
    c.strokeStyle = 'rgba(216,184,88,0.8)'; c.lineWidth = 1.2;
    c.strokeRect(x - 8 * s, y - 8 * s, 16 * s, 11 * s);
    c.fillStyle = '#D8B858'; // de helm als masker
    c.beginPath(); c.ellipse(x, y - 12 * s, 5.5 * s, 4.5 * s, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = eigen ? '#D24A6E' : '#F2ECDC';
    c.fillRect(x - 6 * s, y - 20 * s, 12 * s, 2.2 * s); // het vleugeltje
  }

  SCENES.racen = {
    gasCfg() { return { rood: 1400, duur: 3500 }; }, // eerst het startlicht, dan pas gas
    gasScore(g) { // wie voor groen tikt, maakt een valse start
      const basis = Math.min(100, Math.round(g.taps * 4.5));
      return g.vals ? Math.round(basis * 0.6) : basis;
    },
    teken(c, W, H, m, beurt) {
      doek('#15120E', '#0A0806');
      const b = baan('#3A3630', '#242019', 'rgba(216,184,88,0.4)');
      for (let k = 0; k < 20; k++) { // kerbstones langs beide randen
        const v = k * 0.05;
        for (const zij of [-1.22, 1.22]) {
          const [x, y] = opBaan(b, v, zij);
          c.fillStyle = k % 2 ? '#7F1634' : '#EFE8D6';
          c.fillRect(x - 5, y - 3, 10, 5);
        }
      }
      const [fx, fy] = opBaan(b, 0.94, 0), fw = b.tw * 1.05; // de geblokte finish
      for (let i = 0; i < 10; i++) for (let j = 0; j < 2; j++) {
        c.fillStyle = (i + j) % 2 ? '#16130E' : '#EFE8D6';
        c.fillRect(fx - fw / 2 + i * fw / 10, fy - 6 + j * 5, fw / 10, 5);
      }
      c.setLineDash([8, 12]); c.strokeStyle = 'rgba(242,236,220,0.28)'; c.lineWidth = 2;
      const [m1x, m1y] = opBaan(b, 0, 0), [m2x, m2y] = opBaan(b, 0.92, 0);
      c.beginPath(); c.moveTo(m1x, m1y); c.lineTo(m2x, m2y); c.stroke(); c.setLineDash([]);
      const sp = (P && P.spelers) || [], tot = ((P && P.beurten) || 4) * 100;
      sp.forEach((s2, i) => {
        const zij = sp.length > 2 ? -0.75 + i * 0.5 : (i ? 0.45 : -0.45);
        const afs = s2.punten.reduce((a2, b2) => a2 + b2, 0);
        let v = 0.14 + Math.min(1, afs / tot) * 0.74;
        if (gas && beurt && s2.codenaam === S.ik) v += Math.min(0.03, gas.taps * 0.0012);
        const [kx, ky] = opBaan(b, v, zij);
        kart(c, kx, ky, s2.codenaam === S.ik, 1.15 - v * 0.55);
        c.fillStyle = '#EFE8D6'; c.font = '600 9px Inter, sans-serif'; c.textAlign = 'center';
        c.fillText(s2.codenaam, kx, ky + 16);
      });
      if (beurt) {
        const nu = performance.now(), rood = gas && gas.rood && nu < gas.rood;
        const aanTal = rood ? Math.min(3, Math.ceil((1400 - (gas.rood - nu)) / 470)) : 3;
        for (let i = 0; i < 3; i++) { // de startlichten boven de baan
          c.beginPath(); c.arc(W / 2 - 34 + i * 34, 192, 9, 0, Math.PI * 2);
          c.fillStyle = !gas ? 'rgba(242,236,220,0.15)'
            : rood ? (i < aanTal ? '#9E1C40' : 'rgba(242,236,220,0.15)') : '#D8B858';
          c.fill();
        }
        c.textAlign = 'center'; c.fillStyle = 'rgba(216,184,88,0.9)'; c.font = '600 11px Inter, sans-serif';
        if (!gas) c.fillText('druk op Geef gas en wacht op het gouden licht', W / 2, 230);
        else if (rood) c.fillText(gas.vals ? 'te vroeg! dat kost u meters' : 'wachten op groen...', W / 2, 230);
        else {
          const rest = Math.max(0, (gas.tot - nu) / 1000);
          c.fillText((gas.vals ? 'valse start -- ' : '') + 'tik, tik, tik -- nog ' + rest.toFixed(1) + ' s', W / 2, 230);
          c.font = '500 34px "Bodoni Moda", serif'; c.fillStyle = '#F2ECDC';
          c.fillText(String(gas.taps), W / 2, 272);
        }
      }
      kopScene('De Grand Prix van het huis', 'wacht op groen en tik u naar de finish');
    },
    anim(c, W, H, a, t) {
      const b = baanVak(), sp = (P && P.spelers) || [];
      const i = Math.max(0, sp.findIndex(s2 => s2.codenaam === a.wie));
      const zij = sp.length > 2 ? -0.75 + i * 0.5 : (i ? 0.45 : -0.45);
      const afs = sp[i] ? sp[i].punten.reduce((a2, b2) => a2 + b2, 0) : 0;
      const v = 0.14 + Math.min(1, afs / (((P && P.beurten) || 4) * 100)) * 0.74;
      const [x, y] = opBaan(b, v, zij);
      c.strokeStyle = 'rgba(216,184,88,' + Math.max(0, 0.7 - t) + ')'; c.lineWidth = 2;
      for (let k = 0; k < 3; k++) { // stofwolkjes achter de kart
        c.beginPath(); c.arc(x - 8 + k * 8, y + 10 + t * 26, 3 + t * 9, 0, Math.PI * 2); c.stroke();
      }
      if (a.raak) sceneVonken(x, y - 10, t, '#E3C878');
      puntZweef(x, y - 26, a, t);
    }
  };
