/* ============================================================================
   VOLTOOIPROEF: MIJN LOON (link:loonstrook, /apps/loonstrook.html).

   De belofte van het scherm: een medewerker ziet zijn eigen loonstrook met de
   uitleg erbij, kan per strook vragen waarom dit bedrag (het dossier), en ziet
   wie zijn papieren opvroeg -- en niemand anders ziet die strook.

   Het scherm zelf schrijft niets; de strook ontstaat aan de andere kant. De
   proef bouwt die kant langs de echte deuren, zoals test/loonstrook-portaal.
   test.js: de zaak MERIDIAAN (de Nederlandse zaak uit de seed) nodigt uit, een
   vers lid verbindt zich met de wervingslink, het kantoor merkt de
   meegeleverde jaargang UITDRUKKELIJK aan als ongecontroleerd, de zaak legt een
   vast contract vast, en daarna vier ogen -- de zaak en een administrateur op
   naam -- en definitief. Vanaf dan meet de proef wat het lid in zijn eigen
   scherm ziet.

   HERSTELBAAR gaat hier over wat het lid ziet als het misgaat: een dubbele tik
   op het dossier, een afgebroken laadbeurt, en een crash vlak na het
   definitief maken. Zijn strook mag dan niet verdwijnen, niet verdubbelen en
   geen ander bedrag tonen.
   ========================================================================== */
'use strict';
const { nieuwLid, kantoorMedewerker, eigenaarSessie, KANTOORWERELD } = require('../voltooiwereld');

const STROKEN = '/api/member/loonstroken';
const DOSSIER = '/api/member/dossier';
const VERZOEKEN = '/api/member/identiteit/verzoeken';

const ZAAK = 'MERIDIAAN', MANAGER = 99;

