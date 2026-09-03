/* BELLEN NAAR RTG, BINNEN DE APP.

   Geen telefoonnet: geen provider, geen nummer, en geen telefoonnummer dat de
   identiteitskluis verlaat. De belstack tussen leden bestond al; wat ontbrak was
   een kant waar RTG de telefoon OPNEEMT.

   DE GRENS DIE HIER NIET MAG SNEUVELEN, en dat is de belangrijkste toets van dit
   bestand: bellen is een dienst van de Lifestyle- en Business Pass, maar EEN
   MENS IS DAT NIET. Elk lid met een account kan zelfstandig een mens vragen --
   dat is een ondergrens (kern/service/mens.js). Wat premium is, is de STEM. Wie
   die twee door elkaar haalt, verkoopt toegang tot hulp, en dat is iets anders
   dan een kanaal.

   Verder:
   - een gesprek hoort ALTIJD bij een zaak, anders is het een half uur werk waar
     niets van terugkomt;
   - twee keer op bellen drukken geeft geen twee rinkels in het kantoor;
   - een gemiste oproep laat de melder niet met lege handen achter;
   - een derde die een gespreksnummer raadt, komt er niet tussen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, kantoorAlsPersoon, elevateTier } = require('./helper');

const post = (base) => async (pad, body, tok) => {
  const r = await fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {})
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

async function opzet(pas) {
  const srv = await startServer({ env: { SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  const p = post(srv.base);
  const mail = 'bel' + pas + '@x.nl';
  const reg = await p('/api/auth/register', { name: 'Bel Lid', email: mail, phone: '06123457' + pas.length,
    password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
  let token = reg.body.token;
  if (pas !== 'rtg') {
    await elevateTier(srv.base, token, pas);
    const her = await p('/api/auth/login', { login: mail, password: 'geheim123', pasApp: pas });
    token = her.body.token || token;
  }
  return { srv, p, token, balie: await kantoorAlsPersoon(srv.base) };
}

test('een RTG-lid kan niet bellen, maar krijgt WEL een mens', async () => {
  const o = await opzet('rtg');
  try {
    const r = await o.p('/api/service/bel', {}, o.token);
    assert.equal(r.status, 403, JSON.stringify(r.body).slice(0, 200));
    assert.match(r.body.error, /Lifestyle|Business/, 'de weigering zegt niet waar bellen bij hoort');
    /* DE KERN VAN DEZE TOETS. De weigering wijst naar de weg die WEL openstaat;
       zonder die zin wordt "u mag niet bellen" gelezen als "u krijgt geen hulp". */
    assert.match(r.body.wel, /mens/i, 'de weigering noemt niet dat er wel een mens is');

    /* En die weg werkt ook echt -- de ondergrens is niet stilletjes premium
       geworden nu er een belknop naast staat. */
    const z = (await o.p('/api/service/open', { onderwerp: 'app', titel: 'Iets werkt niet' }, o.token)).body.zaak;
    const m = await o.p('/api/service/mens', { id: z.id }, o.token);
    assert.equal(m.body.ok, true, 'een RTG-lid kan geen mens meer vragen: ' + JSON.stringify(m.body).slice(0, 160));
    assert.equal(m.body.zaak.stand, 'wachtOpMens');
  } finally { await stop(o.srv); }
});

test('een Lifestyle-lid belt, en het gesprek krijgt een zaak', async () => {
  const o = await opzet('lifestyle');
  try {
    const r = await o.p('/api/service/bel', { titel: 'Vraag over mijn boeking' }, o.token);
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
    assert.equal(r.body.gesprek.status, 'rinkelt');
    assert.ok(r.body.zaak, 'er is geen zaak bij het gesprek gemaakt');
    /* Er wordt geen wachttijd beloofd -- die wordt niet gemeten. */
    assert.doesNotMatch(r.body.let, /minuut|minuten|wachttijd|nummer \d/i,
      'er wordt een wachttijd beloofd die niemand meet: ' + r.body.let);

    /* Het gesprek staat in de tijdlijn van de zaak. Anders is een half uur
       bellen werk waar later niets van terug te vinden is. */
    const d = await o.p('/api/service/zaak', { id: r.body.zaak }, o.token);
    assert.ok(d.body.zaak.tijdlijn.some(x => x.wat === 'gesprek' && x.naar === 'rinkelt'),
      'het gesprek staat niet in de tijdlijn');
  } finally { await stop(o.srv); }
});

