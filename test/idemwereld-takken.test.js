/* DE IDEMWERELD, TAK VOOR TAK (scripts/lib/idemwereld.js).

   test/idemwereld.test.js bouwt de geldwereld en test/idemvoorziening.test.js
   de voorzieningen in de meetlus. Wat daar buiten bleef, is het grootste deel
   van de wereld: de school (via de postbus van de wegwerpserver), de
   instellingen met hun eigen rol, de vijf objectwerelden, en per voorziening
   het pad waarop het huis WEIGERT. Hier draait de opbouw tegen een nepserver
   die alles levert, tegen een die halverwege omvalt, en elke voorziening
   tegen een server die ja en een die nee zegt.

   De postbus is een tijdelijke map (PROEFMAP) met een outbox erin; er wordt
   niets in de repository gelezen of geschreven en er gaat niets het net op.

   Los: node --test test/idemwereld-takken.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const W = require('../scripts/lib/idemwereld');

/* Een nepserver die elk pad een vast antwoord geeft; een functie krijgt het
   lijf en het token. Onbekende paden geven `{ ok: true }`. */
function nep(antwoorden, journaal) {
  return async (pad, lijf, tok) => {
    if (journaal) journaal.push({ pad, lijf, tok });
    const a = antwoorden[pad];
    const r = typeof a === 'function' ? a(lijf, tok) : a;
    if (r && r.__status) return { status: r.__status, data: r.data };
    if (r instanceof Error) throw r;
    return { status: 200, data: r || { ok: true } };
  };
}

const RIJK = {
  '/api/bank/akkoord': (l, tok) => ({ rekening: { iban: tok === 'tweede' ? 'NL00TWEE' : 'NL00EEN' } }),
  '/api/pay/overzicht': (l, tok) => ({ codenaam: tok === 'tweede' ? 'Gouden Ibis' : 'Amberen Vos' }),
  '/api/bank/rekening/open': { rekening: { iban: 'NL00SPAAR' } },
  '/api/bank/pas/uitgeven': { pas: { id: 'PAS1' } },
  '/api/bank/terugkerend/zet': (l) => (l.interval === 'week' ? {} : { terugkerend: { id: 'TK1' } }),
  /* De tweede vorm van het antwoord: een enkel `verzoek` in plaats van een lijst. */
  '/api/pay/verzoek': (l, tok) => ({ verzoek: { id: tok === 'tweede' ? 'VZAANMIJ' : 'VZVANMIJ' } }),
  /* En de geneste vorm van de kascode. */
  '/api/pay/kascode': { kascode: { code: 'KAS42' } },
  '/api/state': { state: { invoices: [null, { id: 'F1', status: 'paid' }] } },
  '/api/labfonds/locatie/maak': { locatie: { id: 'LOC1' } },
  '/api/foundation/gezin/maak': { code: 'GZ1', token: 'GZTOK' },
  '/api/bedrijf/werkruimte/maak': { werkruimte: 'WR1', beheerToken: 'BEHEER' },
  '/api/bedrijf/lid/aanmeld': { lidId: 'L1', lidToken: 'LIDTOK' },
  '/api/foundation/registratie/aanvragen': { id: 'REG1', aanvraag: { controles: [{ id: 'kvk' }, { id: 'brin' }] } },
  '/api/foundation/school/school/activeren': (l) => ({ schoolCode: 'SCH-' + l.activatie, beheerToken: 'SCHBEHEER' }),
  '/api/foundation/school/personeel/uitnodiging/accepteer': (l) => ({ personeelToken: 'PERS-' + l.uitnodiging }),
  '/api/foundation/school/leraar/klas/maak': { code: 'KLAS1' },
  '/api/foundation/school/leerling/aanmeld': { leerling: { id: 'LL1' } },
  '/api/kantoorpakket/maak': { document: { id: 'KP' } },
  '/api/office/kantoorpakket/maak': { id: 'KPO' },
  '/api/supplier/kantoorpakket/maak': { doc: { id: 'KPS' } },
  '/api/werkplek/kantoorpakket/maak': { document: { id: 'KPW' } },
  '/api/office/instelling/aansluiten': (l) => ({ code: 'C-' + l.genre, pin: '0000' }),
  '/api/supplier/roster': (l) => (l.code === 'C-luchthaven' ? { staff: [] } : { staff: [{ id: 'S-' + l.code }] }),
  '/api/supplier/login': (l) => ({ token: 'TOK-' + l.code }),
  '/api/festival/nieuw': { festival: { id: 'FES1' } },
  '/api/concern/nieuw': { concern: { id: 'CON1' } },
  '/api/concern/entiteit/nieuw': { entiteit: { id: 'ENT1' } },
  '/api/onderneming/nieuw': { onderneming: { id: 'OND1' } },
  '/api/lab2/labs': { lijst: [{ id: 'LAB1' }] },
  '/api/lab2/studie/maak': { studie: { id: 'STU1' } },
  '/api/rtfos/stad/maak': { stad: { id: 'STAD1' } }
};

