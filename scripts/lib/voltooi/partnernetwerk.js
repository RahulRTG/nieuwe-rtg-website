/* ============================================================================
   VOLTOOIPROEF: PARTNER NETWORK (link:partnernetwerk, /apps/partner-network.html).

   De belofte van het scherm: een partnerzaak ziet op een plek wat er voor haar
   klaarligt -- vragen van leden die bij haar passen, haar beloften en wat
   aandacht vraagt -- met bij elk getal zijn bron, en antwoordt op een vraag
   zonder het scherm te verlaten. Er staat geen getal zonder bron.

   De zaak is KIKUNOI uit de seed, met haar manager langs de zaakdeur; de andere
   zaak is PONTO. Het lid zet een vraag uit langs de echte Mall-route en leest
   het antwoord daar terug. Geschreven wordt alleen langs de route die het
   scherm daarvoor gebruikt (/api/supplier/mall/aanvraag/reageer).
   ========================================================================== */
'use strict';
const { nieuwLid, KANTOORWERELD } = require('../voltooiwereld');

const OVERZICHT = '/api/supplier/netwerk/overzicht';
const REAGEER = '/api/supplier/mall/aanvraag/reageer';
const PLAATS = '/api/mall/aanvraag';
const MIJN = '/api/mall/aanvragen/mijn';

async function zaakSessie(w, code) {
  const rooster = await w.post('/api/supplier/roster', { code });
  const man = ((rooster.data && rooster.data.staff) || []).find((x) => x.role === 'manager');
  const z = await w.post('/api/supplier/login', { code, staffId: man && man.id, pin: '1234' });
  if (!z.data || !z.data.token) throw new Error('de manager van ' + code + ' kon niet inloggen (' + z.status + ')');
  return z.data.token;
}

