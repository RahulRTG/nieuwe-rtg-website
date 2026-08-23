/* RTG Horeca (scherm): DE BINNENKANT VAN EEN KEUKENBON.

   WAAROM DIT EEN EIGEN BESTAND IS. ./keuken.js liep over de 10 kB-grens van
   keuringsregel 13 toen de bereidingsstappen erbij kwamen. De snede ligt op een
   echte naad: hier staat hoe een bon ERUITZIET, in keuken.js staat hoe het bord
   zich GEDRAAGT (verversen zonder springen, ankeren, laden, banen tellen).

   Alles hieronder is een pure functie van een bonregel naar HTML. Hij raakt geen
   netwerk en geen toestand, dus een verandering hier kan het bord niet laten
   springen -- en dat is precies de fout die keuken.js bewaakt. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  var esc = function (t) { return K.esc(t); };

  var BAANWOORD = { nu: 'NU', hierna: 'HIERNA', wacht: 'WACHT', risico: 'RISICO' };

  function klokje(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  /* De binnenkant van een bon. Apart van het maken, want bij een verversing
     wordt alleen dit vervangen -- het element zelf blijft staan en dus blijft
     de hoogte van alles erboven gelijk. */
  function inhoud(b) {
    var kleur = (b.urgentie === 'te laat' || b.urgentie === 'let op') ? 'laat' : 'aan';
    var baan = b.baan && BAANWOORD[b.baan] ? b.baan : '';
    /* Wat de kok moet WETEN staat als woorden op de bon, niet alleen als tint:
       de baan met zijn tijd, en waarom die tijd zo is. Zonder de tekst is de
       baan een kleurtje, en dan is punt 2 hierboven voor niets geschreven. */
    var baanTag = baan
      ? '<span class="tag baan ' + esc(baan) + '">' + BAANWOORD[baan] +
        (b.startOm ? ' · aanzetten ' + esc(klokje(b.startOm)) : '') + '</span>'
      : '';
    return '<b>' + esc(b.tafel || b.kanaal) +
      /* DE STOEL STAAT BIJ DE TAFEL EN NIET ONDERAAN. Een gang gaat samen de
         deur uit, maar bij de tafel moet elk bord bij de juiste persoon staan --
         en een runner die vier borden draagt, leest dat in één blik of niet. */
      (b.stoel ? ' <span class="stoel">' + esc(b.stoel) + '</span>' : '') + '</b>' +
      ' <span class="tag">gang ' + b.gang + '</span>' +
      ' <span class="tag">' + esc(b.station) + '</span>' +
      baanTag +
      (b.doelOm ? ' <span class="tag">op tafel ' + esc(klokje(b.doelOm)) + '</span>' : '') +
      (b.serveerOm ? ' <span class="tag">serveren ' + esc(b.serveerOm) + '</span>' : '') +
      ' <span class="tag ' + kleur + '">' + b.loopt + ' van ' + b.norm + ' min</span>' +
      (b.allergie ? '<div><span class="allergie">Allergie: ' + esc(b.allergie) + '</span></div>' : '') +
      '<div class="wat">' + b.aantal + '× ' + esc(b.naam) +
      (b.notitie ? ' <span class="stil">· ' + esc(b.notitie) + '</span>' : '') + '</div>' +
      (b.samenMet && b.samenMet.length
        ? '<div class="stil samen">gaat samen met ' + b.samenMet.map(esc).join(', ') + '</div>' : '') +
      /* DE BEREIDINGSSTAPPEN, elk met zijn eigen aanzetmoment. Een gerecht dat
         drie minuten marineert, acht minuten grilt en drie minuten saus krijgt,
         is drie handelingen op drie plekken -- en dan hoort de grill een ander
         moment te horen dan de sauzier. Zonder stappen staat hier niets, en dan
         is dit bord precies wat het altijd was (kern/horeca/stappen.js). */
      (b.stappen && b.stappen.length
        ? '<ol class="stappen">' + b.stappen.map(function (st) {
            return '<li><span class="tag">' + esc(st.station) + '</span> ' +
              esc(st.wat || (st.minuten + ' min')) +
              ' <span class="stil">' + esc(klokje(st.startOm)) + ' · ' + st.minuten + ' min</span></li>';
          }).join('') + '</ol>' : '') +
      (b.cadans ? '<div class="stil som">' + esc(b.cadans) + '</div>' : '') +
      '<div class="rij">' + ['gestart', 'bereid', 'klaar', 'uitgegeven'].map(function (s) {
        return '<button class="knop' + (b.stand === s ? ' p' : '') + '" data-stand="' + s +
          '" data-rek="' + esc(b.rekeningId) + '" data-regel="' + esc(b.regelId) + '">' + s + '</button>';
      }).join('') + '</div>';
  }

  window.RTGHorecaKeukenBon = { inhoud: inhoud, klokje: klokje, BAANWOORD: BAANWOORD };
})();
