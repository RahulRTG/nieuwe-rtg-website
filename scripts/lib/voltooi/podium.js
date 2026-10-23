/* ============================================================================
   VOLTOOIPROEF: RTG PODIUM (link:podium, /apps/podium.html) -- live.

   De belofte van het scherm: een lid meldt een kanaal aan, een mens van het
   kantoor keurt het goed, en daarna gaat de maker live. Een kijker vindt het
   kanaal in de zaal, kijkt mee, chat, stuurt een cadeau via RTG Pay, en meldt
   wat niet deugt; de maker blokkeert wie over de schreef gaat. Over de routes
   die podium.html zelf aanroept: /api/podium/kanalen, /mijn, /kanaal/aanmeld,
   /live, /kijk, /weg, /chat, /cadeau, /blokkeer en /meld.

   Het beeld zelf loopt van maker naar kijker over WebRTC en passeert deze
   server niet; dat is bewijs 2 (een browser met een camera). Deze proef meet
   wat de server wel draagt: wie live is, wie meekijkt, de chat, het geld en de
   veiligheid. De kijker laadt zijn wallet op over de simulatiebank, met een
   goedgekeurde identiteit en een gebonden toestel, zoals ./pay.js.
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const { nieuwLid, inloggen, geverifieerdLid, gebondenToestel, KANTOORWERELD } = require('../voltooiwereld');
const simulatiebank = require('../../../server/betaal/synthetisch');

const KANALEN = '/api/podium/kanalen';
const MIJN = '/api/podium/mijn';
const AANMELD = '/api/podium/kanaal/aanmeld';
const LIVE = '/api/podium/live';
const KIJK = '/api/podium/kijk';
const WEG = '/api/podium/weg';
const CHAT = '/api/podium/chat';
const CADEAU = '/api/podium/cadeau';
const BLOKKEER = '/api/podium/blokkeer';
const MELD = '/api/podium/meld';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;
const bank = simulatiebank({ crypto, env: {}, echteRail: null });
const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
/* Dezelfde afleiding als ./pay.js: een herhaalsleutel die "betaald" geeft. */
function betaaldeSleutel(codenaam, merk) {
  for (let i = 0; i < 10000; i++) {
    const idem = 'voltooi-podium-' + merk + '-' + i;
    const id = 'BW-' + sha('pay:' + codenaam + '|pay-oplaad:' + codenaam + ':' + idem).slice(0, 20).toUpperCase();
    if (bank.scenarioVan({ idempotentieSleutel: 'waarheid:' + id }) === 'betaald') return idem;
  }
  throw new Error('geen herhaalsleutel gevonden die "betaald" geeft');
}