function postbus(berichten) {
  const PROEFMAP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-idemwereld-tak-'));
  fs.mkdirSync(path.join(PROEFMAP, 'outbox'));
  for (const [naam, tekst] of Object.entries(berichten)) fs.writeFileSync(path.join(PROEFMAP, 'outbox', naam), tekst);
  return PROEFMAP;
}

test('een volledige wereld: school uit de postbus, instellingen met hun rol, en de objectwerelden', async () => {
  const PROEFMAP = postbus({
    '001.txt': 'Welkom zonder merk erin.',
    '002.txt': 'Activeer via https://x/?activeren=ACT%2042"> en nog meer',
    '003.txt': 'Uitnodiging: uitnodiging=UIT7 <br>'
  });
  try {
    const journaal = [];
    const tokens = { member: 'lid', office: 'kantoor', boardroom: 'baas', supplier: 'zaak' };
    const { wereld: w, perVoorvoegsel, gemist } = await W.zetWereldKlaar({ post: nep(RIJK, journaal),
      tokens, datamap: PROEFMAP, geldlid: 'geldlid', tweedeLid: 'tweede' });
    assert.equal(w.anderToken, 'tweede', 'het opgegeven tweede lid vervangt de demo-inlog');
    assert.equal(journaal.some(x => x.pad === '/api/login'), false);
    assert.equal(journaal.find(x => x.pad === '/api/bank/storten').tok, 'geldlid');
    assert.equal(w.code, 'KAS42');
    assert.equal(w.verzoekAanMij, 'VZAANMIJ');
    assert.equal(w.verzoekVanMij, 'VZVANMIJ');
    assert.equal(w.factuurId, null, 'geen openstaande factuur, dan ook geen factuur-id');
    assert.equal(w.incassoTot, undefined, 'zonder wekelijkse reeks ook geen incassogrens');
    assert.equal(w.schoolCode, 'SCH-ACT 42', 'de activatiecode komt gedecodeerd uit de postbus');
    assert.equal(w.personeelToken, 'PERS-UIT7');
    assert.equal(w.klasCode, 'KLAS1');
    assert.equal(w.leerlingId, 'LL1');
    assert.deepEqual([w.kp, w.kpOffice, w.kpSupplier, w.kpWerkplek], ['KP', 'KPO', 'KPS', 'KPW']);
    assert.equal(w.rijkToken, 'TOK-C-rijk');
    assert.equal(tokens.rijk, 'TOK-C-rijk', 'de rol wordt aan de tokens toegevoegd');
    assert.equal(tokens.ov, 'TOK-C-ov');
    assert.equal(tokens.gemeente, 'TOK-C-gemeente');
    assert.equal(w.luchthavenToken, undefined);
    assert.deepEqual([w.festival, w.concern, w.entiteit, w.onderneming, w.studie, w.stad],
      ['FES1', 'CON1', 'ENT1', 'OND1', 'STU1', 'STAD1']);
    /* De controles van de registratie worden elk afgevinkt, en daarna het besluit. */
    const controles = journaal.filter(x => x.pad === '/api/office/foundation/registratie/controle');
    assert.deepEqual(controles.map(c => c.lijf.onderdeel), ['kvk', 'brin']);
    assert.ok(journaal.some(x => x.pad === '/api/bedrijf/lid/besluit' && x.lijf.lidId === 'L1'));
    /* Wat ontbreekt staat in `gemist`, met de laatste stap die het had moeten opleveren. */
    assert.deepEqual(gemist.map(g => g.wat), ['een luchthaven']);
    assert.equal(gemist[0].melding, 'het rooster gaf geen personeelslid terug');
    assert.equal(gemist[0].status, 200);
    /* De voorvoegsels: kantoorpakketten vooraan, en elk object onder zijn eigen adres. */
    const vv = perVoorvoegsel.map(v => v.voorvoegsel);
    assert.deepEqual(vv.slice(0, 4), ['/api/werkplek/kantoorpakket/', '/api/supplier/kantoorpakket/',
      '/api/office/kantoorpakket/', '/api/kantoorpakket/']);
    assert.equal(perVoorvoegsel[0].rol, 'boardroom');
    const per = Object.fromEntries(perVoorvoegsel.map(v => [v.voorvoegsel, v]));
    assert.deepEqual(per['/api/foundation/school/'].lijf, { code: 'GZ1', token: 'GZTOK', schoolCode: 'SCH-ACT 42',
      beheerToken: 'SCHBEHEER', personeelToken: 'PERS-UIT7', klasCode: 'KLAS1', leerlingId: 'LL1' });
    assert.deepEqual(per['/api/bedrijf/'].lijf, { werkruimte: 'WR1', beheerToken: 'BEHEER', lidToken: 'LIDTOK' });
    assert.equal(per['/api/overheid/'].alleenRol, 'supplier');
    assert.ok(per['/api/staff/ov/'] && per['/api/supplier/ov/']);
    assert.equal(per['/api/gemeente/'].rol, 'gemeente');
    assert.equal(per['/api/lucht/'], undefined);
    assert.deepEqual(per['/api/concern/'].lijf, { entiteit: 'ENT1', concern: 'CON1', onderneming: 'OND1' });
    assert.deepEqual(per['/api/onderneming/'].lijf, { id: 'OND1' });
    assert.equal(per['/api/lab2/'].alleenRol, 'office');
    assert.equal(per['/api/rtfos/'].alleenRol, 'boardroom');
    assert.deepEqual(per['/api/festival/'].lijf, { festival: 'FES1' });
  } finally { fs.rmSync(PROEFMAP, { recursive: true, force: true }); }
});

