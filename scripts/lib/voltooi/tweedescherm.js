/* ============================================================================
   VOLTOOIPROEF: TWEEDE SCHERM (link:tweedescherm, /apps/scherm.html).

   De belofte, in de woorden van het scherm: een zaak zet keuken, bar, kassa,
   reserveringen of kamers schermvullend op een tweede scherm, en dat scherm
   toont wat er in de zaak gebeurt. Het scherm LEEST alleen: het roept
   /api/supplier/state aan met de zaaksessie (rtg_sup_token) en tekent daaruit.
   Daarom is het een ingang voor de werkrol `zaak` (app-main-23b.js) en niet
   voor een lid: een lid zag een tegel die nooit opende.

   Wat het scherm toont, ontstaat elders in de zaak. De proef laat de kassa van
   dezelfde zaak verkopen (/api/supplier/pos/sale) en kijkt of het tweede scherm
   die verkoop in "Kassa vandaag" ziet -- ook na een herstart en een crash.
   Herstelbaar gaat dus over de LEZING: een dubbele tik op verversen, een
   afgebroken lezing en een crash vlak na een verkoop. Het scherm schrijft zelf
   niets, en dat staat in `grens`.

   De zaken zijn de demozaken van de kantoorwereld (manager, PIN 1234), zoals in
   scripts/conciergeproef.js.
   ========================================================================== */
'use strict';
const { nieuwLid, KANTOORWERELD } = require('../voltooiwereld');

const STAAT = '/api/supplier/state';
const VERKOOP = '/api/supplier/pos/sale';

async function zaakSessie(w, code) {
  const ro = await w.post('/api/supplier/roster', { code });
  const staf = (ro.data && ro.data.staff) || [];
  const man = staf.find((x) => x.role === 'manager') || staf[0];
  const r = await w.post('/api/supplier/login', { code, staffId: man && man.id, pin: '1234' });
  if (r.status !== 200 || !r.data || !r.data.token) throw new Error('de zaakinlog van ' + code + ' lukte niet (' + r.status + ')');
  return r.data.token;
}

/* Wat "Kassa vandaag" van scherm.html toont: dezelfde velden, dezelfde terugval. */
const kassa = (state) => { const p = (state && state.pos) || {};
  return { omzet: Number(p.omzet || p.total || 0), aantal: Number(p.aantal || p.count || (p.sales && p.sales.length) || 0) }; };

