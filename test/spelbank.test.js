/* MAGNAAT: DE BANK -- de eerste laag waar geld de wereld verlaat.

   Alles hiervoor VERPLAATSTE: een contract betaalt de een en verrijkt de ander,
   een veiling verschuift een zaak, een deelneming splitst een resultaat. Rente
   doet dat niet. Dat maakt deze laag anders om te toetsen en gevaarlijker om te
   bouwen: een fout lekt stilletjes vermogen weg of drukt het bij.

   ZEVEN BEWERINGEN, en ze zijn alle zeven stil terug te draaien:

   1. GELEEND GELD IS GEEN VERMOGEN. De eerste versie telde het wel mee, en dan
      is op de laatste speeldag lenen de goedkoopste manier om te winnen. De
      geldpomp-keuring vond dat; geen enkele andere meter zag het.
   2. NIET IEDEREEN BETAALT DEZELFDE RENTE. Anders is het profiel decoratie.
   3. HET KREDIETPROFIEL IS AFGELEID en wordt nergens apart bijgehouden -- een
      score die los meeloopt, spreekt de werkelijkheid tegen waar hij over gaat.
   4. EEN CONVENANT ESCALEERT en grijpt niet meteen. Eerst een signaal, dan een
      opslag en een dichte deur, en pas veel later het onderpand.
   5. HET ONDERPAND IS DE GRENS. Bij vastgoedfinanciering raak je die ene zaak
      kwijt en niet je bedrijf; zonder onderpand kan niemand iets afpakken.
   6. ELKE VORM MAAKT IETS ANDERS MOGELIJK. Een vorm die alleen een ander getal
      is, hoort er niet te zijn.
   7. DE KLOK BLIJFT DETERMINISTISCH, ook met rente en aflossing erin.

   Draai los: node --test test/spelbank.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const B = require('../server/kern/spellen/magnaat/bank');
const { kaart } = require('../server/kern/spellen/magnaat/kaart');
const { waarde } = require('../server/kern/spellen/magnaat/waardering');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => 'CN-' + h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };
const kavelIn = (zone, n = 0) => kaart('ijmuiden').kavels.filter(k => k.zone === zone)[n];

function opstelling(spelers = ['anna', 'boris']) {
  const m = maakMagnaat();
  const p = { id: 'p1', soort: 'magnaat', spelers, teams: spelers.map((_, i) => i), modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  for (const h of spelers) p.staat.geld[h] = 2000000;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('boulevard').id, sector: 'horeca', omvang: 40, naam: 'Zeezicht' });
  return { m, p, st: p.staat, A: p.staat.vestigingen.anna[0] };
}
const maand = (m, p, n = 1) => {
  for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); }
};
/* Een maand draaien terwijl de convenantbreuk AANHOUDT. Zonder dit herstelt de
   zaak zichzelf -- hij verdient gewoon door -- en dan meet een toets over de
   escalatietrap vooral hoe snel een restaurant weer geld heeft. */
const maandKrap = (m, p, h, n = 1) => {
  for (let i = 0; i < n; i++) {
    /* De zaak stilleggen EN de kas leeghalen. Alleen de kas leeghalen is niet
       genoeg: een restaurant verdient binnen dezelfde maand weer genoeg om de
       norm te halen, en dan telt de trap opnieuw vanaf nul -- wat correct is
       maar betekent dat zo'n toets de herstelkracht meet en niet de trap. */
    for (const v of p.staat.vestigingen[h] || []) { v.personeel = 0; v.marketing = 0; }
    p.staat.geld[h] = 500;
    p.staat.gerekendTot -= p.staat.maandMs;
    m.eco.bijrekenen(p);
  }
};
/* Doordraaien TOT de breuk zover is. De trap telt aaneengesloten breukmaanden,
   en wanneer die beginnen hangt af van hoe snel de zaak zijn kas terugverdient
   -- dus een toets die op maand 1 een signaal verwacht, meet dat herstel en niet
   de trap. Deze helper meet de VOLGORDE, en dat is wat de trap belooft. */
function totBreuk(m, p, h, lening, doel, maxMaanden = 24) {
  for (let i = 0; i < maxMaanden; i++) {
    if ((lening.breukMaanden || 0) >= doel) return i;
    maandKrap(m, p, h, 1);
  }
  return null;
}

