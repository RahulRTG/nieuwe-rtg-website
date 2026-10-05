/* De credentials van een RTFoundation-les (CODECREDENTIALS.json,
   foundation.onderwijs_les_tokens; RELEASEKANDIDAAT.md B17). Drie soorten, alle
   drie 128 bits uit kern/bearercode.js en op schijf alleen als hash:

   - de LESCODE: een leerling doet ermee mee. Meervoudig bruikbaar tot het
     plafond van de klas, en elke toetreding is een atomaire claim in de
     collectietransactie (PG: advisory lock + FOR UPDATE).
   - de LERAARSLEUTEL: bord, opgaven, agenda, meelezen en het beheer van de les.
   - de LEERLINGSLEUTEL: het eigen schrift en inleveren. Het onderwerp is les
     plus een willekeurig leerling-id; een kind is geen profiel (LEVEN.md), dus
     er staat geen naam, leeftijd of gezin in de sleutel.

   Een les is tijdelijk: alle drie vervallen samen na GELDIG_MS. Twaalf uur is
   een schooldag plus het huiswerk van die avond; de volgende dag begint de
   begeleider een nieuwe les. Intrekken en roteren doet de leraar zelf.

   Deze laag bezit uitsluitend de credentials (collectie foundationLesToegang).
   De inhoud van de les (bord, schriften, namen) blijft in F().lessen, op het
   niet-geheime les-id. */
'use strict';

const DOEL = Object.freeze({ lescode: 'foundation-les-meedoen', leraar: 'foundation-les-leraar',
  leerling: 'foundation-les-leerling' });
const SCOPE = Object.freeze({ lescode: ['les.meedoen'], leraar: ['les.leiden'], leerling: ['les.schrift'] });
const PREFIX = Object.freeze({ lescode: 'LES', leraar: 'LESLR', leerling: 'LESLL' });
const GELDIG_MS = 12 * 3600000;
const MAX_LEERLINGEN = 60;
const MAX_LESSEN = 20000;
const BEWAAR_MS = 30 * 86400000;
const COLLECTIE = 'foundationLesToegang';

