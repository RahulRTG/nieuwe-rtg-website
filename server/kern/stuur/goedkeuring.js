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

  /* ---- INTREKKEN: een klaargezet voorstel voor uitvoering laten vervallen ----

     HET BESLUIT VAN DE EIGENAAR (13 september 2026): wie iets kan laten
     klaarzetten, moet het ook conversationeel weer kunnen terugtrekken. "Toch
     niet", "laat maar", "annuleer dat voorstel". Dat maakt de bediening
     symmetrisch, en het is nadrukkelijk GEEN annulering van een handeling die
     al is uitgevoerd.

     DAT LAATSTE IS HIER STRUCTUREEL EN GEEN REGEL. `neem()` verwijdert de rij
     VOOR de uitvoering; wat is uitgevoerd staat dus niet meer in `open`. Er is
     daarom geen tak nodig die "al uitgevoerd" afvangt -- die toestand kan deze
     functie niet zien, en dat is precies goed.

     ER IS GEEN ID-INGANG, en dat is de scherpste keuze van dit blok. De
     eigenaar stelde de eis "alleen bij precies EEN eenduidig, nog geldig
     voorstel; anders verduidelijken". Zou deze functie een id aannemen, dan is
     die eis een regel die de aanroeper kan overslaan -- en de aanroeper is hier
     een interpretatielaag. Nu kan hij niet gehoorzamen of ongehoorzaam zijn: bij
     twee open voorstellen IS er niets om aan te wijzen.

     EN DE ID GAAT NOOIT MEE NAAR BUITEN. Het token is de sleutel waarmee het
     bevestigingsendpoint een handeling vrijgeeft (zie de kop van dit bestand).
     Een lijst met ids in een gespreksantwoord zetten is die sleutel uitdelen aan
     de laag die hem juist niet mag hebben. Wat er teruggaat is het PAD en een
     korte samenvatting -- genoeg voor een mens om te zeggen welke hij bedoelt,
     te weinig om er iets mee vrij te geven. */
  function samenvatten(rij) {
    let tekst = '';
    try { tekst = JSON.stringify(rij.body == null ? {} : rij.body); } catch (e) { tekst = ''; }
    return {
      pad: rij.pad,
      verlooptAt: new Date(rij.verloopt).toISOString(),
      samenvatting: (rij.pad + ' ' + tekst).slice(0, 800)
    };
  }

  /* Wat er van DEZE mens in DEZE wereld nog openstaat. Beide filters horen
     erbij: de eigenaar houdt het bij zichzelf, de wereld houdt een lid-voorstel
     en een zaak-voorstel uit elkaar -- dezelfde twee die `neem()` ook eist. */
  function mijne(req, wereld) {
    ruim();
    const eigenaar = identiteit(req);
    if (!eigenaar) return [];
    return [...open.values()].filter((v) => v.eigenaar === eigenaar && v.wereld === wereld);
  }

  function trekEnige(req, wereld) {
    if (!identiteit(req)) return { status: 401, error: 'Geen geldige sessie om een voorstel in te trekken.' };
    const rijen = mijne(req, wereld);
    /* "IK ZIE ER GEEN" EN NIET "ER IS ER GEEN". De voorstellen leven in het
       geheugen van dit proces; een voorstel dat op een andere werker is
       gemaakt, is hier onzichtbaar. Beweren dat er niets klaarstond is dan
       onwaar, en juist bij intrekken is dat de verkeerde geruststelling. */
    if (!rijen.length)
      return { status: 404, aantal: 0,
        error: 'Ik zie geen voorstel van jou dat nog openstaat. Mogelijk is het al bevestigd, ' +
          'verlopen, of op een ander scherm klaargezet.' };
    if (rijen.length > 1)
      return { status: 409, aantal: rijen.length, voorstellen: rijen.map(samenvatten),
        error: 'Er staan er ' + rijen.length + ' open. Zeg welke ik moet laten vervallen.' };
    const rij = rijen[0];
    open.delete(rij.id);
    try { if (log && log.info) log.info('stuur-ingetrokken', { pad: rij.pad, wereld: rij.wereld, voorstel: rij.id.slice(0, 10) }); } catch (e) {}
    return { status: 200, aantal: 1, ingetrokken: samenvatten(rij) };
  }

  return { maak, neem, aantal, ruim, mijne, trekEnige, ttlMs: ttl };
};
