/* MAGNAAT: ONDERZOEK -- bedrijven die ANDERS worden in plaats van alleen groter.

   NEGEN BEWERINGEN, en ze zijn alle negen stil terug te draaien:

   1. VIJF HEFBOMEN, ZEVEN VERTALINGEN. Een restaurant dat automatiseert en een
      vervoerder die zijn benutting verhoogt doen economisch hetzelfde; de sector
      geeft het een naam en eigen getallen. Geen vijfendertig losse uitvindingen.
   2. ELKE RICHTING HEEFT EEN KEERZIJDE. Een knoop die alleen maar goed is, is
      geen keuze maar een knop.
   3. JE ONDERZOEKT WAT JE DOET. Een sectortak gaat alleen open als je in die
      sector werkelijk een vestiging hebt.
   4. EEN EFFECT IS EEN GEMETEN PRODUCTIVITEITSWINST EN GEEN BONUS. Elk
      knooppunt grijpt aan op een getal dat de motor al gebruikt.
   5. ONDERZOEK SLAAGT NIET OF FAALT; HET LOOPT ANDERS. Volledig, gedeeltelijk,
      of nuttig voor een andere KPI dan je dacht.
   6. KENNIS IS VAN HET BEDRIJF, TOEPASSING IS PER VESTIGING.
   7. INVESTEREN IS OP KORTE TERMIJN VERNIETIGEND, en onderzoek maakt NOOIT kas.
   8. DE SUBSIDIE IS EEN OVERDRACHT EN GEEN SCHEPPING.
   9. DE VOORTGANG EN DE UITKOMST ZIJN DETERMINISTISCH (GAMEHALL.md 12.4).

   Draai los: node --experimental-sqlite --test test/spelonderzoek.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const O = require('../server/kern/spellen/magnaat/onderzoek');
const { kaart } = require('../server/kern/spellen/magnaat/kaart');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => 'CN-' + h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };
const kavelIn = (zone, n = 0) => kaart('ijmuiden').kavels.filter(k => k.zone === zone)[n];

function opstelling(id = 'p1') {
  const m = maakMagnaat();
  const p = { id, soort: 'magnaat', spelers: ['anna', 'boris'], teams: [0, 1], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  for (const h of p.spelers) p.staat.geld[h] = 5000000;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('boulevard').id, sector: 'horeca', omvang: 40, naam: 'Zeezicht' });
  return { m, p, st: p.staat, A: p.staat.vestigingen.anna[0] };
}
const maand = (m, p, n = 1) => {
  for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); }
};
/* TECHNIEK OP EEN PAND ZETTEN ZOALS DE MOTOR HET DOET. De vermenigvuldigers
   staan sinds de uitkomsten OP de vestiging (`techEffect`), want de tabel zegt
   niet meer wat er draait -- dat verschilt per speler. Een toets die alleen
   `v.tech` zet, meet daarom niets. */
const zetTech = (v, sleutels, gerealiseerd) => {
  v.tech = sleutels.slice();
  v.techEffect = O.techEffect(v.tech, gerealiseerd);
};
/* Een onderzoek helemaal afmaken. Ruim budget, want deze toetsen gaan niet over
   hoe lang het duurt. */
function tot(m, p, h, sleutel, maxMaanden = 40) {
  const r = m.eco.zet(p, h, { actie: 'onderzoek-starten', sleutel, budget: O.BOOM[sleutel].kosten * 2 });
  assert.ok(r.ok, sleutel + ': ' + r.error);
  for (let i = 0; i < maxMaanden; i++) {
    maand(m, p, 1);
    const o = p.staat.onderzoek.find(x => x.id === r.id);
    if (o.status === 'klaar') return o;
  }
  throw new Error(sleutel + ' werd niet af in ' + maxMaanden + ' maanden');
}

/* ================= 1. vijf hefbomen, zeven vertalingen ================= */

