/* De Wacht, taak 4: de raadkamer.

   Hier zit de belangrijkste grens van deze hele module. De AI KAUWT alles uit
   en doet VOORSTELLEN, maar voert niets zelf uit. Een gemachtigde in de
   boardroom beslist per voorstel: ACCEPTEREN, AFWIJZEN of INCONCLAAF (napraten
   met de AI).

   En zelfs bij "accepteren" draait alleen een actie uit een vaste, veilige
   lijst: quarantaine, vrijgeven, opruimen, een bekende zekering, een drempel,
   de lastafworp. Nooit willekeurige code. Zo blijft de mens de baas en kan de
   AI het systeem niet stiekem herschrijven. Die lijst staat in staat.js en
   hoort kort te blijven; elke uitbreiding is een stukje zeggenschap dat je
   weggeeft.

   Het uitkauwen zelf werkt ook zonder API-sleutel: een deterministische
   heuristiek, net als de rest van het platform. Een echte-AI-laag mag de tekst
   later verrijken, maar de beslissing verandert er niet door. */
const crypto = require('crypto');
const { TOEGESTAAN, RAAD_MAX, OUD_BESLUIT_MS, AANVAL_DREMPEL, LASTAFWORP_MS } = require('./staat');

module.exports = (kamer) => {
  const { db, save, lees, W } = kamer;

  // Voer een voorstel-actie uit, maar ALLEEN als hij in de veilige lijst staat.
  function voerUit(actie) {
    if (!actie || !TOEGESTAAN.has(actie.soort)) {
      return { ok: false, uitleg: 'Onbekende of niet-toegestane actie; er is niets uitgevoerd.' };
    }
    if (actie.soort === 'quarantaine') {
      kamer.isoleer(actie.bron, actie.reden);
      return { ok: true, uitleg: 'Bron ' + actie.bron + ' in quarantaine gezet.' };
    }
    if (actie.soort === 'vrij') {
      const had = kamer.vrij(actie.bron);
      return { ok: true, uitleg: had ? 'Bron vrijgegeven.' : 'Bron stond niet in quarantaine.' };
    }
    if (actie.soort === 'hygiene') {
      const r = kamer.opruimen();
      return { ok: true, uitleg: 'Opgeruimd: ' + r.opgeruimd + ' item(s).' };
    }
    if (actie.soort === 'zekering') {
      const z = db.data.techniek && db.data.techniek.zekeringen && db.data.techniek.zekeringen[actie.id];
      if (!z) return { ok: false, uitleg: 'Onbekende zekering; niets gedaan.' };
      z.aan = !!actie.aan;
      z.reden = actie.aan ? null : 'via raadkamer';
      z.sindsGesprongen = actie.aan ? null : Date.now();
      z.tot = null;   // de raadkamer besluit; een besluit is niet tijdgebonden
      save();
      return { ok: true, uitleg: 'Zekering "' + actie.id + '" ' + (actie.aan ? 'er weer in' : 'eruit') + '.' };
    }
    if (actie.soort === 'drempel') {
      const w = W();
      w.drempels[String(actie.sleutel || '').slice(0, 40)] = Number(actie.waarde) || 0;
      save();
      return { ok: true, uitleg: 'Drempel ' + actie.sleutel + ' = ' + (Number(actie.waarde) || 0) + '.' };
    }
    if (actie.soort === 'lastafworp') {
      const w = W(); const la = w.lastafworp;
      la.actief = !!actie.aan;
      if (!la.actief) { la.tot = null; la.reden = 'handmatig opgeheven'; }
      else { la.sinds = Date.now(); la.tot = Date.now() + LASTAFWORP_MS; la.reden = la.reden || 'handmatig aangezet'; }
      save();
      return { ok: true, uitleg: la.actief ? 'Lastafworp weer actief (503 kom-zo-terug).' : 'Lastafworp opgeheven; verkeer weer toegelaten.' };
    }
    return { ok: false, uitleg: 'Niets uitgevoerd.' };
  }

  /* De AI (of het bord) legt een voorstel neer. Voert NIETS uit; dat gebeurt
     pas als een gemachtigde het accepteert. */
  function voorstel({ soort, titel, uitleg, actie }) {
    const w = W();
    const v = {
      id: crypto.randomBytes(4).toString('hex'),
      soort: soort || 'advies',
      titel: String(titel || 'Voorstel').slice(0, 120),
      uitleg: String(uitleg || '').slice(0, 600),
      actie: actie && TOEGESTAAN.has(actie.soort) ? actie : null,
      status: 'open',
      at: new Date().toISOString(), atMs: Date.now(),
      overleg: []
    };
    w.raad.unshift(v);
    if (w.raad.length > RAAD_MAX) w.raad.length = RAAD_MAX;
    save();
    return v;
  }

  // De boardroom-gemachtigde beslist: accepteren, afwijzen of inconclaaf.
  function beslis(id, verdict, notitie, wie) {
    const w = W();
    const v = w.raad.find(x => x.id === id);
    if (!v) return { ok: false, error: 'Onbekend voorstel.' };
    const note = (t) => {
      if (t) v.overleg.push({ door: wie || 'eigenaar', tekst: String(t).slice(0, 400), at: new Date().toISOString() });
    };
    if (verdict === 'accepteren') {
      const r = v.actie ? voerUit(v.actie) : { ok: true, uitleg: 'Geen actie gekoppeld; genoteerd als akkoord.' };
      v.status = 'geaccepteerd'; v.resultaat = r.uitleg; v.beslistOp = Date.now(); v.beslistDoor = wie || null;
      note(notitie); save();
      return { ok: true, status: v.status, resultaat: r.uitleg, uitgevoerd: r.ok };
    }
    if (verdict === 'afwijzen') {
      v.status = 'afgewezen'; v.beslistOp = Date.now(); v.beslistDoor = wie || null;
      note(notitie); save();
      return { ok: true, status: v.status };
    }
    if (verdict === 'inconclaaf') {
      v.status = 'inconclaaf';
      note(notitie || 'Napraten met de AI.'); save();
      return { ok: true, status: v.status };
    }
    return { ok: false, error: 'Verdict moet accepteren, afwijzen of inconclaaf zijn.' };
  }

  /* Het uitkauwen: uit de live-signalen concrete voorstellen afleiden. Maakt
     nooit dubbele open voorstellen voor dezelfde bron of actie, anders loopt
     het bord vol met hetzelfde advies en kijkt niemand er meer naar. */
  function analyseer() {
    const w = W(); const nu = Date.now(); const gemaakt = [];
    // A. Verdachte bronnen (herhaalde aanvalstreffers) die nog niet zijn afgesneden.
    for (const s of (lees.verdachteBronnen() || [])) {
      if (!s || !s.bron || kamer.inQuarantaine(s.bron) || (s.treffers || 0) < AANVAL_DREMPEL) continue;
      if (w.raad.some(v => v.status === 'open' && v.actie && v.actie.soort === 'quarantaine' && v.actie.bron === s.bron)) continue;
      gemaakt.push(voorstel({
        soort: 'afweer', titel: 'Indringer afsnijden: ' + s.bron,
        uitleg: 'Deze bron gaf ' + s.treffers + ' aanvals-/WAF-treffers. Voorstel: in quarantaine zetten zodat al het verkeer wordt afgesneden.',
        actie: { soort: 'quarantaine', bron: s.bron, reden: 'herhaalde aanvalstreffers (' + s.treffers + ')' }
      }));
    }
    // B. Zelf opruimen als er verlopen quarantaines of oude besluiten liggen.
    const verlopen = Object.values(w.quarantaine).filter(q => q.tot && q.tot <= nu).length;
    const oud = w.raad.filter(v => ['geaccepteerd', 'afgewezen'].includes(v.status) && v.beslistOp && (nu - v.beslistOp) > OUD_BESLUIT_MS).length;
    if ((verlopen + oud) > 0 && !w.raad.some(v => v.status === 'open' && v.actie && v.actie.soort === 'hygiene')) {
      gemaakt.push(voorstel({
        soort: 'hygiene', titel: 'Zelf opruimen',
        uitleg: 'Er staan ' + verlopen + ' verlopen quarantaine(s) en ' + oud + ' oude besluiten klaar om op te ruimen.',
        actie: { soort: 'hygiene' }
      }));
    }
    return gemaakt;
  }

  return { voerUit, voorstel, beslis, analyseer };
};
