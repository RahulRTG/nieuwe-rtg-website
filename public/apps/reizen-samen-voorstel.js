/* HET VOORSTEL IN DE GEZAMENLIJKE REIS -- instemmen op een vaste versie.

   Afgesplitst uit ./reizen-samen-besluit.js (grens van keuringsregel 13). De
   regels staan in server/kern/reisgezelschap-instemming.js: wie mag voorleggen,
   wanneer een versie vervalt en wanneer hij aangenomen is, beslist de server.
   Dit bestand tekent de stand en de knoppen die `werkruimte.handelingen`
   toestaat, en stuurt bij instemmen de versie en vingerafdruk mee die HIER
   staan. */
(function (w, d) {
  'use strict';
  var R = w.RTGReizen; if (!R) return;
  var $ = R.$, maak = R.maak;
  /* HET VOORSTEL: de versie die nu voorligt, wat ermee is, en -- als de server
     het toestaat -- de eigen knoppen. Instemmen stuurt de versie en de
     vingerafdruk mee die HIER staan; is het voorstel intussen veranderd, dan
     weigert de server en tekent dit blok opnieuw. */
  var STAND = { open: 'Ligt voor', aangenomen: 'Aangenomen door iedereen', vervallen: 'Vervallen', ingetrokken: 'Ingetrokken' };
  function knop(tekst, fn) { var k = maak('button', 'rtg-knop', tekst); k.type = 'button'; k.addEventListener('click', fn); return k; }
  function teken(b, h) {
    var reis = h.reis, doe = h.doe, euro = h.euro;
    var v = b.groep.voorlegging, vak = $('#voorleggingInhoud'), knoppen = $('#voorleggingKnoppen');
    if (!vak || !knoppen) return; vak.textContent = ''; knoppen.textContent = '';
    if (!v) { vak.appendChild(maak('p', 'leegtekst', 'Er ligt nog geen voorstel voor.')); return; }
    vak.dataset.versie = v.versie; vak.dataset.stand = v.stand;
    vak.appendChild(maak('b', '', 'Versie ' + v.versie + ': ' + v.optie.titel));
    vak.appendChild(maak('small', '', euro(v.optie.prijsPP) + ' p.p. · ' + v.optie.van + ' t/m ' + v.optie.tot));
    vak.appendChild(maak('p', 'rtg-sub', STAND[v.stand] + (v.reden ? ': ' + v.reden : '') +
      (v.stand === 'open' || v.stand === 'aangenomen' ? ' · ' + v.instemmingen.ja + ' van ' + v.instemmingen.totaal + ' stemden in' : '')));
    var mag = b.werkruimte.handelingen;
    if (mag.indexOf('instem') >= 0 && (v.stand === 'open' || v.stand === 'aangenomen')) {
      var stuur = function (ja) { return function () {
        doe('/api/reis/gezelschap/instem', { reis: reis, versie: v.versie, vingerafdruk: v.vingerafdruk, ja: ja }); }; };
      if (b.jij.instemming !== 'ja') knoppen.appendChild(knop('IK STEM IN', stuur(true)));
      if (b.jij.instemming !== 'nee') knoppen.appendChild(knop('IK STEM NIET IN', stuur(false)));
      if (b.jij.instemming) knoppen.appendChild(knop('NEEM MIJN ANTWOORD TERUG', function () {
        doe('/api/reis/gezelschap/instem/terug', { reis: reis }); }));
    }
    if (mag.indexOf('voorstel.trek') >= 0 && v.stand === 'open') {
      knoppen.appendChild(knop('TREK VOORSTEL IN', function () { doe('/api/reis/gezelschap/voorstel/trek', { reis: reis }); }));
    }
  }


  /* DE EDGE: de voortgang als Trust Rail en twee handelingen, uit dezelfde
     projectie -- geen tweede bron, en niets over een ander. */
  function edge(b) {
    var A = w.RTGAdaptief; if (!A) return;
    var acties = ['reizen.samen.wensen'];
    if (b.werkruimte.handelingen.indexOf('optie.zet') >= 0) acties.push('reizen.samen.optie');
    var passen = b.groep.opties.filter(function (o) { return o.voorIedereen === true; }).length;
    var groep = !b.groep.vastTeStellen ? { tekst: 'Nog niet vast te stellen', staat: 'aandacht' }
      : passen ? { tekst: passen + ' optie' + (passen === 1 ? '' : 's') + ' past voor iedereen', staat: 'goed' }
        : { tekst: 'Nog geen optie past voor iedereen', staat: 'aandacht' };
    var rail = [{ sleutel: 'groep', tekst: groep.tekst, staat: groep.staat },
      { sleutel: 'jij', tekst: b.jij.opgave ? 'Uw wensen staan' : 'Geef uw wensen op', staat: b.jij.opgave ? 'goed' : 'aandacht' }];
    var v = b.groep.voorlegging;
    if (v) rail.push({ sleutel: 'voorstel', tekst: 'Versie ' + v.versie + ': ' + (v.stand === 'open' ? v.instemmingen.ja + ' van ' + v.instemmingen.totaal + ' stemden in' : v.stand),
      staat: v.stand === 'aangenomen' ? 'goed' : v.stand === 'open' ? 'aandacht' : 'neutraal' });
    if (b.groep.voortgang) rail.push({ sleutel: 'voortgang', tekst: b.groep.voortgang.ingevuld + ' van ' + b.groep.voortgang.deelnemers + ' ingevuld', staat: 'neutraal' });
    A.context({ bron: 'reizen.samen.besluit', titel: 'Gezamenlijke reis', acties: acties, selectie: false, rail: rail });
  }

  w.RTGSamenVoorstel = { teken: teken, edge: edge };
})(window, document);
