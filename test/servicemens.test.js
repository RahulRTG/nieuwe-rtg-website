/* "IK WIL EEN MENS" -- HET CONTRACT.

   DE FOUT DIE HIER WORDT VASTGEZET. kern/ai.js zette voor de RTG Pass hard
   `needsConcierge = false`. Dat was de merkregel, eerlijk uitgevoerd -- de RTG
   Pass krijgt De Rechterhand niet -- maar het gevolg was dat een RTG-lid via de
   chat NERGENS bij een mens uitkwam, terwijl de ledenbalie elk lid helpt. Er
   was een mens, en de melder was de enige die niet bij hem kon.

   DE NORM DIE DEZE TOETSEN HANDHAVEN:

     Iedere identiteit waarvoor menselijke hulp bestaat, moet die hulp
     zelfstandig kunnen aanvragen vanuit een kanaal dat zij al heeft.

   En de twee dingen die daarbij NIET mogen verschuiven:
   - de RTG Pass komt uit bij het team Leden en NOOIT bij de concierge-inbox;
     wie dat laat vervagen, geeft de Lifestyle-dienst weg;
   - vier keer om een mens vragen levert geen vierde afwerende dialoog op. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, kantoorAlsPersoon, elevateTier } = require('./helper');
const mens = require('../server/kern/service/mens');

const post = (base) => async (pad, body, tok) => {
  const r = await fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {})
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

/* ------------------------------------------------------------ de eenheid -- */

test('elke pas met menselijke hulp kan die zelf aanvragen', () => {
  for (const tier of ['guest', 'rtg', 'lifestyle', 'business']) {
    const o = mens.overname(tier);
    assert.equal(o.mens, true, tier + ': er is geen mens');
    assert.equal(o.rechtstreeks, true,
      tier + ': er is wel een mens, maar het lid kan hem niet zelf vragen -- dat is precies de fout die hersteld is');
    assert.ok(o.heet, tier + ': de melder hoort te horen naar WIE hij wordt doorgezet');
  }
});

test('de RTG Pass komt bij de balie uit en niet bij De Rechterhand', () => {
  assert.equal(mens.overname('rtg').team, 'leden');
  assert.notEqual(mens.overname('rtg').weg, 'concierge',
    'de RTG Pass werd naar de concierge gestuurd; dat is een gekochte dienst van Lifestyle');
  assert.equal(mens.overname('lifestyle').team, 'concierge');
  assert.equal(mens.overname('business').team, 'concierge');
});

test('zonder account is het antwoord nee, met de reden erbij', () => {
  const o = mens.overname('rtg', { ingelogd: false });
  assert.equal(o.rechtstreeks, false);
  assert.match(o.waarom, /account/i, 'een nee zonder reden laat de melder raden');
});

test('vier manieren om om een mens te vragen leveren dezelfde intentie op', () => {
  for (const zin of ['ik wil een mens', 'geef me een medewerker', 'kan ik iemand spreken',
    'ik wil een echte persoon', 'geen bot alsjeblieft', 'real person please']) {
    assert.equal(mens.vraagtOmMens(zin), true, 'niet herkend: ' + zin);
  }
  assert.equal(mens.vraagtOmMens('waar vind ik mijn factuur'), false);
});

test('vanaf de derde keer mag de AI niet meer afweren', () => {
  assert.equal(mens.afwerenMag(0), true);
  assert.equal(mens.afwerenMag(2), true);
  assert.equal(mens.afwerenMag(3), false, 'de vierde afwerende dialoog is nog steeds toegestaan');
});

/* ---------------------------------------------------------- de hele keten -- */

