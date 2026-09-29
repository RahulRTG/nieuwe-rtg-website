/* Persoonlijke gezinsuitnodigingen. Een gezinscode is een adres, geen bewijs
   dat iemand familie is. Daarom koppelen volwassenen en gasten met een
   eenmalige CSPRNG-sleutel: de beheerder nodigt uit, de ontvanger accepteert.
   Alleen de hash ligt in de database; de sleutel verloopt na 48 uur. Het
   INWISSELEN is een atomaire claim (./gezinsclaim.js): een uitnodiging levert
   precies een profiel op, ook bij twee tikken of twee instances tegelijk. */
module.exports = (ctx) => {
  const { router, G, save, nu, rid, schoon, crypto, gezinVan, beheerderVan,
    profielVan, tokenUit, hashPin, checkPin, geldigePin, schoonAvatar,
    schoonKleur, ensureCodenaam, pubProfiel, pubGezin, teVaak,
    misluktePoging, goedePoging, ipVan, gezinstoken, bewerkCollectie } = ctx;
  const claimer = require('./gezinsclaim').maak({ bewerkCollectie, crypto, tokens: gezinstoken, nu, rid, ensureCodenaam });
  const ROLLEN = ['ouder', 'gezinslid', 'gast'];
  const DUUR = 48 * 60 * 60 * 1000;
  const hash = waarde => crypto.createHash('sha256').update(String(waarde || '')).digest('hex');
  const gelijk = (a, b) => {
    const x = Buffer.from(String(a || ''), 'hex'), y = Buffer.from(String(b || ''), 'hex');
    return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
  };
  const verloop = () => new Date(Date.parse(nu()) + DUUR).toISOString();
  const verlopen = u => !u || u.status !== 'open' || Date.parse(u.verlooptAt) <= Date.parse(nu());
  const rolNaam = rol => ({ ouder:'Ouder of verzorger', gezinslid:'Gezinslid', gast:'Oppas of familie met beperkte toegang' }[rol] || rol);

  function leesSleutel(waarde) {
    let v = String(waarde || '').trim();
    const mark = v.indexOf('#familie=');
    if (mark >= 0) { try { v = decodeURIComponent(v.slice(mark + 9)); } catch (e) { return null; } }
    const m = /^([A-Z0-9]{6})\.([A-Za-z0-9_-]{30,60})$/.exec(v);
    return m ? { code:m[1], geheim:m[2] } : null;
  }
  function zoek(waarde) {
    const s = leesSleutel(waarde); if (!s) return null;
    const g = G()[s.code]; if (!g) return null;
    const h = hash(s.geheim);
    const u = (g.uitnodigingen || []).find(x => gelijk(x.sleutelHash, h));
    return u ? { g, u } : null;
  }
  function publiek(g, u) {
    return { gezinNaam:g.naam, naam:u.naam, rol:u.rol, rolNaam:rolNaam(u.rol),
      relatie:u.relatie || '', verlooptAt:u.verlooptAt, gezagVerklaard:!!u.gezagVerklaard };
  }
  async function pinBestaat(g, pin) {
    for (const p of Object.values(g.profielen || {})) if (p.pin && await checkPin(p.pin, pin)) return true;
    return false;
  }
  /* De claim zelf; een mislukking van de opslag is een storing en geen 'ongeldig'. */
  async function claim(sleutel, opties) {
    try { return await claimer.claim(Object.assign({ code:sleutel.code, geheim:sleutel.geheim }, opties)); }
    catch (e) { return { status:503 }; }
  }
  const nieuw = uit => { const g = G()[uit.code]; return { g, p:g && g.profielen[uit.profielId] }; };

  function maak(req, res) {
    const g = gezinVan(req, res); if (!g) return;
    const beheerder = beheerderVan(g, req, res); if (!beheerder) return;
    const naam = schoon(req.body.naam, 40), rol = ROLLEN.includes(req.body.rol) ? req.body.rol : '';
    const relatie = schoon(req.body.relatie, 40);
    if (!naam || !rol) return res.status(400).json({ error:'Kies wie u uitnodigt en met welke rol.' });
    if (rol === 'ouder' && req.body.gezagVerklaard !== true)
      return res.status(400).json({ error:'Bevestig dat deze persoon als ouder of verzorger toegang mag krijgen. Dit is geen officiële gezagscontrole.' });
    g.uitnodigingen = g.uitnodigingen || [];
    const open = g.uitnodigingen.filter(x => !verlopen(x));
    if (open.length >= 20) return res.status(429).json({ error:'Er staan al 20 uitnodigingen open. Trek eerst een oude uitnodiging in.' });
    if (open.some(x => x.naam.toLowerCase() === naam.toLowerCase() && x.rol === rol))
      return res.status(409).json({ error:'Voor deze persoon staat al een uitnodiging open.' });
    const geheim = crypto.randomBytes(24).toString('base64url');
    const u = { id:rid(6), naam, rol, relatie, status:'open', sleutelHash:hash(geheim),
      gemaaktDoor:beheerder.id, gemaaktAt:nu(), verlooptAt:verloop(),
      gezagVerklaard:rol === 'ouder' && req.body.gezagVerklaard === true };
    g.uitnodigingen.unshift(u); g.uitnodigingen = g.uitnodigingen.slice(0, 100); save();
    res.json({ ok:true, uitnodiging:g.code + '.' + geheim, id:u.id, ...publiek(g, u) });
  }
  function lijst(req, res) {
    const g = gezinVan(req, res); if (!g) return;
    if (!beheerderVan(g, req, res)) return;
    const uitnodigingen = (g.uitnodigingen || []).map(u => ({ id:u.id, naam:u.naam,
      rol:u.rol, rolNaam:rolNaam(u.rol), relatie:u.relatie || '',
      status:verlopen(u) && u.status === 'open' ? 'verlopen' : u.status,
      gemaaktAt:u.gemaaktAt, verlooptAt:u.verlooptAt, geaccepteerdAt:u.geaccepteerdAt || null }));
    res.json({ uitnodigingen });
  }
  function intrek(req, res) {
    const g = gezinVan(req, res); if (!g) return;
    if (!beheerderVan(g, req, res)) return;
    const u = (g.uitnodigingen || []).find(x => x.id === String(req.body.id || ''));
    if (!u) return res.status(404).json({ error:'Uitnodiging niet gevonden.' });
    if (u.status !== 'open') return res.status(409).json({ error:'Deze uitnodiging is niet meer open.' });
    u.status = 'ingetrokken'; u.ingetrokkenAt = nu(); delete u.sleutelHash; save();
    res.json({ ok:true });
  }
  function bekijk(req, res) {
    const bucket = 'gezin-uitnodiging:' + ipVan(req);
    if (teVaak(res, bucket)) return;
    const r = zoek(req.body.uitnodiging);
    if (!r || verlopen(r.u)) { misluktePoging(bucket, 8, 15); return res.status(404).json({ error:'Deze uitnodiging bestaat niet, is gebruikt of is verlopen.' }); }
    goedePoging(bucket); res.json({ uitnodiging:publiek(r.g, r.u) });
  }
  async function accepteer(req, res) {
    const bucket = 'gezin-accepteer:' + ipVan(req);
    if (teVaak(res, bucket)) return;
    const r = zoek(req.body.uitnodiging);
    if (!r || verlopen(r.u)) { misluktePoging(bucket, 6, 15); return res.status(404).json({ error:'Deze uitnodiging bestaat niet, is gebruikt of is verlopen.' }); }
    if (req.body.akkoord !== true || req.body.privacyAkkoord !== true)
      return res.status(400).json({ error:'Accepteer de gezinskoppeling en de privacy-uitleg.' });
    if (!geldigePin(req.body.pin)) return res.status(400).json({ error:'Kies uw eigen pincode van 4 tot 6 cijfers.' });
    if (await pinBestaat(r.g, req.body.pin)) return res.status(409).json({ error:'Kies een andere pincode dan de andere gezinsleden.' });
    const pin = await hashPin(req.body.pin);
    const uit = await claim(leesSleutel(req.body.uitnodiging), { metSessie:true,
      profiel:{ avatar:schoonAvatar(req.body.avatar), kleur:schoonKleur(req.body.kleur), pin } });
    if (uit.status === 503) return res.status(503).json({ error:'De uitnodiging kon nu niet worden verwerkt. Probeer het zo opnieuw.' });
    if (!uit.ok) { misluktePoging(bucket, 6, 15); return res.status(404).json({ error:'Deze uitnodiging bestaat niet, is gebruikt of is verlopen.' }); }
    goedePoging(bucket);
    const { g, p } = nieuw(uit);
    try { ctx.welkomRtf(ensureCodenaam(p)); } catch (e) {}
    res.json({ ok:true, code:uit.code, token:uit.token, profiel:pubProfiel(p), gezin:pubGezin(g) });
  }
  async function accepteerGast({ uitnodiging, userId, tier, codenaam }) {
    const s = leesSleutel(uitnodiging);
    if (!s) return { error:'Deze uitnodiging bestaat niet, is gebruikt of is verlopen.', status:404 };
    const tierNaam = { rtg:'RTG Pass', lifestyle:'Lifestyle Pass', business:'Business Pass' }[tier] || 'RTG Pass';
    const uit = await claim(s, { alleenGast:true, profiel:{ avatar:schoonAvatar(''), kleur:schoonKleur(''),
      koppel:{ userId, tier, tierNaam, codenaam:codenaam || 'lid', at:nu() } } });
    if (uit.status === 503) return { error:'De uitnodiging kon nu niet worden verwerkt. Probeer het zo opnieuw.', status:503 };
    if (uit.status === 409) return { error:'Open deze uitnodiging in FOUNDATION en kies daar uw eigen pincode.', status:409 };
    if (!uit.ok) return { error:'Deze uitnodiging bestaat niet, is gebruikt of is verlopen.', status:404 };
    const { g, p } = nieuw(uit);
    return { ok:true, gezinNaam:g.naam, profielNaam:p.naam, tierNaam };
  }

  router.post('/gezin/uitnodiging/maak', maak);
  router.post('/gezin/uitnodigingen', lijst);
  router.post('/gezin/uitnodiging/intrek', intrek);
  router.post('/gezin/uitnodiging/bekijk', bekijk);
  router.post('/gezin/uitnodiging/accepteer', accepteer);
  return { accepteerGast };
};
