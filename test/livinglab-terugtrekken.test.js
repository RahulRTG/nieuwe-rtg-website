/* TERUGTREKKEN -- wat er verdwijnt, wat er blijft, en wat dat met de conclusies
   doet.

   Wat deze toets vastlegt:

     1. Eerst kijken, dan pas wissen: `gevolg()` verandert niets.
     2. De vooruitblik telt wat er verdwijnt -- observaties EN metingen, met hun
        protocolversie.
     3. Een conclusie die op een observatie van deze deelnemer leunt, ZAKT in
        bewijsgraad, en dat staat vooraf in de vooruitblik. Dit is de bewijsladder
        van dit lab en geen verzonnen statistiek.
     4. Wat in een dataset is opgegaan, verdwijnt niet -- en dat wordt gezegd.
     5. Uitvoeren doet precies wat de vooruitblik aankondigde: de gegevens weg, de
        conclusies herijkt, en een regel DAT er is teruggetrokken zonder inhoud.
     6. Er wordt met opzet geen steekproef, effectgrootte of p-waarde herrekend.

   Draai los: node --test test/livinglab-terugtrekken.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-terug-'));
let srv, base, office, studieId, pas, alias, conclusieId;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  const labId = (await api('/api/lab2/lab/maak', { naam: 'Lab IJmuiden', stad: 'IJmuiden' }, office)).body.lab.id;
  studieId = (await api('/api/lab2/studie/maak', { labId, titel: 'Hittestress in woningen',
    soort: 'leefomgeving', vraagstuk: 'Welke woningen lopen risico bij hitte?', doel: 'inzicht' }, office)).body.studie.id;
  await api('/api/lab2/ethiek/klasse', { id: studieId, klasse: 'laag', door: 'Sam van RTG' }, office);
  await api('/api/lab2/ethiek/toestemming', { id: studieId, regime: 'mondeling',
    tekst: 'U doet mee aan een onderzoek naar hitte in woningen; u kunt altijd stoppen.', door: 'Sam van RTG' }, office);
  await api('/api/lab2/protocol/zet', { id: studieId,
    instrumenten: [{ sleutel: 'slaap', vraag: 'Hoe heeft u geslapen?', soort: 'schaal' }] }, office);

  const d = await api('/api/lab2/mens/bij', { id: studieId, rol: 'buurtonderzoeker', toestemming: true }, office);
  pas = d.body.deelnemer.pas; alias = d.body.deelnemer.alias;

  /* Twee observaties en twee metingen van deze deelnemer, en een conclusie die
     op een van die observaties leunt. */
  const o1 = await api('/api/lab2/mijn/observatie', { pas, wat: 'Het bleef binnen warm tot diep in de nacht.', methode: 'interview' });
  await api('/api/lab2/mijn/observatie', { pas, wat: 'De slaapkamer koelde overdag niet af.' });
  await api('/api/lab2/mijn/meting', { pas, antwoorden: { slaap: 2 } });
  await api('/api/lab2/mijn/meting', { pas, antwoorden: { slaap: 3 } });

  const c = await api('/api/lab2/bewijs/conclusie', { id: studieId,
    tekst: 'Woningen op het noorden koelen s nachts onvoldoende af.' }, office);
  conclusieId = c.body.conclusie.id;
  await api('/api/lab2/bewijs/koppel', { id: studieId, conclusieId, soort: 'observatie',
    ref: o1.body.observatie.id, notitie: 'de nachtwaarneming' }, office);
  /* En de conclusie op de graad zetten die dat ene bewijs kan dragen. Pas dan is
     er iets te ZAKKEN -- een conclusie die al op 'aanname' staat, zakt niet, en
     dan hoort de vooruitblik dat ook niet te beweren. */
  /* ZONDER `door`: 'waarneming' is de hoogste graad die bij een menselijk
     onderwerp zonder handtekening bereikbaar is (kern/livinglab/graden.js). Wie
     hier wel een naam meegeeft, moet tekenbevoegd zijn in dit lab -- en dat is
     een andere toets dan deze. */
  const gz = await api('/api/lab2/bewijs/graad', { id: studieId, conclusieId, graad: 'waarneming' }, office);
  assert.equal(gz.status, 200, JSON.stringify(gz.body));
});
test.after(() => stop(srv));

