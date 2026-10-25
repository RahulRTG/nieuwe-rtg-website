/* ============================================================================
   VOLTOOIPROEF: WIE HEEFT TOEGANG TOT MIJ (link:relaties, /apps/mijn-relaties.html).

   De belofte, in de woorden van kern/consent.js en kern/consent-relaties.js:
   een lid ziet per partij wie wat van hem mag, bekijkt vooraf wat sluiten doet,
   en zet het stop -- BIJ DE BRON. Het Consent Center bewaart zelf niets; een
   intrekking hier moet dus aankomen in de laag die de toestemming beheert, en
   de ANDERE partij moet het merken.

   TWEE ACTOREN. Lid A machtigt lid B (RTG iD: "mag namens u inloggen bij een
   dienst"); B ziet die machtiging bij zichzelf. A sluit de relatie met B in dit
   scherm; B ziet hem niet meer. Daarnaast commerciele post, een toestemming
   aan RTG zelf, die hier wordt ingetrokken en in Post van RTG uit moet staan.

   Een machtiging geven is een zware handeling: het toestel moet zijn sleutel
   aantonen (bezitsbewijs). Het lid bindt daarom eerst een toestel, langs de
   routes van "Waar ben ik aanwezig" (../voltooiwereld.js gebondenToestel).
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, gebondenToestel } = require('../voltooiwereld');

const OVERZICHT = '/api/toestemming';
const INTREK = '/api/toestemming/intrek';
const RELATIES = '/api/toestemming/relaties';
const GEVOLGEN = '/api/toestemming/relatie/gevolgen';
const SLUIT = '/api/toestemming/relatie/sluit';
const MACHTIG = '/api/rtgid/machtig';
const INZAGE = '/api/rtgid/inzage';
const POST_ZET = '/api/mijn/post/zet';
const POST_STAND = '/api/mijn/post';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const A = await nieuwLid(w, 'rla');
  const B = await nieuwLid(w, 'rlb');
  /* B's codenaam, zoals A hem van B zou horen; en B "doet iets", zodat hij in
     de ledengids staat (kern/gids.js dirTouch). */
  const bState = (await w.post('/api/auth/login', { login: B.email, password: B.wachtwoord })).data.state;
  const codenaamB = bState.user.codename;
  await w.post(INZAGE, {}, B.token);
  const toestel = await gebondenToestel(w, A.token);
  const machtig = async (dienst) => w.post(MACHTIG, { codenaam: codenaamB, dienst, dagen: 7 }, A.token, await toestel.bewijs('POST', MACHTIG));
  const zietB = async (tok) => (((await w.post(INZAGE, {}, tok || B.token)).data || {}).machtigingen || []).filter((m) => m.ik === 'krijg');
  const relatie = async (tok) => (((await w.post(RELATIES, {}, tok || A.token)).data || {}).relaties || []).find((r) => r.naam === codenaamB);
  const partijB = codenaamB.toLowerCase();

  await stap('voltooibaar', 'een vers lid heeft niemand die iets van hem mag, en het overzicht zegt eerlijk wat het niet dekt', async () => {
    const o = await w.post(OVERZICHT, {}, A.token);
    return { klopt: o.status === 200 && o.data.toestemmingen.length === 0 && (o.data.storingen || []).length === 0 && Array.isArray(o.data.nietGedekt) && o.data.nietGedekt.length > 0,
      ziet: o.data.toestemmingen.length + ' toestemmingen, ' + (o.data.nietGedekt || []).length + ' lagen met naam niet gedekt, ' + (o.data.storingen || []).length + ' storingen' };
  });

  await stap('voltooibaar', 'A machtigt B voor een dienst; het overzicht toont het onder B, met het doel en de termijn', async () => {
    const m = await machtig('Belastingdienst');
    const r = await relatie();
    const rij = r && r.rijen.find((x) => x.laag === 'rtgid-machtiging');
    return { klopt: m.status === 200 && !!r && r.teSluiten === 1 && !!rij && /Belastingdienst/.test(rij.wat) && !!rij.tot && !!rij.doel,
      ziet: 'machtig ' + m.status + ', onder ' + (r && r.naam) + ': "' + (rij && rij.wat) + '" tot ' + (rij && rij.tot) };
  });

  await stap('voltooibaar', 'B ziet de machtiging bij zichzelf', async () => {
    const b = await zietB();
    return { klopt: b.length === 1 && b[0].dienst === 'Belastingdienst', ziet: 'B krijgt: ' + b.map((x) => x.dienst + ' van ' + x.van).join(', ') };
  });

  await stap('voltooibaar', 'vooraf de gevolgen bekijken verandert niets, en zegt ook wat het NIET rekent', async () => {
    const g = await w.post(GEVOLGEN, { partij: partijB }, A.token);
    const b = await zietB();
    return { klopt: g.status === 200 && g.data.sluit.length === 1 && g.data.nietGerekend.length >= 2 && b.length === 1,
      ziet: 'sluit ' + g.data.sluit.length + ', niet gerekend ' + g.data.nietGerekend.length + ' punten; B ziet nog ' + b.length };
  });

  await stap('voltooibaar', 'A sluit de relatie met B: de machtiging is bij de bron ingetrokken en B merkt het', async () => {
    const s = await w.post(SLUIT, { partij: partijB }, A.token, await toestel.bewijs('POST', SLUIT));
    const r = await relatie();
    const b = await zietB();
    return { klopt: s.status === 200 && s.data.gesloten === 1 && s.data.mislukt === 0 && !r && b.length === 0,
      ziet: 'gesloten ' + (s.data && s.data.gesloten) + ', mislukt ' + (s.data && s.data.mislukt) + '; relatie ' + (r ? 'NOG' : 'weg') + ', B ziet ' + b.length };
  });

  await stap('voltooibaar', 'commerciele post staat onder RTG zelf, en intrekken hier zet hem uit in de laag die hem beheert', async () => {
    await w.post(POST_ZET, { soort: 'aanbiedingen', kanalen: ['email'], bron: 'voltooiproef' }, A.token);
    const o = await w.post(OVERZICHT, {}, A.token);
    const rij = o.data.toestemmingen.find((x) => x.laag === 'commercieel');
    const i = rij ? await w.post(INTREK, { laag: 'commercieel', id: rij.id }, A.token) : { status: 0 };
    const stand = ((await w.post(POST_STAND, {}, A.token)).data || {}).soorten || [];
    const aan = stand.find((x) => x.id === 'aanbiedingen');
    return { klopt: !!rij && rij.partij === 'rtg' && i.status === 200 && !!aan && aan.aan === false,
      ziet: 'rij ' + (rij ? rij.laag + ' onder ' + rij.wie : 'ONTBREEKT') + ', intrekken ' + i.status + ', in Post van RTG aan=' + (aan && aan.aan) };
  });

  /* ---------------- persistent ---------------- */
  const m2 = await machtig('Notaris');
  const mid = m2.data && m2.data.machtiging && m2.data.machtiging.id;
  const voor = JSON.stringify(await relatie());
  await w.herstart();

  await stap('persistent', 'na een nette herstart staat de relatie er nog, gelijk', async () => {
    const na = JSON.stringify(await relatie());
    return { klopt: voor !== 'undefined' && na === voor, ziet: na === voor ? 'gelijk' : 'ANDERS: ' + String(na).slice(0, 80) };
  });
  await stap('persistent', 'B ziet de machtiging na de herstart nog, ook in een nieuwe sessie', async () => {
    const b = await zietB(await inloggen(w, B));
    return { klopt: b.length === 1 && b[0].dienst === 'Notaris', ziet: 'B krijgt: ' + b.map((x) => x.dienst).join(', ') };
  });
  await stap('persistent', 'de machtiging staat in de opslag zelf, de ingetrokken eerste niet meer als geldig', async () => {
    const plek = mid ? w.vindInOpslag(mid) : [];
    return { klopt: plek.length >= 1, ziet: 'machtiging in ' + plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- bevoegd ---------------- */
  await stap('bevoegd', 'een derde lid ziet of sluit de relatie en machtiging van A en B niet en opent alleen zijn eigen lege overzicht', async () => {
    const C = await nieuwLid(w, 'rlc');
    const toestelC = await gebondenToestel(w, C.token);
    const overzichtC = await w.post(OVERZICHT, {}, C.token);
    const relatiesC = await w.post(RELATIES, {}, C.token);
    const gevolgenC = await w.post(GEVOLGEN, { partij: partijB }, C.token);
    const sluitC = await w.post(SLUIT, { partij: partijB }, C.token, await toestelC.bewijs('POST', SLUIT));
    const naA = await relatie();
    const naB = await zietB();
    const cZietIets = ((overzichtC.data && overzichtC.data.toestemmingen) || []).length > 0 ||
      ((relatiesC.data && relatiesC.data.relaties) || []).length > 0 ||
      ((gevolgenC.data && gevolgenC.data.sluit) || []).length > 0;
    return {
      klopt: overzichtC.status === 200 && relatiesC.status === 200 && geen5xx(gevolgenC) && geen5xx(sluitC) &&
        !cZietIets && !!naA && naB.some((x) => x.dienst === 'Notaris'),
      ziet: 'C overzicht/relaties/gevolgen/sluiten ' + overzichtC.status + '/' + relatiesC.status + '/' + gevolgenC.status + '/' + sluitC.status +
        '; C ziet iets=' + cZietIets + ', A behoudt relatie=' + !!naA + ', B behoudt Notaris=' + naB.some((x) => x.dienst === 'Notaris')
    };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op "sluit": een keer gesloten, de tweede is een nette weigering of een herhaling', async () => {
    const kop = await toestel.bewijs('POST', SLUIT);
    const kop2 = await toestel.bewijs('POST', SLUIT);
    const [a, b] = await Promise.all([w.post(SLUIT, { partij: partijB }, A.token, kop), w.post(SLUIT, { partij: partijB }, A.token, kop2)]);
    const zb = await zietB();
    return { klopt: [a, b].some((x) => x.status === 200) && geen5xx(a) && geen5xx(b) && zb.length === 0 && !(await relatie()),
      ziet: 'antwoorden ' + a.status + '/' + b.status + ', B ziet ' + zb.length };
  });
  await stap('herstelbaar', 'een afgebroken machtiging en opnieuw: B krijgt er precies een', async () => {
    const lijf = { codenaam: codenaamB, dienst: 'Bank', dagen: 3 };
    const half = await w.afgebroken(MACHTIG, lijf, A.token, await toestel.bewijs('POST', MACHTIG));
    const opnieuw = await w.post(MACHTIG, lijf, A.token, await toestel.bewijs('POST', MACHTIG));
    const b = (await zietB()).filter((x) => x.dienst === 'Bank');
    return { klopt: geen5xx(opnieuw) && b.length === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', B ziet ' + b.length + ' machtiging voor de bank' };
  });
  await stap('herstelbaar', 'een crash direct na het sluiten: wat gesloten heette, blijft gesloten voor B', async () => {
    const s = await w.post(SLUIT, { partij: partijB }, A.token, await toestel.bewijs('POST', SLUIT));
    await w.crash();
    const b = await zietB(await inloggen(w, B));
    return { klopt: s.status === 200 && b.length === 0, ziet: 'sluiten ' + s.status + ', na SIGKILL ziet B ' + b.length };
  });
  await stap('herstelbaar', 'een crash direct na een machtiging: B heeft hem na de herstart', async () => {
    const m = await machtig('Huisarts');
    await w.crash();
    const b = await zietB(await inloggen(w, B));
    return { klopt: m.status === 200 && b.some((x) => x.dienst === 'Huisarts'), ziet: 'machtig ' + m.status + ', na SIGKILL ziet B: ' + b.map((x) => x.dienst).join(', ') };
  });
}

module.exports = {
  functie: 'link:relaties',
  ingang: '/apps/mijn-relaties.html',
  persona: 'lid',
  belofte: 'een lid ziet per partij wie wat van hem mag, bekijkt vooraf wat sluiten doet, en zet het bij de bron stop -- en de andere partij merkt het',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Van de negen lagen in het Consent Center zijn er twee gelopen (de RTG iD-machtiging en commerciele post); zorg, paspoortinzage, locatie, toestel, wachtlijst en metier niet. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
