/* ============================================================================
   VOLTOOIPROEF: RTG SPORT (link:sport, /apps/sport.html).

   De belofte van het scherm: "Alles rondom de wedstrijd" -- een lid kiest een
   thuiswedstrijd en een vak op de plattegrond die de club zelf tekent,
   reserveert tickets (afrekenen aan de poort), ziet zijn toegangscode onder
   Mijn tickets, en die code wordt bij de entree EEN keer gescand. Een vol vak
   zegt hoeveel plaatsen er nog zijn. Interesse in een sponsorpakket gaat op
   codenaam, en de club beslist.

   De club is een echte leveranciersinlog (rooster + pin), langs dezelfde weg
   als test/sportclub.test.js; het scannen bij de poort is haar handeling, niet
   die van het lid. Er wordt niets betaald: de reservering zegt zelf dat het
   afrekenen aan de poort gebeurt.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, KANTOORWERELD } = require('../voltooiwereld');

const BORD = '/api/member/sport/bord';
const KAART = '/api/member/sport/plattegrond';
const KOOP = '/api/member/sport/ticket/koop';
const MIJN = '/api/member/sport/tickets';
const SPONSORS = '/api/member/sport/sponsors';
const SPONSOR = '/api/member/sport/sponsor';
const SCAN = '/api/sport/scan';
const CLUBKAART = '/api/sport/plattegrond/zet';
const CLUBPLAN = '/api/sport/plattegrond';

async function loop(w, stap) {
  const merk = 'sp' + Date.now().toString(36);
  const A = await nieuwLid(w, 'spa');
  const B = await nieuwLid(w, 'spb');
  const gast = await nieuwLid(w, 'spg', 'guest');
  const rooster = await w.post('/api/supplier/roster', { code: 'FCRTG' });
  const man = ((rooster.data && rooster.data.staff) || []).find((m) => m.role === 'manager');
  if (!man) throw new Error('geen manager in het rooster van FCRTG (' + rooster.status + ')');
  const clubLogin = async () => {
    const r = await w.post('/api/supplier/login', { code: 'FCRTG', staffId: man.id, pin: '1234' });
    if (!r.data || !r.data.token) throw new Error('de club kon niet inloggen (' + r.status + ')');
    return r.data.token;
  };
  let C = await clubLogin();
  let wedstrijd = null, vak = null, eerste = null;
  const VAK = 'V' + merk.slice(-6).toUpperCase();
  const mijn = async (tok) => { const r = await w.post(MIJN, {}, tok); return r.status === 200 ? r.data.tickets || [] : null; };
  const koop = (tok, aantal, idem) => w.post(KOOP, { club: 'FCRTG', wedstrijdId: wedstrijd, vak, aantal, idem }, tok);

  /* De club tekent een klein vak erbij, zodat "vol" binnen bereik is. */
  const plan = (await w.post(CLUBPLAN, {}, C)).data || {};
  await w.post(CLUBKAART, { vakken: (plan.vakken || []).concat([{ id: VAK, naam: 'Proefvak ' + merk, capaciteit: 20, prijsCenten: 1500 }]) }, C);

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'het lid ziet een thuiswedstrijd in de verkoop en het vak dat de club net tekende', async () => {
    const b = await w.post(BORD, {}, A.token);
    const k = await w.post(KAART, { club: 'FCRTG' }, A.token);
    const t = ((b.data && b.data.wedstrijden) || []).find((x) => x.clubCode === 'FCRTG' && x.thuis && !x.uitslag);
    wedstrijd = t && t.wedstrijdId;
    const v = ((k.data && k.data.vakken) || []).find((x) => x.id === VAK);
    vak = v && v.id;
    return { klopt: b.status === 200 && !!wedstrijd && !!v && v.capaciteit === 20 && v.prijsCenten === 1500,
      ziet: 'bord ' + b.status + ', wedstrijd ' + wedstrijd + ', vak ' + (v && v.naam) };
  });

  await stap('voltooibaar', 'het lid reserveert drie tickets; het scherm zegt dat afrekenen aan de poort gebeurt, en Mijn tickets toont de code', async () => {
    const r = await koop(A.token, 3, 'voltooi-sport-een-' + merk);
    eerste = r.data && r.data.ticket;
    const l = (await mijn(A.token)).filter((t) => eerste && t.code === eerste.code);
    return { klopt: r.status === 200 && !!eerste && eerste.aantal === 3 && eerste.prijsCenten === 4500 && /aan de poort/.test(eerste.let) &&
      l.length === 1 && l[0].status === 'gereserveerd',
      ziet: 'reserveren ' + r.status + ', ' + (eerste && eerste.code) + ' voor ' + (eerste && eerste.prijsCenten) + ' cent, in Mijn tickets ' + l.length };
  });

  await stap('voltooibaar', 'een vol vak zegt hoeveel plaatsen er nog zijn, en reserveert niets', async () => {
    const r = await koop(A.token, 8, 'voltooi-sport-vol1-' + merk);
    const r2 = await koop(B.token, 8, 'voltooi-sport-vol2-' + merk);
    const vol = await koop(B.token, 8, 'voltooi-sport-vol3-' + merk);
    const nB = (await mijn(B.token)).length;
    return { klopt: r.status === 200 && r2.status === 200 && vol.status === 409 && /nog 1 plaats/.test((vol.data && vol.data.error) || '') && nB === 1,
      ziet: 'vullen ' + r.status + '/' + r2.status + ', te veel ' + vol.status + ' (' + (vol.data && vol.data.error) + '), B heeft ' + nB + ' ticket' };
  });

  await stap('voltooibaar', 'de club scant de code aan de poort een keer; een tweede scan weigert, en het lid ziet "gescand"', async () => {
    const s1 = await w.post(SCAN, { code: eerste.code }, C);
    const s2 = await w.post(SCAN, { code: eerste.code }, C);
    const l = (await mijn(A.token)).find((t) => t.code === eerste.code) || {};
    return { klopt: s1.status === 200 && s1.data.geldig === true && s1.data.ticket.aantal === 3 && s2.data.geldig === false && /Al gescand/.test(s2.data.reden) && l.status === 'gescand',
      ziet: 'scan 1 geldig=' + (s1.data && s1.data.geldig) + ', scan 2 ' + (s2.data && s2.data.reden) + ', lid ziet ' + l.status };
  });

  await stap('voltooibaar', 'het lid toont interesse in een sponsorpakket op codenaam; twee keer staat er niet twee keer', async () => {
    const lijst = ((await w.post(SPONSORS, { club: 'FCRTG' }, A.token)).data || {}).sponsors || [];
    if (!lijst.length) return { klopt: false, ziet: 'geen open sponsorpakket in de seed' };
    const a = await w.post(SPONSOR, { club: 'FCRTG', id: lijst[0].id }, A.token);
    const b = await w.post(SPONSOR, { club: 'FCRTG', id: lijst[0].id }, A.token);
    return { klopt: a.status === 200 && b.status === 409 && /al op de lijst/.test((b.data && b.data.error) || ''),
      ziet: 'interesse ' + a.status + ', nog eens ' + b.status + ' (' + (b.data && b.data.error) + ')' };
  });

  /* Bevoegdheid. */
  await stap('voltooibaar', 'bevoegd: zonder inlog geven het bord, reserveren en Mijn tickets 401', async () => {
    const a = await w.post(BORD, {}); const b = await w.post(KOOP, { wedstrijdId: wedstrijd, vak, aantal: 1 }); const c = await w.post(MIJN, {});
    return { klopt: a.status === 401 && b.status === 401 && c.status === 401, ziet: a.status + '/' + b.status + '/' + c.status };
  });
  await stap('voltooibaar', 'bevoegd: een ander lid ziet de toegangscode van het eerste lid niet, en een lid kan zelf niet scannen', async () => {
    const lB = await mijn(B.token);
    const zelf = await w.post(SCAN, { code: eerste.code }, A.token);
    return { klopt: !lB.some((t) => t.code === eerste.code) && [401, 403].includes(zelf.status),
      ziet: 'B ziet ' + lB.length + ' eigen ticket(s), geen van A; scannen door het lid ' + zelf.status };
  });
  await stap('voltooibaar', 'bevoegd: een gratis account zonder pas reserveert niet, en hoort waarom', async () => {
    const r = await koop(gast.token, 1, 'voltooi-sport-gast-' + merk);
    return { klopt: r.status === 403 && /voor leden/i.test((r.data && r.data.error) || '') && (await mijn(gast.token)).length === 0,
      ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  /* ---------------- persistent ---------------- */
  const voor = JSON.stringify(await mijn(A.token));
  await w.herstart();
  C = await clubLogin();
  await stap('persistent', 'na een nette herstart staan de tickets van het lid er nog, byte voor byte, met de scan', async () => {
    const na = JSON.stringify(await mijn(A.token));
    return { klopt: voor.length > 2 && na === voor, ziet: na === voor ? 'gelijk (' + na.length + ' tekens)' : 'ANDERS' };
  });
  await stap('persistent', 'een nieuwe sessie ziet dezelfde tickets, en de gescande code blijft gescand bij de poort', async () => {
    const T = await inloggen(w, A);
    const na = JSON.stringify(await mijn(T));
    const s = await w.post(SCAN, { code: eerste.code }, C);
    return { klopt: na === voor && s.data && s.data.geldig === false, ziet: 'nieuwe sessie gelijk: ' + (na === voor) + ', scan na herstart: ' + (s.data && s.data.reden) };
  });
  await stap('persistent', 'het ticket staat in de opslag zelf (gelezen buiten de server om)', async () => {
    const plek = w.vindInOpslag(eerste.code);
    return { klopt: plek.length >= 1, ziet: plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  const telB = async () => (await mijn(B.token)).length;
  await stap('herstelbaar', 'een dubbele tik op "Reserveer" (dezelfde sleutel, tegelijk) geeft een ticket, niet twee', async () => {
    const n0 = await telB();
    const [a, b] = await w.dubbel(KOOP, { club: 'FCRTG', wedstrijdId: wedstrijd, vak, aantal: 1, idem: 'voltooi-sport-dubbel-' + merk }, B.token);
    const n = await telB();
    return { klopt: a.status === 200 && b.status === 200 && a.data.ticket.code === b.data.ticket.code && n - n0 === 1,
      ziet: 'tikken ' + a.status + '/' + b.status + ', +' + (n - n0) + ' ticket' };
  });
  await stap('herstelbaar', 'een afgebroken reservering, daarna opnieuw met dezelfde sleutel: precies een ticket', async () => {
    const n0 = await telB();
    const lijf = { club: 'FCRTG', wedstrijdId: wedstrijd, vak: (await w.post(KAART, { club: 'FCRTG' }, B.token)).data.vakken[0].id, aantal: 1, idem: 'voltooi-sport-half-' + merk };
    const half = await w.afgebroken(KOOP, lijf, B.token);
    const opnieuw = await w.post(KOOP, lijf, B.token);
    const n = await telB();
    return { klopt: opnieuw.status === 200 && n - n0 === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', +' + (n - n0) + ' ticket' };
  });
  await stap('herstelbaar', 'een crash direct na de reservering, daarna dezelfde tik opnieuw: niet verloren en niet verdubbeld', async () => {
    const n0 = await telB();
    const lijf = { club: 'FCRTG', wedstrijdId: wedstrijd, vak: (await w.post(KAART, { club: 'FCRTG' }, B.token)).data.vakken[0].id, aantal: 2, idem: 'voltooi-sport-crash-' + merk };
    const r = await w.post(KOOP, lijf, B.token);
    await w.crash();
    const opnieuw = await w.post(KOOP, lijf, B.token);
    const n = await telB();
    return { klopt: r.status === 200 && opnieuw.status === 200 && opnieuw.data.ticket.code === r.data.ticket.code && n - n0 === 1,
      ziet: 'gereserveerd ' + r.status + ', na SIGKILL ' + opnieuw.status + (opnieuw.data && opnieuw.data.herhaald ? ' (herhaald)' : '') + ', +' + (n - n0) + ' ticket' };
  });
  await stap('herstelbaar', 'een crash direct na de scan: de code blijft gescand en kan niet nog eens naar binnen', async () => {
    C = await clubLogin();
    const t = (await mijn(B.token))[0];
    const s1 = await w.post(SCAN, { code: t.code }, C);
    await w.crash();
    C = await clubLogin();
    const s2 = await w.post(SCAN, { code: t.code }, C);
    const l = (await mijn(B.token)).find((x) => x.code === t.code) || {};
    return { klopt: s1.data && s1.data.geldig === true && s2.data && s2.data.geldig === false && l.status === 'gescand',
      ziet: 'scan ' + (s1.data && s1.data.geldig) + ', na SIGKILL ' + (s2.data && s2.data.reden) + ', lid ziet ' + l.status };
  });
}

module.exports = {
  functie: 'link:sport',
  ingang: '/apps/sport.html',
  persona: 'lid',
  /* De roosterinlog van de club bestaat alleen in de testomgeving (Magnaat Test). */
  omgeving: KANTOORWERELD,
  belofte: 'een lid reserveert tickets op een vak van de plattegrond die de club zelf tekent, ziet zijn toegangscode, en die code gaat bij de entree een keer naar binnen; een vol vak zegt hoeveel plaatsen er nog zijn, interesse in een sponsorpakket gaat op codenaam -- wie niet ingelogd is, een ander lid of een gratis account komt er niet aan, en een herstart, dubbele tik, afgebroken verzoek of crash reserveert nooit dubbel',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf. Er wordt niets betaald: afrekenen gebeurt aan de poort, buiten deze keten. De club is de seedclub FCRTG met haar roosterinlog, die alleen in de testomgeving bestaat; de scan is haar route (/api/sport/scan), niet die van het lid. Stand en momenten worden gelezen, niet beproefd. Geen Redis of PostgreSQL.',
  loop
};