/* ================= 1. geleend geld is geen vermogen ================= */

test('lenen maakt je niet rijker, het verplaatst alleen wanneer je het hebt', () => {
  /* DE FOUT DIE DE GELDPOMP-KEURING VOND. `eindstand` telde kas plus bedrijven
     en trok de schuld er niet af, dus zette elke opname zijn hele bedrag op de
     eindstand. Op de laatste speeldag lenen was daarmee de goedkoopste manier
     om te winnen -- en geen unittoets, geen balansmeter en geen toernooi zag
     het, want alle drie kijken ze naar iets anders. */
  const { m, p, st } = opstelling();
  maand(m, p, 2);
  const voor = m.eco.eindstand(p).find(x => x.codenaam === 'CN-anna');
  const r = m.eco.zet(p, 'anna', { actie: 'krediet-opnemen', soort: 'investering', bedrag: 400000, looptijd: 48 });
  assert.ok(r.ok, r.error);
  const na = m.eco.eindstand(p).find(x => x.codenaam === 'CN-anna');
  assert.equal(na.geld - voor.geld, 400000, 'de kas gaat wel omhoog');
  assert.equal(na.schuld, 400000, 'en de schuld staat erbij');
  assert.equal(na.vermogen, voor.vermogen, 'maar het vermogen verandert geen cent');
});

test('aflossen maakt je ook niet armer', () => {
  const { m, p, st } = opstelling();
  maand(m, p, 2);
  const r = m.eco.zet(p, 'anna', { actie: 'krediet-opnemen', soort: 'werkkapitaal', bedrag: 300000, looptijd: 6 });
  const voor = m.eco.eindstand(p).find(x => x.codenaam === 'CN-anna').vermogen;
  assert.ok(m.eco.zet(p, 'anna', { actie: 'krediet-aflossen', id: r.id, bedrag: 300000 }).ok);
  const na = m.eco.eindstand(p).find(x => x.codenaam === 'CN-anna').vermogen;
  assert.equal(na, voor, 'lenen en meteen aflossen is een rondje om niets');
  assert.equal(st.leningen[0].status, 'afgelost');
});

/* ================= 2. niet iedereen betaalt dezelfde rente ================= */

test('een sterke balans leent goedkoper dan een zwakke, en je ziet waarom', () => {
  const sterk = opstelling();
  maand(sterk.m, sterk.p, 6);
  const zwak = opstelling();
  maand(zwak.m, zwak.p, 6);
  // dezelfde wereld, maar boris... eh, anna zit vol schuld en heeft geen buffer
  zwak.m.eco.zet(zwak.p, 'anna', { actie: 'krediet-opnemen', soort: 'investering', bedrag: 900000, looptijd: 48 });
  zwak.st.geld.anna = 5000;

  const a = sterk.m.eco.zicht(sterk.p, sterk.st, 'anna').financiering.offertes.find(o => o.soort === 'investering');
  const b = zwak.m.eco.zicht(zwak.p, zwak.st, 'anna').financiering.offertes.find(o => o.soort === 'investering');
  assert.ok(b.rente > a.rente * 1.15,
    'een uitgewoonde balans hoort merkbaar duurder te zijn: ' + a.rente.toFixed(4) + ' tegen ' + b.rente.toFixed(4));
  // en de opbouw staat erbij, zodat het uit te leggen is in plaats van te raden
  assert.ok(a.stap.basis > 0 && 'schuld' in a.stap && 'liquiditeit' in a.stap && 'discipline' in a.stap);
  assert.ok(b.stap.schuld > a.stap.schuld, 'de schuldterm is de term die het verschil maakt');
});

