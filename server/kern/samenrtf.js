/* Samen voor de RTFoundation: gezinnen en vrienden kijken en doen samen door
   de gezinsapps (de bibliotheken, school, leren, spelen). Zelfde gedachte als
   de leden-Samen, maar kindveilig: een kamer is alleen te betreden door wie
   uit HETZELFDE GEZIN komt of een BEVESTIGDE vriend van de gastheer is (de
   vriendenlaag met kind-goedkeuring bewaakt dat al). Gasten (oppas, opa/oma)
   doen niet mee. Geen SSE nodig: de widget kijkt rustig elke paar seconden
   (geen jaag-gedrag, past bij gezond schermgebruik); kamers verlopen na zes
   uur stilte. Alleen plekken binnen de gezinsapps. */

module.exports = ({ db, save, crypto, schoon, zijnVrienden }) => {
  const UUR = 3600000;
  const K = () => {
    if (!db.data.samenRtfKamers || typeof db.data.samenRtfKamers !== 'object') db.data.samenRtfKamers = {};
    return db.data.samenRtfKamers;
  };
  const pub = (k) => ({ code: k.code, gastheer: k.gastheerNaam, leden: k.leden.map(l => l.codenaam),
    pad: k.pad, titel: k.titel, door: k.door || null, volg: k.volg || 0, chat: k.chat.slice(-30), at: k.at });
  const vind = (code) => K()[String(code || '').toUpperCase().slice(0, 8)] || null;
  const lidVan = (k, handle) => k.leden.find(l => l.handle === handle) || null;
  const schoonPad = (p) => { p = String(p || '').slice(0, 200); return p.startsWith('/apps/foundation/') ? p : null; };

  function ruimOp() {
    const nu = Date.now();
    for (const c of Object.keys(K())) if (nu - (K()[c].at || 0) > 6 * UUR) delete K()[c];
  }

  function maak(sess) {
    ruimOp();
    if (Object.keys(K()).length >= 5000) return { status: 503, error: 'Alle samen-kamers zijn even bezet; probeer het zo weer.' };
    let code;
    do { code = crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase(); } while (K()[code]);
    K()[code] = { code, gastheer: sess.handle, gastheerGezin: sess.g.code, gastheerNaam: sess.codenaam,
      leden: [{ handle: sess.handle, gezin: sess.g.code, codenaam: sess.codenaam }],
      pad: null, titel: null, door: null, volg: 0, chat: [], at: Date.now() };
    save();
    return { status: 200, ok: true, kamer: pub(K()[code]) };
  }

  function doeMee(sess, code) {
    const k = vind(code);
    if (!k) return { status: 404, error: 'Deze samen-code bestaat niet (meer).' };
    if (!lidVan(k, sess.handle)) {
      // de kindveilige poort: zelfde gezin, of een bevestigde vriend van de gastheer
      const zelfdeGezin = sess.g.code === k.gastheerGezin;
      let vriend = false;
      try { vriend = !!(zijnVrienden && zijnVrienden(sess.handle, k.gastheer)); } catch (e) {}
      if (!zelfdeGezin && !vriend) return { status: 403, error: 'Samen is voor je gezin en je bevestigde vrienden. Vraag eerst een vriendschapsverzoek aan.' };
      if (k.leden.length >= 12) return { status: 400, error: 'Deze kamer zit vol (12 personen).' };
      k.leden.push({ handle: sess.handle, gezin: sess.g.code, codenaam: sess.codenaam });
      k.at = Date.now(); save();
    }
    return { status: 200, ok: true, kamer: pub(k) };
  }

  /* "Kijk hier": volg is een tellertje zodat de pollende widget een nieuwe
     bestemming herkent zonder klokvergelijking. */
  function zet(sess, code, pad, titel) {
    const k = vind(code);
    if (!k) return { status: 404, error: 'Deze samen-code bestaat niet (meer).' };
    const lid = lidVan(k, sess.handle);
    if (!lid) return { status: 403, error: 'Je zit niet (meer) in deze kamer.' };
    const p = schoonPad(pad);
    if (!p) return { status: 400, error: 'Dat is geen plek binnen de gezinsapps.' };
    k.pad = p; k.titel = schoon(titel, 80) || null; k.door = lid.codenaam;
    k.volg = (k.volg || 0) + 1; k.at = Date.now(); save();
    return { status: 200, ok: true, kamer: pub(k) };
  }

  function chat(sess, code, tekst) {
    const k = vind(code);
    if (!k) return { status: 404, error: 'Deze samen-code bestaat niet (meer).' };
    const lid = lidVan(k, sess.handle);
    if (!lid) return { status: 403, error: 'Je zit niet (meer) in deze kamer.' };
    const t = schoon(tekst, 300);
    if (!t) return { status: 400, error: 'Zeg iets.' };
    k.chat.push({ van: lid.codenaam, tekst: t, at: Date.now() });
    if (k.chat.length > 100) k.chat.shift();
    k.volg = (k.volg || 0) + 1; k.at = Date.now(); save();
    return { status: 200, ok: true };
  }

  function weg(sess, code) {
    const k = vind(code);
    if (!k) return { status: 200, ok: true };
    if (lidVan(k, sess.handle)) {
      k.leden = k.leden.filter(l => l.handle !== sess.handle);
      if (!k.leden.length) delete K()[k.code];
      else { k.volg = (k.volg || 0) + 1; }
      save();
    }
    return { status: 200, ok: true };
  }

  function staat(sess, code) {
    const k = vind(code);
    if (!k) return { status: 404, error: 'Deze samen-code bestaat niet (meer).' };
    if (!lidVan(k, sess.handle)) return { status: 403, error: 'Je zit niet (meer) in deze kamer.' };
    return { status: 200, ok: true, kamer: pub(k) };
  }

  return { samenRtf: { maak, doeMee, zet, chat, weg, staat, ruimOp } };
};
