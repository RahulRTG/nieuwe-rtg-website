/* RTG Command, deel 9: de gegevenskwaliteit en de kennisgraaf.

   TWEE SCHERMEN DIE OP DEZELFDE METING DRAAIEN. De kwaliteitslaag meet welk
   veld in de praktijk naar welke soort verwijst; daar komen de wezen uit (een
   verwijzing zonder doel) en daar komen de randen van de graaf uit. Dat is één
   meting, twee vragen -- en dus geen twee schema's die elkaar kunnen
   tegenspreken.

   ZEKER EN VERMOED STAAN APART, en dat is hier zichtbaar. Een dubbele sleutel
   is een feit; een waarde die één keer voorkomt terwijl de rest tientallen
   keren hetzelfde zegt, is een vermoeden. Ze in één lijst zetten zou het hele
   scherm de betrouwbaarheid van het zwakste onderdeel geven. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api, S = C.S;

  C.TEKENAARS.kwaliteit = function (el) {
    el.innerHTML = '<h2 class="ckop">Gegevenskwaliteit</h2>' +
      '<p class="lead">Niet wat er verkeerd staat, maar wat er kapot is: twee rijen met dezelfde sleutel, ' +
      'een rij zonder sleutel, een verwijzing naar iets dat niet bestaat. Dat valt zelden op -- tot iemand ' +
      'op de verkeerde rij klikt.</p><div id="kwuit"><div class="leeg">Meten…</div></div>';
    api('kwaliteit').then(function (d) {
      var u = '<div class="rooster">' +
        tegel('Defecten', d.tel.defecten, d.tel.defecten ? 'acc' : 'groen', 'zeker, over ' + d.tel.soorten + ' bevinding(en)') +
        tegel('Vermoedens', d.tel.vermoedens, d.tel.vermoedens ? 'gold' : '', 'mogelijk een typefout of een oude naam') +
        tegel('Objecten', d.gemeten.objecten, '', 'in ' + d.gemeten.soorten + ' soorten nagekeken') +
        '</div>';

      u += '<div class="kaart"><h3>Wat er zeker kapot is</h3>';
      if (!d.bevindingen.length) u += '<p>Niets. Elke sleutel is uniek en elke verwijzing komt ergens aan.</p>';
      for (var i = 0; i < d.bevindingen.length; i++) {
        var b = d.bevindingen[i];
        u += '<div class="lijn"><b>' + esc(b.label) + ' · ' + esc(b.wat) + '</b> <span class="meta">' + b.aantal + '×</span>' +
          '<div class="meta">' + esc(b.uitleg) + '</div>' +
          (b.voorbeelden && b.voorbeelden.length ? '<div class="meta">' + esc(b.voorbeelden.join(' · ')) + '</div>' : '') +
          '</div>';
      }
      u += '<p class="meta h-mt60">' + esc(d.gemeten.drempel) + '.' +
        (d.gemeten.onvolledig ? ' Let op: minstens één collectie is groter dan de scangrens, dus dit beeld is niet volledig.' : '') +
        '</p></div>';

      if (d.vermoedens.length) {
        u += '<div class="kaart"><h3>Vermoedens</h3><p>Dit zijn geen defecten. Ze staan apart omdat een meter ' +
          'die vermoedens als feiten telt, terecht wordt genegeerd.</p>';
        for (var v = 0; v < d.vermoedens.length; v++) {
          u += '<div class="lijn"><b>' + esc(d.vermoedens[v].label) + '</b> <span class="meta">' +
            esc(d.vermoedens[v].veld) + ' = ' + esc(d.vermoedens[v].waarde) + '</span>' +
            '<div class="meta">' + esc(d.vermoedens[v].uitleg) + '</div></div>';
        }
        u += '</div>';
      }
      document.querySelector('#kwuit').innerHTML = u;
    }).catch(function (e) {
      if (!e.stil) document.querySelector('#kwuit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
    });
  };

  function tegel(l, v, k, u) {
    return '<div class="tegel"><div class="l">' + esc(l) + '</div><div class="v ' + (k || '') + '">' + esc(v) + '</div>' +
      (u ? '<div class="u">' + esc(u) + '</div>' : '') + '</div>';
  }

  C.TEKENAARS.graaf = function (el) {
    el.innerHTML = '<h2 class="ckop">Kennisgraaf</h2>' +
      '<p class="lead">Hoe het geheel samenhangt, en wat er twee stappen verderop ligt. De randen zijn ' +
      'gemeten uit de gegevens en niet uit een schema: een veld heet pas een verwijzing als het in de praktijk ' +
      'vrijwel altijd een bestaande sleutel van een andere soort bevat.</p>' +
      '<div id="grUit"><div class="leeg">Meten…</div></div>';
    api('graaf').then(function (d) {
      var u = '<div class="kaart"><h3>De randen</h3>';
      if (!d.randen.length) u += '<p>Geen enkel veld verwijst meetbaar naar een andere soort.</p>';
      for (var i = 0; i < d.randen.length; i++) {
        var r = d.randen[i];
        u += '<div class="lijn"><b>' + esc(r.van) + '</b> <span class="meta">- ' + esc(r.veld) + ' →</span> <b>' +
          esc(r.naar) + '</b> <span class="meta">(' + Math.round(r.deel * 100) + '% raak)</span></div>';
      }
      u += '</div>';

      u += '<div class="kaart"><h3>De knopen</h3><div class="schuif"><table class="ctab"><thead><tr>' +
        '<th>Soort</th><th>Domein</th><th>Objecten</th></tr></thead><tbody>' +
        d.knopen.map(function (k) {
          return '<tr><td>' + esc(k.label) + '</td><td class="meta">' + esc(k.domein) + '</td><td>' + k.aantal + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        (d.losse.length ? '<p class="meta h-mt60">Los in de graaf (niets verwijst ernaar en ze verwijzen nergens heen): ' +
          esc(d.losse.join(', ')) + '. Dat is een uitslag, geen fout -- maar het is wel waar een koppeling zou kunnen ontbreken.</p>' : '') +
        '</div>';

      u += '<div class="kaart"><h3>Wandel vanaf een object</h3>' +
        '<div class="crij"><input class="veld" id="grT" placeholder="soort (bv. zaak)" style="width:9rem;">' +
        '<input class="veld" id="grI" placeholder="id" style="width:9rem;">' +
        '<input class="veld" id="grD" value="2" style="width:4rem;" aria-label="diepte">' +
        '<button class="knop vol" id="grGa">Wandel</button></div><div id="grPad"></div></div>';
      document.querySelector('#grUit').innerHTML = u;

      document.querySelector('#grGa').onclick = function () {
        api('graaf/wandel', { type: document.querySelector('#grT').value,
          id: document.querySelector('#grI').value, diepte: Number(document.querySelector('#grD').value || 2) })
          .then(function (w) {
            document.querySelector('#grPad').innerHTML =
              '<p class="meta h-mt70">Vanaf <b>' + esc(w.start.titel) + '</b>: ' +
              w.knopen + ' knopen tot diepte ' + w.diepte + (w.grens ? ' -- ' + esc(w.grens) : '') + '</p>' +
              w.lagen.map(function (l) {
                return '<div class="lijn"><b>stap ' + l.stap + '</b> <span class="meta">' + l.aantal + '</span>' +
                  '<div class="meta">' + esc(l.objecten.map(function (o) {
                    return o.type + ' ' + o.id + (o.via ? ' (via ' + o.via + ')' : '');
                  }).join(' · ')) + '</div></div>';
              }).join('');
          })
          .catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    }).catch(function (e) {
      if (!e.stil) document.querySelector('#grUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
    });
  };

  /* De twee werkplekken bij "Zien" hangen, want dat is wat ze zijn: kijken naar
     wat er is, niet eraan draaien. Ze staan achter de zoekbalk omdat je daar
     doorgaans op uitkomt vanuit een object. */
  var i = C.WERKPLEKKEN.findIndex(function (w) { return w.id === 'zoek'; });
  C.WERKPLEKKEN.splice(i + 1, 0,
    { id: 'kwaliteit', naam: 'Kwaliteit', sec: 'Zien',
      teller: function (s) { return s.start && s.start.kwaliteit ? s.start.kwaliteit.defecten : 0; } },
    { id: 'graaf', naam: 'Kennisgraaf', sec: 'Zien' });
  void S;
})();
