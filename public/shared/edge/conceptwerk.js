/* HET CONCEPT ALS WERKSTUK OP DE EDGE -- een voorbereiding van Rahul die het lid
   op het scherm aanpast, waarna Rahul en de Edge naar dezelfde waarden kijken
   (EDGE.md par. 14.6, live samenwerking).

   DIT BESTAND KENT GEEN DOMEIN. Welke velden er te bewerken zijn, hoe ze heten
   en waar hun grenzen liggen, komt uit het concept van de server
   (`bewerkbaar`); er staat hier geen reiswoord en geen tweede lijst velden.

   DE SERVER HEEFT HET LAATSTE WOORD. Een wijziging gaat als { id, versie,
   velden } naar de host (opties.verstuur), en wat terugkomt wordt getekend --
   ook bij een weigering (400: het veld krijgt de reden) en bij een botsing
   (409: het scherm toont de stand van nu, en zegt dat). Er wordt niets lokaal
   "alvast" goedgekeurd: een getal dat de server niet aanneemt, staat er niet
   als geaccepteerd.

   EEN WIJZIGING TEGELIJK. Tijdens een verzoek worden nieuwe wijzigingen
   verzameld en daarna in een keer gestuurd, op de versie die de server net
   teruggaf. Zo botst het scherm nooit met zichzelf.

   RAHUL WEET WAAR HET LID AAN WERKT, ZONDER DAT DE KAART DE SCHERMCONTEXT ZET.
   In de schil zet alleen de brug een context (test/edgedekking-zelf.test.js 5):
   een kaart in het gesprek is geen blad. De kaart houdt daarom alleen bij welk
   concept het laatst is gemaakt of aangepast (`verwijzing()`), en de
   contextbouwer van Rahul (rahul-tab/helpers.js) zet die verwijzing naast het
   object van het scherm, de nieuwste eerst. De server zoekt de waarden zelf op;
   er gaan geen waarden mee in die verwijzing.

   EN DE KAART DOET NIETS. Er is hier geen knop om in te dienen, te boeken of te
   betalen: dat is een eigen handeling met een eigen gewicht. Alles wordt als
   tekst gezet (textContent), nooit als opmaak.

   Levert window.RTGEdgeConceptwerk.maak(concept, document, opties) -> {
   element, concept(), teken(c) } en .verwijzing(), en in node module.exports. */
