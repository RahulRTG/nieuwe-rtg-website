/* Stand Lab-fonds, deel 2 van 2: de registratie. Leunt op
   w.RTGGeldDeel.labfonds uit labfonds.js (stijl, tekenwerk, euro-omzetting,
   uitvoermodel); hier staan de handelingen. Dezelfde routes als
   /apps/labfonds.html, letterlijk: /api/labfonds/overzicht,
   /api/labfonds/doneer, /api/labfonds/stem, /api/labfonds/beslis en
   /api/labfonds/voorstel/maak. De routes die de server verder nog heeft
   (locatie/maak, scheidsrechter, boardroom) riep de pagina nooit aan; die
   blijven hier dus ook weg. */
(function (w, d) {
  'use strict';
  var V = w.RTGGeld = w.RTGGeld || { standen: [] };
  var $ = function (s) { return d.querySelector(s); };

  function Deel() { return w.RTGGeldDeel.labfonds; }

  async function laad() {
    var Geld = w.Geld, D = Deel(), r;
    try { r = await Geld.api('/api/labfonds/overzicht'); }
    catch (e) {
      /* de poort van de oude pagina: niet ingelogd (of gast), dan geen half
         scherm maar alleen de uitleg waarom */
      $('#lfFout').innerHTML = RTGLeeg.html(RTGLeeg.vanFout({ status: 401, message: Geld.esc(e.message) }));
      $('#lfBody').hidden = true;
      return;
    }
    $('#lfFout').innerHTML = '';
    $('#lfBody').hidden = false;
    D.S.locs = r.locaties || [];
    $('#lfOp').textContent = D.eu(r.totaalOpgehaald);
    $('#lfPot').textContent = D.eu(r.totaalPot);
    $('#lfMijn').textContent = D.eu(r.mijnBijdrage);
    D.tekenLocs(D.S.locs);
    D.tekenVoorstellen(r.voorstellen || []);
    $('#lfNLoc').innerHTML = D.S.locs.map(function (l) {
      return '<option value="' + Geld.esc(l.id) + '">' + Geld.esc(l.naam) + '</option>';
    }).join('');
  }

  async function doneer(locId) {
    var inp = $('#lfWrap').querySelector('[data-b="' + locId + '"]');
    var bedrag = Deel().getal(inp && inp.value);
    if (!bedrag) { if (inp) inp.focus(); return; }
    try {
      await w.Geld.api('/api/labfonds/doneer', { locId: locId, bedrag: bedrag });
      if (inp) inp.value = '';
      w.Geld.melding('Dank; het staat in de pot van deze plek.');
      laad();
    } catch (e) { w.Geld.melding(e.message); }
  }

  async function stem(id, keuze) {
    try { await w.Geld.api('/api/labfonds/stem', { id: id, keuze: keuze }); laad(); }
    catch (e) { w.Geld.melding(e.message); }
  }

  /* WIE MAG BESLISSEN: de server laat alleen de INDIENER de stemming sluiten
     (kern/labfonds/voorstellen.js). De oude pagina toonde de knop bij elk
     voorstel en liet de server weigeren; dat blijft zo, want het overzicht
     geeft niet terug wiens voorstel het is -- de knop verstoppen zou hier
     gokken zijn. De regel staat als zin boven de lijst, en een weigering
     komt netjes terug als melding. */
  async function beslis(id) {
    if (!w.confirm('De leden samen laten beslissen over dit voorstel? De scheidsrechter bewaakt de grenzen.')) return;
    try {
      var r = await w.Geld.api('/api/labfonds/beslis', { id: id });
      var b = r.voorstel && r.voorstel.besluit;
      w.Geld.melding(b ? b.reden : 'Beslist.');
      laad();
    } catch (e) { w.Geld.melding(e.message); }
  }

  async function maak() {
    var Geld = w.Geld;
    $('#lfNFout').textContent = '';
    try {
      await Geld.api('/api/labfonds/voorstel/maak', {
        locId: $('#lfNLoc').value, titel: $('#lfNTitel').value,
        doel: $('#lfNDoel').value, bedrag: Deel().getal($('#lfNBedrag').value)
      });
      $('#lfNTitel').value = ''; $('#lfNDoel').value = ''; $('#lfNBedrag').value = '';
      Geld.melding('Ingediend; de scheidsrechter gaf meteen een eerste oordeel.');
      laad();
    } catch (e) { $('#lfNFout').textContent = e.message; }
  }

  /* Een gedelegeerde klik op de omhulling in plaats van knop voor knop: de
     lijsten worden bij elke verversing opnieuw getekend, en de omhulling
     verdwijnt netjes mee als de stand wisselt. */
  function klik(e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'lfNMaak') { maak(); return; }
    if (b.dataset.doneer) { doneer(b.dataset.doneer); return; }
    if (b.dataset.stem) { stem(b.dataset.id, b.dataset.stem); return; }
    if (b.dataset.beslis) beslis(b.dataset.beslis);
  }

  function start() {
    var D = Deel();
    D.stijl();
    $('#lfWrap').addEventListener('click', klik);
    if (w.RTGUitvoer) w.RTGUitvoer.bron(D.model);
    laad();
  }
  /* Het document heeft EEN bron-slot voor de tabellezer; bij een standwissel
     hoort dit model dat slot terug te geven. */
  function stop() {
    if (w.RTGUitvoer) w.RTGUitvoer.bron(null);
  }

  V.standen.push({
    id: 'labfonds',
    naam: 'Lab-fonds',
    uitleg: 'Samen inzamelen voor het RTF Onderzoekslab, per locatie verdeeld; wat de pot doet, beslissen de leden gezamenlijk met een AI-scheidsrechter.',
    html:
      '<div id="lfWrap">' +
        '<div id="lfFout"></div>' +
        '<div id="lfBody" hidden>' +
          '<div class="lf-som">' +
            '<div class="c"><div class="n">Samen opgehaald</div><div class="v bedrag" id="lfOp">€ 0</div></div>' +
            '<div class="c"><div class="n">In de potten</div><div class="v bedrag" id="lfPot">€ 0</div></div>' +
            '<div class="c"><div class="n">Mijn bijdrage</div><div class="v bedrag" id="lfMijn">€ 0</div></div>' +
          '</div>' +
          '<h2>Locaties</h2>' +
          '<p class="stil">Uw bijdrage gaat naar de pot van een plek, zodat die zelf in de eigen omgeving kan investeren.</p>' +
          '<div id="lfLocs"><p class="stil">Laden...</p></div>' +
          '<h2>Voorstellen</h2>' +
          '<p class="stil">De leden stemmen; alleen wie een voorstel indiende, sluit de stemming.</p>' +
          '<div id="lfVoorstellen"><p class="stil">Laden...</p></div>' +
          '<h2>Voorstel doen</h2>' +
          '<div class="kaart">' +
            '<p class="stil">Wat zou de pot van een locatie in de omgeving kunnen betekenen? De scheidsrechter geeft meteen een eerste oordeel; de leden stemmen.</p>' +
            '<label class="lbl stil" for="lfNLoc">Locatie</label>' +
            '<select id="lfNLoc"></select>' +
            '<label class="lbl stil" for="lfNTitel">Titel</label>' +
            '<input id="lfNTitel" maxlength="100" placeholder="Bijv. Zonnepanelen strandtent">' +
            '<label class="lbl stil" for="lfNDoel">Wat levert het de omgeving op?</label>' +
            '<textarea id="lfNDoel" rows="3" maxlength="500"></textarea>' +
            '<label class="lbl stil" for="lfNBedrag">Bedrag uit de pot (€)</label>' +
            '<input id="lfNBedrag" inputmode="decimal">' +
            '<div class="lf-fout" id="lfNFout"></div>' +
            '<button class="knop hoofd" id="lfNMaak" type="button">Voorstel indienen</button>' +
          '</div>' +
        '</div>' +
      '</div>',
    start: start,
    stop: stop
  });
})(window, document);
