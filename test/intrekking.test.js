/* EEN INGETROKKEN MACHTIGING WERKT NIET MEER BIJ HET EERSTVOLGENDE VERZOEK.

   Wet RTG-035. Rechten die pas bij de volgende sessie ingaan, zijn geen rechten
   maar een gewoonte: tussen het intrekken en het uitloggen zit dan een venster
   waarin iemand nog mag wat hij niet meer mag. Bij een machtiging is dat venster
   het gevaarlijkste dat er is -- je trekt hem juist in OMDAT er iets veranderd
   is (ruzie, ontslag, een gestolen toestel).

   WAT DEZE TOETS DOET, en het gaat om de VOLGORDE:

     1. lid A machtigt lid B voor een dienst
     2. B gebruikt de machtiging  -> lukt (anders bewijst stap 4 niets)
     3. A trekt de machtiging in
     4. B gebruikt hem opnieuw    -> hoort NU al te falen, zonder opnieuw
                                     inloggen, zonder wachten, zonder herstart

   Stap 2 is niet decoratief. Zonder die stap zou een toets waarin B het NOOIT
   mocht er precies hetzelfde uitzien als een toets waarin het intrekken werkt --
   en dan bewijst hij niets over intrekken. Dat is dezelfde val als een lege
   verzameling waar een bewering vanzelf waar op is.

   De handhaver staat in server/kern/rtgid.js: bevestig() weigert een machtiging
   die ingetrokken is met een 403. Zet die controle uit en stap 4 slaagt weer.

   Gemuteerd en zien zakken: de `m.ingetrokken`-controle uit bevestig() halen
   (toets 1 rood: B mag na het intrekken nog steeds).
   Draai los: node --experimental-sqlite --test test/intrekking.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-intrekking-'));

const api = (pad, body, token, machtigingId) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(machtigingId ? { koppelId: body, machtigingId } : (body || {}))
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function lid(tier) {
  const r = await fetch(base + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier })
  });
  const d = await r.json();
  const o = await api('pay/overzicht', {}, d.token);
  return { token: d.token, codenaam: o.body.codenaam };
}


/* EEN KOPPELING ONTSTAAT AAN DE DIENST-KANT, niet bij het lid. /api/rtgid/start
   is wat een externe dienst aanroept; die krijgt een code, en het lid zoekt die
   code op met /api/rtgid/koppel. Mijn eerste versie sloeg dat over en riep
   bevestig() aan met een koppelId dat niet bestond -- dat gaf een 404 'deze
   inlog wacht niet (meer)', dus de machtigingscontrole werd nooit BEREIKT. De
   toets zakte toen op de goede uitkomst om de verkeerde reden, en dat is precies
   het soort groen waar dit bestand tegen bedoeld is. */
async function koppelVoor(dienst, tok) {
  const start = await fetch(base + '/api/rtgid/start', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dienst, attributen: ['naam'] })
  }).then(r => r.json());
  const code = start.code || (start.koppel && start.koppel.code);
  assert.ok(code, 'de dienst krijgt een koppelcode: ' + JSON.stringify(start).slice(0, 160));
  const gevonden = await api('rtgid/koppel', { code }, tok);
  const id = gevonden.body.koppelId || (gevonden.body.koppel && gevonden.body.koppel.id);
  assert.ok(id, 'het lid vindt de koppeling: ' + JSON.stringify(gevonden.body).slice(0, 160));
  return id;
}

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }); base = srv.base; });
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('een ingetrokken machtiging faalt bij het eerstvolgende gebruik', async () => {
  const a = await lid('rtg');
  const b = await lid('lifestyle');
  assert.notEqual(a.codenaam, b.codenaam, 'vooraf: twee verschillende leden');

  const gemaakt = await api('rtgid/machtig', { codenaam: b.codenaam, dienst: 'zorg', dagen: 30 }, a.token);
  assert.equal(gemaakt.status, 200, 'A machtigt B: ' + JSON.stringify(gemaakt.body).slice(0, 200));
  const mId = gemaakt.body.machtiging && gemaakt.body.machtiging.id;
  assert.ok(mId, 'de machtiging heeft een id');

  /* Eerst BEWIJZEN dat B hem kan gebruiken. Zonder deze stap ziet een toets
     waarin B het nooit mocht er hetzelfde uit als een toets waarin intrekken
     werkt, en bewijst stap 4 niets. */
  const voor = await api('rtgid/bevestig', await koppelVoor('zorg', b.token), b.token, mId);
  assert.notEqual(voor.status, 403,
    'vooraf hoort B de machtiging te KUNNEN gebruiken; anders bewijst het intrekken hieronder niets (' +
    JSON.stringify(voor.body).slice(0, 160) + ')');

  const weg = await api('rtgid/machtig/intrek', { id: mId }, a.token);
  assert.equal(weg.status, 200, 'A trekt de machtiging in: ' + JSON.stringify(weg.body).slice(0, 160));

  /* GEEN nieuwe login, geen herstart, geen wachten: het eerstvolgende verzoek. */
  const na = await api('rtgid/bevestig', await koppelVoor('zorg', b.token), b.token, mId);
  assert.equal(na.status, 403,
    'na het intrekken hoort het EERSTVOLGENDE verzoek al te falen; een recht dat pas bij de ' +
    'volgende sessie vervalt, laat een venster open waarin iemand nog mag wat hij niet meer mag');
});

test('de ingetrokken machtiging verdwijnt ook uit het overzicht van beide leden', async () => {
  const a = await lid('rtg');
  const b = await lid('business');
  const gemaakt = await api('rtgid/machtig', { codenaam: b.codenaam, dienst: 'wonen', dagen: 30 }, a.token);
  const mId = gemaakt.body.machtiging && gemaakt.body.machtiging.id;
  assert.ok(mId, 'machtiging aangemaakt');

  await api('rtgid/machtig/intrek', { id: mId }, a.token);
  for (const [wie, tok] of [['A', a.token], ['B', b.token]]) {
    const lijst = await api('toestemming', {}, tok);
    const tekst = JSON.stringify(lijst.body);
    assert.equal(tekst.includes(mId), false,
      'de ingetrokken machtiging hoort bij ' + wie + ' niet meer in het toestemmingsoverzicht te staan; ' +
      'een scherm dat een vervallen recht blijft tonen, geeft zekerheid die er niet is');
  }
});
