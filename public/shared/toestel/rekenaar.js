/* DE TOESTELREKENAAR -- de ouderkant van de cel. TOESTEL.md par. 3 en 9.

   Hij krijgt een keuze die ./poorten.js al heeft gemaakt, en doet dan vier
   dingen in deze volgorde:

     1. elk artefact langs de grendel (./manifest.js), MET de bytes en het
        contract: wat niet klopt, gaat niet naar de cel;
     2. een verse cel openen (<iframe sandbox="allow-scripts"> op /toestel/cel);
     3. de bytes als KOPIE overdragen, met een plafond op de rekentijd: daarboven
        wordt de cel afgebroken en is de uitslag "te zwaar", nooit een wachtende
        telefoon;
     4. de uitkomst teruggeven met haar HERKOMST: plaats `toestel`, welke
        uitvoerder, welke artefacten met hun hash en naamsvermelding.

   Wat hij NIET doet: een uitvoerder kiezen (dat deden de poorten), en iets
   naar de server sturen. De herkomst blijft hier; een scherm mag hem tonen.
   In de browser window.RTGToestelRekenaar. */
(function (root) {
  'use strict';
  var CEL = '/toestel/cel';
  var volgnummer = 0;

  function weiger(stap, reden) { return { ok: false, stap: stap, reden: reden }; }

  function openCel(url, wachtMs) {
    return new Promise(function (klaar, faal) {
      var f = document.createElement('iframe');
      f.setAttribute('sandbox', 'allow-scripts'); // GEEN allow-same-origin: dan is de origin ondoorzichtig
      f.setAttribute('allow', ''); // geen camera, microfoon of ander recht: de cel krijgt bytes, geen apparaten
      f.setAttribute('aria-hidden', 'true');
      f.setAttribute('tabindex', '-1');
      f.title = 'RTG toestelcel';
      f.hidden = true;
      var klok = setTimeout(function () { opruimen(); faal(new Error('de toestelcel startte niet')); }, wachtMs);
      function luister(e) {
        if (e.source !== f.contentWindow || !e.data || e.data.soort !== 'klaar') return;
        clearTimeout(klok); removeEventListener('message', luister); klaar(f);
      }
      function opruimen() { removeEventListener('message', luister); if (f.parentNode) f.parentNode.removeChild(f); }
      addEventListener('message', luister);
      f.src = url;
      document.body.appendChild(f);
    });
  }

  async function voer(opdracht) {
    var o = opdracht || {}, c = o.contract || {}, k = o.kandidaat || {};
    var Manifest = root.RTGToestelManifest; // laat gebonden: de laadvolgorde mag niet uitmaken
    if (!Manifest) return weiger('grendel', 'de manifestgrendel is niet geladen; dan wordt niets uitgevoerd');
    if (k.plaats !== 'toestel') return weiger('plaats', 'deze rekenaar voert alleen uit op het toestel');
    var sleutels = o.sleutels || root.RTGToestelSleutels || [];
    var rollen = Object.keys(o.artefacten || {});
    if (!rollen.length) return weiger('grendel', 'er is geen artefact om mee te rekenen');
    var bytes = {}, herkomst = [];
    for (var i = 0; i < rollen.length; i++) {
      var a = o.artefacten[rollen[i]];
      var u = await Manifest.controleer(a && a.regel, { sleutels: sleutels, bytes: a && a.bytes, contract: c.taak });
      if (!u.ok) return weiger(u.stap, rollen[i] + ': ' + u.reden);
      bytes[rollen[i]] = a.bytes.slice(0); // een kopie: de ouder houdt zijn eigen bytes
      herkomst.push({ rol: rollen[i], id: a.regel.id, versie: a.regel.versie, sha256: a.regel.sha256,
        naamsvermelding: u.naamsvermelding, eisen: u.eisen });
    }
    var cel;
    try { cel = await openCel(o.celUrl || CEL, 10000); } catch (e) { return weiger('cel', e.message); }
    var id = 'r' + (++volgnummer), plafond = (c.last && c.last.rekenMaxMs) || 30000;
    return new Promise(function (klaar) {
      function einde(uit) {
        clearTimeout(klok); removeEventListener('message', luister);
        if (cel.parentNode) cel.parentNode.removeChild(cel);
        klaar(uit);
      }
      var klok = setTimeout(function () {
        einde(weiger('last', 'de rekentijd ging over ' + plafond + ' ms; de cel is afgebroken'));
      }, plafond);
      function luister(e) {
        if (e.source !== cel.contentWindow) return;
        var d = e.data || {};
        if (d.soort !== 'uitkomst' || d.id !== id) return;
        if (!d.ok) return einde(weiger('uitvoerder', d.reden || 'de uitvoerder faalde'));
        if (root.RTGToestelMeting) root.RTGToestelMeting.noteer({ taak: c.taak, uitvoerder: d.uitvoerder, rekenMs: d.rekenMs });
        einde({ ok: true, uitkomst: d.uitkomst, herkomst: {
          plaats: 'toestel', uitvoerder: d.uitvoerder, taak: c.taak || null,
          artefacten: herkomst, rekenMs: d.rekenMs, gecontroleerd: true } });
      }
      addEventListener('message', luister);
      var overdracht = rollen.map(function (r) { return bytes[r]; });
      cel.contentWindow.postMessage({ soort: 'reken', id: id, uitvoerder: k.uitvoerder,
        artefacten: bytes, invoer: o.invoer || {} }, '*', overdracht);
    });
  }

  root.RTGToestelRekenaar = Object.freeze({ voer: voer });
}(typeof globalThis !== 'undefined' ? globalThis : this));
