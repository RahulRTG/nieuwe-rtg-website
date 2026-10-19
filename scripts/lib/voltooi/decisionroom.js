/* ============================================================================
   VOLTOOIPROEF: DECISION ROOM (link:decisionroom, /apps/decision-room.html).

   De belofte van het scherm: een voorstel komt controleerbaar op tafel en wordt
   door MENSEN beslist -- nooit door de aanvrager zelf, alleen door wie de rol
   voor dat besluitgebied heeft, en boven de drempel (hier 25.000 euro) met
   twee stemmen. Het besluit en de reden staan er daarna voorgoed.

   Drie mensen, alle drie echt: medewerker A vraagt aan, medewerker B krijgt van
   de eigenaar de rol Finance en stemt, en de eigenaar stemt als tweede. Beide
   medewerkers kregen de kantoorrol met een uitnodiging van de eigenaar en
   openen hun kantoorsessie zoals het scherm dat doet (/api/account/start).
   ========================================================================== */
'use strict';
const { kantoorMedewerker, eigenaarSessie, KANTOORWERELD } = require('../voltooiwereld');

const START = '/api/account/start';
const STATE = '/api/rtgone/state';
const AANVRAAG = '/api/rtgone/goedkeuring';
const BESLIS = '/api/rtgone/goedkeuring/beslis';
const ROL = '/api/rtgone/rol/geef';

const metTitel = (r, titel) => ((r && r.data && r.data.goedkeuringen) || []).filter((g) => g.titel === titel);

