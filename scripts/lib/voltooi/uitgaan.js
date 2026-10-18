/* ============================================================================
   VOLTOOIPROEF: UITGAAN (link:uitgaan, /apps/uitgaan.html).

   De belofte, in de woorden van routes/member/winkel.js en terplaatse.js: de
   nachtadressen met hun gepubliceerde avonden; een lid zet zich met zijn
   gezelschap op de gastenlijst, en "uw codenaam is uw toegang". De zaak krijgt
   de aanmelding en ziet de gast op haar lijst; een vol event of een dubbele
   aanmelding wordt geweigerd met de reden; afmelden haalt de plek weer vrij.

   TWEE ACTOREN: het lid en de zaak (een synthetische leverancier uit de seed
   van de testomgeving, met een medewerker die inlogt langs de echte zaakdeur).
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, KANTOORWERELD } = require('../voltooiwereld');

const OVERZICHT = '/api/uitgaan';
const MIJN = '/api/uitgaan/mijn';
const RSVP = '/api/event/rsvp';
const AFMELDEN = '/api/event/rsvp/annuleer';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function zaakSessie(w, code) {
  const rooster = await w.post('/api/supplier/roster', { code });
  const man = ((rooster.data && rooster.data.staff) || []).find((x) => x.role === 'manager');
  if (!man) throw new Error('de zaak ' + code + ' heeft geen manager in het rooster');
  const z = await w.post('/api/supplier/login', { code, staffId: man.id, pin: '1234' });
  if (!z.data || !z.data.token) throw new Error('de manager van ' + code + ' kon niet inloggen (' + z.status + ')');
  return z.data.token;
}

async function loop(w, stap) {
  const lid = await nieuwLid(w, 'uit');
  const T = lid.token;
  let zaak = null, ev = null, codenaam = null, Z = null;
  const mijn = async (tok) => (((await w.post(MIJN, {}, tok || T)).data || {}).avonden || []);
  const gastenBijZaak = async () => {
    const st = ((await w.post('/api/supplier/state', {}, Z)).data || {}).state || {};
    const e = (st.events || []).find((x) => x.id === ev.id);
    return e ? (e.guests || []) : null;
  };

  await stap('voltooibaar', 'het lid ziet de nachtadressen met een gepubliceerde avond', async () => {
    const o = await w.post(OVERZICHT, {}, T);
    const lijst = (o.data && (o.data.zaken || o.data.adressen || o.data.plekken)) || [];
    for (const z of lijst) { const e = (z.events || z.avonden || []).find((x) => x.id); if (e) { zaak = z; ev = e; break; } }
    return { klopt: o.status === 200 && !!zaak && !!ev, ziet: lijst.length + ' adressen, eerste avond: ' + (ev ? ev.name + ' bij ' + (zaak.name || zaak.naam) : 'GEEN') };
  });

  await stap('voltooibaar', 'het lid zet zich met twee personen op de gastenlijst, en ziet de avond bij zijn eigen avonden', async () => {
    const r = await w.post(RSVP, { supplierCode: zaak.code, eventId: ev.id, qty: 2 }, T);
    codenaam = (((await w.post('/api/member/connections', {}, T)).data) || {}).codename;
    const m = (await mijn()).find((x) => (x.eventId || x.id) === ev.id);
    return { klopt: r.status === 200 && !!m, ziet: 'aanmelden ' + r.status + ', bij het lid: ' + (m ? JSON.stringify(m).slice(0, 90) : 'NIETS') };
  });

  await stap('voltooibaar', 'de zaak ziet het lid op de gastenlijst, op codenaam en met het aantal', async () => {
    Z = await zaakSessie(w, zaak.code);
    const g = ((await gastenBijZaak()) || []).find((x) => x.codename === codenaam);
    return { klopt: !!g && g.qty === 2 && g.checkedIn === false, ziet: g ? g.codename + ', ' + g.qty + ' pers., binnen=' + g.checkedIn : 'NIET OP DE LIJST' };
  });

  await stap('voltooibaar', 'een tweede aanmelding voor dezelfde avond wordt geweigerd met de reden', async () => {
    const r = await w.post(RSVP, { supplierCode: zaak.code, eventId: ev.id, qty: 1 }, T);
    return { klopt: r.status === 409 && /al op de gastenlijst/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  await stap('voltooibaar', 'een avond die niet bestaat, wordt geweigerd met de reden', async () => {
    const r = await w.post(RSVP, { supplierCode: zaak.code, eventId: 'bestaatniet', qty: 1 }, T);
    return { klopt: r.status === 404 && /niet gevonden/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  /* ---------------- persistent ---------------- */
  const voor = JSON.stringify(((await gastenBijZaak()) || []).find((x) => x.codename === codenaam));
  await w.herstart();
  Z = await zaakSessie(w, zaak.code);
  await stap('persistent', 'na een nette herstart staat het lid nog op de gastenlijst van de zaak, gelijk', async () => {
    const na = JSON.stringify(((await gastenBijZaak()) || []).find((x) => x.codename === codenaam));
    return { klopt: !!voor && na === voor, ziet: na === voor ? 'gelijk' : 'ANDERS' };
  });
  await stap('persistent', 'het lid ziet zijn avond in een nieuwe sessie', async () => {
    const m = (await mijn(await inloggen(w, lid))).find((x) => (x.eventId || x.id) === ev.id);
    return { klopt: !!m, ziet: m ? 'de avond staat er' : 'WEG' };
  });
  await stap('persistent', 'de aanmelding staat in de opslag zelf: op de gastenlijst van die avond bij die zaak', async () => {
    const bak = w.collectie('suppliers') || {};
    const zaken = Array.isArray(bak) ? bak : Object.values(bak);
    const z = zaken.find((x) => x && x.code === zaak.code);
    const e = z && (z.events || []).find((x) => x.id === ev.id);
    const g = e && (e.guests || []).find((x) => x.codename === codenaam);
    return { klopt: !!g && g.qty === 2, ziet: g ? 'in store.db/suppliers: ' + zaak.code + ' / ' + ev.id + ' / ' + g.qty + ' pers.' : 'NIET in de opslag' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'afmelden en dubbeltik op opnieuw aanmelden: een keer op de lijst, niet twee', async () => {
    const af = await w.post(AFMELDEN, { supplierCode: zaak.code, eventId: ev.id }, T);
    const [a, b] = await w.dubbel(RSVP, { supplierCode: zaak.code, eventId: ev.id, qty: 2 }, T);
    const n = ((await gastenBijZaak()) || []).filter((x) => x.codename === codenaam).length;
    return { klopt: af.status === 200 && [a, b].some((x) => x.status === 200) && geen5xx(a) && geen5xx(b) && n === 1,
      ziet: 'afmelden ' + af.status + ', opnieuw ' + a.status + '/' + b.status + ', ' + n + 'x op de lijst' };
  });
  await stap('herstelbaar', 'een afgebroken afmelding en opnieuw: van de lijst, en de tweede keer een nette melding', async () => {
    const half = await w.afgebroken(AFMELDEN, { supplierCode: zaak.code, eventId: ev.id }, T);
    const opnieuw = await w.post(AFMELDEN, { supplierCode: zaak.code, eventId: ev.id }, T);
    const n = ((await gastenBijZaak()) || []).filter((x) => x.codename === codenaam).length;
    return { klopt: geen5xx(opnieuw) && n === 0, ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + 'x op de lijst' };
  });
  await stap('herstelbaar', 'een crash direct na het aanmelden: de zaak heeft het lid op de lijst', async () => {
    const r = await w.post(RSVP, { supplierCode: zaak.code, eventId: ev.id, qty: 3 }, T);
    await w.crash();
    Z = await zaakSessie(w, zaak.code);
    const g = ((await gastenBijZaak()) || []).find((x) => x.codename === codenaam);
    return { klopt: r.status === 200 && !!g && g.qty === 3, ziet: 'aanmelden ' + r.status + ', na SIGKILL bij de zaak ' + (g ? g.qty + ' pers.' : 'NIETS') };
  });
  await stap('herstelbaar', 'een crash direct na het afmelden: de plek is vrij bij de zaak', async () => {
    const r = await w.post(AFMELDEN, { supplierCode: zaak.code, eventId: ev.id }, T);
    await w.crash();
    Z = await zaakSessie(w, zaak.code);
    const n = ((await gastenBijZaak()) || []).filter((x) => x.codename === codenaam).length;
    return { klopt: r.status === 200 && n === 0, ziet: 'afmelden ' + r.status + ', na SIGKILL ' + n + 'x op de lijst' };
  });
}

module.exports = {
  functie: 'link:uitgaan',
  ingang: '/apps/uitgaan.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een lid zet zich met zijn gezelschap op de gastenlijst van een avond, de zaak ziet hem op codenaam, en afmelden geeft de plek weer vrij',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. De zaak is een synthetische leverancier uit de seed van de testomgeving. Binnenkomen aan de deur (check-in door de zaak) en een vol event zijn niet gelopen. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
