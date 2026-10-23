/* ============================================================================
   VOLTOOIPROEF: SAMEN BETALEN / WIE BETAALT WAT (link:wbw, /apps/geld.html#wbw).

   De belofte, in de woorden van kern/wbw.js: het gedeelde lijstje van een
   groep Salon-vrienden -- wie betaalde wat, voor wie, en wie staat er hoe voor
   -- en verrekenen in een tik via RTG Pay. Geld beweegt alleen door een tik van
   wie rood staat; niemand kan bij andermans wallet. Routes letterlijk uit
   apps/geld/wbwb.js.

   TWEE LEDEN DIE ELKAAR KENNEN, langs de Salon (verbind), en een derde die
   erbuiten staat. Wie verrekent heeft geen tegoed: RTG Pay laadt eerst bij
   langs de simulatiebank, met een sleutel die de proef vooraf kiest zodat de
   bank betaalt (zelfde afleiding als ./pay.js, maar dan de autolaad-sleutel
   van pay.stuur onder kern/wbw.js).
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const { geverifieerdLid, nieuwLid, inloggen, verbind, gebondenToestel, KANTOORWERELD } = require('../voltooiwereld');
const simulatiebank = require('../../../server/betaal/synthetisch');

const MIJN = '/api/wbw/mijn';
const MAAK = '/api/wbw/maak';
const GROEP = '/api/wbw/groep';
const UITGAVE = '/api/wbw/uitgave';
const VERREKEN = '/api/wbw/verreken';

const bank = simulatiebank({ crypto, env: {}, echteRail: null });
const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
/* De autolaad-sleutel van een verrekening: pay.stuur krijgt
   `wbw:<groep>:<key betaler>:<key ontvanger>:<idem>` en laadt bij met
   `<die sleutel>:autolaad` (kern/pay/opladen.js, zorgSaldo). */
function sleutelVoor({ gid, van, aan, codenaam }, merk) {
  for (let i = 0; i < 10000; i++) {
    const idem = merk + '-' + i;
    const stuur = 'wbw:' + gid + ':' + van + ':' + aan + ':' + idem;
    const id = 'BW-' + sha('pay:' + codenaam + '|pay-oplaad:' + codenaam + ':' + stuur + ':autolaad').slice(0, 20).toUpperCase();
    if (bank.scenarioVan({ idempotentieSleutel: 'waarheid:' + id }) === 'betaald') return idem;
  }
  throw new Error('geen herhaalsleutel gevonden waarbij de simulatiebank het bijladen betaalt');
}

