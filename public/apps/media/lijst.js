/* RTG Media -- afspeellijsten, en een stuk delen in een gesprek.

   Twee dingen die dieper gaan dan de wereldkaart en allebei om dezelfde reden
   in een eigen bestand staan: ze horen bij elkaar (u kiest een stuk en doet er
   iets mee) en blad.js blijft er onder de omvangregel mee.

   WAT EEN LIJST HIER IS: een ordening van id's, geen bezit. Een stuk dat de
   maker weghaalt staat als verdwenen in de lijst en niet als een kaart die
   niemand kan spelen -- de server geeft dat zo terug (kern/mediaos/lijsten.js)
   en dit scherm toont het zoals het is.

   EN WAT DELEN HIER IS: er gaat een ID naar het gesprek, geen kopie. De
   ontvanger opent het met zijn eigen sessie, dus zijn eigen deuren gelden. Dat
   staat er ook bij, want anders lijkt "delen" een belofte dat de ander het
   zeker kan zien -- en dat is het niet. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var M = window.RTGMediaOS;
  var B = window.RTGMediaBlad;

  function open(bouw) { B.vlak(bouw); }
  function rijVan(titel, stukken, vlak) {
    if (!stukken || !stukken.length) return;
    vlak.appendChild(M.el('h2', null, titel));
    var doos = M.el('div', 'stukken');
    stukken.forEach(function (s) { doos.appendChild(M.kaart(s)); });
    vlak.appendChild(doos);
  }

  /* ---- alle lijsten ---- */
  function lijsten() {
    M.api('lijsten', {}).then(function (d) {
      if (d.error) return M.zeg(d.error);
      open(function (vlak) {
        vlak.appendChild(M.el('h3', null, 'Uw lijsten'));
        vlak.appendChild(M.el('p', 'stil', 'Een lijst mag alle vier de vormen door elkaar dragen: muziek, ' +
          'video, korte video en live. Hij is van u alleen -- lijsten delen bestaat hier niet.'));
        if (!d.lijsten.length) vlak.appendChild(M.el('p', 'stil', 'U heeft nog geen lijst.'));
        d.lijsten.forEach(function (l) {
          var k = M.el('div', 'kader');
          k.appendChild(M.el('b', null, l.naam));
          k.appendChild(M.el('p', 'stil', l.aantal + ' stukken · bijgewerkt ' + String(l.bijgewerkt).slice(0, 10)));
          var rij = M.el('div', 'rij');
          rij.appendChild(M.knop('Open', 'vol', function () { lijst(l.id); }));
          rij.appendChild(M.knop('Weg', '', function () {
            M.api('lijst/zet', { id: l.id, weg: true }).then(function (r) {
              if (r.error) return M.zeg(r.error);
              M.zeg('Lijst weg. Uw werk staat er nog: een lijst is een ordening, geen bezit.');
              lijsten();
            });
          }));
          k.appendChild(rij);
          vlak.appendChild(k);
        });
        var nieuw = M.el('div', 'kader');
        var veld = document.createElement('input');
        veld.id = 'lijstNaam'; veld.maxLength = 60; veld.placeholder = 'Naam van de nieuwe lijst';
        nieuw.appendChild(veld);
        nieuw.appendChild(M.knop('Maak lijst', 'vol', function () {
          M.api('lijst/maak', { naam: veld.value }).then(function (r) {
            if (r.error) return M.zeg(r.error);
            lijsten();
          });
        }));
        vlak.appendChild(nieuw);
      });
    });
  }

  /* ---- één lijst ---- */
  function lijst(id) {
    M.api('lijst', { id: id }).then(function (d) {
      if (d.error) return M.zeg(d.error);
      open(function (vlak) {
        vlak.appendChild(M.el('h3', null, d.lijst.naam));
        vlak.appendChild(M.el('p', 'stil', d.uitleg));
        rijVan('In deze lijst', d.stukken, vlak);
        /* De volgorde is van u: elk stuk kan een plek omhoog. Geen slepen, want
           dat werkt op een telefoon zelden en hier hoeft het niet mooi te zijn,
           het moet kloppen. */
        d.stukken.forEach(function (s, i) {
          if (i === 0) return;
          var r = M.el('div', 'rij');
          r.appendChild(M.el('span', 'stil', s.titel));
          r.appendChild(M.knop('Omhoog', '', function () {
            M.api('lijst/stuk', { id: id, stukId: s.id, naar: i - 1 }).then(function (x) {
              if (x.error) return M.zeg(x.error);
              lijst(id);
            });
          }));
          vlak.appendChild(r);
        });
        if (d.verdwenen.length) {
          vlak.appendChild(M.el('h2', null, 'Niet meer beschikbaar'));
          d.verdwenen.forEach(function (v) {
            var r = M.el('div', 'rij');
            r.appendChild(M.el('span', 'stil', v.id + ' -- erin gezet op ' + String(v.erinOp).slice(0, 10)));
            r.appendChild(M.knop('Haal eruit', '', function () {
              M.api('lijst/stuk', { id: id, stukId: v.id, aan: false }).then(function () { lijst(id); });
            }));
            vlak.appendChild(r);
          });
        }
      });
    });
  }

  /* ---- een stuk in een lijst zetten, en een stuk delen ---- */
  function inLijst(stukId) {
    M.api('lijsten', {}).then(function (d) {
      if (d.error) return M.zeg(d.error);
      if (!d.lijsten.length) return M.zeg('U heeft nog geen lijst. Maak er eerst een onder "Lijsten".');
      open(function (vlak) {
        vlak.appendChild(M.el('h3', null, 'In welke lijst?'));
        d.lijsten.forEach(function (l) {
          vlak.appendChild(M.knop(l.naam + ' (' + l.aantal + ')', '', function () {
            M.api('lijst/stuk', { id: l.id, stukId: stukId }).then(function (r) {
              M.zeg(r.error || 'In "' + l.naam + '" gezet.');
            });
          }));
        });
      });
    });
  }

  /* Delen loopt langs de gewone gesprekken (/api/member/*) en niet langs de
     Media OS: er is maar één berichtenweg in dit huis en die blijft het. */
  function deel(stukId) {
    fetch('/api/member/connections', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + M.token() },
      body: '{}' }).then(function (r) { return r.json(); }).then(function (d) {
      var rijen = (d && d.connections) || [];
      open(function (vlak) {
        vlak.appendChild(M.el('h3', null, 'Naar wie?'));
        vlak.appendChild(M.el('p', 'stil', 'Er gaat een verwijzing mee, geen kopie: de ander opent het stuk ' +
          'met zijn eigen toegang. Wat achter een deur staat die voor hem dicht is, ziet hij dus niet.'));
        if (!rijen.length) vlak.appendChild(M.el('p', 'stil', 'U bent nog met niemand verbonden.'));
        rijen.forEach(function (c) {
          vlak.appendChild(M.knop(c.codename, '', function () {
            fetch('/api/member/dm/send', { method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + M.token() },
              body: JSON.stringify({ toKey: c.key, stukId: stukId }) })
              .then(function (r) { return r.json(); })
              .then(function (r) { M.zeg(r.error || 'Gestuurd naar ' + c.codename + '.'); });
          }));
        });
      });
    });
  }

  var lk = $('#lijstKnop');
  if (lk) lk.addEventListener('click', lijsten);
  window.RTGMediaLijst = { lijsten: lijsten, lijst: lijst, inLijst: inLijst, deel: deel };
})();
