/* HET PATROON, HET INCIDENT EN HET FOUTSIGNAAL.

   DE SCHAALWINST WAAR DEZE LAAG VOOR BESTAAT: twintig mensen melden dezelfde
   storing, een mens bevestigt dat het er een is, en vanaf dat moment is het EEN
   technische oplossing en twintig melders die vanzelf worden bijgewerkt.

   Wat deze toetsen vooral vastleggen is wat er NIET gebeurt:

   1. De machine bundelt niets uit zichzelf. Een vermoeden is een groep die iets
      DEELT, en wat zij delen is geen oorzaak.
   2. Een hersteld incident SLUIT GEEN ZAKEN. Dat een platformstoring weg is,
      bewijst niet dat de bestelling van dit ene lid alsnog is aangekomen.
   3. De persoonlijke stand zegt nooit "alles werkt". RTG meet beschikbaarheid
      niet per lid, en een groen vinkje zonder meting is precies wat BESTUUR.md
      verbiedt.
   4. Foutsignalen tellen GEBEURTENISSEN en geen mensen -- de foutingang staat
      zonder inlog open en kent dus geen identiteit om te tellen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const post = (base) => async (pad, body, tok) => {
  const r = await fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {})
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

async function opzet(aantalLeden) {
  const srv = await startServer({ env: { SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  const p = post(srv.base);
  const leden = [];
  for (let i = 0; i < (aantalLeden || 0); i++) {
    const r = await p('/api/auth/register', { name: 'Patroon Lid ' + i, email: 'patroon' + i + '@x.nl',
      phone: '06123400' + (10 + i), password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
    leden.push(r.body.token);
  }
  return { srv, p, leden, balie: await kantoorAlsPersoon(srv.base) };
}

/* Vier melders die op hetzelfde scherm over betalen vastlopen. */
async function vierMeldingen(o) {
  const zaken = [];
  for (const t of o.leden) {
    const r = await o.p('/api/service/open', { onderwerp: 'betaling', titel: 'Betalen lukt niet',
      betrokken: { soort: 'scherm', code: '/apps/geld.html' } }, t);
    zaken.push(r.body.zaak.id);
  }
  return zaken;
}

test('een vermoeden zegt waarop de groep is gevormd, en bundelt niets zelf', async () => {
  const o = await opzet(4);
  try {
    const zaken = await vierMeldingen(o);
    const r = await o.p('/api/office/service/patronen', {}, o.balie);
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
    assert.equal(r.body.vermoedens.length, 1, JSON.stringify(r.body.vermoedens).slice(0, 200));
    const v = r.body.vermoedens[0];
    assert.equal(v.aantal, 4);
    assert.match(v.gedeeld, /betaling/, 'het vermoeden zegt niet waarop hij is gevormd');
    assert.match(v.let, /geen oorzaak/i, 'het vermoeden presenteert zich als een conclusie');

    /* En er is NIETS gebeurd: geen koppeling, geen incident, geen bericht. */
    const d = await o.p('/api/office/service/zaak', { id: zaken[0] }, o.balie);
    assert.equal(d.body.zaak.koppelingen, 0, 'de machine koppelde uit zichzelf');
  } finally { await stop(o.srv); }
});