async function loop(w, stap) {
  const PERIODE = '2026-09', TWEEDE = '2026-08';
  const zaak = async () => (await w.post('/api/supplier/login', { code: ZAAK, staffId: MANAGER, pin: '1234' })).data.token;
  let Z = await zaak();
  const L = await nieuwLid(w, 'loon');
  const A = await kantoorMedewerker(w, 'loonadm');
  let staffId = null, runId = null, netto = null;
  const stroken = async (tok) => (((await w.post(STROKEN, {}, tok || L.token)).data) || {}).stroken || [];

  async function run(periode) {
    const o = await w.post('/api/office/payroll/run/open', { code: ZAAK, periode }, A.kantoor);
    if (o.status !== 200) throw new Error('de loonrun ging niet open (' + o.status + ': ' + (o.data && o.data.error) + ')');
    const id = o.data.run.id;
    if ((await w.post('/api/supplier/payroll/keur', { runId: id }, Z)).status !== 200) throw new Error('de zaak keurde niet');
    if ((await w.post('/api/office/payroll/run/keur', { runId: id }, A.kantoor)).status !== 200) throw new Error('het kantoor keurde niet');
    return id;
  }

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een vers lid verbindt zich met de wervingslink van de zaak; zijn loonscherm is nog leeg', async () => {
    const inv = await w.post('/api/supplier/staff/invite', { name: 'Voltooi Medewerker', role: 'staff', func: 'Receptie' }, Z);
    const v = await w.post('/api/werving/verbind', { kassacode: inv.data && inv.data.invite && inv.data.invite.kassacode }, L.token);
    staffId = v.data && v.data.staffId;
    const s = await w.post(STROKEN, {}, L.token);
    return { klopt: inv.status === 200 && v.status === 200 && !!staffId && s.status === 200 && s.data.stroken.length === 0,
      ziet: 'uitnodiging ' + inv.status + ', verbonden ' + v.status + ', stroken ' + (s.data && s.data.stroken.length) };
  });

  await stap('voltooibaar', 'contract, loonrun met vier ogen en definitief: het lid ziet een strook met netto en uitleg, op ongecontroleerde tabellen', async () => {
    const K = await eigenaarSessie(w);
    const regels = (await w.post('/api/office/payroll/regels', { land: 'NL' }, K)).data || {};
    const pakket = (regels.pakketten || []).find((p) => p.geldigVan <= PERIODE + '-01' && (!p.geldigTot || p.geldigTot >= PERIODE + '-01'));
    const keur = await w.post('/api/office/payroll/regels/keur', { land: 'NL', versie: pakket && pakket.versie, ondanks: true,
      reden: 'Voltooiproef: demo-tabellen, geen echte loonstroken' }, A.kantoor);
    const c = await w.post('/api/supplier/payroll/contract', { staffId, vanaf: '2026-01-01', soort: 'vast', uurloonCenten: 1800, urenPerWeek: 32 }, Z);
    runId = await run(PERIODE);
    const d = await w.post('/api/office/payroll/run/definitief', { runId }, A.kantoor);
    const s = (await stroken()).find((x) => x.periode === PERIODE);
    netto = s && s.strook.nettoCenten;
    return { klopt: keur.status === 200 && c.status === 200 && d.status === 200 && !!s && netto > 0 && /vaste loon/.test(s.uitleg) &&
      s.opDemoTabellen === true && s.zaak !== ZAAK,
      ziet: 'regels ' + keur.status + ', contract ' + c.status + ', definitief ' + d.status + ', strook ' + (s ? s.zaak + ' netto ' + netto : 'GEEN') };
  });

  await stap('voltooibaar', 'het lid opent het dossier van zijn strook: wie keurde, met welke regel', async () => {
    const d = await w.post(DOSSIER, { runId }, L.token);
    const a = d.data && d.data.antwoorden;
    return { klopt: d.status === 200 && d.data.medewerker.staffId === staffId && a.wieKeurde.goedkeuringen.length >= 2 && !!a.welkeRegel.versie,
      ziet: 'dossier ' + d.status + ', ' + (a ? a.wieKeurde.goedkeuringen.length + ' goedkeuringen, regel ' + a.welkeRegel.versie : (d.data && d.data.error)) };
  });

  await stap('voltooibaar', 'het inzagespoor antwoordt, en niemand heeft zijn papieren opgevraagd', async () => {
    const v = await w.post(VERZOEKEN, {}, L.token);
    return { klopt: v.status === 200 && Array.isArray(v.data.verzoeken) && v.data.verzoeken.length === 0,
      ziet: 'spoor ' + v.status + ', ' + (v.data && v.data.verzoeken && v.data.verzoeken.length) + ' opvragingen' };
  });

  await stap('bevoegd', 'een ander lid ziet deze strook niet en krijgt het dossier niet, ook niet met de juiste runId', async () => {
    const B = await nieuwLid(w, 'loonb');
    const s = await w.post(STROKEN, {}, B.token);
    const d = await w.post(DOSSIER, { runId }, B.token);
    return { klopt: s.status === 200 && s.data.stroken.length === 0 && d.status === 404 && /niet op uw naam/.test(d.data.error),
      ziet: 'stroken ' + (s.data && s.data.stroken.length) + ', dossier ' + d.status };
  });

  await stap('voltooibaar', 'zonder sessie leest of schrijft niemand iets: beide geven 401 met een melding', async () => {
    const l = await w.post(STROKEN, {});
    const s = await w.post(DOSSIER, { runId: 'x' });
    return { klopt: l.status === 401 && s.status === 401 && !!(l.data && l.data.error) && !!(s.data && s.data.error),
      ziet: 'lezen ' + l.status + ', schrijven ' + s.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat de strook er met hetzelfde netto', async () => {
    const s = (await stroken()).filter((x) => x.runId === runId);
    return { klopt: s.length === 1 && s[0].strook.nettoCenten === netto, ziet: s.length + ' strook, netto ' + (s[0] && s[0].strook.nettoCenten) };
  });
  await stap('persistent', 'het lid logt opnieuw in en opent hetzelfde dossier', async () => {
    const tok = (await w.post('/api/auth/login', { login: L.email, password: L.wachtwoord })).data.token;
    const d = await w.post(DOSSIER, { runId }, tok);
    return { klopt: d.status === 200 && d.data.medewerker.staffId === staffId, ziet: 'nieuwe sessie, dossier ' + d.status };
  });
  await stap('persistent', 'een read-only lezer vindt de run met de strook in de opslag', async () => {
    const plek = w.vindInOpslag(runId);
    return { klopt: plek.length >= 1, ziet: plek.map((p) => p.bestand + '/' + p.tabel + (p.sleutel ? ':' + p.sleutel : '')).join(', ') || 'nergens' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op het dossier geeft twee keer hetzelfde antwoord', async () => {
    const [a, b] = await w.dubbel(DOSSIER, { runId }, L.token);
    return { klopt: a.status === 200 && b.status === 200 && JSON.stringify(a.data.antwoorden) === JSON.stringify(b.data.antwoorden),
      ziet: 'tikken ' + a.status + '/' + b.status };
  });
  await stap('herstelbaar', 'een afgebroken laadbeurt, daarna opnieuw: dezelfde ene strook', async () => {
    const half = await w.afgebroken(STROKEN, {}, L.token);
    const s = (await stroken()).filter((x) => x.runId === runId);
    return { klopt: s.length === 1 && s[0].strook.nettoCenten === netto,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), daarna ' + s.length + ' strook' };
  });
  await stap('herstelbaar', 'een dubbele tik op "definitief" voor een tweede maand: het lid krijgt die strook een keer', async () => {
    Z = await zaak();
    const id = await run(TWEEDE);
    const [a, b] = await w.dubbel('/api/office/payroll/run/definitief', { runId: id }, A.kantoor);
    const s = (await stroken()).filter((x) => x.periode === TWEEDE);
    return { klopt: [a, b].some((x) => x.status === 200) && [a, b].every((x) => x.status < 500) && s.length === 1,
      ziet: 'tikken ' + a.status + '/' + b.status + ', stroken ' + TWEEDE + ': ' + s.length };
  });
  await stap('herstelbaar', 'een crash vlak na het definitief maken: beide stroken staan er, elk een keer, met hetzelfde netto', async () => {
    await w.crash();
    const s = await stroken();
    const eerste = s.filter((x) => x.runId === runId);
    return { klopt: eerste.length === 1 && eerste[0].strook.nettoCenten === netto && s.filter((x) => x.periode === TWEEDE).length === 1,
      ziet: 'na SIGKILL: ' + s.length + ' stroken, ' + PERIODE + ' netto ' + (eerste[0] && eerste[0].strook.nettoCenten) };
  });
}

module.exports = {
  functie: 'link:loonstrook',
  ingang: '/apps/loonstrook.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een medewerker ziet zijn eigen loonstrook met uitleg en dossier en wie zijn papieren opvroeg; die strook staat er na een herstart en een crash precies een keer, en een ander lid ziet hem niet',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf. De strook rust op de meegeleverde NL-jaargang die het kantoor uitdrukkelijk als ongecontroleerd aanmerkt; dat zegt niets over juiste bedragen. Geen klokuren (een vast contract), geen betaalbestand en geen aangifte. De zaak logt in met de seed-personeelspin. Geen Redis of PostgreSQL.',
  loop
};