test('elke sector heeft alle vijf de richtingen, en geen enkele een eigen vorm', () => {
  for (const sector of O.SECTORLIJST) {
    const eigen = O.boomVoor(sector).filter(k => O.BOOM[k].sector === sector);
    assert.equal(eigen.length, O.PADEN.length,
      sector + ' heeft ' + eigen.length + ' richtingen en niet ' + O.PADEN.length);
    const paden = eigen.map(k => O.BOOM[k].pad).sort();
    assert.deepEqual(paden, O.PADEN.slice().sort(), sector + ' mist of dubbelt een richting');
    for (const k of eigen) {
      /* DE VORM KOMT UIT HET PAD, DE PRIJS UIT DE SECTOR. Onderzoekskosten,
         looptijd en onzekerheid horen gelijk te zijn -- een sector die stiekem
         een korter pad krijgt is een onbalans die niemand ziet. De UITROLPRIJS
         hoort juist te verschillen, en dat is een correctie die uit de meter
         kwam: een energiebesparing van dertig procent is bij een vervoerder
         honderden euro's per maand en bij een kantoor negenenveertig, dus
         dezelfde prijs vragen maakt de ene knoop een koopje en de andere dood.
         Negentien van de vijfendertig stonden buiten de band, tot 581 maanden. */
      const p = O.PAD[O.BOOM[k].pad];
      assert.equal(O.BOOM[k].kosten, p.kosten, k + ' wijkt af in onderzoekskosten');
      assert.equal(O.BOOM[k].duur, p.duur, k + ' wijkt af in looptijd');
      assert.equal(O.BOOM[k].onzeker, !!p.onzeker, k + ' wijkt af in onzekerheid');
      assert.ok(O.BOOM[k].implementatie > 0, k + ' heeft geen uitrolprijs');
    }
  }
});

test('de sectoren geven dezelfde hefboom echt andere getallen', () => {
  /* Anders is "zeven vertalingen" een sjabloon met zeven namen erop. Per
     richting horen de sectoren uiteen te lopen. */
  for (const pad of O.PADEN) {
    const waarden = O.SECTORLIJST.map(s => O.BOOM[s + '.' + pad].effect[O.PAD[pad].plus]);
    assert.ok(new Set(waarden.map(x => x.toFixed(3))).size >= 3,
      pad + ' heeft in alle sectoren bijna hetzelfde getal: ' + waarden.join(', '));
    const namen = new Set(O.SECTORLIJST.map(s => O.BOOM[s + '.' + pad].naam));
    assert.equal(namen.size, O.SECTORLIJST.length, pad + ' hergebruikt een naam over sectoren');
  }
});

test('een tak gaat pas open als zijn stam er staat', () => {
  const { m, p } = opstelling();
  const diep = m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: 'horeca.energie' });
  assert.equal(diep.status, 409, 'alles hangt achter de stam');
  assert.match(diep.error, /eerst/);
  tot(m, p, 'anna', O.STAM);
  assert.ok(m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: 'horeca.energie' }).ok,
    'na de stam gaat de tak open');
});

test('het capstone-pad hangt achter twee eigen takken', () => {
  const { m, p } = opstelling();
  tot(m, p, 'anna', O.STAM);
  const vroeg = m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: 'horeca.concept' });
  assert.equal(vroeg.status, 409, 'conceptinnovatie is een capstone en geen beginpunt');
  for (const sector of O.SECTORLIJST) {
    const k = O.BOOM[sector + '.concept'];
    assert.equal(k.vereist.length, 3, sector + '.concept hoort stam + twee eigen takken te vragen');
    assert.ok(k.vereist.every(v => O.BOOM[v]), sector + '.concept vraagt iets wat niet bestaat');
  }
  /* En je kunt er niet alles uithalen: met twee tegelijk en vijf richtingen is
     de boom een keuze en geen afvinklijst. */
  assert.ok(O.TEGELIJK < O.PADEN.length / 2, 'je kunt niet aan alles tegelijk werken');
});

/* ================= 2. elke richting heeft een keerzijde ================= */

test('geen enkele richting is alleen maar goed', () => {
  /* DE TOELATINGSEIS. Een knoop zonder keerzijde is geen keuze maar een knop
     die je indrukt zodra je hem kunt betalen. Energie is de uitgesproken
     uitzondering: die betaalt zijn prijs in de UITROL, en dat hoort dan ook de
     duurste uitrol van de boom te zijn. */
  const duurder = (veld, f) => (veld === 'perMedewerker' || veld === 'markt' || veld === 'kwaliteit')
    ? f < 1 : f > 1;
  for (const sleutel of O.KNOPEN) {
    const k = O.BOOM[sleutel];
    if (k.pad === 'stam') continue;
    const keerzijde = Object.entries(k.effect).some(([veld, f]) => duurder(veld, f));
    if (k.pad === 'energie') {
      assert.ok(!keerzijde, sleutel + ' hoort zijn prijs in de uitrol te dragen, niet in de exploitatie');
      continue;
    }
    assert.ok(keerzijde, sleutel + ' heeft geen keerzijde: ' + JSON.stringify(k.effect));
  }
});

