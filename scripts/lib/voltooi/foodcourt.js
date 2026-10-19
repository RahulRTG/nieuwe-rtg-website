/* ============================================================================
   VOLTOOIPROEF: FOOD COURT (link:foodcourt, /apps/foodcourt.html).

   De belofte, in de woorden van routes/member/winkel-bieb.js en het scherm:
   alle restaurants op een rij, de vrije tijdsloten voor een datum en een
   gezelschap, en reserveren in een tik -- "het lid vraagt aan, de zaak
   beslist" (routes/member/handel/uitjes.js).

   TWEE ACTOREN. Een lid vraagt een tafel aan; de ZAAK ziet de aanvraag in haar
   eigen app en bevestigt; het lid ziet "bevestigd". De zaak is een
   synthetische leverancier uit de seed van de testomgeving (BETROUWBAARHEID.md
   par. 4: "boekingen -- synthetische leveranciers, staat"), met een eigen
   medewerker die inlogt langs de echte zaakdeur. Er wordt niets betaald.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, KANTOORWERELD } = require('../voltooiwereld');

const OVERZICHT = '/api/foodcourt';
const TIJDEN = '/api/foodcourt/tijden';
const RESERVEER = '/api/reserveer';
const MIJN = '/api/reserveringen/mijn';
const ANNULEER = '/api/reservering/annuleer';
const ZAAK_BESLIS = '/api/supplier/reservering/beslis';

const dag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function zaakSessie(w, code) {
  const rooster = await w.post('/api/supplier/roster', { code });
  /* In modus LOS staat de partnerkant uit; dan geeft het rooster 503. Dat is een
     nette AFGEBROKEN-reden -- het scherm leunt op de Partners-app voor de zaak --
     en geen reden om verderop op een ontbrekend veld te crashen. */
  if (rooster.status === 503) throw new Error('de partnerkant (leveranciers) staat uit: zaak ' + code + ' is in modus LOS niet bereikbaar');
  const man = ((rooster.data && rooster.data.staff) || []).find((x) => x.role === 'manager');
  if (!man) throw new Error('de zaak ' + code + ' heeft geen manager in het rooster');
  const z = await w.post('/api/supplier/login', { code, staffId: man.id, pin: '1234' });
  if (!z.data || !z.data.token) throw new Error('de manager van ' + code + ' kon niet inloggen (' + z.status + ')');
  return z.data.token;
}

