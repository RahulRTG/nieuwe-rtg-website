/* Eenmalige menselijke goedkeuring voor modelvoorstellen.

   Het model krijgt nooit een boolean waarmee het zichzelf kan goedkeuren. Een
   risicovolle tool-aanroep wordt hier server-side vastgezet: exact pad, exact
   JSON-body, rol en de geverifieerde serveridentiteit. Alleen het aparte
   bevestigingsendpoint kan het willekeurige token verbruiken. Het token is
   eenmalig, kort geldig en wordt voor de interne aanroep verwijderd, zodat een
   retry of parallel verzoek dezelfde actie nooit twee keer vrijgeeft. */

const MAX_OPEN = 1000;
const MAX_PER_IDENTITEIT = 8;
const STANDAARD_TTL_MS = 5 * 60 * 1000;
const { nu: klokNu } = require('../../lib/klok');

module.exports = function maakGoedkeuring({ crypto, ttlMs, log }) {
  if (!crypto || typeof crypto.randomBytes !== 'function') throw new Error('crypto is verplicht voor stuurgoedkeuring');
  const open = new Map();
  const ttl = Math.max(30000, Math.min(15 * 60 * 1000, Number(ttlMs) || STANDAARD_TTL_MS));

  function identiteit(req) {
    // `auth`/`supplierAuth` hebben deze velden al uit een geverifieerd token
    // opgebouwd. Een losse Authorization-header is hier bewust nooit bewijs.
    let basis = '';
    if (req && req.session && req.session.key) basis = 'member:' + req.session.key;
    else if (req && req.supplier && req.supplier.code && req.actor) {
      const actor = req.actor.staffId || req.actor.lidKey || req.actor.name;
      if (actor) basis = 'supplier:' + req.supplier.code + ':' + req.actor.role + ':' + actor;
    }
    if (!basis) return null;
    return crypto.createHash('sha256').update(basis).digest('hex');
  }

  function ruim(nu) {
    const t = Number(nu) || klokNu();
    for (const [id, v] of open) if (!v || v.verloopt <= t) open.delete(id);
    while (open.size > MAX_OPEN) open.delete(open.keys().next().value);
  }

  function kopie(body) {
    const tekst = JSON.stringify(body == null ? {} : body);
    return { tekst, body: JSON.parse(tekst) };
  }

  function maak(req, pad, body, wereld) {
    const eigenaar = identiteit(req);
    if (!eigenaar) return { status: 401, error: 'Geen geldige sessie voor menselijke goedkeuring.' };
    ruim();
    const bestaand = [...open.entries()].filter(([, v]) => v.eigenaar === eigenaar);
    while (bestaand.length >= MAX_PER_IDENTITEIT) {
      const [oud] = bestaand.shift();
      open.delete(oud);
    }
    let vast;
    try { vast = kopie(body); }
    catch (e) { return { status: 400, error: 'De voorgestelde actie bevat geen geldige JSON-body.' }; }
    const id = crypto.randomBytes(32).toString('base64url');
    const nu = klokNu();
    const rij = { id, eigenaar, wereld, pad, body: vast.body, gemaakt: nu, verloopt: nu + ttl };
    open.set(id, rij);
    try { if (log && log.info) log.info('stuur-voorstel', { pad, wereld, voorstel: id.slice(0, 10) }); } catch (e) {}
    return {
      id,
      pad,
      body: vast.body,
      verlooptAt: new Date(rij.verloopt).toISOString(),
      samenvatting: (pad + ' ' + vast.tekst).slice(0, 800)
    };
  }

  function neem(req, id, wereld) {
    ruim();
    const sleutel = String(id || '');
    const rij = open.get(sleutel);
    if (!rij) return { status: 404, error: 'Dit voorstel bestaat niet meer of is verlopen.' };
    const eigenaar = identiteit(req);
    if (!eigenaar || eigenaar !== rij.eigenaar || wereld !== rij.wereld)
      return { status: 403, error: 'Dit voorstel hoort niet bij deze sessie en rol.' };
    // Eerst verbruiken, daarna pas uitvoeren: ook een mislukte downstream-call
    // kan niet met hetzelfde akkoord opnieuw worden afgevuurd.
    open.delete(sleutel);
    try { if (log && log.info) log.info('stuur-goedgekeurd', { pad: rij.pad, wereld: rij.wereld, voorstel: sleutel.slice(0, 10) }); } catch (e) {}
    return { status: 200, voorstel: { pad: rij.pad, body: rij.body, wereld: rij.wereld } };
  }

  function aantal() { ruim(); return open.size; }

  return { maak, neem, aantal, ruim, ttlMs: ttl };
};
