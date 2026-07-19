/* De ketenchat van de hulpdiensten en de zorg. Drie lagen:

   - Verbinden: korpsen en zorg-zaken nodigen elkaar EENMALIG uit
     (verzoek + akkoord, zoals in het personeelsnetwerk). Daarna zit de
     zaak in het ketennetwerk.
   - Het ketenkanaal: EEN gezamenlijke chat voor alle verbonden zaken
     (politie, ambulance, brandweer, ziekenhuis, huisarts, ...): iedereen
     van die zaken leest en schrijft mee.
   - Deelgroepen: een meldkamer-chef maakt een besloten groep met een
     handjevol mensen uit verschillende korpsen (bijv. twee agenten en een
     verpleegkundige). Alleen de leden schrijven en lezen; de
     meldkamer-chefs van de betrokken korpsen kijken mee (lezen, niet
     schrijven), zodat een besloten lijn nooit een blinde vlek wordt. */

module.exports = ({ db, save, crypto, findSupplier }) => {
  const HULP_ZORG = ['politie', 'brandweer', 'ambulance', 'ziekenhuis', 'huisarts', 'specials', 'apotheek', 'specialist', 'beautymedical', 'defensie'];
  const nu = () => Date.now();
  const schoon = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max || 200);
  const magKeten = s => !!s && HULP_ZORG.includes(s.type);
  function bak() {
    if (!db.data.hulp) db.data.hulp = {};
    const h = db.data.hulp;
    if (!h.keten) h.keten = { links: [], berichten: [], groepen: [] };
    if (!Array.isArray(h.keten.links)) h.keten.links = [];
    if (!Array.isArray(h.keten.berichten)) h.keten.berichten = [];
    if (!Array.isArray(h.keten.groepen)) h.keten.groepen = [];
    return h.keten;
  }
  const linkVan = (a, b) => bak().links.find(l => [l.a, l.b].sort().join('|') === [a, b].sort().join('|'));
  const partnersVan = code => bak().links.filter(l => l.status === 'akkoord' && (l.a === code || l.b === code)).map(l => l.a === code ? l.b : l.a);
  const inKeten = code => partnersVan(code).length > 0;

  /* ---------- eenmalig verbinden ---------- */
  function verzoek(code, naarCode) {
    const van = findSupplier(code), naar = findSupplier(naarCode);
    if (!magKeten(van)) return { status: 403, error: 'Alleen hulpdiensten en zorg-zaken zitten in de keten.' };
    if (!magKeten(naar)) return { status: 404, error: 'Dit korps of deze zorg-zaak kennen we niet.' };
    if (van.code === naar.code) return { status: 400, error: 'Uzelf uitnodigen hoeft niet.' };
    const l = linkVan(van.code, naar.code);
    if (l && l.status === 'akkoord') return { status: 409, error: 'U bent al verbonden.' };
    if (l && l.door !== van.code) { l.status = 'akkoord'; l.beslistAt = nu(); save(); return { ok: true, status: 'akkoord' }; }
    if (l) return { status: 409, error: 'Uw uitnodiging ligt er al; het andere korps beslist.' };
    bak().links.push({ a: van.code, b: naar.code, door: van.code, status: 'wacht', at: nu() });
    save();
    return { ok: true, status: 'wacht' };
  }
  function beslis(code, metCode, akkoord) {
    const l = linkVan(code, metCode);
    if (!l) return { status: 404, error: 'Er ligt geen uitnodiging tussen deze zaken.' };
    if (l.status !== 'wacht') return { status: 409, error: 'Deze uitnodiging is al beslist.' };
    if (l.door === code) return { status: 403, error: 'De uitgenodigde kant beslist.' };
    if (akkoord) { l.status = 'akkoord'; l.beslistAt = nu(); }
    else bak().links.splice(bak().links.indexOf(l), 1);
    save();
    return { ok: true, status: akkoord ? 'akkoord' : 'geweigerd' };
  }

  /* ---------- de deelgroepen ---------- */
  function groepMaak(code, actor, b) {
    const s = findSupplier(code);
    if (!magKeten(s)) return { status: 403, error: 'Alleen hulpdiensten en zorg-zaken maken ketengroepen.' };
    if (!actor || !actor.manager) return { status: 403, error: 'De meldkamer-chef (manager) maakt de groepen.' };
    const naam = schoon(b.naam, 60);
    if (!naam) return { status: 400, error: 'Hoe heet de groep?' };
    const leden = Array.isArray(b.leden) ? b.leden.slice(0, 20) : [];
    const partners = new Set([code, ...partnersVan(code)]);
    const schoonLeden = [];
    for (const l of leden) {
      const lc = String(l.code || '').toUpperCase();
      if (!partners.has(lc)) return { status: 403, error: 'Leden komen uit uw eigen korps of een verbonden korps (' + lc + ' is niet verbonden).' };
      schoonLeden.push({ code: lc, staffId: Number(l.staffId), naam: schoon(l.naam, 40) || 'collega' });
    }
    if (!schoonLeden.some(l => l.code === code && Number(l.staffId) === Number(actor.staffId)))
      schoonLeden.unshift({ code, staffId: Number(actor.staffId), naam: schoon(actor.name, 40) });
    if (schoonLeden.length < 2) return { status: 400, error: 'Een groep heeft minstens twee leden.' };
    const g = {
      id: crypto.randomBytes(4).toString('hex'), naam, leden: schoonLeden,
      korpsen: [...new Set(schoonLeden.map(l => l.code))], door: code, berichten: [], at: nu()
    };
    bak().groepen.push(g);
    if (bak().groepen.length > 200) bak().groepen.shift();
    save();
    return { ok: true, groep: { id: g.id, naam: g.naam, leden: g.leden, korpsen: g.korpsen } };
  }
  const isLid = (g, code, actor) => g.leden.some(l => l.code === code && Number(l.staffId) === Number(actor && actor.staffId));
  // de meldkamer kijkt mee: een manager van een betrokken korps leest, schrijft niet
  const kijktMee = (g, code, actor) => !!(actor && actor.manager && g.korpsen.includes(code));

  /* ---------- lezen en schrijven ---------- */
  function status(s, actor) {
    if (!magKeten(s)) return { status: 403, error: 'Alleen hulpdiensten en zorg-zaken zitten in de keten.' };
    const links = bak().links.filter(l => l.a === s.code || l.b === s.code).map(l => ({
      met: l.a === s.code ? l.b : l.a,
      metNaam: (findSupplier(l.a === s.code ? l.b : l.a) || {}).name || '',
      status: l.status, inkomend: l.status === 'wacht' && l.door !== s.code
    }));
    const kanalen = [];
    if (inKeten(s.code)) kanalen.push({ id: 'keten', naam: 'De keten (alle verbonden korpsen)', soort: 'keten', magSchrijven: true, kijktMee: false });
    for (const g of bak().groepen) {
      if (isLid(g, s.code, actor)) kanalen.push({ id: g.id, naam: g.naam, soort: 'groep', magSchrijven: true, kijktMee: false });
      else if (kijktMee(g, s.code, actor)) kanalen.push({ id: g.id, naam: g.naam + ' (u kijkt mee)', soort: 'groep', magSchrijven: false, kijktMee: true });
    }
    const kandidaten = (db.data.suppliers || []).filter(x => magKeten(x) && x.code !== s.code && !links.some(l => l.met === x.code))
      .map(x => ({ code: x.code, naam: x.name }));
    return { ok: true, eigen: s.code, links, kanalen, kandidaten, partners: partnersVan(s.code) };
  }
  function kanaalVan(id) { return id === 'keten' ? { keten: true, berichten: bak().berichten } : bak().groepen.find(g => g.id === id); }
  function gesprek(s, actor, kanaalId) {
    const k = kanaalVan(String(kanaalId || 'keten'));
    if (!k) return { status: 404, error: 'Dit kanaal bestaat niet.' };
    if (k.keten) {
      if (!inKeten(s.code)) return { status: 403, error: 'Verbind eerst met een ander korps; daarna opent de ketenchat.' };
      return { ok: true, berichten: k.berichten.slice(-60), magSchrijven: true };
    }
    if (isLid(k, s.code, actor)) return { ok: true, berichten: k.berichten.slice(-60), magSchrijven: true };
    if (kijktMee(k, s.code, actor)) return { ok: true, berichten: k.berichten.slice(-60), magSchrijven: false, kijktMee: true };
    return { status: 403, error: 'Deze besloten groep is alleen voor de leden; de meldkamer-chef kijkt mee.' };
  }
  function bericht(s, actor, kanaalId, tekst) {
    const t = schoon(tekst, 500);
    if (!t) return { status: 400, error: 'Typ een bericht.' };
    const k = kanaalVan(String(kanaalId || 'keten'));
    if (!k) return { status: 404, error: 'Dit kanaal bestaat niet.' };
    if (k.keten && !inKeten(s.code)) return { status: 403, error: 'Verbind eerst met een ander korps.' };
    if (!k.keten && !isLid(k, s.code, actor)) return { status: 403, error: 'Alleen de leden schrijven in een besloten groep; de meldkamer kijkt mee.' };
    const m = { van: schoon((actor && actor.name) || 'collega', 40), korps: s.code, korpsNaam: s.name, tekst: t, at: nu() };
    k.berichten.push(m);
    if (k.berichten.length > 300) k.berichten.shift();
    save();
    return { ok: true, bericht: m };
  }

  return { ketenchat: { magKeten, verzoek, beslis, groepMaak, status, gesprek, bericht } };
};
