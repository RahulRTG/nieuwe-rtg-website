/* de wijzers laten draaien */
      wijzers.appendChild(g);
      let vorige = null;
      return { draai: graden => {
        const r = 'rotate(' + graden + ' 100 100)';
        if (r === vorige) return;
        vorige = r;
        sHuls.setAttribute('transform', r);
        g.setAttribute('transform', r);
      } };
    }
    // van onder naar boven: uur, minuut, seconde -- elk een stap hoger boven de
    // plaat, en dus een verder verschoven en lichtere schaduw
    const uurW = wijzer(45, 10, 3.6, 0.7, 0.85, 0.4);
    const minW = wijzer(71, 13, 2.7, 1.1, 1.35, 0.34);
    // de secondewijzer: dun, met lollipop en tegengewicht. De schaduw is een
    // zwarte kopie van lijn, ring en tegengewicht (de lume-kern werpt er geen:
    // die ligt verzonken in de ring).
    const secSchaduw = document.createElementNS(NS, 'g');
    {
      const sl = document.createElementNS(NS, 'line');
      sl.setAttribute('x1', 100); sl.setAttribute('y1', 116); sl.setAttribute('x2', 100); sl.setAttribute('y2', 14);
      sl.setAttribute('stroke', '#000'); sl.setAttribute('stroke-width', 0.9);
      const so = document.createElementNS(NS, 'circle');
      so.setAttribute('cx', 100); so.setAttribute('cy', 30); so.setAttribute('r', 2.3);
      so.setAttribute('fill', 'none'); so.setAttribute('stroke', '#000'); so.setAttribute('stroke-width', 1);
      const sc = document.createElementNS(NS, 'circle');
      sc.setAttribute('cx', 100); sc.setAttribute('cy', 116); sc.setAttribute('r', 1.9); sc.setAttribute('fill', '#000');
      secSchaduw.append(sl, so, sc);
    }
    const secSchaduwHuls = schaduwhuls(1.6, 1.95, 0.26);
    secSchaduwHuls.appendChild(secSchaduw);
    const secG = document.createElementNS(NS, 'g');
    const secL = document.createElementNS(NS, 'line');
    secL.setAttribute('x1', 100); secL.setAttribute('y1', 116); secL.setAttribute('x2', 100); secL.setAttribute('y2', 14);
    secL.setAttribute('class', 'rr-sec');
    const secLol = document.createElementNS(NS, 'circle');
    secLol.setAttribute('cx', 100); secLol.setAttribute('cy', 30); secLol.setAttribute('r', 2.3); secLol.setAttribute('class', 'rr-seclolring');
    const secLolK = document.createElementNS(NS, 'circle');
    secLolK.setAttribute('cx', 100); secLolK.setAttribute('cy', 30); secLolK.setAttribute('r', 1.05); secLolK.setAttribute('class', 'rr-lume');
    const secCw = document.createElementNS(NS, 'circle');
    secCw.setAttribute('cx', 100); secCw.setAttribute('cy', 116); secCw.setAttribute('r', 1.9); secCw.setAttribute('class', 'rr-seccw');
    secG.append(secL, secLol, secLolK, secCw);
    wijzers.appendChild(secG);
    // de centrale kap
    maak('circle', { cx: 100, cy: 100, r: 2.9, fill: goud, stroke: '#3E2E0C', 'stroke-width': 0.2 });
    maak('circle', { cx: 100, cy: 100, r: 0.95, fill: '#191309' });

    el.textContent = '';
    el.append(svg);
    /* De eerste meting kan vallen voordat Bodoni binnen is, en dan meet je de
       terugval-serif. Zodra het echte lettertype er is, nog een keer passen. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => pasInKastje(dag)).catch(() => {});
    }

    let vorigeDag = '', vorigeDatum = '', vorigeKalenderdag = '';
    return d => {
      // de wijzers exact op de tijd (uur uit minuten, minuut uit seconden)
      const ms = RUSTIG ? 0 : d.getMilliseconds();
      const s = d.getSeconds() + ms / 1000;
      const m = d.getMinutes() + s / 60;
      const h = (d.getHours() % 12) + m / 60;
      uurW.draai((h * 30).toFixed(3));
      minW.draai((m * 6).toFixed(3));
      const secR = 'rotate(' + (s * 6).toFixed(3) + ' 100 100)';
      secSchaduw.setAttribute('transform', secR);
      secG.setAttribute('transform', secR);
      /* de datum verspringt niet stilletjes: precies om 00:00 rolt de schijf
         om. De eerste keer (en na een taalwissel) staat hij er direct. */
      const dagNr = String(d.getDate());
      if (dagNr !== vorigeDatum) {
        if (vorigeDatum === '') datumTekst.textContent = dagNr;
        else slaOm(datumTekst, dagNr, 10);
        vorigeDatum = dagNr;
      }
      // de weekdag in de taal van de gebruiker (paginataal, anders apparaattaal)
      const taal = document.documentElement.lang || navigator.language || 'nl';
      let wd; try { wd = d.toLocaleDateString(taal, { weekday: 'long' }); } catch (e) { wd = d.toLocaleDateString(undefined, { weekday: 'long' }); }
      const cap = wd ? wd.charAt(0).toUpperCase() + wd.slice(1) : '';
      const kalenderdag = d.toDateString();
      if (cap !== vorigeDag) {
        if (vorigeDag && kalenderdag !== vorigeKalenderdag) slaOm(dag, cap, 10);
        else dag.textContent = cap;
        // alleen hier meten, niet elk beeldje: getComputedTextLength dwingt een
        // layout af, en de weekdag verandert hooguit een keer per dag
        pasInKastje(dag);
        vorigeDag = cap;
      }
      vorigeKalenderdag = kalenderdag;
    };
  }

  /* ---- de klok: compacte cijfers, of de ring (data-rtg-klok="ring") ----
     De lus liep hier onvoorwaardelijk op 60 beeldjes per seconde door -- ook
     als de klok in een verborgen view stond of het tabblad op de achtergrond.
     Nu: uit beeld (IntersectionObserver) of tabblad verborgen = stil, en bij
     terugkeer loopt hij meteen weer (de wijzers staan dan direct goed, want
     elke stap rekent uit de echte tijd). In de rustige stand (prefers-reduced-
     motion) tikt hij per seconde, dus volstaat vier keer per seconde kijken. */
  function maakKlok(el) {
    if (!el || el.dataset.rtgKlokActief) return;
    el.dataset.rtgKlokActief = '1';
    const verf = el.dataset.rtgKlok === 'ring' ? maakRing(el) : maakCijfers(el);
    let inBeeld = true, loopt = false;
    function stap() {
      loopt = true;
      if (!inBeeld || document.hidden) { loopt = false; return; }
      verf(new Date());
      if (RUSTIG) setTimeout(stap, 250);
      else requestAnimationFrame(stap);
    }
    function wek() { if (!loopt && inBeeld && !document.hidden) stap(); }
    if (window.IntersectionObserver) {
      inBeeld = false;
      new IntersectionObserver(rijen => {
        inBeeld = rijen.some(r => r.isIntersecting);
        wek();
      }, { threshold: 0.01 }).observe(el);
    }
    document.addEventListener('visibilitychange', wek);
    stap();
  }

  /* ---- de lange datum eronder, in de taal van de pagina ---- */
  function maakDatum(el) {
    if (!el || el.dataset.rtgDatumActief) return;
    el.dataset.rtgDatumActief = '1';
    const verf = () => {
      const taal = document.documentElement.lang || 'nl';
      try { el.textContent = new Date().toLocaleDateString(taal, { weekday: 'long', day: 'numeric', month: 'long' }); }
      catch (e) { el.textContent = new Date().toLocaleDateString(); }
    };
    verf();
    /* De lange datum slaat ECHT om 00:00 om: de timer mikt precies op
       middernacht en zet zichzelf daarna opnieuw voor de volgende nacht.
       Komt het tabblad terug uit de slaap (de timer kan dan gemist zijn),
       dan zet visibilitychange de datum meteen recht. */
    (function plan() {
      const nu = new Date();
      const middernacht = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() + 1, 0, 0, 0, 200);
      setTimeout(() => { verf(); plan(); }, Math.max(500, middernacht - nu));
    })();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) verf(); });
    // volgt de taalkiezer: zodra de pagina van taal wisselt (rtglang), staat de
    // lange datum meteen in de nieuwe taal, niet pas bij de volgende ronde
    window.addEventListener('rtglang', verf);
  }

  function alles() {
    document.querySelectorAll('[data-rtg-klok]').forEach(maakKlok);
    document.querySelectorAll('[data-rtg-datum]').forEach(maakDatum);
  }

  window.RTGKlok = { maakKlok, maakDatum, alles };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', alles);
  else alles();
})();
