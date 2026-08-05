/* SPF en DMARC: de twee controles die RTG Mail tot vandaag als "niet
   gecontroleerd" meldde.

   ALLES HIER DRAAIT ZONDER NETWERK. Het DNS is een tabel die de toets zelf
   vult -- en dat is geen gemak maar een voorwaarde: de beweringen die er het
   meest toe doen gaan over wat er gebeurt als het MISGAAT (een domein zonder
   record, een DNS-storing, een SPF die slaagt op een domein dat de lezer nooit
   ziet), en die zijn tegen het echte internet niet te ensceneren.

   De vijf beweringen:

   1. GEEN ANTWOORD IS GEEN GOEDKEURING. Geen record -> 'geen'. Een DNS-storing
      -> 'tijdelijke fout'. Nooit 'gezakt' en nooit 'geslaagd'.
   2. Een IP dat er wel in staat slaagt, een dat er niet in staat zakt, en het
      TEKEN voor de mechanisme bepaalt hoe hard (- gezakt, ~ zacht gezakt).
   3. include/redirect worden gevolgd, maar hoogstens tien DNS-vragen diep --
      anders is een SPF-record een manier om onze server werk te laten doen.
   4. DMARC gaat over UITLIJNING. Een geslaagde SPF op een ANDER domein dan wat
      de lezer ziet, levert een gezakte DMARC op. Dat is het hele punt.
   5. Wij handhaven niet, wij stempelen: het beleid wordt gemeld, niet
      uitgevoerd.
   Draai: node --test test/mailauth.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

/* Een DNS uit een tabel. `fout` laat een naam een storing geven (niet:
   bestaat niet) -- dat verschil is de kern van bewering 1. */
function nepDns(tabel, opties) {
  const o = opties || {};
  let teller = 0;
  const kijk = (soort, naam) => {
    /* NOODREM IN DE NEP-DNS. Bij de mutatie die de vragenteller uitzet, loopt
       een kring van includes eindeloos door en HING de toets in plaats van te
       zakken -- en een hangende toets verbergt precies wat hij zou moeten laten
       zien (eerlijkheidspunt 6.7). Deze rem maakt er een gewone rode toets van,
       met een melding die zegt wat er aan de hand is. */
    if (++teller > 200) throw new Error('deze toets stelde meer dan 200 DNS-vragen; er is geen bovengrens meer');
    const sleutel = soort + ':' + String(naam).toLowerCase();
    if ((o.storing || []).includes(String(naam).toLowerCase())) {
      const e = new Error('SERVFAIL'); e.code = 'SERVFAIL'; throw e;
    }
    if (!(sleutel in tabel)) { const e = new Error('ENOTFOUND'); e.code = 'ENOTFOUND'; throw e; }
    return tabel[sleutel];
  };
  return {
    tellen: 0,
    async resolveTxt(naam) { this.tellen++; return kijk('txt', naam).map(x => [x]); },
    async resolve4(naam) { this.tellen++; return kijk('a', naam); },
    async resolveMx(naam) { this.tellen++; return kijk('mx', naam); }
  };
}
const maak = (tabel, opties) => {
  const dns = nepDns(tabel, opties);
  return { auth: require('../server/kern/mailauth')({ dns }), dns };
};

/* ------------------------------------------------------------------ SPF -- */

test('een domein zonder SPF-record levert "geen" op, nooit geslaagd of gezakt', async () => {
  const { auth } = maak({});
  const r = await auth.spf('203.0.113.7', 'post@zonder-spf.test');
  assert.equal(r.uitslag, 'geen');
  assert.match(r.waarom, /geen SPF-record/);
});

test('een DNS-storing is een TIJDELIJKE fout en geen afkeuring', async () => {
  const { auth } = maak({}, { storing: ['stuk.test'] });
  const r = await auth.spf('203.0.113.7', 'post@stuk.test');
  assert.equal(r.uitslag, 'tijdelijke fout');
  assert.match(r.waarom, /antwoordde niet/);
  /* Dit is de belangrijkste van de vijf: een storing bij ONS mag geen post van
     een ander veroordelen. Zou hier 'gezakt' staan, dan gooit een kapotte
     resolver alle post van iedereen in de spammap. */
});

test('een IP dat in het record staat slaagt, een dat er niet in staat zakt', async () => {
  const { auth } = maak({ 'txt:hotel.test': ['v=spf1 ip4:203.0.113.0/24 -all'] });
  const goed = await auth.spf('203.0.113.7', 'post@hotel.test');
  assert.equal(goed.uitslag, 'geslaagd');
  assert.match(goed.waarom, /ip4:203\.0\.113\.0\/24/);
  const fout = await auth.spf('198.51.100.9', 'post@hotel.test');
  assert.equal(fout.uitslag, 'gezakt', 'het "-all" aan het eind beslist');
});

