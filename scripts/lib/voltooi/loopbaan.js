/* ============================================================================
   VOLTOOIPROEF: LOOPBAAN (link:loopbaan, /apps/loopbaan.html).

   De belofte, in de woorden van kern/carriereledger/: een ledger dat niets
   wist. Het lid schrijft zelf een feit (herkomst `zelf`, en dat is de
   waarheid: niemand anders heeft er iets van gezien), nooit een bedrag en
   nooit een cijfer; een regel die woord voor woord al staat wordt geweigerd;
   terugnemen is een intrekking MET reden die erbij komt te staan, geen
   wissen; en delen is een code die precies een keer de deur uit gaat, een
   vreemde laat tonen wat erachter staat, en die het lid weer stopzet.

   DE ONTVANGER is een vreemde met de deelcode (zonder sessie), die het feit
   ziet met het voorbehoud erbij -- en na het stopzetten niets meer.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const MIJN = '/api/carriere/ledger/mijn';
const ZET = '/api/carriere/ledger/zet';
const INTREK = '/api/carriere/ledger/intrek';
const DEEL = '/api/carriere/ledger/deel';
const DELEN = '/api/carriere/ledger/delen';
const STOPDELEN = '/api/carriere/ledger/stopdelen';
const AFSCHRIFT = '/api/carriere/ledger/afschrift';
const TOON = '/api/carriere/regel/toon';
const MIJNWERK = '/api/concern/mijnwerk';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;
const vandaag = () => new Date().toISOString().slice(0, 10);

async function loop(w, stap) {
  const merk = 'lb' + Date.now().toString(36);
  const lid = await nieuwLid(w, 'lpb');
  const T = lid.token;
  const feiten = async (tok) => ((((await w.post(MIJN, {}, tok || T)).data) || {}).feiten || []);
  const mijne = async (tok) => (await feiten(tok)).filter((f) => String(f.wat).includes(merk));
  let feit = null, code = null, deelId = null;

  await stap('voltooibaar', 'een feit zonder kapitaal, met een bedrag of in de toekomst wordt geweigerd met de reden; een echt feit komt in het ledger met herkomst "zelf"', async () => {
    const zonder = await w.post(ZET, { wat: 'Diploma gehaald ' + merk, op: vandaag() }, T);
    const metGeld = await w.post(ZET, { kapitaal: 'financieel', wat: 'Opdracht ' + merk, op: vandaag(), bedrag: 500 }, T);
    const toekomst = await w.post(ZET, { kapitaal: 'vermogen', wat: 'Straks ' + merk, op: '2099-01-01' }, T);
    const r = await w.post(ZET, { kapitaal: 'vermogen', wat: 'Diploma sommelier gehaald ' + merk, op: vandaag() }, T);
    feit = (await mijne()).find((f) => f.wat === 'Diploma sommelier gehaald ' + merk) || null;
    const herkomst = r.data && r.data.regel && r.data.regel.herkomst;
    return { klopt: zonder.status === 400 && metGeld.status === 400 && toekomst.status === 400 && r.status === 200 && !!feit && herkomst === 'zelf',
      ziet: 'zonder kapitaal ' + zonder.status + ', met bedrag ' + metGeld.status + ', toekomst ' + toekomst.status + '; feit ' + r.status + ' (herkomst ' + herkomst + ')' };
  });

  await stap('voltooibaar', 'dezelfde regel nog eens op dezelfde dag wordt geweigerd: een ledger wist niets, dus hij telt niet dubbel', async () => {
    const r = await w.post(ZET, { kapitaal: 'vermogen', wat: 'Diploma sommelier gehaald ' + merk, op: vandaag() }, T);
    const n = (await mijne()).filter((f) => f.wat === 'Diploma sommelier gehaald ' + merk).length;
    return { klopt: r.status === 409 && /woord voor woord/.test(r.data.error) && n === 1, ziet: r.status + ' (' + (r.data && r.data.error || '').slice(0, 60) + '), ' + n + ' regel' };
  });

  await stap('voltooibaar', 'delen: een code die een vreemde zonder sessie het feit laat tonen, met het voorbehoud en zonder de rest van het ledger', async () => {
    const d = await w.post(DEEL, { id: feit.id, dagen: 7, voor: 'een opdrachtgever' }, T);
    code = d.data && d.data.code;
    const t = code ? await w.post(TOON, { code }, null) : { status: 0 };
    const tekst = JSON.stringify(t.data || {});
    deelId = ((((await w.post(DELEN, {}, T)).data) || {}).delen || []).find((x) => x.feit === feit.id);
    deelId = deelId && deelId.id;
    return { klopt: d.status === 200 && !!code && t.status === 200 && t.data.feit && t.data.feit.wat === feit.wat && !!t.data.voorbehoud && !tekst.includes('Opdracht ' + merk) && !!deelId,
      ziet: 'delen ' + d.status + ', tonen zonder sessie ' + t.status + (t.data && t.data.feit ? ' ("' + t.data.feit.wat.slice(0, 30) + '...")' : '') };
  });

  await stap('voltooibaar', 'intrekken zonder reden wordt geweigerd; met reden staat het feit als ingetrokken en blijft het in het ledger staan', async () => {
    const zonder = await w.post(INTREK, { id: feit.id }, T);
    const r = await w.post(INTREK, { id: feit.id, reden: 'verkeerde datum ' + merk }, T);
    const na = (await mijne()).find((f) => f.id === feit.id);
    const nogeens = await w.post(INTREK, { id: feit.id, reden: 'nog eens' }, T);
    return { klopt: zonder.status === 400 && r.status === 200 && !!na && !!na.ingetrokken && nogeens.status === 409,
      ziet: 'zonder reden ' + zonder.status + ', met reden ' + r.status + ', staat er nog: ' + (na ? 'ja, ingetrokken' : 'WEG') + ', nog eens ' + nogeens.status };
  });

  await stap('voltooibaar', 'het afschrift draagt het feit en de intrekking, en de werkkant laadt ernaast', async () => {
    const a = await w.post(AFSCHRIFT, {}, T);
    const tekst = JSON.stringify(a.data || {});
    const m = await w.post(MIJNWERK, {}, T);
    return { klopt: a.status === 200 && tekst.includes('Diploma sommelier gehaald ' + merk) && tekst.includes('verkeerde datum ' + merk) && m.status === 200,
      ziet: 'afschrift ' + a.status + ' (' + tekst.length + ' tekens), mijn werk ' + m.status };
  });

  /* ---------------- persistent ---------------- */
  const voor = JSON.stringify(await mijne());
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat het ledger er byte voor byte, en de deelcode toont nog', async () => {
    const na = JSON.stringify(await mijne());
    const t = await w.post(TOON, { code }, null);
    return { klopt: voor.length > 2 && na === voor && t.status === 200, ziet: (na === voor ? 'gelijk' : 'ANDERS') + ', tonen ' + t.status };
  });
  await stap('persistent', 'een nieuwe sessie (een ander toestel) leest hetzelfde ledger', async () => {
    const C = await inloggen(w, lid);
    const l = await mijne(C);
    return { klopt: l.length === 1 && l[0].id === feit.id && !!l[0].ingetrokken, ziet: l.length + ' feit, ingetrokken ' + !!(l[0] && l[0].ingetrokken) };
  });
  await stap('persistent', 'het feit en de intrekking staan in de opslag zelf (gelezen buiten de server om)', async () => {
    const f = w.vindInOpslag('Diploma sommelier gehaald ' + merk), i = w.vindInOpslag('verkeerde datum ' + merk);
    return { klopt: f.length >= 1 && i.length >= 1, ziet: 'feit in ' + f.map((p) => p.sleutel || p.tabel).join(',') + '; intrekking in ' + i.map((p) => p.sleutel || p.tabel).join(',') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op "feit zetten": een regel, niet twee', async () => {
    const lijf = { kapitaal: 'netwerk', wat: 'Dubbel ' + merk, op: vandaag() };
    const [a, b] = await w.dubbel(ZET, lijf, T);
    const n = (await mijne()).filter((f) => f.wat === lijf.wat).length;
    return { klopt: (a.status === 200 || b.status === 200) && geen5xx(a) && geen5xx(b) && n === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' regel' };
  });
  await stap('herstelbaar', 'een afgebroken verzoek en daarna opnieuw: precies een regel', async () => {
    const lijf = { kapitaal: 'reputatie', wat: 'Afgebroken ' + merk, op: vandaag() };
    const half = await w.afgebroken(ZET, lijf, T);
    const opnieuw = await w.post(ZET, lijf, T);
    const n = (await mijne()).filter((f) => f.wat === lijf.wat).length;
    return { klopt: geen5xx(opnieuw) && n === 1, ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' regel' };
  });
  await stap('herstelbaar', 'een crash direct na het zetten: de regel staat er na de herstart', async () => {
    const lijf = { kapitaal: 'eigendom', wat: 'Crash ' + merk, op: vandaag() };
    const r = await w.post(ZET, lijf, T);
    await w.crash();
    const n = (await mijne()).filter((f) => f.wat === lijf.wat).length;
    return { klopt: r.status === 200 && n === 1, ziet: 'zetten ' + r.status + ', na SIGKILL ' + n + ' regel' };
  });
  await stap('herstelbaar', 'een crash direct na het stopzetten van de deelcode: de vreemde ziet niets meer, ook na de herstart', async () => {
    const s = await w.post(STOPDELEN, { id: deelId }, T);
    await w.crash();
    const t = await w.post(TOON, { code }, null);
    const nogeens = await w.post(STOPDELEN, { id: deelId }, T);
    return { klopt: s.status === 200 && t.status === 404 && nogeens.status === 409, ziet: 'stoppen ' + s.status + ', na SIGKILL tonen ' + t.status + ' (' + (t.data && t.data.error) + '), nog eens stoppen ' + nogeens.status };
  });
}

module.exports = {
  functie: 'link:loopbaan',
  ingang: '/apps/loopbaan.html',
  persona: 'lid',
  belofte: 'een lid schrijft feiten over zijn loopbaan in een ledger dat niets wist -- nooit een bedrag of een cijfer -- trekt er een terug met de reden erbij, en deelt een feit met een code die een vreemde laat kijken tot hij hem stopzet',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Een bevestiging door een ander (herkomst gezien of bevestigd) vraagt een tweede partij op naam en is niet gelopen; het concern-deel (/api/concern/mijnwerk) is alleen gelezen. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
