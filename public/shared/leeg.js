/* DE LEGE STAND VAN HET HUIS, OP EEN PLEK.

   Een scherm zonder inhoud is niet stuk. Het is leeg omdat er nog niets is,
   omdat u niet bent aangemeld, of omdat een bron niets te melden had -- en dat
   zijn drie verschillende mededelingen. Toch stond er op negenentwintig
   plekken in public/apps dezelfde regel:

     '<p class="stil">' + fout + ' Log eerst in via de leden-app.</p>'

   Een kale zin bovenaan een leeg vlak, en op elk scherm nét een andere maat.
   De vorm hoort bij een KOP en niet bij een foutmelding: een klein gouden
   opschrift, een regel in de displayletter, een zin eronder. Die vorm staat in
   shared/rtg-ui.css (.rtg-leeg-vlak); dit bestand bouwt hem.

   DRIE REGELS DIE HIER NIET MOGEN SNEUVELEN.

   Een uitweg komt er alleen als hij BESTAAT. Een knop die nergens heen gaat is
   erger dan geen knop, want hij belooft dat er iets te doen valt.

   "Niet aangemeld" is geen fout. Wie niet is ingelogd heeft niets verkeerd
   gedaan; die krijgt een uitnodiging en geen storingsmelding. Wie wel is
   ingelogd en toch nul terugkrijgt, krijgt de zin van de server -- die weet
   waarom, en dit bestand niet.

   Er wordt niets VERZONNEN. Zonder tekst van de aanroeper blijft een regel weg
   in plaats van te worden opgevuld met iets algemeens.

   window.RTGLeeg = { vlak, html, aangemeld } */
(function (w, d) {
  'use strict';

  function aangemeld() {
    try { return !!w.localStorage.getItem('rtg_member_token'); } catch (e) { return false; }
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* De stand rond "u bent niet aangemeld", zodat elke aanroeper hem op
     dezelfde manier stelt in plaats van hem per scherm te formuleren. */
  function inlogStand(o) {
    return {
      ey: o.ey || null,
      titel: o.titel || 'Meld u aan om verder te gaan.',
      wat: o.wat || null,
      stappen: [{ tekst: 'Naar de leden-app', pad: '/apps/app.html' }]
    };
  }

  /* Kiest de juiste stand uit een fout. `status` 401 is niet aangemeld; al het
     andere is een echte storing en krijgt GEEN inlogknop -- die zou dan liegen
     over wat het probleem is. */
  function vanFout(e, o) {
    o = o || {};
    var status = e && e.status;
    var bericht = (e && (e.message || e.error)) || '';
    if (status === 401 || (!status && !aangemeld())) {
      return inlogStand({ ey: o.ey, wat: bericht || null });
    }
    return {
      ey: o.ey || null,
      titel: o.titel || 'Dit lukte niet.',
      wat: bericht || null,
      stappen: []
    };
  }

  function vlak(o) {
    o = o || {};
    var el = d.createElement('div');
    el.className = 'rtg-leeg-vlak';
    if (o.ey) { var s = d.createElement('span'); s.className = 'rtg-leeg-ey'; s.textContent = o.ey; el.appendChild(s); }
    if (o.titel) { var b = d.createElement('b'); b.textContent = o.titel; el.appendChild(b); }
    ['wat', 'waarom'].forEach(function (sleutel) {
      if (!o[sleutel]) return;
      var p = d.createElement('p'); p.textContent = o[sleutel]; el.appendChild(p);
    });
    (o.stappen || []).forEach(function (st) {
      if (!st || !st.pad || !st.tekst) return;   // een halve stap is geen stap
      var a = d.createElement('a');
      a.className = 'rtg-leeg-actie'; a.href = st.pad; a.textContent = st.tekst;
      el.appendChild(a);
    });
    return el;
  }

  /* Dezelfde vorm als tekst, voor de vele plekken die met innerHTML werken.
     Alles wat erin gaat wordt ontsnapt: deze zinnen komen van een server. */
  function html(o) {
    o = o || {};
    var uit = '<div class="rtg-leeg-vlak">';
    if (o.ey) uit += '<span class="rtg-leeg-ey">' + esc(o.ey) + '</span>';
    if (o.titel) uit += '<b>' + esc(o.titel) + '</b>';
    if (o.wat) uit += '<p>' + esc(o.wat) + '</p>';
    if (o.waarom) uit += '<p>' + esc(o.waarom) + '</p>';
    (o.stappen || []).forEach(function (st) {
      if (!st || !st.pad || !st.tekst) return;
      uit += '<a class="rtg-leeg-actie" href="' + esc(st.pad) + '">' + esc(st.tekst) + '</a>';
    });
    return uit + '</div>';
  }

  w.RTGLeeg = {
    vlak: vlak, html: html, aangemeld: aangemeld,
    vanFout: vanFout, inlogStand: inlogStand
  };
})(window, document);
