/* EEN NOODSIGNAAL DAT NIEMAND BEREIKT, MAG NOOIT ALS GELUKT GELDEN.

   WAT ER MISGING. alarmSlaan() weigert bij een lege kring: "er is niemand om te
   waarschuwen". De handmatige alarmknop stuurde die weigering netjes door naar
   het scherm. De twee paden waar het echt om gaat deden dat niet:

   - codewoordCheck() gooide de uitkomst helemaal weg. Dat moet stil zijn -- een
     melding op je toestel is precies wat een codewoord niet mag geven -- maar
     stil betekende hier: nergens. Je stelde je noodzin in, oefende hem (de proef
     zei "raak"), liet hem vallen toen het erop aankwam, en er ging niets af.
   - sweep() van de dodemansknop keek alleen naar `r && r.id` en zette de wacht
     toch op 'alarm'. In het overzicht stond dus "alarm geslagen" terwijl er
     niemand gebeld was.

   Iemand die alleen thuiskomt en dit aanzet, denkt dat er iemand meekijkt. Dat
   is de ergste soort stille storing: hij geeft een gerustheid die niet klopt, op
   het moment dat het het meest uitmaakt.

   DE REPARATIE ZIT VOORAAN. Bij het INSTELLEN is het nog te zeggen, en dat is
   het enige moment waarop iemand er iets aan kan doen. Gaat het daarna toch mis
   (de kring loopt leeg terwijl een wacht al draait), dan staat het in de stand
   en in het logboek in plaats van nergens. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

const post = (base) => async (pad, body, tok) => {
  const r = await fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {})
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

async function versLid(p, naam) {
  const reg = await p('/api/auth/register', { name: naam, email: naam.toLowerCase().replace(/\W/g, '') + '@x.nl',
    phone: '06' + String(Math.floor(10000000 + Math.random() * 89999999)),
    password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
  assert.ok(reg.body.token, 'registreren van ' + naam + ' lukte: ' + JSON.stringify(reg.body).slice(0, 140));
  return reg.body.token;
}

test('een codewoord instellen kan niet zolang je kring leeg is', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  const p = post(srv.base);
  try {
    const tok = await versLid(p, 'Stil Lid');
    const r = await p('/api/veiligheid/codewoord/zet', { zin: 'de blauwe kachel staat aan' }, tok);
    assert.notEqual(r.status, 200,
      'met een lege kring hoort een codewoord geweigerd te worden, niet stil te mislukken: ' + JSON.stringify(r.body).slice(0, 160));
    assert.match(String(r.body.error || ''), /kring/i, 'en de reden hoort over de kring te gaan: ' + JSON.stringify(r.body).slice(0, 160));
  } finally { stop(srv.child); }
});

test('een wacht starten kan niet zolang je kring leeg is', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  const p = post(srv.base);
  try {
    const tok = await versLid(p, 'Wacht Lid');
    const r = await p('/api/veiligheid/wacht/start', { soort: 'thuis', minuten: 30 }, tok);
    assert.notEqual(r.status, 200,
      'een wacht die niemand kan waarschuwen hoort geweigerd te worden: ' + JSON.stringify(r.body).slice(0, 160));
    assert.match(String(r.body.error || ''), /kring/i, 'met de reden erbij: ' + JSON.stringify(r.body).slice(0, 160));
  } finally { stop(srv.child); }
});

/* En de andere kant: met iemand in je kring hoort het gewoon te werken. Een slot
   dat altijd dichtzit is net zo fout als een slot dat altijd openstaat. */
test('met iemand in je kring werkt het codewoord wel gewoon', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  const p = post(srv.base);
  try {
    const tok = await versLid(p, 'Kring Lid');
    const mail = await p('/api/veiligheid/kring/mail', { adres: 'buurvrouw@x.nl' }, tok);
    assert.equal(mail.status, 200, 'een mailadres in de kring zetten: ' + JSON.stringify(mail.body).slice(0, 160));

    const r = await p('/api/veiligheid/codewoord/zet', { zin: 'de blauwe kachel staat aan' }, tok);
    assert.equal(r.status, 200, 'met een gevulde kring hoort het gewoon te lukken: ' + JSON.stringify(r.body).slice(0, 160));

    const stand = await p('/api/veiligheid/codewoord', {}, tok);
    assert.equal(stand.body.stand.ingesteld, true);
    assert.equal(stand.body.stand.kringLeeg, false, 'en de stand hoort te melden dat de kring niet leeg is');
  } finally { stop(srv.child); }
});
