/* ============================================================================
   VOLTOOIPROEF: RTG HORECA (link:horeca, /apps/horeca.html).

   De belofte van het scherm: een zaak bedient een tafel van rekening openen tot
   afrekenen, en wat de bediening doet staat er daarna -- ook als het toestel
   offline werkte, dubbel tikte of de server halverwege viel. Een andere zaak
   ziet en wijzigt er niets van.

   De zaak is KIKUNOI uit de seed, met haar manager op naam langs de zaakdeur
   (zelfde recept als ./mijnmall.js); de andere organisatie is PONTO. Alles
   loopt over /api/supplier/horeca/*, het voorvoegsel waarop het scherm via
   RTGHoreca.api zijn routes bouwt (public/apps/horeca/kern.js).

   Voltooibaar lijkt op de tafelproef (scripts/tafelproef.js), maar die meet de
   overdracht tussen gast, zaal en keuken. Deze proef meet wat daar niet in zit:
   blijft het staan na een herstart en een crash, en is de offline sync -- de
   herhaalweg die het scherm zelf heeft -- echt eenmalig.
   ========================================================================== */
'use strict';
const { nieuwLid, KANTOORWERELD } = require('../voltooiwereld');

const KAART = '/api/supplier/horeca/kaart';
const OPEN = '/api/supplier/horeca/rekening/open';
const REGEL = '/api/supplier/horeca/rekening/regel';
const REKENING = '/api/supplier/horeca/rekening';
const REKENINGEN = '/api/supplier/horeca/rekeningen';
const VRIJ = '/api/supplier/horeca/gang/vrij';
const BORD = '/api/supplier/horeca/keuken/bord';
const STAND = '/api/supplier/horeca/keuken/stand';
const BETAAL = '/api/supplier/horeca/betaal';
const SYNC = '/api/supplier/horeca/offline/sync';

async function zaakSessie(w, code) {
  const rooster = await w.post('/api/supplier/roster', { code });
  const man = ((rooster.data && rooster.data.staff) || []).find((x) => x.role === 'manager');
  if (!man) throw new Error('de zaak ' + code + ' heeft geen manager in het rooster');
  const z = await w.post('/api/supplier/login', { code, staffId: man.id, pin: '1234' });
  if (!z.data || !z.data.token) throw new Error('de manager van ' + code + ' kon niet inloggen (' + z.status + ')');
  return z.data.token;
}