test('het teken voor het mechanisme bepaalt hoe hard de uitslag is', async () => {
  const zacht = maak({ 'txt:zacht.test': ['v=spf1 ip4:203.0.113.0/24 ~all'] }).auth;
  assert.equal((await zacht.spf('198.51.100.9', 'a@zacht.test')).uitslag, 'zacht gezakt');
  const neutraal = maak({ 'txt:neutraal.test': ['v=spf1 ip4:203.0.113.0/24 ?all'] }).auth;
  assert.equal((await neutraal.spf('198.51.100.9', 'a@neutraal.test')).uitslag, 'neutraal');
  const zonderAll = maak({ 'txt:open.test': ['v=spf1 ip4:203.0.113.0/24'] }).auth;
  assert.equal((await zonderAll.spf('198.51.100.9', 'a@open.test')).uitslag, 'neutraal',
    'een record dat niets over dit IP zegt, keurt het niet af');
});

test('include en redirect worden gevolgd', async () => {
  const { auth } = maak({
    'txt:winkel.test': ['v=spf1 include:_spf.provider.test -all'],
    'txt:_spf.provider.test': ['v=spf1 ip4:198.51.100.0/24 -all'],
    'txt:oud.test': ['v=spf1 redirect=nieuw.test'],
    'txt:nieuw.test': ['v=spf1 ip4:192.0.2.5 -all']
  });
  assert.equal((await auth.spf('198.51.100.9', 'a@winkel.test')).uitslag, 'geslaagd');
  assert.equal((await auth.spf('203.0.113.1', 'a@winkel.test')).uitslag, 'gezakt');
  assert.equal((await auth.spf('192.0.2.5', 'a@oud.test')).uitslag, 'geslaagd', 'redirect gevolgd');
});

/* Deze twee krijgen een eigen tijdslimiet, en dat is geen sierlijkheid. Bij de
   mutatie die de vragenteller UITZET liep de kring eindeloos door: de toets
   hing in plaats van te zakken, en een hangende toets verbergt precies wat hij
   zou moeten laten zien (dezelfde les als eerlijkheidspunt 6.7). Met een limiet
   wordt hij netjes rood. */
test('meer dan tien DNS-vragen wordt geweigerd in plaats van uitgevoerd', { timeout: 5000 }, async () => {
  /* Een keten van includes die elkaar doorverwijzen. Zonder bovengrens is een
     SPF-record een manier om onze server per bericht willekeurig veel werk te
     laten doen -- de RFC noemt tien, en die staat hier hard. */
  const tabel = { 'txt:lang.test': ['v=spf1 include:stap1.test -all'] };
  for (let i = 1; i <= 15; i++) tabel['txt:stap' + i + '.test'] = ['v=spf1 include:stap' + (i + 1) + '.test -all'];
  const { auth, dns } = maak(tabel);
  const r = await auth.spf('203.0.113.7', 'a@lang.test');
  assert.equal(r.uitslag, 'fout');
  assert.match(r.waarom, /DNS-vragen/);
  assert.ok(dns.tellen <= 12, 'en er zijn er ook echt niet meer gesteld: ' + dns.tellen);
});

test('een KRING van includes loopt niet eeuwig door', { timeout: 5000 }, async () => {
  /* a verwijst naar b, b terug naar a. Er is geen aparte dieptegrens meer --
     de tien-vragen-teller vangt dit, want elke stap kost een vraag. Zou die
     teller er niet zijn, dan hangt de server op een record dat iemand anders
     publiceert. */
  const { auth, dns } = maak({
    'txt:a.test': ['v=spf1 include:b.test -all'],
    'txt:b.test': ['v=spf1 include:a.test -all']
  });
  const r = await auth.spf('203.0.113.7', 'x@a.test');
  assert.equal(r.uitslag, 'fout');
  assert.match(r.waarom, /DNS-vragen/);
  assert.ok(dns.tellen <= 12, 'de kring is afgekapt na ' + dns.tellen + ' vragen');
});

test('een domein met TWEE SPF-records is onbepaald, niet "de eerste wint"', async () => {
  const { auth } = maak({ 'txt:dubbel.test': ['v=spf1 ip4:203.0.113.7 -all', 'v=spf1 -all'] });
  const r = await auth.spf('203.0.113.7', 'a@dubbel.test');
  assert.equal(r.uitslag, 'fout');
  assert.match(r.waarom, /een te veel/);
});

