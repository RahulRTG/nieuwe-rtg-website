/* ============================================================================
   VOLTOOIPROEF: RTG ONE, MIJN WERKDAG (link:rtgone, /apps/rtgone.html).

   De belofte van het scherm: een medewerker op naam legt in zijn werkgeheugen
   vast wat er beloofd is, waarom iets gebeurt en waar werk schuurt, en rondt
   een belofte omkeerbaar af -- en dat staat er morgen nog, precies een keer.

   De medewerker is een echt lid dat de kantoorrol koppelde met een uitnodiging
   van de eigenaar, en zijn kantoorsessie start zoals het scherm dat zelf doet
   (/api/account/start, rol kantoor). Geen gedeelde kantoorcode: dan is er geen
   persoon en draagt "Vandaag" geen persoonlijk overzicht.
   ========================================================================== */
'use strict';
const { kantoorMedewerker, nieuwLid, KANTOORWERELD } = require('../voltooiwereld');

const START = '/api/account/start';
const STATE = '/api/rtgone/state';
const BELOFTE = '/api/rtgone/belofte';
const INTENTIE = '/api/rtgone/intentie';
const FRICTIE = '/api/rtgone/frictie';
const OVERDRACHT = '/api/rtgone/overdracht';
const VOORBEREID = '/api/rtgone/automatisering/voorbereid';
const VOER = '/api/rtgone/automatisering/voer';
const HERSTEL = '/api/rtgone/automatisering/herstel';

const telBelofte = (r, tekst) => ((r && r.data && r.data.beloften) || []).filter((b) => b.belofte === tekst).length;
const opgeslagen = (w) => w.collectie('rtgOne') || {};

