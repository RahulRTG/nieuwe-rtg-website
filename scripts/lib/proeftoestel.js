/* ============================================================================
   EEN PROEFLID MET EEN GEBONDEN TOESTEL -- een echte client, geen uitzondering.

   WAAROM DIT BESTAAT. Sinds A-P1-04 staat het bezitsbewijs standaard op
   `verplicht` (server/kern/identiteit/bezitsstand.js): een zware handeling --
   geld, bank, privacy-export, een passkey -- vraagt een sessie met een eigen
   account die aan een toestelsleutel vastzit, en bij elk verzoek een handtekening
   van die sleutel. De proeven deden die routes met de DEMO-pas uit /api/login:
   geen account, dus geen binding, dus 403 "Deze handeling vraagt een eigen
   RTG-account met een bevestigd toestel". De idempotentieronde van 7 oktober 2026
   zette daardoor 155 bankroutes terug van `beschermd` naar `ongemeten`: de wereld
   kreeg geen rekening meer, en alles erachter mat niets.

   BESLUIT VAN DE EIGENAAR: de poort blijft exact zoals in productie. Geen
   proefstand, geen schaduw, geen vrijstelling -- alleen de proefCLIENT wordt een
   echte client. Dat is de regel uit MAGNAATLAB.md in het klein: een
   proefvoorziening vervangt wat er AAN de poort komt, nooit de poort.

   DEZELFDE WEG ALS DE BROWSER, stap voor stap:
     1. registreren langs /api/auth/register (een eigen account, RTG Pass);
     2. een uitdaging halen (/api/mijn/toestel/uitdaging) en die ondertekenen met
        een ECDSA P-256-sleutel die met `extractable: false` is gemaakt -- zoals
        public/shared/toestelsleutel.js `sleutel()` en `bewijs()` doen;
     3. binden langs /api/mijn/toestel/bind, en eisen dat de binding IN DEZE
        SESSIE staat (`inSessie: true`): anders is er geen sleutelbinding en
        weigert de poort alsnog;
     4. bij elk ZWAAR verzoek de kop `RTG-Bezitsbewijs` meesturen, opgebouwd als
        `bewijsVoor()` in de browser: base64url(JSON {jti, tijd, methode, pad})
        + '.' + base64url(handtekening over die kop).

   WELKE PADEN ZWAAR ZIJN BESLIST DE SERVER, niet dit bestand: `zwaarPad` komt
   uit server/kern/identiteit/bezitsbewijs.js zelf. De browser draagt een kopie
   (en daar staat een toets op); een proef die een eigen kopie maakt, is een
   derde lijst die stil uit de pas loopt.

   WAT HIER NIET STAAT: een weg om de poort om te zetten. Lukt een stap niet, dan
   geeft de bouwer `{ klaar: null, reden }` en meet de proef zoals hij deed --
   eerlijk ongemeten, met de reden erbij.
   ========================================================================== */
'use strict';

const { webcrypto, randomBytes } = require('crypto');
const { zwaarPad } = require('../../server/kern/identiteit/bezitsbewijs');

const KOP = 'RTG-Bezitsbewijs';
const b64 = (buf) => Buffer.from(buf).toString('base64url');
const tok = (r) => (r && r.data && r.data.token) || null;

/* Een kop ondertekenen zoals bewijsVoor() in public/shared/toestelsleutel.js:
   achttien willekeurige bytes als jti, de tijd van NU (de server gunt 90 s
   speling), de methode in hoofdletters en het pad zonder zoekdeel. */
async function bewijsVoor(privateKey, methode, pad) {
  const lading = { jti: b64(randomBytes(18)), tijd: Date.now(),
    methode: String(methode || 'POST').toUpperCase(), pad: String(pad || '').split('?')[0] };
  const kop = b64(JSON.stringify(lading));
  const sig = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, Buffer.from(kop, 'utf8'));
  return kop + '.' + b64(sig);
}

/* EEN BESTAANDE ACCOUNTSESSIE aan een nieuw toestel binden. Geeft het toestel
   terug, of `{ klaar: null, reden }`. De private sleutel verlaat deze functie
   nooit: wat eruit komt kan alleen TEKENEN. */
