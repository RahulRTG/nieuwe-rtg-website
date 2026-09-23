/* HET EDGE BLIKVELD -- wat de Edge op dit moment van de werkelijkheid ziet.

   De Edge bezit de werkelijkheid niet; hij krijgt er een blikveld op. Dit
   bestand is dat blikveld, en het is met opzet een PROJECTIE en geen bron:

   - het leest uit de lagen die dit al weten (RTGAdaptief voor de context en de
     handelingen, RTGWorldIdentity en de schil voor de wereld, de Edge-Core voor
     wat de balk zelf kreeg, het geheugen van de werktafel voor voortzetting);
   - het schrijft NIETS terug: geen attribuut, geen opslag, geen bericht, geen
     context. Wie het blikveld nieuwer vindt dan het scherm, heeft ongelijk --
     de autoritatieve domein- en serverstand wint altijd (EDGE.md, besluit 5);
   - elke waarde draagt waar hij vandaan komt (herkomst), hoe zwaar hij weegt
     (gezag) en wanneer hij gezien is (sinds). `autoritatief` is voorbehouden aan
     de server, en vandaag is er geen server die hier iets over zegt.

   Het is ook het ENE leespad voor de handelingen: shared/rtg-adaptive-edge-
   controls.js vraagt acties() in plaats van zelf RTGAdaptief.voorNu() te lezen.

   Er is geen `op()` en geen setter: een capability zonder aanroeper bestaat niet
   (CONTROLPLANE.md). Wie in een volgende ronde een luisteraar nodig heeft,
   voegt hem toe met die aanroeper erbij. */
