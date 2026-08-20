/* RTG Link: HET BEDOELINGSSCHERM -- wie, wat, waarom, welke gegevens, hoe lang.
   Zie LINK.md par. 2 (de weg) en par. 4 stap 3.

   DIT IS HET SCHERM WAAR DE HELE LAAG OM DRAAIT. Een gewone QR vertelt je niets:
   je scant en er gebeurt iets. Hier staat er eerst wat er gaat gebeuren, van wie
   het komt, wat de ander van je te weten komt en hoe lang het nog geldt -- en pas
   daarna is er een knop. Dat is het verschil tussen scannen en instemmen.

   DE APP HAALT OP, DIT SCHERM TOONT. Hij doet zelf geen enkel verzoek: elke app
   heeft zijn eigen weg naar de server (API.call bij de leverancier, api() in de
   ledenschermen), en een tweede tokengreep hier zou precies de fout van LAT.md
   regel 4 terughalen. Wat erin gaat is het antwoord van /api/link/los; wat
   eruit komt is de gekozen intentie, of niets.

   HIJ VOERT OOK NIETS UIT. De intentie draagt zijn eigen weg (`weg` + `methode`)
   en de app roept die aan. Zo blijft dit een scherm en geen tweede deur.

   OPBOUW IS PUUR, en dat is met opzet: `opbouw()` maakt van een antwoord de
   inhoud van de kaart zonder DOM en zonder klok, zodat een toets in Node kan
   nakijken dat er nooit een knop verschijnt zonder weg, en dat de vijf vragen
   echt beantwoord worden. Zelfde gedachte als de losse helpers in shared/scanner.js. */
