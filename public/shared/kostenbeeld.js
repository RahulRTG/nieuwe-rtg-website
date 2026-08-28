/* WAT UW GEBRUIK VAN RTG KOST -- de rustige bovenkant, gedeeld door twee
   schermen.

   Er zijn TWEE lezers van hetzelfde antwoord: een lid (de stand Kosten in RTG
   Geld) en een zaak (/apps/zaakkosten.html). Ze stellen dezelfde vraag en horen
   hetzelfde te zien; alleen de deur waardoor ze binnenkomen verschilt. Daarom
   staat het tekenwerk hier en niet twee keer -- twee kopieen zeggen op een dag
   iets anders over dezelfde maand, en dan is de vraag welke van de twee klopt
   (LAT.md regel 4). De serverkant doet het al net zo: één eigenBeeld, drie
   routes eromheen (server/routes/kosten-beeld.js).

   WAT DIT SCHERM IS. Een kostenpagina die twintig getallen toont, verplaatst
   het werk naar de lezer: die mag zelf uitzoeken of er iets aan de hand is.
   Hier staat eerst EEN toestand met hooguit EEN bedrag, en pas daaronder waar
   dat vandaan komt. Uitzonderingsgestuurd, ONTWERP.md par. 3: normaal hoort
   geen aandacht te trekken.

   EN ER STAAT NOOIT EEN GETAL WAAR ER GEEN IS. Zonder tarief rekent de server
   niets uit en komt de bewijsgraad op 'onbekend'; dan staat hier geen bedrag
   maar de reden. Dat is de eerste grens uit KOSTEN.md par. 1, en juist op een
   scherm voor de klant is hij het makkelijkst te breken: een nul leest als
   "gratis", en dat is een andere bewering dan "niet bekend".

   De onderbouwing (de regels, de keten, wat dit scherm niet weet) staat in
   /shared/kostenketen.js en hangt zichzelf aan hetzelfde object. */