test('een onderpand maakt geld goedkoper, en dat is de korting en niet het basistarief', () => {
  /* De eerste versie van deze toets legde een VASTGOEDofferte naast een
     INVESTERINGSofferte en concludeerde "goedkoper". Dat was waar, maar het
     bewees niets: die twee vormen hebben al een ander basistarief, dus de
     bewering hield ook stand toen de onderpandkorting werd weggehaald. Een
     mutatie liet hem gewoon groen.

     Nu wordt de korting zelf gemeten: dezelfde vorm, hetzelfde profiel, en het
     verschil tussen de rente met en zonder die ene term. */
  const { m, p, st, A } = opstelling();
  maand(m, p, 6);
  const bp = require('../server/kern/spellen/magnaat/bankprofiel')({ waarde });
  const profiel = bp.profiel(st, 'anna');
  const vast = B.renteVoor('vastgoed', profiel, { sector: 'horeca', looptijd: 60 });
  const zonderZekerheid = B.renteVoor('investering', profiel, { sector: 'horeca', looptijd: 60 });

  assert.ok(vast.stap.onderpand < 0, 'er hoort een korting op te staan: ' + vast.stap.onderpand);
  const zonderKorting = vast.rente - vast.stap.onderpand;
  assert.ok(vast.rente < zonderKorting,
    'dezelfde lening zonder die korting hoort duurder te zijn: ' +
    vast.rente.toFixed(4) + ' tegen ' + zonderKorting.toFixed(4));
  assert.ok(!('onderpand' in zonderZekerheid.stap), 'een ongedekte vorm krijgt hem niet');

  // en de korting is groter naarmate de balans zwakker is: de bank heeft iets in handen
  const zwak = { liquiditeit: 0.1, schuldpositie: 0.1, betalingsdiscipline: 1,
    contractzekerheid: 1, winststabiliteit: 1 };
  const zwakVast = B.renteVoor('vastgoed', zwak, { sector: 'horeca', looptijd: 60 });
  assert.ok(Math.abs(zwakVast.stap.onderpand) > Math.abs(vast.stap.onderpand),
    'wie het het hardst nodig heeft, heeft er het meest aan');

  // en hij is ook echt te krijgen
  const echt = m.eco.zet(p, 'anna', { actie: 'krediet-opnemen', soort: 'vastgoed',
    bedrag: 50000, looptijd: 60, vestiging: A.id });
  assert.ok(echt.ok, echt.error);
});

/* ================= 3. het profiel is afgeleid ================= */

test('het kredietprofiel staat nergens opgeslagen; het volgt uit de toestand', () => {
  const { m, p, st } = opstelling();
  maand(m, p, 6);
  const voor = m.eco.zicht(p, st, 'anna').krediet;
  assert.equal(voor.assen.liquiditeit.sterren >= 1 && voor.assen.liquiditeit.sterren <= 5, true);
  // de kas leeghalen hoort het profiel meteen te veranderen, zonder tussenkomst
  st.geld.anna = 100;
  const na = m.eco.zicht(p, st, 'anna').krediet;
  assert.ok(na.assen.liquiditeit.waarde < voor.assen.liquiditeit.waarde,
    'de liquiditeitsas hoort mee te bewegen met de kas');
  // en er staat geen enkel scorecijfer in de opgeslagen staat
  const opslag = JSON.stringify(st);
  assert.ok(!/kredietscore|creditScore|"score"/.test(opslag),
    'een score die apart wordt bijgehouden loopt uiteen met waar hij over gaat');
});

test('wie nooit een contract tekende wordt daar niet voor gestraft', () => {
  /* Een starter is niet onbetrouwbaar, hij is onbekend -- en dat verschil hoort
     een bank te maken. Zonder deze regel betaalt iedereen die de contractlaag
     niet gebruikt een opslag voor iets wat hij nooit heeft gedaan. */
  const { m, p, st } = opstelling();
  maand(m, p, 3);
  const k = m.eco.zicht(p, st, 'anna').krediet;
  assert.ok(k.assen.contractzekerheid.waarde >= 0.6,
    'geen contracten is geen slechte score: ' + k.assen.contractzekerheid.waarde);
});

test('winststabiliteit kent een saai bedrijf van een achtbaan', () => {
  const { stabiliteit } = require('../server/kern/spellen/magnaat/bankprofiel')({ waarde });
  assert.equal(stabiliteit([]), 0.5, 'zonder geschiedenis is het antwoord neutraal en niet slecht');
  assert.equal(stabiliteit([100, 100]), 0.5, 'twee maanden ook nog niet');
  const saai = stabiliteit([1000, 1010, 990, 1005, 995]);
  const grillig = stabiliteit([1000, 100, 2500, 50, 1800]);
  assert.ok(saai > 0.9, 'een voorspelbaar bedrijf hoort hoog te scoren: ' + saai);
  assert.ok(grillig < saai - 0.3, 'en een grillig bedrijf duidelijk lager: ' + grillig);
});

