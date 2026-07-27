/* De Residence, deelbestand "koppel": twee leden wandelen "vast" aan
   elkaar door het huis, zolang ze allebei online zijn. Een verzoek, een
   ja, en vanaf dat moment volgt de een de ander door elke zaal; losmaken
   mag altijd en met een been buiten het huis is het paar vanzelf los.
   Het paar is ook de toestemmingslaag voor de gewaagde directeursvragen
   en de basis voor koppel-tegen-koppel spelen. */
module.exports = (ctx) => {
  const { R, kamer, kamerVan, sein, sseToCustomer, save, zetNeer, zitplek, plattegrond } = ctx;
  const paren = () => (R().paren = R().paren || {});
  const verzoeken = () => (R().paarVerzoek = R().paarVerzoek || {});

  const partnerVan = key => paren()[key] || null;
  function partnerNaam(key) {
    const p2 = partnerVan(key);
    if (!p2) return null;
    const id = kamerVan(p2);
    return id ? (kamer(id).leden[p2] || {}).codenaam || null : null;
  }
  const naamIn = (id, key) => (kamer(id).leden[key] || {}).codenaam;

  function paarVraag(key, body) {
    const id = kamerVan(key);
    if (!id) return { status: 409, error: 'U bent nog geen kamer binnen.' };
    if (partnerVan(key)) return { status: 409, error: 'U wandelt al samen; maak eerst los.' };
    const doel = Object.keys(kamer(id).leden).find(k => kamer(id).leden[k].codenaam === String((body || {}).codenaam || '').trim());
    if (!doel || doel === key) return { status: 404, error: 'Dit lid is hier niet (meer).' };
    if (partnerVan(doel)) return { status: 409, error: 'Dit lid wandelt al met iemand samen.' };
    verzoeken()[doel] = { van: key, at: Date.now() };
    save();
    try { sseToCustomer(doel, 'residentie', { kind: 'paar-verzoek', kamer: id, van: naamIn(id, key) }); } catch (e) {}
    return { status: 200, ok: true };
  }

  function paarAntwoord(key, body) {
    const v = verzoeken()[key];
    if (!v || Date.now() - v.at > 120000) { delete verzoeken()[key]; return { status: 404, error: 'Er is geen verzoek (meer).' }; }
    delete verzoeken()[key];
    const id = kamerVan(key);
    if (!(body || {}).ja) {
      save();
      try { sseToCustomer(v.van, 'residentie', { kind: 'paar-nee', kamer: kamerVan(v.van) }); } catch (e) {}
      return { status: 200, ok: true };
    }
    paren()[key] = v.van; paren()[v.van] = key;
    save();
    if (id) sein(id, 'paar-aan', { a: naamIn(id, v.van), b: naamIn(id, key) });
    return { status: 200, ok: true, paar: naamIn(id || kamerVan(v.van), v.van) };
  }

  function paarLos(key, stil) {
    const p2 = partnerVan(key);
    if (!p2) return { status: 404, error: 'U wandelt niet samen.' };
    const id = kamerVan(key) || kamerVan(p2);
    const namen = { a: id && naamIn(id, key), b: id && naamIn(id, p2) };
    delete paren()[key]; delete paren()[p2];
    save();
    if (id && !stil) sein(id, 'paar-los', namen);
    if (!stil) try { sseToCustomer(p2, 'residentie', { kind: 'paar-los', kamer: kamerVan(p2), a: namen.a, b: namen.b }); } catch (e) {}
    return { status: 200, ok: true };
  }

  /* de partner volgt: bij een stap komt hij op de tegel die u net verliet */
  function volgStap(id, key, oudX, oudY) {
    const p2 = partnerVan(key);
    if (!p2) return;
    const l2 = kamer(id).leden[p2];
    if (!l2 || (l2.dx === oudX && l2.dy === oudY)) return;
    const p = plattegrond(id);
    l2.x = l2.dx; l2.y = l2.dy; l2.dx = oudX; l2.dy = oudY;
    l2.zit = zitplek(p, oudX, oudY); l2.at = Date.now();
    sein(id, 'stap', { codenaam: l2.codenaam, x: l2.x, y: l2.y, dx: oudX, dy: oudY, zit: l2.zit });
  }

  /* de partner wandelt mee een andere kamer in */
  function volgBetreed(nieuwId, key) {
    const p2 = partnerVan(key);
    if (!p2) return;
    const oudId = kamerVan(p2);
    if (!oudId || oudId === nieuwId) return;
    const oud = kamer(oudId).leden[p2];
    delete kamer(oudId).leden[p2];
    sein(oudId, 'weg', { codenaam: oud && oud.codenaam });
    const p = plattegrond(nieuwId);
    if (!p || !oud) return;
    const neer = zetNeer(p, nieuwId, p2, oud.codenaam);
    sein(nieuwId, 'kom', neer, p2);
    // seintje naar de partner zelf: uw scherm wandelt mee (filter op de oude kamer)
    try { sseToCustomer(p2, 'residentie', { kind: 'volg', kamer: oudId, naar: nieuwId }); } catch (e) {}
  }

  // paren die samen in deze kamer staan, voor de gouden draad op het scherm
  function parenIn(id) {
    const uit = [], leden = kamer(id).leden;
    for (const k of Object.keys(leden)) {
      const p2 = paren()[k];
      if (p2 && leden[p2] && k < p2) uit.push([leden[k].codenaam, leden[p2].codenaam]);
    }
    return uit;
  }

  return { partnerVan, partnerNaam, paarVraag, paarAntwoord, paarLos, volgStap, volgBetreed, parenIn };
};
