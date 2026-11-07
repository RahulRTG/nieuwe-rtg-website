/* De overdrachtsbalk: wat je uit je mand hebt meegenomen naar dit scherm.

   WAAROM DIT EEN GEDEELD SCRIPT IS EN GEEN STUK VAN EEN PAGINA. De mand van
   kern/commerce loopt over verkopers heen, maar bevestigen gebeurt in het domein
   dat er al over gaat: de foodcourt bevestigt zijn tafels, de Mall zijn
   artikelen, het reisbureau zijn reizen. Die deuren staan verspreid over tientallen
   schermen. Dezelfde balk daar tientallen keren neerzetten, is dezelfde tekst
   tientallen keren onderhouden -- en dan zegt hij binnen een jaar op twee plekken
   iets anders over wat RTG wel en niet heeft gedaan (LAT-regel 4).

   Hij laadt ALLEEN als er `?overdracht=` in het adres staat. shared/basis.js
   haalt hem dan pas op (punt 9 daar), zoals hij shared/kaart.js en
   shared/uurwerk.js ook bijlaadt. Op elk ander scherm kost dit niets.

   WAT ER IN DE BALK STAAT, KOMT VAN DE SERVER. Ook de twee zinnen over wat RTG
   hier niet doet: die staan in kern/commerce/overdracht.js en worden hier alleen
   getoond. Een scherm dat ze zelf verzint, verzint ze een keer anders.

   EN HIJ BEVESTIGT NIETS. Er staat geen knop "bestellen" in deze balk. Dit is
   een briefje dat vertelt wat je had gekozen; het domein waar hij op ligt, doet
   de bevestiging zoals het die altijd al deed. */
(function (root) {
  'use strict';
  const dsBijStart = typeof document !== 'undefined' && document?.documentElement?.hasAttribute('data-ds');
  if (!root || !root.document) return;
  if (root.__rtgOverdracht) return; root.__rtgOverdracht = true;
  var doc = root.document;

  function idUitAdres() {
    try {
      var v = new URLSearchParams(root.location.search).get('overdracht');
      return v && /^[A-Za-z0-9_-]{4,60}$/.test(v) ? v : null;
    } catch (e) { return null; }
  }
  var ID = idUitAdres();
  if (!ID) return;

  function actueel() {
    try { return localStorage.getItem('rtg_member_token') === TOKEN; } catch (e) { return false; }
  }
  var TOKEN = null;
  try { TOKEN = localStorage.getItem('rtg_member_token'); } catch (e) {}
  if (!TOKEN) return;                 // zonder inlog is er geen mand en dus geen briefje

  var euro = function (c) {
    return '€ ' + (Number(c || 0) / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  var klok = function (ms) {
    try { return new Date(ms).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  };

  function laadOverdrachtPresentatie(pad) {
    if (document.documentElement.hasAttribute('data-ds')) return;
    if (document.getElementById('rtgDsRuntimeCss')) return;
    var overdrachtStijlLink = document.createElement('link');
    overdrachtStijlLink.setAttribute('id', 'rtgDsRuntimeCss');
    overdrachtStijlLink.rel = 'stylesheet';
    overdrachtStijlLink.href = pad;
    document.head.appendChild(overdrachtStijlLink);
  }

  function stijl() { laadOverdrachtPresentatie('/ds/rtg-ds.css'); }

  var el = function (tag, klas, tekst) {
    var n = doc.createElement(tag);
    if (klas) n.className = klas + ' ' + klas.replace(/^ovd/, 'ds-overdracht');
    if (tekst != null) n.textContent = tekst;      // nooit innerHTML: de titels komen uit een domein
    return n;
  };

  function toon(o) {
    stijl();
    var balk = el('aside', 'ovd');
    balk.setAttribute('aria-label', 'Uit je mand meegenomen');
    var in_ = el('div', 'ovd-in');

    var kop = el('div', 'ovd-kop');
    kop.appendChild(el('span', null, 'Uit je mand · ' + o.verkoper.naam));
    var x = el('button', 'ovd-x', 'Sluiten');
    x.type = 'button';
    x.addEventListener('click', function () {
      if (balk.parentNode) balk.parentNode.removeChild(balk);
    });
    kop.appendChild(x);
    in_.appendChild(kop);

    var ul = el('ul', 'ovd-lijst');
    (o.regels || []).forEach(function (r) {
      var li = el('li');
      var links = el('span');
      links.appendChild(el('span', 'ovd-aantal', r.aantal + '× '));
      links.appendChild(doc.createTextNode(r.titel || 'Naamloos'));
      li.appendChild(links);
      li.appendChild(el('span', 'ovd-bedrag', r.gratis ? 'zonder bedrag' : euro(r.totaalCenten)));
      ul.appendChild(li);
    });
    in_.appendChild(ul);

    var som = el('div', 'ovd-som');
    som.appendChild(el('b', null, euro(o.brutoCenten)));
    if (o.btw) som.appendChild(el('span', 'ovd-aantal', 'waarvan ' + euro(o.btw.btwCenten) + ' btw (' + o.btw.tariefProcent + '%)'));
    else if (o.btwOnbekend) som.appendChild(el('span', 'ovd-aantal', o.btwOnbekend));
    in_.appendChild(som);

    var meta = el('p', 'ovd-meta', 'Doorgegeven om ' + klok(o.at) + '. ' + o.bedragVan);
    in_.appendChild(meta);

    /* De zin die deze balk draagt. Hij komt uit de server en niet uit dit
       bestand -- zie de kop. */
    var uit = el('p', 'ovd-uitleg');
    uit.appendChild(doc.createTextNode(o.rtgBevestigtNiet + ' '));
    var terug = el('a', 'ovd-terug', 'Terug naar je mand');
    terug.href = '/apps/commerce.html';
    uit.appendChild(terug);
    in_.appendChild(uit);

    balk.appendChild(in_);
    /* Boven de inhoud en niet erin: een balk in een <main> die een scherm zelf
       leegmaakt bij het laden, is een balk die soms verdwijnt. */
    var doel = doc.body;
    if (doel) doel.insertBefore(balk, doel.firstChild);
  }

  function haal() {
    if (!actueel()) return;
    fetch('/api/commerce/overdracht/lees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
      body: JSON.stringify({ id: ID })
    }).then(function (r) { if (!r.ok) throw new Error('Overdracht niet beschikbaar'); return r.json(); }).then(function (d) {
      /* STIL BIJ EEN FOUT. Een verlopen of vreemd briefje is geen storing van
         dit scherm: het domein eronder werkt gewoon. Een foutmelding bovenaan
         een boekingsscherm zou een probleem suggereren dat er niet is. */
      if (actueel() && d && d.ok === true && !d.error && d.overdracht && (d.overdracht.regels || []).length) toon(d.overdracht);
    }).catch(function () {});
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', haal);
  else haal();
})(typeof window !== 'undefined' ? window : null);
