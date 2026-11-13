/* Muisvrij bedienen, deel 4: het gesprek.

   Dit maakt van de balk een chat in plaats van een antwoordregel. Jij rechts in
   bordeaux, Rahul links op zwart met zijn signatuurmond ernaast, drie puntjes
   terwijl hij bezig is, en nieuwe beurten onderaan.

   /api/chat/history haalt dezelfde doorlopende conversatie op als de leden-app.
   Jouw woorden staan meteen in beeld, vóór het antwoord van Rahul.

   Bij Lifestyle en Business is dit gesprek de lijn naar een MENS (de concierge).
   De server weigert daar assistent-beurten in het draadje te zetten; de beurten
   die je hier tikt blijven in beeld zolang de pagina open is, maar gaan niet het
   gesprek in dat de concierge leest. Anders zou het lijken alsof zij iets zei
   wat de AI zei. Beurten van een mens krijgen een gouden rand, zodat te zien is
   wie er aan het woord was. */
(function (root) {
  'use strict';
  if (root.__handenvrijChat) return; root.__handenvrijChat = true;
  var kamer = root.__handenvrijKamer;
  if (!kamer || !kamer.vak) return;
  var vak = kamer.vak;

  /* De opmaak hoort bij dit deel, niet bij de balk: jij rechts in bordeaux,
     Rahul links op zwart met zijn mond ernaast, nieuw onderaan, venster rolt mee. */
  // Presentatie komt op iedere host uit de centrale DS-component.
  /* Presentatie: public/ds/componenten/handenvrij.css. */



  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  };
  var klok = function (at) {
    try { return new Date(at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  };

  /* De mond van Rahul naast zijn beurt. shared/mond.js tekent de signatuurlippen
     en kan ze laten bewegen; is die er niet, dan blijft er een gouden rondje
     staan en verandert er verder niets. */
  var monden = [];
  function kopje() {
    var d = document.createElement('div');
    d.className = 'ds-handenvrij__mond hv-kop';
    d.setAttribute('aria-hidden', 'true');
    if (root.RTGMond) {
      /* Dezelfde canvasmaat als de metgezel gebruikt (440x200). Op een kleiner
         doek worden de puntjes van het lippenveld relatief te groot en zie je een
         vlekje in plaats van een mond; CSS schaalt het daarna netjes terug. */
      var c = document.createElement('canvas');
      c.width = 440; c.height = 200;
      d.appendChild(c);
      try { monden.push(root.RTGMond.maak(c)); } catch (e) {}
    }
    return d;
  }
  (function haalMond() {
    if (root.RTGMond) return;
    var s = document.createElement('script');
    s.src = '/shared/mond.js'; s.defer = true;
    document.head.appendChild(s);
  })();
  function praat(ms) { monden.forEach(function (m) { try { m.praat(ms || 1200); } catch (e) {} }); }

  function naarBeneden() { try { vak.scrollTop = vak.scrollHeight; } catch (e) {} }

  /* Wie het paneel omhoog of omlaag zet, is handenvrij-scherm.js: dat kent de
     standen en de regel "hij praat -> omhoog, jij antwoordt -> omlaag". Is die
     laag er niet (of nog niet geladen), dan doen we het oude, simpele: gewoon
     zichtbaar maken. Hier zelf .hidden zetten zou de standen omzeilen. */
  var stilLaden = false;
  function inBeeld(van) {
    /* Tijdens het ophalen van het oude gesprek klapt er niets open of dicht --
       zie laadGesprek() hieronder voor wat dat anders kostte. */
    if (stilLaden) return;
    if (kamer.naStand) kamer.naStand(van);
    else vak.hidden = false;
  }

  /* Een beurt toevoegen. van: 'member' (jij), 'rahul' (de assistent) of iets
     anders (een mens: concierge, backoffice). */
  function beurt(van, tekst, at) {
    var t = String(tekst == null ? '' : tekst).trim();
    if (!t) return null;
    tikt(false);
    var ik = van === 'member';
    var service = van === 'service';
    var mens = !ik && van !== 'rahul' && !service;
    var rij = document.createElement('div');
    rij.className = 'ds-handenvrij__beurt hv-beurt ' + (ik ? 'ik' : 'hij') + (mens ? ' mens' : '');
    if (!ik) rij.appendChild(kopje());
    var bel = document.createElement('div');
    bel.className = 'ds-handenvrij__bericht hv-bel';
    bel.innerHTML = (service ? '<div class="ds-handenvrij__afzender hv-wie">RTG Service · automatisch bericht</div>'
      : mens ? '<div class="ds-handenvrij__afzender hv-wie">RTG Concierge</div>' : '') +
      esc(t) + '<div class="ds-handenvrij__tijd hv-tijd">' + esc(klok(at || Date.now())) + '</div>';
    rij.appendChild(bel);
    vak.appendChild(rij);
    inBeeld(van);
    naarBeneden();
    if (!ik) praat(Math.min(4000, 500 + t.length * 22));  // even bewegen, naar lengte
    return rij;
  }

  /* De drie puntjes. Er is er altijd maar een, en hij verdwijnt zodra de
     volgende beurt komt (beurt() ruimt hem zelf op). */
  var puntjes = null;
  function tikt(aan) {
    if (!aan) { if (puntjes) { puntjes.remove(); puntjes = null; } return; }
    if (puntjes) return;
    puntjes = document.createElement('div');
    puntjes.className = 'ds-handenvrij__beurt hv-beurt hij';
    puntjes.appendChild(kopje());
    var bel = document.createElement('div');
    bel.className = 'ds-handenvrij__bericht hv-bel';
    bel.innerHTML = '<span class="ds-handenvrij__tikt hv-tikt" role="status" aria-label="Rahul is bezig"><i></i><i></i><i></i></span>';
    puntjes.appendChild(bel);
    vak.appendChild(puntjes);
    inBeeld('rahul');
    naarBeneden();
    praat(1500);
  }

  /* Het gesprek ophalen zoals het was. Alleen voor een lid (een zaak heeft deze
     conversatie niet); de laatste tien beurten zijn genoeg om de draad op te
     pakken zonder de halve pagina vol te zetten. */
  var geladen = false;
  function laadGesprek() {
    if (geladen || !kamer.tok) return;
    geladen = true;
    var isLid = false;
    try { isLid = !!localStorage.getItem('rtg_member_token'); } catch (e) {}
    if (!isLid) return;
    fetch('/api/chat/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kamer.tok },
      body: JSON.stringify({ lang: kamer.taal ? kamer.taal() : 'nl' })
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var m = (d && d.messages) || [];
        if (!m.length) return;
        /* DIT KLAPT NIETS OPEN -- EN NIETS DICHT. Je begint waar je was; dat
           werd gedaan door het paneel achteraf op `min` te zetten. Die regel
           sloot dus ook wat er intussen door iets ANDERS was geopend, want dit
           antwoord komt over het net en landt op een willekeurig moment. Het
           duurste geval: een betaalbevestiging in een dicht paneel, met de
           focus al op "Ja, doorzetten". De stand wordt tijdens het inladen nu
           niet meer aangeraakt -- dat haalt de race weg. */
        stilLaden = true;
        try { m.slice(-10).forEach(function (b) { beurt(b.from, b.text, b.at); }); }
        finally { stilLaden = false; }
      })
      .catch(function () {});
  }

  kamer.beurt = beurt;
  kamer.tikt = tikt;
  kamer.laadGesprek = laadGesprek;
  // het venster hangt pas in de body als die er is; wacht daar netjes op
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', laadGesprek);
  else laadGesprek();
})(typeof self !== 'undefined' ? self : this);
