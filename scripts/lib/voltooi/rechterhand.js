/* ============================================================================
   VOLTOOIPROEF: DE RECHTERHAND (link:rechterhand, /apps/lifestyle.html, het
   tabblad Zaken met apps/lifestyle-lus.js).

   De belofte, in de woorden van het scherm: een lid vertelt een wens in een
   zin, De Rechterhand regelt hem, en het lid beslist alleen over een concreet
   voorstel buiten zijn mandaat. Dit is dezelfde lus als scripts/conciergeproef.js,
   maar over een ECHT Lifestyle-lid (aangevraagd, door een herleidbaar mens
   geaccepteerd, zie lifestyleLid) in plaats van de demo-inlog, en met wat die
   proef niet doet: een herstart, een crash en een afgebroken verzoek.

   Het kantoor is het eigenaarsaccount van de testwereld; dat is een mens met
   een naam, dus het lid ziet een eigenaar en geen gedeelde code. Er wordt niets
   geboekt: een vastgezet onderdeel is een afspraak in de case, geen reservering
   die een restaurant heeft verwerkt (CLAUDE.md).
   ========================================================================== */
'use strict';
const { nieuwLid, lifestyleLid, inloggen, eigenaarSessie, KANTOORWERELD } = require('../voltooiwereld');

const INTAKE = '/api/member/bureau/lus/intake';
const ZAAK = '/api/member/bureau/lus/zaak';
const BESLIS = '/api/member/bureau/lus/beslis';
const TOELICHTING = '/api/member/bureau/lus/toelichting';
const ZAKEN = '/api/member/bureau/zaken';
const BUREAU = '/api/office/bureau';