async function loop(w, stap) {
  const merk = 'po' + Date.now().toString(36);
  const M = await nieuwLid(w, 'pom');
  const K = await geverifieerdLid(w, 'pok');
  const D = await nieuwLid(w, 'pod');
  let kanaal = null, saldo = null;
  const office = async () => ((await w.post('/api/office/login', { code: KANTOORWERELD.OFFICE_CODE })).data || {}).token;
  const chatVan = async (tok, id) => { const r = await w.post(KIJK, { id }, tok); return r.status === 200 ? r.data.chat || [] : null; };
  const mijnChat = async () => ((await w.post(MIJN, {}, M.token)).data || {}).chat || [];
  const telChat = (lijst, tekst) => (lijst || []).filter((r) => r.tekst === tekst).length;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een lid meldt een kanaal aan; tot het kantoor beslist kan het niet live', async () => {
    const a = await w.post(AANMELD, { naam: 'Avond ' + merk, zone: 'open', genre: 'muziek', bio: 'Muziek op zondag.' }, M.token);
    kanaal = a.data && a.data.kanaal;
    const l = await w.post(LIVE, { aan: true, titel: 'Te vroeg' }, M.token);
    return { klopt: a.status === 200 && !!kanaal && l.status === 403 && /goedkeuring/.test((l.data && l.data.error) || ''),
      ziet: 'aanmelden ' + a.status + ', live ' + l.status + ' -- ' + (l.data && l.data.error) };
  });

  await stap('voltooibaar', 'het kantoor keurt goed; de maker gaat live en een ander lid vindt hem in de zaal', async () => {
    const b = await w.post('/api/office/podium/beslis', { id: kanaal.id, besluit: 'goedgekeurd' }, await office());
    const l = await w.post(LIVE, { aan: true, titel: 'Zondagavond ' + merk }, M.token);
    const z = (await w.post(KANALEN, { zone: 'open' }, K.token)).data || {};
    const vind = JSON.stringify(z).includes('Avond ' + merk);
    return { klopt: b.status === 200 && l.status === 200 && vind, ziet: 'besluit ' + b.status + ', live ' + l.status + ', in de zaal van K: ' + vind };
  });

  await stap('voltooibaar', 'de kijker kijkt mee en chat; de maker leest het bericht in zijn studio', async () => {
    const k = await w.post(KIJK, { id: kanaal.id }, K.token);
    const c = await w.post(CHAT, { id: kanaal.id, tekst: 'Mooi nummer ' + merk }, K.token);
    const bijM = await mijnChat();
    return { klopt: k.status === 200 && c.status === 200 && telChat(bijM, 'Mooi nummer ' + merk) === 1,
      ziet: 'kijk ' + k.status + ', chat ' + c.status + ', bij de maker ' + telChat(bijM, 'Mooi nummer ' + merk) + ' bericht' };
  });

  await stap('voltooibaar', 'de kijker stuurt een roos via RTG Pay: zijn saldo daalt met precies de prijs, en de maker ziet het cadeau', async () => {
    const t = await gebondenToestel(w, K.token);
    const o = await w.post('/api/pay/overzicht', {}, K.token, await t.bewijs('POST', '/api/pay/overzicht'));
    const op = await w.post('/api/pay/oplaad', { centen: 2000, idem: betaaldeSleutel(o.data && o.data.codenaam, merk) }, K.token, await t.bewijs('POST', '/api/pay/oplaad'));
    const voor = ((await w.post('/api/pay/overzicht', {}, K.token, await t.bewijs('POST', '/api/pay/overzicht'))).data || {}).saldo;
    const g = await w.post(CADEAU, { id: kanaal.id, cadeau: 'roos', idem: 'podium-roos-' + merk }, K.token);
    const na = ((await w.post('/api/pay/overzicht', {}, K.token, await t.bewijs('POST', '/api/pay/overzicht'))).data || {}).saldo;
    saldo = na; K.toestel = t;
    const bijM = await mijnChat();
    return { klopt: op.status === 200 && g.status === 200 && voor - na === 500 && bijM.some((r) => r.cadeau && r.cadeau.id === 'roos'),
      ziet: 'opladen ' + op.status + ', cadeau ' + g.status + ' (' + ((g.data && g.data.error) || 'ok') + '), saldo ' + voor + ' -> ' + na };
  });

  await stap('voltooibaar', 'de kijker meldt het kanaal; de melding ligt bij het kantoor', async () => {
    const m = await w.post(MELD, { id: kanaal.id, reden: 'Proefmelding ' + merk }, K.token);
    const l = (await w.post('/api/office/podium', {}, await office())).data || {};
    return { klopt: m.status === 200 && JSON.stringify(l).includes('Proefmelding ' + merk), ziet: 'meld ' + m.status + ', bij kantoor: ' + JSON.stringify(l).includes('Proefmelding ' + merk) };
  });

  await stap('bevoegd', 'bevoegdheid: zonder sessie geen zaal, niet meekijken en niet chatten (401)', async () => {
    const a = await w.post(KANALEN, {});
    const b = await w.post(KIJK, { id: kanaal.id });
    const c = await w.post(CHAT, { id: kanaal.id, tekst: 'anoniem' });
    return { klopt: a.status === 401 && b.status === 401 && c.status === 401, ziet: 'zaal ' + a.status + ', kijk ' + b.status + ', chat ' + c.status };
  });

  await stap('bevoegd', 'bevoegdheid: een ander lid blokkeert niemand in het kanaal van de maker, en chat niet zonder mee te kijken', async () => {
    const b = await w.post(BLOKKEER, { id: kanaal.id, key: 'iemand' }, D.token);
    const c = await w.post(CHAT, { id: kanaal.id, tekst: 'Zonder kijken ' + merk }, D.token);
    return { klopt: b.status === 403 && c.status === 403 && telChat(await mijnChat(), 'Zonder kijken ' + merk) === 0,
      ziet: 'blokkeer ' + b.status + ' (' + (b.data && b.data.error) + '), chat ' + c.status + ' (' + (c.data && c.data.error) + ')' };
  });

  await stap('bevoegd', 'bevoegdheid: de maker blokkeert een kijker -- die kijkt en chat dan niet meer; een gratis account heeft geen Podium', async () => {
    await w.post(KIJK, { id: kanaal.id }, D.token);
    const dKey = ((await w.post('/api/member/connections', {}, D.token)).data || {}).me;
    const b = await w.post(BLOKKEER, { id: kanaal.id, key: dKey }, M.token);
    const k = await w.post(KIJK, { id: kanaal.id }, D.token);
    const c = await w.post(CHAT, { id: kanaal.id, tekst: 'Geblokkeerd ' + merk }, D.token);
    const g = await nieuwLid(w, 'pog', 'guest');
    const z = await w.post(KANALEN, {}, g.token);
    return { klopt: b.status === 200 && k.status === 403 && c.status === 403 && z.status === 403,
      ziet: 'blokkeer ' + b.status + ', kijk ' + k.status + ', chat ' + c.status + ', gast ' + z.status };
  });

  /* ---------------- persistent ---------------- */
  const vorm = (l) => JSON.stringify((l || []).map((r) => [r.codenaam, r.tekst || (r.cadeau && r.cadeau.id)]));
  const voor = vorm(await mijnChat());
  await w.herstart();

  await stap('persistent', 'na een nette herstart staan het goedgekeurde kanaal, de chat en het cadeau er nog', async () => {
    const m = (await w.post(MIJN, {}, M.token)).data || {};
    const na = vorm(m.chat);
    return { klopt: voor.length > 4 && na === voor && m.kanaal && m.kanaal.status === 'goedgekeurd',
      ziet: (na === voor ? 'chat gelijk' : 'ANDERS: ' + na.slice(0, 80)) + ', kanaal ' + (m.kanaal && m.kanaal.status) };
  });

  await stap('persistent', 'de kijker logt opnieuw in en ziet hetzelfde saldo na het cadeau', async () => {
    const tok = await inloggen(w, K);
    const t = await gebondenToestel(w, tok);
    const o = (await w.post('/api/pay/overzicht', {}, tok, await t.bewijs('POST', '/api/pay/overzicht'))).data || {};
    return { klopt: o.saldo === saldo, ziet: 'saldo ' + o.saldo + ' (verwacht ' + saldo + ')' };
  });

  await stap('persistent', 'de chat en de melding staan in de opslag zelf (gelezen buiten de server om)', async () => {
    const c = w.vindInOpslag('Mooi nummer ' + merk);
    const m = w.vindInOpslag('Proefmelding ' + merk);
    return { klopt: c.length >= 1 && m.length >= 1, ziet: 'chat in ' + c.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') + '; melding in ' + m.length + ' plek(ken)' };
  });

  /* ---------------- herstelbaar ---------------- */
  /* Na een herstart is de uitzending een nieuwe sessie: de maker gaat weer live
     en de kijker kijkt weer mee, zoals de schermen dat doen. */
  await w.post(LIVE, { aan: true, titel: 'Na de pauze ' + merk }, M.token);
  await w.post(KIJK, { id: kanaal.id }, K.token);

  await stap('herstelbaar', 'een dubbele tik op "verstuur" in de chat: een bericht, niet twee', async () => {
    const [a, b] = await w.dubbel(CHAT, { id: kanaal.id, tekst: 'Dubbel ' + merk, idem: 'podium-chat-dubbel-' + merk }, K.token);
    const n = telChat(await mijnChat(), 'Dubbel ' + merk);
    return { klopt: geen5xx(a) && geen5xx(b) && (a.status === 200 || b.status === 200) && n === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' bericht(en)' };
  });

  await stap('herstelbaar', 'een dubbele tik op een cadeau: een keer betaald, een cadeau in de chat', async () => {
    const t = K.toestel;
    const voorS = ((await w.post('/api/pay/overzicht', {}, K.token, await t.bewijs('POST', '/api/pay/overzicht'))).data || {}).saldo;
    const [a, b] = await w.dubbel(CADEAU, { id: kanaal.id, cadeau: 'roos', idem: 'podium-roos-dubbel-' + merk }, K.token);
    const naS = ((await w.post('/api/pay/overzicht', {}, K.token, await t.bewijs('POST', '/api/pay/overzicht'))).data || {}).saldo;
    return { klopt: geen5xx(a) && geen5xx(b) && (a.status === 200 || b.status === 200) && voorS - naS === 500,
      ziet: 'antwoorden ' + a.status + '/' + b.status + ', saldo ' + voorS + ' -> ' + naS };
  });

  await stap('herstelbaar', 'een afgebroken chatbericht, daarna opnieuw: een bericht', async () => {
    const lijf = { id: kanaal.id, tekst: 'Half ' + merk, idem: 'podium-chat-half-' + merk };
    const half = await w.afgebroken(CHAT, lijf, K.token);
    const opnieuw = await w.post(CHAT, lijf, K.token);
    const n = telChat(await mijnChat(), 'Half ' + merk);
    return { klopt: geen5xx(opnieuw) && n === 1, ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' bericht(en)' };
  });

  await stap('herstelbaar', 'een crash direct na een chatbericht, en het toestel probeert opnieuw: het staat er een keer', async () => {
    const lijf = { id: kanaal.id, tekst: 'Stroom ' + merk, idem: 'podium-chat-stroom-' + merk };
    const c = await w.post(CHAT, lijf, K.token);
    await w.crash();
    await w.post(LIVE, { aan: true, titel: 'Na de storing ' + merk }, M.token);
    await w.post(KIJK, { id: kanaal.id }, K.token);
    const opnieuw = await w.post(CHAT, lijf, K.token);
    const n = telChat(await mijnChat(), 'Stroom ' + merk);
    return { klopt: c.status === 200 && geen5xx(opnieuw) && n === 1, ziet: 'chat ' + c.status + ', na SIGKILL opnieuw ' + opnieuw.status + ', ' + n + ' bericht(en)' };
  });
}

module.exports = {
  functie: 'link:podium',
  ingang: '/apps/podium.html',
  persona: 'lid',
  omgeving: Object.assign({ RTG_SIMULATIEBANK: '1' }, KANTOORWERELD),
  belofte: 'een lid met een door het kantoor goedgekeurd kanaal gaat live; een kijker vindt het, kijkt mee, chat, stuurt een cadeau via RTG Pay en meldt, en de maker blokkeert wie over de schreef gaat -- zonder verlies of dubbeling bij een herstart, een dubbeltik of een crash',
  grens: 'De proef loopt de routes van het scherm, niet het scherm; het beeld zelf (WebRTC van maker naar kijker) is bewijs 2. Abonnementen, kaartjes, de kraam en de besloten zones worden niet gelopen. Opladen gaat over de simulatiebank. Het kanaal keurt de kantoorcode goed. Geen Redis of PostgreSQL.',
  loop
};
