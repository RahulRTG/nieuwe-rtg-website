/* DE BEDRIJFSONTWERPER EN DE MALL-BOUWER: de AI die meedenkt, en nergens over
   beslist.

   Twee opdrachten, één laag, en met opzet dezelfde grenzen:

     ontwerp -> meedenken over het IDEE, in de fase waarin er nog niets vaststaat
     mall    -> meeschrijven aan de MALL-PAGINA van een zaak die al bestaat

   HET MODEL KRIJGT ALLEEN WAT ER ECHT STAAT. De prompt wordt gebouwd uit de
   eigen intake, de eigen kansverkenning en het eigen mallprofiel -- geen
   marktcijfers die wij niet hebben, geen concurrenten die wij niet kennen. Wat
   niet is ingevuld, staat als ONBEKEND in de prompt, zodat het model daarop kan
   doorvragen in plaats van het in te vullen.

   HET MODEL SCHRIJFT NIETS WEG. Geen enkele opdracht hier zet iets in de
   database: de uitkomst is tekst die de ondernemer zelf overneemt. Dat is geen
   voorzichtigheid maar het ontwerp -- een AI die zijn eigen voorstel opslaat,
   maakt van een suggestie een feit, en niemand weet later meer wie wat bedacht.
   Zelfde regel als bij de agent (kern/agent.js): een voorstel wacht op een mens.

   DRIE DINGEN DIE DE AI NOOIT MAG ZEGGEN, en die hier in de systeemprompt
   staan én in de uitwijk:

   1. GEEN TOEGANG BELOVEN. Lifestyle en Business gaan uitsluitend na menselijke
      goedkeuring; de AI mag daar niets over toezeggen. Dat is een merkregel en
      geen instelling.
   2. GEEN ECHTE MERKEN ALS PARTNER. Geen hotelketen, geen luchtvaartmaatschappij
      als bevestigde partner opvoeren, en nooit claimen dat een boeking is
      verwerkt.
   3. GEEN JURIDISCH OF FISCAAL ADVIES ALS ZEKERHEID. Een rechtsvorm kiezen heeft
      gevolgen die wij niet overzien; het model mag afwegingen geven en geen
      besluit.

   ZONDER SLEUTEL KOMT ER GEEN LEEG SCHERM. Dan valt de laag terug op een
   antwoord dat uit de EIGEN data is samengesteld -- geen verzonnen tekst, en het
   draagt `demo: true` zodat een scherm het verschil kan tonen. Een demostand die
   doet alsof er een model meekeek, is erger dan geen demostand. */
'use strict';

const { RAHUL_LEAD } = require('../rahul');

const MODEL = 'claude-opus-4-8';
const MAX_TOKENS = 700;
const MAX_VRAAG = 500;

/* De drie merkregels, letterlijk in de prompt. Ze staan hier als LIJST zodat de
   uitwijk hieronder dezelfde grenzen kan noemen; twee keer opschrijven zou
   betekenen dat er een keer eentje mist. */
const GRENZEN = [
  'Je belooft NOOIT toegang tot RTG. Lifestyle Pass en Business Pass gaan uitsluitend na goedkeuring door een mens; je mag daar niets over toezeggen.',
  'Je noemt NOOIT een echt hotel-, luchtvaart- of ander merk als bevestigde partner van RTG, en je claimt nooit dat een boeking of betaling is verwerkt.',
  'Je geeft afwegingen, geen besluiten, en zeker geen juridisch of fiscaal advies als zekerheid. Bij een rechtsvorm noem je de gevolgen en verwijs je naar de KvK of een adviseur.'
];

const OPDRACHTEN = {
  ontwerp: {
    label: 'Bedrijfsontwerper',
    wat: 'Meedenken over uw idee: wat u verkoopt, aan wie, en waarom bij u.',
    rol: 'je bent de bedrijfsontwerper op RTG. Je helpt iemand zijn idee scherp krijgen. ' +
      'Stel hoogstens drie vragen over wat er ontbreekt, en geef daarna een concreet voorstel ' +
      'in korte alinea\'s. Geen opsomming van open deuren.'
  },
  mall: {
    label: 'Mall-bouwer',
    wat: 'Meeschrijven aan uw pagina in de RTG Mall.',
    rol: 'je schrijft mee aan de Mall-pagina van deze zaak. Schrijf ingetogen en zeker, ' +
      'nooit wervend of met uitroeptekens. Geen superlatieven, geen kunstmatige urgentie. ' +
      'Lever tekst die de ondernemer letterlijk kan overnemen.'
  }
};

/* Wat er ontbreekt heet ONBEKEND en niet leeg: een leeg veld in een prompt leest
   het model als "niet van toepassing" en vult het vrolijk zelf in. */
const feit = (label, waarde) => label + ': ' + (waarde === null || waarde === undefined ||
  waarde === '' ? 'ONBEKEND' : String(waarde).slice(0, 200));