async function loop(w, stap) {
  const merk = 'pn' + Date.now().toString(36);
  const L = await nieuwLid(w, 'pnl');
  let Z = await zaakSessie(w, 'KIKUNOI');
  const overzicht = async (tok) => ((await w.post(OVERZICHT, {}, tok || Z)).data) || {};
  const getal = (o, naam) => o.getallen && o.getallen[naam];
  const vraag = (wat, sleutel) => ({ wat, verdieping: 'eten', plek: 'Ibiza', budget: 400, sleutel });
  const mijnVraag = async (id) => ((((await w.post(MIJN, {}, L.token)).data) || {}).aanvragen || []).find((a) => a.id === id);
  let a = null, voor = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'de zaak opent Partner Network: elk getal draagt een bron, en wat geen bron heeft staat er als "niet gemeten" en niet als nul', async () => {
    voor = await overzicht();
    const g = Object.values(voor.getallen || {});
    const eerlijk = g.length >= 8 && g.every((x) => (x.waarde == null ? !!x.nietGemeten : typeof x.bron === 'string'));
    const kamers = getal(voor, 'kamersInVerkoop');
    return { klopt: voor.ok === true && eerlijk && kamers.waarde === null && !!kamers.nietGemeten && voor.nietGebouwd.length >= 3,
      ziet: g.length + ' getallen, kamers: ' + (kamers.nietGemeten ? 'niet gemeten' : kamers.waarde) + ', ' + (voor.nietGebouwd || []).length + ' x niet gebouwd' };
  });

  await stap('voltooibaar', 'een lid zet een vraag uit in de Mall; de zaak ziet hem als wachtende vraag, op codenaam', async () => {
    const p = await w.post(PLAATS, vraag('Prive-chef voor zes ' + merk, 'sl-' + merk), L.token);
    a = p.data && p.data.aanvraag;
    const o = await overzicht();
    const item = (o.aandacht || []).find((x) => x.soort === 'intentie' && x.id === a.id);
    return { klopt: p.status === 200 && !!item && getal(o, 'intentiesOpen').waarde === getal(voor, 'intentiesOpen').waarde + 1 && !JSON.stringify(item).includes('Voltooilid'),
      ziet: 'vraag ' + p.status + ', wachtend ' + getal(voor, 'intentiesOpen').waarde + ' -> ' + getal(o, 'intentiesOpen').waarde };
  });

  await stap('voltooibaar', 'de zaak antwoordt vanuit het scherm; het lid leest het antwoord, en de tellingen en responstijd volgen', async () => {
    const item = ((await overzicht()).aandacht || []).find((x) => x.id === a.id);
    const r = await w.post(REAGEER, { id: a.id, versie: item && item.versie, tekst: 'Wij koken zaterdag voor zes, zeven gangen.', prijs: 380 }, Z);
    const o = await overzicht();
    const bijLid = await mijnVraag(a.id);
    const reactie = bijLid && bijLid.reacties.find((x) => /zeven gangen/.test(x.tekst));
    return { klopt: r.status === 200 && !!reactie && getal(o, 'intentiesBeantwoord').waarde === getal(voor, 'intentiesBeantwoord').waarde + 1 &&
      getal(o, 'intentiesOpen').waarde === getal(voor, 'intentiesOpen').waarde && Number.isFinite(getal(o, 'responstijdMin').waarde),
      ziet: 'reactie ' + r.status + ', lid leest ' + !!reactie + ', beantwoord ' + getal(o, 'intentiesBeantwoord').waarde + ', responstijd ' + getal(o, 'responstijdMin').waarde + ' min' };
  });

  await stap('voltooibaar', 'een andere zaak ziet het antwoord van deze zaak niet in haar netwerk, en een lid komt niet in het netwerkoverzicht', async () => {
    const P = await zaakSessie(w, 'PONTO');
    const op = await overzicht(P);
    const item = (op.aandacht || []).find((x) => x.id === a.id);
    const lid = await w.post(OVERZICHT, {}, L.token);
    return { klopt: op.ok === true && getal(op, 'intentiesBeantwoord').waarde === 0 && !JSON.stringify(op).includes('zeven gangen') &&
      lid.status === 401 && op.zaak.code === 'PONTO',
      ziet: 'PONTO beantwoord ' + getal(op, 'intentiesBeantwoord').waarde + ', ziet de vraag ' + (item ? 'als eigen open vraag' : 'niet') + '; lid ' + lid.status };
  });

  await stap('voltooibaar', 'zonder sessie leest of schrijft niemand iets: beide geven 401 met een melding', async () => {
    const l = await w.post(OVERZICHT, {});
    const s = await w.post(REAGEER, { id: a.id, tekst: 'Anoniem antwoord' });
    return { klopt: l.status === 401 && s.status === 401 && !!(l.data && l.data.error) && !!(s.data && s.data.error),
      ziet: 'lezen ' + l.status + ', schrijven ' + s.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart toont het netwerk dezelfde tellingen', async () => {
    const o = await overzicht();
    return { klopt: getal(o, 'intentiesBeantwoord').waarde === getal(voor, 'intentiesBeantwoord').waarde + 1,
      ziet: 'beantwoord ' + getal(o, 'intentiesBeantwoord').waarde };
  });
  await stap('persistent', 'de manager logt opnieuw in en het lid leest het antwoord nog steeds', async () => {
    Z = await zaakSessie(w, 'KIKUNOI');
    const o = await overzicht();
    const bijLid = await mijnVraag(a.id);
    return { klopt: o.ok === true && !!bijLid && bijLid.reacties.length === 1, ziet: 'reacties bij het lid ' + (bijLid && bijLid.reacties.length) };
  });
  await stap('persistent', 'een read-only lezer vindt het antwoord in de opslag', async () => {
    const plek = w.vindInOpslag('zeven gangen');
    return { klopt: plek.length >= 1, ziet: plek.map((p) => p.bestand + '/' + p.tabel + (p.sleutel ? ':' + p.sleutel : '')).join(', ') || 'nergens' };
  });

  /* ---------------- herstelbaar ---------------- */
  /* Het scherm antwoordt op een WACHTENDE vraag, met de versie uit het
     overzicht. Dezelfde reactie op dezelfde versie is een herhaling en geen
     tweede (kern/mall/aanvragen.js); een zaak heeft per vraag een reactie. */
  const nieuweVraag = async (wat, sleutel) => {
    const v = (await w.post(PLAATS, vraag(wat + ' ' + merk, sleutel + merk), L.token)).data.aanvraag;
    const item = ((await overzicht()).aandacht || []).find((x) => x.id === v.id);
    return { id: v.id, versie: item && item.versie };
  };
  await stap('herstelbaar', 'een dubbele tik op "Versturen" geeft een reactie', async () => {
    const v = await nieuweVraag('Kok voor een verjaardag', 'sl2-');
    const [x, y] = await w.dubbel(REAGEER, { id: v.id, versie: v.versie, tekst: 'Wij komen graag, vier gangen.', prijs: 250 }, Z);
    const bij = await mijnVraag(v.id);
    return { klopt: x.status === 200 && y.status === 200 && bij.reacties.length === 1, ziet: 'tikken ' + x.status + '/' + y.status + ', reacties ' + bij.reacties.length };
  });
  await stap('herstelbaar', 'een afgebroken antwoord, daarna hetzelfde opnieuw: een reactie', async () => {
    const v = await nieuweVraag('Lunch voor acht', 'sl3-');
    const lijf = { id: v.id, versie: v.versie, tekst: 'Wij verzorgen de lunch.', prijs: 300 };
    const half = await w.afgebroken(REAGEER, lijf, Z);
    const opnieuw = await w.post(REAGEER, lijf, Z);
    const bij = await mijnVraag(v.id);
    return { klopt: opnieuw.status === 200 && bij.reacties.length === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', reacties ' + bij.reacties.length };
  });
  await stap('herstelbaar', 'een crash direct na het antwoord: na de herstart een reactie, de herhaling telt niet dubbel, en de tellingen kloppen', async () => {
    const v = await nieuweVraag('Diner op het strand', 'sl4-');
    const lijf = { id: v.id, versie: v.versie, tekst: 'Strandtafel voor twee.', prijs: 180 };
    const r = await w.post(REAGEER, lijf, Z);
    await w.crash();
    Z = await zaakSessie(w, 'KIKUNOI');
    const opnieuw = await w.post(REAGEER, lijf, Z);
    const o = await overzicht();
    const bij = await mijnVraag(v.id);
    return { klopt: r.status === 200 && opnieuw.status < 500 && bij.reacties.length === 1 &&
      getal(o, 'intentiesBeantwoord').waarde === getal(voor, 'intentiesBeantwoord').waarde + 4,
      ziet: 'na SIGKILL: herhaling ' + opnieuw.status + ', reacties ' + bij.reacties.length + ', beantwoord ' + getal(o, 'intentiesBeantwoord').waarde };
  });
}

module.exports = {
  functie: 'link:partnernetwerk',
  ingang: '/apps/partner-network.html',
  persona: 'zaak',
  omgeving: KANTOORWERELD,
  belofte: 'een partnerzaak ziet de vragen van leden die bij haar passen, haar beloften en wat aandacht vraagt, met bij elk getal zijn bron, en antwoordt op een vraag; dat staat na een herstart en een crash, en een andere zaak of een lid ziet het niet',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf (die toets staat in test/partnernetwerk-scherm.test.js). Conciërge-onderdelen en samenwerkingen worden alleen geteld, niet aangemaakt: de seed heeft geen creator en geen conciërge-case met deze zaak. Kamers zijn voor een restaurant niet gemeten. De zaak logt in met de seed-personeelspin. Geen Redis of PostgreSQL.',
  loop
};