async function loop(w, stap) {
  const merk = 'R' + Date.now().toString(36).slice(-5);
  const M = await kantoorMedewerker(w, 'rtgone');
  const state = (huis) => w.post(STATE, { huis: huis || 'rtg' }, M.kantoor);
  const hoofd = 'Offerte ' + merk + ' voor vrijdag naar de partner';
  let belofteId = null, autoId = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'de medewerker opent Mijn werkdag met zijn eigen account en ziet een persoonlijk overzicht', async () => {
    const s = await w.post(START, { rol: 'kantoor' }, M.token);
    const r = await state();
    const v = r.data && r.data.vandaag;
    return { klopt: s.status === 200 && !!s.data.token && r.status === 200 && !!v && v.persoonlijk === true &&
      v.identiteit === M.codenaam && Array.isArray(r.data.beloften),
      ziet: 'start ' + s.status + ', state ' + r.status + ', persoonlijk ' + (v && v.persoonlijk) + ', identiteit ' + (v && v.identiteit) };
  });

  await stap('voltooibaar', 'hij legt een belofte vast en ziet haar als open belofte in zijn huis', async () => {
    const r = await w.post(BELOFTE, { huis: 'rtg', belofte: hoofd, eigenaar: M.codenaam, aan: 'Partner', deadline: '2026-12-01', idem: 'bel-' + merk }, M.kantoor);
    belofteId = r.data && r.data.belofte && r.data.belofte.id;
    const s = await state();
    return { klopt: r.status === 200 && !!belofteId && telBelofte(s, hoofd) === 1 && s.data.stats.beloftenOpen >= 1,
      ziet: 'vastleggen ' + r.status + ', open beloften ' + (s.data && s.data.stats.beloftenOpen) };
  });

  await stap('voltooibaar', 'hij bewaart een bedoeling en berekent de jaarlijkse frictie van een handeling', async () => {
    const i = await w.post(INTENTIE, { huis: 'rtg', titel: 'Bedoeling ' + merk, waarom: 'Partners sneller antwoord geven', idem: 'int-' + merk }, M.kantoor);
    const f = await w.post(FRICTIE, { huis: 'rtg', naam: 'Zoeken ' + merk, minuten: 10, frequentie: 6, uurloon: 60, idem: 'fri-' + merk }, M.kantoor);
    const s = await state();
    const fr = ((s.data && s.data.fricties) || []).find((x) => x.naam === 'Zoeken ' + merk);
    /* 10 min x 6 per week x 52 = 3120 min = 52 uur, x 60 euro = 3120 euro. */
    return { klopt: i.status === 200 && f.status === 200 && !!fr && fr.jaarMinuten === 3120 && fr.jaarCenten === 312000 &&
      s.data.intenties.some((x) => x.titel === 'Bedoeling ' + merk),
      ziet: 'intentie ' + i.status + ', frictie ' + f.status + ', ' + (fr ? fr.jaarMinuten + ' min = ' + fr.jaarCenten + ' cent per jaar' : 'niet terug') };
  });

  await stap('voltooibaar', 'hij rondt de belofte omkeerbaar af en draait het terug binnen het herstelvenster', async () => {
    const v = await w.post(VOORBEREID, { huis: 'rtg', belofteId, idem: 'aut-' + merk }, M.kantoor);
    autoId = v.data && v.data.automatisering && v.data.automatisering.id;
    const voer = await w.post(VOER, { id: autoId }, M.kantoor);
    const af = (await state()).data.beloften.find((b) => b.id === belofteId);
    const terug = await w.post(HERSTEL, { id: autoId }, M.kantoor);
    const weer = (await state()).data.beloften.find((b) => b.id === belofteId);
    return { klopt: v.status === 200 && voer.status === 200 && af && af.status === 'afgerond' && terug.status === 200 && weer && weer.status === 'open',
      ziet: 'voorbereid ' + v.status + ', uitgevoerd -> ' + (af && af.status) + ', teruggedraaid -> ' + (weer && weer.status) };
  });

  await stap('voltooibaar', 'een overdracht neemt zijn open belofte mee naar de vervanger', async () => {
    const r = await w.post(OVERDRACHT, { huis: 'rtg', eigenaar: M.codenaam, naar: 'Vervanger ' + merk, context: 'Vakantie', idem: 'ovr-' + merk }, M.kantoor);
    const o = r.data && r.data.overdracht;
    return { klopt: r.status === 200 && !!o && o.beloften.some((b) => b.id === belofteId),
      ziet: 'overdracht ' + r.status + ', ' + (o ? o.beloften.length : 0) + ' open belofte(n) mee' };
  });

  await stap('voltooibaar', 'een lid zonder kantoorrol krijgt geen kantoorsessie en leest of schrijft niets in RTG One', async () => {
    const V = await nieuwLid(w, 'vreemd');
    const s = await w.post(START, { rol: 'kantoor' }, V.token);
    const l = await w.post(STATE, { huis: 'rtg' }, V.token);
    const b = await w.post(BELOFTE, { huis: 'rtg', belofte: 'Ingeschoven ' + merk }, V.token);
    const t = await state();
    return { klopt: s.status >= 400 && s.status < 500 && !(s.data && s.data.token) && l.status === 401 && b.status === 401 &&
      telBelofte(t, 'Ingeschoven ' + merk) === 0,
      ziet: 'start ' + s.status + ', lezen ' + l.status + ', schrijven ' + b.status + ', ingeschoven ' + telBelofte(t, 'Ingeschoven ' + merk) };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat de belofte er nog precies een keer, weer open', async () => {
    const s = await state();
    const b = s.data && s.data.beloften.find((x) => x.id === belofteId);
    return { klopt: s.status === 200 && telBelofte(s, hoofd) === 1 && !!b && b.status === 'open',
      ziet: 'status ' + s.status + ', aantal ' + telBelofte(s, hoofd) + ', stand ' + (b && b.status) };
  });

  await stap('persistent', 'na een nieuwe aanmelding met zijn account ziet hij dezelfde frictie, overdracht en automatisering', async () => {
    const st = await w.post(START, { rol: 'kantoor' }, M.token);
    const s = await w.post(STATE, { huis: 'rtg' }, st.data && st.data.token);
    const a = s.data && s.data.automatiseringen.find((x) => x.id === autoId);
    return { klopt: st.status === 200 && s.status === 200 && s.data.fricties.some((x) => x.naam === 'Zoeken ' + merk) &&
      s.data.overdrachten.some((x) => x.naar === 'Vervanger ' + merk) && !!a && a.status === 'teruggedraaid',
      ziet: 'nieuwe sessie ' + st.status + ', automatisering ' + (a && a.status) };
  });

  await stap('persistent', 'een read-only lezer vindt belofte, auditregels en geen sessiesleutel in de opslag', async () => {
    const o = opgeslagen(w);
    const b = (o.beloften || []).filter((x) => x.belofte === hoofd);
    const audit = (o.audit || []).filter((x) => [belofteId, autoId].includes(x.object));
    const tekst = JSON.stringify(o);
    return { klopt: b.length === 1 && b[0].status === 'open' && audit.length >= 4 && !tekst.includes(M.kantoor) && !tekst.includes(M.token),
      ziet: b.length + ' belofte, ' + audit.length + ' auditregels, geen sessiesleutel' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op "Veilig opslaan" legt de belofte een keer vast', async () => {
    const tekst = 'Dubbel ' + merk;
    const [a, b] = await w.dubbel(BELOFTE, { huis: 'rtg', belofte: tekst, idem: 'dub-' + merk }, M.kantoor);
    const s = await state();
    return { klopt: a.status === 200 && b.status === 200 && telBelofte(s, tekst) === 1,
      ziet: 'tikken ' + a.status + '/' + b.status + ', aantal ' + telBelofte(s, tekst) };
  });

  await stap('herstelbaar', 'een afgebroken verzoek, daarna opnieuw met dezelfde sleutel: een belofte', async () => {
    const tekst = 'Half ' + merk;
    const lijf = { huis: 'rtg', belofte: tekst, idem: 'half-' + merk };
    const half = await w.afgebroken(BELOFTE, lijf, M.kantoor);
    const opnieuw = await w.post(BELOFTE, lijf, M.kantoor);
    const s = await state();
    return { klopt: opnieuw.status === 200 && telBelofte(s, tekst) === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', aantal ' + telBelofte(s, tekst) };
  });

  await stap('herstelbaar', 'een crash direct na de bevestiging verliest of verdubbelt de belofte niet', async () => {
    const tekst = 'Stroom ' + merk;
    const lijf = { huis: 'rtg', belofte: tekst, idem: 'crash-' + merk };
    const r = await w.post(BELOFTE, lijf, M.kantoor);
    await w.crash();
    const opnieuw = await w.post(BELOFTE, lijf, M.kantoor);
    const s = await state();
    return { klopt: r.status === 200 && opnieuw.status === 200 && opnieuw.data.herhaald === true && telBelofte(s, tekst) === 1,
      ziet: 'bevestigd ' + r.status + ', na SIGKILL ' + opnieuw.status + ' herhaald=' + (opnieuw.data && opnieuw.data.herhaald) + ', aantal ' + telBelofte(s, tekst) };
  });

  await stap('herstelbaar', 'een dubbele tik op "Uitvoeren" voert de automatisering een keer uit; de tweede hoort dat het al gebeurd is', async () => {
    const tekst = 'Afronden ' + merk;
    const b = await w.post(BELOFTE, { huis: 'rtg', belofte: tekst, idem: 'afr-' + merk }, M.kantoor);
    const v = await w.post(VOORBEREID, { huis: 'rtg', belofteId: b.data.belofte.id, idem: 'afr-aut-' + merk }, M.kantoor);
    const [x, y] = await w.dubbel(VOER, { id: v.data.automatisering.id }, M.kantoor);
    const s = await state();
    const stand = s.data.beloften.find((q) => q.id === b.data.belofte.id);
    const ok = [x, y].filter((q) => q.status === 200).length, nee = [x, y].find((q) => q.status === 400);
    return { klopt: ok === 1 && !!nee && /niet worden uitgevoerd/.test(nee.data.error) && stand && stand.status === 'afgerond',
      ziet: 'tikken ' + x.status + '/' + y.status + ', belofte ' + (stand && stand.status) };
  });
}

module.exports = {
  functie: 'link:rtgone',
  ingang: '/apps/rtgone.html',
  persona: 'kantoor',
  omgeving: KANTOORWERELD,
  belofte: 'een medewerker op naam legt beloften, bedoelingen en frictie vast in het werkgeheugen en rondt een belofte omkeerbaar af; dat staat er na een herstart, een dubbele tik, een afgebroken verzoek en een crash precies een keer, en een lid zonder kantoorrol komt er niet bij',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf. De medewerker kreeg zijn kantoorrol via een uitnodiging die de eigenaar buiten productie zonder passkey maakt (de terugval van de route zelf); in productie vraagt dat een passkey. Het huis rtf en gedeeld zijn niet apart beproefd. Geen Redis of PostgreSQL.',
  loop
};