async function loop(w, stap) {
  const merk = 'wb' + Date.now().toString(36);
  const A = await geverifieerdLid(w, 'wbwa');
  const B = await geverifieerdLid(w, 'wbwb');
  const v = await verbind(w, A, B);
  /* Verrekenen verplaatst geld en draagt daarom het bezitsbewijs van een
     gebonden toestel (kern/identiteit/bezitspaden.js), zoals de browser het
     via shared/toestelsleutel.js meestuurt. */
  const toestelB = await gebondenToestel(w, B.token);
  const verreken = async (lijf, tok, t) => w.post(VERREKEN, lijf, tok || B.token, await (t || toestelB).bewijs('POST', VERREKEN));
  const groep = async (lid, gid) => w.post(GROEP, { id: gid }, lid.token);
  const saldi = async (gid) => {
    const g = ((await groep(A, gid)).data || {}).groep || { leden: [] };
    const s = (k) => (g.leden.find((l) => l.key === k) || {}).saldo;
    return { a: s(v.a.key), b: s(v.b.key), regels: g.regels || [] };
  };
  /* De verrekeningen in het grootboek op schijf: boekingen van soort wbw met de
     naam van het lijstje in de omschrijving. */
  const betalingen = (naam) => {
    const boek = w.collectie('payBoekingen');
    return (Array.isArray(boek) ? boek : Object.values(boek || {}))
      .filter((r) => r && r.soort === 'wbw' && r.oms === 'Wie betaalt wat · ' + naam);
  };
  const NAAM = 'Weekend ' + merk;
  let gid = null;
  const idem = (soort) => sleutelVoor({ gid, van: v.b.key, aan: v.a.key, codenaam: v.b.codenaam }, merk + '-' + soort);
  /* Een nieuwe uitgave van A voor beiden: B komt daarmee de helft rood te staan. */
  const etentje = (centen) => w.post(UITGAVE, { id: gid, oms: 'Etentje', centen, voor: [v.a.key, v.b.key] }, A.token);

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'A maakt een lijstje met vriend B; B ziet het in zijn eigen overzicht', async () => {
    const r = await w.post(MAAK, { naam: NAAM, leden: [v.b.key] }, A.token);
    gid = r.data && r.data.groep && r.data.groep.id;
    const m = (await w.post(MIJN, {}, B.token)).data || {};
    return { klopt: r.status === 200 && !!gid && (m.groepen || []).some((g) => g.id === gid && g.leden === 2),
      ziet: 'maken ' + r.status + ', B ziet ' + (m.groepen || []).length + ' lijstje(s)' };
  });

  await stap('voltooibaar', 'iemand die geen Salon-vriend is, kan A niet in een lijstje zetten met zichzelf erbij', async () => {
    const C = await nieuwLid(w, 'wbwc');
    const cc = (await w.post('/api/member/connections', {}, C.token)).data || {};
    const r = await w.post(MAAK, { naam: 'Vreemd ' + merk, leden: [cc.me] }, A.token);
    return { klopt: r.status === 403 && /Salon-vrienden/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  await stap('voltooibaar', 'A betaalde 90 euro voor beiden: A staat 45 euro voor, B 45 euro rood, tot op de cent', async () => {
    const r = await etentje(9000);
    const s = await saldi(gid);
    return { klopt: r.status === 200 && s.a === 4500 && s.b === -4500, ziet: 'uitgave ' + r.status + ', A ' + s.a + ', B ' + s.b };
  });

  await stap('voltooibaar', 'B verrekent in een tik: een betaling van 45 euro aan A via RTG Pay, en het lijstje staat op nul', async () => {
    const r = await verreken({ id: gid, idem: idem('eerste') });
    const s = await saldi(gid);
    const bet = betalingen(NAAM);
    return { klopt: r.status === 200 && s.a === 0 && s.b === 0 && bet.length === 1 && bet[0].centen === 4500,
      ziet: 'verrekenen ' + r.status + (r.data && r.data.error ? ' (' + r.data.error + ')' : '') + ', A ' + s.a + ', B ' + s.b + ', ' + bet.length + ' betaling(en)' };
  });

  await stap('voltooibaar', 'nog eens verrekenen kan niet: B hoort dat hij niet rood staat, en er gaat geen geld', async () => {
    const r = await verreken({ id: gid, idem: idem('nogeens') });
    return { klopt: r.status === 409 && /niet rood/.test(r.data.error) && betalingen(NAAM).length === 1,
      ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  await stap('bevoegd', 'een ANDER lid buiten het lijstje leest het niet, schrijft er niets in en verrekent er niets', async () => {
    const C = await geverifieerdLid(w, 'wbwd');
    const toestelC = await gebondenToestel(w, C.token);
    const lees = await groep(C, gid);
    const schrijf = await w.post(UITGAVE, { id: gid, oms: 'Indringer', centen: 100 }, C.token);
    const verr = await verreken({ id: gid, idem: merk + '-c' }, C.token, toestelC);
    const m = (await w.post(MIJN, {}, C.token)).data || {};
    const s = await saldi(gid);
    return { klopt: lees.status === 404 && schrijf.status === 404 && verr.status === 404 && (m.groepen || []).length === 0 &&
      s.regels.length === 2,
      ziet: 'lezen ' + lees.status + ', uitgave ' + schrijf.status + ', verrekenen ' + verr.status + ', ziet ' + (m.groepen || []).length + ' lijstjes; ' + s.regels.length + ' regels' };
  });

  await stap('voltooibaar', 'uitgelogd ziet niemand een lijstje en verrekent niemand: 401, met een zin', async () => {
    const m = await w.post(MIJN, {}, null);
    const g = await w.post(GROEP, { id: gid }, null);
    const v2 = await w.post(VERREKEN, { id: gid, idem: merk + '-uit' }, null);
    return { klopt: [m, g, v2].every((r) => r.status === 401 && r.data && r.data.error) && betalingen(NAAM).length === 1,
      ziet: 'mijn ' + m.status + ', groep ' + g.status + ', verrekenen ' + v2.status + ' (' + (m.data && m.data.error) + ')' };
  });

  await stap('voltooibaar', 'met het token van B maar zonder het bewijs van zijn toestel gaat er geen geld: een gestolen token is waardeloos', async () => {
    await etentje(1000);
    const r = await w.post(VERREKEN, { id: gid, idem: merk + '-gestolen' }, B.token);
    const s2 = await saldi(gid);
    return { klopt: r.status === 401 && s2.b === -500 && betalingen(NAAM).length === 1,
      ziet: r.status + ' (' + (r.data && r.data.error || '').slice(0, 70) + '), B ' + s2.b };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staan de uitgave, de verrekening en de nulbalans er nog', async () => {
    const s = await saldi(gid);
    return { klopt: s.a === 500 && s.b === -500 && s.regels.length === 3, ziet: s.regels.length + ' regels, A ' + s.a + ', B ' + s.b };
  });

  await stap('persistent', 'een read-only lezer vindt het lijstje met beide regels in de opslag, en de betaling in het grootboek', async () => {
    const g = (w.collectie('wbwGroepen') || []).find((x) => x.id === gid);
    return { klopt: !!g && g.regels.length === 3 && g.regels.some((r) => r.soort === 'verrekening' && r.centen === 4500) && betalingen(NAAM).length === 1,
      ziet: g ? g.regels.map((r) => r.soort + ' ' + r.centen).join(', ') : 'niet gevonden' };
  });

  await stap('persistent', 'na de herstart logt B opnieuw in en ziet in een nieuwe sessie hetzelfde lijstje', async () => {
    const tok = await inloggen(w, B);
    const r = await w.post(GROEP, { id: gid }, tok);
    const g = (r.data && r.data.groep) || {};
    return { klopt: r.status === 200 && g.mijnSaldo === -500 && (g.regels || []).length === 3, ziet: 'nieuwe sessie ' + r.status + ', mijn saldo ' + g.mijnSaldo };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op Verreken (dezelfde sleutel, tegelijk) betaalt een keer, en B staat daarna niet voor', async () => {
    await etentje(3000);
    const k = idem('dubbel');
    const [a, b] = await Promise.all([verreken({ id: gid, idem: k }), verreken({ id: gid, idem: k })]);
    const s = await saldi(gid);
    return { klopt: a.status === 200 && b.status === 200 && s.a === 0 && s.b === 0 && betalingen(NAAM).length === 2,
      ziet: 'tikken ' + a.status + '/' + b.status + ', A ' + s.a + ', B ' + s.b + ', ' + betalingen(NAAM).length + ' betalingen in totaal' };
  });

  await stap('herstelbaar', 'een afgebroken verrekening, daarna opnieuw met dezelfde sleutel: een keer betaald, nul in het lijstje', async () => {
    await etentje(2000);
    const k = idem('half');
    const half = await w.afgebroken(VERREKEN, { id: gid, idem: k }, B.token, await toestelB.bewijs('POST', VERREKEN));
    const opnieuw = await verreken({ id: gid, idem: k });
    const s = await saldi(gid);
    return { klopt: [200, 409].includes(opnieuw.status) && s.a === 0 && s.b === 0 && betalingen(NAAM).length === 3,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', A ' + s.a + ', B ' + s.b + ', ' + betalingen(NAAM).length + ' betalingen' };
  });

  await stap('herstelbaar', 'een crash direct na een verrekening, daarna dezelfde tik opnieuw: een keer betaald, nul in het lijstje', async () => {
    await etentje(4000);
    const k = idem('crash');
    const r = await verreken({ id: gid, idem: k });
    await w.crash();
    const opnieuw = await verreken({ id: gid, idem: k });
    const s = await saldi(gid);
    return { klopt: r.status === 200 && [200, 409].includes(opnieuw.status) && s.a === 0 && s.b === 0 && betalingen(NAAM).length === 4,
      ziet: 'verrekend ' + r.status + ', na SIGKILL ' + opnieuw.status + ', A ' + s.a + ', B ' + s.b + ', ' + betalingen(NAAM).length + ' betalingen' };
  });
}

module.exports = {
  functie: 'link:wbw',
  ingang: '/apps/geld.html#wbw',
  persona: 'lid',
  omgeving: Object.assign({ RTG_SIMULATIEBANK: '1' }, KANTOORWERELD),
  belofte: 'twee Salon-vrienden houden een gedeeld lijstje bij: wie betaalde wat en wie staat er hoe voor, tot op de cent; wie rood staat verrekent in een tik via RTG Pay -- wie buiten het lijstje staat leest of raakt niets, en een dubbele tik, een afgebroken verzoek of een crash betaalt nooit twee keer',
  grens: 'De rail onder het bijladen is de simulatiebank. De betaalverzoeken (Klompjes, /api/wbw/verzoek) en de vriendenkiezer zijn hier niet beproefd; de proef loopt de routes van de stand, niet de stand zelf, en kent geen Redis, PostgreSQL of geldmotor.',
  loop
};