async function loop(w, stap) {
  const lid = await nieuwLid(w, 'fco');
  const T = lid.token;
  let zaak = null, Z = null, slot = null, res = null;
  const datum = dag(3);
  const mijn = async (tok) => (((await w.post(MIJN, {}, tok || T)).data || {}).reserveringen || []);
  const bijZaak = async () => ((((await w.post('/api/supplier/state', {}, Z)).data || {}).state || {}).reserveringen || []);

  await stap('voltooibaar', 'het lid ziet de restaurants op een rij, met keuken en stad', async () => {
    const o = await w.post(OVERZICHT, {}, T);
    zaak = ((o.data && o.data.restaurants) || [])[0];
    return { klopt: o.status === 200 && o.data.aantal >= 1 && !!zaak && !!zaak.code && !!zaak.keuken, ziet: (o.data && o.data.aantal) + ' restaurants, eerste ' + (zaak && zaak.naam + ' (' + zaak.keuken + ')') };
  });

  await stap('voltooibaar', 'de vrije tijden voor over drie dagen met twee personen', async () => {
    const t = await w.post(TIJDEN, { code: zaak.code, datum, personen: 2 }, T);
    slot = ((t.data && t.data.slots) || []).find((s) => !s.vol);
    return { klopt: t.status === 200 && t.data.open === true && !!slot, ziet: (t.data && (t.data.slots || []).length) + ' tijden, eerste vrije ' + (slot && slot.tijd) };
  });

  await stap('voltooibaar', 'het lid vraagt een tafel aan; de aanvraag staat bij hem als "aangevraagd"', async () => {
    const r = await w.post(RESERVEER, { supplierCode: zaak.code, datum, tijd: slot.tijd, personen: 2 }, T);
    res = r.data && r.data.reservering;
    const m = (await mijn()).find((x) => x.id === (res && res.id));
    return { klopt: r.status === 200 && !!m && m.status === 'aangevraagd' && m.datum === datum && m.tijd === slot.tijd, ziet: 'reserveer ' + r.status + ', bij het lid: ' + (m && m.status) };
  });

  await stap('voltooibaar', 'de zaak ziet de aanvraag in haar eigen app, op codenaam en zonder echte naam', async () => {
    Z = await zaakSessie(w, zaak.code);
    const z = (await bijZaak()).find((x) => x.id === res.id);
    const echteNaam = z && JSON.stringify(z).includes('Voltooilid');
    return { klopt: !!z && z.status === 'aangevraagd' && !!z.customerCodename && !echteNaam, ziet: z ? 'bij ' + zaak.code + ': ' + z.status + ' van ' + z.customerCodename + (echteNaam ? ' MET ECHTE NAAM' : '') : 'NIET BIJ DE ZAAK' };
  });

  await stap('voltooibaar', 'de zaak bevestigt; het lid ziet "bevestigd"', async () => {
    const b = await w.post(ZAAK_BESLIS, { id: res.id, action: 'bevestig' }, Z);
    const m = (await mijn()).find((x) => x.id === res.id);
    return { klopt: b.status === 200 && !!m && m.status === 'bevestigd', ziet: 'zaak ' + b.status + ', bij het lid: ' + (m && m.status) };
  });

  await stap('voltooibaar', 'een tweede aanvraag voor hetzelfde moment wordt geweigerd met de reden', async () => {
    const r = await w.post(RESERVEER, { supplierCode: zaak.code, datum, tijd: slot.tijd, personen: 2 }, T);
    return { klopt: r.status === 409 && /al een reservering/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  /* ---------------- persistent ---------------- */
  const voor = JSON.stringify((await mijn()).find((x) => x.id === res.id));
  await w.herstart();
  Z = await zaakSessie(w, zaak.code);
  await stap('persistent', 'na een nette herstart staat de bevestigde reservering er bij het lid nog, gelijk', async () => {
    const na = JSON.stringify((await mijn()).find((x) => x.id === res.id));
    return { klopt: !!voor && na === voor, ziet: na === voor ? 'gelijk' : 'ANDERS' };
  });
  await stap('persistent', 'de zaak ziet hem na de herstart ook nog als bevestigd, en het lid in een nieuwe sessie', async () => {
    const z = (await bijZaak()).find((x) => x.id === res.id);
    const m = (await mijn(await inloggen(w, lid))).find((x) => x.id === res.id);
    return { klopt: !!z && z.status === 'bevestigd' && !!m && m.status === 'bevestigd', ziet: 'zaak: ' + (z && z.status) + ', nieuwe sessie: ' + (m && m.status) };
  });
  await stap('persistent', 'de reservering staat in de opslag zelf', async () => {
    const plek = w.vindInOpslag(res.id);
    return { klopt: plek.length >= 1, ziet: 'reservering in ' + plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  const slot2 = (((await w.post(TIJDEN, { code: zaak.code, datum: dag(4), personen: 2 }, T)).data || {}).slots || []).find((s) => !s.vol);
  await stap('herstelbaar', 'dubbeltik op reserveren: een aanvraag bij de zaak, niet twee', async () => {
    const [a, b] = await w.dubbel(RESERVEER, { supplierCode: zaak.code, datum: dag(4), tijd: slot2.tijd, personen: 2 }, T);
    const n = (await bijZaak()).filter((x) => x.datum === dag(4) && x.tijd === slot2.tijd && ['aangevraagd', 'bevestigd'].includes(x.status)).length;
    return { klopt: [a, b].some((x) => x.status === 200) && geen5xx(a) && geen5xx(b) && n === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', bij de zaak ' + n + ' aanvraag' };
  });
  await stap('herstelbaar', 'een afgebroken aanvraag en opnieuw: precies een aanvraag, of een nette melding dat hij er al is', async () => {
    const lijf = { supplierCode: zaak.code, datum: dag(5), tijd: slot2.tijd, personen: 3 };
    const half = await w.afgebroken(RESERVEER, lijf, T);
    const opnieuw = await w.post(RESERVEER, lijf, T);
    const n = (await mijn()).filter((x) => x.datum === dag(5) && x.status === 'aangevraagd').length;
    return { klopt: geen5xx(opnieuw) && [200, 409].includes(opnieuw.status) && n === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' aanvraag' };
  });
  await stap('herstelbaar', 'een crash direct na het bevestigen door de zaak: het lid ziet bevestigd', async () => {
    const r = (await mijn()).find((x) => x.datum === dag(5) && x.status === 'aangevraagd');
    const b = await w.post(ZAAK_BESLIS, { id: r && r.id, action: 'bevestig' }, Z);
    await w.crash();
    const m = (await mijn()).find((x) => x.id === (r && r.id));
    return { klopt: b.status === 200 && !!m && m.status === 'bevestigd', ziet: 'bevestigen ' + b.status + ', na SIGKILL: ' + (m && m.status) };
  });
  await stap('herstelbaar', 'een crash direct na het annuleren door het lid: de zaak ziet hem niet meer als komend', async () => {
    Z = await zaakSessie(w, zaak.code);
    const a = await w.post(ANNULEER, { id: res.id }, T);
    await w.crash();
    Z = await zaakSessie(w, zaak.code);
    const z = (await bijZaak()).find((x) => x.id === res.id);
    const m = (await mijn()).find((x) => x.id === res.id);
    return { klopt: a.status === 200 && (!z || !['aangevraagd', 'bevestigd'].includes(z.status)) && (!m || !['aangevraagd', 'bevestigd'].includes(m.status)),
      ziet: 'annuleren ' + a.status + ', na SIGKILL bij de zaak ' + (z ? z.status : 'weg') + ', bij het lid ' + (m ? m.status : 'weg') };
  });
}

module.exports = {
  functie: 'link:foodcourt',
  ingang: '/apps/foodcourt.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een lid ziet de restaurants en hun vrije tijden, vraagt een tafel aan, en de zaak beslist -- het lid ziet de bevestiging, en de zaak kent hem alleen op codenaam',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. De zaak is een synthetische leverancier uit de seed van de testomgeving; er wordt niet betaald en er gaat niets naar een echt restaurant. Het tegenvoorstel van de zaak en het meereizende zorgprofiel zijn niet gelopen. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
