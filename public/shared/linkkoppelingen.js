/* RTG Link: MIJN KOPPELINGEN -- het scherm bij LINK.md par. 4, stap 6.

   Drie lijsten, en ze beantwoorden drie verschillende vragen:

     NU OPEN        codes van mij die nog leven -- die kan ik weghalen
     WAT ER GEBEURDE de bonnen, en die blijven staan (par. 3.6)
     PARTIJEN        met wie, hoe vaak, wanneer, langs welke weg

   HET SCHERM BESLIST NIETS. Of een regel een knop terug krijgt, rekent de server
   uit (kern/link/koppelingen.js) -- dat is een besluit en geen opmaak. Hier staat
   alleen wat er dan te zien is. Zou dit bestand zelf gaan bepalen welke knop mag,
   dan toont het vroeg of laat een knop die weigert, of verzwijgt het er een die
   had gekund.

   HIJ HAALT NIET OP EN VOERT NIET UIT. De app geeft `haal()` (een antwoord) en
   `doe(weg, lijf)` mee; elke app heeft zijn eigen weg naar de server. Zelfde
   afspraak als shared/linkkaart.js, en om dezelfde reden.

   `opbouw()` is puur, zodat een toets in Node kan nakijken dat een regel zonder
   knop zijn reden toont en dat een bon nooit verdwijnt. */
