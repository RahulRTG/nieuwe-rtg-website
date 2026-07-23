/* De Rahul-mond-widget: een vaste "mond met schrijfruimte" in de bedrijfssoftware,
   zodat Rahul altijd bij de hand is. Een compacte gedokte balk: de signatuur-
   lippen (shared/mond.js) links, een schrijfveld ernaast, en een verzendknop.
   Typ je iets, dan antwoordt de zaak-AI (/api/supplier/ai: vraagt en doet) en de
   lippen bewegen mee. Inklapbaar tot alleen de lippen, zodat het nooit in de weg
   zit -- rustig, en nergens te druk.

   Alleen actief met een zaak-inlog (rtg_sup_token); zonder token doet het niets.
   Zelfstandig: plak <script src="/shared/rahul-mond.js" defer> op een werk-scherm
   en de balk richt zichzelf in. Laadt maar een keer. */
(function () {
  if (window.__rahulMond) return; window.__rahulMond = true;
  var supTok = null;
  try { supTok = localStorage.getItem('rtg_sup_token'); } catch (e) {}
  if (!supTok) return; // alleen de bedrijfssoftware (zaak)

  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var open = false;
  try { open = localStorage.getItem('rtg_mond_open') !== '0'; } catch (e) {}

  var css =
    '.rmond{position:fixed;left:50%;transform:translateX(-50%);' +
    'bottom:calc(env(safe-area-inset-bottom,0px) + 0.7rem);z-index:34;' +
    'display:flex;align-items:center;gap:.5rem;background:#0C0C0B;' +
    'border:1px solid var(--gold,#857007);border-radius:999px;padding:.32rem .4rem .32rem .32rem;' +
    'box-shadow:0 10px 30px rgba(0,0,0,.5);font-family:Inter,system-ui,sans-serif;max-width:min(30rem,92vw);}' +
    '.rmond canvas{width:2.2rem;height:2.2rem;border-radius:50%;background:#0C0C0B;flex:0 0 auto;cursor:pointer;display:block;}' +
    '.rmond .rm-veld{flex:1;min-width:0;background:transparent;border:none;outline:none;color:#F4F1EC;font:inherit;font-size:.86rem;padding:.2rem .2rem;}' +
    '.rmond .rm-veld::placeholder{color:rgba(244,241,236,.55);}' +
    '.rmond .rm-go{flex:0 0 auto;width:1.9rem;height:1.9rem;border-radius:50%;border:none;cursor:pointer;' +
    'background:var(--gold,#857007);color:#0C0C0B;font-size:1rem;line-height:1;display:flex;align-items:center;justify-content:center;}' +
    '.rmond.rm-dicht{padding:.28rem;}' +
    '.rmond.rm-dicht .rm-veld,.rmond.rm-dicht .rm-go{display:none;}' +
    '.rm-uit{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 3.6rem);' +
    'z-index:34;max-width:min(30rem,92vw);background:#151312;border:1px solid var(--gold,#857007);border-radius:14px;' +
    'padding:.6rem .8rem;color:#eee;font-family:Inter,system-ui,sans-serif;font-size:.85rem;line-height:1.5;' +
    'box-shadow:0 10px 30px rgba(0,0,0,.5);white-space:pre-wrap;max-height:40vh;overflow-y:auto;}' +
    '.rm-uit[hidden]{display:none;}' +
    '@media print{.rmond,.rm-uit{display:none;}}';

  function stijl() { var s = document.createElement('style'); s.textContent = css; (document.head || document.documentElement).appendChild(s); }

  var bar, veld, uit, mond = { praat: function () {} };

  function bouw() {
    stijl();
    uit = document.createElement('div'); uit.className = 'rm-uit'; uit.hidden = true; uit.setAttribute('role', 'status'); uit.setAttribute('aria-live', 'polite');
    bar = document.createElement('div'); bar.className = 'rmond' + (open ? '' : ' rm-dicht');
    // id 'rahulFab' is het huismerk voor "hier is Rahul al"; de metgezel-laag
    // ziet dit en laat zijn eigen Rahul-knop weg (alleen Samen blijft), zodat
    // er nooit twee monden naast elkaar staan -- nergens te druk.
    bar.id = 'rahulFab';
    bar.setAttribute('aria-label', 'Rahul, vraag of laat iets doen');
    var can = document.createElement('canvas'); can.width = 132; can.height = 132; can.title = 'Rahul';
    veld = document.createElement('input'); veld.className = 'rm-veld'; veld.type = 'text'; veld.maxLength = 300;
    veld.placeholder = 'Vraag Rahul, of laat iets doen...';
    veld.setAttribute('aria-label', 'Vraag of opdracht aan Rahul');
    var go = document.createElement('button'); go.className = 'rm-go'; go.type = 'button'; go.textContent = '↑'; go.title = 'Vraag';
    bar.appendChild(can); bar.appendChild(veld); bar.appendChild(go);
    document.body.appendChild(uit); document.body.appendChild(bar);

    // de lippen laden (shared/mond.js); lukt dat niet, dan een rustige stip
    var s = document.createElement('script'); s.src = '/shared/mond.js';
    s.onload = function () { try { if (window.RTGMond) mond = RTGMond.maak(can); } catch (e) {} };
    s.onerror = function () { can.style.background = 'radial-gradient(circle,#C23A5E,#7F1634)'; };
    document.head.appendChild(s);

    // de lippen tikken = in-/uitklappen (het schrijfveld tonen of verbergen)
    can.addEventListener('click', function () {
      open = bar.classList.toggle('rm-dicht') ? false : true;
      try { localStorage.setItem('rtg_mond_open', open ? '1' : '0'); } catch (e) {}
      if (open) veld.focus();
    });
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
      .then(function (d) { uit.textContent = (d && (d.reply || d.antwoord || d.error)) || 'Ik kwam er niet uit.'; mond.praat(1400); })
      .catch(function () { uit.textContent = 'Even geen verbinding. Probeer het zo nog eens.'; })
      .then(function () { bezig = false; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bouw); else bouw();
})();