test('een server die omvalt of halve antwoorden geeft, levert een eerlijke lijst van wat ontbreekt', async () => {
  const PROEFMAP = postbus({ 'a.txt': 'activeren=%E0%A4%A rest' });
  try {
    const antwoorden = {
      ...RIJK,
      '/api/login': { token: 'demo2' },
      '/api/bank/akkoord': new Error('verbinding weg'),
      '/api/foundation/school/school/activeren': (l) => ({ schoolCode: 'S-' + l.activatie }),
      '/api/bedrijf/lid/aanmeld': { lidToken: 'LT' },
      '/api/foundation/registratie/aanvragen': { id: 'REG2' },
      '/api/office/instelling/aansluiten': (l) => (l.genre === 'gemeente' ? { code: 'C' } : { code: 'C-' + l.genre, pin: '1' }),
      '/api/supplier/roster': { staff: null },
      '/api/lab2/labs': { labs: [{}] },
      '/api/kantoorpakket/maak': { __status: 403, data: { error: 'geen toegang' } }
    };
    const { wereld: w, gemist, perVoorvoegsel } = await W.zetWereldKlaar({ post: nep(antwoorden),
      tokens: { member: 'lid', office: 'kantoor', boardroom: 'baas' }, datamap: PROEFMAP });
    assert.equal(w.anderToken, 'demo2');
    assert.equal(w.iban, null);
    assert.equal(w.pasId, undefined, 'zonder rekening geen pas');
    assert.equal(w.schoolCode, 'S-%E0%A4%A', 'een onleesbare codering komt rauw mee');
    assert.equal(w.schoolBeheerToken, null);
    assert.equal(w.studie, undefined, 'een lab zonder id levert geen studie');
    assert.equal(w.rijkToken, undefined);
    const per = Object.fromEntries(gemist.map(g => [g.wat, g]));
    assert.equal(per['een bankrekening'].status, 0, 'een gegooide fout telt als status 0');
    assert.equal(per['een bankrekening'].melding, 'verbinding weg');
    assert.equal(per['een document van het lid'].status, 403);
    assert.equal(per['een document van het lid'].melding, 'geen toegang');
    assert.equal(per['een school'], undefined, 'de school kwam wel, zonder beheertoken');
    assert.match(per['een leraar'].melding, /nooit aangeroepen/);
    assert.equal(per['een luchthaven'].melding, 'het rooster gaf geen personeelslid terug');
    assert.deepEqual(gemist.map(g => g.wat), ['een bankrekening', 'een leraar', 'een klas', 'een leerling in die klas',
      'een document van het lid', 'een Rijksoverheid-zaak', 'een OV-zaak', 'een gemeente', 'een luchthaven', 'een onderzoek']);
    const vv = perVoorvoegsel.map(v => v.voorvoegsel);
    assert.ok(vv.includes('/api/foundation/school/'));
    assert.equal(perVoorvoegsel.find(v => v.voorvoegsel === '/api/foundation/school/').lijf.beheerToken, undefined);
  } finally { fs.rmSync(PROEFMAP, { recursive: true, force: true }); }
});

