/* het gesprek in stappen */
  function gesprek(el, opt) {
    if (!el || !opt || !opt.stappen || !opt.stappen.length) return null;
    stijl();
    var stappen = opt.stappen, antw = {}, i = 0, bezig = false;

    el.innerHTML =
      '<div class="rp">' +
      '<canvas class="rp-mond" width="440" height="200" aria-hidden="true"></canvas>' +
      '<div class="rp-zin" role="status" aria-live="polite"></div>' +
      '<div class="rp-rij"><select hidden aria-hidden="true"></select>' +
      '<input autocomplete="off" spellcheck="false">' +
      '<button type="button" aria-label="' + esc(opt.stuurLabel || 'Stuur') + '">&#8594;</button></div>' +
      '<div class="rp-paden"></div></div>';

    var zin = el.querySelector('.rp-zin');
    var rij = el.querySelector('.rp-rij');
    var inp = el.querySelector('.rp-rij input');
    var keus = el.querySelector('.rp-rij select');
    var go = el.querySelector('.rp-rij button');
    var paden = el.querySelector('.rp-paden');

    // de signatuurmond, als shared/mond.js er is; anders halen we het doek weg
    var mond = null, doek = el.querySelector('.rp-mond');
    if (w.RTGMond && w.RTGMond.maak) mond = w.RTGMond.maak(doek);
    else doek.parentNode.removeChild(doek);

    function zeg(tekst) {
      zin.textContent = tekst;
      if (mond && mond.praat) mond.praat(Math.min(4200, 420 + String(tekst).length * 38));
    }

    /* De zinnen mogen ook FUNCTIES zijn. Dat is er niet voor de sier: de
       vertaaltabel van een pagina staat soms verderop in het document dan het
       script dat de poort opzet, en dan zou Rahul in het Nederlands blijven
       hangen op een Engels scherm. Een functie wordt pas gelezen als de vraag
       in beeld komt, en bij het wisselen van taal opnieuw. */
    function lees(v) { return typeof v === 'function' ? v() : v; }

    /* Een stap is een tekstregel OF een keuze uit een lijst (type:'keuze', met
       opties() die [{waarde,label}] geeft). Meer smaken zijn er niet: een poort
       waar je doorheen praat hoort simpel te blijven. */
    function toonStap() {
      var s = stappen[i];
      zeg(lees(s.vraag));
      var isKeuze = s.type === 'keuze';
      keus.hidden = !isKeuze; keus.setAttribute('aria-hidden', isKeuze ? 'false' : 'true');
      inp.hidden = isKeuze;
      if (isKeuze) {
        var lijst = (typeof s.opties === 'function' ? s.opties(antw) : s.opties) || [];
        keus.innerHTML = '';
        lijst.forEach(function (o) {
          var op = d.createElement('option');
          op.value = o.waarde; op.textContent = o.label;
          keus.appendChild(op);
        });
        keus.setAttribute('aria-label', lees(s.vraag));
        rij.classList.add('vol');
        try { keus.focus(); } catch (e) {}
        return;
      }
      inp.type = s.type === 'password' ? 'password' : (s.type || 'text');
      inp.placeholder = lees(s.plho) || '';
      inp.setAttribute('aria-label', lees(s.vraag));
      inp.setAttribute('autocomplete', s.autocomplete || 'off');
      if (s.inputmode) inp.setAttribute('inputmode', s.inputmode); else inp.removeAttribute('inputmode');
      if (s.maxlength) inp.maxLength = s.maxlength; else inp.removeAttribute('maxlength');
      inp.value = '';
      rij.classList.remove('vol');
      try { inp.focus(); } catch (e) {}
    }

    /* Een fout is hier geen rood blokje maar gewoon iets dat Rahul zegt. Daarna
       staat dezelfde vraag er weer; bij een wachtwoord beginnen we het veld
       leeg, want het oude typwerk helpt je niet verder. */
    function misging(bericht) {
      zeg(bericht || 'Dat lukte niet. Probeert u het nog eens.');
      inp.value = '';
      rij.classList.remove('vol');
      try { inp.focus(); } catch (e) {}
    }

    async function verder() {
      if (bezig) return;
      var s = stappen[i];
      var waarde = s.type === 'keuze' ? keus.value : inp.value.trim();
      if (!waarde && !s.mag_leeg) { try { (s.type === 'keuze' ? keus : inp).focus(); } catch (e) {} return; }
      antw[s.sleutel] = waarde;
      /* Een stap mag zelf iets ophalen voordat de volgende vraag komt (de
         meldkamer haalt op de korpscode de lijst met mensen op). Gooit dat,
         dan zegt Rahul het en staat dezelfde vraag er weer. */
      var laatste = i >= stappen.length - 1;
      if (s.doe || laatste) {
        bezig = true; inp.disabled = true; keus.disabled = true; go.disabled = true;
        if (opt.wacht && laatste) zeg(lees(opt.wacht));
        try {
          if (s.doe) await s.doe(antw);
          if (laatste) await opt.klaar(antw);
          // gelukt en klaar: de pagina neemt het over (scherm wisselt)
          bezig = false; inp.disabled = false; keus.disabled = false; go.disabled = false;
          if (!laatste) { i++; return toonStap(); }
          return;
        } catch (err) {
          bezig = false; inp.disabled = false; keus.disabled = false; go.disabled = false;
          i = typeof err.stap === 'number' ? err.stap : i;
          return misging(err && err.message);
        }
      }
      i++; toonStap();
    }

    go.addEventListener('click', verder);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); verder(); } });
    keus.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); verder(); } });
    inp.addEventListener('input', function () { rij.classList.toggle('vol', !!inp.value); });

    var padKnoppen = [];
    (opt.zijpaden || []).forEach(function (p) {
      var b = d.createElement('button');
      b.type = 'button'; b.className = 'rp-pad'; b.textContent = lees(p.tekst);
      b.addEventListener('click', p.doe);
      paden.appendChild(b);
      padKnoppen.push({ knop: b, bron: p.tekst });
    });

    /* Opnieuw lezen zonder het gesprek te storen: de vraag en de zijpaden
       krijgen hun tekst weer, wat er getypt is blijft staan. Eenmaal vlak na
       het opbouwen (de vertaaltabel kan later in de pagina staan) en daarna bij
       elke taalwissel. */
    function hertaal() {
      if (!bezig) { zin.textContent = lees(stappen[i].vraag); inp.placeholder = lees(stappen[i].plho) || ''; }
      padKnoppen.forEach(function (p) { p.knop.textContent = lees(p.bron); });
    }
    setTimeout(hertaal, 0);
    w.addEventListener('rtglang', hertaal);

    if (opt.groet) { zeg(lees(opt.groet)); setTimeout(toonStap, 900); } else toonStap();
    return { zeg: zeg, misging: misging, hertaal: hertaal,
      opnieuw: function () { i = 0; antw = {}; toonStap(); } };
  }

  w.RTGPoort = { gesprek: gesprek };
})(window, document);