module.exports = ({ db, crypto, bewerkCollectie, productie = process.env.NODE_ENV === 'production',
  nu = () => new Date().toISOString() }) => {
  const bearer = require('../../kern/bearercode')({ crypto, namespace: 'foundation-les', nu });
  let eigen = null;
  const kaart = () => {
    if (!eigen) eigen = require('../../kern/eigencollectie')({ db, domein: 'foundation/onderwijs',
      bezit: { foundationLesToegang: 'kaart' } });
    return eigen.kijk(COLLECTIE);
  };
  const afdruk = w => crypto.createHash('sha256').update(String(w)).digest('hex');

  /* Zonder collectietransactie is een claim over twee instances niet atomair;
     in productie weigert deze laag dan liever dan terug te vallen. */
  function transactie(werk) {
    if (typeof bewerkCollectie === 'function')
      return Promise.resolve(bewerkCollectie(COLLECTIE, lessen => {
        if (!lessen || typeof lessen !== 'object' || Array.isArray(lessen))
          throw new Error(COLLECTIE + ' hoort een kaart te zijn');
        ruim(lessen);
        return werk(lessen);
      }));
    if (productie) return Promise.reject(new Error('foundation-les: geen collectietransactie in productie'));
    kaart();
    const lessen = eigen.bak(COLLECTIE);
    ruim(lessen);
    return Promise.resolve(werk(lessen));
  }

  /* Een verlopen les bewaart zijn hashes nog dertig dagen (zodat een oude code
     "afgelopen" zegt en niet "onbekend"), daarna verdwijnen ze. */
  function ruim(lessen) {
    const grens = Date.parse(nu()) - BEWAAR_MS;
    for (const [id, l] of Object.entries(lessen))
      if (!l || !(Date.parse(l.expires_at) > grens)) delete lessen[id];
  }

  function maakSleutel(soort, les, extra) {
    return bearer.maak({ prefix: PREFIX[soort], issuer: 'rtfoundation-onderwijs', doel: DOEL[soort],
      scope: SCOPE[soort], onderwerp: Object.assign({ soort: 'foundation-les', les: les.id,
        rol: soort }, extra || {}),
      geldigheid: { duurMs: Math.max(1000, Date.parse(les.expires_at) - Date.parse(nu())) },
      /* Bearercode v2. De lescode telt toetredingen; een leraar- of leerlingsleutel
         is een sessie voor de duur van de les. */
      gebruik: soort === 'lescode' ? { max: MAX_LEERLINGEN } : 'sessie', afgeleid: 'geen' });
  }
  const kaal = code => String(code == null ? '' : code).replace(/\s+/g, '');
  const dicht = les => !!(les.gesloten_at || !(Date.parse(les.expires_at) > Date.parse(nu())));

  /* Een nieuwe les: een lescode en een leraarssleutel, kaal alleen in dit antwoord. */
  function nieuweLes({ idem } = {}) {
    const idemHash = idem ? afdruk('les-maak|' + String(idem).slice(0, 200)) : null;
    return transactie(lessen => {
      if (idemHash && Object.values(lessen).some(l => l && l.maak_idem_hash === idemHash))
        return { status: 409, herhaald: true,
          error: 'Deze les is al gemaakt en haar codes zijn eenmaal getoond. Maak een nieuwe lescode vanaf het bord.' };
      if (Object.values(lessen).filter(l => l && !dicht(l)).length >= MAX_LESSEN)
        return { status: 503, error: 'Er lopen nu te veel lessen tegelijk; probeer het zo weer.' };
      let id;
      // hoofdletters: bord.html en schrift.html zetten het adres in hoofdletters; het id is niet geheim
      do { id = 'LS' + crypto.randomBytes(12).toString('hex').toUpperCase(); } while (lessen[id]);
      const issued = nu();
      const les = { id, issued_at: issued, expires_at: new Date(Date.parse(issued) + GELDIG_MS).toISOString(),
        gesloten_at: null, maak_idem_hash: idemHash, lescode_historie: [], leerlingen: {} };
      const lescode = maakSleutel('lescode', les), leraar = maakSleutel('leraar', les);
      les.lescode = lescode.toegang; les.leraar = leraar.toegang;
      lessen[id] = les;
      return { ok: true, lesId: id, lescode: lescode.code, token: leraar.code, expires_at: les.expires_at };
    });
  }

  /* Meedoen: DE claim. Zoeken over alle lessen zonder vroege uitgang, en het
     tellen, de plafondcontrole en de nieuwe leerlingsleutel in een commit. */
  function claim(lescode, weigerVoor) {
    const code = kaal(lescode);
    return transactie(lessen => {
      const les = bearer.vind(Object.values(lessen), code, l => l && l.lescode && l.lescode.code_hash);
      if (!les) {
        const oud = bearer.vind(Object.values(lessen).flatMap(l => (l && l.lescode_historie) || []), code);
        return oud ? { status: 410, error: 'Deze lescode is vervangen. Vraag je begeleider om de nieuwe.' }
          : { status: 404, error: 'Deze lescode kennen we niet. Klopt hij?' };
      }
      if (dicht(les)) return { status: 410, error: 'Deze les is afgelopen. Vraag je begeleider om een nieuwe lescode.' };
      const reden = bearer.reden(les.lescode, { doel: DOEL.lescode, scope: SCOPE.lescode });
      if (reden) return { status: reden === 'opgebruikt' ? 409 : 410, reden,
        error: reden === 'opgebruikt' ? 'Deze les zit vol.' : 'Deze lescode werkt niet meer. Vraag je begeleider om een nieuwe.' };
      if (Object.keys(les.leerlingen).length >= MAX_LEERLINGEN) return { status: 409, error: 'Deze les zit vol.' };
      const bezwaar = typeof weigerVoor === 'function' ? weigerVoor(les.id) : null;
      if (bezwaar) return { status: 409, error: bezwaar };
      let sid;
      do { sid = crypto.randomBytes(6).toString('hex'); } while (les.leerlingen[sid]);
      bearer.gebruik(les.lescode);
      const leerling = maakSleutel('leerling', les, { leerling: sid });
      les.leerlingen[sid] = leerling.toegang;
      return { ok: true, lesId: les.id, studentId: sid, token: leerling.code };
    });
  }

  /* Wie is deze sleutel binnen DEZE les? Het les-id is niet geheim; binnen de
     les wordt elke sleutel vergeleken (timingSafeEqual), zonder vroege uitgang. */
  function vanSleutel(lesId, sleutel) {
    const les = kaart()[String(lesId || '')];
    if (!les || !les.leraar) return { reden: 'onbekend' };
    const gezocht = bearer.hash(kaal(sleutel));
    let rol = null, studentId = null;
    if (bearer.zelfdeHash(les.leraar.code_hash, gezocht)) rol = 'leraar';
    for (const [sid, t] of Object.entries(les.leerlingen || {}))
      if (t && bearer.zelfdeHash(t.code_hash, gezocht)) { rol = 'leerling'; studentId = sid; }
    if (!rol || !kaal(sleutel)) return { reden: 'sleutel' };
    if (dicht(les)) return { reden: 'afgelopen' };
    const t = rol === 'leraar' ? les.leraar : les.leerlingen[studentId];
    const reden = bearer.reden(t, { doel: DOEL[rol], scope: SCOPE[rol], negeerGebruik: true });
    if (reden || !t.onderwerp || t.onderwerp.les !== les.id) return { reden: reden || 'verkeerd-onderwerp' };
    return { rol, studentId, lesId: les.id };
  }

  /* Beheer door de leraar (roteren, intrekken, sluiten): ./toegang-beheer.js. */
  const beheer = require('./toegang-beheer')({ bearer, transactie, dicht, kaal, nu,
    DOEL, SCOPE });

  /* De drager van een verzoek: eerst de Authorization-kop, dan het lijf, als
     laatste de query (alleen voor EventSource, die geen koppen kan sturen). Het
     token gaat METEEN door vanSleutel(); de kale sleutel reist alleen mee zodat
     het beheer hem binnen zijn transactie opnieuw kan toetsen. */
  function vanVerzoek(lesId, req) {
    const h = String((req.get && req.get('authorization')) || '');
    const sleutel = (h.startsWith('Bearer ') ? h.slice(7) : '') || (req.body && req.body.token) ||
      (req.query && req.query.token) || '';
    return Object.assign(vanSleutel(lesId, sleutel), { sleutel: String(sleutel) });
  }

  return Object.assign({ nieuweLes, claim, vanSleutel, vanVerzoek, publiek: bearer.publiek }, beheer);
};

module.exports.DOEL = DOEL;
module.exports.SCOPE = SCOPE;
module.exports.GELDIG_MS = GELDIG_MS;
module.exports.MAX_LEERLINGEN = MAX_LEERLINGEN;
module.exports.COLLECTIE = COLLECTIE;