test('zonder werkruimte, zonder boardroom en zonder postbus blijft de wereld klein', async () => {
  const { wereld: w, perVoorvoegsel } = await W.zetWereldKlaar({
    post: nep({ '/api/bedrijf/werkruimte/maak': { werkruimte: 'WR2' }, '/api/login': {} }),
    tokens: { member: 'lid', office: 'kantoor' } });
  assert.equal(w.werkruimte, 'WR2');
  assert.equal(w.beheerToken, null);
  assert.equal(w.anderToken, undefined, 'een inlog zonder token levert geen tweede lid');
  assert.deepEqual(perVoorvoegsel.map(v => v.voorvoegsel), ['/api/bedrijf/', '/api/werkplek/']);
  assert.deepEqual(perVoorvoegsel[0].lijf, { werkruimte: 'WR2', beheerToken: undefined, lidToken: undefined });
});

test('gedeeldLijf en voorvoegselLijf op een lege wereld: alleen de vaste werkplek', () => {
  assert.deepEqual(W.gedeeldLijf({}), {});
  assert.deepEqual(W.gedeeldLijf({ code: 'K' }), { code: 'K' });
  assert.deepEqual(W.voorvoegselLijf({}), [{ voorvoegsel: '/api/werkplek/', lijf: { bedrijf: 'rtg' }, rol: 'boardroom' }]);
  assert.equal(W.voorvoegselLijf({ gezinCode: 'G' }).length, 1, 'een gezinscode zonder token is geen gezin');
  assert.equal(W.voorvoegselLijf({ luchthavenToken: 'L' }).some(v => v.voorvoegsel === '/api/lucht/'), true);
});

test('geldLijf neemt de incassogrens en de labfondslocatie alleen op als de wereld ze heeft', () => {
  const met = W.geldLijf({ incassoTot: 5, labLocId: 'LOC' });
  assert.deepEqual(met['/api/office/bank/incasso'], { tot: 5 });
  assert.deepEqual(met['/api/labfonds/doneer'], { locId: 'LOC', bedrag: 5 });
  const zonder = W.geldLijf({});
  assert.equal(zonder['/api/office/bank/incasso'], undefined);
  assert.equal(zonder['/api/labfonds/doneer'], undefined);
});

