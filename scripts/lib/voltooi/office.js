/* ============================================================================
   VOLTOOIPROEF: RTDOCS (link:office, /apps/office.html?werk=kantoor).

   De belofte van het scherm: een medewerker maakt een document in de drive van
   het kantoor, schrijft erin (autosave, met versies), zet een oude versie terug
   en vindt het morgen weer -- en een tweede venster schrijft nooit stil over
   een nieuwere versie heen. Wie niet bij het kantoor hoort, opent het niet.

   Het scherm kiest zijn drive aan de hand van ?werk=; voor het kantoor is dat
   /api/office/kantoorpakket/ (public/apps/office/app.js, opzet.basis). De
   medewerker is een lid op naam met de kantoorrol, zoals RTG One hem opent.
   ========================================================================== */
'use strict';
const { kantoorMedewerker, nieuwLid, KANTOORWERELD } = require('../voltooiwereld');

const MIJN = '/api/office/kantoorpakket/mijn';
const MAAK = '/api/office/kantoorpakket/maak';
const OPEN = '/api/office/kantoorpakket/open';
const BEWAAR = '/api/office/kantoorpakket/bewaar';
const VERSIES = '/api/office/kantoorpakket/versies';
const TERUG = '/api/office/kantoorpakket/terug';

async function zaakSessie(w, code) {
  const rooster = await w.post('/api/supplier/roster', { code });
  const man = ((rooster.data && rooster.data.staff) || []).find((x) => x.role === 'manager');
  const z = await w.post('/api/supplier/login', { code, staffId: man && man.id, pin: '1234' });
  if (!z.data || !z.data.token) throw new Error('de manager van ' + code + ' kon niet inloggen (' + z.status + ')');
  return z.data.token;
}

