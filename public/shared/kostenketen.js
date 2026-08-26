/* WAT UW GEBRUIK VAN RTG KOST -- de onderbouwing onder de rustige bovenkant.

   Hoort bij /shared/kostenbeeld.js en hangt zichzelf aan hetzelfde object; de
   splitsing is de 10 KB-maatregel van de repo (scripts/check.js regel 13) en de
   snede ligt op een echt verschil: daar staat de TOESTAND (een zin, een
   bedrag), hier staat het BEWIJS eronder (de regels, de keten terug naar de
   factuur van onze eigen leverancier, en wat dit scherm niet weet).

   "WAAROM BETAAL IK DIT" is hier geen tekstje maar een keten die eindigt bij de
   leveranciersfactuur -- of eerlijk zegt waar hij ophoudt. Zie
   server/kern/kosten/herkomst.js: de keten stopt bij een MENS die een bedrag
   heeft overgenomen, en dat staat er ook. Een keten die zich voordoet als
   bewijs tot aan de bron is erger dan een keten die zegt waar hij ophoudt, want
   dan stopt niemand met zoeken op de juiste plek. */
(function (w) {
  'use strict';
  var K = w.RTGKosten = w.RTGKosten || {};

  /* "1 verzoeken" hoort nergens op een scherm van dit huis. De meter telt in het
     MEERVOUD (tokens, verzoeken, berichten, transacties) omdat dat de eenheid
     van de teller is; bij precies een stuk hoort er enkelvoud te staan.

     Twee regels, en ze dekken alle zes de eenheden uit kern/kosten/soorten.js:
     -en eraf (verzoeken, berichten) of -s eraf (tokens, transacties). Wat op
     geen van beide eindigt blijft staan (GB-maand, euro). Verzint niets: een
     woord dat de regels niet raken, gaat ongewijzigd door. */
  function eenheid(aantal, ruw) {
    var w2 = String(ruw || '');
    if (Number(aantal) !== 1) return w2;
    if (/en$/.test(w2)) return w2.slice(0, -2);
    if (/s$/.test(w2)) return w2.slice(0, -1);
    return w2;
  }

  /* De stappen van de keten in gewone woorden. De namen komen van de server;
     hier staat alleen hoe ze heten voor een mens. */
  var STAP = { bedrag: 'Het bedrag', verbruik: 'Wat er gemeten is', tarief: 'Het tarief',
    verdeelsleutel: 'De verdeelsleutel', nota: 'Onze eigen nota',
    leveranciersfactuur: 'De factuur van de leverancier' };

  /* De regels als REGISTER en niet als kaartenstapel (ONTWERP.md par. 7). Elke
     regel draagt zijn eigen bewijsgraad, want een toegerekende regel is een
     verdeling van een nota en geen meting -- ook al ziet het getal er even
     precies uit. */
  K.regels = function (beeld) {
    var esc = K.esc, euro = K.euro;
    var o = beeld.overzicht;
    var alles = (o.regels || []).map(function (r) {
      return { soort: r.soort, naam: r.naam, graad: r.graad,
        hoeveel: r.millicenten == null ? null : r.aantal + ' ' + eenheid(r.aantal, r.ruw),
        centen: r.millicenten == null ? null : Math.round(r.millicenten / 1000) };
    }).concat((o.toegerekend || []).map(function (r) {
      return { soort: r.soort, naam: r.naam, graad: r.graad, hoeveel: 'aandeel in de nota', centen: r.centen };
    }));
    if (!alles.length) return '<p class="stil">Er is deze maand nog niets gemeten.</p>';
    return '<div class="rtg-register">' + alles.map(function (r) {
      return '<div class="rij rtg-rail ks-rij"' + (r.graad === 'gemeten' ? ' data-sig="gezond"' : '') + '>' +
        '<span class="ks-wat">' + esc(r.naam) + '<br><span class="ks-hoeveel">' + esc(r.hoeveel || '') + '</span></span>' +
        '<span class="rek"><span class="rtg-bedrag">' +
          (r.centen == null ? 'geen bedrag' : esc(euro(r.centen))) + '</span><br>' +
        K.graad(r.graad) + '<br>' +
        '<button class="ks-waarom" type="button" data-waarom="' + esc(r.soort) + '">Waarom dit bedrag</button></span>' +
        '</div>' +
        '<div class="ks-keten" id="ksKeten-' + esc(r.soort) + '" hidden></div>';
    }).join('') + '</div>';
  };

  K.keten = function (r) {
    var esc = K.esc, euro = K.euro;
    if (!r.keten || !r.keten.length) return '<div class="ks-stap">' + esc(r.waarom || 'Hier valt niets na te lezen.') + '</div>';
    return r.keten.map(function (s) {
      var kern = '';
      if (s.stap === 'bedrag') kern = s.centen != null ? euro(s.centen)
        : s.millicenten != null ? euro(Math.round(s.millicenten / 1000)) : 'geen bedrag';
      else if (s.stap === 'verbruik') kern = s.aantal + ' ' + eenheid(s.aantal, s.ruw);
      else if (s.stap === 'tarief') kern = s.perEenheid == null ? 'geen tarief'
        : (s.perEenheid / 1000).toLocaleString('nl-NL', { maximumFractionDigits: 3 }) + ' cent per eenheid' +
          (s.bron ? ' &middot; ' + esc(s.bron) : '');
      else if (s.stap === 'verdeelsleutel') kern = esc(s.sleutel || '') +
        (s.betaaldDoor ? ' &middot; betaald door ' + esc(s.betaaldDoor) : '');
      else if (s.stap === 'nota') kern = s.centen == null ? 'geen nota ingevoerd'
        : euro(s.centen) + (s.bron ? ' &middot; ' + esc(s.bron) : '');
      else if (s.stap === 'leveranciersfactuur') kern = s.gevonden
        ? esc(s.leverancier) + ' &middot; ' + esc(s.nummer) + ' &middot; ' + euro(s.centen)
        : 'geen factuur gekoppeld';
      return '<div class="ks-stap"><b>' + esc(STAP[s.stap] || s.stap) + '</b> ' + kern +
        (s.zegtNiet ? '<small>' + esc(s.zegtNiet) + '</small>' : '') +
        (s.waarom ? '<small>' + esc(s.waarom) + '</small>' : '') +
        (s.ingevoerdOp ? '<small>Overgenomen door een mens op ' + esc(String(s.ingevoerdOp).slice(0, 10)) + '.</small>' : '') +
        '</div>';
    }).join('');
  };

  /* WIE BETAALT DIT. De lezer hoort het antwoord te krijgen zonder de
     beleidskaart te kennen: eerst of het op zijn rekening komt, dan waarom. */
  K.betaalt = function (b) {
    return '<p>' + (b.wieBetaalt.opDeRekening
      ? 'Dit komt op uw maandfactuur van RTG.'
      : 'U betaalt hier niets voor.') + '</p>' +
      '<p class="stil h-mt40">' + K.esc(b.wieBetaalt.uitleg || '') + '</p>' +
      /* En de reden alleen als hij iets TOEVOEGT. De server zet `waaromNiet` op
         de uitleg van de beleidsstand zodra er niet doorbelast wordt, dus bij de
         meeste passen stond dezelfde zin er twee keer onder elkaar -- en een
         scherm dat zichzelf herhaalt, leest als een fout. */
      (b.wieBetaalt.waaromNiet && b.wieBetaalt.waaromNiet !== b.wieBetaalt.uitleg
        ? '<p class="stil h-mt40">' + K.esc(b.wieBetaalt.waaromNiet) + '</p>' : '');
  };

  /* WAT DIT SCHERM NIET WEET, en even groot als de rest. Een kostenbeeld dat
     alleen zijn eigen getallen toont, leest als volledig -- en dat is het niet
     zolang er soorten zijn die niemand meet. */
  K.niet = function (b) {
    var esc = K.esc;
    var niet = (b.zegtNiet && b.zegtNiet.nietGemeten) || [];
    return '<p class="stil">' + esc(b.zegtNiet.toegerekend) + '</p>' +
      (niet.length
        ? '<p class="stil h-mt60">Van deze soorten is deze maand niets gemeten, en dat is iets anders dan nul: ' +
          niet.map(function (n) { return esc(n.naam); }).join(', ') + '.</p>'
        : '') +
      ((b.overzicht.zonderTarief || []).length
        ? '<p class="stil h-mt40">Voor ' + b.overzicht.zonderTarief.map(esc).join(', ') +
          ' is er geen tarief ingevoerd; die staan daarom zonder bedrag.</p>'
        : '') +
      '<p class="stil h-mt60">Wat hier NIET staat: welke vraag u wanneer aan Rahul stelde. Deze laag houdt tellers ' +
        'bij en geen logboek van uw gedrag -- voor een rekening is dat niet nodig, en het kan wel uitlekken.</p>';
  };
})(window);