/* ================= 4. een convenant escaleert ================= */

test('een gebroken convenant geeft eerst een signaal, dan een opslag, en pas veel later de deur', () => {
  /* DIT IS HET BESLUIT DAT FINANCIERING STRATEGISCH MAAKT. Een bank die bij de
     eerste misstap je zaak inneemt, is een bank waar niemand ooit heenloopt --
     en dan is de hele laag decoratie. */
  const { m, p, st, A } = opstelling();
  maand(m, p, 3);
  const r = m.eco.zet(p, 'anna', { actie: 'krediet-opnemen', soort: 'investering', bedrag: 500000, looptijd: 48 });
  assert.ok(r.ok, r.error);
  const l = st.leningen[0];

  assert.ok(totBreuk(m, p, 'anna', l, 1) !== null, 'de norm breekt werkelijk');
  assert.equal(B.trapVan(l.breukMaanden), 'signaal', 'eerst alleen een melding');
  assert.equal(l.opslag, 0, 'en nog geen cent extra');

  totBreuk(m, p, 'anna', l, B.TRAP.opslag);
  assert.equal(B.trapVan(l.breukMaanden), 'opslag');
  assert.ok(l.opslag > 0, 'nu wel een opslag: ' + l.opslag);
  // en de deur dicht voor nieuw geld
  const nieuw = m.eco.zet(p, 'anna', { actie: 'krediet-opnemen', soort: 'werkkapitaal', bedrag: 50000, looptijd: 6 });
  assert.equal(nieuw.status, 409);
  assert.match(nieuw.error, /convenant/);

  /* En pas een half jaar later de deur. Dat de trap PRECIES zes aaneengesloten
     maanden is, staat in ./bank.js; wat deze toets vasthoudt is dat er nog vier
     maanden tussen de opslag en het opeisen zitten. */
  assert.equal(B.TRAP.opeisbaar - B.TRAP.opslag, 4);
  const opgeeist = st.leningen[0];
  maandKrap(m, p, 'anna', 6);
  assert.ok(opgeeist.opgeeist || opgeeist.status !== 'loopt',
    'na aanhoudende breuk wordt hij opgeeist: ' + opgeeist.status);
  assert.ok(opgeeist.opslag > B.BREUK_OPSLAG,
    'en de opslag verdubbelt: ' + opgeeist.opslag);
  /* EN HIJ BLIJFT VERDUBBELD. De opslag wordt elke maand opnieuw bepaald, en de
     eerste versie zette hem de maand erna gewoon weer terug -- dan is opeisen
     een tik op de vingers die na een maand vervalt. */
  maandKrap(m, p, 'anna', 3);
  assert.ok(opgeeist.opslag > B.BREUK_OPSLAG, 'ook drie maanden later nog: ' + opgeeist.opslag);
});

test('herzien is de uitweg, en hij kost wat hij hoort te kosten', () => {
  const { m, p, st } = opstelling();
  maand(m, p, 3);
  const r = m.eco.zet(p, 'anna', { actie: 'krediet-opnemen', soort: 'investering', bedrag: 500000, looptijd: 48 });
  const l = st.leningen[0];
  totBreuk(m, p, 'anna', l, B.TRAP.opslag);
  assert.ok(l.opslag > 0, 'hij zit op de opslagtrap');
  const oudeRente = l.rente, oudeLooptijd = l.looptijd;
  const h = m.eco.zet(p, 'anna', { actie: 'krediet-herzien', id: l.id, maanden: 24 });
  assert.ok(h.ok, h.error);
  assert.ok(l.looptijd > oudeLooptijd, 'langer lenen');
  assert.ok(l.rente > oudeRente, 'tegen een hogere rente');
  assert.equal(l.opslag, 0, 'en de opslag is van tafel');
  assert.equal(l.breukMaanden, 0, 'net als de teller');
  // maar een tweede keer gaat niet
  assert.equal(m.eco.zet(p, 'anna', { actie: 'krediet-herzien', id: l.id, maanden: 24 }).status, 409);
});

/* ================= 5. het onderpand is de grens ================= */