(function (root) {
  'use strict';

  var doc = root.document;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function klok(iso) {
    var t = Date.parse(iso);
    if (!t) return null;
    try { return new Date(t).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return null; }
  }

  /* Van een antwoord van /api/link/los naar de vijf vragen. Elk type vult ze op
     zijn eigen manier, maar ze worden alle vijf gesteld -- ook als het antwoord
     "niets" is. Een leeg veld is hier informatie: "deze code vertelt niet waarom". */
  function opbouw(antwoord, opties) {
    antwoord = antwoord || {};
    opties = opties || {};
    var o = antwoord.onderwerp || {};
    var regels = [];
    var kop = { van: null, wat: antwoord.wat || '', waarom: null };

    if (antwoord.type === 'capability') {
      kop.van = o.van || null;
      kop.wat = o.wat || antwoord.wat || '';
      kop.waarom = o.waarom || null;
      (o.velden || []).forEach(function (v) { regels.push({ l: v.naam, w: v.waarde }); });
    } else if (antwoord.type === 'persoon') {
      kop.van = o.codename || null;
      regels.push({ l: 'Band', w: o.status === 'verbonden' ? 'Verbonden' : 'Nog niet verbonden' });
    } else if (antwoord.type === 'plaats' || antwoord.type === 'zaak') {
      kop.van = o.naam || o.code || null;
      if (o.plek) regels.push({ l: 'Plek', w: o.plek });
    } else if (antwoord.type === 'betaalcode') {
      kop.van = null;
    }
    /* Wat de APP erbij weet en de server niet: bij de kassa is dat het bedrag van
       deze bon. Dat hoort op dezelfde kaart, want dat is wat er werkelijk gaat
       gebeuren -- de code zegt alleen tot hoeveel het MAG. */
    (opties.extra || []).forEach(function (v) { regels.push({ l: v.naam, w: v.waarde, nadruk: !!v.nadruk }); });

    var tot = klok(o.tot);
    if (tot) regels.push({ l: 'Geldig tot', w: tot });

    /* Alleen intenties met een weg. Een knop zonder weg is een belofte die
       nergens uitkomt (LAT.md regel 6), en dat mag dit scherm nooit tonen. */
    var knoppen = (antwoord.intenties || []).filter(function (i) { return i && i.weg && i.tekst; });
    return { kop: kop, regels: regels, gegevens: o.gegevens || [], knoppen: knoppen, tot: o.tot || null };
  }

  /* Een ceremonieel getal, met het VALUTATEKEN in de werkletter. Bodoni's euro is
     smal en hoog en leest op een bevestigscherm als een C -- op de plek waar
     iemand net moet zien hoeveel er van hem afgaat. Het cijfer blijft ceremonieel
     (ONTWERP.md par. 1: "een belangrijk bedrag"), het teken wordt werk. */
  function ceremonieel(waarde) {
    var m = /^([^\d\s]+)\s*(.+)$/.exec(String(waarde == null ? '' : waarde));
    if (!m) return esc(waarde);
    return '<span class="rtg-werk teken">' + esc(m[1]) + '</span> ' + esc(m[2]);
  }

  function markeer(inhoud) {
    var h = '<div class="blad" role="dialog" aria-modal="true" aria-label="Bevestigen">';
    if (inhoud.kop.van) h += '<div class="van">' + esc(inhoud.kop.van) + '</div>';
    h += '<div class="wat">' + esc(inhoud.kop.wat) + '</div>';
    if (inhoud.kop.waarom) h += '<div class="waarom">' + esc(inhoud.kop.waarom) + '</div>';
    if (inhoud.regels.length) {
      h += '<div class="regels">';
      inhoud.regels.forEach(function (r) {
        h += '<div><span class="l">' + esc(r.l) + '</span>' +
          (r.nadruk ? '<b class="rtg-kpi">' + ceremonieel(r.w) + '</b>' : '<span class="w">' + esc(r.w) + '</span>') +
          '</div>';
      });
      h += '</div>';
    }
    if (inhoud.gegevens.length) {
      h += '<div class="gegevens">De ander krijgt: <b>' + inhoud.gegevens.map(esc).join('</b>, <b>') + '</b>.</div>';
    }
    h += '<div class="knoppen">';
    inhoud.knoppen.forEach(function (k, i) {
      h += '<button type="button" class="doen" data-i="' + i + '">' + esc(k.tekst) +
        (k.uitleg ? ' <span style="font-weight:400;opacity:.8;">· ' + esc(k.uitleg) + '</span>' : '') + '</button>';
    });
    h += '<button type="button" data-af="1">Annuleren</button>';
    h += '</div><div class="fout" hidden></div></div>';
    return h;
  }

  /* Het scherm. Geeft de gekozen intentie terug, of null als er niets gekozen is
     -- annuleren, wegtikken, Escape, of een code die onder je handen verloopt. */
  function toon(antwoord, opties) {
    opties = opties || {};
    var inhoud = opbouw(antwoord, opties);
    return new Promise(function (klaar) {
      if (!doc) { klaar(null); return; }
      var laag = doc.createElement('div');
      laag.className = 'rtg-bedoeling';
      laag.innerHTML = markeer(inhoud);
      doc.body.appendChild(laag);

      var tikker = null;
      function sluit(uit) {
        if (tikker) clearInterval(tikker);
        doc.removeEventListener('keydown', toets);
        if (laag.parentNode) laag.parentNode.removeChild(laag);
        klaar(uit || null);
      }
      function toets(e) { if (e.key === 'Escape') sluit(null); }
      doc.addEventListener('keydown', toets);
      laag.addEventListener('click', function (e) {
        if (e.target === laag) { sluit(null); return; }         // naast het blad tikken
        var b = e.target.closest ? e.target.closest('button') : null;
        if (!b) return;
        if (b.dataset.af) { sluit(null); return; }
        sluit(inhoud.knoppen[Number(b.dataset.i)] || null);
      });

      /* VERLOOPT HIJ TERWIJL JE KIJKT, dan gaan de knoppen dicht. Een capability
         leeft minuten; wie er een op zijn scherm laat staan en een minuut later
         bevestigt, krijgt anders een weigering die hij niet zag aankomen. */
      var eind = Date.parse(inhoud.tot || '');
      if (eind) {
        tikker = setInterval(function () {
          if (Date.now() < eind) return;
          clearInterval(tikker); tikker = null;
          laag.querySelectorAll('button.doen').forEach(function (b) { b.disabled = true; });
          var f = laag.querySelector('.fout');
          if (f) { f.textContent = 'Deze code is verlopen. Laat een verse code zien.'; f.hidden = false; }
        }, 1000);
      }
      var eerste = laag.querySelector('button.doen') || laag.querySelector('button');
      if (eerste) eerste.focus();
    });
  }

  var api = { toon: toon, opbouw: opbouw, markeer: markeer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RTGLinkKaart = api;
})(typeof self !== 'undefined' ? self : this);
