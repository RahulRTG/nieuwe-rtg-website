/* EEN PASSKEY VOOR EEN KANTOORMEDEWERKER, en de ceremonie op de kantoordeur.

   Sinds het besluit van 25 september 2026 (routes/kantoren/bank-passkey.js)
   vragen BEIDE handtekeningen onder een geldhandeling van het kantoor een
   passkey: wie de incassoronde aanvraagt, en wie hem als tweede mens aftekent.
   Zonder passkey is er geen terugval meer. Elke toets die geld door de hele
   baan wil laten lopen, heeft dus twee medewerkers met een passkey nodig -- en
   drie kopieen van deze paar regels zouden uit elkaar lopen zodra het formaat
   van de ceremonie verandert.

   Gebruik:
     const pk = kantoorPasskey(base);
     const sleutelA = await pk.zet(lidTokenVanA);   // op zijn EIGEN account
     const c = await pk.ceremonie(sleutelA, '/api/office/bank/incasso/opties', { tot }, kantoorTokenVanA);
     // c = { ceremonie, antwoord } -- mee in het lichaam van de handeling
*/
'use strict';
const { maakAuthenticator } = require('./webauthn-authenticator');

function kantoorPasskey(base) {
  const origin = new URL(base).origin;
  const post = (pad, body, token) => fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  async function zet(lidToken) {
    const sleutel = maakAuthenticator(new URL(base).hostname);
    const o = await post('/api/webauthn/registreer/opties', {}, lidToken);
    if (o.status !== 200) throw new Error('registratieopties: ' + JSON.stringify(o.body).slice(0, 160));
    const r = await post('/api/webauthn/registreer',
      { antwoord: sleutel.registratieAntwoord(o.body.opties.challenge, origin), naam: 'Toestel kantoor' }, lidToken);
    if (r.status !== 200) throw new Error('passkey registreren: ' + JSON.stringify(r.body).slice(0, 160));
    return { sleutel, teller: 0 };
  }

  async function ceremonie(pk, optiesPad, body, kantoorToken) {
    const o = await post(optiesPad, body, kantoorToken);
    if (o.status !== 200) throw new Error(optiesPad + ': ' + o.status + ' ' + JSON.stringify(o.body).slice(0, 160));
    pk.teller += 1;
    return { ceremonie: o.body.ceremonie, antwoord: pk.sleutel.loginAntwoord(o.body.opties.challenge, origin, pk.teller) };
  }

  return { zet, ceremonie };
}

module.exports = { kantoorPasskey };