test('elke uitvinding verdient zijn uitrol terug in dezelfde orde van tijd', () => {
  /* DIT IS DE BAND, en hij vervangt de eis dat elke sector dezelfde prijs
     betaalt. Wat telt is niet of de prijzen gelijk zijn maar of ze KLOPPEN: een
     knoop die zich in vier maanden terugverdient is een knop, een knoop die er
     dertig over doet bestaat niet. De meter rekent het per sector uit. */
  const { meet, BAND, EENMALIG } = require('../scripts/magnaat-onderzoek');
  const stuk = meet('ijmuiden').filter(r => !EENMALIG.has(r.sleutel)
    && !(r.mediaan >= BAND[0] && r.mediaan <= BAND[1]));
  assert.deepEqual(stuk.map(r => r.sleutel + ' ' + r.mediaan.toFixed(0)), [],
    'buiten de band van ' + BAND[0] + ' tot ' + BAND[1] + ' maanden');
});

test('de keerzijde telt mee in wat een uitvinding oplevert', () => {
  /* Anders meet je de helft van een knoop en ziet elke richting er beter uit
     dan hij is -- precies de fout die de meter bij `vast` al vond. */
  const cijfers = { vast: 2000, inkoop: 18000, lonen: 9000, marge: 30000, risico: 500 };
  const k = O.BOOM['horeca.automatisering'];
  const met = O.opbrengstVan('horeca.automatisering', cijfers);
  const zonder = O.opbrengstVan('horeca.automatisering', cijfers,
    { perMedewerker: k.effect.perMedewerker });
  assert.ok(met < zonder, 'de hogere vaste lasten horen van de winst af: ' +
    Math.round(zonder) + ' -> ' + Math.round(met));
});

/* ================= 3. je onderzoekt wat je doet ================= */

test('een sectortak gaat alleen open waar je ook werkelijk zit', () => {
  const { m, p, st } = opstelling();
  tot(m, p, 'anna', O.STAM);
  const vreemd = m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: 'logistiek.energie' });
  assert.equal(vreemd.status, 409, 'anna heeft geen logistiek');
  assert.match(vreemd.error, /logistiek/);
  assert.ok(m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: 'horeca.energie' }).ok);
  // en zodra ze er wel een heeft, gaat hij open
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('terrein').id, sector: 'logistiek', omvang: 8, naam: 'Loods' });
  assert.ok(m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: 'logistiek.energie' }).ok,
    'met een loods erbij hoort de logistieke tak open te gaan');
  assert.ok(st.vestigingen.anna.length === 2);
});

test('de boom die je ziet is de boom die je kunt gebruiken', () => {
  const { m, p, st } = opstelling();
  const beeld = m.eco.zicht(p, st, 'anna').onderzoek;
  const sectoren = new Set(beeld.boom.map(k => k.sector).filter(Boolean));
  assert.deepEqual([...sectoren], ['horeca'], 'een horeca-ondernemer krijgt geen catalogus van 35 knopen');
  assert.ok(beeld.boom.some(k => k.sleutel === O.STAM), 'de stam hoort erbij');
});

test('een uitvinding uit een andere sector kun je niet uitrollen', () => {
  const { m, p, st, A } = opstelling();
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('terrein').id, sector: 'logistiek', omvang: 8 });
  tot(m, p, 'anna', O.STAM);
  tot(m, p, 'anna', 'logistiek.energie');
  const mis = m.eco.zet(p, 'anna', { actie: 'onderzoek-uitrollen', sleutel: 'logistiek.energie', vestiging: A.id });
  assert.equal(mis.status, 409, 'een vervoersuitvinding hoort niet in een restaurant te passen');
  const loods = st.vestigingen.anna[1];
  assert.ok(m.eco.zet(p, 'anna', { actie: 'onderzoek-uitrollen', sleutel: 'logistiek.energie', vestiging: loods.id }).ok);
});

/* ================= 4. een effect is een gemeten winst ================= */

test('elk knooppunt grijpt aan op een getal dat de motor al gebruikt', () => {
  for (const sleutel of O.KNOPEN) {
    const e = O.BOOM[sleutel].effect;
    assert.ok(e && Object.keys(e).length, sleutel + ' heeft geen effect');
    for (const veld of Object.keys(e))
      assert.ok(O.VELDEN.includes(veld),
        sleutel + ' grijpt aan op "' + veld + '", en dat is geen getal van de motor');
  }
});

test('automatisering koopt ruimte om af te slanken, en die ruimte is zichtbaar', () => {
  /* Deze toets is ooit herschreven nadat hij zakte. Hij mat of automatisering de
     CAPACITEIT verhoogt; dat doet hij niet, want een zaak wordt precies bezet
     geopend en zit tegen zijn omvang aan. Wat de uitvinding koopt is ruimte om
     af te slanken -- en dat getal stond nergens op het scherm. */
  const { m, p, st } = opstelling();
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('boulevard', 1).id,
    sector: 'horeca', omvang: 120, naam: 'De Grote Zaal' });
  const B = st.vestigingen.anna[1];
  const beeld = () => m.eco.zicht(p, st, 'anna').vestigingen.find(x => x.id === B.id);
  const voor = beeld();
  assert.equal(voor.personeel, voor.personeelNodig, 'een nieuwe zaak start precies bezet');
  zetTech(B, ['horeca.automatisering']);
  const na = beeld();
  assert.equal(na.capaciteit, voor.capaciteit, 'de zaak wordt niet groter; hij zit tegen zijn omvang aan');
  assert.ok(na.personeelNodig < voor.personeelNodig,
    'maar er kunnen mensen af: ' + voor.personeelNodig + ' -> ' + na.personeelNodig);
});

