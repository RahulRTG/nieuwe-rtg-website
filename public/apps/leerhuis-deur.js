/* Het leerhuis: de DEUR naar de server voor Mijn leerhuis en het werkscherm
   (ACADEMY.md, fase B-UI). Een plek en geen twee kopieen (LAT.md regel 4).

   ELKE HANDELING DRAAGT EEN SLEUTEL (shared/id.js), en die blijft staan tot de
   server hem heeft aangenomen: een tweede klik is dezelfde handeling en geen
   tweede. Antwoordt de server "onbekend" (503 bij een duurzame handeling), dan
   wordt eerst de uitkomst nagevraagd en pas daarna opnieuw geprobeerd, met
   dezelfde sleutel. Na een gelukte handeling wordt eerst opnieuw geladen en dan
   pas gemeld: wie het bericht hoort, vindt het scherm al bijgewerkt.

   `gelukt` is een zin, of een functie die van het antwoord een zin maakt (een
   simulatie antwoordt met een uitslag, en die hoort in de melding). */
'use strict';
window.RTGLeerhuisDeur = function (o) {
  var TOKEN = null;
  try { TOKEN = localStorage.getItem('rtg_member_token'); } catch (e) {}
  var sleutels = {};
  function post(pad, lijf) {
    return fetch(pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (TOKEN || '') },
      body: JSON.stringify(lijf) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d }; });
    });
  }
  function lees(vraag, extra) {
    return post('/api/leerhuis/lees', Object.assign({ org: o.org(), vraag: vraag }, extra || {})).then(function (x) {
      if (x.status >= 400) throw new Error(x.d.error || (x.status === 401 ? 'U bent niet ingelogd.' : 'Het leerhuis antwoordde niet.'));
      return x.d.antwoord;
    });
  }
  function zin(gelukt, d) { return typeof gelukt === 'function' ? gelukt(d) : gelukt; }
  function doe(naam, actie, invoer, gelukt) {
    var sleutel;
    try { sleutel = sleutels[naam] || (sleutels[naam] = window.RTGId(o.voorvoegsel || 'leerhuis')); } catch (e) { o.meld(e.message); return Promise.resolve(); }
    o.meld('Bezig: ' + (typeof gelukt === 'string' ? gelukt.toLowerCase() : 'een ogenblik'));
    return post('/api/leerhuis/doe', { org: o.org(), actie: actie, invoer: invoer, sleutel: sleutel }).then(function (x) {
      if (x.status === 503) {
        /* Onbekend: eerst navragen, niet blind opnieuw. */
        return lees('uitkomst', { sleutel: sleutel }).then(function (u) {
          if (u && u.bekend) { delete sleutels[naam]; return o.laad().then(function () { o.meld(zin(gelukt, {}) + ' Dat was al vastgelegd.'); }); }
          o.meld('Het is niet zeker of dit is vastgelegd. Druk nog eens; het gaat met dezelfde sleutel, dus het gebeurt hooguit een keer.');
        });
      }
      if (x.status >= 400) { o.meld('Niet gelukt: ' + (x.d.error || 'onbekende fout') + (x.d.hoe ? ' (' + x.d.hoe + ')' : '')); return; }
      delete sleutels[naam];
      return o.laad().then(function () { o.meld(zin(gelukt, x.d)); });
    }).catch(function () { o.meld('Het leerhuis antwoordde niet. Uw invoer staat er nog; druk nog eens.'); });
  }
  return { post: post, lees: lees, doe: doe, token: TOKEN, vergeet: function () { sleutels = {}; } };
};