test('twee keer bellen geeft geen twee rinkels', async () => {
  const o = await opzet('business');
  try {
    const a = await o.p('/api/service/bel', {}, o.token);
    const b = await o.p('/api/service/bel', {}, o.token);
    assert.equal(b.body.gesprek.id, a.body.gesprek.id, 'de tweede druk maakte een tweede oproep');
    const rij = await o.p('/api/office/service/gesprekken', {}, o.balie);
    assert.equal(rij.body.gesprekken.length, 1, 'er rinkelen twee oproepen in het kantoor');
    /* EN GEEN TWEEDE ZAAK. Hier stond alleen de regel hierboven, en die keek naar
       het GESPREK; de tweede druk maakte intussen netjes een lege tweede zaak
       aan voordat hij het bestaande gesprek teruggaf. Gevonden met de kale
       meetronde, niet met deze toets -- vandaar dat hij er nu ook op let. */
    const zaken = await o.p('/api/office/service/wachtrij', {}, o.balie);
    assert.equal(zaken.body.zaken.length, 1,
      'de tweede druk maakte een tweede zaak: ' + JSON.stringify(zaken.body.zaken.map(z => z.id)));
    assert.equal(b.body.zaak, a.body.zaak, 'de tweede druk wijst naar een andere zaak');
  } finally { await stop(o.srv); }
});

test('het kantoor neemt op, en de zaak beweegt mee', async () => {
  const o = await opzet('lifestyle');
  try {
    const g = (await o.p('/api/service/bel', {}, o.token)).body.gesprek;
    const n = await o.p('/api/office/service/gesprek/neem', { gesprek: g.id }, o.balie);
    assert.equal(n.status, 200, JSON.stringify(n.body).slice(0, 200));
    assert.equal(n.body.gesprek.status, 'bezig');
    assert.ok(n.body.gesprek.mens, 'er staat geen naam onder het gesprek');

    const rij = await o.p('/api/office/service/wachtrij', {}, o.balie);
    assert.equal(rij.body.zaken[0].stand, 'inBehandeling',
      'de zaak wacht nog op een mens terwijl er iemand aan de lijn zit');

    const e = await o.p('/api/office/service/gesprek/eind', { gesprek: g.id }, o.balie);
    assert.equal(e.body.gesprek.status, 'beeindigd');
    assert.equal(typeof e.body.gesprek.seconden, 'number', 'de duur is niet vastgelegd');
  } finally { await stop(o.srv); }
});

test('een derde die een gespreksnummer raadt komt er niet tussen', async () => {
  const o = await opzet('lifestyle');
  try {
    const g = (await o.p('/api/service/bel', {}, o.token)).body.gesprek;
    const indringer = await o.p('/api/auth/register', { name: 'Indringer', email: 'indringer@x.nl',
      phone: '0612345701', password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
    const r = await o.p('/api/service/bel/signaal',
      { gesprek: g.id, kind: 'offer', payload: { sdp: 'x' } }, indringer.body.token);
    assert.equal(r.status, 403, 'een vreemde kon in het gesprek signaleren');

    /* En het kantoor kan niet signaleren in een gesprek dat het niet aannam. */
    const kantoor = await o.p('/api/office/service/gesprek/signaal',
      { gesprek: g.id, kind: 'answer' }, o.balie);
    assert.equal(kantoor.status, 403, 'een medewerker signaleerde zonder te hebben opgenomen');
  } finally { await stop(o.srv); }
});

test('een gemiste oproep laat de beller niet met lege handen achter', async () => {
  const o = await opzet('lifestyle');
  try {
    const r = await o.p('/api/service/bel', {}, o.token);
    /* Ophangen terwijl er nog niemand had opgenomen. */
    await o.p('/api/service/bel/eind', { gesprek: r.body.gesprek.id }, o.token);

    const d = await o.p('/api/service/zaak', { id: r.body.zaak }, o.token);
    const gemist = d.body.zaak.tijdlijn.filter(x => x.wat === 'gesprek' && x.naar === 'gemist');
    assert.equal(gemist.length, 1, 'de gemiste oproep staat niet in de tijdlijn');
    /* EEN GEMIST GESPREK IS GEEN NUL SECONDEN. Wie hier 0 wegschrijft, telt
       gemiste oproepen mee in een gemiddelde gespreksduur -- en dat gemiddelde
       wordt dan beter naarmate er minder mensen worden geholpen. */
    assert.equal(gemist[0].seconden, null, 'een gemiste oproep kreeg een duur van nul');
    assert.match(JSON.stringify(d.body.zaak.tijdlijn), /niet opgenomen/,
      'de beller hoort niet dat wij niet opnamen en dat zijn melding blijft staan');
  } finally { await stop(o.srv); }
});
