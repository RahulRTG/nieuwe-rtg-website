/* ============================================================================
   DE ADVOCATE ALS LEZER: EEN AFLOPENDE TOESTEMMING IS EEN TERMIJN

   HDI.md par. 7 regel 7. Het Consent Center weet sinds par. 7.6 welke
   toestemmingen een einddatum hebben; de Control Tower (kern/levensgraaf/
   termijnen.js) verzamelt alle datums die op een mens afkomen. Die twee stonden
   los van elkaar, dus een machtiging die volgende week verloopt stond in geen
   enkel overzicht dat je opent zonder er al aan te denken.

   VIER ZINNEN:

     1. een venster MET datum wordt een termijnknoop;
     2. een venster ZONDER datum wordt er geen -- er wordt geen datum verzonnen;
     3. de knoop is BESLOTEN en van het lid: een bureau of Rechterhand ziet hem
        nooit, want de naam van de ontvanger staat erin;
     4. de bedrading staat er echt: kernlaag3b geeft de vraag mee, en graaf.js
        geeft hem door aan de bronnen.

   HOE DIT IS GETOETST, EN WAT DAT NIET DEKT. Zin 1 tot en met 3 draaien op de
   graaf zelf met een GESTUURDE toestemmingenvraag: de bron krijgt precies de
   rijen die hij in productie ook zou krijgen, en de uitkomst is de echte
   graaf-uitvoer inclusief de `deel`-poort. Wat hier NIET in zit is een ronde
   langs een draaiende server met een echte machtiging: die vraagt een tweede lid
   met een LEVENDE codenaam, en die roteert -- de codenaam uit de registratie
   wordt door `keyVanCodenaam` niet gevonden. Dat is een tekort van de
   proefopstelling en geen oordeel over de route, en het staat hier omdat
   "ongemeten" iets anders is dan "werkt niet" (zelfde regel als `nietBeproefd`
   in de herstelproef). Zin 4 dekt daarom de bedrading op de BRON, zodat een
   losgeraakte draad alsnog opvalt.

   MET EEN MUTATIE NAGETROKKEN:
     - de twee datumgrendels eruit: RAAK op 1, 2 en 3;
     - `deel: 'lid'` naar 'kantoor' en de gevoeligheid omlaag: RAAK op 3;
     - de terugval van de poort weer naar `KRING.lid`: RAAK op 3;
     - `toestemmingen` uit de ctx van graaf.js halen: RAAK op 1, 3 en 4.

   EEN MUTATIE DIE NIET BEET, en waarom dat leerzaam was: alleen de
   `t.soort !== 'venster'`-controle uitzetten deed niets, want `isDatum(t.tot)`
   ving dezelfde rijen daarna alsnog. Twee grendels die elkaar dekken is hier
   geen dubbeling maar de bedoeling -- een laag die zich `venster` noemt zonder
   datum, en een laag die een datum meestuurt zonder zich zo te noemen, zijn
   allebei fout en worden allebei geweigerd.

   Draai los: node --test test/advocaat-lezer.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const BRON = require('../server/kern/levensgraaf/bronnen-toestemming');

/* De rijen zoals kern/consent.js ze levert: vier lagen met een venster, vijf
   zonder. Hier staan er twee van elk soort, zodat zin 1 en 2 elkaar dekken. */
const morgen = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
const RIJEN = {
  toestemmingen: [
    { laag: 'rtgid-machtiging', id: 'm1', wie: 'Zeearend 1193', wat: 'Mag namens u inloggen bij Gemeente',
      richting: 'doet', intrekbaar: true, doel: 'Zodat iemand die u vertrouwt iets voor u kan regelen.',
      termijn: { soort: 'venster', tot: morgen, uitleg: 'Loopt tot ' + morgen + '.' } },
    { laag: 'care-intake', id: 'i1', wie: 'Huisartsenpraktijk De Linden', wat: 'Uw medische context',
      richting: 'ziet', intrekbaar: true, doel: 'Zodat deze zorgaanbieder u kan behandelen.',
      termijn: { soort: 'venster', tot: morgen, uitleg: 'Loopt tot ' + morgen + '.' } },
    { laag: 'zorgprofiel', id: 'profiel', wie: 'Zaken waar u bestelt', wat: 'allergenen, dieet',
      richting: 'ziet', intrekbaar: true, doel: 'Zodat een keuken weet waar u niet tegen kunt.',
      termijn: { soort: 'zolang-het-staat', tot: null, uitleg: 'Er zit geen einddatum op.' } },
    { laag: 'toestel', id: 't1', wie: 'Weegschaal', wat: 'Schrijft dagmetingen weg',
      richting: 'schrijft', intrekbaar: true, doel: 'Zodat uw metingen in uw dossier komen.',
      termijn: { soort: 'zolang-het-staat', tot: null, uitleg: 'Blijft schrijven tot u loskoppelt.' } }
  ]
};

