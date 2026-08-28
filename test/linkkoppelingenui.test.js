/* HET SCHERM "MIJN KOPPELINGEN" (public/shared/linkkoppelingen.js) -- LINK.md
   par. 4, stap 6.

   Puur toetsbaar, en dat is met opzet: de dingen die dit scherm moet garanderen
   zijn met een klik niet te zien.

   - EEN BON VERDWIJNT NOOIT. Intrekken sluit een deur; het wist niet dat hij
     open is geweest (par. 3.6). Een lijst die alleen toont wat nog kan, is een
     schoonmaakknop met een logboek als naam.
   - WIE GEEN KNOP KRIJGT, KRIJGT EEN REDEN. Anders leest "hier staat niets" als
     "hier is niets gebeurd".
   - HET SCHERM BESLIST NIETS. Of er een weg terug is, komt van de server; dit
     bestand hoort dat niet zelf uit te rekenen.

   Draai los: node --test test/linkkoppelingenui.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const K = require('../public/shared/linkkoppelingen');

const NU = new Date().toISOString();
const ANTWOORD = {
  open: [{ id: 'abc123', handeling: 'geld.ontvangen',
    kaart: { wat: 'Betalen', velden: [{ naam: 'Bedrag', waarde: '€ 45,00' }] },
    tot: new Date(Date.now() + 90000).toISOString() }],
  bonnen: [
    { at: NU, type: 'persoon', intentie: 'contact.verbinden', vorm: 'vast', naar: 'X', naarNaam: 'Gouden Panter',
      terug: { weg: '/api/member/connect/intrek', veld: 'key', waarde: 'X', tekst: 'Verzoek intrekken' } },
    { at: NU, type: 'capability', intentie: 'geld.ontvangen', vorm: 'levend', naar: 'Y', naarNaam: 'Zilveren Vos',
      reden: 'Dit is gebeurd. Een betaling draai je hier niet terug.' }
  ],
  partijen: [{ id: 'X', naam: 'Gouden Panter', aantal: 2, laatst: NU, via: ['vast'] }],
  nietBewaard: 0
};

test('drie lijsten, en ze beantwoorden drie verschillende vragen', () => {
  const b = K.opbouw(ANTWOORD);
  assert.equal(b.open.length, 1, 'wat staat er open');
  assert.equal(b.bonnen.length, 2, 'wat is er gebeurd');
  assert.equal(b.partijen.length, 1, 'met wie');
  const h = K.markeer(b);
  for (const kop of ['Nu open', 'Wat er gebeurde', 'Met wie'])
    assert.ok(h.includes(kop), 'het kopje "' + kop + '" hoort erop te staan');
});

test('een bon zonder weg terug toont zijn reden, en verdwijnt niet', () => {
  const b = K.opbouw(ANTWOORD);
  const betaling = b.bonnen.find(x => x.wat === 'Betaald');
  assert.ok(betaling, 'de betaling staat er gewoon');
  assert.equal(betaling.terug, null);
  assert.match(betaling.reden, /niet terug/i);
  const h = K.markeer(b);
  assert.match(h, /Dit is gebeurd\. Een betaling draai je hier niet terug\./);
  assert.equal((h.match(/data-bon=/g) || []).length, 1, 'precies een knop terug, en die hoort bij het verzoek');
});

test('de knop draagt de weg van de SERVER en niet een verzonnen weg', () => {
  /* Het scherm mag niet zelf bedenken waar iets heen moet: dan toont het vroeg
     of laat een knop die weigert. De weg komt uit het antwoord. */
  const bron = fs.readFileSync(path.join(__dirname, '..', 'public/shared/linkkoppelingen.js'), 'utf8');
  const code = bron.replace(/\/\*[\s\S]*?\*\//g, '');
  const paden = [...code.matchAll(/'(\/api\/[^']+)'/g)].map(m => m[1]);
  assert.deepEqual(paden, ['/api/link/cap/trek'],
    'alleen het intrekken van een eigen code mag hier vastliggen; de rest komt van de server');
});

test('een handeling die dit scherm nog niet kent, valt niet weg', () => {
  const vreemd = K.opbouw({ bonnen: [{ at: NU, intentie: 'reis.delen', naarNaam: 'Iemand' }] });
  assert.equal(vreemd.bonnen.length, 1);
  assert.equal(vreemd.bonnen[0].wat, 'reis.delen',
    'liever een regel die technisch leest dan een regel die verdwijnt');
});

test('een lege stand zegt wat er is, en niet niets', () => {
  const h = K.markeer(K.opbouw({}));
  assert.match(h, /geen code van je open/i);
  assert.match(h, /nog niets met een code gedaan/i);
});

test('een afgekapte staart wordt geteld en niet stilgezwegen', () => {
  const h = K.markeer(K.opbouw({ ...ANTWOORD, nietBewaard: 7 }));
  assert.match(h, /7 oudere regels zijn niet bewaard/);
});

test('tekst uit het antwoord wordt ontsmet -- ook in een ATTRIBUUT', () => {
  const stout = { bonnen: [{ at: NU, intentie: 'contact.verbinden', naarNaam: '<img src=x onerror=alert(1)>' }] };
  const h = K.markeer(K.opbouw(stout));
  assert.ok(!h.includes('<img'), 'geen ruwe HTML uit een antwoord');
  assert.match(h, /&lt;img/);

  /* DE TWEEDE SINK, EN DIE WAS ONGETOETST. Een openstaande code zet zijn id in
     een attribuut: data-trek="<id>". Wat er tussen die aanhalingstekens komt,
     komt van de server, dus wie daar een " in krijgt hangt er zijn eigen
     attributen achter -- geen < of > nodig.

     Deze toets stond er wel, maar keek alleen naar <. Het aanhalingsteken uit
     de ontsmetter halen liet hem gewoon groen: gevoelig voor OF er ontsmet
     wordt, niet voor WAT. Nu allebei. */
  const attr = K.markeer(K.opbouw({ open: [{ id: 'x" onmouseover="alert(1)', wat: 'Vraagcode', tot: NU }] }));
  assert.ok(!/data-trek="[^"]*"\s+onmouseover/.test(attr), 'een " uit het antwoord breekt niet uit het attribuut');
  assert.match(attr, /data-trek="x&quot;/, 'hij staat er ontsmet in, en niet weggelaten');
});

test('de vormtaal komt uit de tokenlaag: register, rail en tijden', () => {
  /* Geen eigen lijstopmaak, maar de componenten die ONTWERP.md al heeft. Een
     scherm met zijn eigen tabelstijl is hoe een huisstijl in drie apps uiteen
     gaat lopen. */
  const h = K.markeer(K.opbouw(ANTWOORD));
  assert.match(h, /class="rtg-register"/);
  assert.match(h, /class="rij rtg-rail" data-sig="aandacht"/, 'een openstaande code draagt de signaalrail');
  assert.match(h, /class="rek wanneer"/, 'tijden in de tijdkolom van het register');
  const bron = fs.readFileSync(path.join(__dirname, '..', 'public/shared/linkkoppelingen.js'), 'utf8');
  assert.ok(!/#[0-9a-fA-F]{6}\b/.test(bron.replace(/\/\*[\s\S]*?\*\//g, '')),
    'geen eigen kleuren in het scherm; die horen in rtg-ontwerp.css');
});