test('energie verlaagt de vaste lasten, en dat is te zien op het maandoverzicht', () => {
  const meting = (tech) => {
    const { m, p, st, A } = opstelling();
    maand(m, p, 2);
    zetTech(A, tech);
    maand(m, p, 1);
    return st.laatste.anna.regels[0];
  };
  const zonder = meting([]), met = meting(['horeca.energie']);
  assert.ok(met.vast < zonder.vast, 'de vaste lasten dalen: ' + zonder.vast + ' -> ' + met.vast);
  assert.ok(Math.abs(met.vast / zonder.vast - O.BOOM['horeca.energie'].effect.vast) < 0.02,
    'en precies met de factor uit de boom');
  assert.ok(met.resultaat > zonder.resultaat, 'en dat komt in het resultaat terecht');
});

test('kwaliteit werkt via de beleving en niet rechtstreeks op de omzet', () => {
  /* De kwaliteitsrichting verhoogt wat er GELEVERD wordt; reputatie kruipt daar
     naartoe en de vraag volgt de reputatie. Twee stappen die de motor al zette
     -- geen bonus op de uitkomst. */
  const meting = (tech) => {
    const { m, p, st, A } = opstelling();
    zetTech(A, tech);
    maand(m, p, 6);
    return { kwaliteit: st.laatste.anna.regels[0].kwaliteit, reputatie: A.reputatie };
  };
  const zonder = meting([]), met = meting(['horeca.kwaliteit']);
  assert.ok(met.kwaliteit > zonder.kwaliteit, 'de geleverde kwaliteit stijgt');
  assert.ok(met.reputatie > zonder.reputatie, 'en de reputatie kruipt eraan achterna');
});

test('predictive maintenance verlaagt alleen de technische risicos', () => {
  const R = require('../server/kern/spellen/magnaat/risico');
  const kaal = { id: 'v1', sector: 'logistiek', omvang: 20, onderhoud: 60, personeel: 4 };
  const slim = Object.assign({}, kaal, { techEffect: { risico: 0.6 } });
  const tel = (v) => {
    let n = 0;
    for (let mnd = 0; mnd < 400; mnd++) n += R.voorvallen('p', mnd, v, { bezetting: 0.7 }).length;
    return n;
  };
  assert.ok(tel(slim) < tel(kaal), 'minder voorvallen: ' + tel(kaal) + ' -> ' + tel(slim));
  // maar aansprakelijkheid is geen techniek en luistert dus niet
  const kansKaal = R.kansOp ? null : null;
  const alleen = (v, sleutel) => {
    let n = 0;
    for (let mnd = 0; mnd < 400; mnd++)
      n += R.voorvallen('p', mnd, v, { bezetting: 0.7 }).filter(x => x.risico === sleutel).length;
    return n;
  };
  assert.equal(alleen(slim, 'aansprakelijkheid'), alleen(kaal, 'aansprakelijkheid'),
    'onderzoek maakt niemand minder aansprakelijk');
  assert.ok(alleen(slim, 'machinebreuk') < alleen(kaal, 'machinebreuk'), 'machines gaan wel minder stuk');
  assert.equal(kansKaal, null);
});

test('twee uitvindingen op hetzelfde veld stapelen door vermenigvuldiging', () => {
  /* Niet door optelling, want dan kan een veld negatief worden en is de motor
     stuk. Met twee kortingen van twintig procent hou je 64% over en geen 60%. */
  const a = { inkoop: 0.9 }, b = { inkoop: 0.8 };
  const tabel = O.techEffect(['x', 'y'], { x: a, y: b });
  assert.ok(Math.abs(tabel.inkoop - 0.72) < 1e-9, 'vermenigvuldigd: ' + tabel.inkoop);
  assert.equal(O.factor({ techEffect: tabel }, 'inkoop'), tabel.inkoop);
  assert.equal(O.factor({}, 'inkoop'), 1, 'zonder techniek verandert er niets');
});

/* ================= 5. het loopt anders ================= */