test('a: en mx: worden opgezocht bij de host zelf', async () => {
  const { auth } = maak({
    'txt:eigen.test': ['v=spf1 a mx -all'],
    'a:eigen.test': ['203.0.113.10'],
    'mx:eigen.test': [{ exchange: 'mx1.eigen.test', priority: 10 }],
    'a:mx1.eigen.test': ['198.51.100.20']
  });
  assert.equal((await auth.spf('203.0.113.10', 'a@eigen.test')).uitslag, 'geslaagd', 'via a:');
  assert.equal((await auth.spf('198.51.100.20', 'a@eigen.test')).uitslag, 'geslaagd', 'via mx:');
  assert.equal((await auth.spf('192.0.2.1', 'a@eigen.test')).uitslag, 'gezakt');
});

/* ---------------------------------------------------------------- DMARC -- */

test('DMARC zonder record is "geen", en zegt dat ook', async () => {
  const { auth } = maak({});
  const r = await auth.dmarc({ vanKop: 'Jan <jan@zonder.test>', spfUitslag: 'geslaagd', spfDomein: 'zonder.test' });
  assert.equal(r.uitslag, 'geen');
  assert.match(r.waarom, /publiceert geen DMARC/);
});

test('een geslaagde SPF op een ANDER domein laat DMARC zakken -- dat is het punt', async () => {
  /* De aanval die DMARC bestaat om te vangen: de envelope komt van
     oplichter.test (waar de SPF keurig klopt), maar de lezer ziet
     "bank.test" in de From-kop staan. */
  const { auth } = maak({ 'txt:_dmarc.bank.test': ['v=DMARC1; p=reject; rua=mailto:d@bank.test'] });
  const r = await auth.dmarc({ vanKop: 'Bank <service@bank.test>',
    spfUitslag: 'geslaagd', spfDomein: 'oplichter.test', dkimUitslag: 'gezakt', dkimDomein: null });
  assert.equal(r.uitslag, 'gezakt');
  assert.equal(r.beleid, 'reject');
  assert.match(r.waarom, /domein dat de lezer ziet \(bank\.test\)/);
  assert.equal(r.uitlijning.spf, false);
  assert.match(r.let, /STEMPELT alleen/, 'wij handhaven niet, wij stempelen');
});

test('uitlijning op het organisatiedomein telt, tenzij het beleid streng is', async () => {
  const soepel = maak({ 'txt:_dmarc.hotel.test': ['v=DMARC1; p=quarantine'] }).auth;
  const r1 = await soepel.dmarc({ vanKop: 'a@hotel.test', spfUitslag: 'geslaagd', spfDomein: 'post.hotel.test' });
  assert.equal(r1.uitslag, 'geslaagd', 'post.hotel.test hoort bij hotel.test');
  assert.equal(r1.uitlijning.strengSpf, false);

  const streng = maak({ 'txt:_dmarc.hotel.test': ['v=DMARC1; p=quarantine; aspf=s'] }).auth;
  const r2 = await streng.dmarc({ vanKop: 'a@hotel.test', spfUitslag: 'geslaagd', spfDomein: 'post.hotel.test' });
  assert.equal(r2.uitslag, 'gezakt', 'met aspf=s moet het domein exact kloppen');
  assert.equal(r2.uitlijning.strengSpf, true);
});

test('DKIM alleen is genoeg voor DMARC, ook als SPF zakt', async () => {
  const { auth } = maak({ 'txt:_dmarc.reis.test': ['v=DMARC1; p=none'] });
  const r = await auth.dmarc({ vanKop: 'Reis <post@reis.test>',
    spfUitslag: 'gezakt', spfDomein: 'doorstuurder.test',
    dkimUitslag: 'geslaagd', dkimDomein: 'reis.test' });
  assert.equal(r.uitslag, 'geslaagd');
  assert.match(r.waarom, /DKIM slaagt/);
  /* Dit is precies waarom doorgestuurde post nog aankomt: SPF breekt bij een
     doorstuurder, DKIM overleeft hem. */
});

test('het beleid van het organisatiedomein geldt als het subdomein er geen heeft', async () => {
  const { auth } = maak({ 'txt:_dmarc.groep.test': ['v=DMARC1; p=reject'] });
  const r = await auth.dmarc({ vanKop: 'a@afdeling.groep.test', spfUitslag: 'gezakt', spfDomein: 'x.test' });
  assert.equal(r.beleid, 'reject');
  assert.equal(r.viaDomein, 'groep.test');
});