async function loop(w, stap) {
  const merk = 'D' + Date.now().toString(36).slice(-5);
  const M = await kantoorMedewerker(w, 'docs');
  let K = M.kantoor;
  const post = (pad, lijf) => w.post(pad, lijf, K);
  const open = async (id) => (await post(OPEN, { id })).data || {};
  const tekst = (d) => (d.inhoud && d.inhoud.tekst) || '';
  const titel = 'Notulen ' + merk;
  let id = null, stand = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'de medewerker maakt een tekstdocument in de kantoordrive en ziet het in de lijst', async () => {
    const r = await post(MAAK, { soort: 'tekst', titel, idem: 'maak-' + merk });
    id = r.data && r.data.id;
    const l = await post(MIJN, {});
    const lijst = JSON.stringify(l.data || {});
    return { klopt: r.status === 200 && !!id && l.status === 200 && lijst.includes(id) && lijst.includes(titel),
      ziet: 'maak ' + r.status + ', in de lijst ' + lijst.includes(id) };
  });

  await stap('voltooibaar', 'hij schrijft erin en bewaart; een tweede bewaring maakt een versie van de vorige stand', async () => {
    const d = await open(id);
    const a = await post(BEWAAR, { id, titel, inhoud: { tekst: 'Eerste versie ' + merk }, verwachtGewijzigd: d.gewijzigd });
    const b = await post(BEWAAR, { id, titel, inhoud: { tekst: 'Tweede versie ' + merk }, verwachtGewijzigd: a.data.gewijzigd });
    stand = await open(id);
    return { klopt: a.status === 200 && b.status === 200 && tekst(stand) === 'Tweede versie ' + merk && stand.versies >= 2,
      ziet: 'bewaren ' + a.status + '/' + b.status + ', tekst "' + tekst(stand) + '", ' + stand.versies + ' versies' };
  });

  await stap('voltooibaar', 'een tweede venster met een oudere stand schrijft er niet overheen: een versieconflict met de reden', async () => {
    const r = await post(BEWAAR, { id, titel, inhoud: { tekst: 'Oud venster ' + merk }, verwachtGewijzigd: '2000-01-01T00:00:00.000Z' });
    const d = await open(id);
    return { klopt: r.status === 409 && r.data.code === 'VERSIECONFLICT' && tekst(d) === 'Tweede versie ' + merk,
      ziet: r.status + ' ' + (r.data && r.data.code) + ', tekst blijft "' + tekst(d) + '"' };
  });

  await stap('voltooibaar', 'hij zet de eerste versie terug uit de versiegeschiedenis', async () => {
    /* De lijst toont wanneer en door wie, nieuwste eerst; de vorige stand is nr 0. */
    const v = await post(VERSIES, { id });
    const lijst = (v.data && v.data.versies) || [];
    const t = await post(TERUG, { id, nr: lijst[0] && lijst[0].nr });
    stand = await open(id);
    return { klopt: v.status === 200 && lijst.length >= 2 && t.status === 200 && tekst(stand) === 'Eerste versie ' + merk,
      ziet: 'versies ' + v.status + ' (' + lijst.length + '), terug ' + t.status + ', tekst "' + tekst(stand) + '"' };
  });

  await stap('voltooibaar', 'een zaak en een lid zonder kantoorrol openen of wijzigen dit kantoordocument niet', async () => {
    const Z = await zaakSessie(w, 'KIKUNOI');
    const zo = await w.post('/api/supplier/kantoorpakket/open', { id }, Z);
    const zb = await w.post('/api/supplier/kantoorpakket/bewaar', { id, inhoud: { tekst: 'Zaak' } }, Z);
    const L = await nieuwLid(w, 'docl');
    const lo = await w.post('/api/kantoorpakket/open', { id }, L.token);
    const lk = await w.post(OPEN, { id }, L.token);
    const d = await open(id);
    return { klopt: [403, 404].includes(zo.status) && [403, 404].includes(zb.status) && [403, 404].includes(lo.status) && lk.status === 401 &&
      tekst(d) === 'Eerste versie ' + merk,
      ziet: 'zaak open ' + zo.status + ', bewaar ' + zb.status + '; lid open ' + lo.status + ', kantoordeur ' + lk.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat het document met de teruggezette tekst er', async () => {
    const d = await open(id);
    return { klopt: d.titel === titel && tekst(d) === 'Eerste versie ' + merk && d.versies >= 3,
      ziet: 'titel "' + d.titel + '", tekst "' + tekst(d) + '", ' + d.versies + ' versies' };
  });
  await stap('persistent', 'in een nieuwe kantoorsessie vindt hij het in de drive', async () => {
    const s = await w.post('/api/account/start', { rol: 'kantoor' }, M.token);
    K = s.data && s.data.token;
    const l = await post(MIJN, {});
    return { klopt: s.status === 200 && JSON.stringify(l.data || {}).includes(id), ziet: 'sessie ' + s.status + ', lijst ' + l.status };
  });
  await stap('persistent', 'een read-only lezer vindt het document in de opslag', async () => {
    const plek = w.vindInOpslag(titel);
    return { klopt: plek.length >= 1, ziet: plek.map((p) => p.bestand + '/' + p.tabel + (p.sleutel ? ':' + p.sleutel : '')).join(', ') || 'nergens' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op "Nieuw document" maakt er een', async () => {
    const t = 'Dubbel ' + merk;
    const [a, b] = await w.dubbel(MAAK, { soort: 'tekst', titel: t, idem: 'dub-' + merk }, K);
    const n = (JSON.stringify((await post(MIJN, {})).data).match(new RegExp(t, 'g')) || []).length;
    return { klopt: a.status === 200 && b.status === 200 && n === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', ' + n + ' in de lijst' };
  });
  await stap('herstelbaar', 'een afgebroken autosave, daarna dezelfde autosave opnieuw: geen vals versieconflict, een versie erbij', async () => {
    const d = await open(id);
    const lijf = { id, titel, inhoud: { tekst: 'Na de onderbreking ' + merk }, verwachtGewijzigd: d.gewijzigd };
    const half = await w.afgebroken(BEWAAR, lijf, K);
    const opnieuw = await post(BEWAAR, lijf);
    const na = await open(id);
    return { klopt: opnieuw.status === 200 && tekst(na) === 'Na de onderbreking ' + merk && na.versies === d.versies + 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status +
        (opnieuw.data && opnieuw.data.code ? ' ' + opnieuw.data.code : '') + ', versies ' + d.versies + ' -> ' + na.versies };
  });
  await stap('herstelbaar', 'een crash direct na het aanmaken: na de herstart is er een document, en de herhaling krijgt hetzelfde', async () => {
    const t = 'Stroom ' + merk;
    const r = await post(MAAK, { soort: 'tekst', titel: t, idem: 'crash-' + merk });
    await w.crash();
    const opnieuw = await post(MAAK, { soort: 'tekst', titel: t, idem: 'crash-' + merk });
    const n = (JSON.stringify((await post(MIJN, {})).data).match(new RegExp(t, 'g')) || []).length;
    return { klopt: r.status === 200 && opnieuw.status === 200 && opnieuw.data.id === r.data.id && n === 1,
      ziet: 'na SIGKILL: zelfde id ' + (opnieuw.data && opnieuw.data.id === r.data.id) + ', ' + n + ' in de lijst' };
  });
}

module.exports = {
  functie: 'link:office',
  ingang: '/apps/office.html',
  persona: 'kantoor',
  omgeving: KANTOORWERELD,
  belofte: 'een medewerker maakt een document in de kantoordrive, bewaart met versies, zet een versie terug en vindt het na een herstart terug; een oud venster schrijft er niet overheen en een zaak of lid komt er niet bij',
  grens: 'De proef loopt de routes van het scherm in de kantoorstand (?werk=kantoor), niet het scherm zelf en niet de andere vier drives (lid, zaak, werkplek, RTFoundation). Alleen het tekstdocument; rekenblad, presentatie, formulier, delen, export en AI zijn niet beproefd. Geen Redis of PostgreSQL.',
  loop
};