/* --- de voorzieningen --------------------------------------------------- */

const tokenVoor = (rol) => 'tok-' + rol;
const V = (pad) => W.voorzieningVoor(pad);
const ja = (data) => async () => ({ status: 200, data });
const nee = (status, error) => async () => ({ status, data: error === undefined ? undefined : { error } });

test('voorzieningVoor geeft null voor een pad zonder voorziening', () => {
  assert.equal(W.voorzieningVoor('/api/bestaat/niet'), null);
  assert.equal(typeof V('/api/bank/salaris'), 'function');
});

test('bankvoorzieningen: zonder rekening een fout, met een weigering de status, met succes het id', async () => {
  for (const pad of ['/api/bank/pas/sluit', '/api/bank/salaris', '/api/bank/pas/betaal']) {
    assert.match((await V(pad)({ post: ja({}), tokenVoor, w: {} })).fout, /geen rekening in de wereld/, pad);
  }
  const w = { iban: 'NL00' };
  assert.deepEqual(await V('/api/bank/pas/sluit')({ post: ja({ pas: { id: 'P9' } }), tokenVoor, w }), { id: 'P9' });
  assert.deepEqual(await V('/api/bank/pas/sluit')({ post: nee(500), tokenVoor, w }), { fout: 'pas/uitgeven gaf 500' });
  assert.deepEqual(await V('/api/bank/pas/sluit')({ post: async () => null, tokenVoor, w }), { fout: 'pas/uitgeven gaf null' });
  assert.deepEqual(await V('/api/bank/salaris')({ post: ja({}), tokenVoor, w }), {});
  assert.deepEqual(await V('/api/bank/salaris')({ post: nee(402, 'Onvoldoende saldo'), tokenVoor, w }),
    { fout: 'bank/storten gaf 402 Onvoldoende saldo' });
  assert.deepEqual(await V('/api/bank/salaris')({ post: nee(503), tokenVoor, w }), { fout: 'bank/storten gaf 503 ' });
  assert.deepEqual(await V('/api/bank/pas/betaal')({ post: ja({ pas: { id: 'P2' } }), tokenVoor, w }), { id: 'P2' });
  assert.deepEqual(await V('/api/bank/pas/betaal')({ post: ja({}), tokenVoor, w }), { fout: 'pas/uitgeven gaf 200' });
});

test('labfonds: een vers voorstel per route, en de gezinsdeur maakt het zelf', async () => {
  const stem = V('/api/labfonds/stem');
  assert.equal(V('/api/rtf/labfonds/scheidsrechter'), stem, 'vijf routes delen dezelfde maker');
  assert.match((await stem({ post: ja({}), tokenVoor, w: {} })).fout, /geen labfondslocatie/);
  assert.deepEqual(await stem({ post: ja({ voorstel: { id: 'VS1' } }), tokenVoor, w: { labLocId: 'L' } }), { id: 'VS1' });
  assert.deepEqual(await stem({ post: nee(400, 'te kort'), tokenVoor, w: { labLocId: 'L' } }),
    { fout: 'labfonds/voorstel/maak gaf 400 te kort' });
  assert.deepEqual(await stem({ post: async () => undefined, tokenVoor, w: { labLocId: 'L' } }),
    { fout: 'labfonds/voorstel/maak gaf undefined ' });
  const gezin = V('/api/rtf/labfonds/beslis');
  assert.notEqual(gezin, stem);
  assert.match((await gezin({ post: ja({}), tokenVoor, w: {} })).fout, /geen labfondslocatie/);
  assert.match((await gezin({ post: ja({}), tokenVoor, w: { labLocId: 'L' } })).fout, /geen gezinssessie/);
  const journaal = [];
  const goed = await gezin({ post: async (pad, lijf) => { journaal.push({ pad, lijf }); return { status: 200, data: { voorstel: { id: 'GV' } } }; },
    tokenVoor, w: { labLocId: 'L', gezinCode: 'G', gezinToken: 'T' } });
  assert.deepEqual(goed, { id: 'GV' });
  assert.equal(journaal[0].pad, '/api/rtf/labfonds/voorstel/maak');
  assert.equal(journaal[0].lijf.code, 'G');
  assert.deepEqual(await gezin({ post: nee(403, 'alleen indiener'), tokenVoor, w: { labLocId: 'L', gezinCode: 'G', gezinToken: 'T' } }),
    { fout: 'rtf/labfonds/voorstel/maak gaf 403 alleen indiener' });
  assert.deepEqual(await gezin({ post: async () => null, tokenVoor, w: { labLocId: 'L', gezinCode: 'G', gezinToken: 'T' } }),
    { fout: 'rtf/labfonds/voorstel/maak gaf null ' });
});

