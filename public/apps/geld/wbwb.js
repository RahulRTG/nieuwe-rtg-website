/* Stand Wie betaalt wat, deel 2 van 2: de registratie. Leunt op
   w.RTGGeldDeel.wbw uit wbw.js (stijl, tekenwerk, idem-sleutel); hier staan
   de handelingen. Dezelfde routes als /apps/wbw.html, letterlijk:
   /api/wbw/mijn, /api/wbw/maak, /api/wbw/groep, /api/wbw/uitgave,
   /api/wbw/verreken, /api/wbw/verzoek en /api/member/connections (de
   ledenkiezer uit De Salon). */
(function (w, d) {
  'use strict';
  var V = w.RTGGeld = w.RTGGeld || { standen: [] };
  var $ = function (s) { return d.querySelector(s); };

  function Deel() { return w.RTGGeldDeel.wbw; }

  async function laadLijstjes() {
    var Geld = w.Geld, D = Deel();
    try {
      var r = await Geld.api('/api/wbw/mijn');
      D.S.lijstjes = r.groepen || [];
      D.tekenLijstjes();
      D.toon('lijst');
      laadVrienden();
    } catch (e) {
      /* de poort van de oude pagina: niet ingelogd of geen lid, dan geen
         half scherm maar alleen de uitleg */
      $('#wbFout').innerHTML = RTGLeeg.html(RTGLeeg.vanFout({ status: 401, message: Geld.esc(e.message) }));
      $('#wbLijst').hidden = true;
      $('#wbGroep').hidden = true;
    }
  }

  async function laadVrienden() {
    var D = Deel();
    try { D.tekenVrienden((await w.Geld.api('/api/member/connections')).connections || []); }
    catch (e) { $('#wbVrienden').innerHTML = '<p class="stil">' + w.Geld.esc(e.message) + '</p>'; }
  }

  async function openGroep(id) {
    var D = Deel();
    try {
      D.S.groep = (await w.Geld.api('/api/wbw/groep', { id: id })).groep;
      D.tekenGroep();
      D.toon('groep');
    } catch (e) { w.Geld.melding(e.message); }
  }

  async function maak() {
    var Geld = w.Geld;
    var leden = [];
    d.querySelectorAll('#wbVrienden input:checked').forEach(function (x) { leden.push(x.value); });
    try {
      var r = await Geld.api('/api/wbw/maak', { naam: $('#wbNaam').value, leden: leden });
      $('#wbNaam').value = '';
      Geld.melding('Het lijstje staat klaar; iedereen kreeg een seintje.');
      openGroep(r.groep.id);
    } catch (e) { Geld.melding(e.message); }
  }

  async function uitgave() {
    var Geld = w.Geld, D = Deel();
    /* Naar centen via Geld.naarCenten (hulp.js), op EEN plek: het eigen regeltje
       dat hier stond las "1.000" als een euro, want het nam de punt voor een
       decimaalteken in plaats van het duizendtalteken dat het bij ons is. In
       een gedeeld lijstje betekent dat een diner van duizend euro dat als een
       euro wordt omgeslagen over de tafel. */
    var centen = Geld.naarCenten($('#wbBedrag').value);
    if (centen == null || centen <= 0) return Geld.melding('Bedrag?');
    var voor = [];
    d.querySelectorAll('#wbVoor input:checked').forEach(function (x) { voor.push(x.value); });
    try {
      await Geld.api('/api/wbw/uitgave', { id: D.S.groep.id, oms: $('#wbOms').value, centen: centen, voor: voor });
      $('#wbOms').value = ''; $('#wbBedrag').value = '';
      openGroep(D.S.groep.id);
    } catch (e) { Geld.melding(e.message); }
  }

  async function verreken() {
    var Geld = w.Geld, D = Deel();
    try {
      var r = await Geld.api('/api/wbw/verreken', { id: D.S.groep.id, idem: D.idem() });
      Geld.melding('Verrekend via RTG Pay: ' + r.betalingen.map(function (b) {
        return Geld.euro(b.centen) + ' naar ' + b.aan;
      }).join(', ') + '.');
      openGroep(D.S.groep.id);
    } catch (e) { Geld.melding(e.message); }
  }

  async function verzoek() {
    var Geld = w.Geld, D = Deel();
    try {
      var r = await Geld.api('/api/wbw/verzoek', { id: D.S.groep.id });
      Geld.melding(r.verzoeken + ' betaalverzoek(en) verstuurd; zij betalen met een tik.');
    } catch (e) { Geld.melding(e.message); }
  }

  /* Meenemen (shared/uitvoer.js): dit is een kasboek, dus dat neemt u mee.
     Het document heeft EEN bron-slot; dit model geeft daarom null terug
     zodra deze stand niet op het scherm staat, zodat de tabellezer voor de
     andere standen gewoon zijn werk doet. Bedragen met een punt: de centen
     zijn het gegeven, de komma van het scherm is opmaak. */
  function euroUit(c) { return ((Number(c) || 0) / 100).toFixed(2); }
  function dag(t) { return String(t || '').slice(0, 10); }
  function model() {
    if (!d.getElementById('wbWrap')) return null;
    var D = Deel(), g = D.S.groep, rijen;
    if (g && !$('#wbGroep').hidden) {
      rijen = (g.regels || []).map(function (r) {
        return [dag(r.at), r.soort, r.door, r.soort === 'uitgave' ? r.oms : '',
          r.soort === 'uitgave' ? '' : (r.aan || ''), r.soort === 'uitgave' ? r.voor : '', euroUit(r.centen)];
      });
      return rijen.length ? { naam: 'wie-betaalt-wat',
        kolommen: ['datum', 'soort', 'door', 'omschrijving', 'aan', 'voor personen', 'bedrag'],
        rijen: rijen } : null;
    }
    rijen = D.S.lijstjes.map(function (x) { return [dag(x.at), x.naam, x.leden, euroUit(x.mijnSaldo)]; });
    return rijen.length ? { naam: 'mijn-lijstjes',
      kolommen: ['datum', 'lijstje', 'personen', 'mijn saldo'], rijen: rijen } : null;
  }

  /* Een gedelegeerde klik op de omhulling in plaats van knop voor knop: de
     lijsten worden bij elke verversing opnieuw getekend, en de omhulling
     verdwijnt netjes mee als de stand wisselt. */
  function klik(e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'wbMaak') { maak(); return; }
    if (b.id === 'wbTerug') { laadLijstjes(); return; }
    if (b.id === 'wbVoeg') { uitgave(); return; }
    if (b.id === 'wbVerreken') { verreken(); return; }
    if (b.id === 'wbVerzoek') { verzoek(); return; }
    if (b.dataset.open) openGroep(b.dataset.open);
  }

  function start() {
    var D = Deel();
    D.stijl();
    $('#wbWrap').addEventListener('click', klik);
    /* Het document heeft EEN bron-slot en elke zusterstand schrijft het bij
       zijn start opnieuw. Dus: bij ELKE start aanmelden, bij stop weer
       loslaten -- een eenmalige vlag hier liet Meenemen blijvend leeg staan
       zodra u een keer naar een andere stand en terug was gewisseld. */
    if (w.RTGUitvoer) w.RTGUitvoer.bron(model);
    laadLijstjes();
  }

  function stop() {
    if (w.RTGUitvoer) w.RTGUitvoer.bron(null);
  }

  V.standen.push({
    id: 'wbw',
    naam: 'Wie betaalt wat',
    uitleg: 'Gedeelde lijstjes met uw Salon-vrienden: wie betaalde wat, hoe de balans staat, en verrekenen via RTG Pay.',
    html:
      '<div id="wbWrap">' +
        '<div id="wbFout"></div>' +
        '<section id="wbLijst" hidden>' +
          '<h2>Mijn lijstjes</h2>' +
          '<div id="wbLijstjes"><p class="stil">Laden...</p></div>' +
          '<h2>Nieuw lijstje</h2>' +
          '<div class="kaart">' +
            '<label class="lbl stil" for="wbNaam">Naam (bijv. Weekend Ibiza)</label>' +
            '<input id="wbNaam" maxlength="40">' +
            '<span class="lbl stil" id="wbVriendenLbl">Wie doen er mee? (Salon-vrienden)</span>' +
            '<div id="wbVrienden" role="group" aria-labelledby="wbVriendenLbl"><p class="stil">Vrienden laden...</p></div>' +
            '<div class="wb-rij"><button class="knop hoofd" id="wbMaak" type="button">Maak het lijstje</button></div>' +
          '</div>' +
        '</section>' +
        '<section id="wbGroep" hidden>' +
          '<button class="knop" id="wbTerug" type="button">← Mijn lijstjes</button>' +
          '<div class="wb-naam" id="wbGNaam"></div>' +
          '<div class="kaart">' +
            '<div id="wbBalans"></div>' +
            '<div class="wb-rij">' +
              '<button class="knop hoofd" id="wbVerreken" type="button">Verreken mijn deel</button>' +
              '<button class="knop" id="wbVerzoek" type="button">Stuur betaalverzoeken</button>' +
            '</div>' +
            '<p class="stil h-mt50">Geld beweegt alleen door uw eigen tik: u betaalt uw ' +
              'eigen deel, of u stuurt de anderen een net betaalverzoek. Niemand kan bij andermans wallet.</p>' +
          '</div>' +
          '<h2>Nieuwe uitgave</h2>' +
          '<div class="kaart">' +
            '<div class="wb-rij">' +
              '<input id="wbOms" maxlength="80" placeholder="Wat was het? (bijv. Diner strandclub)" aria-label="Omschrijving">' +
              '<input id="wbBedrag" inputmode="decimal" placeholder="Bedrag" aria-label="Bedrag in euro">' +
            '</div>' +
            '<div id="wbVoor" role="group" aria-label="Voor wie was dit?"></div>' +
            '<div class="wb-rij"><button class="knop hoofd" id="wbVoeg" type="button">Ik heb dit betaald</button></div>' +
          '</div>' +
          '<h2>Het lijstje</h2>' +
          '<div class="kaart wb-log" id="wbLog"><p class="stil">Nog geen uitgaven.</p></div>' +
        '</section>' +
      '</div>',
    start: start,
    stop: stop
  });
})(window, document);
