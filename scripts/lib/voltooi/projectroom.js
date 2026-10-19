/* ============================================================================
   VOLTOOIPROEF: PROJECT ROOM (link:projectroom, /apps/project-room.html).

   De belofte van het scherm: een project dat uit een echte vraag ontstond,
   wordt aantoonbaar uitgevoerd -- taken af, bewijs met herkomst, en pas dan
   een menselijke oplevering met wat er geleerd is. Wie het project niet
   heeft, wijzigt er niets aan.

   De bron is echt: een lid stuurt de medewerker een RTMAIL op zijn codenaam,
   en de medewerker maakt daar in RTG One een project van (/api/rtgone/project/
   van-mail, de route van /apps/rtgone.html). Vanaf dan loopt alles over de
   routes die Project Room zelf aanroept.
   ========================================================================== */
'use strict';
const { kantoorMedewerker, nieuwLid, KANTOORWERELD } = require('../voltooiwereld');

const START = '/api/account/start';
const STATE = '/api/rtgone/state';
const VAN_MAIL = '/api/rtgone/project/van-mail';
const TAAK = '/api/rtgone/project/taak';
const BEWIJS = '/api/rtgone/project/bewijs';
const OPLEVER = '/api/rtgone/project/oplever';
const BEWAAR = '/api/member/rtmail/concept/bewaar';
const VERSTUUR = '/api/member/rtmail/concept/verstuur';

const adresVan = (codenaam) => String(codenaam).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '') + '@rtmail';