(function (root, fabriek) {
  'use strict';
  if (typeof module === 'object' && module.exports) { module.exports = { maak: fabriek }; return; }
  if (root && root.document && !root.RTGEdgeBlikveld) root.RTGEdgeBlikveld = fabriek(root);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (w) {
  'use strict';
  var d = w.document;
  var WERELDEN = ['living', 'travel', 'work', 'foundation'];
  var contextGezien = null, contextSleutel = null, gehaakt = false;

  function nu() { return Date.now(); }
  /* Een veld heeft altijd dezelfde vorm, ook als er niets is. Een leeg vak zonder
     reden wordt gevuld met iemands eigen indruk (SERVICE.md par. 12). */
  function veld(waarde, herkomst, gezag, sinds, reden) {
    var v = { waarde: waarde === undefined ? null : waarde, herkomst: herkomst, gezag: gezag,
      sinds: sinds == null ? null : sinds };
    if (v.waarde === null) v.reden = reden || 'geen bron';
    return v;
  }
  function kopie(x) { try { return x == null ? null : JSON.parse(JSON.stringify(x)); } catch (e) { return null; } }
  function adaptief() { return w.RTGAdaptief && typeof w.RTGAdaptief.context === 'function' ? w.RTGAdaptief : null; }
  /* Wanneer de context er kwam, weet alleen wie hem zag komen. Het blikveld hangt
     zich daarom een keer aan opContext -- lezend; de context zelf blijft van het
     scherm. */
  function haak(A) {
    if (gehaakt || !A || typeof A.opContext !== 'function') return;
    gehaakt = true;
    A.opContext(function (c) { contextSleutel = c && c.sleutel; contextGezien = nu(); });
  }
  function core() {
    var K = w.RTGAdaptiveEdgeCore;
    try { return K && typeof K.momentopname === 'function' ? K.momentopname() : null; } catch (e) { return null; }
  }

  function wereld(t) {
    var schil = d.getElementById('rtgCommand'), blad = d.body && d.body.getAttribute('data-rtg-blad-wereld');
    if (schil && blad) {
      return blad === 'geen' ? veld(null, 'blad', 'afgeleid', t, 'er staat geen blad open; de schil kiest nog geen wereld')
        : veld(blad, 'blad', 'afgeleid', t);
    }
    var id = w.RTGWorldIdentity, gevonden = null;
    if (id && typeof id.classify === 'function') { try { gevonden = id.classify(w.location.pathname); } catch (e) { gevonden = null; } }
    if (WERELDEN.indexOf(gevonden) >= 0) return veld(gevonden, 'route', 'afgeleid', t);
    var attr = d.body && d.body.getAttribute('data-rtg-world');
    if (WERELDEN.indexOf(attr) >= 0) return veld(attr, 'pagina', 'afgeleid', t);
    return veld(null, 'geen', 'geen', t, 'deze route staat niet in de wereldkaart (shared/rtg-world-identity.js)');
  }

  function contextVan(A, c, t) {
    if (c && c.bron) return veld({ bron: c.bron, titel: c.titel || '', selectie: !!c.selectie },
      'scherm', 'ui', contextSleutel === c.sleutel ? contextGezien : null);
    var e = w.RTGEdge && w.RTGEdge.active;
    if (e && e.ctx && e.ctx.title) return veld({ bron: '', titel: String(e.ctx.title), scope: e.ctx.scope || '' }, 'edge-casco', 'ui', t);
    return veld(d.title ? { bron: '', titel: d.title } : null, 'document', 'ui', t, 'geen titel');
  }

  /* De hoofdactie leest ./blikveld-hoofdactie.js: in de schil kijkt die in het
     ACTIEVE blad (EDGE.md par. 2). Zacht: ontbreekt hij, dan staat het veld leeg
     met die reden en loopt de rest door. */
  function hoofdactie(t, gebreken) {
    var H = w.RTGEdgeBlikveldHoofdactie, h = null;
    try { h = H && typeof H.lees === 'function' ? H.lees(w) : null; } catch (e) { h = null; }
    if (!h) return veld(null, 'geen', 'geen', t, 'de hoofdactielezer (edge/blikveld-hoofdactie.js) is niet geladen');
    Array.prototype.push.apply(gebreken, h.gebreken || []);
    return h.label ? veld({ label: h.label }, h.herkomst, 'ui', t) : veld(null, h.herkomst, 'geen', t, h.reden);
  }

  function voortzetting(snap, t) {
    var G = w.RTGCommandGeheugen, g = null;
    if (G && typeof G.lees === 'function' && d.getElementById('rtgCommand')) { try { g = G.lees(); } catch (e) { g = null; } }
    if (g && g.bladen && g.bladen.length) return veld({ bladen: kopie(g.bladen), actief: g.actief }, 'toestel:werktafel', 'afgeleid', t);
    if (snap && snap.continuation) return veld(snap.continuation, 'edge-signaal', 'ui', t);
    return veld(null, 'geen', 'geen', t, 'er is niets om naar terug te keren, of dit scherm meldt het niet');
  }

  /* De handelingen zoals de balk ze rendert, met hun Edge-stand erbij: de acties
     van de context, anders wat de werktafel aanreikt. */
  function items() {
    var A = adaptief(), lijst = A && A.voorNu ? A.voorNu() : [];
    if (!lijst.length && !(A && A.context().acties.length)) {
      var schil = d.getElementById('rtgCommand');
      lijst = schil && schil.rtgEdgeItems ? schil.rtgEdgeItems() : [];
    }
    var S = w.RTGEdgeActiestaat, gram = w.RTGGrammatica || null;
    return lijst.map(function (it) {
      if (!S) return it;
      var cap = A && A.capability ? A.capability(it.id) : null;
      it.edge = S.bepaal({ id: it.id, gewicht: it.gewicht, verhinderd: it.verhinderd,
        ongedaan: typeof it.ongedaan === 'function', herstel: cap && cap.herstel,
        effect: cap && cap.effect }, gram);
      return it;
    });
  }
  function acties() {
    return items().filter(function (it) { return !it.edge || it.edge.staat !== 'AFWEZIG'; });
  }

  function lees() {
    var t = nu(), gebreken = [], A = adaptief();
    haak(A);
    var c = A ? A.context() : null, snap = core();
    var trust = (c && c.rail && c.rail.length) ? veld(kopie(c.rail), 'scherm:rail', 'ui', contextGezien) :
      veld(null, 'geen', 'geen', t, 'het scherm publiceert geen Trust Rail');
    if (w.navigator && w.navigator.onLine === false) {
      trust = veld([{ sleutel: 'offline', tekst: 'Offline', staat: 'aandacht' }].concat(trust.waarde || []), 'toestel', 'afgeleid', t);
    }
    var gedaan = items().map(function (it) {
      var e = it.edge || {};
      return { id: it.id, naam: it.naam, herkomst: 'RTGAdaptief', staat: e.staat || null, waarom: e.waarom || null,
        gewicht: e.gewicht || it.gewicht || null, bevestiging: e.bevestiging || null, ongedaan: !!e.ongedaan,
        herstel: e.herstel || 'onbekend', gezag: e.gezag || 'onbekend', gevolg: e.gevolg || null, gebreken: e.gebreken || [] };
    });
    /* Het TWEEDE register (registerAction van de balk) staat er ook in, met zijn
       gebrek erbij: allowed:false zonder reden viel daar stil uit de lijst. */
    ((snap && snap.acties) || []).forEach(function (a) {
      var e = w.RTGEdgeActiestaat ? w.RTGEdgeActiestaat.bepaal({ id: a.id,
        verhinderd: a.allowed ? null : { reden: '' } }, w.RTGGrammatica || null) : {};
      gedaan.push({ id: a.id, naam: a.label, herkomst: 'edge-compat', staat: e.staat || null, waarom: e.waarom || null,
        gewicht: e.gewicht || 'licht', bevestiging: e.bevestiging || null, ongedaan: false, herstel: 'onbekend',
        gezag: 'onbekend', gevolg: e.gevolg || null, gebreken: e.gebreken || [] });
    });
    var velden = {
      identiteit: snap && snap.identity ? veld(snap.identity, 'edge-signaal', 'ui', t)
        : veld(null, 'geen', 'geen', t, 'deze laag kent geen sessie, en setIdentity heeft geen producent'),
      wereld: wereld(t),
      context: contextVan(A, c, t),
      object: c && c.object ? veld(kopie(c.object), 'scherm', 'ui', contextGezien)
        : veld(null, 'geen', 'geen', t, 'het scherm publiceert geen object'),
      activiteit: c && c.activiteit ? veld(String(c.activiteit), 'scherm', 'ui', contextGezien)
        : veld(null, 'geen', 'geen', t, 'het scherm publiceert geen activiteit'),
      presence: snap && snap.presence ? veld(snap.presence, 'edge-signaal', 'ui', t)
        : veld(null, 'geen', 'geen', t, 'er loopt niets dat hier wordt gemeld'),
      voortzetting: voortzetting(snap, t),
      hoofdactie: hoofdactie(t, gebreken),
      trust: trust,
      bevoegdheid: veld(null, 'geen', 'geen', t,
        'er is geen route die per principal een oordeel geeft; de Edge verleent zelf niets (EDGE.md)')
    };
    return { versie: 1, op: t, velden: velden, acties: gedaan, gebreken: gebreken };
  }

  return Object.freeze({ lees: lees, acties: acties });
}));
