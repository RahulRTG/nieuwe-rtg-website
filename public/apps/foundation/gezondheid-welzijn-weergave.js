/* Gezondheid & Welzijn toont alleen vastgelegde gezinszorg, echte Care-
   boekingen en woorden die de gebruiker zelf op dit toestel heeft bewaard. */
(function (w, d) {
  'use strict';
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]; }); }
  function glyph(n) { return '<i data-glyf="' + n + '"></i>'; }
  function vul(el) { try { if (w.RTGGlyf) w.RTGGlyf.vul(el); } catch (e) {} }
  function datum(iso) { try { return new Intl.DateTimeFormat('nl-NL', { weekday:'short', day:'numeric', month:'short' }).format(new Date(iso + 'T12:00:00')); } catch (e) { return iso || ''; } }
  function getal(v) { return typeof v === 'number' ? new Intl.NumberFormat('nl-NL', { maximumFractionDigits:1 }).format(v) : esc(v); }
  function eigen(staat) { var g = staat.gezondheid; return g && (g.personen || []).find(function (p) { return p.pid === g.mijnId; }); }
  function vandaag(staat) {
    var doel = d.getElementById('gwVandaag'), p = eigen(staat), r = staat.ritme || {}, regels = [];
    (p && p.medicijnen || []).sort(function (a, b) { return String(a.tijd || '99:99').localeCompare(String(b.tijd || '99:99')); }).slice(0, 3).forEach(function (m) {
      regels.push('<article class="gw-dagrij"><span class="gw-dagicoon">' + glyph('passkeys') + '</span><div><small>' + esc(m.tijd || 'Vandaag') + '</small><b>' + esc(m.naam) + '</b><em>' + esc(m.dosis || (m.gegevenVandaag ? 'Vandaag afgetekend' : 'Nog niet afgetekend')) + '</em></div><button type="button" data-gw-med="' + esc(m.id) + '" data-gw-gegeven="' + (m.gegevenVandaag ? 'true' : 'false') + '" aria-label="' + (m.gegevenVandaag ? 'Maak aftekening ongedaan' : 'Teken medicatie af') + '">' + (m.gegevenVandaag ? '&#10003;' : glyph('rechterhand')) + '</button></article>');
    });
    var afspraak = p && (p.afspraken || []).find(function (a) { return !a.voorbij; });
    if (afspraak) regels.push('<a class="gw-dagrij" href="gezondheid.html"><span class="gw-dagicoon">' + glyph('agenda') + '</span><div><small>' + esc(afspraak.tijd || datum(afspraak.datum)) + '</small><b>' + esc(afspraak.wat) + '</b><em>' + esc((afspraak.tijd ? datum(afspraak.datum) + ' · ' : '') + (afspraak.waar || 'Locatie niet ingevuld')) + '</em></div>' + glyph('rechterhand') + '</a>');
    if (r.beweging !== '') regels.push('<button class="gw-dagrij" type="button" data-gw-open="ritme"><span class="gw-dagicoon">' + glyph('sport') + '</span><div><small>Uw eigen ritme</small><b>' + esc(r.beweging) + ' minuten bewegen</b><em>Door u op dit toestel ingevuld</em></div>' + glyph('rechterhand') + '</button>');
    if (!regels.length) doel.innerHTML = '<div class="gw-leeg"><b>Uw dag is nog open.</b><span>Er staat geen medicatie, komende afspraak of beweging voor u klaar. Voeg alleen toe wat voor u helpt.</span><a href="gezondheid.html">Open gezondheidsboekje</a></div>';
    else doel.innerHTML = regels.join('');
    vul(doel);
  }
  function week() {
    var doel = d.getElementById('gwWeek'), nu = new Date(), dag = nu.getDay() || 7, ma = new Date(nu); ma.setDate(nu.getDate() - dag + 1);
    var namen = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'], h = '';
    namen.forEach(function (naam, i) { var x = new Date(ma); x.setDate(ma.getDate() + i); h += '<span class="' + (x.toDateString() === nu.toDateString() ? 'is-vandaag' : '') + '"><b>' + naam + '</b><em>' + x.getDate() + '</em></span>'; });
    doel.innerHTML = h;
  }
  function ritme(staat) {
    var r = staat.ritme || {}, doel = d.getElementById('gwRitmeKaarten');
    var kaarten = [
      ['emo-slaap', 'Slaap', r.slaap === '' ? 'Nog niet ingevuld' : getal(r.slaap) + ' uur', 'U bepaalt zelf wat genoeg voelt.'],
      ['sport', 'Beweging', r.beweging === '' ? 'Nog niet ingevuld' : esc(r.beweging) + ' minuten', 'Elke haalbare stap mag tellen.'],
      ['table', 'Eten & drinken', r.eten || 'Nog niet ingevuld', 'Geen score, alleen uw eigen beeld.'],
      ['balans', 'Rust', r.rust || 'Nog niet gepland', 'Een klein moment is ook een moment.']
    ];
    doel.innerHTML = kaarten.map(function (k) { return '<article>' + glyph(k[0]) + '<small>' + esc(k[1]) + '</small><b>' + k[2] + '</b><span>' + esc(k[3]) + '</span></article>'; }).join(''); vul(doel);
  }
  function zorg(staat) {
    var doel = d.getElementById('gwZorg'), p = eigen(staat), nu = new Date().toISOString().slice(0, 10);
    var care = (staat.care || []).filter(function (b) { return String(b.datum || '') >= nu; }).sort(function (a, b) { return (a.datum + a.tijd).localeCompare(b.datum + b.tijd); })[0];
    var afspraak = p && (p.afspraken || []).find(function (a) { return !a.voorbij; }), rijen = [];
    if (care) rijen.push('<a href="zorg.html"><span class="gw-zorgicoon">' + glyph('zorg') + '</span><div><small>Verbonden zorgverlener</small><b>' + esc(care.behandelaarNaam || care.aanbiederNaam) + '</b><em>' + esc(care.aanbiederNaam + ' · ' + datum(care.datum)) + '</em></div>' + glyph('rechterhand') + '</a>');
    if (afspraak) rijen.push('<a href="gezondheid.html"><span class="gw-zorgicoon">' + glyph('agenda') + '</span><div><small>Volgende afspraak</small><b>' + esc(afspraak.wat) + '</b><em>' + esc(datum(afspraak.datum) + (afspraak.waar ? ' · ' + afspraak.waar : '')) + '</em></div>' + glyph('rechterhand') + '</a>');
    rijen.push('<a href="mijnbanden.html"><span class="gw-zorgicoon">' + glyph('vrienden') + '</span><div><small>Vertrouwde kring</small><b>Bekijk wie mag meekijken</b><em>Alleen uw vastgelegde toestemmingen</em></div>' + glyph('rechterhand') + '</a>');
    if (!care && !afspraak) rijen.unshift('<div class="gw-leeg"><b>Nog geen zorgcontact gekoppeld.</b><span>We vullen geen huisarts of begeleider voor u in. Een echt contact verschijnt na een afspraak of verbinding.</span><a href="zorg.html">Open Hulp &amp; Zorg</a></div>');
    doel.innerHTML = rijen.join(''); vul(doel);
  }
  function alles(staat) { week(); vandaag(staat); ritme(staat); zorg(staat); }
  w.RTGFoundationGezondheidBeeld = { alles:alles, vandaag:vandaag, ritme:ritme, zorg:zorg };
})(window, document);
