/* EEN KANTOORMEDEWERKER MET EEN PASSKEY, voor de idempotentieproef.

   WAAROM DIT BESTAAT. Sinds het besluit van 25 september 2026
   (server/routes/kantoren/bank-passkey.js) vraagt de incassoronde een passkey
   ZONDER terugval: wie geen passkey heeft, krijgt 403 voordat de keten begint. De
   proef deed die route met `kantoor-op-naam`, een medewerker zonder passkey, en de
   verse ronde van 27 september zag daardoor NIETS meer bewegen -- de geldketen
   verloor zijn as `gevolg` en de enige volledige keten van het huis viel om, niet
   omdat de route veranderde maar omdat het instrument er niet meer bij kon.

   WAAROM EEN EIGEN MEDEWERKER en niet een passkey op `kantoor-a`. Een account MET
   passkey krijgt op elke zware route zonder ceremonie een weigering (de terugval
   geldt alleen voor wie er nog geen heeft). Een passkey op de gedeelde medewerker
   zou dus tientallen andere zware kantoorroutes uit de meting halen. Deze persoon
   bestaat alleen voor de routes in PASSKEYROUTES, en de rest van de proef merkt
   niets van hem.

   PER OPROEP EEN VERSE CEREMONIE. Een uitdaging is eenmalig en gebonden aan de
   handeling en haar grens; de proef doet een route vijf keer (a, b, c en twee
   kale), dus haalt hij voor elke oproep nieuwe opties. Dat is exact wat het
   scherm doet, en de e2e-proef in test/tweedehandtekening.test.js ook -- de
   authenticator is dezelfde (test/webauthn-authenticator.js), zodat er geen
   tweede nagemaakte sleutel ontstaat.

   WAT HIJ NIET DOET: een poort omzeilen. De medewerker loopt de gewone weg
   (registreren, een uitnodiging van de boardroom, koppelen, de kantoordeur, een
   baliezetel, een passkey op zijn eigen account), en de route krijgt een echte
   ondertekende ceremonie. Lukt een stap niet, dan geeft de bouwer null met de
   reden, en blijft de route zoals hij was: eerlijk ongemeten. */
'use strict';

const { maakAuthenticator } = require('../../test/webauthn-authenticator');

/* Per route: waar de opties vandaan komen, en uit welk deel van het lijf. */
const PASSKEYROUTES = Object.freeze({
  '/api/office/bank/incasso': { opties: '/api/office/bank/incasso/opties', lijf: (l) => ({ tot: l.tot }) }
});

const tok = (r) => r && r.data && r.data.token;

async function bouwPasskeyMedewerker({ post, basis, boardroom }) {
  if (!boardroom) return { klaar: null, reden: 'geen boardroomsessie om een uitnodiging mee te maken' };
  const origin = new URL(basis).origin;
  const email = 'kantoor-passkey-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '@voorbeeld.test';
  const reg = await post('/api/auth/register', { name: 'Kantoor Passkey', email, password: 'geheim123',
    geboortedatum: '1985-05-05', pasApp: 'rtg' });
  const lidTok = tok(reg);
  if (!lidTok) return { klaar: null, reden: 'registreren lukte niet (' + (reg && reg.status) + ')' };
  const me = await post('/api/auth/me', {}, lidTok);
  const codenaam = me && me.data && me.data.user && me.data.user.codename;
  const u = codenaam ? await post('/api/office/kantoor/uitnodiging', { codenaam }, boardroom) : null;
  const uitnodiging = u && u.data && u.data.code;
  if (!uitnodiging) return { klaar: null, reden: 'geen kantooruitnodiging (' + (u && u.status) + ')' };
  const k = await post('/api/account/koppel', { soort: 'kantoor', uitnodiging }, lidTok);
  if (!k || k.status !== 200) return { klaar: null, reden: 'koppelen lukte niet (' + (k && k.status) + ')' };
  const kantoor = tok(await post('/api/account/start', { rol: 'kantoor' }, lidTok));
  if (!kantoor) return { klaar: null, reden: 'de kantoordeur ging niet open' };
  const id = reg.data && reg.data.state && reg.data.state.user && reg.data.state.user.id;
  if (id) { try { await post('/api/office/balie/zetel', { key: 'user-' + id }, boardroom); } catch (e) { /* zetel is best-effort, zoals in ./proefsleutels.js */ } }

  /* De passkey op zijn EIGEN account, zoals een medewerker dat doet. */
  const sleutel = maakAuthenticator(new URL(basis).hostname);
  const o = await post('/api/webauthn/registreer/opties', { huidig: 'geheim123' }, lidTok);
  const uitdaging = o && o.data && o.data.opties && o.data.opties.challenge;
  if (!uitdaging) return { klaar: null, reden: 'geen registratieopties (' + (o && o.status) + ')' };
  const r = await post('/api/webauthn/registreer',
    { antwoord: sleutel.registratieAntwoord(uitdaging, origin), naam: 'Toestel idempotentieproef' }, lidTok);
  if (!r || r.status !== 200) return { klaar: null, reden: 'passkey registreren lukte niet (' + (r && r.status) + ')' };

  let teller = 0;
  /* Het lijf en het token voor EEN oproep, of null als deze route niet van hem is. */
  async function voor(pad, lijf) {
    const d = PASSKEYROUTES[pad];
    if (!d) return null;
    const op = await post(d.opties, d.lijf(lijf || {}), kantoor);
    const ch = op && op.data && op.data.opties && op.data.opties.challenge;
    if (!ch) return { token: kantoor, lijf: {} };   // de route zegt dan zelf waarom niet
    teller += 1;
    return { token: kantoor, lijf: { ceremonie: op.data.ceremonie, antwoord: sleutel.loginAntwoord(ch, origin, teller) } };
  }
  return { klaar: { voor, routes: Object.keys(PASSKEYROUTES) }, reden: null };
}

/* De post van de proef, met deze medewerker ervoor op zijn eigen routes. De
   opties-aanroep gaat langs de ONGEWIJZIGDE post: die hoort niet bij de oproep
   die gemeten wordt, en zijn staatkop wordt niet gelezen. */
function metPasskey(post, klaar) {
  if (!klaar) return post;
  return async (pad, lijf, token, koppen) => {
    const extra = await klaar.voor(pad, lijf);
    if (!extra) return post(pad, lijf, token, koppen);
    return post(pad, Object.assign({}, lijf, extra.lijf), extra.token, koppen);
  };
}

module.exports = { bouwPasskeyMedewerker, metPasskey, PASSKEYROUTES };
