/* De Rahul-mond-widget: een vaste "mond met schrijfruimte" in de bedrijfssoftware,
   zodat Rahul altijd bij de hand is. Een compacte gedokte balk: de signatuur-
   lippen (shared/mond.js) links, een schrijfveld ernaast, en een verzendknop.
   Typ je iets, dan antwoordt de zaak-AI (/api/supplier/ai: vraagt en doet) en de
   lippen bewegen mee. Inklapbaar tot alleen de lippen, zodat het nooit in de weg
   zit -- rustig, en nergens te druk.

   De balk stond permanent onderin beeld. Dat hoeft niet: je roept hem op door
   vanaf de ONDERRAND omhoog te halen (shared/randen.js), net zoals je het
   bedieningspaneel van de bovenrand haalt. Een tik op de lippen (of Escape)
   legt hem weer helemaal weg -- niet ingeklapt tot een pil in de hoek, want
   dat is precies wat we van de schermen af hebben gehaald. Zo is Rahul altijd
   binnen handbereik zonder ooit in beeld te staan.

   Alleen actief met een zaak-inlog (rtg_sup_token); zonder token doet het niets.
   Zelfstandig: plak <script src="/shared/rahul-mond.js" defer> op een werk-scherm
   en de balk richt zichzelf in. Laadt maar een keer. */
