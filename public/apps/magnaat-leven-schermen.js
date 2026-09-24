/* Magnaat FROM ZERO: Werk, Geld, Netwerk, Wereld en Mijn bedrijf. Vandaag en de
   Edge staan in ./magnaat-leven.js, dat dit bestand de gegevens geeft; hier
   wordt niets gevraagd en niets gerekend.

   Geld zet RESULTAAT en BANK met opzet naast elkaar. Een factuur is omzet en
   een vordering, geen geld: je resultaat kan +€ 620 zijn terwijl er € 93 op je
   rekening staat, en dat verschil is precies wat een ondernemer moet zien. */
(function () {
  'use strict';
  var FASE = { kans: 'wil iets van je', onderhandeling: 'in gesprek', overeenkomst: 'afspraak loopt', geleverd: 'opgeleverd',
    gefactureerd: 'factuur open', betaald: 'betaald', afgehaakt: 'geen deal' };

  function teken(s, h) {
    var q = h.q, esc = h.esc, euro = h.euro, duur = h.duur;
    var regels = function (rijen) {
      return rijen.map(function (r) { return '<div class="vn-regel"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b></div>'; }).join('');
    };

    var w = s.werk, b = w.baan, p = w.project;
    q('#vnWerk').innerHTML = '<div class="eyebrow">Je werk</div><h3>' + esc(b.functie) + ' bij ' + esc(b.werkgever) + (b.actief ? '' : ' (opgezegd)') + '</h3>' +
      regels([['Diensten', b.actief ? b.uren + ' uur per week: ' + esc(b.dienstdagen.join(', ')) : 'geen'],
        ['Loon', b.actief ? euro(b.loonPerWeek) + ' netto, elke ' + esc(b.loondag) : '-'],
        ['Extra dienst', b.actief ? esc(b.extra.dag) + ', ' + duur(b.extra.minuten) + ' voor ' + euro(b.extra.loon) : '-'],
        ['Wat je hebt', esc(w.bezit.join(' en '))]]) +
      '<h3>Je eigen project</h3>' + (p ? regels([['Wat', esc(p.naam)], ['Aan gewerkt', duur(p.portfolio)], ['Geleerd', duur(p.geleerd) + (p.sneller ? ' · je werkt ' + p.sneller + '% sneller' : '')]])
        : '<p class="vn-rust">Nog niets. Kies wat je gaat maken; dan heb je iets om te laten zien.</p>') +
      '<h3>Opdrachten</h3>' + (w.opdrachten.length ? regels(w.opdrachten.map(function (d) {
        return [d.klant, duur(d.gedaan) + ' van ' + duur(d.afspraak.minuten) + ' · af op dag ' + d.afspraak.deadline + (d.fase === 'geleverd' ? ' · opgeleverd' : '')];
      })) : '<p class="vn-rust">Geen lopende opdracht.</p>') +
      (w.kansen.length ? '<h3>Kansen</h3>' + regels(w.kansen.map(function (d) { return [d.klant, FASE[d.fase]]; })) : '');

    var g = s.geld, r = g.resultaat;
    q('#vnGeld').innerHTML = '<div class="vn-drie">' +
      '<div><small>Op je rekening</small><b>' + euro(g.bank) + '</b><span>geld dat je kunt uitgeven</span></div>' +
      '<div><small>Nog te ontvangen</small><b>' + euro(g.teOntvangen) + '</b><span>gefactureerd, nog niet betaald</span></div>' +
      '<div><small>Resultaat van je werk</small><b>' + euro(r.resultaat) + '</b><span>omzet ' + euro(r.omzet) + ' min kosten ' + euro(r.kosten) + '</span></div></div>' +
      '<p class="vn-rust">Een factuur is omzet, geen geld. Je resultaat telt hem meteen; je rekening pas als de klant betaalt.' +
      (g.vooruitOntvangen ? ' Aan voorschotten heb je ' + euro(g.vooruitOntvangen) + ' binnen waar je nog werk voor moet leveren.' : '') +
      (g.schuld ? ' Je familie krijgt nog ' + euro(g.schuld) + '.' : '') + '</p>' +
      '<h3>Wat eraan komt</h3>' + regels(g.komend.map(function (x) {
        return [x.naam + ' · aan ' + (x.leverancier || 'onbekend'), euro(x.bedrag) + ' · ' + (x.achterstand ? 'staat open' : esc(x.dagNaam) + ', dag ' + x.dag) + (x.uitgesteld ? ' · uitgesteld' : '')];
      })) +
      (g.facturen.length ? '<h3>Facturen</h3>' + regels(g.facturen.map(function (f) {
        return [f.nummer + ' · ' + f.klant, euro(f.totaal) + ' · ' + (f.betaaldOp ? 'betaald op dag ' + f.betaaldOp : f.gefinancierd ? 'voorgefinancierd' : 'open, vervalt dag ' + f.vervaldag)];
      })) : '') +
      '<h3>Laatste boekingen</h3>' + regels(g.recent.map(function (x) {
        var l = x.labels || [];
        return [x.datum + ' · ' + x.omschrijving, (l.indexOf('uit') >= 0 ? '-' : '') + euro(x.bedrag) + (l.indexOf('boek') >= 0 ? ' (niet op je rekening)' : '')];
      })) + '<p class="vn-rust">' + (g.klopt ? 'Je saldo is gelijk aan je rekening in het grootboek.' : 'Let op: je saldo wijkt af van het grootboek.') + '</p>';

    q('#vnNetwerk').innerHTML = s.netwerk.contacten.length ? s.netwerk.contacten.map(function (d) {
      return '<div class="vn-contact"><b>' + esc(d.klant) + '</b><small>' + esc(FASE[d.fase]) + (d.vervolg ? ' · vaste klant' : '') + '</small>' +
        (d.rondes.length ? '<ol class="vn-rondes">' + d.rondes.map(function (x) {
          return '<li>' + (x.van === 'jij' ? 'Jij' : esc(d.klant)) + ': ' + euro(x.bedrag) + (x.voorschot ? ' + ' + x.voorschot + '% vooraf' : '') + '</li>';
        }).join('') + '</ol>' : '') +
        (d.afspraak ? '<p>Afspraak: ' + euro(d.afspraak.bedrag) + (d.afspraak.voorschotBedrag ? ', ' + euro(d.afspraak.voorschotBedrag) + ' vooraf' : '') + ', af op dag ' + d.afspraak.deadline + '.</p>' : '') + '</div>';
    }).join('') : '<p class="vn-rust">Nog niemand weet wat je maakt. Werk aan je eigen project: wie het ziet, kan iets voor je hebben.</p>';

    q('#vnWereld').innerHTML = '<div class="eyebrow">Je stad</div><h3>' + esc(s.wereld.stad) + '</h3>' +
      regels(s.wereld.plaatsen.map(function (x) { return [x.naam, esc(x.wat)]; })) +
      '<h3>Wat je hier kunt maken</h3>' + regels(s.wereld.aanbod.map(function (x) { return [x.naam + (x.gekozen ? ' (jij)' : ''), esc(x.software) + ' voor klantwerk']; }));

    var z = s.bedrijf;
    q('#vnNavBedrijf').hidden = !z;
    q('#vnBedrijf').innerHTML = z ? '<h3>' + esc(z.naam) + '</h3><p>Ingeschreven op dag ' + z.sinds + (z.zelfstandig ? ', en sinds dag ' + z.zelfstandig + ' leef je ervan' : '') + '.</p>' +
      '<h3>Resultaat</h3>' + regels([['Omzet', euro(z.omzet)], ['Kosten', '-' + euro(z.kosten)], ['Resultaat', euro(z.resultaat)]]) +
      '<h3>Balans</h3>' + regels([['Bank', euro(z.balans.kas)], ['Te ontvangen', euro(z.balans.vorderingen)], ['Voorschotten (nog leveren)', euro(z.balans.vooruit)], ['Schuld', euro(z.balans.schuld)]]) : '';
  }

  window.RTGMagnaatLevenSchermen = { teken: teken };
}());
