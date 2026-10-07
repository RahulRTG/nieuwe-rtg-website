/* EEN EIGENAAR MET EEN PASSKEY OP DE TECHNIEKPAGINA, voor toetsen over HTTP.

   Sinds B22 vraagt het zetten of roteren van een SSO-clientgeheim een verse
   passkey, zonder terugval (actie `eigenaar-ssogeheim`, kern/zwaarbewijs.js).
   Een toets die een geheim zet, moet dus eerst een passkey op het account van
   de eigenaar hebben en daarna bij elke zware handeling de ceremonie doen --
   precies wat public/shared/zwaarbevestig.js in de browser doet: sturen, en
   bij 401 `bevestigingNodig` de ceremonie halen op /api/techniek/bevestig/opties
   (gebonden aan DEZELFDE sessie) en opnieuw sturen.

   Gebruik:
     const zw = await zwaarApi(api, base, lidToken, wachtwoord);  // zet een passkey op dat account
     await zw('/api/techniek/sso', body, token);       // de ceremonie gaat vanzelf mee
   `api(pad, body, token, ...)` moet { status, body } teruggeven. */
'use strict';
const { maakAuthenticator } = require('./webauthn-authenticator');

async function zwaarApi(api, base, lidToken, wachtwoord) {
  /* Een eerste passkey vraagt het huidige wachtwoord (P1-2,
     routes/auth/webauthn.js). Zonder dat is dit geen toets van de route maar
     van een gat dat er niet meer is. */
  if (!wachtwoord) throw new Error('zwaarApi: geef het wachtwoord van dit account mee; een passkey toevoegen vraagt het.');
  const origin = new URL(base).origin;
  const sleutel = maakAuthenticator(new URL(base).hostname);
  const o = await api('/api/webauthn/registreer/opties', { huidig: wachtwoord }, lidToken);
  if (o.status !== 200) throw new Error('registratieopties: ' + JSON.stringify(o.body).slice(0, 160));
  const r = await api('/api/webauthn/registreer',
    { antwoord: sleutel.registratieAntwoord(o.body.opties.challenge, origin), naam: 'Toestel eigenaar' }, lidToken);
  if (r.status !== 200) throw new Error('passkey registreren: ' + JSON.stringify(r.body).slice(0, 160));
  let teller = 0;
  async function zw(pad, body, token, ...rest) {
    const eerst = await api(pad, body, token, ...rest);
    if (!(eerst.status === 401 && eerst.body && eerst.body.bevestigingNodig && eerst.body.actie)) return eerst;
    const c = await api('/api/techniek/bevestig/opties', { actie: eerst.body.actie }, token);
    if (c.status !== 200) throw new Error('ceremonie ' + eerst.body.actie + ': ' + JSON.stringify(c.body).slice(0, 160));
    return api(pad, Object.assign({}, body || {}, { ceremonie: c.body.ceremonie,
      antwoord: sleutel.loginAntwoord(c.body.opties.challenge, origin, ++teller) }), token, ...rest);
  }
  zw.sleutel = sleutel;
  return zw;
}

module.exports = { zwaarApi };