test('gezinssessie: een weigering zonder melding en een antwoord zonder lijf', async () => {
  const v = V('/api/foundation/gezin/sessie/roteer');
  const w = { gezinCode: 'G', gezinToken: 'T' };
  assert.deepEqual(await v({ post: nee(500), w }), { fout: 'gezin/inloggen gaf 500 ' });
  assert.deepEqual(await v({ post: async () => null, w }), { fout: 'gezin/inloggen gaf null ' });
});

test('verzoek/intrek: beide antwoordvormen en een weigering', async () => {
  const v = V('/api/pay/verzoek/intrek');
  const w = { cn2: 'Gouden Ibis' };
  assert.deepEqual(await v({ post: ja({ verzoeken: [{ id: 'A' }] }), tokenVoor, w }), { id: 'A' });
  assert.deepEqual(await v({ post: ja({ verzoek: { id: 'B' } }), tokenVoor, w }), { id: 'B' });
  assert.deepEqual(await v({ post: ja({ verzoeken: [] }), tokenVoor, w }), { fout: 'pay/verzoek gaf 200' });
  assert.deepEqual(await v({ post: async () => null, tokenVoor, w }), { fout: 'pay/verzoek gaf null' });
});

test('beleid/weg: de regel uit het antwoord of de laatste uit de lijst', async () => {
  const v = V('/api/geld/beleid/weg');
  assert.deepEqual(await v({ post: ja({ regel: { id: 'R1' } }), tokenVoor }), { id: 'R1' });
  assert.deepEqual(await v({ post: ja({ regels: [{ id: 'R1' }, { id: 'R2' }] }), tokenVoor }), { id: 'R2' });
  assert.deepEqual(await v({ post: ja({ regels: [] }), tokenVoor }), { fout: 'beleid/zet gaf 200 ' });
  assert.deepEqual(await v({ post: nee(400, 'drempel'), tokenVoor }), { fout: 'beleid/zet gaf 400 drempel' });
  assert.deepEqual(await v({ post: async () => null, tokenVoor }), { fout: 'beleid/zet gaf null ' });
});

test('pos/checkout: een open kamerrekening, of de status van de weigering', async () => {
  const v = V('/api/supplier/pos/checkout');
  const goed = await v({ post: ja({}), tokenVoor });
  assert.match(goed.room, /^Proefkamer-[a-z0-9]+$/);
  assert.equal(goed.method, 'contant');
  assert.deepEqual(await v({ post: nee(409), tokenVoor }), { fout: 'pos/sale gaf 409' });
  assert.deepEqual(await v({ post: async () => null, tokenVoor }), { fout: 'pos/sale gaf null' });
});

test('pay/tik: een tikcode van het tweede lid, of de reden waarom niet', async () => {
  const v = V('/api/pay/tik');
  assert.deepEqual(await v({ post: nee(429, 'te vaak'), w: { anderToken: 'A' } }), { fout: 'pay/tikcode gaf 429 te vaak' });
  assert.deepEqual(await v({ post: nee(500), w: { anderToken: 'A' } }), { fout: 'pay/tikcode gaf 500 ' });
});