(function (w, d) {
  'use strict';
  var K = w.RTGKosten = w.RTGKosten || {};

  K.esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g,
      function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };
  /* Centen worden hier EEN keer euro's, voor allebei de schermen. De kern stuurt
     centen rauw door; twee afrondlagen zijn een cent verschil die niemand kan
     verklaren. */
  K.euro = function (centen) {
    var c = Math.round(Number(centen) || 0);
    return (c < 0 ? '-' : '') + '€ ' +
      (Math.abs(c) / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  /* De vier toestanden, met hun woord EN hun teken. Kleur is de derde laag en
     nooit de eerste (ONTWERP.md par. 5): wie kleur niet ziet, leest hetzelfde. */
  var TOESTAND = {
    gezond:   { woord: 'In orde', teken: '✓' },
    aandacht: { woord: 'Let op', teken: '!' },
    incident: { woord: 'Actie nodig', teken: '!' },
    onbekend: { woord: 'Niet vast te stellen', teken: '?' }
  };

  var MAAND = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli',
    'augustus', 'september', 'oktober', 'november', 'december'];
  K.maandNaam = function (p) {
    var m = /^(\d{4})-(\d{2})$/.exec(String(p || ''));
    return m ? MAAND[Number(m[2]) - 1] + ' ' + m[1] : String(p || '');
  };

  /* De bewijsgraad als status. 'onbekend' krijgt met opzet geen signaalkleur:
     dat is geen storing maar een uitslag (BESTUUR.md par. 3). */
  var GRAADSIG = { gemeten: 'gezond', vermoed: 'aandacht' };
  K.graad = function (g) {
    var sig = GRAADSIG[g];
    return '<span class="rtg-status"' + (sig ? ' data-sig="' + sig + '"' : '') +
      ' data-teken="' + (g === 'gemeten' ? '✓' : g === 'vermoed' ? '~' : '?') + '">' +
      K.esc(g || 'onbekend') + '</span>';
  };

  K.stijl = function () {
    if (d.getElementById('ksStijl')) return;
    var st = d.createElement('style');
    st.id = 'ksStijl';
    st.textContent =
      /* Het hoofdvlak is geen kaart. Een kaart is alleen een kaart als het ding
         een zelfstandig object is (ONTWERP.md par. 7); dit is de toestand van
         het scherm zelf, dus een vlak met een signaalrail ervoor. */
      /* ALLEEN BOVEN EN ONDER, en dat is geen detail: dit vlak draagt ook
         .rtg-rail, en die zet zijn eigen padding-left om de inhoud ACHTER de
         signaallijn te laten beginnen. Een kant-en-klare `padding: a 0 b`
         overschrijft die stilletjes met nul, en dan loopt het bedrag door de
         rail heen -- op een schermafdruk was de euro van "EUR 476,94"
         letterlijk half weg. */
      '.ks-hoofd{padding-top:1.1rem;padding-bottom:1.3rem;}' +
      '.ks-zin{font-size:1.02rem;line-height:1.5;margin:.5rem 0 .1rem;}' +
      '.ks-kpi{margin:.5rem 0 .2rem;}' +
      '.ks-onder{font-size:.8rem;color:var(--rtg-soft,#8A8680);line-height:1.6;}' +
      '.ks-reden{font-size:.86rem;color:var(--rtg-soft,#8A8680);line-height:1.6;margin-top:.5rem;}' +
      '.ks-rij{display:flex;align-items:baseline;gap:.6rem;flex-wrap:wrap;}' +
      '.ks-rij .rek{margin-left:auto;text-align:right;}' +
      '.ks-wat{min-width:8rem;}' +
      '.ks-hoeveel{font-size:.76rem;color:var(--rtg-soft,#8A8680);}' +
      '.ks-waarom{background:none;border:0;padding:.3rem 0;color:var(--rtg-soft,#8A8680);' +
        'font:inherit;font-size:.74rem;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;}' +
      '.ks-waarom:hover,.ks-waarom:focus-visible{color:var(--gold-tekst,#C0A544);}' +
      '.ks-keten{margin:.2rem 0 .8rem;padding:.6rem 0 .2rem;font-size:.82rem;line-height:1.6;}' +
      '.ks-stap{padding:.35rem 0 .35rem .9rem;border-left:2px solid var(--rtg-line,#2A2724);}' +
      '.ks-stap b{font-weight:600;}' +
      '.ks-stap small{display:block;color:var(--rtg-soft,#8A8680);font-size:.76rem;}';
    d.head.appendChild(st);
  };

  /* HET HOOFDVLAK: een toestand, een zin, hooguit EEN bedrag. Dat bedrag is de
     enige plek op dit scherm waar Bodoni mag staan (ONTWERP.md par. 1: een
     dominante KPI), en het staat er alleen als er iets gemeten is.

     `wie` is 'lid' of 'zaak' en verandert alleen de aanspreekvorm -- niet wat
     er beweerd wordt. */
  K.hoofd = function (beeld, vb, grens, wie) {
    var esc = K.esc, euro = K.euro;
    var t = beeld.overzicht.totaal;
    var g = grens || {};
    var toestand = t.graad === 'onbekend' ? 'onbekend'
      : g.stand === 'dicht' ? 'incident'
      : g.stand === 'waarschuwing' ? 'aandacht' : 'gezond';
    var w2 = TOESTAND[toestand];
    /* Zonder toestand GEEN data-sig, en dat is geen slordigheid: de rail is dan
       de gewone haarlijn. Een verzonnen waarde zou als onbekende toestand door
       de CSS vallen en er toevallig goed uitzien. */
    var sig = toestand === 'onbekend' ? '' : ' data-sig="' + toestand + '"';
    var h = '<div class="ks-hoofd rtg-rail"' + sig + '>' +
      '<span class="rtg-status"' + sig + ' data-teken="' + w2.teken + '">' + esc(w2.woord) + '</span>';

    if (toestand === 'onbekend') {
      return h + '<p class="ks-zin">Wat ' + (wie === 'zaak' ? 'het gebruik van uw zaak' : 'uw gebruik') +
        ' van RTG deze maand kost, is nog niet uit te rekenen.</p>' +
        '<p class="ks-reden">Er staat hier geen bedrag, en met opzet geen nul: nul zou "gratis" betekenen, ' +
        'en dat is iets anders dan "niet bekend". Zodra de tarieven en de nota\'s van onze eigen leveranciers ' +
        'zijn ingevoerd, rekent RTG dit uit -- en dan staat het hier met de bron erbij.</p></div>';
    }

    var lopend = vb && vb.lopend;
    var bedrag = lopend && typeof vb.verwachtCenten === 'number' ? vb.verwachtCenten : t.centen;
    /* De zin bij een toestand komt van de SERVER (grensStand). Ontbreekt hij,
       dan staat er een korte eigen zin en geen losse punt: een scherm dat op
       een lege string eindigt, leest als een fout in plaats van een melding. */
    var uitleg = String(g.uitleg || '').split('.')[0];
    h += '<p class="ks-zin">' + (toestand === 'gezond'
        ? (wie === 'zaak' ? 'Uw zaak draait normaal. Er is niets dat uw aandacht vraagt.' : 'Alles loopt zoals verwacht.')
        : uitleg ? esc(uitleg + '.')
        : 'Het verbruik van deze maand is boven een grens gekomen die voor dit account is ingesteld.') + '</p>' +
      '<p class="rtg-kpi ks-kpi">' + esc(euro(bedrag)) + '</p>' +
      /* WAT DIT GETAL IS, in dezelfde regel. Een groot bedrag bovenaan een
         scherm leest als een rekening, en dat is het meestal niet: bij de
         meeste passen zit dit in het lidmaatschap. Het staat hier en niet als
         extra regel, want dan wordt de rustige bovenkant weer een blok tekst.
         Wie het WEL betaalt, staat verderop met de reden erbij. */
      '<p class="ks-onder">' +
        (wie === 'zaak' ? 'wat het gebruik van uw zaak ons kost' : 'wat uw gebruik ons kost') + ' &middot; ' +
        (lopend
          ? 'verwacht over ' + esc(K.maandNaam(beeld.periode)) + ' &middot; ' + esc(euro(t.centen)) + ' tot nu toe'
          : 'de uitkomst van ' + esc(K.maandNaam(beeld.periode))) +
      ' &middot; ' + K.graad(t.graad) + '</p>';
    if (vb && vb.band) {
      h += '<p class="ks-onder">Bandbreedte ' + esc(euro(vb.band.vanCenten)) + ' tot ' + esc(euro(vb.band.totCenten)) +
        ', gemeten op onze eigen trefzekerheid over afgesloten maanden.</p>';
    } else if (lopend) {
      h += '<p class="ks-onder">Er staat geen bandbreedte omheen: die mag er pas als onze trefzekerheid ' +
        'over afgesloten maanden gemeten is.</p>';
    }
    return h + '</div>';
  };
})(window, document);
