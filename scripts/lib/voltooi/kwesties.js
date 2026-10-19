/* ============================================================================
   VOLTOOIPROEF: KWESTIES (link:kwesties, /apps/foundation/kwesties.html).

   De belofte, in de woorden van kern/democratie/lid.js en POLITIEK.md: een
   mens brengt in wat er speelt (minstens tien tekens), ziet de kwestie op
   zijn naam terug met zijn stand, opent de uitkomst zelf (de trede "gezien"),
   en trekt hem in zolang niemand anders hem volgt -- want intrekken zou de
   kwestie van die anderen afsluiten zonder naam en zonder reden. Alleen wie
   de kwestie inbracht, kan dat.

   DE ONTVANGER is het lid zelf op een ander toestel, en een tweede lid dat
   de kwestie van de eerste niet op zijn naam heeft.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const INBRENG = '/api/member/democratie/kwestie/inbreng';
const MIJN = '/api/member/democratie/kwestie/mijn';
const GEZIEN = '/api/member/democratie/kwestie/gezien';
const INTREK = '/api/member/democratie/kwestie/intrek';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const merk = 'kw' + Date.now().toString(36);
  const A = await nieuwLid(w, 'kwa');
  const B = await nieuwLid(w, 'kwb');
  const mijn = async (tok) => ((((await w.post(MIJN, {}, tok)).data) || {}).kwesties || []);
  const eigen = async (tok) => (await mijn(tok)).filter((k) => String(k.onderwerp).includes(merk));
  let kwestie = null;

  await stap('voltooibaar', 'een inbreng van minder dan tien tekens wordt geweigerd; een echte inbreng staat daarna op naam van A', async () => {
    const kort = await w.post(INBRENG, { onderwerp: 'kort' }, A.token);
    const r = await w.post(INBRENG, { onderwerp: 'De lantaarn op de hoek is al weken kapot ' + merk, gebied: 'Buurt' }, A.token);
    kwestie = r.data && r.data.kwestie;
    const l = await eigen(A.token);
    return { klopt: kort.status === 400 && /tien tekens/.test(kort.data.error) && r.status === 200 && !!kwestie && l.length === 1 && l[0].id === kwestie.id,
      ziet: 'kort: ' + kort.status + ' (' + (kort.data && kort.data.error) + '); inbreng ' + r.status + ', op naam: ' + l.length };
  });

  await stap('voltooibaar', 'B heeft de kwestie niet op zijn naam en kan er niets mee; A opent de uitkomst (gezien)', async () => {
    const nietVanB = await eigen(B.token);
    const gezienB = await w.post(GEZIEN, { id: kwestie.id }, B.token);
    const intrekB = await w.post(INTREK, { id: kwestie.id }, B.token);
    const g = await w.post(GEZIEN, { id: kwestie.id }, A.token);
    return { klopt: nietVanB.length === 0 && gezienB.status === 404 && intrekB.status === 404 && g.status === 200 && !!g.data.kwestie,
      ziet: 'B ziet ' + nietVanB.length + ', B gezien ' + gezienB.status + ', B intrek ' + intrekB.status + ' (' + (intrekB.data && intrekB.data.error) + '); A gezien ' + g.status };
  });

  await stap('voltooibaar', 'A trekt de kwestie in: hij staat daarna als ingetrokken op zijn naam, en nog eens intrekken wordt geweigerd', async () => {
    const r = await w.post(INTREK, { id: kwestie.id }, A.token);
    const na = (await eigen(A.token)).find((k) => k.id === kwestie.id);
    const nogeens = await w.post(INTREK, { id: kwestie.id }, A.token);
    const stand = na && (na.stand || (na.eindstand && na.eindstand.stand) || na.status);
    return { klopt: r.status === 200 && !!na && /ingetrokken/.test(JSON.stringify(na)) && nogeens.status >= 400 && nogeens.status < 500,
      ziet: 'intrekken ' + r.status + ', stand ' + stand + ', nog eens ' + nogeens.status + ' (' + (nogeens.data && nogeens.data.error || '').slice(0, 60) + ')' };
  });

  /* ---------------- persistent ---------------- */
  const tweede = (await w.post(INBRENG, { onderwerp: 'De speeltuin heeft geen schaduw ' + merk }, A.token)).data.kwestie;
  const voor = JSON.stringify(await eigen(A.token));
  await w.herstart();
  await stap('persistent', 'na een nette herstart staan beide kwesties op naam van A, byte voor byte gelijk', async () => {
    const na = JSON.stringify(await eigen(A.token));
    return { klopt: voor.length > 2 && na === voor && JSON.parse(na).length === 2, ziet: na === voor ? 'gelijk (2 kwesties)' : 'ANDERS' };
  });
  await stap('persistent', 'een nieuwe sessie van A (een ander toestel) leest dezelfde kwesties; B nog steeds niets', async () => {
    const C = await inloggen(w, A);
    const l = await eigen(C);
    const b = await eigen(B.token);
    return { klopt: l.length === 2 && b.length === 0, ziet: 'A: ' + l.length + ', B: ' + b.length };
  });
  await stap('persistent', 'de kwesties staan in de opslag zelf (gelezen buiten de server om)', async () => {
    const p = w.vindInOpslag('De lantaarn op de hoek is al weken kapot ' + merk);
    return { klopt: p.length >= 1, ziet: 'in ' + p.map((x) => x.bestand + '/' + (x.sleutel || x.tabel)).join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op "inbrengen": een kwestie, niet twee', async () => {
    const lijf = { onderwerp: 'Dubbel ingediend, de stoep ligt los ' + merk };
    const [a, b] = await w.dubbel(INBRENG, lijf, A.token);
    const n = (await mijn(A.token)).filter((k) => k.onderwerp === lijf.onderwerp).length;
    return { klopt: a.status === 200 && geen5xx(b) && n === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' kwestie(s)' };
  });
  await stap('herstelbaar', 'een afgebroken inbreng en daarna opnieuw: precies een kwestie', async () => {
    const lijf = { onderwerp: 'Afgebroken, de bank in het park is weg ' + merk };
    const half = await w.afgebroken(INBRENG, lijf, A.token);
    const opnieuw = await w.post(INBRENG, lijf, A.token);
    const n = (await mijn(A.token)).filter((k) => k.onderwerp === lijf.onderwerp).length;
    return { klopt: geen5xx(opnieuw) && n === 1, ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' kwestie(s)' };
  });
  await stap('herstelbaar', 'een crash direct na een inbreng: de kwestie staat er na de herstart', async () => {
    const r = await w.post(INBRENG, { onderwerp: 'Crash, de bushalte heeft geen bordje ' + merk }, A.token);
    await w.crash();
    const n = (await mijn(A.token)).filter((k) => k.id === (r.data && r.data.kwestie && r.data.kwestie.id)).length;
    return { klopt: r.status === 200 && n === 1, ziet: 'inbreng ' + r.status + ', na SIGKILL ' + n + ' kwestie' };
  });
  await stap('herstelbaar', 'een crash direct na het intrekken: ingetrokken blijft ingetrokken', async () => {
    const r = await w.post(INTREK, { id: tweede.id }, A.token);
    await w.crash();
    const na = (await eigen(A.token)).find((k) => k.id === tweede.id);
    return { klopt: r.status === 200 && !!na && /ingetrokken/.test(JSON.stringify(na)), ziet: 'intrekken ' + r.status + ', na SIGKILL ' + (na ? (/ingetrokken/.test(JSON.stringify(na)) ? 'ingetrokken' : 'NIET INGETROKKEN') : 'WEG') };
  });
}

module.exports = {
  functie: 'link:kwesties',
  ingang: '/apps/foundation/kwesties.html',
  persona: 'lid',
  belofte: 'een mens brengt in wat er speelt, ziet de kwestie op zijn naam met zijn stand, opent de uitkomst zelf en trekt hem in zolang niemand anders hem volgt -- een ander kan er niets mee',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. De kantoorkant (samenvoegen, afsluiten met reden, volgers) en het DoeNetwerk (/api/member/democratie/actie/*) zijn niet gelopen; de voorstellen (/kwestie/voorstellen) zijn een modelvraag. De proef loopt als lid; de gezinsdeur van FoundationOS loopt zij niet. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
