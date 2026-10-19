/* ============================================================================
   VOLTOOIPROEF: GEZIN (tab:gezin) -- de stand Gezin in de ledenapp, bereikt
   langs de echte navigatieroute /apps/app.html#tab=gezin (app-main-12a.js: "een
   adres met een stand"; de sprong en andere schermen sturen een lid zo naar
   deze stand).

   De belofte van de stand: een RTG-lid dat oppas of familie is van een
   RTFoundation-gezin, koppelt zich met de persoonlijke, eenmalige uitnodiging
   van dat gezin, ziet daarna wat het gezin hem toevertrouwt (noodcontacten,
   huisregels, eten en bedtijden), en stuurt het gezin een bericht. Ontkoppelen
   kan altijd. Over de routes die de stand aanroept: /api/rtf/uitnodiging/
   accepteer, /api/rtf/overzicht, /api/rtf/kanaal, /api/rtf/bericht en
   /api/rtf/ontkoppel.

   De andere kant is een echte ouder met een eigen RTG-account en een eigen
   gezin (/api/rtf/eigen-gezin/*), die de uitnodiging maakt en de gezinsinfo
   zet langs de gezinsdeur van FoundationOS (/api/foundation/gezin/*).

   DE KOPPELING (19 oktober 2026, ronde 4). Een stand heeft geen eigen adres;
   de ingang is /apps/app.html, via #tab=gezin, en de koppeling loopt op de
   delen die de stand tekenen en aanroepen (app-main-43 en -44, die hun routes
   nu letterlijk als /api/rtf/... aanroepen zodat SCHERMROUTES.json ze ziet).
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const ACCEPTEER = '/api/rtf/uitnodiging/accepteer';
const OVERZICHT = '/api/rtf/overzicht';
const KANAAL = '/api/rtf/kanaal';
const BERICHT = '/api/rtf/bericht';
const ONTKOPPEL = '/api/rtf/ontkoppel';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const merk = 'gz' + Date.now().toString(36);
  const P = await nieuwLid(w, 'gzp');
  const O = await nieuwLid(w, 'gzo');
  const X = await nieuwLid(w, 'gzx');
  let gezin = null, uitnodiging = null;
  const gezinsnaam = 'Gezin ' + merk;

  const overzicht = async (tok) => ((await w.post(OVERZICHT, {}, tok || O.token)).data || {}).gezinnen || [];
  const mijnGezin = async (tok) => (await overzicht(tok)).find((g) => g.gezinNaam === gezinsnaam) || null;
  /* De ouder leest de berichten van het gezin zoals de gezinsapp dat doet. */
  const berichtenVanGezin = async () => {
    const r = await fetch(w.basis + '/api/foundation/gezin/' + gezin.code + '/berichten', { headers: { Authorization: 'Bearer ' + gezin.token } });
    return ((await r.json().catch(() => ({}))).berichten) || [];
  };
  const nieuweUitnodiging = async (naam) => (await w.post('/api/foundation/gezin/uitnodiging/maak',
    { code: gezin.code, token: gezin.token, naam, rol: 'gast', relatie: 'oppas' })).data || {};

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een ouder maakt een gezin en een persoonlijke uitnodiging; de oppas koppelt in de app en ziet het gezin', async () => {
    const g = await w.post('/api/rtf/eigen-gezin/maak', { gezinsnaam, naam: 'Beheerder', bevoegdGezin: true, privacyAkkoord: true }, P.token);
    const prof = ((g.data && g.data.profielen) || [])[0];
    const s = await w.post('/api/rtf/eigen-gezin/sessie', { profielId: prof && prof.id }, P.token);
    gezin = s.data;
    uitnodiging = (await nieuweUitnodiging('Oppas Mila')).uitnodiging;
    const link = w.basis + '/apps/foundation/registreren.html#familie=' + encodeURIComponent(uitnodiging);
    const a = await w.post(ACCEPTEER, { uitnodiging: link }, O.token);
    const mijn = await mijnGezin();
    return { klopt: g.status === 200 && s.status === 200 && !!uitnodiging && a.status === 200 && a.data.gezinNaam === gezinsnaam && !!mijn && mijn.profielNaam === 'Oppas Mila',
      ziet: 'gezin ' + g.status + ', sessie ' + s.status + ', accepteren ' + a.status + ', in het overzicht: ' + (mijn ? mijn.gezinNaam + ' als ' + mijn.profielNaam : 'NIETS') };
  });

  await stap('voltooibaar', 'de ouder zet noodcontact, huisregels en bedtijden; de oppas leest precies dat', async () => {
    const z = await w.post('/api/foundation/gezin/oppasinfo', { code: gezin.code, token: gezin.token,
      noodcontacten: [{ naam: 'Mama', telefoon: '0612345678', wie: 'moeder' }], eten: 'Om half zeven, bed om acht.', huisregels: 'Geen schermen na het eten ' + merk + '.' });
    const o = ((await mijnGezin()) || {}).oppasinfo || {};
    return { klopt: z.status === 200 && o.huisregels === 'Geen schermen na het eten ' + merk + '.' && o.eten === 'Om half zeven, bed om acht.' && (o.noodcontacten || [])[0] && o.noodcontacten[0].telefoon === '0612345678',
      ziet: 'zetten ' + z.status + ', de oppas leest: "' + o.huisregels + '", ' + (o.noodcontacten || []).length + ' noodcontact' };
  });

  await stap('voltooibaar', 'de oppas stuurt het gezin een bericht; de ouder leest het in het gezin', async () => {
    const b = await w.post(BERICHT, { code: gezin.code, tekst: 'Alles rustig, ze slapen ' + merk }, O.token);
    const lijst = await berichtenVanGezin();
    const m = lijst.find((x) => x.tekst === 'Alles rustig, ze slapen ' + merk);
    return { klopt: b.status === 200 && !!m && m.vanNaam === 'Oppas Mila', ziet: 'bericht ' + b.status + ', bij de ouder: ' + (m ? 'van ' + m.vanNaam : 'NIETS') };
  });

  await stap('voltooibaar', 'bevoegdheid: zonder sessie geen overzicht, geen bericht en geen koppeling (401)', async () => {
    const a = await w.post(OVERZICHT, {});
    const b = await w.post(BERICHT, { code: gezin.code, tekst: 'anoniem' });
    const c = await w.post(ACCEPTEER, { uitnodiging });
    return { klopt: a.status === 401 && b.status === 401 && c.status === 401, ziet: 'overzicht ' + a.status + ', bericht ' + b.status + ', accepteren ' + c.status };
  });

  await stap('voltooibaar', 'bevoegdheid: een ander lid ziet het gezin niet, schrijft het niet en kan dezelfde uitnodiging niet nog eens gebruiken', async () => {
    const o = await overzicht(X.token);
    const b = await w.post(BERICHT, { code: gezin.code, tekst: 'Indringer ' + merk }, X.token);
    const a = await w.post(ACCEPTEER, { uitnodiging }, X.token);
    const lijst = await berichtenVanGezin();
    return { klopt: !o.some((g) => g.gezinNaam === gezinsnaam) && b.status === 403 && a.status === 404 && !lijst.some((x) => x.tekst === 'Indringer ' + merk),
      ziet: 'overzicht ' + o.length + ' gezinnen, bericht ' + b.status + ', uitnodiging opnieuw ' + a.status };
  });

  await stap('voltooibaar', 'bevoegdheid: een oppas heeft geen ouderrechten -- met zijn kanaal wijzigt hij de gezinsinfo niet', async () => {
    const k = await w.post(KANAAL, { code: gezin.code }, O.token);
    const tok = k.data && (k.data.token || (k.data.sessie && k.data.sessie.token));
    const z = await w.post('/api/foundation/gezin/oppasinfo', { code: gezin.code, token: tok, huisregels: 'Alles mag ' + merk }, tok);
    const o = ((await mijnGezin()) || {}).oppasinfo || {};
    return { klopt: k.status === 200 && (z.status === 401 || z.status === 403) && o.huisregels === 'Geen schermen na het eten ' + merk + '.',
      ziet: 'kanaal ' + k.status + ', info wijzigen ' + z.status + ' (' + (z.data && z.data.error) + '), huisregels ongewijzigd' };
  });

  /* ---------------- persistent ---------------- */
  const vorm = (g) => g && JSON.stringify([g.code, g.gezinNaam, g.profielNaam, g.oppasinfo.huisregels, g.oppasinfo.eten, g.oppasinfo.noodcontacten]);
  const voor = vorm(await mijnGezin());
  await w.herstart();

  await stap('persistent', 'na een nette herstart is de oppas nog gekoppeld en leest hij dezelfde gezinsinfo', async () => {
    const na = vorm(await mijnGezin());
    return { klopt: !!voor && na === voor, ziet: na === voor ? 'gelijk' : 'ANDERS: ' + na };
  });

  await stap('persistent', 'de oppas logt opnieuw in (een ander toestel) en ziet hetzelfde gezin; zijn bericht staat er nog bij de ouder', async () => {
    const tok = await inloggen(w, O);
    const na = vorm(await mijnGezin(tok));
    const lijst = await berichtenVanGezin();
    return { klopt: na === voor && lijst.some((x) => x.tekst === 'Alles rustig, ze slapen ' + merk), ziet: (na === voor ? 'gelijk' : 'ANDERS') + ', bericht bij de ouder: ' + lijst.some((x) => x.tekst === 'Alles rustig, ze slapen ' + merk) };
  });

  await stap('persistent', 'het gezin staat in de opslag zelf, en de uitnodigingssleutel niet: alleen haar hash', async () => {
    const g = w.vindInOpslag(gezinsnaam);
    const geheim = uitnodiging.split('.')[1];
    return { klopt: g.length >= 1 && w.vindInOpslag(geheim).length === 0, ziet: 'gezin in ' + g.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') + '; kale sleutel: ' + w.vindInOpslag(geheim).length };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op "koppelen" met een nieuwe uitnodiging: een koppeling, niet twee', async () => {
    const u = (await nieuweUitnodiging('Oma Rie')).uitnodiging;
    const [a, b] = await w.dubbel(ACCEPTEER, { uitnodiging: u }, X.token);
    const mijn = (await overzicht(X.token)).filter((g) => g.gezinNaam === gezinsnaam);
    return { klopt: geen5xx(a) && geen5xx(b) && (a.status === 200 || b.status === 200) && mijn.length === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + mijn.length + ' koppeling' };
  });

  await stap('herstelbaar', 'een dubbele tik op "verstuur" met een herhaalsleutel: een bericht bij de ouder, niet twee', async () => {
    const [a, b] = await w.dubbel(BERICHT, { code: gezin.code, tekst: 'Dubbel ' + merk, idem: 'gezin-bericht-' + merk }, O.token);
    const n = (await berichtenVanGezin()).filter((x) => x.tekst === 'Dubbel ' + merk).length;
    return { klopt: geen5xx(a) && geen5xx(b) && n === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' bericht(en)' };
  });

  await stap('herstelbaar', 'een afgebroken koppeling: daarna is het lid precies een keer gekoppeld, of hoort hij in woorden dat de sleutel op is', async () => {
    const u = (await nieuweUitnodiging('Buurvrouw Ans')).uitnodiging;
    const Y = await nieuwLid(w, 'gzy');
    const half = await w.afgebroken(ACCEPTEER, { uitnodiging: u }, Y.token);
    const opnieuw = await w.post(ACCEPTEER, { uitnodiging: u }, Y.token);
    const mijn = (await overzicht(Y.token)).filter((g) => g.gezinNaam === gezinsnaam);
    return { klopt: mijn.length === 1 && geen5xx(opnieuw) && (opnieuw.status === 200 || /uitnodiging|sleutel|gebruikt/i.test((opnieuw.data && opnieuw.data.error) || '')),
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + (opnieuw.data && opnieuw.data.error ? ' (' + opnieuw.data.error + ')' : '') + ', ' + mijn.length + ' koppeling' };
  });

  await stap('herstelbaar', 'een crash direct na ontkoppelen: na de herstart is de oppas ontkoppeld en schrijft hij het gezin niet meer', async () => {
    const x = await w.post(ONTKOPPEL, { code: gezin.code }, O.token);
    await w.crash();
    const mijn = await mijnGezin();
    const b = await w.post(BERICHT, { code: gezin.code, tekst: 'Na ontkoppelen ' + merk }, O.token);
    return { klopt: x.status === 200 && !mijn && b.status === 403, ziet: 'ontkoppel ' + x.status + ', na SIGKILL gekoppeld: ' + !!mijn + ', bericht ' + b.status };
  });
}

module.exports = {
  functie: 'tab:gezin',
  ingang: '/apps/app.html',
  via: '#tab=gezin',
  persona: 'lid',
  belofte: 'een oppas of familielid koppelt zich met de persoonlijke uitnodiging van een gezin, leest wat het gezin hem toevertrouwt en stuurt het gezin een bericht, zonder ouderrechten, en kan altijd ontkoppelen -- ook na een herstart, een dubbeltik, een afgebroken verzoek en een crash',
  grens: 'De stand heeft geen eigen scherm: de ingang is de navigatieroute /apps/app.html#tab=gezin, en de proef loopt de routes van de stand, niet de stand zelf. Bellen en chatten met het gezin (GezinRT, WebRTC) en de webpush naar de telefoon worden niet gelopen. De ouder werkt via zijn eigen gezin en de gezinsdeur van FoundationOS. Geen Redis of PostgreSQL.',
  loop
};
