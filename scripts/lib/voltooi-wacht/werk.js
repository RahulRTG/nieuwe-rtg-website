/* ============================================================================
   VOLTOOIPROEF: WERK, DE WERKKIEZER (os:werk, in /apps/app.html).

   Werk heeft geen eigen adres. Het is een OS-app op het beginscherm: een tik op
   de tegel (map WorkOS) roept openItem('os:werk') aan, en dat opent de
   werkkiezer (openOsApp -> openWerkKiezer, public/apps/app-main/app-main-25.js
   en -26.js). De kiezer toont de werkrollen die aan het ene RTG-account hangen
   (/api/account/rollen) en opent met een tik de werksessie van die rol
   (/api/account/start). Precies die twee routes loopt deze proef.

   De belofte: een lid met een werkplek opent zijn werk met zijn eigen account,
   in de rol die hij werkelijk heeft -- en een rol die hij niet heeft, opent
   niets. Twee echte rollen, langs de enige wegen die ze aan een account
   hangen: personeel via de wervingslink van de zaak MERIDIAAN, en het kantoor
   via een uitnodiging van de eigenaar (kantoorMedewerker in ../voltooiwereld.js
   maakt die aan voor een eigen lid; hier gebeurt het voor hetzelfde lid).
   ========================================================================== */
'use strict';
const { nieuwLid, eigenaarSessie, KANTOORWERELD } = require('../voltooiwereld');
/* GEPARKEERD (19 oktober 2026): dit scenario sluit alle vier de bewijzen
   (node scripts/voltooiproef.js na registratie), maar test/appcontract.test.js
   kent de os:-velden ingang/via/bestanden nog niet. Bij de registratie gaat het
   naar scripts/lib/voltooi/werk.js, in SCENARIOS en in CONTRACT als os:werk
   (ingang /apps/app.html, bestanden app-main-25.js). */

const ROLLEN = '/api/account/rollen';
const START = '/api/account/start';
const ONTKOPPEL = '/api/account/ontkoppel';

