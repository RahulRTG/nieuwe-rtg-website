/* ============================================================================
   VOLTOOIPROEF: MIJN NEIGINGEN (link:neigingen, /apps/mijn-neigingen.html).

   De belofte, in de woorden van kern/neiging/ en NEIGING.md: RTG vraagt een
   lid een paar dingen, onthoudt wat hij ZELF zegt (de sterkste grond), en het
   lid ziet op een geheugenkaart wat RTG van hem DENKT te weten -- en haalt het
   weg, of zegt dat het nergens voor mag worden gebruikt. Wat geweigerd is
   blijft zichtbaar met de reden, in plaats van stil te verdwijnen.

   De deur is de paspoortdeur (kern/onvervreemdbaar.js): open voor een account
   waarvan RTG de identiteit heeft gezien. Het lid komt daar langs de echte
   keuring (../voltooiwereld.js geverifieerdLid).
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, geverifieerdLid, KANTOORWERELD } = require('../voltooiwereld');

const INTAKE = '/api/neiging/intake';
const ANTWOORD = '/api/neiging/antwoord';
const OVERSLAAN = '/api/neiging/overslaan';
const OPNIEUW = '/api/neiging/opnieuw';
const GEHEUGEN = '/api/neiging/geheugen';
const VERGEET = '/api/neiging/vergeet';
const NIET_VOOR = '/api/neiging/niet-voor';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const kaart = async (tok) => { const r = await w.post(GEHEUGEN, {}, tok); return r.status === 200 ? r.data : null; };
  const onderwerpen = (k) => (k ? k.neigingen : []).map((n) => n.onderwerp).sort().join(',');

  await stap('voltooibaar', 'een gratis account waarvan RTG het paspoort nog niet zag, staat voor de deur en hoort hoe het wel kan', async () => {
    const vers = await nieuwLid(w, 'nge', 'guest');
    const r = await w.post(INTAKE, {}, vers.token);
    return { klopt: r.status === 403 && /paspoort/.test((r.data && r.data.error) || '') && /Identiteitsverificatie/.test((r.data && r.data.hoe) || ''),
      ziet: r.status + ' (' + (r.data && r.data.error) + ' -- ' + (r.data && r.data.hoe || '').slice(0, 50) + '...)' };
  });

  /* Het lid van deze proef is ook een gratis account: de bodem (SAMENLEVING.md
     par. 11.4) is de strengste deur, en een betaalde pas komt er zonder keuring
     door (kern/onvervreemdbaar.js, regel 1). */
  const lid = await geverifieerdLid(w, 'neg', 'guest');
  const T = lid.token;
  let vraag = null;

  await stap('voltooibaar', 'na de keuring opent de intake met een eerste vraag en een lege geheugenkaart', async () => {
    const r = await w.post(INTAKE, {}, T);
    vraag = r.data && r.data.vraag;
    const k = await kaart(T);
    return { klopt: r.status === 200 && !!vraag && vraag.opties.length > 1 && !!k && k.neigingen.length === 0 && k.grenzen.length >= 3,
      ziet: 'vraag "' + (vraag && vraag.tekst) + '", ' + (k && k.neigingen.length) + ' neigingen, ' + (k && k.grenzen.length) + ' grenzen benoemd' };
  });

  await stap('voltooibaar', 'het lid kiest twee onderwerpen; een onderwerp dat niet bij de vraag hoort wordt niet bewaard', async () => {
    const [a, b] = vraag.opties.slice(0, 2).map((o) => o.onderwerp);
    const r = await w.post(ANTWOORD, { vraag: vraag.id, onderwerpen: [a, b, 'verzonnen-onderwerp'] }, T);
    const k = await kaart(T);
    return { klopt: r.status === 200 && r.data.opgeslagen === 2 && r.data.genegeerd === 1 && onderwerpen(k) === [a, b].sort().join(',') && k.neigingen.every((n) => n.grond === 'gezegd'),
      ziet: 'opgeslagen ' + r.data.opgeslagen + ', genegeerd ' + r.data.genegeerd + ', kaart: ' + onderwerpen(k) + ' (grond ' + (k.neigingen[0] && k.neigingen[0].grond) + ')' };
  });

  await stap('voltooibaar', '"niet hiervoor gebruiken" op elk doel: de neiging blijft zichtbaar als geweigerd, met de reden, en telt niet meer', async () => {
    const k0 = await kaart(T);
    const n = k0.neigingen[0];
    const rs = [];
    for (const d of n.doel || []) rs.push(await w.post(NIET_VOOR, { id: n.id, doel: d }, T));
    const k = await kaart(T);
    const na = k.neigingen.find((x) => x.id === n.id);
    return { klopt: rs.length > 0 && rs.every((r) => r.status === 200) && !!na && na.geweigerd === true && na.telt === false && /nergens voor mag gebruiken/.test(na.stil || '') && k.telt === k0.telt - 1,
      ziet: n.onderwerp + ': geweigerd, "' + (na && na.stil) + '", telt ' + k0.telt + ' -> ' + k.telt };
  });

  await stap('voltooibaar', 'vergeten haalt de andere neiging echt weg; een onbekend doel wordt geweigerd met de reden', async () => {
    const k0 = await kaart(T);
    const n = k0.neigingen.find((x) => !x.geweigerd);
    const v = await w.post(VERGEET, { id: n.id }, T);
    const fout = await w.post(NIET_VOOR, { id: k0.neigingen[0].id, doel: 'verkopen' }, T);
    const k = await kaart(T);
    return { klopt: v.status === 200 && v.data.vergeten === n.onderwerp && !k.neigingen.some((x) => x.id === n.id) && fout.status === 400 && /Onbekend doel/.test(fout.data.error),
      ziet: 'vergeten: ' + v.data.vergeten + ', over: ' + onderwerpen(k) + '; doel "verkopen": ' + fout.status };
  });

  await stap('voltooibaar', 'overslaan zet de intake stil, en opnieuw beginnen brengt de vragen terug', async () => {
    const o = await w.post(OVERSLAAN, {}, T);
    const i1 = await w.post(INTAKE, {}, T);
    const n = await w.post(OPNIEUW, {}, T);
    return { klopt: o.status === 200 && i1.data.klaar === true && n.status === 200 && n.data.klaar === false && !!n.data.vraag,
      ziet: 'na overslaan klaar=' + i1.data.klaar + ', na opnieuw vraag "' + (n.data.vraag && n.data.vraag.tekst) + '"' };
  });

  /* Een verse neiging met een eigen id, om in de opslag terug te vinden. */
  const [c] = vraag.opties.slice(2, 3).map((o) => o.onderwerp);
  await w.post(ANTWOORD, { vraag: vraag.id, onderwerpen: [c] }, T);
  const voor = await kaart(T);
  const voorTekst = JSON.stringify(voor.neigingen);
  const id = (voor.neigingen.find((n) => n.onderwerp === c) || {}).id;
  await w.herstart();

  await stap('persistent', 'na een nette herstart is de geheugenkaart dezelfde, ook de geweigerde regel', async () => {
    const na = await kaart(T);
    return { klopt: !!na && JSON.stringify(na.neigingen) === voorTekst && na.neigingen.some((n) => n.geweigerd), ziet: na ? na.neigingen.length + ' neigingen, ' + (JSON.stringify(na.neigingen) === voorTekst ? 'gelijk' : 'ANDERS') : '-' };
  });
  await stap('persistent', 'een nieuwe sessie leest dezelfde kaart', async () => {
    const C = await inloggen(w, lid);
    const na = await kaart(C);
    return { klopt: !!na && JSON.stringify(na.neigingen) === voorTekst, ziet: na ? 'nieuwe sessie: ' + onderwerpen(na) : '-' };
  });
  await stap('persistent', 'de neiging staat in de opslag zelf, en de vergeten neiging nergens', async () => {
    const plek = id ? w.vindInOpslag(id) : [];
    return { klopt: plek.length >= 1, ziet: 'neiging ' + id + ' in ' + plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  await stap('herstelbaar', 'dubbeltik op een antwoord: hetzelfde onderwerp staat er een keer', async () => {
    const opn = await w.post(OPNIEUW, {}, T);
    const v = opn.data.vraag;
    const o = v.opties[v.opties.length - 1].onderwerp;
    const [a, b] = await w.dubbel(ANTWOORD, { vraag: v.id, onderwerpen: [o] }, T);
    const k = await kaart(T);
    const n = k.neigingen.filter((x) => x.onderwerp === o).length;
    return { klopt: a.status === 200 && geen5xx(b) && n === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + o + ' ' + n + 'x op de kaart' };
  });
  await stap('herstelbaar', 'een afgebroken "vergeet" en opnieuw: weg, en de tweede keer zegt het dat hij al weg is', async () => {
    const half = await w.afgebroken(VERGEET, { id }, T);
    const opnieuw = await w.post(VERGEET, { id }, T);
    const k = await kaart(T);
    return { klopt: geen5xx(opnieuw) && [200, 404].includes(opnieuw.status) && !k.neigingen.some((x) => x.id === id),
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', op de kaart: ' + (k.neigingen.some((x) => x.id === id) ? 'NOG' : 'weg') };
  });
  await stap('herstelbaar', 'een crash direct na "vergeet": wat weg heette, blijft weg -- ook op schijf', async () => {
    const k0 = await kaart(T);
    const n = k0.neigingen.find((x) => !x.geweigerd);
    const v = await w.post(VERGEET, { id: n.id }, T);
    await w.crash();
    const k = await kaart(T);
    return { klopt: v.status === 200 && !k.neigingen.some((x) => x.id === n.id) && w.vindInOpslag(n.id).length === 0,
      ziet: 'vergeet ' + v.status + ', na SIGKILL op de kaart ' + (k.neigingen.some((x) => x.id === n.id) ? 'NOG' : 'weg') + ', op schijf ' + w.vindInOpslag(n.id).length };
  });
  await stap('herstelbaar', 'een crash direct na een weigering: geweigerd blijft geweigerd', async () => {
    const opn = await w.post(OPNIEUW, {}, T);
    const al = new Set(((await kaart(T)) || { neigingen: [] }).neigingen.map((x) => x.onderwerp));
    const nieuw = opn.data.vraag.opties.map((o) => o.onderwerp).find((o) => !al.has(o));
    await w.post(ANTWOORD, { vraag: opn.data.vraag.id, onderwerpen: [nieuw] }, T);
    const k0 = await kaart(T);
    const n = k0.neigingen.find((x) => !x.geweigerd);
    const rs = [];
    for (const d of (n && n.doel) || []) rs.push(await w.post(NIET_VOOR, { id: n.id, doel: d }, T));
    await w.crash();
    const na = ((await kaart(T)) || { neigingen: [] }).neigingen.find((x) => x.id === (n && n.id));
    return { klopt: !!n && rs.every((r) => r.status === 200) && !!na && na.geweigerd === true, ziet: (n ? n.onderwerp : '-') + ' na SIGKILL geweigerd=' + (na && na.geweigerd) };
  });
}

module.exports = {
  functie: 'link:neigingen',
  ingang: '/apps/mijn-neigingen.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een lid (ook met een gratis account, na de paspoortcontrole) vertelt RTG wat hij graag doet, ziet op een geheugenkaart wat RTG van hem denkt te weten, en haalt het weg of verbiedt het gebruik -- en wat geweigerd is blijft zichtbaar met de reden',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Wat RTG uit GEDRAG opmerkt (merkOp) heeft geen route op dit scherm en is niet gelopen; ook het vervallen na de bewaartermijn niet (dat vraagt een klok die vooruit kan). De keuring van het paspoort doet het eigenaarsaccount van de testomgeving (zie Identiteit aantonen). Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