async function loop(w, stap) {
  const merk = 'ts' + Date.now().toString(36);
  let Z = await zaakSessie(w, 'KIKUNOI');
  let ander = await zaakSessie(w, 'PONTO');
  const lid = await nieuwLid(w, 'tsl');
  const staat = async (T) => { const r = await w.post(STAAT, {}, T); return r.status === 200 ? (r.data.state || r.data) : null; };
  const verkoop = (T, bedrag, idem) => w.post(VERKOOP, { total: bedrag, method: 'contant', items: [{ name: 'Proef ' + merk, qty: 1, price: bedrag }], idem }, T);
  let begin = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'de zaak opent het tweede scherm en ziet haar eigen naam en de kassa van vandaag', async () => {
    const s = await staat(Z);
    begin = s && kassa(s);
    return { klopt: !!s && !!s.supplier && s.supplier.code === 'KIKUNOI' && !!s.supplier.name && Number.isFinite(begin.omzet),
      ziet: s ? s.supplier.name + ', omzet ' + begin.omzet + ', verkopen ' + begin.aantal : 'geen staat' };
  });

  await stap('voltooibaar', 'de kassa van dezelfde zaak verkoopt; het tweede scherm toont de omzet en een verkoop meer', async () => {
    const v = await verkoop(Z, 12.5, 'voltooi-ts-een-' + merk);
    const na = kassa(await staat(Z));
    return { klopt: v.status === 200 && Math.abs(na.omzet - begin.omzet - 12.5) < 0.001 && na.aantal === begin.aantal + 1,
      ziet: 'verkoop ' + v.status + ', omzet ' + begin.omzet + ' -> ' + na.omzet + ', verkopen ' + begin.aantal + ' -> ' + na.aantal };
  });

  await stap('voltooibaar', 'een andere zaak ziet op haar tweede scherm haar eigen zaak, en de verkoop van deze zaak niet', async () => {
    const s = await staat(ander);
    const tekst = JSON.stringify(s || {});
    return { klopt: !!s && s.supplier.code === 'PONTO' && !tekst.includes('Proef ' + merk),
      ziet: (s && s.supplier.code) + ', verkoop van KIKUNOI zichtbaar: ' + tekst.includes('Proef ' + merk) };
  });

  await stap('voltooibaar', 'bevoegd: zonder inlog geeft het tweede scherm 401', async () => {
    const r = await w.post(STAAT, {});
    return { klopt: r.status === 401 && !!(r.data && r.data.error), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  await stap('voltooibaar', 'bevoegd: een lid met zijn ledensessie komt niet bij de staat van een zaak', async () => {
    const r = await w.post(STAAT, {}, lid.token);
    return { klopt: r.status === 401 || r.status === 403, ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  await stap('voltooibaar', 'bevoegd: met de sessie van een andere zaak verkoopt niemand op de kassa van deze zaak', async () => {
    const voor = kassa(await staat(Z));
    const v = await verkoop(ander, 99, 'voltooi-ts-ander-' + merk);
    const na = kassa(await staat(Z));
    return { klopt: v.status === 200 && na.omzet === voor.omzet && na.aantal === voor.aantal,
      ziet: 'verkoop met de PONTO-sessie ' + v.status + ' (landt bij PONTO), KIKUNOI blijft op ' + na.omzet };
  });

  /* ---------------- persistent ---------------- */
  const voor = kassa(await staat(Z));
  await w.herstart();
  await stap('persistent', 'na een nette herstart toont het tweede scherm dezelfde kassa', async () => {
    const na = kassa(await staat(Z));
    return { klopt: na.omzet === voor.omzet && na.aantal === voor.aantal, ziet: 'omzet ' + voor.omzet + ' -> ' + na.omzet + ', verkopen ' + na.aantal };
  });
  await stap('persistent', 'een nieuwe zaakinlog (een ander scherm aan de muur) ziet hetzelfde', async () => {
    Z = await zaakSessie(w, 'KIKUNOI');
    const na = kassa(await staat(Z));
    return { klopt: na.omzet === voor.omzet && na.aantal === voor.aantal, ziet: 'nieuwe sessie: omzet ' + na.omzet };
  });
  await stap('persistent', 'de verkoop die het scherm toont, staat in de opslag zelf', async () => {
    const plek = w.vindInOpslag('Proef ' + merk);
    return { klopt: plek.length >= 1, ziet: plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op verversen: twee lezingen tegelijk geven hetzelfde beeld', async () => {
    const [a, b] = await w.dubbel(STAAT, {}, Z);
    const ka = kassa(a.data && a.data.state), kb = kassa(b.data && b.data.state);
    return { klopt: a.status === 200 && b.status === 200 && ka.omzet === kb.omzet && ka.aantal === kb.aantal,
      ziet: 'lezingen ' + a.status + '/' + b.status + ', omzet ' + ka.omzet + '/' + kb.omzet };
  });
  await stap('herstelbaar', 'een afgebroken lezing laat niets achter: de volgende lezing klopt', async () => {
    const half = await w.afgebroken(STAAT, {}, Z);
    const na = kassa(await staat(Z));
    return { klopt: na.omzet === voor.omzet && na.aantal === voor.aantal, ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), omzet ' + na.omzet };
  });
  await stap('herstelbaar', 'een crash vlak na een verkoop: het tweede scherm toont hem daarna precies een keer', async () => {
    const v = await verkoop(Z, 7, 'voltooi-ts-crash-' + merk);
    await w.crash();
    const opnieuw = await verkoop(Z, 7, 'voltooi-ts-crash-' + merk);
    const na = kassa(await staat(Z));
    return { klopt: v.status === 200 && opnieuw.status === 200 && Math.abs(na.omzet - voor.omzet - 7) < 0.001 && na.aantal === voor.aantal + 1,
      ziet: 'verkoop ' + v.status + ', na SIGKILL dezelfde ' + opnieuw.status + ', omzet ' + voor.omzet + ' -> ' + na.omzet + ', verkopen ' + na.aantal };
  });
}

module.exports = {
  functie: 'link:tweedescherm',
  ingang: '/apps/scherm.html',
  persona: 'zaak',
  omgeving: KANTOORWERELD,
  belofte: 'een zaak zet haar kassa (of keuken, bar, reserveringen) op een tweede scherm en ziet daar wat er in de zaak gebeurt -- een andere zaak, een lid of een anonieme bezoeker ziet het niet, en na een herstart, een dubbele tik, een afgebroken lezing of een crash klopt het beeld',
  grens: 'Het tweede scherm schrijft zelf niets; het leest /api/supplier/state. Wat het toont, ontstaat hier via de kassa van dezelfde zaak (/api/supplier/pos/sale, contant), en herstelbaar gaat over de lezing en over een verkoop vlak voor een crash. Keuken, bar, kamers en de spiegel van de hoofd-app (realtime) lopen niet mee; de proef loopt de route van het scherm, niet het scherm zelf. De zaken zijn de demozaken van de kantoorwereld. Geen Redis of PostgreSQL in de wereld.',
  loop
};
