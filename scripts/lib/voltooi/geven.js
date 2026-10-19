/* ============================================================================
   VOLTOOIPROEF: GEVEN AAN DE RTFOUNDATION (link:geven, /apps/foundation/geven.html).

   De belofte van het scherm: wie wil geven, ziet EERST wat er zou gebeuren (is
   het een gift of sponsoring, welk stuk komt eruit), bevestigt daarna, en een
   tweede tik is geen tweede gift. Een meerjarige afspraak stelt hij voor, de
   stichting legt hem vast, en de machtiging erbij tekent en trekt hij zelf in.

   DE WERELD. De doneerknop staat standaard dicht (GIFT.md): de eigenaar van de
   testwereld zet hem open met een ontvangende wallet en de drie vormen, langs
   de boardroomroute. Dat is een besluit dat in productie nog niet genomen is;
   de proef bewijst de keten erachter, niet dat de knop open hoort. De ouder van
   het gezin geeft met zijn eigen account (de giftroutes hangen aan de
   ledensessie), het geld loopt over RTG Pay met de simulatiebank als rail. Een
   geoormerkte gift wijst een ACTIEF project aan, dat langs de vierogen van het
   kantoor ontstaat (../voltooigezin.js).

   DE ONTVANGER is de stichting: het kantoor ziet het voorgestelde plan en legt
   het vast, en de gever ziet die stand daarna terug.
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const simulatiebank = require('../../../server/betaal/synthetisch');
const { nieuwLid, inloggen, gebondenToestel } = require('../voltooiwereld');
const { GEZINSWERELD, accountGezin, openStad, actiefProject } = require('../voltooigezin');

const STAND = '/api/rtfos/gift/stand';
const VOORBEREID = '/api/rtfos/gift/voorbereid';
const BEVESTIG = '/api/rtfos/gift/bevestig';
const PROJECTEN = '/api/rtfos/gift/projecten';
const PLAN_VOORSTEL = '/api/rtfos/gift/plan/voorstel';
const PLAN_MIJN = '/api/rtfos/gift/plan/mijn';
const PLAN_STOP = '/api/rtfos/gift/plan/stop';
const M_MIJN = '/api/rtfos/gift/machtiging/mijn';
const M_TEKEN = '/api/rtfos/gift/machtiging/teken';
const M_INTREK = '/api/rtfos/gift/machtiging/intrek';
const OVERZICHT = '/api/pay/overzicht';

/* Een herhaalsleutel waarmee de simulatiebank de oplading goedkeurt; dezelfde
   afleiding als ./pay.js. De wallet wordt VOORAF gevuld, zodat geen gift op het
   automatisch bijladen leunt: anders kiest de bank per gift een andere afloop. */
const bank = simulatiebank({ crypto, env: {}, echteRail: null });
function betaaldeSleutel(codenaam) {
  for (let i = 0; i < 10000; i++) {
    const idem = 'voltooi-geven-oplaad-' + i;
    const id = 'BW-' + crypto.createHash('sha256').update('pay:' + codenaam + '|pay-oplaad:' + codenaam + ':' + idem).digest('hex').slice(0, 20).toUpperCase();
    if (bank.scenarioVan({ idempotentieSleutel: 'waarheid:' + id }) === 'betaald') return idem;
  }
  throw new Error('geen herhaalsleutel gevonden die "betaald" geeft');
}

