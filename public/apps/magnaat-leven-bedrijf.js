/* Magnaat V2: Mijn bedrijf (team, contracten, handel, kosten, resultaat en
   balans) en de cashflowprognose op Geld. De gegevens komen van
   ./magnaat-leven.js; hier wordt niets gevraagd en niets gerekend.

   De prognose zegt er met opzet bij wat ze NIET meetelt: een verwachting die
   nieuwe omzet of een klant die te laat betaalt stilzwijgend meeneemt, belooft
   geld dat er niet is. */
(function () {
  'use strict';
  var STAND = { aanbod: 'aangeboden', actief: 'loopt', afgelopen: 'afgelopen', opgezegd: 'opgezegd', afgewezen: 'afgewezen', verlopen: 'verlopen' };

  var pct = function (p) { return String(p / 10).replace('.', ',') + '%'; };

  function teken(s, h) {
    var q = h.q, esc = h.esc, euro = h.euro, duur = h.duur;
    var regels = function (rijen) {
      return rijen.map(function (r) { return '<div class="vn-regel"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b></div>'; }).join('');
    };

    var p = s.geld.prognose, plek = q('#vnPrognose');
    if (plek && p) {
      plek.innerHTML = '<h3>De komende vier weken</h3>' + regels(p.weken.map(function (w) {
        return ['Week ' + w.week + ' · dag ' + w.van + ' tot ' + w.tot, '+' + euro(w.in) + ' · -' + euro(w.uit) + ' · ' + (w.eind < 0 ? 'tekort ' + euro(-w.eind) : 'daarna ' + euro(w.eind))];
      })) + '<p class="vn-rust">Hier staat alleen wat vaststaat. Niet meegeteld: ' + esc(p.nietMee.join('; ')) + '.</p>';
    }

    var mk = s.wereld.markt, mplek = q('#vnMarkt');
    if (mplek && mk) {
      mplek.innerHTML = '<h3>De markt</h3>' + (mk.concurrenten.length ? regels(mk.concurrenten.map(function (c) {
        return [c.naam + ' · ' + c.wijk, euro(c.tarief) + ' per uur' + (c.prijs != null ? ' · verkoopt voor ' + euro(c.prijs) : '') +
          ' · reputatie ' + c.kwaliteit + (c.aandeel != null ? ' · aandeel ' + pct(c.aandeel) : '')];
      })) + (mk.jouwAandeel != null ? regels([['Jij', 'reputatie ' + mk.kwaliteit + ' · aandeel ' + pct(mk.jouwAandeel)]]) : '') +
        '<p class="vn-rust">' + esc(mk.uitleg) + '</p>' : '<p class="vn-rust">Kies wat je maakt; dan zie je wie dat hier ook doet.</p>') +
        '<h3>Waar je kunt zitten</h3>' + regels(mk.wijken.map(function (w) {
          return [w.naam + (w.jij ? ' (jij)' : ''), (w.huur ? euro(w.huur) + ' per vier weken' : 'geen huur') + ' · zichtbaarheid ' + w.zichtbaar];
        })) + '<p class="vn-rust">Kopers: ' + esc(mk.kopers.map(function (k) { return k.aandeel + '% ' + k.naam; }).join(', ')) + '.</p>';
    }

    var z = s.bedrijf;
    q('#vnNavBedrijf').hidden = !z;
    if (!z) { q('#vnBedrijf').innerHTML = ''; return; }
    var team = z.team.filter(function (m) { return !m.weg; }), hw = z.handel;
    q('#vnBedrijf').innerHTML = '<h3>' + esc(z.naam) + '</h3><p>Ingeschreven op dag ' + z.sinds + (z.zelfstandig ? ', en sinds dag ' + z.zelfstandig + ' leef je ervan' : '') + '.</p>' +
      '<h3>Resultaat</h3>' + regels([['Omzet', euro(z.omzet)], ['Kosten', '-' + euro(z.kosten)], ['Resultaat', euro(z.resultaat)]]) +
      (z.kosten ? '<h3>Kosten per soort</h3>' + regels(z.kosten.map(function (k) { return [k.naam, euro(k.bedrag)]; })) : '') +
      '<h3>Je team</h3>' + (team.length ? regels(team.map(function (m) {
        return [m.naam + ' · ' + m.rol, (m.contract === 'dienst' ? 'in dienst, ' : 'freelancer, ') + euro(m.uurloon) + ' per uur · ' + esc(m.dagen.join(', ')) +
          (m.tempo < 100 ? ' · werkt op ' + m.tempo + '% van jouw tempo' : '') + (m.gestaakt ? ' · werkt niet: loon niet betaald' : '') +
          (m.einde != null ? ' · laatste dag ' + m.einde : '')];
      })) : '<p class="vn-rust">Je doet alles zelf. Neem iemand aan als je meer werk hebt dan uren.</p>') +
      '<h3>Contracten</h3>' + (z.contracten.length ? regels(z.contracten.map(function (c) {
        return [c.klant, duur(c.minuten) + ' per vier weken voor ' + euro(c.bedrag) + ' · ' + esc(STAND[c.stand] || c.stand) +
          (c.stand === 'actief' ? ', termijn ' + c.termijn + ' van ' + c.termijnen + (c.opgezegd ? ', opgezegd' : '') : '')];
      })) : '<p class="vn-rust">Nog geen vaste klanten. Een klant die tevreden is, vraagt er misschien om.</p>') +
      (hw ? '<h3>Handel: ' + esc(hw.product) + '</h3>' + regels([
        ['Leverancier', esc(hw.leverancier) + ' · ' + euro(hw.inkoop) + ' per stuk, minimaal ' + hw.minimum + (hw.geblokkeerd ? ' · levert niet: factuur open' : '')],
        ['Je prijs', euro(hw.prijs) + ' · klanten betalen er gewoonlijk ' + euro(hw.advies) + ' voor'],
        ['Op voorraad', hw.voorraad + ' stuks' + (hw.onderweg ? ', ' + hw.onderweg + ' onderweg' : '')],
        ['Verkocht', hw.verkocht + ' stuks, marge ' + euro(hw.marge) + (hw.gemist ? ' · ' + hw.gemist + ' gemist' : '')],
        ['Vraag', 'ongeveer ' + String(hw.perWeek).replace('.', ',') + ' per week bij deze prijs, in dit seizoen' + (hw.aandeel != null ? ' · ' + pct(hw.aandeel) + ' van de markt' : '')]]) : '') +
      '<h3>Balans</h3>' + regels([['Bank', euro(z.balans.kas)], ['Te ontvangen', euro(z.balans.vorderingen)], ['Voorraad', euro(z.balans.voorraad)],
        ['Voorschotten (nog leveren)', euro(z.balans.vooruit)], ['Aan leveranciers', euro(z.balans.crediteuren)], ['Schuld', euro(z.balans.schuld)]]);
  }

  window.RTGMagnaatLevenBedrijf = { teken: teken };
}());