(function (root, fabriek) {
  'use strict';
  var api = fabriek(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (root) root.RTGEdgeConceptwerk = api;
}(typeof window !== 'undefined' ? window : this, function (root) {
  'use strict';
  // het concept waar het lid het laatst aan werkte, in dit venster
  var actief = null;
  var STIJL = '.rtg-conceptwerk{margin:14px 0 4px;border:1px solid rgba(192,165,68,.32);padding:16px;background:rgba(192,165,68,.04)}' +
    'section.rtg-conceptwerk header{background:none;padding:0;border:0;display:flex;justify-content:space-between;gap:12px;font:600 11px/1.4 Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase}' +
    '.rtg-conceptwerk header em{font-style:normal;opacity:.8}.rtg-conceptwerk h3{margin:8px 0 12px;font:500 19px/1.3 "Bodoni Moda",serif}' +
    '.rtg-conceptwerk-velden{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}' +
    '.rtg-conceptwerk label{display:grid;gap:4px;min-width:0;font:500 12px/1.4 Inter,sans-serif}' +
    /* het veld zelf volgt de huisstijl (shared/rtg-ui.css); hier alleen de maat */
    'section.rtg-conceptwerk label input{box-sizing:border-box;width:100%;min-width:0;min-height:36px;margin:0}' +
    'section.rtg-conceptwerk label input[aria-invalid="true"]{border-color:#C23A5E}.rtg-conceptwerk small.fout{min-height:1em;font-size:12px}' +
    '.rtg-conceptwerk p{margin:8px 0 0;font:14px/1.5 Inter,sans-serif}.rtg-conceptwerk .rahul{font-weight:600}' +
    '.rtg-conceptwerk .grens{display:block;margin-top:10px;font-size:12px;opacity:.85}.rtg-conceptwerk[aria-busy="true"] .rahul{opacity:.6}';

  function stijl(d) {
    if (!d || !d.head || d.getElementById('rtgConceptwerkStijl')) return;
    var s = d.createElement('style');
    s.id = 'rtgConceptwerkStijl';
    s.textContent = STIJL;
    d.head.appendChild(s);
  }
  function el(d, tag, cls, tekst) {
    var e = d.createElement(tag);
    if (cls) e.className = cls;
    if (tekst != null) e.textContent = String(tekst);
    return e;
  }
  /* Wat het scherm stuurt: een leeg getalveld is "weet ik nog niet" (null), een
     geheel getal gaat als getal, en de rest gaat zoals het is -- dan weigert de
     server het met de reden, in plaats van dat hier wordt geraden. */
  function invoerWaarde(v, input) {
    var t = String(input.value == null ? '' : input.value).trim();
    if (v.soort !== 'getal') return input.value;
    if (t === '') return null;
    return /^\d+$/.test(t) ? Number(t) : t;
  }

  function maak(concept, d, opties) {
    opties = opties || {};
    stijl(d);
    var huidig = concept, wachtrij = null, bezig = false, invoer = {};
    var kaart = el(d, 'section', 'rtg-conceptwerk');
    var kop = el(d, 'header');
    kop.appendChild(el(d, 'span', null, concept.kop || 'Concept'));
    kop.appendChild(el(d, 'em', null, 'Niet ingediend'));
    var titel = el(d, 'h3');
    var velden = el(d, 'div', 'rtg-conceptwerk-velden');
    var afgeleid = el(d, 'p', 'afgeleid'), nodig = el(d, 'p', 'nodig'), volgende = el(d, 'p', 'volgende');
    var rahul = el(d, 'p', 'rahul');
    rahul.setAttribute('aria-live', 'polite');
    var grens = el(d, 'small', 'grens', 'Er is niets ingediend, geboekt of betaald. Wat u hier aanpast, blijft een concept.');
    [kop, titel, velden, afgeleid, nodig, volgende, rahul, grens].forEach(function (x) { kaart.appendChild(x); });

    (concept.bewerkbaar || []).forEach(function (v) {
      var label = el(d, 'label');
      label.appendChild(el(d, 'span', null, v.label));
      var i = d.createElement('input');
      i.name = v.naam;
      if (v.soort === 'getal') { i.type = 'number'; i.inputMode = 'numeric'; i.step = '1'; i.min = String(v.min); i.max = String(v.max); }
      else { i.type = 'text'; i.maxLength = v.max || 60; i.autocomplete = 'off'; }
      var fout = el(d, 'small', 'fout');
      fout.id = 'cw-' + String(concept.id) + '-' + v.naam;
      i.setAttribute('aria-describedby', fout.id);
      i.addEventListener('change', function () { wijzig(v, invoerWaarde(v, i)); });
      label.appendChild(i);
      label.appendChild(fout);
      velden.appendChild(label);
      invoer[v.naam] = { input: i, fout: fout };
    });

    function publiceer(c) {
      actief = { soort: String(c.soort), id: String(c.id), op: Date.now(), kaart: kaart };
    }
    /* `houd` is een veld met een weigering: daar blijft staan wat het lid typte,
       met de reden eronder, zodat hij ziet wat er niet werd aangenomen. */
    function teken(c, houd) {
      huidig = c;
      titel.textContent = c.titel || '';
      kaart.setAttribute('aria-label', c.titel || 'Concept');
      kaart.setAttribute('data-versie', String(c.versie));
      Object.keys(invoer).forEach(function (n) {
        if (n === houd) return;
        var w = c.waarden ? c.waarden[n] : null;
        invoer[n].input.value = w == null ? '' : String(w);
        invoer[n].input.removeAttribute('aria-invalid');
        invoer[n].fout.textContent = '';
      });
      var af = (c.velden || []).filter(function (v) { return v.afgeleid; });
      afgeleid.textContent = af.map(function (v) { return v.naam + ': ' + v.waarde; }).join(' · ');
      var aanname = (c.velden || []).filter(function (v) { return v.aanname; });
      if (aanname.length) afgeleid.textContent += (afgeleid.textContent ? ' · ' : '') + aanname.map(function (v) {
        return v.naam + ' aangenomen: ' + v.aanname; }).join(', ');
      nodig.textContent = c.ontbreekt && c.ontbreekt.length ? 'Nog nodig: ' + c.ontbreekt.join(', ') : '';
      volgende.textContent = c.volgende || '';
      publiceer(c);
    }
    function zeg(t) { rahul.textContent = t || ''; }

    function wijzig(v, waarde) {
      wachtrij = wachtrij || {};
      wachtrij[v.naam] = waarde;
      if (!bezig) stuur();
    }
    function stuur() {
      if (!wachtrij || typeof opties.verstuur !== 'function') return Promise.resolve();
      var mee = wachtrij;
      wachtrij = null;
      bezig = true;
      kaart.setAttribute('aria-busy', 'true');
      return Promise.resolve(opties.verstuur({ id: huidig.id, versie: huidig.versie, velden: mee })).then(function (r) {
        var b = (r && r.body) || {}, s = r && r.status;
        if (s === 200 && b.concept) {
          teken(b.concept);
          zeg(b.gewijzigd === false ? '' : 'Rahul · Concept bijgewerkt. ' + (b.antwoord || ''));
          if (typeof opties.bijgewerkt === 'function') opties.bijgewerkt(b);
        } else if (s === 409 && b.concept) {
          teken(b.concept);
          zeg('Dit concept is intussen elders aangepast; u ziet nu de stand van nu.');
        } else if (s === 400 && b.veld && invoer[b.veld]) {
          if (b.concept) teken(b.concept, b.veld);
          invoer[b.veld].input.setAttribute('aria-invalid', 'true');
          invoer[b.veld].fout.textContent = b.error || 'Deze waarde past niet.';
        } else {
          teken(huidig);
          zeg(b.error || 'Dit kon niet worden aangepast; er is niets veranderd.');
        }
      }, function () {
        teken(huidig);
        zeg('De wijziging is niet aangekomen; er is niets veranderd.');
      }).then(function () {
        bezig = false;
        kaart.removeAttribute('aria-busy');
        if (wachtrij) return stuur();
      });
    }

    teken(concept);
    return { element: kaart, concept: function () { return huidig; }, teken: teken, stuur: stuur };
  }

  /* Alleen een kaart die nog in het document staat telt: een weggehaalde kaart
     is geen werkstuk meer. Soort, id en het moment, nooit een waarde. */
  function verwijzing() {
    if (!actief || !actief.kaart || actief.kaart.isConnected === false) return null;
    return { soort: actief.soort, id: actief.id, op: actief.op };
  }

  return { maak: maak, verwijzing: verwijzing };
}));
