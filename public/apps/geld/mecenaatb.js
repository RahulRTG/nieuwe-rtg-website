/* Stand Mecenaat, deel 2 van 2: de handelingen en de registratie. Leunt op
   w.RTGGeldDeel.mecenaat uit mecenaat.js (stijl, tekenwerk, meeneembron).

   Premium: de server weigert een RTG-pas met een 403 en een nette zin. Die
   zin is hier de hele poortwachter. Er staat met opzet geen eigen deur voor,
   want een tweede oordeel naast dat van de server gaat er vroeg of laat
   naast lopen (LAT.md regel 4: een waarheid, een plek).

   Dezelfde routes als de pagina, letterlijk en volledig:
   /api/member/rechterhand/mecenaat (het dossier),
   /api/member/rechterhand/mecenaat/gift (vastleggen),
   /api/member/rechterhand/mecenaat/gift/weg (verwijderen),
   /api/member/rechterhand/mecenaat/betaald (toezegging naar betaald en terug),
   /api/member/rechterhand/ai (de adviseur, met app: 'mecenaat'). */
(function (w, d) {
  'use strict';
  var V = w.RTGGeld = w.RTGGeld || { standen: [] };
  var M = (w.RTGGeldDeel = w.RTGGeldDeel || {}).mecenaat;
  var $ = function (s) { return d.querySelector(s); };

  async function laad() {
    var Geld = w.Geld;
    try {
      M.stand = await Geld.api('/api/member/rechterhand/mecenaat');
      M.teken(M.stand);
    } catch (e) {
      M.stand = null;
      /* Bij een 403 is de serverzin (onderdeel van de Lifestyle Pass) het
         hele verhaal; daar hoort geen inloghint achteraan. Al het andere is
         vrijwel altijd niet ingelogd, zoals in de andere standen. */
      $('#mcVak').innerHTML = RTGLeeg.html(RTGLeeg.vanFout(e));
    }
  }

  async function vastleggen() {
    var Geld = w.Geld;
    var doel = $('#mcGDoel').value.trim();
    if (!doel) return Geld.melding('Welk goed doel?');
    try {
      await Geld.api('/api/member/rechterhand/mecenaat/gift', {
        doel: doel, thema: $('#mcGThema').value, bedrag: $('#mcGBedrag').value,
        periode: $('#mcGPeriode').value, datum: $('#mcGDatum').value,
        betaald: $('#mcGBet').getAttribute('aria-pressed') === 'true',
        foundation: $('#mcGFound').getAttribute('aria-pressed') === 'true'
      });
      Geld.melding('Vastgelegd.');
      laad();
    } catch (e) { Geld.melding(e.message); }
  }

  async function zetBetaald(id, betaald) {
    try { await w.Geld.api('/api/member/rechterhand/mecenaat/betaald', { id: id, betaald: betaald }); laad(); }
    catch (e) { w.Geld.melding(e.message); }
  }

  async function weg(id) {
    /* Verwijderen is onomkeerbaar; daarom als enige actie een bevestiging. */
    if (!w.confirm('Deze gift verwijderen?')) return;
    try { await w.Geld.api('/api/member/rechterhand/mecenaat/gift/weg', { id: id }); laad(); }
    catch (e) { w.Geld.melding(e.message); }
  }

  async function vraag() {
    var Geld = w.Geld, u = $('#mcAiUit'), v = $('#mcAiIn').value.trim();
    if (!v) return;
    u.hidden = false;
    u.textContent = 'Een ogenblik…';
    try {
      var r = await Geld.api('/api/member/rechterhand/ai', { app: 'mecenaat', vraag: v });
      u.textContent = r.antwoord || 'Geen antwoord.';
      $('#mcAiIn').value = '';
    } catch (e) { u.textContent = e.message; }
  }

  /* Gedelegeerd op de omhulling: de lijst wordt bij elke verversing opnieuw
     getekend, en de omhulling verdwijnt netjes mee als de stand wisselt. */
  function klik(e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'mcGBet' || b.id === 'mcGFound') {
      var aan = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(aan));
      b.classList.toggle('aan', aan);
      return;
    }
    if (b.dataset.mcbet) return zetBetaald(b.dataset.mcbet, b.dataset.nu !== '1');
    if (b.dataset.mcweg) weg(b.dataset.mcweg);
  }

  // submit borrelt op, dus ook een opnieuw getekend formulier doet gewoon mee
  function opSubmit(e) {
    if (e.target.id === 'mcGForm') { e.preventDefault(); vastleggen(); }
    else if (e.target.id === 'mcAiForm') { e.preventDefault(); vraag(); }
  }

  function start() {
    M.stijl();
    M.stand = null;
    var wrap = $('#mcWrap');
    wrap.addEventListener('click', klik);
    wrap.addEventListener('submit', opSubmit);
    if (w.RTGUitvoer) w.RTGUitvoer.bron(M.bron);
    laad();
  }

  /* Geen interval of stream hier, maar de meeneembron zou anders blijven
     hangen en giften afgeven op een stand die er niet meer staat. */
  function stop() {
    if (w.RTGUitvoer) w.RTGUitvoer.bron(null);
  }

  V.standen.push({
    id: 'mecenaat',
    naam: 'Mecenaat',
    uitleg: 'Uw filantropie op orde: giften met doel, thema en bedrag, toegezegd of betaald, en wat er via de RTFoundation loopt. Onderdeel van de Lifestyle Pass.',
    html: '<div id="mcWrap"><div id="mcVak"><p class="stil">Laden…</p></div></div>',
    start: start,
    stop: stop
  });
})(window, document);