async function loop(w, stap) {
  const merk = 'H' + Date.now().toString(36).slice(-5);
  const TAFEL = 'T' + merk;
  let Z = await zaakSessie(w, 'KIKUNOI');
  const rekening = async (id) => (await w.post(REKENING, { rekeningId: id }, Z));
  const offline = (tafel) => ({ bonnen: [{ clientId: 'pda-' + merk + '-' + tafel, soort: 'opgenomen', tafel, gasten: 2,
    regels: [{ naam: 'Gamba ' + merk, aantal: 2, centen: 1450, gang: 1, station: 'koud', allergie: 'schaaldier: nee' }] }] });
  const offlineTel = async (tafel) => {
    const l = await w.post(REKENINGEN, { status: 'open' }, Z);
    return ((l.data && l.data.rekeningen) || []).filter((r) => r.tafel === tafel).length;
  };
  let rekId = null, item = null, regelId = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'de zaak opent een rekening op een tafel en slaat een gerecht aan tegen de prijs van de eigen kaart', async () => {
    const k = await w.post(KAART, {}, Z);
    item = k.data && k.data.groepen && k.data.groepen[0].items.find((i) => !i.uitverkocht);
    const o = await w.post(OPEN, { tafel: TAFEL, gasten: 2 }, Z);
    rekId = o.data && o.data.rekening && o.data.rekening.id;
    /* Een prijs uit de client telt niet: de kaart van de zaak beslist. */
    const r = await w.post(REGEL, { rekeningId: rekId, itemId: item.id, aantal: 2, gang: 0, centen: 1 }, Z);
    regelId = r.data && r.data.regel && r.data.regel.id;
    return { klopt: o.status === 200 && r.status === 200 && r.data.regel.centen === item.centen && r.data.rekening.regels.length === 1,
      ziet: 'open ' + o.status + ', regel ' + r.status + ', prijs ' + (r.data && r.data.regel && r.data.regel.centen) + ' (kaart ' + (item && item.centen) + ')' };
  });

  await stap('voltooibaar', 'een tweede rekening op dezelfde tafel wordt geweigerd met de bestaande erbij', async () => {
    const o = await w.post(OPEN, { tafel: TAFEL }, Z);
    return { klopt: o.status === 409 && o.data.rekeningId === rekId && /al een open rekening/.test(o.data.error),
      ziet: o.status + ' (' + (o.data && o.data.error) + ')' };
  });

  await stap('voltooibaar', 'de zaal geeft de gang vrij, de keuken ziet de bon en zet hem op uitgegeven', async () => {
    const v = await w.post(VRIJ, { rekeningId: rekId, gang: 0 }, Z);
    const bord = await w.post(BORD, {}, Z);
    const bon = ((bord.data && bord.data.bonnen) || []).find((b) => b.regelId === regelId);
    const s = await w.post(STAND, { rekeningId: rekId, regelId, stand: 'uitgegeven' }, Z);
    const r = await rekening(rekId);
    const regel = r.data && r.data.rekening.regels.find((x) => x.id === regelId);
    return { klopt: v.status === 200 && !!bon && s.status === 200 && regel && regel.stand === 'uitgegeven',
      ziet: 'vrij ' + v.status + ', bon op bord ' + !!bon + ', stand ' + (regel && regel.stand) };
  });

  await stap('voltooibaar', 'de zaak rekent het openstaande bedrag af met pin; de rekening is gesloten', async () => {
    const voor = await rekening(rekId);
    const te = voor.data && voor.data.rekening.openstaand;
    const b = await w.post(BETAAL, { rekeningId: rekId, wijze: 'pin', centen: te }, Z);
    const na = await rekening(rekId);
    return { klopt: te === item.centen * 2 && b.status === 200 && b.data.gesloten === true && na.data.rekening.status === 'betaald',
      ziet: 'openstaand ' + te + ', betaal ' + b.status + ', stand ' + (na.data && na.data.rekening.status) };
  });

  await stap('bevoegd', 'een andere zaak leest of wijzigt deze rekening niet, en een lid zonder zaak komt er niet in', async () => {
    const P = await zaakSessie(w, 'PONTO');
    const lezen = await w.post(REKENING, { rekeningId: rekId }, P);
    const regel = await w.post(REGEL, { rekeningId: rekId, naam: 'Ingeschoven', centen: 100 }, P);
    const lijst = await w.post(REKENINGEN, { status: 'betaald' }, P);
    const lid = await nieuwLid(w, 'hor');
    const L = await w.post(REKENINGEN, {}, lid.token);
    const r = await rekening(rekId);
    return { klopt: lezen.status === 404 && regel.status === 404 && !((lijst.data && lijst.data.rekeningen) || []).some((x) => x.id === rekId) &&
      L.status === 401 && r.data.rekening.regels.length === 1,
      ziet: 'PONTO lezen ' + lezen.status + ', aanslaan ' + regel.status + '; lid ' + L.status + '; regels ' + r.data.rekening.regels.length };
  });

  await stap('voltooibaar', 'zonder sessie leest of schrijft niemand iets: beide geven 401 met een melding', async () => {
    const l = await w.post(REKENINGEN, {});
    const s = await w.post(OPEN, { tafel: 'Anoniem' });
    return { klopt: l.status === 401 && s.status === 401 && !!(l.data && l.data.error) && !!(s.data && s.data.error),
      ziet: 'lezen ' + l.status + ', schrijven ' + s.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat de rekening betaald, met de regel op uitgegeven', async () => {
    const r = await rekening(rekId);
    const x = r.data && r.data.rekening;
    return { klopt: r.status === 200 && x.status === 'betaald' && x.regels.length === 1 && x.regels[0].stand === 'uitgegeven' && x.betalingen.length === 1,
      ziet: 'status ' + r.status + ', ' + (x && x.status) + ', ' + (x && x.betalingen.length) + ' betaling' };
  });
  await stap('persistent', 'de manager logt opnieuw in en vindt de rekening onder de betaalde', async () => {
    Z = await zaakSessie(w, 'KIKUNOI');
    const l = await w.post(REKENINGEN, { status: 'betaald' }, Z);
    const rij = ((l.data && l.data.rekeningen) || []).find((x) => x.id === rekId);
    return { klopt: l.status === 200 && !!rij && rij.tafel === TAFEL && rij.openstaand === 0,
      ziet: 'lijst ' + l.status + ', rij ' + (rij ? rij.tafel + ' openstaand ' + rij.openstaand : 'WEG') };
  });
  await stap('persistent', 'een read-only lezer vindt de rekening van deze tafel in de opslag', async () => {
    const plek = w.vindInOpslag(TAFEL);
    return { klopt: plek.length >= 1, ziet: plek.map((p) => p.bestand + '/' + p.tabel + (p.sleutel ? ':' + p.sleutel : '')).join(', ') || 'nergens' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op "Synchroniseer" boekt een offline bestelling een keer', async () => {
    const t = 'D' + merk;
    const [a, b] = await w.dubbel(SYNC, offline(t), Z);
    const n = await offlineTel(t);
    return { klopt: a.status === 200 && b.status === 200 && a.data.nieuw + b.data.nieuw === 1 && n === 1,
      ziet: 'tikken ' + a.status + '/' + b.status + ', nieuw ' + (a.data && a.data.nieuw) + '+' + (b.data && b.data.nieuw) + ', rekeningen ' + n };
  });
  await stap('herstelbaar', 'een afgebroken sync, daarna opnieuw: een rekening, en de herhaling zegt dat hij al binnen was', async () => {
    const t = 'A' + merk;
    const half = await w.afgebroken(SYNC, offline(t), Z);
    const opnieuw = await w.post(SYNC, offline(t), Z);
    const n = await offlineTel(t);
    return { klopt: opnieuw.status === 200 && n === 1 && (opnieuw.data.nieuw + opnieuw.data.dubbel) === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw nieuw ' + (opnieuw.data && opnieuw.data.nieuw) +
        ' dubbel ' + (opnieuw.data && opnieuw.data.dubbel) + ', rekeningen ' + n };
  });
  await stap('herstelbaar', 'een crash direct na de sync: de bestelling staat er met haar allergie, en opnieuw syncen boekt niets bij', async () => {
    const t = 'C' + merk;
    const r = await w.post(SYNC, offline(t), Z);
    await w.crash();
    Z = await zaakSessie(w, 'KIKUNOI');
    const opnieuw = await w.post(SYNC, offline(t), Z);
    const n = await offlineTel(t);
    const id = r.data && r.data.bonnen && r.data.bonnen[0] && r.data.bonnen[0].id;
    const x = id && (await rekening(id)).data;
    const regel = x && x.rekening && x.rekening.regels[0];
    return { klopt: r.status === 200 && r.data.nieuw === 1 && opnieuw.status === 200 && opnieuw.data.dubbel === 1 && opnieuw.data.nieuw === 0 &&
      n === 1 && regel && regel.stand === 'besteld' && regel.allergie === 'schaaldier: nee',
      ziet: 'na SIGKILL: dubbel ' + (opnieuw.data && opnieuw.data.dubbel) + ', rekeningen ' + n + ', regel ' + (regel && regel.stand + ' / ' + regel.allergie) };
  });
  await stap('herstelbaar', 'een dubbele tik op "Afrekenen" schrijft een betaling', async () => {
    const t = 'B' + merk;
    const o = await w.post(OPEN, { tafel: t }, Z);
    const id = o.data.rekening.id;
    await w.post(REGEL, { rekeningId: id, itemId: item.id, aantal: 1 }, Z);
    const te = (await rekening(id)).data.rekening.openstaand;
    const [a, b] = await w.dubbel(BETAAL, { rekeningId: id, wijze: 'pin', centen: te }, Z);
    const x = (await rekening(id)).data.rekening;
    return { klopt: [a, b].some((q) => q.status === 200) && [a, b].every((q) => q.status < 500) && x.betalingen.length === 1 && x.status === 'betaald',
      ziet: 'tikken ' + a.status + '/' + b.status + ', ' + x.betalingen.length + ' betaling, ' + x.status };
  });
}

module.exports = {
  functie: 'link:horeca',
  ingang: '/apps/horeca.html',
  persona: 'ondernemer',
  omgeving: KANTOORWERELD,
  belofte: 'een zaak bedient een tafel van rekening openen tot afrekenen, en een offline opgenomen bestelling komt precies een keer binnen -- na een herstart, een dubbele tik, een afgebroken verzoek en een crash -- terwijl een andere zaak er niets van ziet',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf. De zaak logt in met de personeelspin van de seed (de testwereld staat die toe; in productie gaat de zaakdeur via het persoonlijke RTG-account). De gastkant, de bezorging en hotel/club staan erbuiten (de gastkant meet de tafelproef). Pin is een registratie, geen echte betaalrail. Geen Redis of PostgreSQL.',
  loop
};
