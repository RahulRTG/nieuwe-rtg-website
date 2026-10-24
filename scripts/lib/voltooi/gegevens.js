/* ============================================================================
   VOLTOOIPROEF: MIJN GEGEVENS (link:gegevens, /apps/mijn-gegevens.html).

   De belofte, in de woorden van routes/member/gegevenskaart.js en
   routes/member/privacy.js: een lid ziet wat RTG van hem heeft (de
   gegevenskaart), neemt alles mee onder zijn codenaam (de uitvoer is een
   RECHT, en een leeg antwoord ziet er niet fout uit -- daarom staat de
   codenaam erin), ziet wie er in zijn dossier is geweest (de inzage: leeg is
   goed nieuws), en wijzigt zijn wachtwoord alleen met het huidige als
   bevestiging -- waarna het oude nergens meer opent.

   UITVOER, INZAGE EN WACHTWOORD ZIJN ZWARE PADEN (kern/identiteit/
   bezitsbewijs.js): ze vragen een toestel dat zijn sleutel aantoont. De proef
   bindt daarom per sessie een toestel, zoals de browser dat doet, en meet
   eerst dat het ZONDER toestel geweigerd wordt.

   DE ONTVANGER is het lid zelf op een ander toestel: met het nieuwe
   wachtwoord komt hij binnen, met het oude niet meer.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, gebondenToestel } = require('../voltooiwereld');

const KAART = '/api/mijn/gegevens';
const WACHTWOORD = '/api/auth/password';
const EXPORT = '/api/privacy/export';
const INZAGE = '/api/privacy/inzage';
const LOGIN = '/api/auth/login';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const lid = await nieuwLid(w, 'geg');
  const oud = lid.wachtwoord;
  const nieuw = 'nieuwgeheim' + Date.now().toString(36);
  const sessie = async (tok) => ({ token: tok, toestel: await gebondenToestel(w, tok) });
  const zwaar = async (s, pad, lijf) => w.post(pad, lijf || {}, s.token, await s.toestel.bewijs('POST', pad));
  const codenaamVan = (r) => r && r.data && r.data.profile && (r.data.profile.codename || r.data.profile.codenaam);
  let S = await sessie(lid.token);
  let codenaam = null;

  await stap('bevoegd', 'de gegevenskaart laadt voor het lid; een bezoeker zonder sessie krijgt hem niet', async () => {
    const r = await w.post(KAART, {}, S.token);
    const anoniem = await w.post(KAART, {}, null);
    return { klopt: r.status === 200 && !!r.data && typeof r.data === 'object' && anoniem.status === 401,
      ziet: 'kaart ' + r.status + ' (' + Object.keys(r.data || {}).slice(0, 6).join(',') + '), anoniem ' + anoniem.status };
  });

  await stap('voltooibaar', 'zonder een toestel dat zijn sleutel aantoont geen uitvoer en geen wachtwoordwijziging, met de reden erbij', async () => {
    const e = await w.post(EXPORT, {}, S.token);
    const p = await w.post(WACHTWOORD, { huidig: oud, nieuw }, S.token);
    /* De sessie heeft hier al een gebonden toestel: zonder bewijs is dat 401
       ("deze sessie is aan een sleutel gebonden"); zonder gebonden toestel 403.
       Allebei een weigering met de reden in woorden. */
    const weigert = (r) => (r.status === 401 || r.status === 403) && /toestel|sleutel/.test((r.data && r.data.error) || '');
    return { klopt: weigert(e) && weigert(p),
      ziet: 'uitvoer ' + e.status + ', wachtwoord ' + p.status + ' (' + (e.data && e.data.error || '').slice(0, 60) + ')' };
  });

  await stap('voltooibaar', 'met het toestel: de uitvoer draagt het profiel onder de codenaam en zegt dat het pseudoniem is; de inzage is leeg en zegt dat dat goed nieuws is', async () => {
    const e = await zwaar(S, EXPORT);
    codenaam = codenaamVan(e);
    const i = await zwaar(S, INZAGE);
    return { klopt: e.status === 200 && !!codenaam && /codenaam/i.test(e.data.note || '') && i.status === 200 && Array.isArray(i.data.inzage) && i.data.inzage.length === 0 && /goed nieuws/i.test(i.data.note || ''),
      ziet: 'uitvoer ' + e.status + ' voor ' + codenaam + '; inzage ' + i.status + ', ' + (i.data && i.data.inzage ? i.data.inzage.length : '?') + ' regel(s)' };
  });

  await stap('voltooibaar', 'het wachtwoord wijzigen: met een verkeerd huidig wachtwoord geweigerd, te kort geweigerd, en daarna lukt het', async () => {
    const fout = await zwaar(S, WACHTWOORD, { huidig: 'nietjuist', nieuw });
    const kort = await zwaar(S, WACHTWOORD, { huidig: oud, nieuw: 'abc' });
    const r = await zwaar(S, WACHTWOORD, { huidig: oud, nieuw });
    return { klopt: fout.status === 403 && /klopt niet/.test(fout.data.error) && kort.status === 400 && r.status === 200,
      ziet: 'verkeerd: ' + fout.status + ' (' + (fout.data && fout.data.error) + '), kort: ' + kort.status + ', gewijzigd: ' + r.status };
  });

  await stap('voltooibaar', 'het oude wachtwoord opent niets meer; het nieuwe opent een sessie met dezelfde codenaam', async () => {
    const metOud = await w.post(LOGIN, { login: lid.email, password: oud });
    const metNieuw = await w.post(LOGIN, { login: lid.email, password: nieuw });
    lid.wachtwoord = nieuw;
    let c = null;
    if (metNieuw.data && metNieuw.data.token) { S = await sessie(metNieuw.data.token); c = codenaamVan(await zwaar(S, EXPORT)); }
    return { klopt: metOud.status >= 400 && metOud.status < 500 && metNieuw.status === 200 && c === codenaam,
      ziet: 'oud: ' + metOud.status + ' (' + (metOud.data && metOud.data.error) + '), nieuw: ' + metNieuw.status + ', codenaam ' + (c === codenaam ? 'gelijk' : 'ANDERS') };
  });

  /* ---------------- persistent ---------------- */
  const voorE = JSON.stringify(((await zwaar(S, EXPORT)).data || {}).profile);
  await w.herstart();
  await stap('persistent', 'na een nette herstart opent alleen het nieuwe wachtwoord, en de uitvoer draagt hetzelfde profiel', async () => {
    const metOud = await w.post(LOGIN, { login: lid.email, password: oud });
    S = await sessie(await inloggen(w, lid));
    const na = JSON.stringify(((await zwaar(S, EXPORT)).data || {}).profile);
    return { klopt: metOud.status >= 400 && metOud.status < 500 && voorE.length > 2 && na === voorE, ziet: 'oud ' + metOud.status + ', nieuw opent, profiel ' + (na === voorE ? 'gelijk' : 'ANDERS') };
  });
  await stap('persistent', 'een nieuwe sessie (een ander toestel) leest dezelfde kaart en dezelfde lege inzage', async () => {
    const C = await sessie(await inloggen(w, lid));
    const k = await w.post(KAART, {}, C.token);
    const i = await zwaar(C, INZAGE);
    return { klopt: k.status === 200 && i.status === 200 && i.data.inzage.length === 0, ziet: 'kaart ' + k.status + ', inzage ' + (i.data && i.data.inzage ? i.data.inzage.length : '?') + ' regel(s)' };
  });
  await stap('persistent', 'het nieuwe wachtwoord staat niet leesbaar in de opslag, en het oude ook niet', async () => {
    const n = w.vindInOpslag(nieuw), o = w.vindInOpslag(oud);
    return { klopt: n.length === 0 && o.length === 0, ziet: 'nieuw op ' + n.length + ' plek(ken), oud op ' + o.length };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op "wachtwoord wijzigen": het lid komt daarna met het nieuwe binnen, en de tweede tik geeft geen kale fout', async () => {
    const nog = 'nognieuwer' + Date.now().toString(36);
    const lijf = { huidig: lid.wachtwoord, nieuw: nog };
    const [a, b] = await Promise.all([zwaar(S, WACHTWOORD, lijf), zwaar(S, WACHTWOORD, lijf)]);
    const l = await w.post(LOGIN, { login: lid.email, password: nog });
    if (l.status === 200) lid.wachtwoord = nog;
    return { klopt: (a.status === 200 || b.status === 200) && geen5xx(a) && geen5xx(b) && l.status === 200, ziet: 'antwoorden ' + a.status + '/' + b.status + ', inloggen met het nieuwe ' + l.status };
  });
  await stap('herstelbaar', 'een crash direct na de wijziging: na de herstart opent alleen het allernieuwste wachtwoord', async () => {
    S = await sessie(await inloggen(w, lid));
    const laatste = 'laatste' + Date.now().toString(36);
    const r = await zwaar(S, WACHTWOORD, { huidig: lid.wachtwoord, nieuw: laatste });
    await w.crash();
    const metVorig = await w.post(LOGIN, { login: lid.email, password: lid.wachtwoord });
    const metLaatste = await w.post(LOGIN, { login: lid.email, password: laatste });
    if (metLaatste.status === 200) lid.wachtwoord = laatste;
    return { klopt: r.status === 200 && metVorig.status >= 400 && metVorig.status < 500 && metLaatste.status === 200,
      ziet: 'wijzigen ' + r.status + ', na SIGKILL vorig ' + metVorig.status + ', laatste ' + metLaatste.status };
  });
  await stap('herstelbaar', 'een afgebroken uitvoer en daarna opnieuw: de uitvoer is compleet en de inzage blijft leeg (een uitvoer is geen inzage door een ander)', async () => {
    const C = await sessie(await inloggen(w, lid));
    const half = await w.afgebroken(EXPORT, {}, C.token, await C.toestel.bewijs('POST', EXPORT));
    const e = await zwaar(C, EXPORT);
    const i = await zwaar(C, INZAGE);
    return { klopt: e.status === 200 && !!e.data.profile && i.status === 200 && i.data.inzage.length === 0,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + e.status + ', inzage ' + (i.data && i.data.inzage ? i.data.inzage.length : '?') };
  });
}

module.exports = {
  functie: 'link:gegevens',
  ingang: '/apps/mijn-gegevens.html',
  persona: 'lid',
  belofte: 'een lid ziet wat RTG van hem heeft, neemt het mee onder zijn codenaam, ziet dat niemand in zijn dossier is geweest, en wijzigt zijn wachtwoord zo dat het oude nergens meer opent -- de zware handelingen alleen vanaf een toestel dat zijn sleutel aantoont',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Definitief verwijderen (/api/privacy/delete), passkeys (WebAuthn), de machtiging en het toestel intrekken zijn hier niet gelopen -- het toestel en de machtiging staan in de scenario\'s van Waar ben ik aanwezig en Wie heeft toegang tot mij. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
