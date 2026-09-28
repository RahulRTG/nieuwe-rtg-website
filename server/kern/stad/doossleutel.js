/* RTG Stad, deel "doossleutel": de levensloop van de apparaatsleutel van een
   Stadsdoos (CODECREDENTIALS.json, devices.stadsdoos_sleutel).

   Wat hier woont en nergens anders:

   1. UITGEVEN. 128 bit, eenmaal kaal in het antwoord, daarna alleen SHA-256.
      Elke sleutel draagt een uitgever, doel en scope (de twee doos-poorten),
      een uitgiftemoment en een VERPLICHTE vervaldatum (SLEUTEL_MAX_MS). Een doos
      hangt jaren buiten; hij krijgt geen sleutel die jaren meegaat maar een die
      binnen een jaar roteert.
   2. DE OVERLAP BIJ ROTATIE is het bestaande ontwerp (kern/stad/apparaat.js):
      de vorige sleutel blijft OVERLAP_MS geldig, zodat een doos die net offline
      was niet buitengesloten wordt -- nooit langer dan zijn eigen vervaldatum.
   3. VERGELIJKEN IN CONSTANTE TIJD. Beide hashes (huidig en vorig) worden
      altijd vergeleken met timingSafeEqual over buffers van gelijke lengte,
      zonder vroege uitgang; `===` op een hash lekt hoe ver een gok klopte.
   4. HET UPDATEMANIFEST WORDT NIET MET DE OPGESLAGEN HASH ONDERTEKEND. Die hash
      staat in de database; wie de database leest, kon manifesten vervalsen. De
      ondertekensleutel wordt per doos en per sleutelgeneratie AFGELEID (HKDF)
      uit een servergeheim dat niet in de database staat (accounts.sleutelVoor,
      doel 'stadsdoos-manifest-v1' -- de bestaande primitive, geen nieuw
      schema). De doos krijgt hem eenmaal mee bij de uitgifte en rekent daarmee
      na. Zonder servergeheim gaat er geen manifest uit.

   Gebruik wordt geteld (sleutelGebruik) en niet begrensd: een doos gebruikt
   zijn sleutel bij elke hartslag. Wat hem begrenst is de vervaldatum, de rem
   per doos in ./nodes.js (MIN_TUSSEN_MS), de scope van twee poorten en
   intrekken (fase gewist, uit dienst) of roteren. */
'use strict';

const SLEUTEL_MAX_MS = 365 * 86400000;
const OVERLAP_MS = 24 * 60 * 60 * 1000;
/* Een sleutel van voor de verplichte vervaldatum vervalt hier: werkende dozen
   breken niet vandaag, en "nooit" bestaat niet meer. Besluit van de eigenaar. */
const LEGACY_TOT = Date.parse('2026-12-31T23:59:59.000Z');
const META = Object.freeze({ issuer: 'rtg.stad', doel: 'stadsdoos-apparaat',
  scope: ['stad.doos.hartslag', 'stad.doos.meting'], max_gebruik: null });

module.exports = ({ crypto, nu, manifestBasis }) => {
  const hash = s => crypto.createHash('sha256').update(String(s)).digest('hex');
  const gelijk = (a, b) => {
    const x = Buffer.from(String(a || ''), 'hex'), y = Buffer.from(String(b || ''), 'hex');
    if (x.length !== 32 || y.length !== 32) return false;
    return crypto.timingSafeEqual(x, y);
  };
  const vervaltVan = n => (Number.isFinite(n.sleutelVervalt) ? n.sleutelVervalt : LEGACY_TOT);
  const epochVan = n => Number(n.sleutelAt || n.at || 0);

  function manifestSleutel(serial, epoch) {
    const basis = typeof manifestBasis === 'function' ? manifestBasis() : null;
    if (!basis || !basis.length) return null;
    return Buffer.from(crypto.hkdfSync('sha256', basis, Buffer.alloc(0),
      Buffer.from('stadsdoos-manifest-v1:' + serial + ':' + epoch), 32));
  }

  /* Een nieuwe sleutel op doos `n`. De vorige (als die er was) overlapt kort. */
  function geef(n, wie) {
    const kaal = crypto.randomBytes(16).toString('hex');
    const t = nu();
    n.oudeSleutel = n.sleutelHash
      ? { hash: n.sleutelHash, at: epochVan(n), tot: Math.min(t + OVERLAP_MS, vervaltVan(n)) } : null;
    n.sleutelHash = hash(kaal);
    n.sleutelAt = t;
    n.sleutelVervalt = t + SLEUTEL_MAX_MS;
    n.sleutelMeta = { ...META, door: String(wie || '').slice(0, 60) || 'kantoor' };
    n.sleutelGebruik = 0;
    const m = manifestSleutel(n.serial, t);
    return { sleutel: kaal, sleutelVervalt: new Date(n.sleutelVervalt).toISOString(),
      manifestSleutel: m ? m.toString('hex') : null };
  }

  /* De poort: welke sleutel past, en bij welke generatie hoort hij? Beide
     vergelijkingen draaien altijd; de uitslag komt pas daarna. */
  function past(n, sleutel) {
    if (!n || !n.actief || !n.sleutelHash) return null;
    const h = hash(sleutel), t = nu();
    const huidig = gelijk(n.sleutelHash, h);
    const vorig = !!n.oudeSleutel && gelijk(n.oudeSleutel.hash, h);
    if (huidig && vervaltVan(n) > t) { n.sleutelGebruik = (n.sleutelGebruik || 0) + 1; return { epoch: epochVan(n) }; }
    if (vorig && n.oudeSleutel.tot > t) {
      n.oudSleutelGebruikt = t;
      return { epoch: Number(n.oudeSleutel.at || 0) };
    }
    return null;
  }

  // de handtekening onder een manifest, met de afgeleide sleutel van DIE generatie
  function onderteken(serial, epoch, bericht) {
    const k = manifestSleutel(serial, epoch);
    return k ? crypto.createHmac('sha256', k).update(bericht).digest('hex') : null;
  }

  const stand = n => ({ issuer: META.issuer, doel: META.doel, scope: META.scope,
    uitgegeven: n.sleutelAt || null, vervalt: n.sleutelHash ? new Date(vervaltVan(n)).toISOString() : null,
    legacy: !!n.sleutelHash && !Number.isFinite(n.sleutelVervalt), gebruik: n.sleutelGebruik || 0 });

  return { hash, geef, past, onderteken, stand, SLEUTEL_MAX_MS, OVERLAP_MS, LEGACY_TOT };
};