test('een onderzoek loopt volledig, gedeeltelijk of anders', () => {
  const telling = {};
  for (let i = 0; i < 300; i++) {
    const u = O.uitkomst('p' + i, 'horeca.automatisering');
    telling[u] = (telling[u] || 0) + 1;
  }
  for (const soort of ['volledig', 'gedeeltelijk', 'anders'])
    assert.ok(telling[soort] > 15, soort + ' komt bijna nooit voor: ' + (telling[soort] || 0));
  assert.ok(telling.volledig > telling.anders, 'volledig hoort de gewone uitkomst te zijn');
});

test('een onzekere knoop loopt vaker anders dan een zekere', () => {
  const deel = (sleutel) => {
    let anders = 0;
    for (let i = 0; i < 400; i++) if (O.uitkomst('p' + i, sleutel) === 'anders') anders++;
    return anders / 400;
  };
  const zeker = deel('horeca.automatisering'), onzeker = deel('horeca.concept');
  assert.ok(O.BOOM['horeca.concept'].onzeker, 'conceptinnovatie hoort onzeker te zijn');
  assert.ok(onzeker > zeker * 1.8, 'onzeker: ' + onzeker.toFixed(2) + ' tegen zeker ' + zeker.toFixed(2));
});

test('gedeeltelijk halveert ook de keerzijde', () => {
  /* Anders is het geen andere uitkomst maar een straf: minder capaciteit tegen
     dezelfde extra vaste lasten. */
  const vol = O.effectVan('p', 'horeca.automatisering', 'volledig');
  const half = O.effectVan('p', 'horeca.automatisering', 'gedeeltelijk');
  assert.ok(half.perMedewerker < vol.perMedewerker, 'de winst wordt kleiner');
  assert.ok(half.vast < vol.vast, 'en de rekening ook');
  assert.ok(half.vast > 1, 'maar hij blijft een rekening');
});

test('anders levert een echte uitvinding op, uit je eigen boom', () => {
  /* De vervanging is het WERKELIJKE effect van een ander pad in dezelfde sector,
     verzwakt. Een eerdere versie verhuisde het GETAL van je eigen pad naar een
     ander veld, en 1,35 op de capaciteit werd zo 1,35 op de vraag -- een
     vraagsprong die geen enkele bedoelde knoop geeft. De velden staan niet op
     dezelfde schaal, dus een getal verhuizen is geen vertaling. */
  for (const sleutel of O.KNOPEN) {
    if (O.BOOM[sleutel].pad === 'stam') continue;
    const e = O.effectVan('p3', sleutel, 'anders');
    const sector = O.BOOM[sleutel].sector;
    for (const [veld, f] of Object.entries(e)) {
      /* NOOIT STERKER DAN WAT DE BOOM ZELF KENT. Zwakker mag: het veld waarop
         je mikte wordt bij "anders" juist afgezwakt. Wat niet mag is een
         uitkomst BUITEN de band waarop de boom geijkt is -- dat is precies wat
         er gebeurde toen de vervanging het GETAL van je eigen pad overnam en
         1,35 op de capaciteit 1,35 op de vraag werd. */
      const grenzen = O.SECTORLIJST.flatMap(s => O.PADEN
        .map(pad => (O.BOOM[s + '.' + pad].effect || {})[veld]).filter(x => typeof x === 'number'));
      const onder = Math.min(1, ...grenzen), boven = Math.max(1, ...grenzen);
      assert.ok(f >= onder - 1e-9 && f <= boven + 1e-9,
        sleutel + ' gaf via "anders" ' + veld + ' = ' + f.toFixed(3) +
        ', sterker dan alles wat de boom zelf kent (' + onder.toFixed(2) + '..' + boven.toFixed(2) + ')');
    }
    assert.ok(sector, sleutel + ' hoort een sector te hebben');
  }
});

test('bij anders komt het bedoelde veld er bekaaid vanaf', () => {
  const bedoeld = O.plusVeld('horeca.automatisering');
  const vol = O.effectVan('p', 'horeca.automatisering', 'volledig')[bedoeld];
  const anders = O.effectVan('p', 'horeca.automatisering', 'anders')[bedoeld];
  assert.ok(anders < vol, 'waar je op mikte levert minder op');
  assert.ok(Math.abs(anders - 1) < Math.abs(vol - 1) * 0.5, 'en wel duidelijk minder');
  // maar er komt wel IETS uit: een veld dat je niet zocht
  const e = O.effectVan('p', 'horeca.automatisering', 'anders');
  const extra = Object.keys(e).filter(veld => !(veld in O.BOOM['horeca.automatisering'].effect));
  assert.ok(extra.length, 'er hoort een ander veld bij te komen');
});

