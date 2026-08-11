/* Stand Balans, deel 1 van 2. Was /apps/balans.html.

   Dit bestand registreert GEEN stand: het zet de gedeelde stukken van de
   balans op w.RTGGeldDeel.balans en balansb.js (dat erna laadt) doet de
   registratie. De splitsing bestaat alleen om de maatregel van de repo
   (bestanden onder de 10 KB) te halen; het is samen een stand.

   Dit is de werk-privebalans (het weekbeeld en de adviezen van Rahul), geen
   boekhouding: de route is /api/balans en dat blijft hij. De toon van het
   origineel is de functie zelf: geen streaks, geen scores, geen
   schuldgevoel; een stand die u ook gewoon mag negeren.

   De recepten liggen in de Toestelkluis (OPFS) van dit toestel; geld.html
   laadt dat script niet, want negen van de tien standen hebben het niet
   nodig. Deze stand haalt /shared/toestelkluis.js er daarom zelf bij: zelfde
   oorsprong, zelfde script als op de oude pagina. */
(function (w, d) {
  'use strict';
  var $ = function (s) { return d.querySelector(s); };
  var DAGL = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

  /* De staafjes en de adviesrijen kan geen klasse van geld.html leveren;
     alleen daarvoor een eigen stukje stijl, met een id-wacht zodat het maar
     een keer in het document komt. Goud is een gevulde dag, groen een lege:
     dezelfde omkering als het origineel, want hier is leeg het doel. */
  function stijl() {
    if (d.getElementById('blStijl')) return;
    var st = d.createElement('style');
    st.id = 'blStijl';
    st.textContent =
      '#paneel .bl-week{display:flex;gap:.4rem;align-items:flex-end;margin-top:.5rem;}' +
      '#paneel .bl-dag{flex:1;text-align:center;}' +
      '#paneel .bl-staaf{margin:0 auto;width:.9rem;border-radius:4px 4px 0 0;background:var(--rtg-goud,#C9A24B);min-height:4px;}' +
      '#paneel .bl-staaf.leeg{background:var(--rtg-groen,#69B891);height:4px;}' +
      '#paneel .bl-lbl{font-size:.6rem;color:var(--rtg-soft);margin-top:.3rem;}' +
      '#paneel .bl-advies{display:flex;gap:.6rem;align-items:flex-start;margin-top:.6rem;font-size:.84rem;line-height:1.55;}' +
      '#paneel .bl-knoppen{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.8rem;}' +
      '#paneel .bl-rrij{display:flex;justify-content:space-between;align-items:center;gap:.5rem;font-size:.8rem;margin-top:.4rem;}' +
      '#paneel .bl-rrij .knop{padding:.25rem .6rem;font-size:.72rem;}' +
      '#paneel .bl-rrij .knop.stilrand{color:var(--rtg-soft);}';
    d.head.appendChild(st);
  }

  function weekHtml(b) {
    /* De hoogste dag bepaalt de schaal; minstens 1, anders deelt een lege
       week door nul. T00:00:00 erbij, net als Geld.datum: zonder die staart
       leest de browser de datum als UTC en schuift de weekdag een dag op. */
    var top = Math.max.apply(null, [1].concat(b.perDag || []));
    return '<div class="bl-week">' + (b.perDag || []).map(function (n, i) {
      n = Number(n) || 0;
      var x = new Date(String(b.dagen[i]) + 'T00:00:00');
      return '<div class="bl-dag"><div class="bl-staaf' + (n === 0 ? ' leeg' : '') +
        '" style="height:' + (n === 0 ? 4 : Math.round(8 + n / top * 44)) + 'px" title="' + n + ' afspraken"></div>' +
        '<div class="bl-lbl">' + (isNaN(x) ? '' : DAGL[x.getDay()]) + '</div></div>';
    }).join('') + '</div>' +
    '<p class="stil" style="margin-top:.6rem;">' + b.vrijeDagen + ' lege dag(en) &middot; ' +
      b.avonden + ' avondafspraken &middot; groen is een dag zonder verplichtingen.</p>';
  }

  /* De vraag gaat mee op het klembord en de leden-app opent op de chat:
     Rahul zit daar, niet hier. Zelfde weg als het origineel. */
  async function vraag(tekst) {
    try { await navigator.clipboard.writeText(String(tekst || '')); } catch (e) { /* geen klembord */ }
    w.location.href = '/apps/app.html#ai';
  }

  /* De kluis erbij halen, een keer. Mislukt het laden (heel oude browser,
     geen OPFS), dan blijft de lijst leeg en zegt bewaren dat eerlijk; de
     rest van de stand merkt er niets van. */
  var kluisBelofte = null;
  function kluis() {
    if (w.Toestelkluis) return Promise.resolve();
    if (!kluisBelofte) kluisBelofte = new Promise(function (klaar) {
      var s = d.createElement('script');
      s.src = '/shared/toestelkluis.js';
      s.onload = klaar; s.onerror = klaar;
      d.head.appendChild(s);
    });
    return kluisBelofte;
  }

  async function recepten() {
    var host = $('#blReceptLijst');
    if (!host) return;   // de stand is al gewisseld terwijl de kluis laadde
    var esc = w.Geld.esc;
    if (!w.Toestelkluis || !w.Toestelkluis.kan()) { host.innerHTML = ''; return; }
    var items = (await w.Toestelkluis.lijst()).filter(function (x) { return x.naam.indexOf('recept_') === 0; });
    host.innerHTML = items.map(function (x) {
      return '<div class="bl-rrij"><span>' + esc(x.naam.slice(7).replace(/_/g, ' ').replace(/\.txt$/, '')) + '</span>' +
        '<span style="white-space:nowrap;">' +
        '<button class="knop" type="button" data-ropen="' + esc(x.naam) + '">Lees</button> ' +
        '<button class="knop stilrand" type="button" data-rwis="' + esc(x.naam) + '" aria-label="wis recept">&#10005;</button></span></div>';
    }).join('') || '<p class="stil" style="margin-top:.4rem;">Nog geen recepten bewaard.</p>';
  }

  async function bewaar() {
    var naam = $('#blReceptNaam').value.trim(), tekst = $('#blReceptTekst').value.trim();
    if (!naam || !tekst) return;
    await kluis();
    if (!w.Toestelkluis || !w.Toestelkluis.kan()) { w.Geld.melding('De kluis van dit toestel is hier niet beschikbaar.'); return; }
    await w.Toestelkluis.bewaar('recept_' + naam + '.txt', new w.Blob([tekst], { type: 'text/plain' }));
    $('#blReceptNaam').value = ''; $('#blReceptTekst').value = '';
    recepten();
  }

  var Deel = w.RTGGeldDeel = w.RTGGeldDeel || {};
  Deel.balans = { DAGL: DAGL, stijl: stijl, weekHtml: weekHtml, vraag: vraag, kluis: kluis, recepten: recepten, bewaar: bewaar };
})(window, document);