/* De graaf, met een gestuurde toestemmingenvraag en zonder database: `dossier`
   levert een leeg lifestyle-dossier, dus wat eruit komt is UITSLUITEND van deze
   bron. Zo kan geen andere bron een zin per ongeluk groen houden. */
function graafMet(rijen) {
  const mod = require('../server/kern/levensgraaf/graaf')({
    db: { data: {} },
    vandaag: () => new Date().toISOString().slice(0, 10),
    paspoortVervalt: () => null,
    toestemmingen: () => rijen,
    dossier: () => ({}),
    bronnen: BRON
  });
  return mod;
}

test('1. een venster met een datum wordt een termijn', () => {
  const g = graafMet(RIJEN).graaf('KEY');
  const knopen = g.knopen.filter(k => k.bron === 'Toestemming');
  assert.equal(knopen.length, 2, 'de twee vensters MET datum horen een knoop te worden');
  const m = knopen.find(k => /Zeearend/.test(k.naam));
  assert.ok(m, 'de machtiging hoort erbij te staan, met de ontvanger in de naam');
  assert.equal(m.vervalt, morgen);
  assert.equal(m.vervaltWat, 'toestemming');
  assert.equal(m.soort, 'termijn');
});

test('2. een venster zonder datum wordt er geen', () => {
  const g = graafMet(RIJEN).graaf('KEY');
  const namen = g.knopen.filter(k => k.bron === 'Toestemming').map(k => k.naam).join(' | ');
  assert.ok(!/Weegschaal|Zaken waar u bestelt/.test(namen),
    'een toestemming die doorloopt tot u hem stopt heeft geen datum, en die wordt hier niet verzonnen');

  // en een venster dat zich venster noemt maar geen bruikbare datum draagt, ook niet
  const kaal = graafMet({ toestemmingen: [{ laag: 'rtgid-sessie', id: 's1', wie: 'Dienst',
    wat: 'gegevens', richting: 'ziet', termijn: { soort: 'venster', tot: null } }] }).graaf('KEY');
  assert.equal(kaal.knopen.filter(k => k.bron === 'Toestemming').length, 0);
});

test('3. de knoop verlaat de kring van het lid nooit', () => {
  const mod = graafMet(RIJEN);
  const g = mod.graaf('KEY');
  for (const k of g.knopen.filter(x => x.bron === 'Toestemming')) {
    assert.equal(k.deel, 'lid', 'een toestemmingsknoop hoort deel "lid" te dragen');
    assert.equal(k.gevoelig, 3, 'en gevoeligheid BESLOTEN (3)');
  }
  /* De poort zelf, en niet alleen het etiket: graafVoor() met een andere kring
     hoort er geen enkele terug te geven. De naam van de ontvanger staat in de
     knoop, dus "een datum zonder naam" is hier geen troost. */
  for (const kring of ['rechterhand', 'kantoor']) {
    const uit = mod.graafVoor('KEY', kring, g);
    const lek = (uit.knopen || []).filter(k => k.bron === 'Toestemming');
    assert.equal(lek.length, 0,
      'de kring "' + kring + '" ziet ' + lek.length + ' toestemmingsknoop(en); dat hoort er nul te zijn');
  }
  // en het lid zelf ziet ze wel, anders toetst het bovenstaande niets
  assert.equal(mod.graafVoor('KEY', 'lid', g).knopen.filter(k => k.bron === 'Toestemming').length, 2);

  /* EN EEN ONBEKENDE KRINGNAAM VALT NAAR DE VERSTE KIJKER. Deze regel is er
     gekomen doordat deze toets eerst 'bureau' gebruikte -- een naam die niet in
     KRING staat -- en het volledige ledenbeeld terugkreeg. Er was geen lek (de
     enige aanroeper geeft 'lid'), maar de terugval stond de verkeerde kant op:
     een typefout of een hernoemde kring gaf het beeld van het lid zelf. */
  assert.equal(mod.graafVoor('KEY', 'bureau', g).knopen.filter(k => k.bron === 'Toestemming').length, 0,
    'een onbekende kringnaam hoort NIETS te zien; valt hij naar "lid" terug, dan is de poort fail-open');
});

test('4. de bedrading staat er: de vraag wordt meegegeven en doorgegeven', () => {
  const lees = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  assert.match(lees('server/opzet/kernlaag3b.js'), /toestemmingen: \(key\) => \(kern\.consentVan/,
    'kernlaag3b hoort de toestemmingenvraag mee te geven aan de levensgraaf');
  assert.match(lees('server/kern/levensgraaf/graaf.js'), /\{ key, db, paspoortVervalt, toestemmingen \}/,
    'graaf.js hoort de vraag door te geven aan de bronnen; zonder dat levert de bron altijd niets op');
  assert.match(lees('server/kern/levensgraaf/bronnen.js'), /require\('\.\/bronnen-toestemming'\)/,
    'de bron hoort in de lijst te staan');
});
