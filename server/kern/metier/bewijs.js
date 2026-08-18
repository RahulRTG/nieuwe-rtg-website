/* Métier (deelmodule): de naam vrijgeven, en hem weer intrekken.

   Dit is het hart van het ontwerp, dus de regels staan hier expliciet:

   1. DE NAAM WORDT NOOIT GEKOPIEERD. In db.data staat alleen een TOESTEMMING:
      "lid X heeft zaak Y toegang tot zijn naam gegeven, op deze datum". De naam
      zelf blijft in de gescheiden kluis (accounts.js) en wordt pas op het moment
      van kijken opgehaald. Trekt het lid de toestemming in, dan is er niets meer
      te lezen -- er ligt namelijk nergens een kopie.
   2. PER WERKGEVER, NIET AAN DE WERELD. Een toestemming staat op een zaak-code.
      Andere werkgevers zien niets, ook niet als ze dezelfde vacature hebben.
   3. ELKE INZAGE WORDT GELOGD, EN HET LID ZIET DAT LOG. Niet alleen het kantoor:
      juist de persoon zelf. Wie keek, wanneer, en of hij toen nog mocht.
   4. INTREKKEN KAN ALTIJD, ZONDER REDEN, EN WERKT DIRECT.

   Wat RTG WEL bevestigt zonder dat je naam eraan hangt, staat in index.js: een
   dienstverband dat via de sleutelbos met een PIN is aangetoond. Dat is de
   omkering waar het hier om gaat -- de bevestiging is hard, de naam blijft jouw
   keuze. Op de gewone netwerken is het precies andersom. */
const { idVanKey } = require('../../lib/lidsleutel');

module.exports = ({ db, save, accounts, codenaamVan, keyVanCodenaam, findSupplier, notifySupplier, notify }) => {
  const LOG_MAX = 200;
  const nu = () => new Date().toISOString();
  const metier = () => {
    if (!db.data.metier || typeof db.data.metier !== 'object') db.data.metier = {};
    const m = db.data.metier;
    for (const k of ['naamvrij', 'inzagelog']) if (!m[k] || typeof m[k] !== 'object') m[k] = {};
    return m;
  };
  const codeVan = (x) => String(x || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);

  /* Vrijgeven aan een zaak. Bewust een handeling met een reden erbij: het lid
     schrijft zelf waarom ("sollicitatie sommelier"), zodat het later in zijn
     eigen overzicht te herkennen is. */
  function geefVrij(mijnKey, code, waarvoor) {
    const m = metier();
    const c = codeVan(code);
    if (!c) return { error: 'Welke zaak?' };
    if (findSupplier && !findSupplier(c)) return { error: 'Deze zaak kennen we niet.' };
    const lijst = m.naamvrij[mijnKey] = Array.isArray(m.naamvrij[mijnKey]) ? m.naamvrij[mijnKey] : [];
    const bestaand = lijst.find(g => g.code === c && !g.ingetrokken);
    if (bestaand) return { ok: true, al: true, toestemming: publiekeToestemming(bestaand) };
    const g = { code: c, waarvoor: String(waarvoor || '').slice(0, 120).trim(), at: nu(), ingetrokken: null };
    lijst.unshift(g);
    if (lijst.length > 50) lijst.length = 50;
    save();
    try {
      if (notifySupplier) notifySupplier(c, 'Een lid gaf u inzage in zijn naam voor een sollicitatie.');
    } catch (e) {}
    return { ok: true, toestemming: publiekeToestemming(g) };
  }

  function trekIn(mijnKey, code) {
    const m = metier();
    const c = codeVan(code);
    const lijst = m.naamvrij[mijnKey] || [];
    const g = lijst.find(x => x.code === c && !x.ingetrokken);
    if (!g) return { error: 'Deze zaak heeft geen inzage.' };
    g.ingetrokken = nu();
    save();
    return { ok: true, toestemming: publiekeToestemming(g) };
  }

  const publiekeToestemming = (g) => {
    const s = findSupplier ? findSupplier(g.code) : null;
    return { code: g.code, zaak: (s && s.name) || g.code, waarvoor: g.waarvoor || null,
      at: g.at, ingetrokken: g.ingetrokken || null, actief: !g.ingetrokken };
  };

  // Wat ik zelf heb weggegeven, met wanneer en aan wie. Het spiegelbeeld van de
  // knop: geen toestemming zonder overzicht.
  function mijnToestemmingen(mijnKey) {
    const m = metier();
    return {
      ok: true,
      toestemmingen: (m.naamvrij[mijnKey] || []).map(publiekeToestemming),
      inzage: (m.inzagelog[mijnKey] || []).slice(0, 50)
    };
  }

  const magKijken = (mijnKey, code) => {
    const m = metier();
    return (m.naamvrij[mijnKey] || []).some(g => g.code === codeVan(code) && !g.ingetrokken);
  };

  function logInzage(mijnKey, code, gelukt) {
    const m = metier();
    const lijst = m.inzagelog[mijnKey] = Array.isArray(m.inzagelog[mijnKey]) ? m.inzagelog[mijnKey] : [];
    const s = findSupplier ? findSupplier(code) : null;
    lijst.unshift({ zaak: (s && s.name) || codeVan(code), code: codeVan(code), at: nu(), gelukt: !!gelukt });
    if (lijst.length > LOG_MAX) lijst.length = LOG_MAX;
    save();
  }

  /* De werkgeverskant: een zaak vraagt de naam achter een codenaam. Lukt alleen
     met een geldige toestemming, en het lid krijgt er een seintje van -- inzage
     is een gebeurtenis, niet een stille lookup. De naam komt live uit de kluis;
     hier blijft niets achter. */
  async function naamVoorZaak(code, codenaam) {
    const c = codeVan(code);
    const tref = keyVanCodenaam ? await keyVanCodenaam(String(codenaam || '').trim()) : null;
    if (!tref || !tref.key) return { status: 404, error: 'Geen lid met deze codenaam.' };
    if (!magKijken(tref.key, c)) {
      logInzage(tref.key, c, false);
      return { status: 403, error: 'Dit lid heeft u geen inzage in zijn naam gegeven. Vraag het hem in het gesprek; hij geeft het zelf vrij.' };
    }
    const lidId = idVanKey(tref.key);
    const u = lidId != null && accounts ? accounts.getUserById(lidId) : null;
    if (!u) {
      logInzage(tref.key, c, false);
      return { status: 404, error: 'Bij deze codenaam hoort geen accountdossier.' };
    }
    logInzage(tref.key, c, true);
    try { if (notify) notify(tref.key, 'Een werkgever bekeek je naam in Métier.'); } catch (e) {}
    return { status: 200, ok: true, codenaam: tref.codename || codenaamVan(tref.key), naam: accounts.realNameOf(u) };
  }

  return { geefVrij, trekIn, mijnToestemmingen, magKijken, naamVoorZaak, publiekeToestemming };
};
