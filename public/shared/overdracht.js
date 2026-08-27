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

  var TOKEN = null;
  try { TOKEN = localStorage.getItem('rtg_member_token'); } catch (e) {}
  if (!TOKEN) return;                 // zonder inlog is er geen mand en dus geen briefje

  var euro = function (c) {
    return '€ ' + (Number(c || 0) / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  var klok = function (ms) {
    try { return new Date(ms).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  };

  function stijl() {
    if (doc.getElementById('rtg-ovd-stijl')) return;
    var css =
      '.ovd{position:relative;z-index:40;margin:0;padding:.85rem 1rem;background:#141211;' +
        'border-bottom:1px solid var(--gold,#857007);color:#f2f0ec;' +
        'font-family:Inter,system-ui,sans-serif;line-height:1.5;}' +
      '.ovd-in{max-width:960px;margin:0 auto;display:flex;flex-wrap:wrap;gap:.5rem 1.2rem;align-items:flex-start;}' +
      '.ovd-kop{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--gold,#C9A24B);' +
        'width:100%;display:flex;justify-content:space-between;gap:1rem;align-items:center;}' +
      '.ovd-x{background:transparent;border:1px solid #3a3733;border-radius:8px;color:#e8e6e2;' +
        'padding:.15rem .55rem;cursor:pointer;font:inherit;letter-spacing:0;text-transform:none;}' +
      '.ovd-x:hover{border-color:var(--gold,#857007);}' +
      '.ovd-x:focus-visible{outline:2px solid #fff;outline-offset:2px;}' +
      '.ovd-lijst{flex:1 1 22rem;margin:0;padding:0;list-style:none;font-size:.92rem;}' +
      '.ovd-lijst li{display:flex;justify-content:space-between;gap:1rem;padding:.12rem 0;}' +
      '.ovd-aantal{color:#bdb9b2;font-variant-numeric:tabular-nums;}' +
      '.ovd-bedrag{font-variant-numeric:tabular-nums;white-space:nowrap;}' +
      '.ovd-som{flex:0 0 auto;min-width:11rem;text-align:right;}' +
      '.ovd-som b{display:block;font-size:1.15rem;font-weight:600;}' +
      '.ovd-meta,.ovd-uitleg{font-size:.78rem;color:#b3afa8;width:100%;margin:.15rem 0 0;}' +
      '.ovd-uitleg{border-top:1px solid #2a2724;padding-top:.5rem;margin-top:.4rem;}' +
      '.ovd-terug{color:var(--gold,#C9A24B);text-decoration:underline;text-underline-offset:2px;}' +
      '@media (prefers-reduced-motion:no-preference){.ovd{animation:ovd-in .35s ease-out;}' +
        '@keyframes ovd-in{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:none;}}}';
    var st = doc.createElement('style'); st.id = 'rtg-ovd-stijl'; st.textContent = css;
    (doc.head || doc.documentElement).appendChild(st);
  }

  var el = function (tag, klas, tekst) {
    var n = doc.createElement(tag);
    if (klas) n.className = klas;
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
    fetch('/api/commerce/overdracht/lees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
      body: JSON.stringify({ id: ID })
    }).then(function (r) { return r.json(); }).then(function (d) {
      /* STIL BIJ EEN FOUT. Een verlopen of vreemd briefje is geen storing van
         dit scherm: het domein eronder werkt gewoon. Een foutmelding bovenaan
         een boekingsscherm zou een probleem suggereren dat er niet is. */
      if (d && d.ok && d.overdracht && (d.overdracht.regels || []).length) toon(d.overdracht);
    }).catch(function () {});
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', haal);
  else haal();
})(typeof window !== 'undefined' ? window : null);