async function bindToestel({ post, token, naam }) {
  if (!token) return { klaar: null, reden: 'geen sessie om te binden' };
  const paar = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const volledig = await webcrypto.subtle.exportKey('jwk', paar.publicKey);
  const jwk = { kty: volledig.kty, crv: volledig.crv, x: volledig.x, y: volledig.y };
  const u = await post('/api/mijn/toestel/uitdaging', {}, token);
  const nonce = u && u.data && u.data.nonce;
  if (!nonce) return { klaar: null, reden: 'geen uitdaging (' + (u && u.status) + ': ' + ((u && u.data && u.data.error) || '') + ')' };
  const handtekening = b64(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, paar.privateKey, Buffer.from(String(nonce), 'utf8')));
  const b = await post('/api/mijn/toestel/bind', { jwk, handtekening, naam: naam || 'Proeftoestel' }, token);
  if (!b || b.status !== 200) return { klaar: null, reden: 'binden lukte niet (' + (b && b.status) + ': ' + ((b && b.data && b.data.error) || '') + ')' };
  /* Een toestel dat wel bekend is maar niet aan DEZE sessie vastzit, levert
     geen sleutelbinding op -- en dan weigert de poort elke zware handeling. */
  if (!b.data || b.data.inSessie !== true) return { klaar: null, reden: 'het toestel is bevestigd maar niet aan deze sessie gebonden' };
  const teken = (methode, pad) => bewijsVoor(paar.privateKey, methode, pad);
  return { klaar: { token, toestelId: b.data.toestelId, teken }, reden: null };
}

/* EEN VERS PROEFLID: registreren als iedereen, en dan binden. */
async function maakProeflid({ post, naam }) {
  const email = 'proeflid-toestel-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '@voorbeeld.test';
  const reg = await post('/api/auth/register', { name: naam || 'Proeflid Toestel', email,
    password: 'geheim12345', geboortedatum: '1988-04-04', tier: 'rtg', pasApp: 'rtg' });
  const token = tok(reg);
  if (!token) return { klaar: null, reden: 'registreren lukte niet (' + (reg && reg.status) + ': ' + ((reg && reg.data && reg.data.error) || '') + ')' };
  const t = await bindToestel({ post, token, naam: 'Toestel ' + (naam || 'proeflid') });
  if (!t.klaar) return t;
  const user = reg.data.state && reg.data.state.user;
  t.klaar.codenaam = (user && user.codename) || null;
  return t;
}

/* DE POST VAN EEN PROEF, met de toestellen ervoor.

   Alleen op een ZWAAR pad gebeurt er iets, precies zoals haakAan() in de
   browser alleen daar tekent. Twee dingen, allebei gedeclareerd:

   - `voorLid`: de LEDENROL op een zwaar pad IS het proeflid. Wie daar met het
     token van `voorLid.van()` (de demo-pas) aanklopt, klopt aan als het proeflid
     -- want een demo-pas kan per definitie niet binden, en de vraag die de proef
     stelt ("doet een herhaling iets") gaat over de route en niet over welk lid.
     Op elk ander pad blijft het token zoals het was: de meting van de rest van
     het huis verandert niet.
   - elk token dat bij een gebonden toestel hoort, krijgt een vers bewijs.

   Een token dat niemand kent gaat ongemoeid door: de SERVER beslist of dat mag,
   niet deze schil. */
function metToestellen(post, { toestellen, voorLid } = {}) {
  const bekend = (toestellen || []).filter(Boolean);
  if (!bekend.length && !(voorLid && voorLid.lid)) return post;
  return async (pad, lijf, token, koppen) => {
    if (!zwaarPad(pad)) return post(pad, lijf, token, koppen);
    let t = token;
    if (voorLid && voorLid.lid && token && token === voorLid.van()) t = voorLid.lid.token;
    const toestel = (voorLid && voorLid.lid && voorLid.lid.token === t) ? voorLid.lid : bekend.find(x => x.token === t);
    if (!toestel) return post(pad, lijf, t, koppen);
    const bewijs = await toestel.teken('POST', pad);
    return post(pad, lijf, t, Object.assign({}, koppen || {}, { [KOP]: bewijs }));
  };
}

module.exports = { bindToestel, maakProeflid, metToestellen, bewijsVoor, KOP };
