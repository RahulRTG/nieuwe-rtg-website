/* Sessie: het gezin-account en het gekozen profiel, net als bij een
   streamingdienst. Eenmaal ingelogd blijft het hele gezin ingelogd op dit
   toestel; elk profiel weet wie hij is. Bewaard in localStorage, zodat de
   tools (leren, cv) je naam al kennen en de balk bovenin laat zien wie je bent. */
(function (w) {
  var KEY = 'rtf_sessie';
  // de gedeelde verbindingslaag (offline-banner + satellietmodus) laadt op
  // elke RTF-pagina mee; sessie.js zit overal, dus dit is de ene plek
  try {
    if (!document.querySelector('script[src="/shared/verbinding.js"]')) {
      var vscript = document.createElement('script');
      vscript.src = '/shared/verbinding.js';
      (document.head || document.documentElement).appendChild(vscript);
    }
    /* De balk hieronder draagt pictogrammen (data-glyf). Dit bestand zit op elk
       Foundation-scherm en shared/glyf.js op vier; zonder deze regel zou de
       berichtenknop op zevenenzestig schermen een leeg vakje zijn -- precies de
       fout die op de hub al zesenvijftig keer stond. Zelfde patroon als de
       verbindingslaag hierboven: de component brengt mee wat hij nodig heeft. */
    if (!document.querySelector('script[src="/shared/glyf.js"]')) {
      var gscript = document.createElement('script');
      gscript.src = '/shared/glyf.js';
      (document.head || document.documentElement).appendChild(gscript);
    }
  } catch (e) {}
  function lees() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function api(p, b) {
    return fetch('/api/foundation' + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error(d.error || 'Er ging iets mis.'); e.data = d; e.needCv = !!d.needCv; e.status = r.status; throw e; } return d; }); });
  }
  /* Bestandsnamen en catalogussleutels zijn bewust gelijk. Alleen deze
     leerling- en gezinsruimtes krijgen de centrale serverdeur; de openbare
     inlog, privacy-uitleg en professionele RTF-kantoren houden hun eigen deur. */
  var BESCHERMDE_APPS = ('mail leren overhoren school schrift projecten toetsen studie presenteren klas schrijven tellen kleuren memorie verhaaltje liedjes babyboek magazine dromen bord speelhal agenda ochtend klusjes keuken verjaardagen reis vrienden markt opvoeden club gevoel rust pesten kompas steun hulpwijzer zakgeld geld cv werk budget rechten veilig gezondheid privacy mijnbanden mediawijs schoolbieb beroepen geloofbieb leerpaspoort').split(' ');
  function paginaSleutel() {
    var m = /\/([^/?#]+)\.html$/.exec(location.pathname);
    return m ? m[1].toLowerCase() : '';
  }
  function toegangSlot(reden, laden) {
    var id = 'rtf-toegang-slot', el = document.getElementById(id);
    document.documentElement.classList.add('rtf-toegang-dicht');
    if (!document.getElementById('rtf-toegang-stijl')) {
      var stijl = document.createElement('style'); stijl.id = 'rtf-toegang-stijl';
      stijl.textContent = 'html.rtf-toegang-dicht body>*:not(#rtf-toegang-slot){visibility:hidden!important}html.rtf-toegang-dicht #rtf-toegang-slot{visibility:visible!important}#rtf-toegang-slot [data-rtf-uitweg]{padding:.65rem .85rem;border:1px solid #4a463d;border-radius:0;color:#f6f1e7;text-decoration:none}';
      (document.head || document.documentElement).appendChild(stijl);
    }
    if (!el) {
      el = document.createElement('dialog'); el.id = id; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-modal', 'true');
      el.style.cssText = 'position:fixed;inset:0;z-index:2147483000;width:100%;height:100%;max-width:none;max-height:none;margin:0;border:0;display:grid;place-items:center;padding:1rem;background:#0c0c0b;color:#f6f1e7;font-family:Inter,system-ui,sans-serif';
      (document.body || document.documentElement).appendChild(el);
    }
    var s = lees(), beheer = !!(s && s.profiel && s.profiel.beheerder);
    el.innerHTML = '<div style="width:min(92vw,34rem);padding:1.35rem;border:1px solid #3a3730;border-radius:0;background:#151513;box-shadow:0 24px 80px rgba(0,0,0,.55)">' +
      '<div style="font:600 .68rem/1 Inter;letter-spacing:.17em;text-transform:uppercase;color:#c9a24b">RTF veilige toegang</div>' +
      '<h1 style="font:500 1.75rem/1.15 Georgia,serif;margin:.55rem 0">' + (laden ? 'Jouw passen worden gecontroleerd…' : 'Deze ruimte blijft nog dicht') + '</h1>' +
      '<p style="color:#bdb8ad;line-height:1.55;margin:0 0 1rem">' + esc(reden || 'De server controleert je leeftijd en passen voordat dit scherm opengaat.') + '</p>' +
      (laden ? '<div style="height:3px;border-radius:0;background:linear-gradient(90deg,#c23a5e,#c9a24b,#69b891)"></div>' :
        '<div style="display:flex;gap:.5rem;flex-wrap:wrap"><a data-rtf-wissel href="index.html#profielen" style="padding:.65rem .85rem;border-radius:0;background:#f6f1e7;color:#111;text-decoration:none;font-weight:700">Kies een profiel</a>' +
        '<a data-rtf-uitweg href="/apps/app.html">Naar RTG OS</a>' +
        (beheer ? '<a href="beheer.html" style="padding:.65rem .85rem;border:1px solid #4a463d;border-radius:0;color:#f6f1e7;text-decoration:none">Leeftijd instellen</a>' : '') + '</div>') + '</div>';
    var wissel = el.querySelector('[data-rtf-wissel]');
    if (wissel) wissel.onclick = function () {
      var ss = lees(); if (ss) { delete ss.token; delete ss.profiel; localStorage.setItem(KEY, JSON.stringify(ss)); }
    };
    try { if (!el.open) el.showModal(); } catch (e) {}
    return el;
  }
  function controleerToegang(gedwongen) {
    var sleutel = typeof gedwongen === 'string' && gedwongen ? gedwongen : paginaSleutel();
    var campus = sleutel === 'campus';
    if (!campus && BESCHERMDE_APPS.indexOf(sleutel) < 0) return Promise.resolve(null);
    var s = lees();
    if (!s || !s.code || !s.token) { toegangSlot('Kies eerst jouw eigen profiel. Zonder geldige Foundation-pas opent geen leerlingenscherm.', false); return Promise.resolve(null); }
    toegangSlot('De server controleert je Foundation-pas, leeftijdspas en Schoolpas.', true);
    return fetch('/api/rtf/toegang', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: s.code, token: s.token, appId: campus ? null : 'rtf-' + sleutel, scherm: campus ? 'campus' : 'app' }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { d.httpOk = r.ok; return d; }); })
      .then(function (d) {
        if (!d.httpOk || !d.toegestaan) { toegangSlot(d.reden || 'Deze ruimte hoort niet bij jouw leeftijd of pas.', false); return d; }
        var el = document.getElementById('rtf-toegang-slot'); if (el) { try { el.close(); } catch (e) {} el.remove(); }
        document.documentElement.classList.remove('rtf-toegang-dicht');
        document.documentElement.setAttribute('data-rtf-groep', d.groep || 'kind');
        try { window.dispatchEvent(new CustomEvent('rtf-toegang', { detail: d })); } catch (e) {}
        return d;
      }).catch(function () { toegangSlot('De toegangscontrole is nu niet bereikbaar. Uit veiligheid blijft deze ruimte dicht; probeer het zo opnieuw.', false); return null; });
  }