async function loop(w, stap) {
  const merk = Date.now().toString(36);
  const stad = await openStad(w, 'Zwolle');
  const project = await actiefProject(w, stad, 'Taalcafe De Wilg ' + merk, 'taal');
  const K = stad.kantoor;
  const open = await w.post('/api/rtfos/gift/stand/zet', { ontvanger: { soort: 'wallet', code: 'RTFOUNDATION' },
    vormen: ['eenmalig', 'geoormerkt', 'periodiek'], stand: 'open' }, K);
  if (open.status !== 200) throw new Error('de giftstand openzetten lukte niet (' + open.status + ')');
  const ouder = await accountGezin(w, 'geef', { kind: true });
  const vreemde = await nieuwLid(w, 'vreemd');
  const toestel = await gebondenToestel(w, ouder.token);
  /* Wat er van de wallet van de gever afging, gelezen over RTG Pay: dat is de
     plek waar een dubbele gift zou opduiken. */
  const giften = async (tok) => {
    const o = await w.post(OVERZICHT, {}, tok || ouder.token, await toestel.bewijs('POST', OVERZICHT));
    return ((o.data && o.data.geschiedenis) || []).filter((g) => /Gift RTFoundation|RTFoundation/.test(g.oms || g.omschrijving || ''));
  };
  const bronnen = () => (((w.collectie('rtfos') || {}).bronnen) || []).filter((b) => b.uitGift && b.gever === codenaam);
  let codenaam = (await w.post(OVERZICHT, {}, ouder.token, await toestel.bewijs('POST', OVERZICHT))).data.codenaam;
  const vul = await w.post('/api/pay/oplaad', { centen: 50000, idem: betaaldeSleutel(codenaam) }, ouder.token, await toestel.bewijs('POST', '/api/pay/oplaad'));
  if (vul.status !== 200) throw new Error('de wallet vullen lukte niet (' + vul.status + ')');
  let plan = null, machtiging = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'de ouder opent Geven: de knop staat open met drie vormen, en het oormerk wijst een echt project aan', async () => {
    const s = await w.post(STAND, {}, ouder.token);
    const p = await w.post(PROJECTEN, {}, ouder.token);
    const lijst = (p.data && p.data.projecten) || [];
    return { klopt: s.status === 200 && s.data.stand === 'open' && s.data.vormen.length === 3 && lijst.some((x) => x.id === project.id),
      ziet: 'stand ' + (s.data && s.data.stand) + ', ' + lijst.length + ' project(en)' };
  });

  await stap('voltooibaar', 'het voornemen zegt wat er zou gebeuren en boekt niets; de bevestiging boekt de gift een keer', async () => {
    const v = await w.post(VOORBEREID, { euro: 25, vorm: 'eenmalig' }, ouder.token);
    const voor = await giften();
    const b = await w.post(BEVESTIG, { euro: 25, vorm: 'eenmalig', idem: 'voltooi-geven-1-' + merk }, ouder.token);
    const na = await giften();
    return { klopt: v.status === 200 && /niets betaald/i.test(v.data.nietGedaan || '') && voor.length === 0 &&
      b.status === 200 && b.data.gegeven === 25 && b.data.stuk === 'ontvangstbevestiging' && na.length === 1 && bronnen().length === 1,
      ziet: 'voornemen ' + v.status + ', vooraf ' + voor.length + ' gift, bevestigd ' + b.status + ', daarna ' + na.length + ' afschrijving en ' + bronnen().length + ' bron' };
  });

  await stap('voltooibaar', 'een geoormerkte gift landt op het gekozen project, met de naam van de server en niet uit de browser', async () => {
    const b = await w.post(BEVESTIG, { euro: 10, vorm: 'geoormerkt', projectId: project.id, project: 'Bestaat Niet', idem: 'voltooi-geven-oor-' + merk }, ouder.token);
    const bron = bronnen().find((x) => x.projectId === project.id);
    const nep = await w.post(BEVESTIG, { euro: 10, vorm: 'geoormerkt', projectId: 'verzonnen', idem: 'voltooi-geven-nep-' + merk }, ouder.token);
    return { klopt: b.status === 200 && !!bron && nep.status >= 400 && nep.status < 500 && bronnen().length === 2,
      ziet: 'oormerk ' + b.status + (bron ? ' op het project' : ' NIET op het project') + ', verzonnen project ' + nep.status };
  });

  await stap('voltooibaar', 'de ouder stelt een plan van vijf jaar voor, het kantoor legt het vast, en de ouder ziet het vastgelegd', async () => {
    const v = await w.post(PLAN_VOORSTEL, { euroPerJaar: 120, jaren: 5, idem: 'plan-' + merk + '-1' }, ouder.token);
    plan = v.data && v.data.plan;
    const kantoor = await w.post('/api/rtfos/gift/plan/lijst', {}, K);
    const gezien = ((kantoor.data && kantoor.data.plannen) || []).some((p) => plan && p.id === plan.id);
    const vast = await w.post('/api/rtfos/gift/plan/vastleggen', { id: plan && plan.id, kenmerk: 'OVK-' + merk, tot: '2031-12-31' }, K);
    const m = ((await w.post(PLAN_MIJN, {}, ouder.token)).data || {}).plannen || [];
    const mijn = m.find((p) => plan && p.id === plan.id) || {};
    return { klopt: v.status === 200 && gezien && vast.status === 200 && mijn.stand === 'vastgelegd',
      ziet: 'voorstel ' + v.status + ', kantoor ziet het ' + gezien + ', vastgelegd ' + vast.status + ', stand bij de gever ' + mijn.stand };
  });

  await stap('voltooibaar', 'de ouder tekent een machtiging met een maximum, en trekt hem daarna zelf in: het plan blijft staan', async () => {
    const t = await w.post(M_TEKEN, { planId: plan && plan.id, houder: 'Ouder geef', ibanEinde: '4321', max: 120, kanaal: 'app' }, ouder.token);
    machtiging = t.data && t.data.machtiging;
    const actief = (((await w.post(M_MIJN, {}, ouder.token)).data || {}).machtigingen || []).filter((x) => x.actief);
    const i = await w.post(M_INTREK, { id: machtiging && machtiging.id }, ouder.token);
    const na = (((await w.post(M_MIJN, {}, ouder.token)).data || {}).machtigingen || []).filter((x) => x.actief);
    const p = ((((await w.post(PLAN_MIJN, {}, ouder.token)).data || {}).plannen) || []).find((x) => plan && x.id === plan.id) || {};
    return { klopt: t.status === 200 && actief.length === 1 && i.status === 200 && na.length === 0 && p.stand === 'vastgelegd',
      ziet: 'tekenen ' + t.status + ', actief ' + actief.length + ', intrekken ' + i.status + ', daarna actief ' + na.length + ', plan ' + p.stand };
  });

  await stap('voltooibaar', 'bevoegdheid: zonder account geen voornemen, geen gift en geen plan (401)', async () => {
    const v = await w.post(VOORBEREID, { euro: 5, vorm: 'eenmalig' });
    const b = await w.post(BEVESTIG, { euro: 5, vorm: 'eenmalig', idem: 'anoniem-' + merk });
    const p = await w.post(PLAN_MIJN, {});
    return { klopt: v.status === 401 && b.status === 401 && p.status === 401,
      ziet: 'voornemen ' + v.status + ', bevestigen ' + b.status + ', plannen ' + p.status };
  });

  await stap('voltooibaar', 'bevoegdheid: een ander lid ziet het plan van de ouder niet en kan het niet stoppen of er een machtiging onder zetten', async () => {
    const m = ((await w.post(PLAN_MIJN, {}, vreemde.token)).data || {}).plannen || [];
    const s = await w.post(PLAN_STOP, { id: plan && plan.id }, vreemde.token);
    const t = await w.post(M_TEKEN, { planId: plan && plan.id, houder: 'Vreemde', ibanEinde: '9999', max: 500 }, vreemde.token);
    const p = ((((await w.post(PLAN_MIJN, {}, ouder.token)).data || {}).plannen) || []).find((x) => plan && x.id === plan.id) || {};
    return { klopt: m.length === 0 && s.status === 403 && t.status === 404 && p.stand === 'vastgelegd',
      ziet: 'vreemde ziet ' + m.length + ' plannen, stoppen ' + s.status + ', machtiging ' + t.status + ', plan ' + p.stand };
  });

  await stap('voltooibaar', 'bevoegdheid: het kind van het gezin geeft niet: zijn gezinssessie opent de giftroutes niet', async () => {
    const b = await w.post(BEVESTIG, { euro: 5, vorm: 'eenmalig', idem: 'kind-' + merk }, ouder.kind.token);
    const s = await w.post(STAND, { code: ouder.kind.code, token: ouder.kind.token });
    return { klopt: b.status === 401 && s.status === 401 && bronnen().length === 2,
      ziet: 'bevestigen met het kindertoken ' + b.status + ', stand met code+token ' + s.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat het plan vastgelegd met de ingetrokken machtiging, en de giften staan er nog', async () => {
    const p = ((((await w.post(PLAN_MIJN, {}, ouder.token)).data || {}).plannen) || []).find((x) => plan && x.id === plan.id) || {};
    const m = (((await w.post(M_MIJN, {}, ouder.token)).data || {}).machtigingen || []);
    const g = await giften();
    return { klopt: p.stand === 'vastgelegd' && m.length === 1 && m[0].actief === false && g.length === 2,
      ziet: 'plan ' + p.stand + ', ' + m.length + ' machtiging (actief ' + (m[0] && m[0].actief) + '), ' + g.length + ' afschrijvingen' };
  });

  await stap('persistent', 'een read-only lezer vindt de twee giften als bron van de stichting, op een codenaam en zonder e-mailadres', async () => {
    const b = bronnen();
    return { klopt: b.length === 2 && b.every((x) => x.gever && !JSON.stringify(x).includes(ouder.email)) && b.some((x) => x.projectId === project.id),
      ziet: b.length + ' bronnen: ' + b.map((x) => x.soort + (x.projectId ? ' (project)' : '')).join(', ') };
  });

  await stap('persistent', 'na de herstart logt de ouder opnieuw in en ziet in een nieuwe sessie hetzelfde plan', async () => {
    const tok = await inloggen(w, ouder);
    const p = ((((await w.post(PLAN_MIJN, {}, tok)).data || {}).plannen) || []);
    return { klopt: p.length === 1 && p[0].stand === 'vastgelegd', ziet: 'nieuwe sessie: ' + p.length + ' plan, ' + (p[0] && p[0].stand) };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op Bevestigen met dezelfde sleutel is een gift', async () => {
    const voor = bronnen().length;
    const [a, b] = await w.dubbel(BEVESTIG, { euro: 15, vorm: 'eenmalig', idem: 'voltooi-geven-dubbel-' + merk }, ouder.token);
    const n = bronnen().length - voor;
    return { klopt: a.status === 200 && b.status === 200 && n === 1 && (await giften()).length === 3,
      ziet: 'tikken ' + a.status + '/' + b.status + ', ' + n + ' nieuwe gift' };
  });

  await stap('herstelbaar', 'een dubbele tik op Voorstellen zet een plan neer en geen twee', async () => {
    const [a, b] = await w.dubbel(PLAN_VOORSTEL, { euroPerJaar: 60, jaren: 5, idem: 'plan-' + merk + '-dubbel' }, ouder.token);
    const p = ((((await w.post(PLAN_MIJN, {}, ouder.token)).data || {}).plannen) || []).filter((x) => x.euroPerJaar === 60);
    return { klopt: a.status === 200 && b.status === 200 && p.length === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', ' + p.length + ' plan van 60 per jaar' };
  });

  await stap('herstelbaar', 'een afgebroken bevestiging, daarna opnieuw met dezelfde sleutel: een gift', async () => {
    const voor = bronnen().length;
    const half = await w.afgebroken(BEVESTIG, { euro: 20, vorm: 'eenmalig', idem: 'voltooi-geven-half-' + merk }, ouder.token);
    const opnieuw = await w.post(BEVESTIG, { euro: 20, vorm: 'eenmalig', idem: 'voltooi-geven-half-' + merk }, ouder.token);
    const n = bronnen().length - voor;
    return { klopt: opnieuw.status === 200 && n === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' nieuwe gift' };
  });

  await stap('herstelbaar', 'een crash direct na de bevestiging verliest de gift niet, en opnieuw bevestigen verdubbelt hem niet', async () => {
    const voor = bronnen().length;
    const r = await w.post(BEVESTIG, { euro: 30, vorm: 'eenmalig', idem: 'voltooi-geven-crash-' + merk }, ouder.token);
    await w.crash();
    const opnieuw = await w.post(BEVESTIG, { euro: 30, vorm: 'eenmalig', idem: 'voltooi-geven-crash-' + merk }, ouder.token);
    const n = bronnen().length - voor;
    return { klopt: r.status === 200 && opnieuw.status === 200 && n === 1 && opnieuw.data.bron === r.data.bron,
      ziet: 'bevestigd ' + r.status + ', na SIGKILL ' + opnieuw.status + (opnieuw.data && opnieuw.data.herhaald ? ' (herhaald)' : '') + ', ' + n + ' nieuwe gift' };
  });
}

module.exports = {
  functie: 'link:geven',
  ingang: '/apps/foundation/geven.html',
  persona: 'gezin',
  omgeving: Object.assign({ RTG_SIMULATIEBANK: '1' }, GEZINSWERELD),
  belofte: 'wie geeft ziet eerst wat er zou gebeuren en bevestigt daarna een keer; een geoormerkte gift landt op een echt project, een meerjarig plan legt de stichting vast, en de machtiging tekent en trekt de gever zelf in -- een ander of een kind kan er niets mee',
  grens: 'De doneerknop staat in productie dicht (GIFT.md); de eigenaar van de testwereld zet hem open, dus dit bewijst de keten erachter en niet dat de knop open hoort. De rail is de simulatiebank via RTG Pay; er loopt geen incasso, want die rail bestaat niet. Het afschrift van de gever wordt over /api/pay/overzicht gelezen, een route die het scherm zelf niet aanroept. De proef loopt de routes van het scherm, niet het scherm zelf, en kent geen Redis of PostgreSQL.',
  loop
};
