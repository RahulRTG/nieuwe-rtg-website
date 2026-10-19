/* ============================================================================
   VOLTOOIPROEF: PASSKEYS (link:passkeys, /apps/passkeys.html).

   De belofte van het scherm: een lid zet een passkey op zijn account (na zijn
   huidige wachtwoord), logt daarna in zonder wachtwoord, ziet zijn sleutels met
   wanneer ze laatst gebruikt zijn, en haalt er een weg -- en dat weghalen vraagt
   zelf de vinger, want wie een sessie steelt haalt anders eerst de sleutels weg.

   DE SLEUTEL is een software-authenticator (test/webauthn-authenticator.js):
   een echte P-256-sleutel die de server met dezelfde cryptografie controleert
   als een telefoon. De ceremonies zijn die van het scherm: /registreer/opties
   met het wachtwoord, /registreer, /opties en /login, en voor het weghalen
   /bevestig/opties met actie passkey-weg en daarna /weg met het bewijs.

   Het lid draagt een gebonden toestel (../voltooiwereld.js gebondenToestel):
   een passkey toevoegen is een zwaar pad en vraagt een bezitsbewijs.
   ========================================================================== */
'use strict';
const { nieuwLid, gebondenToestel } = require('../voltooiwereld');
const { maakAuthenticator } = require('../../../test/webauthn-authenticator');

const REG_OPTIES = '/api/webauthn/registreer/opties';
const REGISTREER = '/api/webauthn/registreer';
const LIJST = '/api/webauthn/lijst';
const OPTIES = '/api/webauthn/opties';
const LOGIN = '/api/webauthn/login';
const BEVESTIG_OPTIES = '/api/webauthn/bevestig/opties';
const WEG = '/api/webauthn/weg';