test('de uitkomst staat op het onderzoek en op het scherm', () => {
  const { m, p, st } = opstelling();
  const o = tot(m, p, 'anna', O.STAM);
  assert.ok(['volledig', 'gedeeltelijk', 'anders'].includes(o.uitkomst), 'uitkomst: ' + o.uitkomst);
  assert.ok(o.effect && Object.keys(o.effect).length, 'en het werkelijke effect staat erbij');
  const k = m.eco.zicht(p, st, 'anna').onderzoek.boom.find(x => x.sleutel === O.STAM);
  assert.equal(k.uitkomst, o.uitkomst, 'de speler ziet hoe het uitpakte');
  assert.deepEqual(k.werkelijk, o.effect, 'en wat het bij hem werd');
  assert.deepEqual(k.effect, O.BOOM[O.STAM].effect, 'naast wat het bedoelde');
});

test('wat er op het pand landt is de uitkomst van deze speler', () => {
  const { m, p, st, A } = opstelling();
  const o = tot(m, p, 'anna', O.STAM);
  const r = m.eco.zet(p, 'anna', { actie: 'onderzoek-uitrollen', sleutel: O.STAM, vestiging: A.id });
  assert.ok(r.ok, r.error);
  assert.deepEqual(A.techEffect, O.techEffect([O.STAM], { [O.STAM]: o.effect }),
    'de vermenigvuldigers komen uit wat het bij HAAR werd, niet uit de tabel');
  assert.equal(r.uitkomst, o.uitkomst);
});

/* ================= 6. kennis van het bedrijf, toepassing per pand ============ */

test('uitvinden is niet hetzelfde als gebruiken', () => {
  const { m, p, st, A } = opstelling();
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('boulevard', 1).id, sector: 'horeca', omvang: 90, naam: 'Tweede' });
  const tweede = st.vestigingen.anna[1];
  tot(m, p, 'anna', O.STAM);
  assert.deepEqual(A.tech || [], [], 'het draait nog nergens');
  const kas = st.geld.anna;
  const r = m.eco.zet(p, 'anna', { actie: 'onderzoek-uitrollen', sleutel: O.STAM, vestiging: A.id });
  assert.ok(r.ok, r.error);
  /* De uitrol is een deel van de bouwsom en geen vast bedrag, dus hij verschilt
     per pand: met een vast bedrag hing de terugverdientijd aan de MAAT van de
     zaak, en rolde het toernooi nul keer iets uit. */
  assert.equal(r.kosten, O.uitrolkosten(A, O.STAM));
  assert.ok(r.kosten > 0, 'en dat is een echt bedrag');
  assert.equal(Math.round(kas - st.geld.anna), r.kosten, 'uitrollen kost geld');
  assert.deepEqual(tweede.tech || [], [], 'en het tweede pand heeft er nog niets aan');
  const kas2 = st.geld.anna;
  const r2 = m.eco.zet(p, 'anna', { actie: 'onderzoek-uitrollen', sleutel: O.STAM, vestiging: tweede.id });
  assert.ok(r2.ok, r2.error);
  assert.equal(Math.round(kas2 - st.geld.anna), r2.kosten, 'elke vestiging kost opnieuw');
  assert.ok(r2.kosten > r.kosten, 'en een groter pand kost meer');
  assert.equal(m.eco.zet(p, 'anna', { actie: 'onderzoek-uitrollen', sleutel: O.STAM, vestiging: A.id }).status, 409);
});

test('uitrollen wat je niet hebt uitgevonden kan niet', () => {
  const { m, p, A } = opstelling();
  const r = m.eco.zet(p, 'anna', { actie: 'onderzoek-uitrollen', sleutel: 'horeca.energie', vestiging: A.id });
  assert.equal(r.status, 409);
  assert.match(r.error, /nog niet uitgevonden/);
});

/* ================= 7. investeren is vernietigend, en maakt nooit kas ======== */

test('onderzoeken zonder toepassen kost precies wat je erin stopt en levert niets op', () => {
  const { meet, EXACT } = require('../scripts/magnaat-pomp');
  const r = meet('onderzoekZonderUitrol', 12);
  assert.ok(Math.abs(r.verschil) <= EXACT,
    'kennis die je niet toepast verandert geen enkel getal, maar er staat ' + Math.round(r.verschil));
});