async function loop(w, stap) {
  const merk = 'rh' + Date.now().toString(36);
  const lid = await lifestyleLid(w, 'rha');
  const ander = await lifestyleLid(w, 'rhb');
  const rtg = await nieuwLid(w, 'rhc');
  let K = await eigenaarSessie(w);
  const zin = (n) => 'Mijn partner is volgende week jarig. We zijn in Amsterdam, ' + n + ' weet van niets. Diner om 20 uur, geen noten.';
  let id = null, key = null;
  const kantoor = (pad, b) => w.post(BUREAU + '/lus' + pad, Object.assign({ key, id }, b || {}), K);
  const lusZaken = async (T) => (((await w.post(ZAKEN, {}, T)).data || {}).zaken || []).filter((z) => z.werkwijze === 'voorstel');
  const zaak = async (T, welk) => w.post(ZAAK, { id: welk || id }, T);

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'het lid vertelt een wens in een zin; er staat een case met tijd, plaats, harde wens en verrassing', async () => {
    const r = await w.post(INTAKE, { zin: zin(merk), sleutel: 'voltooi-rechterhand-' + merk, speelruimteMin: 30 }, lid.token);
    const c = (r.data && r.data.zaak) || {};
    id = c.id;
    return { klopt: r.status === 200 && !!id && c.tijd === '20:00' && c.plaats === 'Amsterdam' && (c.harde || []).includes('geen noten') && c.verrassing === true,
      ziet: r.status + ': ' + [c.tijd, c.plaats, (c.harde || []).join('+'), c.verrassing ? 'verrassing' : '', c.status].join(' / ') };
  });

  await stap('voltooibaar', 'het kantoor ziet de case als lus-case en een mens op naam pakt hem op; het lid ziet diens codenaam', async () => {
    const b = await w.post(BUREAU, {}, K);
    const rij = ((b.data || {}).zaken || []).find((z) => z.id === id) || {};
    key = rij.key;
    const n = await kantoor('/neem');
    const l = (await zaak(lid.token)).data || {};
    return { klopt: b.status === 200 && rij.lus === true && !!key && n.status === 200 && !!l.eigenaar && !!l.eigenaar.rol && typeof l.eigenaar.naam === 'string' && l.eigenaar.naam === (n.data.eigenaar || {}).naam,
      ziet: 'bureau ' + b.status + ' (lus ' + rij.lus + '), neem ' + n.status + ', lid ziet ' + JSON.stringify(l.eigenaar) };
  });

  await stap('voltooibaar', 'buiten de speelruimte zet het kantoor niet vast: het lid krijgt een voorstel met de reden', async () => {
    await kantoor('/weigering', { reden: 'Volgeboekt om 20:00' });
    const a = await kantoor('/aanbod', { wat: 'Tafel bij het water ' + merk, van: '21:30', duurMin: 120, zaak: 'KIKUNOI', geldigMin: 30, bron: 'beslisser' });
    const k = await kantoor('/kies', { aanbod: ((a.data || {}).aanbod || {}).id });
    const l = (await zaak(lid.token)).data || {};
    return { klopt: a.status === 200 && k.status === 200 && k.data.vastgezet === false && !!l.voorstel && l.voorstel.wat === 'Tafel bij het water ' + merk && !!l.voorstel.reden,
      ziet: 'aanbod ' + a.status + ', kies ' + k.status + ' (vastgezet ' + (k.data && k.data.vastgezet) + '), reden: ' + (l.voorstel && l.voorstel.reden) };
  });

  await stap('voltooibaar', 'het lid laat iets weten en geeft akkoord; pas dan staat het vast en zegt het bericht "Alles is geregeld"', async () => {
    const t = await w.post(TOELICHTING, { id, tekst: 'Graag aan het raam.' }, lid.token);
    const b = await w.post(BESLIS, { id, akkoord: true }, lid.token);
    const l = (await zaak(lid.token)).data || {};
    return { klopt: t.status === 200 && b.status === 200 && b.data.vastgezet === true && l.voorstel === null && !!l.bericht && l.bericht.alles === true,
      ziet: 'toelichting ' + t.status + ', akkoord ' + b.status + ', het lid leest: ' + (l.bericht && l.bericht.tekst) };
  });

  await stap('voltooibaar', 'over een voorstel dat er niet meer ligt kan het lid niet nog eens beslissen', async () => {
    const b = await w.post(BESLIS, { id, akkoord: true }, lid.token);
    return { klopt: b.status === 400 && !!(b.data && b.data.error), ziet: b.status + ' (' + (b.data && b.data.error) + ')' };
  });

  await stap('voltooibaar', 'bevoegd: zonder inlog geeft de intake, de case en het besluit 401', async () => {
    const a = await w.post(INTAKE, { zin: zin('anoniem'), sleutel: 'voltooi-rechterhand-anoniem-' + merk });
    const b = await w.post(ZAAK, { id });
    const c = await w.post(BESLIS, { id, akkoord: false });
    return { klopt: a.status === 401 && b.status === 401 && c.status === 401, ziet: 'intake ' + a.status + ', case ' + b.status + ', besluit ' + c.status };
  });

  await stap('voltooibaar', 'bevoegd: een ander Lifestyle-lid opent deze case niet en beslist er niet over, ook niet met het juiste id', async () => {
    const z = await zaak(ander.token);
    const b = await w.post(BESLIS, { id, akkoord: false }, ander.token);
    const t = await w.post(TOELICHTING, { id, tekst: 'Ik ben iemand anders' }, ander.token);
    const eigen = (await lusZaken(ander.token)).length;
    return { klopt: z.status === 404 && [400, 404].includes(b.status) && t.status === 404 && eigen === 0,
      ziet: 'case ' + z.status + ', besluit ' + b.status + ', toelichting ' + t.status + ', ' + eigen + ' cases bij het andere lid' };
  });

  await stap('voltooibaar', 'bevoegd: een RTG-lid zonder Lifestyle Pass komt niet bij De Rechterhand, en hoort waarom', async () => {
    const a = await w.post(INTAKE, { zin: zin('rtg'), sleutel: 'voltooi-rechterhand-rtg-' + merk }, rtg.token);
    const z = await zaak(rtg.token);
    return { klopt: a.status === 403 && z.status === 403 && /Lifestyle/.test((a.data && a.data.error) || ''),
      ziet: 'intake ' + a.status + ' (' + (a.data && a.data.error) + '), case ' + z.status };
  });

  /* ---------------- persistent ---------------- */
  const voor = JSON.stringify(((await zaak(lid.token)).data || {}).bericht);
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat de case er met hetzelfde bericht en zonder openstaand voorstel', async () => {
    const l = (await zaak(lid.token)).data || {};
    return { klopt: JSON.stringify(l.bericht) === voor && l.voorstel === null && voor.length > 4, ziet: 'bericht ' + (l.bericht && l.bericht.tekst) };
  });
  await stap('persistent', 'een nieuwe sessie van het lid ziet precies een lus-case, met het vastgezette onderdeel', async () => {
    const T = await inloggen(w, lid);
    const l = await lusZaken(T);
    /* De demo-eigenaar van de testwereld wordt bij elke start opnieuw gezet en
       logt daarom opnieuw in; de sessie van het lid overleeft de herstart. */
    K = await eigenaarSessie(w);
    const k = await kantoor('');
    const kz = (k.data || {}).zaak || {};
    const vast = (kz.onderdelen || []).filter((o) => o.wat === 'Tafel bij het water ' + merk);
    return { klopt: l.length === 1 && l[0].id === id && k.status === 200 && vast.length === 1 && vast[0].stand === 'bevestigd',
      ziet: l.length + ' case; het kantoor ziet het onderdeel ' + vast.map((o) => o.stand).join(',') };
  });
  await stap('persistent', 'de case en het onderdeel staan in de opslag zelf (gelezen buiten de server om)', async () => {
    const plek = w.vindInOpslag('Tafel bij het water ' + merk);
    return { klopt: plek.length >= 1, ziet: plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op "vertellen" (dezelfde sleutel, tegelijk) geeft een case, niet twee', async () => {
    const voorN = (await lusZaken(lid.token)).length;
    const [a, b] = await w.dubbel(INTAKE, { zin: zin('dubbel ' + merk), sleutel: 'voltooi-rechterhand-dubbel-' + merk }, lid.token);
    const n = (await lusZaken(lid.token)).length - voorN;
    return { klopt: a.status === 200 && b.status === 200 && n === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', +' + n + ' case' };
  });
  await stap('herstelbaar', 'een afgebroken intake, daarna opnieuw met dezelfde sleutel: precies een case', async () => {
    const voorN = (await lusZaken(lid.token)).length;
    const lijf = { zin: zin('half ' + merk), sleutel: 'voltooi-rechterhand-half-' + merk };
    const half = await w.afgebroken(INTAKE, lijf, lid.token);
    const opnieuw = await w.post(INTAKE, lijf, lid.token);
    const n = (await lusZaken(lid.token)).length - voorN;
    return { klopt: opnieuw.status === 200 && n === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', +' + n + ' case' };
  });
  await stap('herstelbaar', 'een crash direct na de intake, daarna dezelfde tik: de case is er, een keer', async () => {
    const voorN = (await lusZaken(lid.token)).length;
    const lijf = { zin: zin('crash ' + merk), sleutel: 'voltooi-rechterhand-crash-' + merk };
    const r = await w.post(INTAKE, lijf, lid.token);
    await w.crash();
    const opnieuw = await w.post(INTAKE, lijf, lid.token);
    const n = (await lusZaken(lid.token)).length - voorN;
    return { klopt: r.status === 200 && opnieuw.status === 200 && opnieuw.data.herhaald === true && n === 1,
      ziet: 'intake ' + r.status + ', na SIGKILL ' + opnieuw.status + (opnieuw.data && opnieuw.data.herhaald ? ' (herhaald)' : '') + ', +' + n + ' case' };
  });
  await stap('herstelbaar', 'na de crash staat het akkoord nog: het onderdeel is vastgezet en er ligt geen voorstel', async () => {
    const l = (await zaak(lid.token)).data || {};
    return { klopt: l.voorstel === null && JSON.stringify(l.bericht) === voor, ziet: 'bericht ' + (l.bericht && l.bericht.tekst) };
  });
}

module.exports = {
  functie: 'link:rechterhand',
  ingang: '/apps/lifestyle.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een Lifestyle-lid vertelt een wens in een zin, het kantoor pakt hem op, en buiten het mandaat beslist het lid over een concreet voorstel; pas na zijn akkoord staat het vast -- een ander lid, een RTG-lid zonder pas en een anonieme bezoeker komen er niet bij, en een herstart, dubbele tik, afgebroken verzoek of crash verliest of verdubbelt niets',
  grens: 'De proef loopt de routes van het tabblad Zaken (apps/lifestyle-lus.js), niet het scherm zelf, en niet de andere tabbladen van het Privekantoor (woning, kring, bezit, reis, mandaat). Het kantoor is het eigenaarsaccount van de testwereld. Er wordt niets geboekt: een vastgezet onderdeel is een afspraak in de case, geen reservering bij de zaak. De zaakkant, vertragingen en herstel na een omgevallen onderdeel loopt scripts/conciergeproef.js. Geen Redis of PostgreSQL in de wereld.',
  loop
};