test('bundelen licht alle melders in een keer in, en herstellen ook', async () => {
  const o = await opzet(4);
  try {
    const zaken = await vierMeldingen(o);
    const voor = await o.p('/api/office/service/patronen', {}, o.balie);
    assert.equal(voor.body.vermoedens.length, 1,
      'de vier echte meldingen vormen vóór het bundelen één zichtbaar vermoeden');
    assert.equal(voor.body.vermoedens[0].aantal, 4);
    const b = await o.p('/api/office/service/bundel', { zaken, incident: 'RTG-0042' }, o.balie);
    assert.equal(b.body.gekoppeld, 4, JSON.stringify(b.body).slice(0, 200));

    /* Elke melder ziet het in zijn eigen zaak, zonder dat iemand vier keer iets
       heeft getypt. Dat is de hele winst. */
    for (let i = 0; i < 4; i++) {
      const d = await o.p('/api/service/zaak', { id: zaken[i] }, o.leden[i]);
      const tekst = JSON.stringify(d.body.zaak.tijdlijn);
      assert.match(tekst, /RTG-0042/, 'melder ' + i + ' hoorde niets over de storing');
    }

    /* En een gebundelde zaak stelt zichzelf niet opnieuw voor als vermoeden --
       anders blijft dezelfde storing zich voorstellen zolang hij loopt. */
    const na = await o.p('/api/office/service/patronen', {}, o.balie);
    assert.equal(na.body.vermoedens.length, 0, 'de gebundelde zaken vormden opnieuw een vermoeden');
    assert.deepEqual(na.body.incidenten, [{ incident: 'RTG-0042', zaken: 4, open: 4 }]);

    const h = await o.p('/api/office/service/incident/hersteld', { incident: 'RTG-0042' }, o.balie);
    assert.equal(h.body.bijgewerkt, 4, JSON.stringify(h.body).slice(0, 200));

    /* DE KERN VAN DEZE TOETS. Iedereen is ingelicht en NIEMAND is afgesloten. */
    for (let i = 0; i < 4; i++) {
      const d = await o.p('/api/service/zaak', { id: zaken[i] }, o.leden[i]);
      assert.notEqual(d.body.zaak.stand, 'opgelost',
        'een platformherstel sloot de zaak van melder ' + i + '; dat bewijst zijn probleem niet');
      assert.match(JSON.stringify(d.body.zaak.tijdlijn), /verholpen/, 'melder ' + i + ' hoorde het herstel niet');
    }
  } finally { await stop(o.srv); }
});

test('de persoonlijke stand belooft nooit dat alles werkt', async () => {
  const o = await opzet(1);
  try {
    const leeg = await o.p('/api/service/stand', {}, o.leden[0]);
    assert.equal(leeg.status, 200, JSON.stringify(leeg.body).slice(0, 200));
    assert.doesNotMatch(leeg.body.kop, /normaal|in orde|werkt/i,
      'de stand beweert iets over beschikbaarheid: "' + leeg.body.kop + '"');
    assert.match(leeg.body.let, /niet per lid/i,
      'de stand zegt niet dat "niets bekend" iets anders is dan "alles werkt"');
    assert.deepEqual(leeg.body.raakt, []);

    const z = (await o.p('/api/service/open', { onderwerp: 'betaling', titel: 'Betalen lukt niet' }, o.leden[0])).body.zaak;
    await o.p('/api/office/service/bundel', { zaken: [z.id], incident: 'RTG-0099' }, o.balie);
    const raakt = await o.p('/api/service/stand', {}, o.leden[0]);
    assert.equal(raakt.body.raakt.length, 1);
    assert.equal(raakt.body.raakt[0].wij, 'onbekend',
      'Service beweerde iets over de stand van een incident dat zij niet meet');

    await o.p('/api/office/service/incident/hersteld', { incident: 'RTG-0099' }, o.balie);
    const na = await o.p('/api/service/stand', {}, o.leden[0]);
    assert.equal(na.body.raakt[0].wij, 'gemeld-hersteld');
    assert.match(na.body.raakt[0].zin, /Wij hebben gemeld/,
      'het lid leest "hersteld" als een meting in plaats van als iets dat wij meldden');
  } finally { await stop(o.srv); }
});

