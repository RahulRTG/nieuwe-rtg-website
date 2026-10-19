/* ============================================================================
   VOLTOOIPROEF: RTG GELD, HET OVERZICHT (link:geldcommand, /apps/geld.html).

   /apps/geld.html opent op de stand Overzicht (apps/geld/overzicht*.js, de
   eerste in de standenbalk): "Hoe u er financieel voor staat en wat er
   aankomt, uit alle standen tegelijk. Rahul let mee binnen uw regels." Achter
   de knop Beleid zet het lid zijn regels en potten. Routes letterlijk uit
   apps/geld/overzichtc.js: /api/geld/cockpit, /beleid, /beleid/zet en
   /api/geld/pot/zet, /reserveer, /weg; plus /api/geld/actielog uit
   overzichtb.js.

   ER BEWEEGT GEEN GELD, en dat is de belofte zelf (GELD.md par. 3): een pot
   is een oormerk binnen het eigen tegoed, en "automatisch" bestaat alleen
   voor het maandelijks reserveren in een eigen pot. De proef meet dus dat een
   oormerk precies een keer telt -- ook bij een dubbele tik, een afgebroken
   verzoek en een crash -- dat de harde grens staat, en dat het actielog elke
   handeling van het lid draagt.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const COCKPIT = '/api/geld/cockpit';
const BELEID = '/api/geld/beleid';
const REGEL_ZET = '/api/geld/beleid/zet';
const POT_ZET = '/api/geld/pot/zet';
const POT_RES = '/api/geld/pot/reserveer';
const POT_WEG = '/api/geld/pot/weg';
const LOG = '/api/geld/actielog';

async function loop(w, stap) {
  const merk = 'gc' + Date.now().toString(36);
  const A = await nieuwLid(w, 'gca');
  const T = A.token;
  const beleid = async (tok) => (await w.post(BELEID, {}, tok || T)).data || {};
  const pot = (b, id) => (b.potten || []).find((p) => p.id === id) || {};
  const codenaam = ((await w.post('/api/member/connections', {}, T)).data || {}).codename;
  const opslag = () => (((w.collectie('geldbeleid') || {}).perLid || {})[codenaam]) || null;
  let vak = null, extra = null, regel = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een lid opent RTG Geld: het overzicht staat, zonder regels en zonder potten', async () => {
    const c = await w.post(COCKPIT, {}, T);
    const b = await beleid();
    return { klopt: c.status === 200 && c.data.ok === true && !!c.data.cijfers && (b.regels || []).length === 0 && (b.potten || []).length === 0,
      ziet: 'overzicht ' + c.status + ', vrij ' + (c.data.cijfers && c.data.cijfers.vrijCenten) + ', ' + (b.regels || []).length + ' regels, ' + (b.potten || []).length + ' potten' };
  });

  await stap('voltooibaar', 'het lid maakt een pot Vakantie met een doel van 500 euro, en het actielog draagt het', async () => {
    const r = await w.post(POT_ZET, { naam: 'Vakantie ' + merk, doelCenten: 50000 }, T);
    vak = r.data && r.data.pot;
    const log = ((await w.post(LOG, {}, T)).data || {}).log || [];
    return { klopt: r.status === 200 && !!vak && vak.standCenten === 0 && pot(await beleid(), vak.id).doelCenten === 50000 &&
      log.some((x) => /Pot gemaakt/.test(x.wat) && x.wie === 'lid'),
      ziet: 'pot ' + r.status + ', ' + log.length + ' logregel(s)' };
  });

  await stap('voltooibaar', 'het lid zet 120 euro opzij en geeft er 20 vrij; meer vrijgeven dan er staat wordt geweigerd', async () => {
    const a = await w.post(POT_RES, { id: vak.id, centen: 12000, idem: merk + '-res' }, T);
    const b = await w.post(POT_RES, { id: vak.id, centen: -2000, idem: merk + '-vrij' }, T);
    const te = await w.post(POT_RES, { id: vak.id, centen: -99999, idem: merk + '-te' }, T);
    const p = pot(await beleid(), vak.id);
    return { klopt: a.status === 200 && b.status === 200 && te.status === 400 && /meer vrijgeven kan niet/.test(te.data.error) && p.standCenten === 10000,
      ziet: 'opzij ' + a.status + ', vrij ' + b.status + ', te veel ' + te.status + '; stand ' + p.standCenten };
  });

  await stap('voltooibaar', 'een maandelijkse reservering mag automatisch; een minimumbuffer automatisch niet (de harde grens)', async () => {
    const r = await w.post(REGEL_ZET, { soort: 'reserveer-maandelijks', drempelCenten: 5000, niveau: 'automatisch', potId: vak.id, aan: true }, T);
    regel = r.data && r.data.regel;
    const nee = await w.post(REGEL_ZET, { soort: 'minimumbuffer', drempelCenten: 10000, niveau: 'automatisch', aan: true }, T);
    const b = await beleid();
    return { klopt: r.status === 200 && !!regel && nee.status === 400 && /klaarzetten/.test(nee.data.error) && (b.regels || []).length === 1,
      ziet: 'maandelijks automatisch ' + r.status + ', buffer automatisch ' + nee.status + ' (' + (nee.data && nee.data.error || '').slice(0, 60) + ')' };
  });

  await stap('voltooibaar', 'een pot waar een regel in reserveert gaat niet stil weg; een losse pot wel, en dat staat in het log', async () => {
    const vast = await w.post(POT_WEG, { id: vak.id }, T);
    extra = (await w.post(POT_ZET, { naam: 'Los ' + merk, doelCenten: 1000 }, T)).data.pot;
    const weg = await w.post(POT_WEG, { id: extra.id }, T);
    const b = await beleid();
    const log = ((await w.post(LOG, {}, T)).data || {}).log || [];
    return { klopt: vast.status === 400 && /zet die eerst uit/.test(vast.data.error) && weg.status === 200 && !pot(b, extra.id).id && !!pot(b, vak.id).id &&
      log.some((x) => /Pot weggehaald/.test(x.wat)),
      ziet: 'pot met regel ' + vast.status + ', losse pot ' + weg.status };
  });

  await stap('voltooibaar', 'een ANDER lid ziet geen regels, potten of log van dit lid en kan zijn pot niet raken', async () => {
    const B = await nieuwLid(w, 'gcb');
    const zijn = await beleid(B.token);
    const log = ((await w.post(LOG, {}, B.token)).data || {}).log || [];
    const res = await w.post(POT_RES, { id: vak.id, centen: 100, idem: merk + '-b' }, B.token);
    const weg = await w.post(POT_WEG, { id: vak.id }, B.token);
    const p = pot(await beleid(), vak.id);
    return { klopt: (zijn.potten || []).length === 0 && (zijn.regels || []).length === 0 && log.length === 0 &&
      res.status === 404 && weg.status === 404 && p.standCenten === 10000,
      ziet: 'B ziet ' + (zijn.potten || []).length + ' potten, ' + log.length + ' logregels; reserveren ' + res.status + ', weghalen ' + weg.status + '; stand bij A ' + p.standCenten };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staan de pot met 100 euro en de regel er nog', async () => {
    const b = await beleid();
    return { klopt: pot(b, vak.id).standCenten === 10000 && (b.regels || []).some((r) => r.id === regel.id && r.aan),
      ziet: 'stand ' + pot(b, vak.id).standCenten + ', ' + (b.regels || []).length + ' regel' };
  });

  await stap('persistent', 'een read-only lezer vindt het beleid onder de CODENAAM in de opslag, met het log erbij', async () => {
    const rec = opslag();
    const p = rec && (rec.potten || []).find((x) => x.id === vak.id);
    return { klopt: !!codenaam && !!p && p.standCenten === 10000 && (rec.regels || []).length === 1 && !JSON.stringify(rec).includes(A.email),
      ziet: rec ? 'perLid[' + codenaam + ']: ' + (rec.potten || []).length + ' pot, ' + (rec.regels || []).length + ' regel' : 'niet gevonden' };
  });

  await stap('persistent', 'na de herstart logt het lid opnieuw in en ziet in een nieuwe sessie hetzelfde beleid', async () => {
    const tok = await inloggen(w, A);
    const b = await beleid(tok);
    return { klopt: pot(b, vak.id).standCenten === 10000, ziet: 'nieuwe sessie, stand ' + pot(b, vak.id).standCenten };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op Reserveer (dezelfde sleutel, tegelijk) zet het bedrag een keer opzij', async () => {
    const voor = pot(await beleid(), vak.id).standCenten;
    const [a, b] = await w.dubbel(POT_RES, { id: vak.id, centen: 700, idem: merk + '-dubbel' }, T);
    const na = pot(await beleid(), vak.id).standCenten;
    return { klopt: a.status === 200 && b.status === 200 && na - voor === 700, ziet: 'tikken ' + a.status + '/' + b.status + ', stand +' + (na - voor) };
  });

  await stap('herstelbaar', 'een afgebroken reservering, daarna opnieuw met dezelfde sleutel: een keer opzij', async () => {
    const voor = pot(await beleid(), vak.id).standCenten;
    const half = await w.afgebroken(POT_RES, { id: vak.id, centen: 300, idem: merk + '-half' }, T);
    const opnieuw = await w.post(POT_RES, { id: vak.id, centen: 300, idem: merk + '-half' }, T);
    const na = pot(await beleid(), vak.id).standCenten;
    return { klopt: opnieuw.status === 200 && na - voor === 300,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', stand +' + (na - voor) };
  });

  await stap('herstelbaar', 'een crash direct na een reservering, daarna dezelfde tik opnieuw: niet verloren en niet verdubbeld', async () => {
    const voor = pot(await beleid(), vak.id).standCenten;
    const r = await w.post(POT_RES, { id: vak.id, centen: 900, idem: merk + '-crash' }, T);
    await w.crash();
    const opnieuw = await w.post(POT_RES, { id: vak.id, centen: 900, idem: merk + '-crash' }, T);
    const na = pot(await beleid(), vak.id).standCenten;
    return { klopt: r.status === 200 && opnieuw.status === 200 && na - voor === 900,
      ziet: 'gereserveerd ' + r.status + ', na SIGKILL ' + opnieuw.status + (opnieuw.data && opnieuw.data.herhaald ? ' (herhaald)' : '') + ', stand +' + (na - voor) };
  });
}

module.exports = {
  functie: 'link:geldcommand',
  ingang: '/apps/geld.html',
  persona: 'lid',
  belofte: 'een lid ziet hoe het er financieel voor staat, zet potten en regels binnen de harde grens van GELD.md (automatisch alleen voor reserveren in een eigen pot) en leest elke handeling terug in het actielog -- een ander lid ziet of raakt er niets van, en een dubbele tik, een afgebroken verzoek of een crash zet een bedrag nooit twee keer opzij',
  grens: 'Er beweegt geen geld: een pot is een oormerk. De gegronde Rahul (/api/geld/rahul), de geldgrenzen (/api/geld/grens) en de inhoud van de cockpitbronnen zijn hier niet beproefd; de proef loopt de routes van de stand, niet de stand zelf, en kent geen Redis of PostgreSQL.',
  loop
};
