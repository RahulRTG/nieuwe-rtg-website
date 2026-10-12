/* ============================================================================
   VOLTOOIPROEF: WAAR BEN IK AANWEZIG (link:sessies, /apps/mijn-sessies.html).

   De belofte, in de woorden van server/routes/member/sessies.js: een lid ziet
   waar het is ingelogd, en SLUITEN WERKT ECHT -- het token van het andere
   toestel wordt ingetrokken, "ook als het toestel offline was toen u dit deed".
   Dat is een noodrem (kern/bestuursroutes.js), en een noodrem die na een
   herstart of een crash loslaat, is geen noodrem.

   WAAROM DIT SCHERM ALS EERSTE KETEN. Het is klein, het heeft een TWEEDE actor
   (het toestel dat je kwijt bent, en dat merkt het), het raakt een zwaar pad
   met een bezitsbewijs (kern/identiteit/bezitsbewijs.js -- de proef tekent met
   een echte ECDSA-sleutel, zoals de browser), en de uitkomst ligt in een eigen
   tabel (`ingetrokken_tokens` in rtg.db) die je los van de server kunt lezen.

   De routes hieronder zijn letterlijk dezelfde als die het scherm aanroept
   (SCHERMROUTES.json, public/apps/mijn-sessies.html); daarop rust de koppeling
   in scripts/lib/bewijsbron.js.
   ========================================================================== */
'use strict';
const { webcrypto } = require('crypto');
const { nieuwLid, inloggen } = require('../voltooiwereld');

const LIJST = '/api/mijn/sessies';
const SLUIT = '/api/mijn/sessies/sluit';
const UITDAGING = '/api/mijn/toestel/uitdaging';
const BIND = '/api/mijn/toestel/bind';

/* Het toestel van het lid: een niet-exporteerbare P-256-sleutel, zoals
   public/apps/mijn-sessies.html hem in de browser maakt. */
async function toestel() {
  const kp = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', kp.publicKey);
  const teken = async (t) => Buffer.from(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' },
    kp.privateKey, Buffer.from(t, 'utf8'))).toString('base64url');
  const bewijs = async (methode, pad) => {
    const kop = Buffer.from(JSON.stringify({ methode, pad, tijd: Date.now(),
      jti: 'v' + require('crypto').randomBytes(12).toString('base64url').replace(/[^A-Za-z0-9_-]/g, 'x') })).toString('base64url');
    return { 'rtg-bezitsbewijs': kop + '.' + await teken(kop) };
  };
  return { jwk, teken, bewijs };
}

const geen5xx = (r) => r && r.status > 0 && r.status < 500;
const telIngetrokken = (w) => Number(w.opslag('rtg.db', 'SELECT COUNT(*) AS n FROM ingetrokken_tokens')[0].n);