test('1. de vooruitblik telt wat er verdwijnt, en verandert niets', async () => {
  const g = await api('/api/lab2/mijn/terugtrekken/gevolg', { pas });
  assert.equal(g.status, 200, JSON.stringify(g.body));
  assert.equal(g.body.verdwijnt.observaties, 2);
  assert.equal(g.body.verdwijnt.metingen, 2);
  assert.deepEqual(g.body.verdwijnt.metingenPerVersie, { 1: 2 });
  assert.match(g.body.let, /nog niets weggehaald/);

  /* En er is werkelijk niets veranderd. */
  const na = await api('/api/lab2/metingen', { id: studieId }, office);
  assert.equal(na.body.totaal, 2);
});

test('2. een conclusie die op zijn observatie leunt, staat in de vooruitblik', async () => {
  const g = await api('/api/lab2/mijn/terugtrekken/gevolg', { pas });
  const c = g.body.conclusies.find(x => x.id === conclusieId);
  assert.ok(c, 'de conclusie die op zijn observatie leunt, wordt genoemd');
  assert.equal(c.dragersWeg, 1);
  assert.equal(c.graad, 'waarneming', 'hij staat nu op de graad die dat bewijs kan dragen');
  assert.equal(c.zakt, true, 'zonder dat bewijs kan hij die graad niet meer dragen');
  assert.equal(c.graadNa, 'aanname');
  assert.ok(c.reden, 'er staat bij WAAROM het plafond dan lager ligt');
});

test('3. wat in een dataset is opgegaan, verdwijnt niet -- en dat wordt gezegd', async () => {
  await api('/api/lab2/bewijs/dataset', { id: studieId, naam: 'Nachtmetingen augustus',
    beschrijving: 'De metingen van deze maand, samengevoegd.', rijen: 120, herkomst: 'labpassen' }, office);
  const g = await api('/api/lab2/mijn/terugtrekken/gevolg', { pas });
  assert.equal(g.body.blijft.datasets, 1);
  assert.match(g.body.blijft.datasetUitleg, /niet meer los uit te halen/);
  assert.match(g.body.blijft.spoor, /zonder inhoud/);
});

test('4. er wordt geen statistiek verzonnen', async () => {
  const g = await api('/api/lab2/mijn/terugtrekken/gevolg', { pas });
  assert.match(g.body.nietTeZeggen, /effectgrootte/);
  const tekst = JSON.stringify(g.body);
  for (const verzonnen of ['pWaarde', 'p_waarde', 'effect', 'betrouwbaarheidsinterval']) {
    assert.ok(!new RegExp('"' + verzonnen + '"').test(tekst), 'er staat een verzonnen statistisch getal in: ' + verzonnen);
  }
});

test('5. uitvoeren doet wat de vooruitblik aankondigde', async () => {
  const voor = await api('/api/lab2/mijn/terugtrekken/gevolg', { pas });
  const r = await api('/api/lab2/mijn/terugtrekken', { pas });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.gewist, voor.body.verdwijnt.observaties);
  assert.equal(r.body.metingen, voor.body.verdwijnt.metingen);

  /* De metingen zijn echt weg -- dat was de nieuwe kant, en die zat er tot nu
     toe niet in: terugtrekken wiste alleen observaties. */
  const m = await api('/api/lab2/metingen', { id: studieId }, office);
  assert.equal(m.body.totaal, 0);

  /* De conclusie staat er nog, maar niet meer op bewijs dat is ingetrokken. */
  const st = await api('/api/lab2/studie', { id: studieId }, office);
  const c = st.body.studie.dossier
    ? st.body.studie.dossier.conclusies.find(x => x.id === conclusieId)
    : (st.body.studie.conclusies || []).find(x => x.id === conclusieId);
  assert.ok(c, 'de conclusie is niet gewist: dat zou het onderzoek herschrijven');
  assert.equal((c.bewijs || []).length, 0, 'het ingetrokken bewijs hangt er niet meer onder');
  assert.equal(c.graad, 'aanname', 'de graad is herijkt: hij staat niet meer op bewijs dat er niet is');
  assert.deepEqual(r.body.gezakt.map(g => g.id), [conclusieId]);

  /* En de pas werkt niet meer: de deelnemer is eruit. */
  const nogmaals = await api('/api/lab2/mijn/terugtrekken/gevolg', { pas });
  assert.equal(nogmaals.status, 404);
});
