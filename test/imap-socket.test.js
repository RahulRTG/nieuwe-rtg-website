/* DE IMAP-SERVER STARTEN, ECHT.

   `test/imap.test.js` beproeft het GESPREK met twee arrays, en dat is de goede
   keuze: een toets met een verbinding erbij toetst het netwerk in plaats van het
   protocol. Maar daardoor kwam server/imap-server.js -- de laag die het gesprek
   over een socket voert -- nooit aan bod. En daar zat een fout:

     const srv = tlsOpties && tlsOpties.key ? ... : net.createServer(onConn);

   `tlsOpties`, `poort` en `host` werden gebruikt maar nergens uit `opties`
   gehaald. In strict mode is dat een ReferenceError op de eerste regel van
   start(), dus deze server is nooit gestart. De aanroeper
   (server/opzet/luister-poorten.js) vangt dat in een try/catch en schrijft
   "[imap] niet gestart: tlsOpties is not defined" naar het log -- een regel die
   niemand leest op een machine waar IMAP_POORT toch niet stond.

   Dat is dezelfde vorm als eerlijkheidspunt 6.12: wat een laag HOGER wordt
   opgehangen, valt buiten de toets die de laag zelf beproeft. Deze toets is de
   ontbrekende schakel, en hij is met opzet klein -- hij hoeft het protocol niet
   nog eens te doen, alleen te bewijzen dat er werkelijk een deur opengaat en
   dat er een gesprek door heen komt.

   Draai los: node --experimental-sqlite --test test/imap-socket.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const crypto = require('node:crypto');

const CRLF = '\r\n';

// hetzelfde postvak-in-het-klein als in imap.test.js, tot het bot afgeslankt
function opzet() {
  const db = { data: {} };
  const sleutels = require('../server/kern/mailsleutel')({ db, save: () => {}, crypto });
  const gemaakt = sleutels.maak('lid@rtgpass.rtg', 'Laptop');
  const rijen = [{ id: 'm1', van: 'rtg@rtmail', naar: 'lid@rtgpass.rtg', onderwerp: 'Welkom',
    tekst: 'de eerste', at: '2026-08-01T10:00:00.000Z', gelezen: true, vertrouwd: true, map: 'in', labels: [] }];
  const vak = {
    lijst: (adres, o) => rijen.filter(m => (m.map || 'in') === (o.map || 'in')),
    ster: () => ({ ok: true }), verplaats: () => ({ ok: true }), zoek: () => ({ ok: true, berichten: [] })
  };
  return { sleutels, gemaakt, vak, rtmail: { lees: () => null } };
}

/* Een piepklein clientje: stuur regels, verzamel alles wat er terugkomt, en
   wacht tot het merk waar we op zitten te wachten voorbijkomt. Geen bibliotheek;
   dit is precies genoeg om te weten dat de deur echt open staat. */
function client(poort) {
  const sok = net.createConnection({ port: poort, host: '127.0.0.1' });
  sok.setEncoding('utf8');
  let alles = '';
  sok.on('data', (d) => { alles += d; });
  return {
    sok,
    get alles() { return alles; },
    /* WACHTEN OP EEN GEBEURTENIS DIE AL VOORBIJ IS, WACHT EEUWIG. Daarom eerst
       de stand kijken en pas dan een luisteraar aanhangen -- en met een klok
       eromheen, want een toets die HANGT is erger dan een toets die zakt (zie
       eerlijkheidspunt 6.7 en 6.10: dat is hier al twee keer duur geweest). */
    klaar: () => new Promise((res, rej) => {
      if (sok.readyState === 'open') return res();
      const klok = setTimeout(() => rej(new Error('geen verbinding binnen 4 s')), 4000);
      sok.once('connect', () => { clearTimeout(klok); res(); });
      sok.once('error', (e) => { clearTimeout(klok); rej(e); });
    }),
    zeg: (regel) => sok.write(regel + CRLF),
    async wachtOp(re, ms = 4000) {
      const eind = Date.now() + ms;
      while (Date.now() < eind) {
        if (re.test(alles)) return true;
        await new Promise(r => setTimeout(r, 25));
      }
      throw new Error('niets dat op ' + re + ' lijkt binnen ' + ms + ' ms; ontvangen:\n' + alles);
    },
    sluit: () => new Promise(res => {
      if (sok.destroyed) return res();
      const klok = setTimeout(res, 2000);
      sok.once('close', () => { clearTimeout(klok); res(); });
      sok.end();
    })
  };
}

