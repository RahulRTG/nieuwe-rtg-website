      schaduwhuls(filterId).appendChild(g);
      return g;
    }
    // van onder naar boven: uur, minuut, seconde -- elk een stap hoger boven de
    // plaat, en dus een langere en zachtere schaduw
    const uurW = wijzer(45, 10, 3.6, 'rr-schaduw');
    const minW = wijzer(71, 13, 2.7, 'rr-schaduwm');
    // de secondewijzer: dun, met lollipop en tegengewicht
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
    schaduwhuls('rr-schaduws').appendChild(secG);
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
      uurW.setAttribute('transform', 'rotate(' + (h * 30).toFixed(3) + ' 100 100)');
      minW.setAttribute('transform', 'rotate(' + (m * 6).toFixed(3) + ' 100 100)');
      secG.setAttribute('transform', 'rotate(' + (s * 6).toFixed(3) + ' 100 100)');
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

  /* ---- de klok: compacte cijfers, of de ring (data-rtg-klok="ring") ---- */
  function maakKlok(el) {
    if (!el || el.dataset.rtgKlokActief) return;
    el.dataset.rtgKlokActief = '1';
    const verf = el.dataset.rtgKlok === 'ring' ? maakRing(el) : maakCijfers(el);
    (function stap() {
      verf(new Date());
      requestAnimationFrame(stap);
    })();
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