test('bij vastgoedfinanciering raak je die ene zaak kwijt, niet je bedrijf', () => {
  const { m, p, st, A } = opstelling();
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('centrum').id, sector: 'retail', omvang: 30, naam: 'Tweede' });
  maand(m, p, 4);
  const tweede = st.vestigingen.anna[1];
  const r = m.eco.zet(p, 'anna', { actie: 'krediet-opnemen', soort: 'vastgoed',
    bedrag: 60000, looptijd: 60, vestiging: tweede.id });
  assert.ok(r.ok, r.error);
  const l = st.leningen[0];
  assert.equal(l.onderpand, tweede.id);
  // de schuldnorm breken: geen winst, wel schuld
  for (const v of st.vestigingen.anna) v.resultaatTotaal = -50000;
  maandKrap(m, p, 'anna', 14);
  /* De bank pakt zijn onderpand. Of de LENING daarmee klaar is, hangt af van
     wat het pand opbracht -- bleef er schuld over, dan loopt hij door zonder
     zekerheid en met de dubbele opslag. Vandaar dat de bewering aan
     `uitgewonnen` hangt en niet aan de status: het feit is dat de zaak weg is. */
  assert.equal(l.uitgewonnen, tweede.id, 'het onderpand is uitgewonnen; status: ' + l.status);
  assert.ok(['uitgewonnen', 'afgelost', 'loopt'].includes(l.status));
  if (l.status === 'loopt') {
    assert.equal(l.onderpand, null, 'er is geen zekerheid meer');
    assert.ok(l.opgeeist, 'en hij draagt de opslag van een opgeeiste lening');
  }
  assert.equal(st.vestigingen.anna.length, 1, 'en verder niets');
  assert.equal(st.vestigingen.anna[0].id, A.id, 'de andere zaak staat er nog');
  assert.equal(st.kavelBezet[tweede.kavel], undefined, 'het kavel is vrij');
});

test('een ongedekte lening kan niemand afpakken; hij blijft duur staan', () => {
  const { m, p, st } = opstelling();
  maand(m, p, 3);
  m.eco.zet(p, 'anna', { actie: 'krediet-opnemen', soort: 'investering', bedrag: 500000, looptijd: 48 });
  const l = st.leningen[0];
  for (const v of st.vestigingen.anna) v.resultaatTotaal = -50000;
  maandKrap(m, p, 'anna', 14);
  assert.equal(st.vestigingen.anna.length, 1, 'zijn zaak is van hem gebleven');
  assert.equal(l.status, 'loopt');
  assert.ok(l.opslag > B.BREUK_OPSLAG, 'maar het geld is duur geworden: ' + l.opslag);
  /* GEEN FAILLISSEMENT, en dat is dezelfde regel als GAMEHALL.md 12.6: geen
     straf voor wegblijven. Een speler die zijn wereld kwijtraakt, komt niet
     terug. */
});

/* ================= 6. elke vorm maakt iets anders mogelijk ================= */

test('de vijf kredietvormen verschillen in meer dan hun rente', () => {
  const eigenschappen = B.VORMLIJST.map(k => {
    const v = B.VORMEN[k];
    return [v.aflossend, v.onderpand, v.achtergesteld, !!v.automatisch, v.covenanten.join('+')].join('|');
  });
  assert.equal(new Set(eigenschappen).size, B.VORMLIJST.length,
    'twee vormen met precies dezelfde eigenschappen zijn een vorm met twee namen: ' + eigenschappen.join(' / '));
  // en de rekening-courant vraag je niet aan; die ontstaat
  const { m, p } = opstelling();
  const r = m.eco.zet(p, 'anna', { actie: 'krediet-opnemen', soort: 'rekeningcourant', bedrag: 50000 });
  assert.equal(r.status, 400);
  assert.match(r.error, /vanzelf/);
});

test('een achtergestelde lening koopt ruimte om elders te lenen', () => {
  /* Dat is precies waar hij voor is: hij telt bij de andere vormen als eigen
     vermogen. Zonder die eigenschap is het gewoon een dure lening. */
  const kaal = opstelling();
  maand(kaal.m, kaal.p, 4);
  const voor = kaal.m.eco.zicht(kaal.p, kaal.st, 'anna')
    .financiering.offertes.find(o => o.soort === 'investering').max;
  assert.ok(kaal.m.eco.zet(kaal.p, 'anna', { actie: 'krediet-opnemen', soort: 'achtergesteld',
    bedrag: 200000, looptijd: 36 }).ok);
  const na = kaal.m.eco.zicht(kaal.p, kaal.st, 'anna')
    .financiering.offertes.find(o => o.soort === 'investering').max;
  assert.ok(na > voor, 'achtergesteld geld hoort je leenruimte te vergroten: ' + voor + ' -> ' + na);
});

