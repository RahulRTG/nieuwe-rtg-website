/* Het levens-command-center (LEVEN.md par. 1.5), scherm.

   Dezelfde vorm als de cockpit van RTG Geld, met een wezenlijk verschil dat
   uit LEVEN.md par. 0 komt: deze wereld voert niets uit. Er staat dus geen
   enkele knop die namens de mens handelt -- alleen kijken en, als een regel
   ooit een echt adres draagt, openen.

   DE FASEN MET STAAT 'nvt' KOMEN HIER NIET IN BEELD, ook niet grijs en ook
   niet doorgestreept. Dat is de belangrijkste regel van dit bestand. Wie geen
   studie, geen kinderen of geen pensioen heeft, MIST NIETS (par. 1.1); een
   grijze fase leest als een gemiste stap, en dan is de levenslijn stilletjes
   een voortgangsbalk over iemands leven geworden. Om dezelfde reden staat er
   nergens een percentage, een teller "x van de tien" of een balk.

   En wat hier evenmin mag komen (par. 2.4 en 2.9): een getal dat een mens met
   een ander vergelijkt, een reeks, een dagdoel, een badge, of iets dat om
   terugkomen vraagt. */
(function (w, d) {
  'use strict';
  var $ = function (s) { return d.querySelector(s); };

  function token() {
    try { return localStorage.getItem('rtg_member_token') || ''; } catch (e) { return ''; }
  }

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* Het token reist in de kop en nooit in de url (huisregel). */
  function api(pad, body) {
    return fetch(pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.error || 'Er ging iets mis.'); e.status = r.status; throw e; }
        return j;
      });
    });
  }

  var LVCSS =
    '.lv-intro{color:var(--rtg-soft);font-size:.92rem;margin:.2rem 0 1.4rem;}' +
    '#lvVak h2,.lv-mentorvak h2{font-size:.72rem;letter-spacing:.17em;text-transform:uppercase;' +
      'color:var(--rtg-soft);font-weight:500;margin:1.6rem 0 .5rem;}' +
    '.lv-staat{font-size:1.05rem;margin:.1rem 0 .3rem;}' +
    '.lv-groet{font-size:1.7rem;margin:0;}' +
    '.lv-lijn{list-style:none;margin:.4rem 0 0;padding:0;}' +
    '.lv-fase{display:flex;gap:.75rem;align-items:flex-start;padding:.5rem 0;}' +
    '.lv-stip{flex:0 0 auto;width:.6rem;height:.6rem;border-radius:50%;margin-top:.45rem;' +
      'background:var(--rtg-line);}' +
    '.lv-fase[data-nu="1"] .lv-stip{background:var(--gold-basis);box-shadow:0 0 0 4px rgba(201,162,75,.15);}' +
    '.lv-naam{font-weight:600;}' +
    '.lv-fase[data-staat="komt"] .lv-naam{color:var(--rtg-soft);font-weight:500;}' +
    '.lv-toel{display:block;font-size:.82rem;color:var(--rtg-soft);line-height:1.5;margin-top:.1rem;}' +
    '.lv-kaart{border:1px solid var(--rtg-line);border-radius:12px;padding:.9rem 1rem;margin:.6rem 0;}' +
    '.lv-wanneer{font-size:.8rem;color:var(--rtg-soft);}' +
    '.lv-geg{list-style:none;margin:.6rem 0 0;padding:.6rem 0 0;border-top:1px solid var(--rtg-line);}' +
    '.lv-geg li{font-size:.76rem;color:var(--rtg-soft);line-height:1.6;}' +
    '.lv-vraagrij{display:flex;gap:.6rem;}.lv-vraagrij input{flex:1;min-width:0;}' +
    '.lv-mentorvak{margin-top:1.6rem;}' +
    '.lv-stil{font-size:.82rem;color:var(--rtg-soft);margin-top:1rem;}';

  /* Via createElement: de voordeur stempelt alleen zo een CSP-nonce; een blok
     uit een innerHTML-string wordt geweigerd (dat ging bij RTG-code al eens
     mis en het scherm ging ongestyled de lucht in). */
  function stijl() {
    if (d.getElementById('lvStijl')) return;
    var st = d.createElement('style');
    st.id = 'lvStijl';
    st.textContent = LVCSS;
    d.head.appendChild(st);
  }

  var UURZIN = { Goedemorgen: 1, Goedemiddag: 1, Goedenavond: 1 };

  function faseRij(f, nuId) {
    return '<li class="lv-fase" data-staat="' + esc(f.staat) + '" data-nu="' + (f.id === nuId ? '1' : '0') + '">' +
      '<span class="lv-stip"></span><span><span class="lv-naam">' + esc(f.naam) + '</span>' +
      (f.id === nuId ? ' <span class="lv-wanneer">nu</span>' : '') +
      '<span class="lv-toel">' + esc(f.toelichting) + '</span></span></li>';
  }

  function kaart(u) {
    return '<article class="lv-kaart"><b>' + esc(u.titel) + '</b>' +
      (u.wanneer ? ' <span class="lv-wanneer">' + esc(u.wanneer) + '</span>' : '') +
      '<p class="lv-toel">' + esc(u.uitleg) + '</p>' +
      '<ul class="lv-geg">' +
        (u.gegevens || []).map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('') +
      '</ul></article>';
  }

  function teken(c) {
    var nuId = (c.lijn && c.lijn.nu && c.lijn.nu.faseId) || null;
    /* alleen fasen met een aanwijzing; 'nvt' bestaat hier niet -- zie de kop */
    var fasen = ((c.lijn && c.lijn.fasen) || []).filter(function (f) { return f.staat !== 'nvt'; });
    var n = (c.uitzonderingen || []).length;
    var groet = UURZIN[c.groet && c.groet.zin] ? c.groet.zin : 'Welkom';

    $('#lvVak').innerHTML =
      '<h1 class="rtg-ceremonie lv-groet">' + esc(groet) + '</h1>' +
      '<p class="lv-staat">' + (n
        ? esc(n === 1 ? '1 ding vraagt aandacht' : n + ' dingen vragen aandacht')
        : 'Alles loopt') + '</p>' +
      (n ? '' : '<p class="stil">U hoeft vandaag niets te doen.</p>') +
      (n ? '<h2>Vraagt aandacht</h2>' + c.uitzonderingen.map(kaart).join('') : '') +
      (fasen.length
        ? '<h2>Uw lijn</h2><ul class="lv-lijn">' + fasen.map(function (f) { return faseRij(f, nuId); }).join('') + '</ul>'
        : '<h2>Uw lijn</h2><p class="stil">De bronnen weten nog niets van uw lijn. Dat zegt niets over u.</p>') +
      /* de stille bronnen horen ZICHTBAAR te zijn: een levensbeeld met een gat
         erin dat compleet lijkt, laat iemand denken dat er niets speelt */
      (c.stil && c.stil.length
        ? '<p class="lv-stil">Onvolledig: geen gegevens uit ' + esc(c.stil.join(', ')) + '.</p>'
        : '');
  }

  function laad() {
    api('/api/leven/cockpit').then(teken, function (e) {
      $('#lvVak').innerHTML = '<p class="stil">' + esc(e.message) +
        (e.status === 401 ? ' Log eerst in via de leden-app.' : '') + '</p>';
    });
  }

  function vraag(e) {
    e.preventDefault();
    var v = $('#lvMentorIn').value.trim();
    if (!v) return;
    var uit = $('#lvMentorUit');
    uit.hidden = false;
    uit.textContent = 'Een ogenblik...';
    api('/api/leven/mentor', { vraag: v }).then(function (r) {
      /* het antwoord met zijn verantwoording eronder (par. 2.10): een mentor
         die niet kan zeggen waarop hij zich baseert, is een orakel */
      uit.innerHTML = '<p>' + esc(r.antwoord) + '</p><ul class="lv-geg">' +
        (r.gegevens || []).map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('') + '</ul>';
      $('#lvMentorIn').value = '';
    }, function (err) {
      uit.textContent = err.message + (err.status === 401 ? ' Log eerst in via de leden-app.' : '');
    });
  }

  d.addEventListener('DOMContentLoaded', function () {
    stijl();
    $('#lvMentorForm').addEventListener('submit', vraag);
    laad();
  });
})(window, document);