async function loop(w, stap) {
  const lid = await nieuwLid(w, 'ses');
  const A = lid.token;
  const sleutel = await toestel();
  let B = null, sidB = null, sidA = null;
  let ingetrokkenNa = null;

  /* ---------------- voltooibaar: de hele bedoeling ---------------- */
  await stap('voltooibaar', 'een tweede toestel logt in, en het lid ziet het in zijn lijst', async () => {
    B = await inloggen(w, lid);
    const l = await w.post(LIJST, {}, A);
    sidA = l.data && l.data.huidige;
    const ander = l.data && (l.data.sessies || []).find((s) => s.sid !== sidA);
    sidB = ander ? ander.sid : null;
    return { klopt: l.status === 200 && !!sidA && !!sidB, ziet: (l.data && (l.data.sessies || []).length) + ' sessies, huidige ' + sidA };
  });

  await stap('voltooibaar', 'het lid bevestigt zijn toestel met een sleutel (uitdaging, handtekening)', async () => {
    const u = await w.post(UITDAGING, {}, A);
    const b = u.data && u.data.nonce ? await w.post(BIND, { jwk: sleutel.jwk, handtekening: await sleutel.teken(u.data.nonce), naam: 'Voltooitoestel' }, A) : u;
    const l = await w.post(LIJST, {}, A);
    const hier = l.data && (l.data.sessies || []).find((s) => s.sid === sidA);
    const sb = hier && hier.stand && hier.stand.sleutelbinding;
    return { klopt: b.status === 200 && b.data && b.data.inSessie === true && !!sb && sb.graad === 'bewezen',
      ziet: 'binden ' + b.status + ', sleutelbinding ' + (sb ? sb.graad : 'afwezig') };
  });

  await stap('voltooibaar', 'het lid sluit het andere toestel op afstand, met een bezitsbewijs', async () => {
    const voor = telIngetrokken(w);
    const r = await w.post(SLUIT, { sid: sidB }, A, await sleutel.bewijs('POST', SLUIT));
    ingetrokkenNa = telIngetrokken(w);
    return { klopt: r.status === 200 && r.data && r.data.gesloten === sidB && ingetrokkenNa > voor,
      ziet: 'status ' + r.status + ', ingetrokken_tokens ' + voor + ' -> ' + ingetrokkenNa };
  });

  await stap('voltooibaar', 'het gesloten toestel merkt het: zijn token wordt geweigerd', async () => {
    const r = await w.post(LIJST, {}, B);
    return { klopt: r.status === 401, ziet: 'het andere toestel krijgt ' + r.status };
  });

  await stap('voltooibaar', 'het lid ziet het andere toestel niet meer, en werkt zelf gewoon door', async () => {
    const l = await w.post(LIJST, {}, A);
    const sids = l.data ? (l.data.sessies || []).map((s) => s.sid) : [];
    return { klopt: l.status === 200 && sids.includes(sidA) && !sids.includes(sidB), ziet: 'lijst: ' + sids.join(', ') };
  });

  /* ---------------- persistent: na een deploy en in een nieuwe sessie ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart blijft het gesloten toestel buiten', async () => {
    const r = await w.post(LIJST, {}, B);
    return { klopt: r.status === 401, ziet: 'het andere toestel krijgt ' + r.status + ' na de herstart' };
  });
  await stap('persistent', 'na de herstart werkt de sessie van het lid nog, en de lijst is dezelfde', async () => {
    const l = await w.post(LIJST, {}, A);
    const sids = l.data ? (l.data.sessies || []).map((s) => s.sid) : [];
    return { klopt: l.status === 200 && sids.includes(sidA) && !sids.includes(sidB), ziet: 'lijst: ' + sids.join(', ') };
  });
  await stap('persistent', 'een nieuwe sessie (een andere browser) ziet hetzelfde', async () => {
    const C = await inloggen(w, lid);
    const l = await w.post(LIJST, {}, C);
    const sids = l.data ? (l.data.sessies || []).map((s) => s.sid) : [];
    return { klopt: l.status === 200 && sids.includes(sidA) && !sids.includes(sidB), ziet: 'lijst in de nieuwe sessie: ' + sids.length + ' sessies, de gesloten er niet bij' };
  });
  await stap('persistent', 'de intrekking staat in de opslag zelf (rtg.db, gelezen buiten de server om)', async () => {
    const n = telIngetrokken(w);
    return { klopt: ingetrokkenNa !== null && n >= ingetrokkenNa, ziet: 'ingetrokken_tokens ' + ingetrokkenNa + ' voor de herstart, ' + n + ' erna' };
  });

  /* ---------------- herstelbaar: dubbel, herhaald, afgebroken, crash ---------------- */
  await stap('herstelbaar', 'dubbelklik: dezelfde sessie nog eens sluiten geeft een nette weigering en verandert niets', async () => {
    const r = await w.post(SLUIT, { sid: sidB }, A, await sleutel.bewijs('POST', SLUIT));
    const nogB = await w.post(LIJST, {}, B);
    const nogA = await w.post(LIJST, {}, A);
    return { klopt: geen5xx(r) && r.status !== 200 && nogB.status === 401 && nogA.status === 200,
      ziet: 'tweede keer ' + r.status + ' (' + (r.data && r.data.error) + '), andere toestel ' + nogB.status + ', lid ' + nogA.status };
  });

  await stap('herstelbaar', 'een netwerkherhaling met hetzelfde bewijs doet niets twee keer', async () => {
    const D = await inloggen(w, lid);
    const l = await w.post(LIJST, {}, A);
    const sidD = (l.data.sessies || []).map((s) => s.sid).find((s) => s !== sidA);
    const kop = await sleutel.bewijs('POST', SLUIT);
    const eerste = await w.post(SLUIT, { sid: sidD }, A, kop);
    const herhaling = await w.post(SLUIT, { sid: sidD }, A, kop);
    const nogD = await w.post(LIJST, {}, D);
    return { klopt: eerste.status === 200 && geen5xx(herhaling) && herhaling.status !== 200 && nogD.status === 401,
      ziet: 'eerste ' + eerste.status + ', herhaling ' + herhaling.status + ' (' + (herhaling.data && herhaling.data.error) + '), toestel ' + nogD.status };
  });

  await stap('herstelbaar', 'een afgebroken sluitverzoek laat geen halve stand na, en opnieuw proberen maakt het af', async () => {
    const E = await inloggen(w, lid);
    const l = await w.post(LIJST, {}, A);
    const sidE = (l.data.sessies || []).map((s) => s.sid).find((s) => s !== sidA);
    const half = await w.afgebroken(SLUIT, { sid: sidE }, A, await sleutel.bewijs('POST', SLUIT));
    const opnieuw = await w.post(SLUIT, { sid: sidE }, A, await sleutel.bewijs('POST', SLUIT));
    const nogE = await w.post(LIJST, {}, E);
    const nogA = await w.post(LIJST, {}, A);
    /* Twee eindes zijn goed: het afgebroken verzoek deed het werk (dan zegt de
       herhaling 404), of het deed niets (dan doet de herhaling het, 200). Wat
       niet mag: een 5xx, of een toestel dat na afloop nog binnenkomt. */
    return { klopt: geen5xx(opnieuw) && [200, 404].includes(opnieuw.status) && nogE.status === 401 && nogA.status === 200,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', toestel ' + nogE.status };
  });

  await stap('herstelbaar', 'een crash direct na de bevestiging: wat gesloten heette, blijft gesloten', async () => {
    const F = await inloggen(w, lid);
    const l = await w.post(LIJST, {}, A);
    const sidF = (l.data.sessies || []).map((s) => s.sid).find((s) => s !== sidA);
    const r = await w.post(SLUIT, { sid: sidF }, A, await sleutel.bewijs('POST', SLUIT));
    await w.crash();
    const nogF = await w.post(LIJST, {}, F);
    const nogA = await w.post(LIJST, {}, A);
    return { klopt: r.status === 200 && nogF.status === 401 && nogA.status === 200,
      ziet: 'sluiten ' + r.status + ', na SIGKILL en herstart: toestel ' + nogF.status + ', lid ' + nogA.status };
  });
}

module.exports = {
  functie: 'link:sessies',
  ingang: '/apps/mijn-sessies.html',
  persona: 'lid',
  belofte: 'een lid ziet waar het is ingelogd en sluit een ander toestel op afstand -- en dat toestel blijft buiten, ook na een herstart of een crash',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf: dat de knoppen dit ook doen, is bewijs 2 (bedienbaar). Er is geen Redis of PostgreSQL in de wereld; de intrekking is gemeten op de SQLite-opslag van een enkel proces. Een toestel intrekken (/api/mijn/toestel/introk) en "sluit alle andere" zijn andere handelingen en hier niet gelopen.',
  loop
};