async function opzet(pas) {
  const srv = await startServer({ env: { SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  const p = post(srv.base);
  const reg = await p('/api/auth/register', { name: 'Mens Lid', email: 'menslid' + pas + '@x.nl',
    phone: '061234' + (1000 + pas.length), password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
  let token = reg.body.token;
  if (pas !== 'rtg') {
    await elevateTier(srv.base, token, pas);
    const her = await p('/api/auth/login', { login: 'menslid' + pas + '@x.nl', password: 'geheim123', pasApp: pas });
    token = her.body.token || token;
  }
  return { srv, p, token, balie: await kantoorAlsPersoon(srv.base) };
}

test('een RTG-lid dat in de chat om een mens vraagt, komt in de wachtrij', async () => {
  const o = await opzet('rtg');
  try {
    /* DE ECHTE WEG: de gewone chat, niet de service-route. Dit is de plek waar
       `needsConcierge = false` stond en waar het verzoek verdween. */
    const chat = await o.p('/api/chat/send', { text: 'Dit lukt me niet, ik wil een mens spreken.' }, o.token);
    assert.equal(chat.status, 200, JSON.stringify(chat.body).slice(0, 200));

    const rij = await o.p('/api/office/service/wachtrij', { mensGevraagd: true }, o.balie);
    assert.equal(rij.status, 200, JSON.stringify(rij.body).slice(0, 200));
    assert.equal(rij.body.zaken.length, 1,
      'het verzoek om een mens is nergens terechtgekomen: ' + JSON.stringify(rij.body.tel));
    assert.equal(rij.body.zaken[0].team, 'leden');
    assert.equal(rij.body.zaken[0].stand, 'wachtOpMens');

    /* En de concierge-inbox blijft leeg: die is en blijft van Lifestyle en
       Business, en dat is de merkregel die overeind moet blijven. */
    const inbox = await o.p('/api/office/conversations', {}, o.balie);
    const rtgErin = (inbox.body.conversations || []).filter(c => c.tier === 'rtg');
    assert.equal(rtgErin.length, 0, 'een RTG-lid belandde in de concierge-inbox');
  } finally { await stop(o.srv); }
});

test('drie keer vragen geeft drie regels in een tijdlijn en niet drie zaken', async () => {
  const o = await opzet('rtg');
  try {
    for (let i = 0; i < 3; i++) await o.p('/api/chat/send', { text: 'ik wil een medewerker spreken' }, o.token);
    const mijn = await o.p('/api/service/mijn', {}, o.token);
    assert.equal(mijn.body.zaken.length, 1,
      'elk verzoek maakte een nieuwe zaak; dan denkt elke medewerker dat een ander hem oppakt');
    const d = await o.p('/api/service/zaak', { id: mijn.body.zaken[0].id }, o.token);
    const vragen = d.body.zaak.tijdlijn.filter(r => r.wat === 'mensGevraagd');
    assert.equal(vragen.length, 3, 'niet elk verzoek staat in de tijdlijn: ' + vragen.length);
  } finally { await stop(o.srv); }
});

test('een Lifestyle-lid komt bij De Rechterhand uit en niet bij de balie', async () => {
  const o = await opzet('lifestyle');
  try {
    const z = (await o.p('/api/service/open', { onderwerp: 'reis', titel: 'Mijn vlucht is geannuleerd' }, o.token)).body.zaak;
    const r = await o.p('/api/service/mens', { id: z.id }, o.token);
    assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 200));
    assert.equal(r.body.zaak.team, 'concierge');
    assert.match(r.body.let, /Rechterhand/,
      'het lid hoort te horen naar wie hij wordt doorgezet');
  } finally { await stop(o.srv); }
});

test('de doorzetting belooft dat RTG ondertussen doorkijkt', async () => {
  const o = await opzet('rtg');
  try {
    const z = (await o.p('/api/service/open', { onderwerp: 'bestelling', titel: 'Mijn bestelling is niet gekomen' }, o.token)).body.zaak;
    const r = await o.p('/api/service/mens', { id: z.id }, o.token);
    /* Dit is geen stijlvraag. "Ik zet u door" alleen betekent voor de melder:
       opnieuw beginnen. De tweede helft van de zin is wat dat voorkomt. */
    assert.match(r.body.let, /ondertussen/i,
      'de doorzetting belooft niet dat er ondertussen wordt gekeken');
    assert.equal(r.body.afwerenMag, true);
  } finally { await stop(o.srv); }
});