async function loop(w, stap) {
  const merk = 'P' + Date.now().toString(36).slice(-5);
  const M = await kantoorMedewerker(w, 'prm');
  const N = await kantoorMedewerker(w, 'prn');
  const L = await nieuwLid(w, 'prl');
  const state = (tok) => w.post(STATE, { huis: 'rtg' }, tok || M.kantoor);
  const project = async (id, tok) => ((await state(tok)).data.projecten || []).find((p) => p.id === id);

  /* Een lid mailt de medewerker; geeft het bericht-id terug zoals Vandaag het toont. */
  async function vraag(onderwerp) {
    const c = await w.post(BEWAAR, { naar: adresVan(M.codenaam), onderwerp, tekst: 'Kunt u dit voor mij regelen?' }, L.token);
    const v = await w.post(VERSTUUR, { id: c.data && c.data.concept && c.data.concept.id }, L.token);
    if (v.status !== 200) throw new Error('de RTMAIL aan de medewerker ging niet weg (' + v.status + ')');
    const item = ((await state()).data.vandaag.items || []).find((x) => x.soort === 'rtmail' && x.titel === onderwerp);
    if (!item) throw new Error('de RTMAIL staat niet in Vandaag van de medewerker');
    return item.id;
  }
  async function nieuwProject(onderwerp) {
    const r = await w.post(VAN_MAIL, { huis: 'rtg', mailId: await vraag(onderwerp), deadline: '2026-12-15', bedoeling: 'Het lid aantoonbaar helpen.' }, M.kantoor);
    if (r.status !== 200) throw new Error('van de mail kwam geen project (' + r.status + ')');
    return r.data.project;
  }
  let P = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een lid mailt de medewerker; die ziet het in Vandaag en maakt er een project van met drie uitvoeringstaken', async () => {
    const s = await w.post(START, { rol: 'kantoor' }, M.token);
    const mailId = await vraag('Zakenreis ' + merk);
    const r = await w.post(VAN_MAIL, { huis: 'rtg', mailId, deadline: '2026-12-15', bedoeling: 'Het lid aantoonbaar helpen.' }, M.kantoor);
    P = r.data && r.data.project;
    const p = P && await project(P.id);
    return { klopt: s.status === 200 && r.status === 200 && !!p && p.taken.length === 3 && p.status === 'intake' && p.bron.mailId === mailId,
      ziet: 'project ' + r.status + ', ' + (p ? p.taken.length + ' taken, stand ' + p.status : 'niet in Project Room') };
  });

  await stap('voltooibaar', 'hij rondt de drie taken af in Project Room; het project staat klaar voor oplevering', async () => {
    const uit = [];
    for (const t of P.taken) uit.push((await w.post(TAAK, { id: P.id, taakId: t.id, af: true }, M.kantoor)).status);
    const p = await project(P.id);
    return { klopt: uit.every((x) => x === 200) && p.taken.every((t) => t.af) && p.status === 'oplevering',
      ziet: 'taken ' + uit.join('/') + ', stand ' + p.status + ', voortgang ' + p.voortgang };
  });

  await stap('voltooibaar', 'opleveren zonder bewijs wordt geweigerd met de reden; daarna legt hij bewijs met herkomst vast', async () => {
    const zonder = await w.post(OPLEVER, { projectId: P.id, uitkomst: 'Klaar' }, M.kantoor);
    const b = await w.post(BEWIJS, { projectId: P.id, titel: 'Reisschema ' + merk, uitleg: 'Toont de bevestigde route.', bron: 'RTDocs versie 2' }, M.kantoor);
    const p = await project(P.id);
    return { klopt: zonder.status === 409 && /bewijs/.test(zonder.data.error) && b.status === 200 && p.bewijs.length === 1 && p.bewijs[0].bron === 'RTDocs versie 2',
      ziet: 'zonder bewijs ' + zonder.status + ' (' + (zonder.data && zonder.data.error) + '), bewijs ' + b.status };
  });

  await stap('voltooibaar', 'hij levert menselijk op: afgerond, 100 procent, met uitkomst en leerregel', async () => {
    const r = await w.post(OPLEVER, { projectId: P.id, uitkomst: 'Het lid reist met een bevestigd schema.', leren: 'Vraag eerder naar de voorkeuren.' }, M.kantoor);
    const p = await project(P.id);
    return { klopt: r.status === 200 && p.status === 'afgerond' && p.voortgang === 100 && p.oplevering.leren === 'Vraag eerder naar de voorkeuren.',
      ziet: 'opleveren ' + r.status + ', stand ' + p.status + ', ' + p.voortgang + '%' };
  });

  await stap('voltooibaar', 'een andere medewerker wijzigt niets aan dit project, en een lid zonder kantoorrol komt er niet bij', async () => {
    const Q = await nieuwProject('Tweede vraag ' + merk);
    const taak = await w.post(TAAK, { id: Q.id, taakId: Q.taken[0].id, af: true }, N.kantoor);
    const bewijs = await w.post(BEWIJS, { projectId: Q.id, titel: 'Vals', uitleg: 'Niet van mij' }, N.kantoor);
    const lid = await w.post(TAAK, { id: Q.id, taakId: Q.taken[0].id, af: true }, L.token);
    const q = await project(Q.id);
    return { klopt: taak.status === 403 && bewijs.status === 403 && lid.status === 401 && !q.taken[0].af && q.bewijs.length === 0,
      ziet: 'collega: taak ' + taak.status + ', bewijs ' + bewijs.status + '; lid ' + lid.status + '; project ongewijzigd ' + (!q.taken[0].af && q.bewijs.length === 0) };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat het project opgeleverd, met zijn bewijs en tijdlijn', async () => {
    const p = await project(P.id);
    return { klopt: !!p && p.status === 'afgerond' && p.bewijs.length === 1 && p.tijdlijn.some((t) => t.soort === 'oplevering'),
      ziet: p ? p.status + ', ' + p.bewijs.length + ' bewijs, ' + p.tijdlijn.length + ' tijdlijnregels' : 'WEG' };
  });
  await stap('persistent', 'in een nieuwe kantoorsessie ziet hij hetzelfde project, en de bron-RTMAIL staat vastgezet', async () => {
    const s = await w.post(START, { rol: 'kantoor' }, M.token);
    const p = await project(P.id, s.data && s.data.token);
    const mail = ((w.collectie('rtmail') || {}).berichten || []).find((m) => m.id === P.bron.mailId);
    return { klopt: s.status === 200 && !!p && p.status === 'afgerond' && !!mail && mail.vastgezet === true,
      ziet: 'sessie ' + s.status + ', project ' + (p && p.status) + ', mail vastgezet ' + (mail && mail.vastgezet) };
  });
  await stap('persistent', 'een read-only lezer vindt het project, de oplevering en de auditregels in de opslag', async () => {
    const o = w.collectie('rtgOne') || {};
    const p = (o.projecten || []).filter((x) => x.id === P.id);
    const audit = (o.audit || []).filter((x) => String(x.object).startsWith(P.id));
    return { klopt: p.length === 1 && p[0].status === 'afgerond' && !!p[0].oplevering && audit.length >= 5 && !JSON.stringify(o).includes(M.kantoor),
      ziet: p.length + ' project, ' + audit.length + ' auditregels, geen sessiesleutel' };
  });

  /* ---------------- herstelbaar ---------------- */
  const R = await nieuwProject('Herstel ' + merk);
  await stap('herstelbaar', 'een dubbele tik op "Bewijs vastleggen" legt het bewijs een keer vast', async () => {
    const lijf = { projectId: R.id, titel: 'Offerte ' + merk, uitleg: 'Toont de prijs.', bron: 'RTDocs' };
    const [a, b] = await w.dubbel(BEWIJS, lijf, M.kantoor);
    const p = await project(R.id);
    return { klopt: a.status === 200 && b.status === 200 && p.bewijs.length === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', bewijs ' + p.bewijs.length };
  });
  await stap('herstelbaar', 'een afgebroken "taak af", daarna opnieuw: de taak is af en staat er een keer', async () => {
    const half = await w.afgebroken(TAAK, { id: R.id, taakId: R.taken[0].id, af: true }, M.kantoor);
    const opnieuw = await w.post(TAAK, { id: R.id, taakId: R.taken[0].id, af: true }, M.kantoor);
    const p = await project(R.id);
    return { klopt: opnieuw.status === 200 && p.taken.length === 3 && p.taken[0].af === true,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + p.taken.length + ' taken' };
  });
  await stap('herstelbaar', 'een crash direct na het bewijs: na de herstart staat het een keer en de herhaling hoort dat', async () => {
    const lijf = { projectId: R.id, titel: 'Factuur ' + merk, uitleg: 'Toont de betaling.', bron: 'RTDocs' };
    const r = await w.post(BEWIJS, lijf, M.kantoor);
    await w.crash();
    const opnieuw = await w.post(BEWIJS, lijf, M.kantoor);
    const p = await project(R.id);
    return { klopt: r.status === 200 && opnieuw.status === 200 && opnieuw.data.herhaald === true && p.bewijs.filter((x) => x.titel === lijf.titel).length === 1,
      ziet: 'na SIGKILL herhaald=' + (opnieuw.data && opnieuw.data.herhaald) + ', ' + p.bewijs.filter((x) => x.titel === lijf.titel).length + ' keer' };
  });
  await stap('herstelbaar', 'een dubbele tik op "Opleveren" levert een keer op, en elk antwoord zegt dat het opgeleverd is', async () => {
    for (const t of R.taken.slice(1)) await w.post(TAAK, { id: R.id, taakId: t.id, af: true }, M.kantoor);
    const [a, b] = await w.dubbel(OPLEVER, { projectId: R.id, uitkomst: 'Geregeld.' }, M.kantoor);
    const p = await project(R.id);
    /* Elk antwoord is eerlijk: of de oplevering (de servergrens voegt een
       gelijktijdige tweeling samen tot hetzelfde antwoord), of "al opgeleverd". */
    const eerlijk = (x) => (x.status === 200 && x.data.project.status === 'afgerond') || (x.status === 400 && /al opgeleverd/.test(x.data.error));
    return { klopt: eerlijk(a) && eerlijk(b) && [a, b].some((x) => x.status === 200) && p.status === 'afgerond' &&
      p.tijdlijn.filter((t) => t.soort === 'oplevering').length === 1,
      ziet: 'tikken ' + a.status + '/' + b.status + ', ' + p.tijdlijn.filter((t) => t.soort === 'oplevering').length + ' oplevering' };
  });
}

module.exports = {
  functie: 'link:projectroom',
  ingang: '/apps/project-room.html',
  persona: 'kantoor',
  omgeving: KANTOORWERELD,
  belofte: 'een medewerker voert een project dat uit een RTMAIL ontstond aantoonbaar uit -- taken, bewijs met herkomst, menselijke oplevering -- en dat staat er na een herstart en een crash precies een keer; een collega of lid wijzigt er niets aan',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf. Het project ontstaat via /api/rtgone/project/van-mail (de route van /apps/rtgone.html), zonder goedkeuringsroute; een project dat op een besluit wacht beproeft decisionroom. De kantooruitnodiging gaat buiten productie zonder passkey. Geen Redis of PostgreSQL.',
  loop
};