test('foutsignalen groeperen op vorm en tellen geen mensen', async () => {
  const o = await opzet(1);
  try {
    /* Dezelfde fout met een ander id erin. Zonder het wegstrepen van getallen
       zijn dit drie signalen, en dan is de groepering alsnog een lange lijst. */
    for (let i = 0; i < 3; i++) {
      const r = await fetch(o.srv.base + '/api/fout/client', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soort: 'js', melding: 'kan ' + (1000 + i) + ' niet laden',
          bestand: 'app.js', regel: 12, pad: '/apps/geld.html' }) });
      assert.equal(r.status, 204);
    }
    const r = await o.p('/api/office/service/foutsignalen', {}, o.balie);
    assert.equal(r.body.signalen.length, 1, JSON.stringify(r.body.signalen).slice(0, 300));
    assert.equal(r.body.signalen[0].aantal, 3);
    assert.equal(r.body.tel.gebruikers, null, 'er staat een aantal geraakte gebruikers, en dat is niet te tellen');
    assert.ok(r.body.tel.gebruikersWaarom, 'een null zonder reden is een streepje met opsmuk');

    /* En een melding vanaf datzelfde scherm laat de medewerker meteen zien dat
       dit geen individueel probleem is. */
    const z = (await o.p('/api/service/open', { onderwerp: 'app', titel: 'Het scherm blijft leeg',
      betrokken: { soort: 'scherm', code: '/apps/geld.html' } }, o.leden[0])).body.zaak;
    const d = await o.p('/api/office/service/zaak', { id: z.id }, o.balie);
    assert.equal(d.body.foutsignalen.length, 1,
      'de medewerker ziet niet dat er op dit scherm iets kapot is');
  } finally { await stop(o.srv); }
});

test('een dubbelklik stuurt niemand een tweede bericht', async () => {
  const o = await opzet(4);
  try {
    const zaken = await vierMeldingen(o);
    await o.p('/api/office/service/bundel', { zaken, incident: 'RTG-0042' }, o.balie);
    const nog = await o.p('/api/office/service/bundel', { zaken, incident: 'RTG-0042' }, o.balie);
    assert.equal(nog.body.gekoppeld, 0, 'de tweede bundeling koppelde opnieuw');
    assert.equal(nog.body.alGekoppeld.length, 4);

    /* DIT IS WAAROM HET ERTOE DOET. Twee klikken zou hier twintig mensen twee
       keer dezelfde mededeling sturen, en het is bij vier al even fout. */
    const d = await o.p('/api/service/zaak', { id: zaken[0] }, o.leden[0]);
    const meldingen = d.body.zaak.tijdlijn.filter(r => r.wat === 'bericht' && /gekoppeld aan storing/.test(r.tekst || ''));
    assert.equal(meldingen.length, 1, 'de melder kreeg ' + meldingen.length + ' keer dezelfde mededeling');

    await o.p('/api/office/service/incident/hersteld', { incident: 'RTG-0042' }, o.balie);
    const twee = await o.p('/api/office/service/incident/hersteld', { incident: 'RTG-0042' }, o.balie);
    assert.equal(twee.body.bijgewerkt, 0, 'het herstel werd een tweede keer rondgestuurd');
    assert.ok(twee.body.alGemeld, 'er staat niet bij wanneer het al gemeld was');

    const na = await o.p('/api/service/zaak', { id: zaken[0] }, o.leden[0]);
    /* Op "IS verholpen" en niet op "verholpen": het bundelbericht zegt zelf al
       "u hoort van ons zodra hij verholpen is", en die meetelt maakt deze toets
       groen om de verkeerde reden. */
    const herstel = na.body.zaak.tijdlijn.filter(r => r.wat === 'bericht' && /is verholpen/.test(r.tekst || ''));
    assert.equal(herstel.length, 1,
      'de melder hoorde ' + herstel.length + ' keer dat het verholpen was; een tweede maakt de eerste ongeloofwaardig');
  } finally { await stop(o.srv); }
});

test('bundelen zonder incidentnummer weigert, want die reeks komt uit RTG Command', async () => {
  const o = await opzet(1);
  try {
    const z = (await o.p('/api/service/open', { onderwerp: 'app', titel: 'Iets werkt niet' }, o.leden[0])).body.zaak;
    const r = await o.p('/api/office/service/bundel', { zaken: [z.id] }, o.balie);
    assert.equal(r.status, 400);
    assert.match(r.body.error, /RTG Command/,
      'de weigering legt niet uit waar incidentnummers vandaan komen');
  } finally { await stop(o.srv); }
});
