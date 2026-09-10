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

   EEN LEGE STAAT MET EEN ENKELE UITWEG IS ZELF DE UITWEG. Iemand hoeft niet
   eerst te begrijpen dat het vlak leeg is en daarna een klein knopje te
   zoeken. Een tik op de kaart opent het bestaande formulier of menu. Met meer
   dan een stap blijft het een gewoon vlak: dan is er werkelijk iets te kiezen.

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

  function actieVan(o) {
    if (o.actie && o.actie.tekst && (o.actie.pad || o.actie.doel || typeof o.actie.doe === 'function')) return o.actie;
    var stappen = o.stappen || [], stap = stappen.length === 1 ? stappen[0] : null;
    return stap && stap.tekst && stap.pad ? stap : null;
  }

  function maakVlak(o, actie) {
    var el;
    if (actie && actie.pad) { el = d.createElement('a'); el.href = actie.pad; }
    else if (actie && (actie.doel || typeof actie.doe === 'function')) {
      el = d.createElement('div'); el.setAttribute('role', 'button'); el.tabIndex = 0;
    }
    else el = d.createElement('div');
    el.className = 'rtg-leeg-vlak' + (actie ? ' rtg-leeg-vlak--actie' : '');
    if (actie && actie.doel) el.dataset.rtgLeegDoel = actie.doel;
    if (actie && typeof actie.doe === 'function') {
      el.addEventListener('click', actie.doe);
      el.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); el.click(); } });
    }
    return el;
  }

  function voegActiesToe(el, o, actie) {
    if (actie) {
      var s = d.createElement('span'); s.className = 'rtg-leeg-actie'; s.textContent = actie.tekst;
      el.appendChild(s); return;
    }
    (o.stappen || []).forEach(function (st) {
      if (!st || !st.pad || !st.tekst) return;
      var a = d.createElement('a');
      a.className = 'rtg-leeg-actie'; a.href = st.pad; a.textContent = st.tekst;
      el.appendChild(a);
    });
  }

  function vlak(o) {
    o = o || {}; var actie = actieVan(o), el = maakVlak(o, actie);
    if (o.ey) { var s = d.createElement('span'); s.className = 'rtg-leeg-ey'; s.textContent = o.ey; el.appendChild(s); }
    if (o.titel) { var b = d.createElement('b'); b.textContent = o.titel; el.appendChild(b); }
    ['wat', 'waarom'].forEach(function (sleutel) {
      if (!o[sleutel]) return;
      var p = d.createElement('p'); p.textContent = o[sleutel]; el.appendChild(p);
    });
    voegActiesToe(el, o, actie);
    return el;
  }

  /* Dezelfde vorm als tekst, voor de vele plekken die met innerHTML werken.
     Alles wat erin gaat wordt ontsnapt: deze zinnen komen van een server. */
  function html(o) {
    o = o || {}; var actie = actieVan(o), tag = actie && actie.pad ? 'a' : 'div';
    if (actie && typeof actie.doe === 'function' && !actie.pad && !actie.doel) actie = null;
    var attribuut = actie && actie.pad ? ' href="' + esc(actie.pad) + '"' : actie && actie.doel
      ? ' role="button" tabindex="0" data-rtg-leeg-doel="' + esc(actie.doel) + '"' : '';
    var uit = '<' + tag + ' class="rtg-leeg-vlak' + (actie ? ' rtg-leeg-vlak--actie' : '') + '"' + attribuut + '>';
    if (o.ey) uit += '<span class="rtg-leeg-ey">' + esc(o.ey) + '</span>';
    if (o.titel) uit += '<b>' + esc(o.titel) + '</b>';
    if (o.wat) uit += '<p>' + esc(o.wat) + '</p>';
    if (o.waarom) uit += '<p>' + esc(o.waarom) + '</p>';
    if (actie) uit += '<span class="rtg-leeg-actie">' + esc(actie.tekst) + '</span>';
    else (o.stappen || []).forEach(function (st) {
      if (!st || !st.pad || !st.tekst) return;
      uit += '<a class="rtg-leeg-actie" href="' + esc(st.pad) + '">' + esc(st.tekst) + '</a>';
    });
    return uit + '</' + tag + '>';
  }

  d.addEventListener('click', function (ev) {
    var leeg = ev.target.closest && ev.target.closest('[data-rtg-leeg-doel]');
    if (!leeg) return;
    var doel = null; try { doel = d.querySelector(leeg.dataset.rtgLeegDoel); } catch (e) {}
    if (doel && doel !== leeg) {
      if (doel.focus) doel.focus({ preventScroll: false });
      if (doel.matches('button,a,[role="button"]')) doel.click();
    }
  });
  d.addEventListener('keydown', function (ev) {
    var leeg = ev.target.closest && ev.target.closest('[data-rtg-leeg-doel]');
    if (!leeg || (ev.key !== 'Enter' && ev.key !== ' ')) return;
    ev.preventDefault(); leeg.click();
  });

  w.RTGLeeg = {
    vlak: vlak, html: html, aangemeld: aangemeld,
    vanFout: vanFout, inlogStand: inlogStand
  };
})(window, document);
