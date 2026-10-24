/* ============================================================================
   VOLTOOIPROEF: MIJN LEVEN (link:leven, /apps/leven.html) -- het
   levens-command-center (LEVEN.md par. 1.5).

   De belofte van het scherm: drie vragen en verder rust -- hoe sta ik ervoor,
   wat komt eraan, moet ik iets doen. Wat er staat komt letterlijk uit
   /api/leven/cockpit, en alleen een datum die het lid ZELF ergens vastlegde
   wordt een regel ("Er gebeurt niets vanzelf; u beslist"). Er is geen knop die
   iets uitvoert: deze wereld OPENT alleen. Naast de lijn leest het werkblad
   wat er nu in RTG staat (/api/foodcourt, /api/uitgaan).

   Omdat deze wereld zelf niets schrijft, legt het lid zijn afspraak vast waar
   hij hoort: in zijn eigen agenda (/api/agenda/toevoegen). Dat er dan precies
   die ene regel op zijn lijn verschijnt -- en bij niemand anders -- is wat
   hier wordt gemeten.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const COCKPIT = '/api/leven/cockpit';
const FOODCOURT = '/api/foodcourt';
const UITGAAN = '/api/uitgaan';
const AGENDA = '/api/agenda/toevoegen';
const WEG = '/api/agenda/verwijder';

const dag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const merk = 'lv' + Date.now().toString(36);
  const L = await nieuwLid(w, 'lvl');
  const B = await nieuwLid(w, 'lvb');
  let item = null;
  const cockpit = async (tok) => ((await w.post(COCKPIT, {}, tok || L.token)).data) || {};
  const regels = (c, titel) => (c.uitzonderingen || []).filter((u) => u.titel === titel);

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een vers lid opent zijn lijn: een groet, niets te doen, en geen enkele knop die iets uitvoert', async () => {
    const r = await w.post(COCKPIT, {}, L.token);
    const c = r.data || {};
    return { klopt: r.status === 200 && !!(c.groet && c.groet.zin) && (c.uitzonderingen || []).length === 0 && Array.isArray(c.stil) &&
      !(c.uitzonderingen || []).some((u) => u.niveau !== 'kijken'),
      ziet: r.status + ', "' + (c.groet && c.groet.zin) + '", ' + (c.uitzonderingen || []).length + ' uitzonderingen, stil: ' + JSON.stringify(c.stil) };
  });

  await stap('voltooibaar', 'het lid legt over drie dagen een afspraak vast in zijn agenda; zijn lijn toont die, met waar het vandaan komt', async () => {
    const a = await w.post(AGENDA, { titel: 'Tandarts ' + merk, datum: dag(3), tijd: '09:30' }, L.token);
    item = ((a.data && a.data.items) || []).find((i) => i.titel === 'Tandarts ' + merk);
    const u = regels(await cockpit(), 'Tandarts ' + merk)[0];
    return { klopt: a.status === 200 && !!item && !!u && u.soort === 'komt' && u.wanneer === dag(3) && u.niveau === 'kijken' && !u.opening &&
      (u.gegevens || []).some((g) => /Agenda/.test(g)),
      ziet: 'agenda ' + a.status + ', op de lijn: ' + (u ? u.soort + ' ' + u.wanneer + ' (' + (u.gegevens || []).join('; ') + ')' : 'NIETS') };
  });

  await stap('voltooibaar', 'een afspraak ver weg haalt de cockpit niet: die toont alleen wat deze week speelt', async () => {
    await w.post(AGENDA, { titel: 'Verre reis ' + merk, datum: dag(200) }, L.token);
    const c = await cockpit();
    return { klopt: regels(c, 'Verre reis ' + merk).length === 0 && regels(c, 'Tandarts ' + merk).length === 1,
      ziet: 'over 200 dagen in de cockpit: ' + regels(c, 'Verre reis ' + merk).length + ', tandarts: ' + regels(c, 'Tandarts ' + merk).length };
  });

  await stap('voltooibaar', 'Ontdekken leest de zaken die nu in RTG staan, of zegt in woorden waarom niet', async () => {
    const f = await w.post(FOODCOURT, {}, L.token);
    const u = await w.post(UITGAAN, {}, L.token);
    const goed = (r) => r.status === 200 || (r.status >= 400 && r.status < 500 && r.data && typeof r.data.error === 'string');
    return { klopt: goed(f) && goed(u) && (f.status === 200 || u.status === 200),
      ziet: 'foodcourt ' + f.status + ' (' + ((f.data && f.data.restaurants) || []).length + ' restaurants), uitgaan ' + u.status };
  });

  await stap('bevoegd', 'bevoegdheid: zonder sessie geen levensbeeld (401)', async () => {
    const a = await w.post(COCKPIT, {});
    const b = await w.post(AGENDA, { titel: 'Anoniem', datum: dag(2) });
    return { klopt: a.status === 401 && b.status === 401, ziet: 'cockpit ' + a.status + ', agenda ' + b.status };
  });

  await stap('bevoegd', 'bevoegdheid: een ander lid ziet de afspraak van het eerste niet op zijn lijn en kan hem niet weghalen', async () => {
    const c = await cockpit(B.token);
    const x = await w.post(WEG, { id: item.id }, B.token);
    const bijL = await cockpit();
    return { klopt: !JSON.stringify(c).includes(merk) && regels(bijL, 'Tandarts ' + merk).length === 1,
      ziet: 'bij B: ' + (JSON.stringify(c).includes(merk) ? 'ZICHTBAAR' : 'niets') + ', weghalen door B ' + x.status + ', bij het lid nog ' + regels(bijL, 'Tandarts ' + merk).length };
  });

  await stap('bevoegd', 'bevoegdheid: een gratis account krijgt geen levensbeeld', async () => {
    const g = await nieuwLid(w, 'lvg', 'guest');
    const r = await w.post(COCKPIT, {}, g.token);
    return { klopt: r.status === 403 && /leden/.test((r.data && r.data.error) || ''), ziet: r.status + ' -- ' + (r.data && r.data.error) };
  });

  /* ---------------- persistent ---------------- */
  const vorm = (c) => JSON.stringify({ u: (c.uitzonderingen || []).map((u) => [u.titel, u.soort, u.wanneer]), f: ((c.lijn || {}).fasen || []).map((f) => f.id + ':' + f.staat) });
  const voor = vorm(await cockpit());
  await w.herstart();

  await stap('persistent', 'na een nette herstart toont de lijn hetzelfde: dezelfde afspraak, dezelfde fasen', async () => {
    const na = vorm(await cockpit());
    return { klopt: voor.includes('Tandarts') && na === voor, ziet: na === voor ? 'gelijk (' + na.length + ' tekens)' : 'ANDERS: ' + na.slice(0, 100) };
  });

  await stap('persistent', 'een nieuwe sessie (een ander toestel) leest hetzelfde levensbeeld', async () => {
    const tok = await inloggen(w, L);
    const na = vorm(await cockpit(tok));
    return { klopt: na === voor, ziet: na === voor ? 'nieuwe sessie leest hetzelfde' : 'ANDERS' };
  });

  await stap('persistent', 'de afspraak staat in de opslag zelf; de lijn is een lezing en geen kopie', async () => {
    const plek = w.vindInOpslag('Tandarts ' + merk);
    return { klopt: plek.length >= 1, ziet: 'in ' + plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op de lijn geeft twee keer hetzelfde beeld', async () => {
    const [a, b] = await w.dubbel(COCKPIT, {}, L.token);
    return { klopt: a.status === 200 && b.status === 200 && vorm(a.data) === vorm(b.data) && vorm(a.data) === voor, ziet: 'antwoorden ' + a.status + '/' + b.status };
  });

  await stap('herstelbaar', 'een dubbele tik bij het vastleggen van een afspraak met een herhaalsleutel: een regel op de lijn', async () => {
    const [a, b] = await w.dubbel(AGENDA, { titel: 'Kapper ' + merk, datum: dag(2), idem: 'leven-agenda-' + merk }, L.token);
    const n = regels(await cockpit(), 'Kapper ' + merk).length;
    return { klopt: geen5xx(a) && geen5xx(b) && n === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' regel(s)' };
  });

  await stap('herstelbaar', 'een afgebroken verzoek, daarna opnieuw: de lijn is heel', async () => {
    const half = await w.afgebroken(COCKPIT, {}, L.token);
    const r = await w.post(COCKPIT, {}, L.token);
    return { klopt: r.status === 200 && regels(r.data, 'Tandarts ' + merk).length === 1, ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + r.status };
  });

  await stap('herstelbaar', 'een crash direct na het weghalen van een afspraak: na de herstart staat hij niet meer op de lijn', async () => {
    const x = await w.post(WEG, { id: item.id }, L.token);
    await w.crash();
    const c = await cockpit();
    return { klopt: x.status === 200 && regels(c, 'Tandarts ' + merk).length === 0, ziet: 'weghalen ' + x.status + ', na SIGKILL op de lijn: ' + regels(c, 'Tandarts ' + merk).length };
  });
}

module.exports = {
  functie: 'link:leven',
  ingang: '/apps/leven.html',
  persona: 'lid',
  belofte: 'een lid ziet op zijn lijn alleen wat hij zelf ergens vastlegde en wat deze week speelt, zonder knop die iets voor hem doet, en niemand anders ziet het -- ook na een herstart, een dubbeltik, een afgebroken verzoek en een crash',
  grens: 'De proef loopt de routes van het werkblad, niet het werkblad; de panelen die in een eigen scherm openen (avond, bestellen, verblijf) zijn hun eigen onderdelen. De afspraak komt uit de eigen agenda; schoolfasen, werkrollen, Entourage en het paspoort worden niet gelopen. Het gegevensgesprek (/api/gegevens/*) wordt hier niet gelopen. Geen Redis of PostgreSQL.',
  loop
};