async function loop(w, stap) {
  const merk = 'D' + Date.now().toString(36).slice(-5);
  const A = await kantoorMedewerker(w, 'dra');
  const B = await kantoorMedewerker(w, 'drb');
  const K = await eigenaarSessie(w);
  const state = (tok) => w.post(STATE, { huis: 'rtg' }, tok || A.kantoor);
  const voorstel = (titel, idem) => ({ huis: 'rtg', type: 'finance', titel, reden: 'Een tweede leverancier halveert het risico.',
    waaromNu: 'Het contract loopt in december af.', bedrag: 25000, impact: 3, risico: 3, omkeerbaar: true, idem });
  const hoofd = 'Tweede leverancier ' + merk;
  let id = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'medewerker A opent de Decision Room met zijn eigen account en legt een voorstel van 25.000 euro neer', async () => {
    const s = await w.post(START, { rol: 'kantoor' }, A.token);
    const r = await w.post(AANVRAAG, voorstel(hoofd, 'dr-' + merk), A.kantoor);
    const g = r.data && r.data.goedkeuring;
    id = g && g.id;
    const l = await state();
    return { klopt: s.status === 200 && r.status === 200 && !!g && g.status === 'wacht' && g.vereist === 2 && metTitel(l, hoofd).length === 1,
      ziet: 'start ' + s.status + ', aanvraag ' + r.status + ', stand ' + (g && g.status) + ', vereist ' + (g && g.vereist) + ' stemmen' };
  });

  await stap('voltooibaar', 'de aanvrager kan zijn eigen voorstel niet goedkeuren, en B zonder rol mag het niet beoordelen', async () => {
    const zelf = await w.post(BESLIS, { id, besluit: 'goedkeuren', reden: 'Ik vind het goed.' }, A.kantoor);
    const zonderRol = await w.post(BESLIS, { id, besluit: 'goedkeuren', reden: 'Akkoord.' }, B.kantoor);
    const g = metTitel(await state(), hoofd)[0];
    return { klopt: zelf.status === 403 && /eigen aanvraag/.test(zelf.data.error) && zonderRol.status === 403 &&
      /rol mag dit type/.test(zonderRol.data.error) && g && g.stemmen.length === 0 && g.status === 'wacht',
      ziet: 'zelf ' + zelf.status + ', zonder rol ' + zonderRol.status + ', stemmen ' + (g && g.stemmen.length) };
  });

  await stap('voltooibaar', 'de eigenaar geeft B de rol Finance; B stemt voor met een reden en het voorstel wacht op de tweede stem', async () => {
    /* Het scherm vraagt de persoonlijke sleutel (user-42): die van B's eigen sessie. */
    const r2 = await w.post(ROL, { huis: 'rtg', key: B.key, rol: 'finance', naam: B.codenaam }, K);
    const eigen = await state(B.kantoor);
    const rechten = (eigen.data && eigen.data.governance && eigen.data.governance.rechten) || [];
    const v = await w.post(BESLIS, { id, besluit: 'goedkeuren', reden: 'De leverancier is gekeurd.', voorwaarde: 'Jaarlijkse evaluatie' }, B.kantoor);
    const g = v.data && v.data.goedkeuring;
    return { klopt: r2.status === 200 && rechten.includes('besluit:finance') && v.status === 200 && !!g && g.status === 'wacht' && g.stemmen.length === 1 && g.stemmen[0].reden === 'De leverancier is gekeurd.',
      ziet: 'rol ' + r2.status + ' (' + B.key + ': ' + rechten.join(',') + '), stem ' + v.status + ', stand ' + (g && g.status) + ', stemmen ' + (g && g.stemmen.length) };
  });

  await stap('voltooibaar', 'de eigenaar stemt als tweede: het voorstel is goedgekeurd en A ziet het besluit met beide redenen', async () => {
    const v = await w.post(BESLIS, { id, besluit: 'goedkeuren', reden: 'Past binnen het budget.' }, K);
    const g = metTitel(await state(), hoofd)[0];
    return { klopt: v.status === 200 && g && g.status === 'goedgekeurd' && g.stemmen.length === 2 && !!g.beslotenAt,
      ziet: 'stem ' + v.status + ', A ziet ' + (g && g.status) + ' met ' + (g && g.stemmen.length) + ' stemmen' };
  });

  await stap('voltooibaar', 'een gesloten besluit kan niet opnieuw worden beoordeeld', async () => {
    const v = await w.post(BESLIS, { id, besluit: 'afwijzen', reden: 'Toch niet.' }, B.kantoor);
    const g = metTitel(await state(), hoofd)[0];
    return { klopt: v.status === 400 && /al gesloten/.test(v.data.error) && g.status === 'goedgekeurd',
      ziet: 'opnieuw ' + v.status + ', stand ' + g.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat het besluit er nog, goedgekeurd met twee stemmen', async () => {
    const g = metTitel(await state(), hoofd);
    return { klopt: g.length === 1 && g[0].status === 'goedgekeurd' && g[0].stemmen.length === 2,
      ziet: g.length + ' besluit, ' + (g[0] && g[0].status) };
  });
  await stap('persistent', 'B start na de herstart een nieuwe kantoorsessie en houdt zijn rol Finance', async () => {
    const s = await w.post(START, { rol: 'kantoor' }, B.token);
    const l = await w.post(STATE, { huis: 'rtg' }, s.data && s.data.token);
    const r = l.data && l.data.governance && l.data.governance.rechten;
    return { klopt: s.status === 200 && l.status === 200 && Array.isArray(r) && r.includes('besluit:finance') && metTitel(l, hoofd).length === 1,
      ziet: 'sessie ' + s.status + ', rechten ' + (r || []).join(',') };
  });
  await stap('persistent', 'een read-only lezer vindt het besluit met beide stemmen en de auditregels in de opslag', async () => {
    const o = w.collectie('rtgOne') || {};
    const g = (o.goedkeuringen || []).filter((x) => x.id === id);
    const audit = (o.audit || []).filter((x) => x.object === id);
    return { klopt: g.length === 1 && g[0].status === 'goedgekeurd' && g[0].stemmen.length === 2 && audit.length >= 3 &&
      !JSON.stringify(o).includes(A.kantoor),
      ziet: g.length + ' besluit, ' + audit.length + ' auditregels, geen sessiesleutel' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op "Voorstel indienen" legt een voorstel neer', async () => {
    const titel = 'Dubbel ' + merk;
    const [a, b] = await w.dubbel(AANVRAAG, voorstel(titel, 'dub-' + merk), A.kantoor);
    const n = metTitel(await state(), titel).length;
    return { klopt: a.status === 200 && b.status === 200 && n === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', aantal ' + n };
  });
  await stap('herstelbaar', 'een afgebroken indiening, daarna opnieuw met dezelfde sleutel: een voorstel', async () => {
    const titel = 'Half ' + merk;
    const half = await w.afgebroken(AANVRAAG, voorstel(titel, 'half-' + merk), A.kantoor);
    const opnieuw = await w.post(AANVRAAG, voorstel(titel, 'half-' + merk), A.kantoor);
    const n = metTitel(await state(), titel).length;
    return { klopt: opnieuw.status === 200 && n === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', aantal ' + n };
  });
  await stap('herstelbaar', 'een dubbele tik op een stem telt een stem; de tweede hoort dat hij al beoordeeld heeft', async () => {
    const titel = 'Stem ' + merk;
    const r = await w.post(AANVRAAG, voorstel(titel, 'stem-' + merk), A.kantoor);
    const [x, y] = await w.dubbel(BESLIS, { id: r.data.goedkeuring.id, besluit: 'goedkeuren', reden: 'Akkoord.' }, B.kantoor);
    const g = metTitel(await state(), titel)[0];
    const nee = [x, y].find((q) => q.status === 400);
    return { klopt: [x, y].filter((q) => q.status === 200).length === 1 && !!nee && /al beoordeeld/.test(nee.data.error) && g.stemmen.length === 1,
      ziet: 'tikken ' + x.status + '/' + y.status + ', stemmen ' + g.stemmen.length };
  });
  await stap('herstelbaar', 'een crash direct na een voorstel en een stem: na de herstart staat elk precies een keer', async () => {
    const titel = 'Stroom ' + merk;
    const r = await w.post(AANVRAAG, voorstel(titel, 'crash-' + merk), A.kantoor);
    const v = await w.post(BESLIS, { id: r.data.goedkeuring.id, besluit: 'goedkeuren', reden: 'Akkoord voor de storing.' }, B.kantoor);
    await w.crash();
    const opnieuw = await w.post(AANVRAAG, voorstel(titel, 'crash-' + merk), A.kantoor);
    const stemOpnieuw = await w.post(BESLIS, { id: r.data.goedkeuring.id, besluit: 'goedkeuren', reden: 'Akkoord voor de storing.' }, B.kantoor);
    const g = metTitel(await state(), titel);
    return { klopt: r.status === 200 && v.status === 200 && opnieuw.data.herhaald === true && stemOpnieuw.status === 400 &&
      g.length === 1 && g[0].stemmen.length === 1,
      ziet: 'na SIGKILL: voorstel herhaald=' + (opnieuw.data && opnieuw.data.herhaald) + ', stem opnieuw ' + stemOpnieuw.status +
        ', ' + g.length + ' voorstel met ' + (g[0] && g[0].stemmen.length) + ' stem' };
  });
}

module.exports = {
  functie: 'link:decisionroom',
  ingang: '/apps/decision-room.html',
  persona: 'kantoor',
  omgeving: KANTOORWERELD,
  belofte: 'een medewerker legt een voorstel neer en mensen met de juiste rol beslissen het, nooit de aanvrager zelf en boven de drempel met twee stemmen; het besluit staat er na een herstart en een crash precies een keer',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf. De rol Finance geeft de eigenaar langs /api/rtgone/rol/geef, de route die /apps/rtgone.html daarvoor aanroept. Alleen het besluitgebied finance en het huis rtg zijn beproefd. De kantooruitnodiging gaat buiten productie zonder passkey. Geen Redis of PostgreSQL.',
  loop
};