async function loop(w, stap) {
  const L = await nieuwLid(w, 'werk');
  const rollen = async (tok) => (((await w.post(ROLLEN, {}, tok || L.token)).data) || {}).rollen || [];
  const rolVan = (lijst, rol) => lijst.find((r) => r.rol === rol);
  let personeel = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een vers lid opent de werkkiezer: er hangt nog geen werkrol aan zijn account', async () => {
    const r = await w.post(ROLLEN, {}, L.token);
    return { klopt: r.status === 200 && Array.isArray(r.data.rollen) && r.data.rollen.length === 0,
      ziet: 'rollen ' + r.status + ', ' + (r.data && r.data.rollen && r.data.rollen.length) + ' werkrollen' };
  });

  await stap('voltooibaar', 'de zaak werft hem met de wervingslink; de kiezer toont personeel bij die zaak, en de tik opent zijn werksessie daar', async () => {
    const Z = (await w.post('/api/supplier/login', { code: 'MERIDIAAN', staffId: 99, pin: '1234' })).data.token;
    const inv = await w.post('/api/supplier/staff/invite', { name: 'Werk Voltooi', role: 'staff', func: 'Receptie' }, Z);
    await w.post('/api/werving/verbind', { kassacode: inv.data && inv.data.invite && inv.data.invite.kassacode }, L.token);
    personeel = rolVan(await rollen(), 'personeel');
    const s = personeel ? await w.post(START, { rol: 'personeel', code: personeel.code, staffId: personeel.staffId }, L.token) : { status: 0 };
    const zaak = s.data && s.data.token ? await w.post('/api/supplier/state', {}, s.data.token) : { status: 0 };
    return { klopt: !!personeel && personeel.code === 'MERIDIAAN' && s.status === 200 && !!s.data.token && zaak.status === 200 &&
      zaak.data.state.supplier.code === 'MERIDIAAN',
      ziet: 'rol ' + (personeel && personeel.rol + '@' + personeel.code) + ', start ' + s.status + ', zaakstaat ' + zaak.status };
  });

  await stap('voltooibaar', 'de eigenaar nodigt hem uit voor het kantoor; na het koppelen toont de kiezer ook het kantoor en opent die sessie RTG One', async () => {
    const c = (await w.post('/api/member/connections', {}, L.token)).data || {};
    const K = await eigenaarSessie(w);
    const u = await w.post('/api/office/kantoor/uitnodiging', { codenaam: c.codename, idem: 'werk-' + c.codename }, K);
    const k = await w.post('/api/account/koppel', { soort: 'kantoor', uitnodiging: u.data && u.data.code }, L.token);
    const lijst = await rollen();
    const s = await w.post(START, { rol: 'kantoor' }, L.token);
    const one = s.data && s.data.token ? await w.post('/api/rtgone/state', { huis: 'rtg' }, s.data.token) : { status: 0 };
    return { klopt: k.status === 200 && !!rolVan(lijst, 'kantoor') && !!rolVan(lijst, 'personeel') && s.status === 200 && one.status === 200 &&
      one.data.vandaag.persoonlijk === true,
      ziet: 'koppel ' + k.status + ', rollen ' + lijst.map((r) => r.rol).join('+') + ', kantoorsessie ' + s.status + ', RTG One ' + one.status };
  });

  await stap('voltooibaar', 'een rol die niet aan het account hangt opent niets: een ander lid krijgt geen kantoor en geen werkplek bij deze zaak', async () => {
    const B = await nieuwLid(w, 'werkb');
    const k = await w.post(START, { rol: 'kantoor' }, B.token);
    const p = await w.post(START, { rol: 'personeel', code: personeel.code, staffId: personeel.staffId }, B.token);
    const r = await rollen(B.token);
    return { klopt: k.status >= 400 && k.status < 500 && !(k.data && k.data.token) && p.status >= 400 && p.status < 500 && !(p.data && p.data.token) && r.length === 0,
      ziet: 'kantoor ' + k.status + ', personeel ' + p.status + ', eigen rollen ' + r.length };
  });

  await stap('voltooibaar', 'zonder sessie leest of opent niemand iets: beide geven 401 met een melding', async () => {
    const l = await w.post(ROLLEN, {});
    const s = await w.post(START, { rol: 'kantoor' });
    return { klopt: l.status === 401 && s.status === 401 && !!(l.data && l.data.error) && !!(s.data && s.data.error),
      ziet: 'lezen ' + l.status + ', openen ' + s.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart toont de kiezer dezelfde twee werkrollen', async () => {
    const lijst = await rollen();
    return { klopt: !!rolVan(lijst, 'kantoor') && !!rolVan(lijst, 'personeel'), ziet: lijst.map((r) => r.rol).join('+') };
  });
  await stap('persistent', 'na opnieuw inloggen opent hij met hetzelfde account zijn kantoor', async () => {
    const tok = (await w.post('/api/auth/login', { login: L.email, password: L.wachtwoord })).data.token;
    const s = await w.post(START, { rol: 'kantoor' }, tok);
    return { klopt: s.status === 200 && !!s.data.token, ziet: 'start ' + s.status };
  });
  await stap('persistent', 'een read-only lezer vindt de kantoorrol aan het account in de opslag', async () => {
    const boek = w.collectie('accountRollen') || {};
    const kantoor = Object.values(boek).some((l) => Array.isArray(l) && l.some((r) => r && r.rol === 'kantoor' && r.via === 'uitnodiging'));
    return { klopt: kantoor && !JSON.stringify(boek).includes(L.token), ziet: 'kantoorrol in accountRollen: ' + kantoor };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op de werkplek opent hem; beide antwoorden zijn een werkende sessie', async () => {
    const [a, b] = await w.dubbel(START, { rol: 'kantoor' }, L.token);
    const ta = a.data && a.data.token, tb = b.data && b.data.token;
    const ok = async (t) => t && (await w.post('/api/rtgone/state', { huis: 'rtg' }, t)).status === 200;
    return { klopt: a.status === 200 && b.status === 200 && await ok(ta) && await ok(tb), ziet: 'tikken ' + a.status + '/' + b.status };
  });
  await stap('herstelbaar', 'een afgebroken tik, daarna opnieuw: de werkplek opent gewoon', async () => {
    const half = await w.afgebroken(START, { rol: 'kantoor' }, L.token);
    const s = await w.post(START, { rol: 'kantoor' }, L.token);
    return { klopt: s.status === 200 && !!s.data.token, ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + s.status };
  });
  await stap('herstelbaar', 'een crash direct na het ontkoppelen van het kantoor: na de herstart blijft het kantoor dicht en het personeel open', async () => {
    const o = await w.post(ONTKOPPEL, { rol: 'kantoor' }, L.token);
    await w.crash();
    const lijst = await rollen();
    const s = await w.post(START, { rol: 'kantoor' }, L.token);
    return { klopt: o.status === 200 && !rolVan(lijst, 'kantoor') && !!rolVan(lijst, 'personeel') && s.status >= 400 && s.status < 500,
      ziet: 'ontkoppel ' + o.status + ', na SIGKILL rollen ' + lijst.map((r) => r.rol).join('+') + ', kantoor openen ' + s.status };
  });
}

module.exports = {
  functie: 'os:werk',
  ingang: '/apps/app.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een lid opent zijn werk met zijn eigen account, in de rollen die er werkelijk aan hangen (personeel via de wervingslink, het kantoor via een uitnodiging); een rol die hij niet heeft opent niets, en dat blijft zo na een herstart en een crash',
  grens: 'De proef loopt de routes van de werkkiezer (/api/account/rollen en /start), niet de kiezer zelf; de tik op de tegel en de algemene pin in de browser zijn niet nagebootst. De rol zaak (bedrijfsinlog) is niet beproefd. De zaak logt in met de seed-personeelspin en de kantooruitnodiging gaat buiten productie zonder passkey. Geen Redis of PostgreSQL.',
  loop
};
