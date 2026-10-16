/* Context en taalregels voor de universele Rahul-tab. */
(function () {
  'use strict';
  function tekst(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  /* DE CONTEXT VOOR RAHUL. Met een Edge Blikveld komt hij daaruit (EDGE.md
     par. 14.4): schermtitel, wereld, leesmoment en een verwijzing naar het
     aangewezen object, die de server zelf opzoekt. Rahulzicht voegt hooguit de
     id, modus en door de Edge bevestigde actieve Workspace-module toe. De tekst van een gekozen
     optie wordt dan NIET meer uit de DOM geschraapt: dat kon alles zijn, ook
     een naam. Zonder blikveld blijft alles zoals het was. `app` blijft de
     documenttitel, want de tab toont die en de suggesties lezen hem. */
  function context() {
    /* Rahulzicht is de positieve projectie. Hij leest het Blikveld plus, als
       die bestaat, de bestaande Workspace Runtime. De oudere Blikveld-helper
       blijft alleen een terugval voor schermen die Rahulzicht niet laden. */
    var Z = window.RTGEdgeRahulzicht, z = Z && Z.lees ? Z.lees(window) : null;
    if (z && z.context) {
      var uit = { app: document.title.replace(/^RTG\s*/i, '') || 'RTG', deel: z.context.deel || 'Actieve pagina',
        selectie: '', verwijzingen: metWerkstuk(z.context.verwijzingen || [], window.RTGEdgeBlikveld) };
      if (z.context.wereld) uit.wereld = z.context.wereld;
      if (z.context.werkruimte) uit.werkruimte = z.context.werkruimte;
      if (z.context.assistent) uit.assistent = z.context.assistent;
      if (z.context.op) uit.op = z.context.op;
      return uit;
    }
    var B = window.RTGEdgeBlikveld;
    if (B && typeof B.voorRahul === 'function') {
      try {
        var b = B.voorRahul();
        return { app: document.title.replace(/^RTG\s*/i, '') || 'RTG', deel: b.deel || 'Actieve pagina',
          selectie: '', wereld: b.wereld, verwijzingen: metWerkstuk(b.verwijzingen || [], B), op: b.op };
      } catch (e) { /* val terug op de oude bron */ }
    }
    var actief = document.querySelector('[data-wk].actief,.rv-bank .actief,.lo-rail .actief,.pn-rail .actief,.po-rail .actief,nav .actief');
    var keuze = document.querySelector('select:focus,select option:checked,[aria-selected="true"]');
    var titel = document.title.replace(/^RTG\s*/i, '');
    var c = {
      app: titel || 'RTG',
      deel: actief ? actief.textContent.trim() : 'Actieve pagina',
      selectie: keuze ? keuze.textContent.trim() : ''
    };
    return c;
  }
  /* Het concept waar het lid in het gesprek aan werkt (shared/edge/conceptwerk.js)
     staat naast het object van het scherm, de nieuwste eerst: wie na het concept
     weer een aanvraag aanwijst, bedoelt die. Welke van de twee een vraag bedoelt,
     beslist de server (kern/stuur/menscontext-relatie.js). */
  function metWerkstuk(lijst, B) {
    var W = window.RTGEdgeConceptwerk, w = W && W.verwijzing ? W.verwijzing() : null;
    if (!w) return lijst;
    var ref = { soort: w.soort, id: w.id }, sinds = 0;
    try { sinds = Number(B.lees().velden.object.sinds) || 0; } catch (e) { sinds = 0; }
    var rest = lijst.filter(function (v) { return !(v.soort === ref.soort && v.id === ref.id); });
    return w.op >= sinds ? [ref].concat(rest) : rest.concat([ref]);
  }
  function suggesties(c) {
    /* De Workspace-projectie heeft de actuele sessie, module, rechten en Edge-
       context al fail-closed gecontroleerd. Hier worden alleen de vier gesloten
       assistentsoorten naar vaste vragen vertaald. Actie-id, route, payload en
       vrije manifesttekst worden nooit onderdeel van de zichtbare prompt; een
       chip blijft bovendien een gewone vraag aan de bestaande Stuur-keten. */
    var assistent = c && c.assistent, mogelijkheden = assistent && assistent.mogelijkheden;
    if (Array.isArray(mogelijkheden)) {
      var actie = /^[a-z][a-z0-9]*(?:\.[a-z0-9-]+)+$/, aanwezig = Object.create(null);
      mogelijkheden.slice(0, 8).forEach(function (x) {
        var id = String(x && x.id || ''), soort = String(x && x.soort || '');
        if (actie.test(id) && ['read', 'search', 'open', 'propose'].indexOf(soort) >= 0) aanwezig[soort] = true;
      });
      var vast = { read: 'Vat het actieve onderdeel samen', search: 'Zoek binnen het actieve onderdeel',
        open: 'Laat zien wat ik hier kan openen', propose: 'Bereid een controleerbaar voorstel voor' };
      var gegrond = ['read', 'search', 'open', 'propose'].filter(function (soort) { return aanwezig[soort]; })
        .slice(0, 3).map(function (soort) { return vast[soort]; });
      if (gegrond.length) return gegrond;
      return ['Wat vraagt nu aandacht?', 'Open het juiste onderdeel', 'Bereid de volgende stap voor'];
    }
    var bron = c.app + c.deel;
    if (/werk|employee|personeel/i.test(bron)) return ['Bundel mijn beslissingen', 'Bereid onboarding voor', 'Wat blokkeert het team?'];
    if (/reis|living|veilig/i.test(bron)) return ['Bescherm mijn reis', 'Simuleer een verstoring', 'Wat vraagt mijn akkoord?'];
    if (/geld|bank|finance/i.test(bron)) return ['Geef mijn financiële aandacht', 'Simuleer een keuze', 'Controleer risico’s'];
    return ['Wat vraagt nu aandacht?', 'Open het juiste onderdeel', 'Bereid de volgende stap voor'];
  }
  /* DE STAVING ONDER EEN ANTWOORD (server/kern/stuur/staving.js). Alleen wat
     NIET is teruggevonden in wat Rahul in deze beurt opzocht, en dan in een
     regel; wat wel klopt krijgt geen vinkje, want een gevonden getal bewijst
     niet dat het in de juiste betekenis is gebruikt. Geen staving: geen regel. */
  function noot(d) {
    var n = d && d.staving && d.staving.nietGevonden, uit = [];
    if (n && n.length) uit.push('Niet teruggevonden in wat Rahul opzocht: ' + n.slice(0, 6).join(', ') + '. Lees dat als onbekend.');
    /* Het taakbeeld van de server (shared/edge/taakbeeld.js, EDGE.md par. 14.4):
       wat Rahul begreep, voorstelt en wat er werkelijk gebeurde. Als tekst. */
    var T = window.RTGEdgeTaakbeeld;
    if (d && d.taak && T && T.regels) T.regels(d.taak).forEach(function (r) { uit.push(r.tekst); });
    return uit.join('\n');
  }
  /* Een bericht in het gesprek, met de noot eronder als die er is. Alles gaat
     door tekst(): wat uit een antwoord komt, is nooit opmaak. */
  function bericht(m) {
    var mens = m.rol === 'user';
    return '<div class="rtg-command-msg ' + (mens ? 'user' : '') + '"><b>' + (mens ? 'U' : 'RAHUL') + '</b>' + tekst(m.tekst) +
      (m.noot ? '<small class="rtg-command-noot">' + tekst(m.noot) + '</small>' : '') + '</div>';
  }
  /* HET CONCEPT ALS WERKSTUK (shared/edge/conceptwerk.js, EDGE.md par. 14.6):
     een concept met bewerkbare velden komt onder het gesprek te staan, en een
     wijziging gaat met de eigen sessie naar de server. Een nieuw concept
     vervangt het vorige; er staat er een tegelijk. */
  function werk(d, page, auth) {
    var c = d && d.taak && d.taak.concept, W = window.RTGEdgeConceptwerk;
    if (!c || !c.id || !c.bewerkbaar || !W || !page || !auth) return null;
    var oud = page.querySelector('.rtg-conceptwerk');
    if (oud) oud.remove();
    var k = W.maak(c, document, { verstuur: function (body) {
      return fetch('/api/fluister/concept', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + auth },
        body: JSON.stringify(body) }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { status: r.status, body: b }; }); });
    } });
    var form = page.querySelector('.rtg-command-form');
    if (form && form.parentNode) form.parentNode.insertBefore(k.element, form);
    return k;
  }
  window.RTGRahulTabHelpers = { tekst: tekst, context: context, suggesties: suggesties, noot: noot, bericht: bericht, werk: werk };
  /* Escape sluit het Rahul-paneel, zoals elke andere laag in deze schil
     (GRAMMATICA.md: ik kan bijna altijd terug). Het paneel ligt vast over het
     werkblad; zonder dit was de sluitknop de enige weg terug. Dezelfde knop,
     dus dezelfde weg dicht. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var paneel = document.querySelector('.rtg-rahul-page');
    var dicht = paneel && !paneel.hidden && paneel.querySelector('.rtg-command-close');
    if (dicht) { e.stopPropagation(); dicht.click(); }
  }, true);
})();