async function loop(w, stap) {
  const lid = await nieuwLid(w, 'passkey', 'guest');
  const vreemd = await nieuwLid(w, 'pkvreemd', 'guest');
  const toestel = await gebondenToestel(w, lid.token);
  let tok = lid.token;
  const host = new URL(w.basis).hostname, origin = () => new URL(w.basis).origin;
  const telefoon = maakAuthenticator(host), laptop = maakAuthenticator(host), nep = maakAuthenticator(host);
  let teller = 0;
  /* Elk verzoek van het lid tekent met zijn toestel, zoals de browser dat doet. */
  const post = async (pad, lijf, t) => w.post(pad, lijf, t || tok, await toestel.bewijs('POST', pad));
  const sleutels = async (t) => (((await post(LIJST, {}, t)).data) || {}).sleutels || [];
  /* De herbevestiging (kern/identiteit/herbevestiging.js): zolang er geen
     passkey is het wachtwoord, daarna de vinger van een passkey die er al staat
     -- zoals RTGHerbevestig in het scherm. */
  async function herbevestig(vinger, actie) {
    if (!vinger) return { huidig: lid.wachtwoord };
    const o = await post(BEVESTIG_OPTIES, { actie });
    const ch = o.data && o.data.opties && o.data.opties.challenge;
    return ch ? { ceremonie: o.data.ceremonie, antwoord: vinger.loginAntwoord(ch, origin(), ++teller) } : {};
  }
  async function registreer(sleutel, naam, vinger) {
    const o = await post(REG_OPTIES, await herbevestig(vinger, 'passkey-nieuw'));
    const ch = o.data && o.data.opties && o.data.opties.challenge;
    return { opties: o, r: ch ? await post(REGISTREER, { antwoord: sleutel.registratieAntwoord(ch, origin()), naam }) : null, ch };
  }
  async function inlog(sleutel) {
    const o = await w.post(OPTIES, { login: lid.email });
    const ch = o.data && o.data.opties && o.data.opties.challenge;
    const lijf = { login: lid.email, ceremonie: o.data && o.data.ceremonie, antwoord: ch ? sleutel.loginAntwoord(ch, origin(), ++teller) : null };
    return { lijf, r: await w.post(LOGIN, lijf) };
  }
  async function bewijsVoorWeg(sleutel) {
    const o = await post(BEVESTIG_OPTIES, { actie: 'passkey-weg' });
    const ch = o.data && o.data.opties && o.data.opties.challenge;
    return ch ? { ceremonie: o.data.ceremonie, antwoord: sleutel.loginAntwoord(ch, origin(), ++teller) } : {};
  }

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een passkey toevoegen vraagt eerst het huidige wachtwoord; daarna staat de telefoon in de lijst', async () => {
    const leeg = await sleutels();
    const zonder = await post(REG_OPTIES, {});
    const { r } = await registreer(telefoon, 'Telefoon');
    const na = await sleutels();
    return { klopt: leeg.length === 0 && zonder.status >= 400 && zonder.status < 500 && !!(zonder.data && (zonder.data.herbevestigingNodig || zonder.data.error)) &&
      r && r.status === 200 && na.length === 1 && na[0].naam === 'Telefoon',
      ziet: 'vooraf ' + leeg.length + ', zonder wachtwoord ' + zonder.status + ', registreren ' + (r && r.status) + ', daarna ' + na.map((s) => s.naam).join(', ') };
  });

  await stap('voltooibaar', 'het lid logt in zonder wachtwoord, en de lijst zegt wanneer de telefoon laatst gebruikt is', async () => {
    const { r } = await inlog(telefoon);
    const nieuw = r.data && r.data.token;
    const s = nieuw ? await sleutels(nieuw) : [];
    return { klopt: r.status === 200 && !!nieuw && s.length === 1 && !!s[0].laatstGebruikt,
      ziet: 'inloggen ' + r.status + ', laatst gebruikt ' + (s[0] && s[0].laatstGebruikt) };
  });

  await stap('voltooibaar', 'een tweede passkey (laptop) erbij, en weghalen vraagt de vinger: zonder bewijs weigert de server, met bewijs is hij weg', async () => {
    const { r } = await registreer(laptop, 'Laptop', telefoon);
    const lap = (await sleutels()).find((s) => s.naam === 'Laptop') || {};
    const kaal = await post(WEG, { id: lap.id });
    const met = await post(WEG, Object.assign({ id: lap.id }, await bewijsVoorWeg(telefoon)));
    const na = await sleutels();
    return { klopt: r && r.status === 200 && kaal.status === 401 && kaal.data && kaal.data.bevestigingNodig === true && met.status === 200 && na.length === 1 && na[0].naam === 'Telefoon',
      ziet: 'laptop ' + (r && r.status) + ', weg zonder vinger ' + kaal.status + ', met vinger ' + met.status + ', over: ' + na.map((s) => s.naam).join(', ') };
  });

  /* Bevoegdheid. */
  await stap('voltooibaar', 'bevoegdheid: zonder account geen lijst en geen nieuwe passkey (401)', async () => {
    const l = await w.post(LIJST, {});
    const o = await w.post(REG_OPTIES, { huidig: lid.wachtwoord });
    return { klopt: l.status === 401 && o.status === 401, ziet: 'lijst ' + l.status + ', opties ' + o.status };
  });

  await stap('voltooibaar', 'bevoegdheid: een ander lid ziet de passkeys van het lid niet en haalt ze niet weg', async () => {
    const id = ((await sleutels())[0] || {}).id;
    const zijn = (((await w.post(LIJST, {}, vreemd.token)).data) || {}).sleutels || [];
    const weg = await w.post(WEG, { id }, vreemd.token);
    return { klopt: zijn.length === 0 && weg.status >= 400 && weg.status < 500 && (await sleutels()).length === 1,
      ziet: 'vreemde ziet ' + zijn.length + ', weghalen ' + weg.status + ', het lid heeft er nog ' + (await sleutels()).length };
  });

  await stap('voltooibaar', 'bevoegdheid: een vreemde sleutel logt niet in, en een weggehaalde laptop ook niet meer', async () => {
    const n = await inlog(nep);
    const l = await inlog(laptop);
    return { klopt: n.r.status >= 400 && n.r.status < 500 && !(n.r.data && n.r.data.token) && l.r.status >= 400 && l.r.status < 500 && !(l.r.data && l.r.data.token),
      ziet: 'vreemde sleutel ' + n.r.status + ', weggehaalde laptop ' + l.r.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat de telefoon er nog, met zijn naam', async () => {
    const s = await sleutels();
    return { klopt: s.length === 1 && s[0].naam === 'Telefoon', ziet: s.map((x) => x.naam).join(', ') || 'geen' };
  });

  await stap('persistent', 'na de herstart logt het lid met de telefoon in, in een nieuwe sessie', async () => {
    const { r } = await inlog(telefoon);
    const s = r.data && r.data.token ? await w.post(LIJST, {}, r.data.token) : { status: 0 };
    return { klopt: r.status === 200 && s.status === 200, ziet: 'inloggen ' + r.status + ', lijst in de nieuwe sessie ' + s.status };
  });

  await stap('persistent', 'een read-only lezer vindt de sleutel-id van de telefoon in de opslag, en geen prive-sleutel', async () => {
    const id = Buffer.from(telefoon.credId).toString('base64url');
    const v = w.vindInOpslag(id);
    const geheim = telefoon.privateKey.export({ format: 'jwk' }).d;
    return { klopt: v.length > 0 && w.vindInOpslag(geheim).length === 0, ziet: 'sleutel-id in ' + v.length + ' vindplaats(en), prive-deel nergens' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op Passkey toevoegen met hetzelfde antwoord zet hem een keer neer', async () => {
    const tablet = maakAuthenticator(host);
    const o = await post(REG_OPTIES, await herbevestig(telefoon, 'passkey-nieuw'));
    const ch = o.data && o.data.opties && o.data.opties.challenge;
    const antwoord = tablet.registratieAntwoord(ch, origin());
    const [a, b] = await Promise.all([post(REGISTREER, { antwoord, naam: 'Tablet' }), post(REGISTREER, { antwoord, naam: 'Tablet' })]);
    const n = (await sleutels()).filter((s) => s.naam === 'Tablet').length;
    return { klopt: [a.status, b.status].includes(200) && n === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', ' + n + ' tablet' };
  });

  await stap('herstelbaar', 'een dubbele tik op Verwijder haalt hem een keer weg, en laat de rest staan', async () => {
    const tab = (await sleutels()).find((s) => s.naam === 'Tablet') || {};
    const bewijs = await bewijsVoorWeg(telefoon);
    const [a, b] = await Promise.all([post(WEG, Object.assign({ id: tab.id }, bewijs)), post(WEG, Object.assign({ id: tab.id }, bewijs))]);
    const s = await sleutels();
    return { klopt: [a.status, b.status].includes(200) && s.length === 1 && s[0].naam === 'Telefoon',
      ziet: 'tikken ' + a.status + '/' + b.status + ', over: ' + s.map((x) => x.naam).join(', ') };
  });

  await stap('herstelbaar', 'een afgebroken inlog: dezelfde ceremonie werkt geen tweede keer, en een nieuwe wel', async () => {
    const o = await w.post(OPTIES, { login: lid.email });
    const lijf = { login: lid.email, ceremonie: o.data.ceremonie, antwoord: telefoon.loginAntwoord(o.data.opties.challenge, origin(), ++teller) };
    const half = await w.afgebroken(LOGIN, lijf);
    const nogEens = await w.post(LOGIN, lijf);
    const vers = (await inlog(telefoon)).r;
    return { klopt: !(nogEens.status === 200 && half.status === 200) && vers.status === 200 && !!(vers.data && vers.data.token),
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), dezelfde ceremonie opnieuw ' + nogEens.status + ', nieuwe inlog ' + vers.status };
  });

  await stap('herstelbaar', 'een crash direct na het toevoegen verliest de passkey niet', async () => {
    const sleutel = maakAuthenticator(host);
    const { r } = await registreer(sleutel, 'Horloge', telefoon);
    await w.crash();
    const s = await sleutels();
    return { klopt: r && r.status === 200 && s.some((x) => x.naam === 'Horloge'), ziet: 'toevoegen ' + (r && r.status) + ', na SIGKILL ' + s.map((x) => x.naam).join(', ') };
  });
}

module.exports = {
  functie: 'link:passkeys',
  ingang: '/apps/passkeys.html',
  persona: 'lid',
  belofte: 'een lid zet na zijn wachtwoord een passkey op zijn account, logt daarna in zonder wachtwoord, ziet zijn sleutels en haalt er een weg met zijn vinger -- een ander lid of een vreemde sleutel komt er niet aan',
  grens: 'De sleutel is een software-authenticator met een echte P-256-sleutel, geen telefoon of beveiligingssleutel; de proef loopt de ceremonies van het scherm, niet het scherm zelf (dat doet test/passkeys-weg.e2e.js met een virtuele authenticator in Chromium). Attestatie is "none". Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