/* ALTIJD OPRUIMEN, OOK ALS EEN WACHT AFLOOPT.

   Deze twee toetsen zijn er eerst zonder deze wikkel geweest, en de
   mutatiemotor wees dat meteen aan: met `!==` -> `===` in mailsleutel.js
   mislukt de inlog, loopt `wachtOp` af, gooit de assertie -- en dan blijft de
   CLIENTSOCKET open staan. `srv.close()` sluit de luisteraar maar niet de
   verbindingen die er al zijn, dus node kan niet afsluiten en de toets HANGT in
   plaats van te zakken. De motor noteerde `te langzaam, lekt: true` en telde
   hem NIET als gezakt, en dat is de juiste uitslag: een toets die niets meldt
   is geen bewijs dat een assertie het zag.

   Dat is de derde keer dat dit hier gebeurt (eerlijkheidspunt 6.7 en 6.10), dus
   staat het opruimen nu niet in elke toets los maar op EEN plek. */
async function metServer(poortBasis, werk) {
  const { sleutels, gemaakt, vak, rtmail } = opzet();
  const poort = poortBasis + Math.floor(process.pid % 3000);
  const server = require('../server/imap-server')({ vak, rtmail, sleutels, poort, host: '127.0.0.1' });
  const srv = await server.start();
  const clients = [];
  const verbind = () => { const c = client(poort); clients.push(c); return c; };
  try {
    return await werk({ srv, server, poort, gemaakt, vak, verbind });
  } finally {
    for (const c of clients) { try { c.sok.destroy(); } catch (e) {} }
    await new Promise(res => srv.close(res));
  }
}

test('de IMAP-server gaat echt open, en er komt een gesprek door', async () => {
  /* HIER ZAT DE FOUT: server.start() gooide een ReferenceError, en daarmee is
     de hele IMAP-poort nooit een keer opengegaan -- op geen enkele machine. */
  await metServer(21000, async ({ srv, poort, gemaakt, verbind }) => {
    assert.equal(srv.address().port, poort, 'hij luistert op de poort die is opgegeven');

    const c = verbind();
    await c.klaar();
    await c.wachtOp(/\* OK RTG Mail IMAP klaar/, 4000);

    // en het gesprek erdoor: inloggen, een map openen, een bericht ophalen
    c.zeg('a1 LOGIN lid ' + gemaakt.sleutel);
    await c.wachtOp(/a1 OK ingelogd op lid@rtgpass\.rtg/);
    c.zeg('a2 SELECT INBOX');
    await c.wachtOp(/a2 OK \[READ-WRITE\]/);
    c.zeg('a3 FETCH 1 RFC822');
    await c.wachtOp(/a3 OK FETCH klaar/);
    assert.match(c.alles, /Subject: Welkom/, 'het hele bericht komt over de lijn');

    c.zeg('a4 LOGOUT');
    await c.wachtOp(/a4 OK LOGOUT klaar/);
    await c.sluit();
  });
});

test('een verbinding die wegvalt tijdens een IDLE laat geen lus achter', async () => {
  /* De derde plek waar een IDLE afgebroken hoort te worden, en de enige die je
     vergeet: de client is er gewoon niet meer. Bleef die timer staan, dan leest
     hij elke paar seconden een postvak in en schrijft naar een socket die niet
     bestaat -- per weggevallen client een, en niemand die het merkt tot het
     proces begint te knijpen. Dit is ook de enige plek waar dat te MEten valt:
     in imap.test.js is er geen verbinding om te laten wegvallen. */
  await metServer(24000, async ({ server, gemaakt, verbind }) => {
    const sessies = [];
    // de sessie onderscheppen zodat we na het wegvallen kunnen kijken of hij nog idlet
    const echte = server.gesprek.sessie;
    server.gesprek.sessie = (uit) => { const s = echte(uit); sessies.push(s); return s; };
    try {
    const c = verbind();
    await c.klaar();
    await c.wachtOp(/\* OK RTG Mail IMAP klaar/);
    c.zeg('b1 LOGIN lid ' + gemaakt.sleutel);
    await c.wachtOp(/b1 OK ingelogd/);
    c.zeg('b2 SELECT INBOX');
    await c.wachtOp(/b2 OK/);
    c.zeg('b3 IDLE');
    await c.wachtOp(/\+ idling/);

    assert.equal(sessies.length, 1, 'er is een sessie');
    assert.equal(sessies[0].idlet, true, 'en die staat idle');

    // en nu valt de client weg zonder DONE en zonder LOGOUT
    c.sok.destroy();
    const eind = Date.now() + 3000;
    while (sessies[0].idlet && Date.now() < eind) await new Promise(r => setTimeout(r, 25));
    assert.equal(sessies[0].idlet, false, 'de lus is opgeruimd toen de verbinding wegviel');
    } finally { server.gesprek.sessie = echte; }
  });
});