(function (root) {
  'use strict';
  var doc = root.document;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function wanneer(iso) {
    var t = Date.parse(iso);
    if (!t) return '';
    var d = new Date(t), nu = new Date();
    var zelfdeDag = d.toDateString() === nu.toDateString();
    try {
      return zelfdeDag ? d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
    } catch (e) { return iso.slice(0, 10); }
  }

  /* Wat een bon in mensentaal is. `.gebruikt` betekent: iemand heeft MIJN code
     gebruikt -- dat is de andere kant van dezelfde handeling, en het scherm hoort
     die twee niet door elkaar te halen. Een onbekende handeling valt terug op
     zijn eigen naam: liever een regel die technisch leest dan een regel die
     verdwijnt. */
  var WOORD = {
    'contact.verbinden': 'Verzoek verstuurd',
    'geld.ontvangen': 'Betaald',
    'geld.ontvangen.gebruikt': 'Ontvangen',
    'geld.kassa': 'Geind aan de kassa',
    'geld.kassa.gebruikt': 'Betaald aan de kassa'
  };

  function opbouw(antwoord) {
    antwoord = antwoord || {};
    var open = (antwoord.open || []).map(function (o) {
      var k = o.kaart || {};
      return { id: o.id, wat: k.wat || o.handeling,
        detail: (k.velden && k.velden[0] ? k.velden[0].naam + ' ' + k.velden[0].waarde : (k.waarom || '')),
        tot: wanneer(o.tot) };
    });
    var bonnen = (antwoord.bonnen || []).map(function (b) {
      return { wat: WOORD[b.intentie] || b.intentie, wie: b.naarNaam || null,
        wanneer: wanneer(b.at), terug: b.terug || null, reden: b.reden || null,
        vorm: b.vorm || null };
    });
    var partijen = (antwoord.partijen || []).map(function (p) {
      return { naam: p.naam, aantal: p.aantal, laatst: wanneer(p.laatst),
        via: (p.via || []).map(function (v) { return v === 'levend' ? 'levende code' : 'pin'; }).join(', ') };
    });
    return { open: open, bonnen: bonnen, partijen: partijen, nietBewaard: antwoord.nietBewaard || 0 };
  }

  function kop(t) { return '<div class="rtg-koppel-kop">' + esc(t) + '</div>'; }
  function leeg(t) { return '<div class="rtg-koppel-leeg">' + esc(t) + '</div>'; }

  function markeer(inhoud) {
    var h = '';
    h += kop('Nu open');
    h += inhoud.open.length ? '<div class="rtg-register">' + inhoud.open.map(function (o, i) {
      return '<div class="rij rtg-rail" data-sig="aandacht">' +
        '<span><b>' + esc(o.wat) + '</b>' + (o.detail ? ' <span class="rtg-koppel-sub">' + esc(o.detail) + '</span>' : '') + '</span>' +
        '<span class="rek wanneer">tot ' + esc(o.tot) + '</span>' +
        '<button type="button" class="rtg-koppel-knop" data-trek="' + esc(o.id) + '">Intrekken</button>' +
        '</div>';
    }).join('') + '</div>' : leeg('Er staat op dit moment geen code van je open.');

    h += kop('Wat er gebeurde');
    h += inhoud.bonnen.length ? '<div class="rtg-register">' + inhoud.bonnen.map(function (b, i) {
      return '<div class="rij">' +
        '<span><b>' + esc(b.wat) + '</b>' + (b.wie ? ' <span class="rtg-koppel-sub">' + esc(b.wie) + '</span>' : '') +
          (b.terug ? '' : '<div class="rtg-koppel-reden">' + esc(b.reden || '') + '</div>') + '</span>' +
        '<span class="rek wanneer">' + esc(b.wanneer) + '</span>' +
        (b.terug ? '<button type="button" class="rtg-koppel-knop" data-bon="' + i + '">' + esc(b.terug.tekst) + '</button>' : '') +
        '</div>';
    }).join('') + '</div>' : leeg('Je hebt nog niets met een code gedaan.');
    if (inhoud.nietBewaard) h += leeg(inhoud.nietBewaard + ' oudere regels zijn niet bewaard.');

    if (inhoud.partijen.length) {
      h += kop('Met wie');
      h += '<div class="rtg-register">' + inhoud.partijen.map(function (p) {
        return '<div class="rij"><span><b>' + esc(p.naam) + '</b>' +
          '<div class="rtg-koppel-reden">' + p.aantal + ' keer · via ' + esc(p.via || 'pin') + '</div></span>' +
          '<span class="rek wanneer">' + esc(p.laatst) + '</span></div>';
      }).join('') + '</div>';
    }
    return h;
  }

  /* Het blad. `haal()` levert het antwoord (en opnieuw, na elke handeling);
     `doe(weg, lijf)` voert er een uit. Beide van de app. */
  function toon(haal, opties) {
    opties = opties || {};
    if (!doc) return Promise.resolve(null);
    var laag = doc.createElement('div');
    laag.className = 'rtg-bedoeling rtg-koppel';
    laag.innerHTML = '<div class="blad" role="dialog" aria-modal="true" aria-label="Mijn koppelingen">' +
      '<div class="wat">Mijn koppelingen</div><div class="rtg-koppel-inhoud"></div>' +
      '<div class="knoppen"><button type="button" data-af="1">Sluiten</button></div></div>';
    doc.body.appendChild(laag);
    var doek = laag.querySelector('.rtg-koppel-inhoud');
    var laatste = null;

    function sluit() {
      doc.removeEventListener('keydown', toets);
      if (laag.parentNode) laag.parentNode.removeChild(laag);
    }
    function toets(e) { if (e.key === 'Escape') sluit(); }
    doc.addEventListener('keydown', toets);

    async function verversen() {
      doek.textContent = 'Even kijken...';
      try { laatste = opbouw(await haal()); } catch (e) { doek.textContent = e.message || 'Dat lukte niet.'; return; }
      doek.innerHTML = markeer(laatste);
    }
    laag.addEventListener('click', async function (e) {
      if (e.target === laag) { sluit(); return; }
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b) return;
      if (b.dataset.af) { sluit(); return; }
      if (typeof opties.doe !== 'function') return;
      b.disabled = true;
      try {
        if (b.dataset.trek) await opties.doe('/api/link/cap/trek', { id: b.dataset.trek });
        else if (b.dataset.bon) {
          var t = laatste.bonnen[Number(b.dataset.bon)].terug;
          var lijf = {}; lijf[t.veld] = t.waarde;
          await opties.doe(t.weg, lijf);
        }
        await verversen();
      } catch (err) { b.disabled = false; if (opties.melden) opties.melden(err.message); }
    });
    return verversen().then(function () { return laag; });
  }

  var api = { toon: toon, opbouw: opbouw, markeer: markeer, WOORD: WOORD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RTGKoppelingen = api;
})(typeof self !== 'undefined' ? self : this);
