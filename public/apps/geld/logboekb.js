/* Stand Logboek, deel 2 van 2: de registratie. Leunt op w.RTGGeldDeel.logboek
   uit logboek.js (stijl, tekenwerk, uitvoermodel); hier staan de handelingen.

   Zelfde routes als /apps/logboek.html, letterlijk:
   /api/member/rechterhand/logboek, .../logboek/object, .../logboek/object/weg,
   .../logboek/regel, .../logboek/regel/weg en .../ai. Premium: bij een 403 is
   de serverzin ("onderdeel van de Lifestyle Pass") het hele verhaal en hoort
   er geen inloghint achteraan -- dezelfde regel als de stand Mecenaat. */
(function (w, d) {
  'use strict';
  var V = w.RTGGeld = w.RTGGeld || { standen: [] };
  var $ = function (s) { return d.querySelector(s); };

  function Deel() { return w.RTGGeldDeel.logboek; }

  async function laad() {
    var Geld = w.Geld, D = Deel(), dd;
    try { dd = await Geld.api('/api/member/rechterhand/logboek'); }
    catch (e) {
      D.S.data = null;
      /* De hint hoort alleen bij "niet ingelogd" (401); bij een 403 is de
         serverzin over de Lifestyle Pass het hele verhaal, en een 500 of
         netwerkfout tegen een ingelogd lid "log eerst in" noemen is een
         leugen. De pagina toonde de inlogkaart ook alleen zonder token. */
      $('#lbVak').innerHTML = '<p class="stil">' + Geld.esc(e.message) +
        (e.status === 401 ? ' Log eerst in via de leden-app.' : '') + '</p>';
      return;
    }
    D.S.data = dd;
    if (D.S.open) {
      var o = null;
      for (var i = 0; i < (dd.objecten || []).length; i++) if (dd.objecten[i].id === D.S.open) o = dd.objecten[i];
      if (o) return D.detail(dd, o);
      D.S.open = null;
    }
    D.hoofd(dd);
  }

  /* stuur krijgt het VOLLE pad: geen voorvoegsel dat een route half laat
     zien, zodat elke route hier letterlijk terug te vinden is. */
  async function stuur(pad, body) {
    try { await w.Geld.api(pad, body); laad(); }
    catch (e) { w.Geld.melding(e.message); }
  }

  /* S.open pas NA de bevestiging van de server loslaten, zoals de pagina dat
     deed: zakt de verwijdering (500), dan staat het object er nog en horen de
     regelknoppen zijn id nog te dragen -- eerder leegmaken stuurde daarna
     regels met objectId null. */
  async function objectWeg() {
    var S = Deel().S;
    try {
      await w.Geld.api('/api/member/rechterhand/logboek/object/weg', { id: S.open });
      S.open = null;
      laad();
    } catch (e) { w.Geld.melding(e.message); }
  }

  /* Een gedelegeerde klik op de omhulling in plaats van knop voor knop: de
     lagen worden bij elke verversing opnieuw getekend, en de omhulling
     verdwijnt netjes mee als de stand wisselt. */
  function klik(e) {
    var S = Deel().S;
    var b = e.target.closest('button');
    var kaart = e.target.closest('[data-open]');
    if (kaart && !b) { S.open = kaart.dataset.open; laad(); return; }
    if (!b) return;
    if (b.id === 'lbOAdd') {
      var naam = $('#lbON').value.trim();
      if (!naam) return w.Geld.melding('Geef het object een naam.');
      stuur('/api/member/rechterhand/logboek/object', { naam: naam, soort: $('#lbOS').value, merk: $('#lbOM').value,
        bouwjaar: $('#lbOB').value, registratie: $('#lbOR').value });
      return;
    }
    if (b.id === 'lbTerug') { S.open = null; laad(); return; }
    if (b.id === 'lbOWeg') {
      /* De oude pagina vroeg het ook eerst: een object weggooien neemt alle
         regels eronder mee, en dat is niet terug te draaien. */
      if (!w.confirm('Dit object en alle regels verwijderen?')) return;
      objectWeg();
      return;
    }
    if (b.id === 'lbRAdd') {
      var wat = $('#lbRW').value.trim();
      if (!wat) return w.Geld.melding('Wat is er gebeurd of gepland?');
      stuur('/api/member/rechterhand/logboek/regel', { objectId: S.open, wat: wat, soort: $('#lbRS').value,
        datum: $('#lbRD').value, volgende: $('#lbRV').value, kosten: $('#lbRK').value });
      return;
    }
    if (b.dataset.regel) stuur('/api/member/rechterhand/logboek/regel/weg', { id: b.dataset.regel });
  }

  /* De objectkaart is een div met rol en tabindex; dan hoort Enter hem ook
     echt te openen, niet alleen de muis. */
  function toets(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var kaart = e.target.closest && e.target.closest('.lb-obj[data-open]');
    if (kaart) { e.preventDefault(); Deel().S.open = kaart.dataset.open; laad(); }
  }

  async function aiVraag(e) {
    e.preventDefault();
    var v = $('#lbAiIn').value.trim();
    if (!v) return;
    $('#lbAiUit').textContent = 'Een ogenblik...';
    try {
      var r = await w.Geld.api('/api/member/rechterhand/ai', { app: 'logboek', vraag: v });
      $('#lbAiUit').textContent = r.antwoord;
      $('#lbAiIn').value = '';
    } catch (e2) { $('#lbAiUit').textContent = e2.message; }
  }

  function start() {
    var D = Deel();
    D.stijl();
    D.S.open = null;
    var vak = $('#lbWrap');
    vak.addEventListener('click', klik);
    vak.addEventListener('submit', aiVraag);
    vak.addEventListener('keydown', toets);
    if (w.RTGUitvoer) w.RTGUitvoer.bron(D.model);
    laad();
  }
  /* Het document heeft EEN bron-slot voor de tabellezer; bij een standwissel
     hoort dit model dat slot terug te geven. */
  function stop() { if (w.RTGUitvoer) w.RTGUitvoer.bron(null); }

  V.standen.push({
    id: 'logboek',
    naam: 'Logboek',
    uitleg: 'Het onderhoudsboek van uw jacht, jet, oldtimer of ander kostbaar bezit; wat binnenkort aan de beurt is, staat bovenaan.',
    html: '<div id="lbWrap"><div id="lbVak"><p class="stil">Laden...</p></div></div>',
    start: start,
    stop: stop
  });
})(window, document);
