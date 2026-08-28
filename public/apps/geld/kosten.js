/* Stand Kosten in RTG Geld: wat uw gebruik van RTG ons kost, en wie dat
   betaalt. De ledenkant van de kostprijslaag (KOSTEN.md), die tot nu toe alleen
   als endpoints bestond.

   HET TEKENWERK STAAT HIER NIET. Dat woont in /shared/kostenbeeld.js en
   /shared/kostenketen.js, want een ZAAK krijgt precies hetzelfde te zien
   (/apps/zaakkosten.html) en twee kopieen van datzelfde beeld zeggen op een dag
   iets anders over dezelfde maand. Wat hier staat is wat alleen voor een LID
   geldt: de vier routes op zijn eigen sessie, en de verbruiksgrens die hij voor
   zichzelf mag zetten.

   VIER ROUTES, ALLE VIER OP DE SESSIE: er is met opzet geen parameter om de
   kosten van iemand anders op te vragen (server/routes/kosten.js). Dit scherm
   kan die vraag dus ook niet stellen. */
(function (w, d) {
  'use strict';
  var V = w.RTGGeld = w.RTGGeld || { standen: [] };
  var $ = function (s) { return d.querySelector(s); };
  var BEELD = null;

  async function waarom(soort) {
    var K = w.RTGKosten;
    var vak = d.getElementById('ksKeten-' + soort);
    if (!vak) return;
    if (!vak.hidden) { vak.hidden = true; return; }
    vak.hidden = false;
    vak.innerHTML = '<div class="ks-stap">Laden...</div>';
    try { vak.innerHTML = K.keten(await w.Geld.api('/api/kosten/herkomst', { soort: soort })); }
    catch (e) { vak.innerHTML = '<div class="ks-stap">' + K.esc(e.message) + '</div>'; }
  }

  /* DE EIGEN GRENS, en die staat alleen op dit scherm: een zaak heeft hem niet
     (zie de opmerking bij de zaakroutes in server/routes/kosten.js). Twee
     bedragen die niet hetzelfde betekenen -- het eerste waarschuwt, het tweede
     zet de AI-weg dicht -- en dus twee velden en niet een schuifje. */
  function grensHtml(g) {
    var esc = w.RTGKosten.esc, euro = w.RTGKosten.euro;
    var zelf = (g.grens && g.grens.zelf) || {};
    var kantoor = g.grens && g.grens.kantoor;
    var v = function (c) { return c == null ? '' : (c / 100).toFixed(2).replace('.', ','); };
    return '<p class="stil">Standaard is er geen grens. Zet u er een, dan waarschuwt RTG u boven het eerste bedrag ' +
        'en gaat boven het tweede de AI-weg dicht voor u -- de rest van RTG blijft gewoon werken.</p>' +
      (g.stand && g.stand.uitleg ? '<p class="h-mt40">' + esc(g.stand.uitleg) + '</p>' : '') +
      '<label class="stil lbl" for="ksWaarschuw">Waarschuw mij boven (euro per maand)</label>' +
      '<input id="ksWaarschuw" inputmode="decimal" maxlength="12" value="' + esc(v(zelf.waarschuwCenten)) + '">' +
      '<label class="stil lbl" for="ksPlafond">Zet de AI-weg dicht boven (euro per maand)</label>' +
      '<input id="ksPlafond" inputmode="decimal" maxlength="12" value="' + esc(v(zelf.plafondCenten)) + '">' +
      '<p class="stil h-mt40">Allebei leeg laten haalt uw eigen grens weg.</p>' +
      '<div class="h-mt60"><button class="knop hoofd" id="ksGrensZet" type="button">Mijn grens bewaren</button></div>' +
      (kantoor ? '<p class="stil h-mt60">RTG heeft daarnaast een eigen grens voor dit account staan' +
        (kantoor.plafondCenten != null ? ' (' + esc(euro(kantoor.plafondCenten)) + ')' : '') +
        '. Die staat los van de uwe, en de strengste van de twee geldt.</p>' : '');
  }

  async function laad() {
    var K = w.RTGKosten;
    try {
      var beeld = await w.Geld.api('/api/kosten/mij');
      BEELD = beeld;
      var vb = null, gr = null;
      try { vb = await w.Geld.api('/api/kosten/vooruitblik'); } catch (e) { vb = null; }
      try { gr = await w.Geld.api('/api/kosten/grens'); } catch (e) { gr = null; }
      $('#ksHoofd').innerHTML = K.hoofd(beeld, vb, beeld.grens, 'lid');
      $('#ksRegels').innerHTML = K.regels(beeld);
      $('#ksBetaalt').innerHTML = K.betaalt(beeld);
      $('#ksGrens').innerHTML = gr ? grensHtml(gr) : '<p class="stil">De grens is niet geladen.</p>';
      $('#ksNiet').innerHTML = K.niet(beeld);
    } catch (e) {
      $('#ksHoofd').innerHTML = '<p class="stil">' + K.esc(e.message) + ' Log eerst in via de leden-app.</p>';
    }
  }

  async function grensZet() {
    var c = w.Geld.naarCenten;
    var wv = $('#ksWaarschuw').value.trim(), pv = $('#ksPlafond').value.trim();
    if ((wv && c(wv) == null) || (pv && c(pv) == null)) { w.Geld.melding('Vul een bedrag in, bijvoorbeeld 12,50.'); return; }
    try {
      await w.Geld.api('/api/kosten/grens/zet', { waarschuwCenten: wv ? c(wv) : null, plafondCenten: pv ? c(pv) : null });
      w.Geld.melding('Uw grens is bewaard.');
      laad();
    } catch (e) { w.Geld.melding(e.message); }
  }

  function klik(e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'ksGrensZet') { grensZet(); return; }
    if (b.dataset.waarom) waarom(b.dataset.waarom);
  }

  /* Meenemen (shared/uitvoer.js): de regels van deze maand met hun bedrag EN
     hun bewijsgraad. Die laatste kolom hoort mee: een uitvoer waarin een
     toegerekend bedrag naast een gemeten bedrag staat zonder dat verschil, is
     precies het bestand waarmee iemand later een verkeerde som maakt. */
  function model() {
    if (!BEELD) return null;
    var o = BEELD.overzicht;
    return { naam: 'mijn-kosten-' + BEELD.periode,
      kolommen: ['soort', 'aantal', 'bedrag in centen', 'bewijsgraad'],
      rijen: (o.regels || []).map(function (r) {
        return [r.naam, r.aantal, r.millicenten == null ? '' : Math.round(r.millicenten / 1000), r.graad];
      }).concat((o.toegerekend || []).map(function (r) {
        return [r.naam, 'aandeel', r.centen, r.graad];
      })) };
  }

  function start() {
    w.RTGKosten.stijl();
    BEELD = null;
    $('#ksWrap').addEventListener('click', klik);
    if (w.RTGUitvoer) w.RTGUitvoer.bron(model);
    laad();
  }
  function stop() { if (w.RTGUitvoer) w.RTGUitvoer.bron(null); }

  V.standen.push({
    id: 'kosten',
    naam: 'Kosten',
    uitleg: 'Wat uw gebruik van RTG deze maand kost, wie dat betaalt, en waar elk bedrag vandaan komt.',
    html:
      '<div id="ksWrap">' +
        '<div id="ksHoofd"><p class="stil">Laden...</p></div>' +
        '<h2>Waar dit vandaan komt</h2>' +
        '<div id="ksRegels"><p class="stil">Laden...</p></div>' +
        '<h2>Wie betaalt dit</h2>' +
        '<div class="kaart" id="ksBetaalt"><p class="stil">Laden...</p></div>' +
        '<h2>Uw eigen grens</h2>' +
        '<div class="kaart" id="ksGrens"><p class="stil">Laden...</p></div>' +
        '<h2>Wat dit scherm niet weet</h2>' +
        '<div class="kaart" id="ksNiet"><p class="stil">Laden...</p></div>' +
      '</div>',
    start: start,
    stop: stop
  });
})(window, document);