test('de bank leent niet boven zijn eigen dak', () => {
  const { m, p, st } = opstelling();
  maand(m, p, 4);
  const o = m.eco.zicht(p, st, 'anna').financiering.offertes.find(x => x.soort === 'investering');
  assert.ok(o.max > 0, 'er valt iets te lenen: ' + o.max);
  const teveel = m.eco.zet(p, 'anna', { actie: 'krediet-opnemen', soort: 'investering',
    bedrag: o.max + 100000, looptijd: 48 });
  assert.equal(teveel.status, 400);
  assert.match(teveel.error, /gaat tot/);
  assert.ok(m.eco.zet(p, 'anna', { actie: 'krediet-opnemen', soort: 'investering',
    bedrag: o.max, looptijd: 48 }).ok, 'precies het dak mag wel');
});

/* ================= 7. de klok blijft deterministisch ================= */

test('tien maanden in een keer geeft hetzelfde als tien maanden los, ook met een lening', () => {
  const opzet = () => {
    const o = opstelling();
    maand(o.m, o.p, 2);
    o.m.eco.zet(o.p, 'anna', { actie: 'krediet-opnemen', soort: 'investering', bedrag: 400000, looptijd: 36 });
    return o;
  };
  const los = opzet();
  for (let i = 0; i < 10; i++) maand(los.m, los.p, 1);
  const bulk = opzet();
  bulk.p.staat.gerekendTot -= bulk.p.staat.maandMs * 10;
  bulk.m.eco.bijrekenen(bulk.p);
  assert.equal(Math.round(los.st.geld.anna), Math.round(bulk.st.geld.anna));
  assert.equal(Math.round(los.st.leningen[0].restant), Math.round(bulk.st.leningen[0].restant));
  assert.equal(Math.round(los.st.leningen[0].betaaldRente), Math.round(bulk.st.leningen[0].betaaldRente));
});

test('rente verlaat de wereld, en precies dat bedrag en niet meer', () => {
  /* De derde categorie in de geldpomp-keuring. Zonder die categorie keurt die
     meter financiering af omdát hij werkt; met een verkeerde boeking lekt er
     meer weg dan er aan rente betaald is, en dat ziet niemand. */
  const { meet, RUIS } = require('../scripts/magnaat-pomp');
  for (const scenario of ['lenenEnStilzitten', 'leenCarrousel']) {
    const r = meet(scenario, 12);
    assert.ok(Math.abs(r.relatief) <= RUIS,
      scenario + ': na aftrek van de rentelast hoort er niets over te blijven, maar er staat ' +
      Math.round(r.verschil) + ' (' + (r.relatief * 100).toFixed(2) + '%)');
    /* Bij `leenCarrousel` wordt er binnen dezelfde maand weer afgelost, dus
       loopt er GEEN rente -- en dat is goed gedrag en geen fout. Wat de toets
       hier vasthoudt is dat het lek nooit negatief is: geld dat de wereld
       binnenkomt zonder dat iemand het stort, is dezelfde bug als geld dat
       verdwijnt. */
    assert.ok(r.lek >= 0, scenario + ': er komt rente de wereld IN, en dat kan niet: ' + r.lek);
  }
  const rentelopend = meet('lenenEnStilzitten', 12);
  assert.ok(rentelopend.lek > 0, 'wie leent en niets doet, betaalt werkelijk rente: ' + rentelopend.lek);
  if (false) {
  }
});

test('lenen is een vrije actie', () => {
  const m = maakMagnaat();
  for (const actie of ['krediet-opnemen', 'krediet-aflossen', 'krediet-herzien'])
    assert.ok(m.spel.buitenBeurt.includes(actie), actie + ' hoort buiten de beurt te mogen');
});

