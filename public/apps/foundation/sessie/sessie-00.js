/* Sessie: het gezin-account en het gekozen profiel, net als bij een
   streamingdienst. Eenmaal ingelogd blijft het hele gezin ingelogd op dit
   toestel; elk profiel weet wie hij is. Bewaard in localStorage, zodat de
   tools (leren, cv) je naam al kennen en de balk bovenin laat zien wie je bent. */
(function (w) {
  const dsBijStart = document.documentElement.hasAttribute('data-ds');
  var KEY = 'rtf_sessie';
  function laadSessiePresentatie(pad) {
    if (document.documentElement.hasAttribute('data-ds')) return;
    if (document.getElementById('rtgDsRuntimeCss')) return;
    var presentatie = document.createElement('link');
    presentatie.id = 'rtgDsRuntimeCss';
    presentatie.rel = 'stylesheet';
    presentatie.href = pad;
    document.head.appendChild(presentatie);
  }
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
  /* Afmelden gebeurt OOK op de server: de gezinssessie is een 128-bit token dat
     alleen als hash bestaat (server/foundation/gezinstoken.js), en wie hem hier
     weggooit zonder hem in te trekken laat een geldige sessie achter. Stil en
     zonder te wachten: een mislukte intrekking verloopt vanzelf. */
  /* Afmelden sluit de sessie op de server. Een bewaarde WISSEL-sessie (zie
     wissel() hieronder) gaat mee: die is ook een sessie van dit apparaat. */
  function afmelden(s) {
    if (!s || !s.code) return;
    [s.token, s.wissel].forEach(function (t) {
      if (!t) return;
      try { fetch('/api/foundation/gezin/sessie/intrek', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: s.code, token: t }) }).catch(function () {}); } catch (e) {}
    });
  }
  /* Profiel WISSELEN (B18): de lopende sessie blijft als `wissel` bewaard tot het
     volgende profiel met zijn eigen pincode binnen is; zo hoeft niemand de lange
     gezinscode opnieuw over te typen. De nieuwe sessie eindigt waar deze eindigt
     (de server verlengt bij wisselen niets), en daarna meldt index.html de
     bewaarde af. */
  function wissel(ss) {
    if (!ss) return;
    if (ss.token && !ss.wissel) ss.wissel = ss.token;
    delete ss.token; delete ss.profiel;
  }
  function api(p, b) {
    return fetch('/api/foundation' + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error(d.error || 'Er ging iets mis.'); e.data = d; e.needCv = !!d.needCv; e.status = r.status; throw e; } return d; }); });
  }
  /* Bestandsnamen en catalogussleutels zijn bewust gelijk. Alleen deze
     leerling- en gezinsruimtes krijgen de centrale serverdeur; de openbare
     inlog, privacy-uitleg en professionele RTF-kantoren houden hun eigen deur. */
  var BESCHERMDE_APPS = ('mail leren samen-thuis geld-later gezondheid-welzijn veilig-vertrouwd meedoen-ontdekken overhoren school schrift projecten toetsen studie presenteren klas schrijven tellen kleuren memorie verhaaltje liedjes babyboek magazine dromen bord speelhal agenda ochtend klusjes keuken verjaardagen reis vrienden markt opvoeden club gevoel rust pesten kompas steun hulpwijzer zakgeld geld cv werk budget rechten veilig gezondheid privacy mijnbanden mediawijs schoolbieb beroepen geloofbieb leerpaspoort').split(' ');
  function paginaSleutel() {
    var m = /\/([^/?#]+)\.html$/.exec(location.pathname);
    return m ? m[1].toLowerCase() : '';
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
        herstelToegangAchtergrond();
        document.documentElement.classList.remove('rtf-toegang-dicht', 'ds-foundation-dicht');
        document.documentElement.setAttribute('data-rtf-groep', d.groep || 'kind');
        try { window.dispatchEvent(new CustomEvent('rtf-toegang', { detail: d })); } catch (e) {}
        return d;
      }).catch(function () { toegangSlot('De toegangscontrole is nu niet bereikbaar. Uit veiligheid blijft deze ruimte dicht; probeer het zo opnieuw.', false); return null; });
  }
  /* EEN GEZIN ZONDER EIGENAAR-ACCOUNT (eigenaarsbesluit 19 oktober 2026: gebruiken
     vraagt een account). Buiten de demo antwoordt de server op een gezinstoken
     van een anoniem gezin met 401 en `accountNodig`. Dan is de bewaarde sessie
     niets meer waard: hij gaat weg, en de gezinsdeur wijst de weg naar een gezin
     aan het account van een ouder. Eén plek, omdat elk Foundation-scherm zijn
     eigen fetch heeft; de server blijft de poort, dit is alleen de weg terug. */
  if (w.fetch && !w.__rtfAccountNodig) {
    w.__rtfAccountNodig = true;
    var kaleFetch = w.fetch;
    w.fetch = function () {
      return kaleFetch.apply(this, arguments).then(function (r) {
        if (r && r.status === 401 && /\/api\/(rtf|foundation)\//.test(String(r.url || ''))) {
          r.clone().json().then(function (d) {
            if (d && d.accountNodig && Sessie.actief()) { schrijf(null); Sessie.deur('gezin'); }
          }).catch(function () {});
        }
        return r;
      });
    };
  }
