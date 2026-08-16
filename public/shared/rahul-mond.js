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

  var css =
    '.rmond{position:fixed;left:50%;transform:translateX(-50%);' +
    /* Rahul komt van de onderrand over de app heen; de werkschillen van de
       zaak-apps staan zelf al vast op z-index 60 tot ruim 100, dus hij moet
       daarboven. Alleen het bedieningspaneel (9995) gaat er nog overheen. */
    'bottom:calc(env(safe-area-inset-bottom,0px) + 0.7rem);z-index:9981;' +
    'display:flex;align-items:center;gap:.5rem;background:#0C0C0B;' +
    'border:1px solid var(--gold,#857007);border-radius:999px;padding:.32rem .4rem .32rem .32rem;' +
    'box-shadow:0 10px 30px rgba(0,0,0,.5);font-family:Inter,system-ui,sans-serif;max-width:min(30rem,92vw);}' +
    '.rmond canvas{width:2.2rem;height:2.2rem;border-radius:50%;background:#0C0C0B;flex:0 0 auto;cursor:pointer;display:block;}' +
    '.rmond .rm-veld{flex:1;min-width:0;background:transparent;border:none;outline:none;color:#F4F1EC;font:inherit;font-size:.86rem;padding:.2rem .2rem;}' +
    '.rmond .rm-veld::placeholder{color:rgba(244,241,236,.55);}' +
    '.rmond .rm-go{flex:0 0 auto;width:1.9rem;height:1.9rem;border-radius:50%;border:none;cursor:pointer;' +
    'background:var(--gold,#857007);color:#0C0C0B;font-size:1rem;line-height:1;display:flex;align-items:center;justify-content:center;}' +
    '.rmond.rm-weg,.rm-uit.rm-weg{display:none;}' +
    '.rm-uit{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 3.6rem);' +
    'z-index:9982;max-width:min(30rem,92vw);background:#151312;border:1px solid var(--gold,#857007);border-radius:14px;' +
    'padding:.6rem .8rem;color:#eee;font-family:Inter,system-ui,sans-serif;font-size:.85rem;line-height:1.5;' +
    'box-shadow:0 10px 30px rgba(0,0,0,.5);white-space:pre-wrap;max-height:40vh;overflow-y:auto;}' +
    '.rm-uit[hidden]{display:none;}' +
    '@media print{.rmond,.rm-uit{display:none;}}';

  function stijl() { var s = document.createElement('style'); s.textContent = css; (document.head || document.documentElement).appendChild(s); }

  var bar, veld, uit, mond = { praat: function () {} };

  function bouw() {
    stijl();
    uit = document.createElement('div'); uit.className = 'rm-uit'; uit.hidden = true; uit.setAttribute('role', 'status'); uit.setAttribute('aria-live', 'polite');
    // weggelegd tot je hem van de onderrand omhoog haalt
    bar = document.createElement('div'); bar.className = 'rmond rm-weg';
    // id 'rahulFab' is het huismerk voor "hier is Rahul al"; de metgezel-laag
    // ziet dit en laat zijn eigen Rahul-knop weg (alleen Samen blijft), zodat
    // er nooit twee monden naast elkaar staan -- nergens te druk.
    bar.id = 'rahulFab';
    bar.setAttribute('aria-label', 'Rahul, vraag of laat iets doen');
    var can = document.createElement('canvas'); can.width = 132; can.height = 132;
    can.title = 'Rahul wegleggen'; can.setAttribute('aria-label', 'Rahul wegleggen');
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

    // de lippen laden (shared/mond.js); lukt dat niet, dan een rustige stip
    var s = document.createElement('script'); s.src = '/shared/mond.js';
    s.onload = function () { try { if (window.RTGMond) mond = RTGMond.maak(can); } catch (e) {} };
    s.onerror = function () { can.style.background = 'radial-gradient(circle,#C23A5E,#7F1634)'; };
    document.head.appendChild(s);

    /* De lippen tikken = wegleggen. Vroeger klapte hij in tot alleen de lippen,
       maar dat is weer een pil die blijft zweven; nu gaat hij helemaal weg en
       haal je hem opnieuw van de onderrand. */
    can.addEventListener('click', function () { window.RTGRahul.sluit(); });
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
    // de knop-stijl, voor het geval de leden-metgezel niet meedraait op deze pagina
    if (!document.getElementById('rahul-leeg-stijl')) {
      var s2 = document.createElement('style'); s2.id = 'rahul-leeg-stijl';
      s2.textContent = '.rahul-leeg-knop{display:inline-flex;align-items:center;gap:.4rem;background:transparent;border:1px solid var(--gold,#857007);color:var(--gold,#857007);border-radius:999px;padding:.5rem .9rem;font-family:Inter,system-ui,sans-serif;font-size:.83rem;font-weight:600;cursor:pointer;}.rahul-leeg-knop:hover{background:var(--gold,#857007);color:#0C0C0B;}';
      (document.head || document.documentElement).appendChild(s2);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { bouw(); bindLeeg(); });
  else { bouw(); bindLeeg(); }
})();
