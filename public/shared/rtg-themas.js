/* De themakiezer: EEN systeem, vier standen, op de materialen.

   Hier stonden er twee. shared/thema.js kende donker/licht en werd door een
   pagina geladen; shared/rosthema.js kende parelmoer/standaard/bordeaux en werd
   door twintig pagina's geladen -- en ze schreven in DEZELFDE sleutel
   (rtg_thema) met een ander vocabulaire. Wie in het paneel "Champagne" koos,
   zag op het beginscherm "donker". Twee plekken die een waarheid vasthouden
   (LAT.md regel 4), uit elkaar gelopen.

   Deze laag gebruikt een eigen sleutel en laat de oude twee met rust, zodat een
   pagina die nog niet om is niets merkt. Migreren gebeurt pagina voor pagina;
   zolang dat loopt is er geen moment waarop beide half werken. */
(function (w, d) {
  'use strict';
  var KEY = 'rtg_thema_v2';
  var THEMAS = [
    { id: 'champagne', naam: 'Champagne', materiaal: 'parelmoer', kleur: '#F4F0E9' },
    { id: 'onyx', naam: 'Onyx', materiaal: 'pianolak', kleur: '#0C0C0B' },
    { id: 'bordeaux', naam: 'Bordeaux', materiaal: 'fluweel', kleur: '#4A0C1E' },
    { id: 'royal', naam: 'Royal', materiaal: 'satijn', kleur: '#101E3F' }
  ];
  function geldig(t) { for (var i = 0; i < THEMAS.length; i++) if (THEMAS[i].id === t) return t; return null; }
  function huidig() { try { return geldig(localStorage.getItem(KEY)) || 'onyx'; } catch (e) { return 'onyx'; } }
  function pas(t) {
    var th = THEMAS.filter(function (x) { return x.id === t; })[0] || THEMAS[1];
    d.documentElement.setAttribute('data-rtg-thema', th.id);
    var meta = d.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', th.kleur);
    /* De levende kleur opnieuw laten rekenen: hij ademt door over elk thema
       heen, alleen met een andere sterkte (zie --rtg-dagsterkte). */
    if (w.RTGLevend && w.RTGLevend.familie) { try { w.RTGLevend.familie(); } catch (e) {} }
  }
  function zet(t) { try { localStorage.setItem(KEY, geldig(t) || 'onyx'); } catch (e) {} pas(geldig(t) || 'onyx'); }
  pas(huidig());
  w.RTGThemas = { themas: THEMAS, huidig: huidig, zet: zet };
})(window, document);
