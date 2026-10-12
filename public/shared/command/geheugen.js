/* WAT DE WERKTAFEL ONTHOUDT TUSSEN TWEE BEZOEKEN.

   WERELD.md zei tot 19 augustus 2026: er is een beginscherm en dat is de LEGE
   werktafel -- inloggen, je laatste blad sluiten en op Home drukken komen alle
   drie op dezelfde lege keuze uit. Die regel is bewust vervangen: inloggen komt
   nu terug waar je gebleven was, zoals een besturingssysteem hoort te doen.

   DE TWEE ANDERE WEGEN BLIJVEN WEL LEEG UITKOMEN, en dat is de hele grap. Zonder
   dat is er geen weg terug naar een schone tafel:

     inloggen              -> je laatste bladen staan er weer
     Home                  -> leeg, en het geheugen is gewist
     laatste blad sluiten  -> leeg, en het geheugen is gewist

   Dat laatste hoeft niet apart geprogrammeerd: `thuis()` roept wis() en dan
   sync(), en sync() schrijft de stand van dat moment weg. Nul bladen wegschrijven
   IS het wissen. Wie hier ooit een uitzondering maakt ("Home laat het geheugen
   staan"), maakt de schone tafel onbereikbaar.

   WAT ER NIET IN GAAT. Alleen het adres en de titel van een blad -- geen
   scrollpositie, geen formulierinhoud, geen sessie. Een blad is een iframe naar
   een gewone pagina; die pagina bewaart zijn eigen dingen zelf, en dit hier
   hoort geen tweede plek te worden waar iets van een lid staat.

   EN HET WORDT GEWIST BIJ UITLOGGEN (app-main-04.js, naast rtg_actieve_tab).
   Anders ziet de volgende mens op een gedeeld toestel de titels van de vorige. */
(function (w) {
  'use strict';
  var SLEUTEL = 'rtg_cmd_bladen';
  var MAX = 2;                                   // de werktafel draagt er nooit meer

  function lees() {
    var ruw = null;
    try { ruw = w.localStorage.getItem(SLEUTEL); } catch (e) { return null; }
    if (!ruw) return null;
    var g = null;
    try { g = JSON.parse(ruw); } catch (e) { return null; }
    if (!g || !Array.isArray(g.bladen)) return null;
    /* ALLEEN EIGEN ADRESSEN TERUG. Een blad is een iframe; wat hier staat komt
       uit opslag die een pagina zelf kan zetten, dus een adres naar buiten zou
       een vreemde site in de schil trekken. Een pad dat met EEN schuine streep
       begint is per definitie hier. */
    var bladen = g.bladen.filter(function (b) {
      /* En geen backslash: new URL('/\\elders.nl/x', hier) wordt https://elders.nl/x. */
      return b && typeof b.url === 'string' && b.url.charAt(0) === '/' && b.url.charAt(1) !== '/' &&
        b.url.indexOf('\\') < 0;
    }).slice(0, MAX).map(function (b) {
      return { url: b.url, titel: typeof b.titel === 'string' ? b.titel : '' };
    });
    if (!bladen.length) return null;
    var actief = typeof g.actief === 'number' ? g.actief : 0;
    if (actief < 0 || actief >= bladen.length) actief = bladen.length - 1;
    return { bladen: bladen, actief: actief };
  }

  function schrijf(panes, actief) {
    var bladen = (panes || []).slice(0, MAX).map(function (p) {
      return { url: p.url, titel: p.titel };
    });
    try {
      if (!bladen.length) w.localStorage.removeItem(SLEUTEL);
      else w.localStorage.setItem(SLEUTEL, JSON.stringify({ bladen: bladen, actief: actief }));
    } catch (e) {}
  }

  function wis() { try { w.localStorage.removeItem(SLEUTEL); } catch (e) {} }

  /* TERUG WAAR JE GEBLEVEN WAS. Stond in werktafel.js; het hoort hier, bij de
     regels over wanneer de werktafel iets terugzet. Staat er niets, dan blijft
     de lege keuze staan die bouw() net heeft neergezet.

     EN ALLEEN HET BLAD DAT IN BEELD KOMT, LAADT. Elk blad wordt teruggezet met
     zijn titel in de tabbalk, maar zonder adres (`later`); de werktafel geeft
     het adres pas als het blad gekozen wordt, en op een breed scherm -- waar ze
     naast elkaar staan -- meteen allebei. Op een telefoon staat er een in beeld,
     en SCHILHERSTART.json zag een terugkeer naar de werktafel daar TWEE bladen
     volledig laden: 215 scripts en 3,2 MB JavaScript voor een scherm waarvan je
     de helft niet zag. */
  function hervat(t) {
    var g = lees();
    if (!g) return;
    g.bladen.forEach(function (b) { t.toon(b.url, b.titel, true); });
    if (t.aantal()) t.select(Math.min(g.actief, t.aantal() - 1));
  }

  w.RTGCommandGeheugen = { lees: lees, schrijf: schrijf, wis: wis, hervat: hervat, SLEUTEL: SLEUTEL };
})(window);