(function () {
  if (window.__rahulMond) return; window.__rahulMond = true;
  var supTok = null;
  try { supTok = localStorage.getItem('rtg_sup_token'); } catch (e) {}
  if (!supTok) return; // alleen de bedrijfssoftware (zaak)

  if (!document.documentElement.hasAttribute('data-ds') && !document.getElementById('rtgDsRuntimeCss')) {
    var link = document.createElement('link');
    link.id = 'rtgDsRuntimeCss'; link.rel = 'stylesheet'; link.href = '/ds/rtg-ds.css';
    document.head.appendChild(link);
  }

  var bar, veld, uit, mond = { praat: function () {} };

  function bouw() {
    uit = document.createElement('div'); uit.className = 'rm-uit ds-rahul-mond'; uit.hidden = true; uit.setAttribute('role', 'status'); uit.setAttribute('aria-live', 'polite');
    // weggelegd tot je hem van de onderrand omhoog haalt
    bar = document.createElement('div'); bar.className = 'rmond rm-weg ds-rahul-mond';
    // id 'rahulFab' is het huismerk voor "hier is Rahul al"; de metgezel-laag
    // ziet dit en laat zijn eigen Rahul-knop weg (alleen Samen blijft), zodat
    // er nooit twee monden naast elkaar staan -- nergens te druk.
    bar.id = 'rahulFab';
    bar.setAttribute('aria-label', 'Rahul, vraag of laat iets doen');
    var can = document.createElement('canvas'); can.width = 132; can.height = 132; can.tabIndex = 0;
    can.title = 'Rahul wegleggen'; can.setAttribute('aria-label', 'Rahul wegleggen'); can.setAttribute('role', 'button');
    veld = document.createElement('input'); veld.className = 'rm-veld'; veld.type = 'text'; veld.maxLength = 300;
    veld.placeholder = 'Vraag Rahul, of laat iets doen...';
    veld.setAttribute('aria-label', 'Vraag of opdracht aan Rahul');
    var go = document.createElement('button'); go.className = 'rm-go'; go.type = 'button'; go.textContent = '↑'; go.title = 'Vraag';
    bar.appendChild(can); bar.appendChild(veld); bar.appendChild(go);
    document.body.appendChild(uit); document.body.appendChild(bar);

    /* Pratende placeholder: de balk laat rustig wisselende voorbeelden zien van
       wat je Rahul kunt laten doen. Alleen als het veld leeg is en je er niet in
       typt (dus nooit storend), en niet bij prefers-reduced-motion. */
    (function () {
      var vb = ['Vraag Rahul, of laat iets doen...', 'bv. hoe loopt de dag?',
        'bv. zet de zaak open', 'bv. plan het rooster voor morgen',
        'bv. wat is de omzet vandaag?', 'bv. bestel voorraad bij'];
      var stil = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (stil) return; // dan blijft de eerste, rustige placeholder staan
      var i = 0;
      setInterval(function () {
        if (document.hidden || veld.value || document.activeElement === veld) return;
        i = (i + 1) % vb.length; veld.placeholder = vb[i];
      }, 4200);
    })();

    // shared/mond.js staat expliciet voor deze module op iedere host.
    try { if (window.RTGMond) mond = window.RTGMond.maak(can); else can.classList.add('rm-mond-fallback'); }
    catch (e) { can.classList.add('rm-mond-fallback'); }

    /* De lippen tikken = wegleggen. Vroeger klapte hij in tot alleen de lippen,
       maar dat is weer een pil die blijft zweven; nu gaat hij helemaal weg en
       haal je hem opnieuw van de onderrand. */
    can.addEventListener('click', function () { window.RTGRahul.sluit(); });
    can.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.RTGRahul.sluit(); } });
    go.addEventListener('click', vraag);
    veld.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); vraag(); } });
  }

  var bezig = false;
  function vraag() {
    var q = (veld.value || '').trim();
    if (!q || bezig) return;
    bezig = true; veld.value = '';
    uit.hidden = false; uit.textContent = 'Rahul denkt mee...'; mond.praat(900);
    fetch('/api/supplier/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + supTok }, body: JSON.stringify({ q: q.slice(0, 300) }) })
      .then(function (r) { return r.json(); })
      .then(async function (d) {
        uit.textContent = (d && (d.reply || d.antwoord || d.error)) || 'Ik kwam er niet uit.'; mond.praat(1400);
        var v = ((d && d.goedkeuringen) || [])[0];
        if (!v || !confirm('Controleer deze exacte actie:\n\n'+(v.samenvatting||v.pad)+'\n\nWilt u dit eenmalige voorstel uitvoeren?')) return;
        var w = d.goedkeuringWereld === 'staff' ? 'staff' : 'supplier';
        var r = await fetch('/api/'+w+'/doe/bevestig', { method:'POST', headers:{'Content-Type':'application/json',Authorization:'Bearer '+supTok}, body:JSON.stringify({goedkeuringId:v.id,akkoord:true}) });
        var b = await r.json();
        uit.textContent += r.ok && b.ok ? ' Uitgevoerd na uw bevestiging.' : ' Niet uitgevoerd: '+(b.error||'de server weigerde de actie.');
      })
      .catch(function () { uit.textContent = 'Even geen verbinding. Probeer het zo nog eens.'; })
      .then(function () { bezig = false; });
  }

  /* Lege-toestand-nudge (ook op zaak-pagina's): data-rahul-leeg="opdracht" opent
     de balk met die opdracht al ingevuld. Geen auto-verstuur; de gebruiker leest
     mee en stuurt zelf. Zelfde afspraak als bij de leden-metgezel. */
  function bindLeeg() {
    window.RTGRahul = window.RTGRahul || {};
    /* De balk tevoorschijn halen (de onderrand doet dit) en weer wegleggen. */
    window.RTGRahul.open = function () {
      if (!bar) return;
      bar.classList.remove('rm-weg');
      if (veld) veld.focus();
    };
    window.RTGRahul.sluit = function () {
      if (bar) bar.classList.add('rm-weg');
      if (uit) uit.hidden = true;
    };
    window.RTGRahul.vraag = function (tekst) {
      window.RTGRahul.open();
      if (veld) { veld.value = String(tekst || '').slice(0, 300); veld.focus(); }
    };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') window.RTGRahul.sluit(); });
    if (!window.__rahulLeegBound) {
      window.__rahulLeegBound = true;
      document.addEventListener('click', function (ev) {
        var el = ev.target && ev.target.closest ? ev.target.closest('[data-rahul-leeg]') : null;
        if (!el || !window.RTGRahul || !window.RTGRahul.vraag) return;
        ev.preventDefault(); window.RTGRahul.vraag(el.getAttribute('data-rahul-leeg'));
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { bouw(); bindLeeg(); });
  else { bouw(); bindLeeg(); }
})();