/* zaakSaldo zit achter twee voorzieningen; elke stap kan apart weigeren. */
function zaak(antwoorden) {
  return async (pad) => {
    const a = antwoorden[pad];
    return a ? { status: a[0], data: a[1] } : { status: 200, data: {} };
  };
}

test('oormerken en uitbetalen: elke stap van zaakSaldo en de zaakrekening kan weigeren', async () => {
  const apart = V('/api/supplier/pay/treasury/apart');
  const uit = V('/api/supplier/pay/uitbetaal');
  const goedeKas = { '/api/pay/kascode': [200, { code: 'K1' }] };
  assert.deepEqual(await apart({ post: zaak(goedeKas), tokenVoor }), { naam: 'Proefoormerk', centen: 1000, doel: 'btw' });
  assert.deepEqual(await apart({ post: zaak({ '/api/pay/kascode': [200, { kascode: { code: 'K2' } }] }), tokenVoor }).then(x => x.doel), 'btw');
  assert.deepEqual(await apart({ post: zaak({ '/api/pay/kascode': [500, null] }), tokenVoor }), { fout: 'pay/kascode gaf 500' });
  assert.deepEqual(await apart({ post: zaak({ ...goedeKas, '/api/supplier/pos/sale': [400, { error: 'boven maximum' }] }), tokenVoor }),
    { fout: 'pos/sale (rtgpay) gaf 400 boven maximum' });
  assert.deepEqual(await apart({ post: zaak({ ...goedeKas, '/api/supplier/pos/sale': [302, null] }), tokenVoor }),
    { fout: 'pos/sale (rtgpay) gaf 302 ' });
  assert.deepEqual(await uit({ post: zaak(goedeKas), tokenVoor }), {});
  assert.deepEqual(await uit({ post: zaak({ '/api/supplier/pay/rekening': [409, { error: 'wacht' }] }), tokenVoor }),
    { fout: 'pay/rekening gaf 409 wacht' });
  assert.deepEqual(await uit({ post: zaak({ '/api/supplier/pay/rekening': [500, null] }), tokenVoor }),
    { fout: 'pay/rekening gaf 500 ' });
  assert.deepEqual(await uit({ post: zaak({}), tokenVoor }), { fout: 'pay/kascode gaf 200' });
});

test('bestanden/actie: upload, dan de versie uit de lijst, en elke weigering onderweg', async () => {
  const v = V('/api/bestanden/actie');
  const post = (upload, mijn) => async (pad) => (pad === '/api/bestanden/upload' ? upload : mijn);
  const goed = await v({ post: post({ status: 200, data: { id: 'B1' } },
    { status: 200, data: { items: [null, { id: 'B0', documentVersion: 1 }, { id: 'B1', documentVersion: 0 }] } }), tokenVoor });
  assert.equal(goed.strikt, true);
  assert.equal(goed.id, 'B1');
  assert.equal(goed.expectedVersion, 0, 'versie 0 is een echte versie en geen ontbrekende');
  assert.match(goed.operationId, /^[a-zA-Z0-9_-]{1,100}$/);
  assert.deepEqual(await v({ post: post({ status: 413, data: { error: 'te groot' } }), tokenVoor }),
    { fout: 'bestanden/upload gaf 413 te groot' });
  assert.deepEqual(await v({ post: post(null), tokenVoor }), { fout: 'bestanden/upload gaf null ' });
  const geenVersie = { fout: 'het nieuwe bestand stond niet met een versie in /api/bestanden/mijn' };
  assert.deepEqual(await v({ post: post({ status: 200, data: { id: 'B1' } }, { status: 200, data: { items: [{ id: 'B1' }] } }), tokenVoor }), geenVersie);
  assert.deepEqual(await v({ post: post({ status: 200, data: { id: 'B1' } }, null), tokenVoor }), geenVersie);
});