test('het afronden van een onderzoek zet nooit geld op een rekening', () => {
  /* DE WET, en hij is met een enkele meting te controleren: op de maand dat een
     onderzoek klaar komt hoort de kas ALLEEN met de gewone posten te bewegen.
     Geen researchComplete die een bedrag bijschrijft. */
  const { m, p, st } = opstelling();
  const r = m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: O.STAM, budget: O.BOOM[O.STAM].kosten });
  let maandVanAfronding = null;
  for (let i = 0; i < 30 && !maandVanAfronding; i++) {
    const kasVoor = st.geld.anna;
    maand(m, p, 1);
    const o = st.onderzoek.find(x => x.id === r.id);
    const regels = st.laatste.anna.regels;
    const som = regels.reduce((n, x) => n + (x.resultaat || 0), 0);
    assert.ok(Math.abs((st.geld.anna - kasVoor) - som) < 1.5,
      'de kas bewoog met ' + Math.round(st.geld.anna - kasVoor) + ' terwijl de regels ' +
      Math.round(som) + ' zeggen');
    if (o.status === 'klaar') maandVanAfronding = st.maand;
  }
  assert.ok(maandVanAfronding, 'het onderzoek werd niet af');
});

test('halverwege stoppen kost je wat je erin hebt gestopt', () => {
  const { m, p, st } = opstelling();
  const r = m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: O.STAM, budget: 1200 });
  maand(m, p, 2);
  const o = st.onderzoek.find(x => x.id === r.id);
  const besteed = o.besteed, half = o.voortgang;
  assert.ok(besteed > 0 && half > 0 && half < 1, 'er is echt geld in gegaan: ' + besteed);
  assert.ok(m.eco.zet(p, 'anna', { actie: 'onderzoek-budget', id: r.id, stoppen: true }).ok);
  maand(m, p, 4);
  assert.equal(o.status, 'gestaakt', 'een gestaakt onderzoek loopt niet door');
  assert.equal(o.besteed, besteed, 'en het kost ook niets meer');
  assert.equal(o.voortgang, half, 'en boekt geen voortgang meer');
  assert.equal(st.laatste.anna.regels.filter(x => x.soort === 'onderzoek').length, 0,
    'en staat niet meer op het maandoverzicht');
  const weer = m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: O.STAM, budget: 1200 });
  assert.ok(weer.ok, weer.error);
  assert.equal(st.onderzoek.find(x => x.id === weer.id).voortgang, 0, 'van voren af aan');
});

test('de zelffinancierende lus bestaat niet', () => {
  /* onderzoek -> hogere waardering -> grotere lening -> onderzoek -> ...
     De waardering mag stijgen van wat een bedrijf VERDIENT, en van niets anders.
     Twee mutaties zijn hier langs gekomen en allebei gevangen: een bedrag per
     uitvinding bij de waardering, en een waarderingsfactor die met de techniek
     meeloopt. */
  const { meet } = require('../scripts/magnaat-pomp');
  assert.equal(meet('onderzoekslus', 24).klacht, null);
});

test('je kunt nooit meer lenen tegen een pand dan het waard is', () => {
  const { meet } = require('../scripts/magnaat-pomp');
  assert.equal(meet('onderpandspiraal', 24).klacht, null);
});

/* ================= 8. de subsidie is een overdracht ================= */

test('een subsidie komt uit de pot en niet in de kas', () => {
  const { m, p, st } = opstelling();
  maand(m, p, 3);
  const r = m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: O.STAM, budget: 2000 });
  const kasVoor = st.geld.anna, potVoor = st.foundation.lokaal;
  const sub = m.eco.zet(p, 'anna', { actie: 'onderzoek-subsidie', id: r.id });
  assert.ok(sub.ok, sub.error);
  assert.equal(st.geld.anna, kasVoor, 'een subsidie is geen bijschrijving');
  assert.equal(Math.round(potVoor - st.foundation.lokaal), sub.subsidie, 'hij komt uit de pot');
  assert.equal(m.eco.zet(p, 'anna', { actie: 'onderzoek-subsidie', id: r.id }).status, 409, 'een keer');
});

test('wat er van een subsidie overblijft gaat terug naar de pot', () => {
  const { m, p, st } = opstelling();
  maand(m, p, 3);
  const r = m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: O.STAM, budget: 1000 });
  const sub = m.eco.zet(p, 'anna', { actie: 'onderzoek-subsidie', id: r.id });
  assert.ok(sub.ok, sub.error);
  const potNa = st.foundation.lokaal;
  const stop = m.eco.zet(p, 'anna', { actie: 'onderzoek-budget', id: r.id, stoppen: true });
  assert.ok(stop.ok);
  assert.equal(stop.terugNaarPot, sub.subsidie, 'alles wat nog niet besteed was gaat terug');
  assert.equal(Math.round(st.foundation.lokaal - potNa), sub.subsidie);
});

test('de geldpompkeuring op de subsidie klopt', () => {
  const { meet } = require('../scripts/magnaat-pomp');
  assert.equal(meet('subsidiestroom', 12).klacht, null);
});

/* ================= 9. deterministisch ================= */