test('een medespeler ziet je schuld niet', () => {
  /* Schuld is de scherpste vorm van andermans boeken: wie weet dat je krap zit,
     weet wanneer hij moet toeslaan. */
  const { m, p, st } = opstelling();
  maand(m, p, 3);
  m.eco.zet(p, 'anna', { actie: 'krediet-opnemen', soort: 'investering', bedrag: 456789, looptijd: 48 });
  const boris = JSON.stringify(m.eco.zicht(p, st, 'boris'));
  assert.ok(!/456789/.test(boris), 'boris hoort het bedrag niet te zien');
  assert.equal(m.eco.zicht(p, st, 'boris').financiering.leningen.length, 0);
  for (const laag of ['kijker', 'publiek'])
    assert.ok(!/456789/.test(JSON.stringify(m.spel.zicht[laag](p, st))), laag + ' evenmin');
});

/* ================= de zes harde pomptoetsen op financiering ================= */

test('geen van de zes financieringsroutes maakt waarde uit het niets', () => {
  /* ZES ROUTES DIE ELK EEN ANDERE MANIER PROBEREN, en ze zijn er alle zes
     omdat een financieringslaag precies zoveel manieren biedt om geld te
     drukken als hij posten heeft.

     Vier van de zes vergelijken TOTALEN. Bij een lekkende laag is de eis daar
     scherper dan elders: rente verlaat de wereld met een exact bedrag, dus na
     aftrek hoort er NUL over te blijven en niet "iets binnen een marge".

     Twee van de zes doen dat NIET, en dat is een correctie op de eerste versie.
     Wie leent en bouwt, bouwt echte bedrijven die echt geld verdienen -- daar
     hoort het totaal van te stijgen, anders is lenen zinloos. Die twee dragen
     daarom hun eigen bewering: de leenruimte mag niet groeien van het lenen,
     en het kredietplafond mag niet weglopen. */
  const { meet, EXACT, SCENARIOS } = require('../scripts/magnaat-pomp');
  const routes = ['leenCarrousel', 'kruisfinanciering', 'herfinanciering', 'lenenEnStilzitten'];
  for (const naam of routes) {
    const r = meet(naam, 12);
    assert.equal(SCENARIOS[naam].verwacht, 'lekkend');
    assert.ok(Math.abs(r.verschil) <= EXACT,
      naam + ': na aftrek van de rentelast hoort er nul over te blijven, maar er staat ' +
      Math.round(r.verschil) + ' (' + SCENARIOS[naam].naam + ')');
    assert.equal(r.klacht, null);
  }
  for (const naam of ['onderpandspiraal', 'hefboomladder']) {
    const r = meet(naam, 12);
    assert.equal(SCENARIOS[naam].verwacht, 'economisch');
    assert.equal(r.klacht, null, naam + ': ' + r.klacht);
  }
});

test('lenen tegen een pand maakt datzelfde pand niet meer waard', () => {
  /* DE ONDERPANDSPIRAAL, rechtstreeks. Zou de waardering meebewegen met wat er
     tegen geleend is, dan financiert een speler zichzelf omhoog zonder ooit
     iets te verkopen -- en dat is niet alleen een zeepbel maar in een spel
     gewoon oneindig geld. */
  const { m, p, st, A } = opstelling();
  maand(m, p, 6);
  const voor = m.eco.zicht(p, st, 'anna').vestigingen[0].waarde;
  const r = m.eco.zet(p, 'anna', { actie: 'krediet-opnemen', soort: 'vastgoed',
    bedrag: Math.floor(voor * 0.5), looptijd: 120, vestiging: A.id });
  assert.ok(r.ok, r.error);
  const na = m.eco.zicht(p, st, 'anna').vestigingen[0].waarde;
  assert.equal(na, voor, 'de waardering hoort van het lenen niets te merken');
  // en de leenruimte tegen datzelfde pand is met precies de lening gekrompen
  const tweede = m.eco.zet(p, 'anna', { actie: 'krediet-opnemen', soort: 'vastgoed',
    bedrag: Math.floor(voor * 0.5), looptijd: 120, vestiging: A.id });
  assert.equal(tweede.status, 400, 'twee keer de helft tegen hetzelfde pand kan niet');
});

test('het kredietplafond loopt niet weg als je leent, bouwt en opnieuw leent', () => {
  const { meet } = require('../scripts/magnaat-pomp');
  const r = meet('hefboomladder', 12);
  assert.equal(r.klacht, null, r.klacht);
});
