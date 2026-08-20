/* verplaatsen: een surface aan zijn gouden greep verslepen */
  function sleep(s, ev) {
    var m = meet();
    var start = s.el.getBoundingClientRect();
    var vakR = schil.vak.getBoundingClientRect();
    var dx = ev.clientX - start.left, dy = ev.clientY - start.top;
    var rand = null;
    s.el.setAttribute('data-sleept', '');
    maakActief(s);

    function beweeg(e) {
      var x = e.clientX - vakR.left - dx, y = e.clientY - vakR.top - dy;
      s.el.style.left = x + 'px'; s.el.style.top = y + 'px';
      rand = randBij(e.clientX - vakR.left, e.clientY - vakR.top, m);
      toonDok(rand, m);
    }
    function los() {
      d.removeEventListener('pointermove', beweeg);
      d.removeEventListener('pointerup', los);
      s.el.removeAttribute('data-sleept');
      schil.dok.removeAttribute('data-aan');
      if (rand) { dok(s, rand, m); }
      else { s.eigen = true; }   // vrij neergezet: hij houdt zijn plek
    }
    d.addEventListener('pointermove', beweeg);
    d.addEventListener('pointerup', los);
  }

  function randBij(x, y, m) {
    if (x < MARGE) return RANDEN.links;
    if (x > m.b - MARGE) return RANDEN.rechts;
    if (y < MARGE) return RANDEN.boven;
    if (y > m.h - MARGE) return RANDEN.onder;
    return null;
  }

  function dokVak(rand, m) {
    var g = m.g, halfB = Math.floor((m.b - g * 3) / 2), halfH = Math.floor((m.h - g * 3) / 2);
    if (rand === RANDEN.links)  return [g, g, halfB, m.h - g * 2];
    if (rand === RANDEN.rechts) return [g * 2 + halfB, g, halfB, m.h - g * 2];
    if (rand === RANDEN.boven)  return [g, g, m.b - g * 2, halfH];
    return [g, g * 2 + halfH, m.b - g * 2, halfH];
  }

  function toonDok(rand, m) {
    if (!rand) { schil.dok.removeAttribute('data-aan'); return; }
    var v = dokVak(rand, m);
    zet(schil.dok, v[0], v[1], v[2], v[3]);
    schil.dok.setAttribute('data-aan', '');
  }

  function dok(s, rand, m) {
    var v = dokVak(rand, m);
    zet(s.el, v[0], v[1], v[2], v[3]);
    s.eigen = true;
  }