test('deterministisch is niet hetzelfde als voorspelbaar', () => {
  const k = O.BOOM[O.STAM];
  const trekkingen = [];
  for (let mnd = 0; mnd < 60; mnd++) trekkingen.push(O.voortgang('p', mnd, O.STAM, k.kosten));
  const laag = Math.min(...trekkingen), hoog = Math.max(...trekkingen);
  assert.ok(hoog / laag > 1.3, 'de ene maand loopt harder dan de andere: ' + laag + ' .. ' + hoog);
  assert.ok(laag > 0, 'een maand kost nooit voortgang');
  assert.ok(hoog < 2 / k.duur, 'en een meevaller is geen sprong');
  const zelfdeMaand = O.KNOPEN.map(s => O.voortgang('p', 7, s, O.BOOM[s].kosten) * O.BOOM[s].duur);
  assert.ok(new Set(zelfdeMaand.map(x => x.toFixed(6))).size > 1,
    'twee onderzoeken in dezelfde maand delen hun geluk niet');
  assert.notEqual(O.voortgang('p1', 7, O.STAM, k.kosten), O.voortgang('p2', 7, O.STAM, k.kosten));
});

test('tien maanden in een keer geeft dezelfde voortgang en dezelfde uitkomst als tien los', () => {
  const draai = (stappen) => {
    const { m, p, st } = opstelling('zelfde');
    m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: O.STAM, budget: 2000 });
    for (const n of stappen) maand(m, p, n);
    const o = st.onderzoek[0];
    return { voortgang: o.voortgang, status: o.status, uitkomst: o.uitkomst, effect: o.effect };
  };
  const ineens = draai([10]);
  const los = draai([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(los, ineens, 'de klok rekent bij; hij tikt niet');
});

test('meer budget gaat sneller, maar haasten kost meer dan het oplevert', () => {
  const k = O.BOOM[O.STAM];
  const zuinig = O.voortgang('p', 5, O.STAM, k.kosten * 0.5);
  const normaal = O.voortgang('p', 5, O.STAM, k.kosten);
  const kwistig = O.voortgang('p', 5, O.STAM, k.kosten * 100);
  assert.ok(normaal > zuinig, 'meer betalen gaat sneller');
  assert.ok(kwistig > normaal);
  /* HET PLAFOND OVER ALLE TREKKINGEN, niet over een. Deze toets mat eerst een
     enkele maand, en juist in die maand viel de meevaller onder de een -- dus
     overleefde het wegnemen van de begrenzing hem gewoon. */
  let hoogste = 0;
  for (let mnd = 0; mnd < 240; mnd++)
    for (const sleutel of O.KNOPEN)
      hoogste = Math.max(hoogste, O.voortgang('p', mnd, sleutel, O.BOOM[sleutel].kosten * 100)
        * O.BOOM[sleutel].duur);
  assert.ok(hoogste <= 2 + 1e-9, 'hoogstens twee keer het normale tempo: ' + hoogste.toFixed(3));
  assert.ok(hoogste > 1.9, 'en dat plafond wordt ook echt geraakt, anders meet dit niets');
  /* EN DE TOTAALPRIJS LOOPT OP. Zonder die kromming halveert dubbel betalen de
     looptijd voor dezelfde totaalprijs, en dan is de budgetknop geen keuze. */
  const maanden = (factor) => {
    let v = 0, n = 0;
    while (v < 1 && n < 200) { v += O.voortgang('p', n, 'horeca.automatisering', O.BOOM['horeca.automatisering'].kosten * factor); n++; }
    return n;
  };
  const kost = (factor) => maanden(factor) * O.BOOM['horeca.automatisering'].kosten * factor;
  assert.ok(maanden(2) < maanden(1), 'dubbel betalen gaat wel sneller');
  assert.ok(kost(2) > kost(1), 'maar het kost in totaal meer: ' + kost(1) + ' -> ' + kost(2));
});

test('welke kant een concurrent op onderzoekt, zie je niet', () => {
  const { m, p, st } = opstelling();
  maand(m, p, 2);
  m.eco.zet(p, 'anna', { actie: 'onderzoek-starten', sleutel: O.STAM, budget: 4321 });
  const boris = JSON.stringify(m.eco.zicht(p, st, 'boris'));
  assert.ok(!/4321/.test(boris), 'boris hoort het budget niet te zien');
  assert.equal(m.eco.zicht(p, st, 'boris').onderzoek.bezig, 0, 'en niet dat er iets loopt');
});

test('onderzoeken is een vrije actie', () => {
  const d = maakMagnaat().spel;
  for (const naam of ['onderzoek-starten', 'onderzoek-budget', 'onderzoek-uitrollen', 'onderzoek-subsidie'])
    assert.ok(d.buitenBeurt.includes(naam), naam + ' hoort buiten je beurt te mogen');
});