module.exports = ({ anthropic, schoon, magAi }) => {
  const scho = (v, n) => (schoon ? schoon(v, n) : String(v == null ? '' : v).trim().slice(0, n));

  /* De feiten uit de eigen intake. Alleen wat er staat; zie de kop. */
  function feitenVanOntwerp(o, verk) {
    const i = (o && o.intake) || {};
    const p = i.persoon || {}, idee = i.idee || {};
    const uit = [
      feit('Werktitel', o && o.naam),
      feit('Wat verkoopt hij', idee.wat),
      feit('Voor wie', idee.doelgroep),
      feit('Waarom bij hem', idee.onderscheid),
      feit('Branche', idee.branche),
      feit('Plaats', idee.plaats),
      feit('Verkoopmodel', idee.verkoopmodel),
      feit('Prijs per verkoop', idee.prijs),
      feit('Kostprijs', idee.kostprijs),
      feit('Vaste lasten per maand', idee.vasteLasten),
      feit('Uren per week', p.urenPerWeek),
      feit('Ervaring in jaren', p.ervaringJaren),
      feit('Startkapitaal', p.startkapitaal)
    ];
    /* De eigen kansverkenning en stress test reizen mee als ze er zijn: het
       model hoeft niet te raden wat wij al hebben uitgerekend, en mag er ook
       niet tegenin gaan zonder het te weten. */
    if (verk && verk.kans && verk.kans.ok && verk.kans.score !== null) {
      uit.push(feit('Onze eigen kansverkenning (0-100)', verk.kans.score));
    }
    if (verk && verk.stress && verk.stress.ok) {
      const blok = (verk.stress.bevindingen || []).filter(b => b.zwaarte === 'blokkerend');
      uit.push(feit('Blokkerende bevindingen uit onze stress test',
        blok.length ? blok.map(b => b.kop).join('; ') : 'geen'));
    }
    return uit;
  }

  function feitenVanMall(o, mall, beeld) {
    const uit = [
      feit('Naam van de zaak', beeld && beeld.naam),
      feit('Rechtsvorm', beeld && beeld.rechtsvorm && beeld.rechtsvorm.label),
      feit('Fase', beeld && beeld.fase)
    ];
    if (mall) {
      uit.push(feit('Pagina ingevuld (procent)', mall.percentage));
      uit.push(feit('Wat er nog ontbreekt',
        (mall.open || []).map(x => x.label).join('; ') || 'niets'));
      uit.push(feit('Onderdelen die deze zaak heeft',
        (mall.onderdelen || []).map(x => x.label).join('; ')));
    }
    return uit;
  }

  /* De systeemprompt. RAHUL_LEAD voorop, zodat het karakter van het huis geldt;
     daarna de rol, daarna de grenzen, daarna de feiten. In die volgorde, want
     wat later komt weegt zwaarder bij een botsing. */
  function systeem(opdracht, feiten) {
    const o = OPDRACHTEN[opdracht];
    return RAHUL_LEAD + o.rol + '\n\nHARDE GRENZEN:\n- ' + GRENZEN.join('\n- ') +
      '\n\nWAT WIJ WETEN (ONBEKEND betekent: niet ingevuld, vraag ernaar in plaats van invullen):\n' +
      feiten.join('\n');
  }

  /* De uitwijk. Uit de eigen feiten samengesteld en nooit verzonnen -- en hij
     zegt zelf dat er geen model meekeek. */
  function uitwijk(opdracht, feiten) {
    const ontbreekt = feiten.filter(f => f.endsWith('ONBEKEND')).map(f => f.split(':')[0]);
    const basis = opdracht === 'mall'
      ? 'Er is geen AI-sleutel ingesteld, dus er keek geen model mee. '
      : 'Er is geen AI-sleutel ingesteld, dus er keek geen model mee. ';
    return {
      demo: true,
      antwoord: basis + (ontbreekt.length
        ? 'Wat wij zelf zien: ' + ontbreekt.length + ' van de ' + feiten.length +
          ' punten staat nog open, namelijk ' + ontbreekt.slice(0, 6).join(', ') +
          '. Vul die eerst in -- ze bepalen samen wat er te ontwerpen valt.'
        : 'Alles wat wij nodig hebben staat ingevuld. Met een AI-sleutel denkt het model hierop mee; zonder sleutel is dit alles wat wij eerlijk kunnen zeggen.'),
      grenzen: GRENZEN
    };
  }

  /* De enige ingang. `magAi` is de bestaande poort (kern/aipoort.js): een gast
     komt er niet op, en die controle wordt hier niet nagebouwd. */
  async function ontwerp(req, opdracht, vraag, feiten) {
    if (!OPDRACHTEN[opdracht]) {
      return { status: 400, error: 'Onbekende opdracht.', opdrachten: Object.keys(OPDRACHTEN) };
    }
    if (magAi && !magAi(req)) {
      return { status: 403, error: 'Deze hulp is er voor leden met een echt account.' };
    }
    const v = scho(vraag, MAX_VRAAG);
    if (!v) return { status: 400, error: 'Stel een vraag of geef een opdracht.' };

    if (anthropic) {
      try {
        const r = await anthropic.messages.create({
          model: MODEL, max_tokens: MAX_TOKENS,
          system: systeem(opdracht, feiten),
          messages: [{ role: 'user', content: v }]
        });
        const t = ((r && r.content && r.content[0] && r.content[0].text) || '').trim();
        if (t) return { ok: true, opdracht, antwoord: t, demo: false, grenzen: GRENZEN,
          let: 'Dit is een voorstel en geen besluit. Er is niets opgeslagen; neem over wat u bruikbaar vindt.' };
      } catch (e) { /* val terug op de uitwijk hieronder */ }
    }
    return Object.assign({ ok: true, opdracht }, uitwijk(opdracht, feiten),
      { let: 'Dit is een voorstel en geen besluit. Er is niets opgeslagen; neem over wat u bruikbaar vindt.' });
  }

  return { ONTWERPER_OPDRACHTEN: OPDRACHTEN, ONTWERPER_GRENZEN: GRENZEN,
    ontwerp, feitenVanOntwerp, feitenVanMall };
};

module.exports.GRENZEN = GRENZEN;
module.exports.OPDRACHTEN = OPDRACHTEN;
module.exports.MODEL = MODEL;
