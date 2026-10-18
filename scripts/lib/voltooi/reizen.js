/* ============================================================================
   VOLTOOIPROEF: REIZEN & VEILIG (link:reizen, /apps/reizen-veilig.html) -- de
   Live Circle.

   De belofte, in de woorden van het scherm en kern/veiligheid/moment.js: "Wie
   mag uw aankomst zien?" Een lid maakt een Moment rond een reis of afspraak en
   kiest per ontvanger hoeveel die ziet (alleen het plan, de voortgang, of -- en
   alleen voor een verbonden persoon -- een tijdelijke locatie). "Nadrukkelijk
   geen tweede vriendenlijst en geen permanent volgspoor": na de eindtijd of een
   stop levert de kern niets meer uit.

   TWEE ACTOREN, EN DE ONTVANGER IS HET PUNT. Lid A deelt een Moment met lid B
   (verbonden via de Salon), zoals het scherm het doet: B's codenaam in het veld
   "Codenaam of bedrijfscode". B ziet het Moment bij zich; A meldt "aangekomen";
   A pauzeert en B ziet niets meer; A stopt en het is weg.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, verbind } = require('../voltooiwereld');

const MIJN = '/api/veiligheid/moment';
const MAAK = '/api/veiligheid/moment/maak';
const STATUS = '/api/veiligheid/moment/status';
const PAUZE = '/api/veiligheid/moment/pauze';
const STOP = '/api/veiligheid/moment/stop';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const merk = 'mo' + Date.now().toString(36);
  const A = await nieuwLid(w, 'rza');
  const B = await nieuwLid(w, 'rzb');
  const C = await nieuwLid(w, 'rzc');
  const v = await verbind(w, A, B);
  const voorB = async (tok) => ((((await w.post(MIJN, {}, tok || B.token)).data) || {}).voorMij || []);
  const eigen = async (tok) => ((((await w.post(MIJN, {}, tok || A.token)).data) || {}).momenten || []);
  const codenaamC = ((((await w.post('/api/member/connections', {}, C.token)).data) || {}).codename);
  /* Precies wat het formulier stuurt: een ontvanger met de codenaam die het
     lid intypt (public/apps/reizen-veilig.js). */
  const maak = (titel, wie, niveau) => w.post(MAAK, { titel, doel: 'Huis', minuten: 240,
    ontvangers: [{ soort: 'contact', id: wie, niveau: niveau || 'voortgang' }] }, A.token);
  let m = null;

  await stap('voltooibaar', 'een Moment voor iemand met wie A niet verbonden is, wordt geweigerd met de reden', async () => {
    const r = await maak('Vreemde ' + merk, codenaamC);
    return { klopt: r.status === 400 && /verbonden persoon/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  await stap('voltooibaar', 'A deelt een Moment met B, met B\'s codenaam zoals het formulier hem vraagt', async () => {
    const r = await maak('Diner ' + merk, v.b.codenaam);
    m = r.data && r.data.moment;
    const e = (await eigen()).find((x) => x.id === (m && m.id));
    return { klopt: r.status === 200 && !!e && e.ontvangers.length === 1 && e.status === 'gepland', ziet: 'maak ' + r.status + (r.data && r.data.error ? ' (' + r.data.error + ')' : '') + ', bij A: ' + (e ? e.status + ' voor ' + e.ontvangers.map((o) => o.naam).join(',') : 'NIETS') };
  });

  await stap('voltooibaar', 'B ziet het Moment bij zich: van wie, wat en de voortgang -- en geen plek op dit niveau', async () => {
    const b = (await voorB()).find((x) => x.id === (m && m.id));
    return { klopt: !!b && b.eigenaar === v.a.codenaam && b.status === 'gepland' && b.niveau === 'voortgang' && !('plek' in b), ziet: b ? 'van ' + b.eigenaar + ', ' + b.status + ', niveau ' + b.niveau : 'NIETS' };
  });

  await stap('voltooibaar', 'A meldt dat hij is aangekomen; B ziet het', async () => {
    const r = await w.post(STATUS, { id: m.id, status: 'aangekomen' }, A.token);
    const b = (await voorB()).find((x) => x.id === m.id);
    return { klopt: r.status === 200 && !!b && b.status === 'aangekomen', ziet: 'status ' + r.status + ', B ziet ' + (b && b.status) };
  });

  await stap('voltooibaar', 'A pauzeert: B ziet niets meer; hervatten brengt het terug', async () => {
    const p = await w.post(PAUZE, { id: m.id, aan: true }, A.token);
    const leeg = (await voorB()).find((x) => x.id === m.id);
    const h = await w.post(PAUZE, { id: m.id, aan: false }, A.token);
    const terug = (await voorB()).find((x) => x.id === m.id);
    return { klopt: p.status === 200 && !leeg && h.status === 200 && !!terug, ziet: 'gepauzeerd: B ziet ' + (leeg ? 'NOG' : 'niets') + '; hervat: B ziet ' + (terug ? 'het weer' : 'NIETS') };
  });

  await stap('voltooibaar', 'A stopt: het Moment is weg, voor A en voor B', async () => {
    const s = await w.post(STOP, { id: m.id }, A.token);
    const b = (await voorB()).find((x) => x.id === m.id);
    const e = (await eigen()).find((x) => x.id === m.id);
    return { klopt: s.status === 200 && !b && !e, ziet: 'stop ' + s.status + ', B ' + (b ? 'ZIET NOG' : 'ziet niets') + ', A ' + (e ? 'HEEFT NOG' : 'niets') };
  });

  /* ---------------- persistent ---------------- */
  const tweede = (await maak('Terugreis ' + merk, v.b.codenaam)).data;
  const m2 = tweede && tweede.moment;
  const voor = JSON.stringify((await voorB()).find((x) => x.id === (m2 && m2.id)));
  await w.herstart();
  await stap('persistent', 'na een nette herstart ziet B het lopende Moment nog, gelijk', async () => {
    const na = JSON.stringify((await voorB()).find((x) => x.id === (m2 && m2.id)));
    return { klopt: !!m2 && na === voor && voor !== undefined, ziet: na === voor ? 'gelijk' : 'ANDERS' };
  });
  await stap('persistent', 'A en B lezen het in een nieuwe sessie', async () => {
    const e = (await eigen(await inloggen(w, A))).find((x) => x.id === m2.id);
    const b = (await voorB(await inloggen(w, B))).find((x) => x.id === m2.id);
    return { klopt: !!e && !!b, ziet: 'A ' + (e ? 'ziet het' : 'NIET') + ', B ' + (b ? 'ziet het' : 'NIET') };
  });
  await stap('persistent', 'het Moment staat in de opslag zelf', async () => {
    const plek = w.vindInOpslag(m2.id);
    return { klopt: plek.length >= 1, ziet: 'Moment in ' + plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op "Moment starten": B krijgt er een, niet twee', async () => {
    const lijf = { titel: 'Dubbel ' + merk, doel: 'Huis', minuten: 120, ontvangers: [{ soort: 'contact', id: v.b.codenaam, niveau: 'plan' }] };
    const [a, b] = await w.dubbel(MAAK, lijf, A.token);
    const n = (await voorB()).filter((x) => x.titel === 'Dubbel ' + merk).length;
    return { klopt: a.status === 200 && geen5xx(b) && n === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', B ziet ' + n + ' Moment(en)' };
  });
  await stap('herstelbaar', 'een afgebroken start en opnieuw: B krijgt er precies een', async () => {
    const lijf = { titel: 'Afgebroken ' + merk, doel: 'Huis', minuten: 120, ontvangers: [{ soort: 'contact', id: v.b.codenaam, niveau: 'plan' }] };
    const half = await w.afgebroken(MAAK, lijf, A.token);
    const opnieuw = await w.post(MAAK, lijf, A.token);
    const n = (await voorB()).filter((x) => x.titel === 'Afgebroken ' + merk).length;
    return { klopt: geen5xx(opnieuw) && n === 1, ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', B ziet ' + n };
  });
  await stap('herstelbaar', 'een crash direct na een stop: wat gestopt heette, blijft weg voor B', async () => {
    const s = await w.post(STOP, { id: m2.id }, A.token);
    await w.crash();
    const b = (await voorB(await inloggen(w, B))).find((x) => x.id === m2.id);
    return { klopt: s.status === 200 && !b, ziet: 'stop ' + s.status + ', na SIGKILL ziet B ' + (b ? 'het NOG' : 'niets') };
  });
  await stap('herstelbaar', 'een crash direct na een voortgangsmelding: B ziet de nieuwe stand', async () => {
    const n = (await maak('Na crash ' + merk, v.b.codenaam)).data;
    const r = await w.post(STATUS, { id: n.moment.id, status: 'vertraagd', eta: '21:15' }, A.token);
    await w.crash();
    const b = (await voorB(await inloggen(w, B))).find((x) => x.id === n.moment.id);
    return { klopt: r.status === 200 && !!b && b.status === 'vertraagd' && b.eta === '21:15', ziet: 'status ' + r.status + ', na SIGKILL ziet B ' + (b ? b.status + ' ' + b.eta : 'NIETS') };
  });
}

module.exports = {
  functie: 'link:reizen',
  ingang: '/apps/reizen-veilig.html',
  persona: 'lid',
  belofte: 'een lid deelt een Moment rond een reis met wie hij kiest, op het niveau dat hij kiest, de ontvanger ziet de voortgang, en na een pauze of stop ziet hij niets meer',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Een Moment voor een bedrijf (de aankomst bij een zaak) en het locatieniveau zijn niet gelopen; ook niet het aflopen op de eindtijd (dat vraagt een klok die vooruit kan). Het reisaanbod op dit scherm is een leesvenster op het Reisbureau en hoort bij een andere belofte. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
