/* De vertaalkast: vertaalde interface die een herstart overleeft.

   Wat hier hard wordt gemaakt:
   - een vertaling die een keer is gemaakt, komt na een HERSTART terug zonder
     model (dat is de hele reden dat de kast bestaat);
   - een regel die gelijk is aan zijn bron wordt NIET bewaard -- dat is een
     mislukking die zich als antwoord voordoet;
   - de kast is begrensd en valt aan de oude kant af, dus hij kan niet lekken;
   - wat een lid TYPT komt er niet in: alleen een aanroeper die `bewaar: true`
     zegt vult de kast, en dat is uitsluitend /api/vertaal/ui;
   - een onschrijfbare map is geen fout, maar wordt ook niet verzwegen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { maakVertaalkast } = require('../server/lib/vertaalkast');

function tijdelijk() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vertaalkast-'));
}

test('een vertaling overleeft een herstart', () => {
  const dir = tijdelijk();
  const een = maakVertaalkast({ dir, venster: 0 });
  een.schrijf('ja', 'Boek deze reis', 'この旅行を予約する');
  een.leegNu();

  // een tweede kast is een tweede proces: hij heeft niets in het geheugen
  const twee = maakVertaalkast({ dir, venster: 0 });
  assert.equal(twee.lees('ja', 'Boek deze reis'), 'この旅行を予約する');
  assert.equal(twee.lees('ja', 'Nooit vertaald'), null, 'niet in de kast is null, geen lege string');
  assert.equal(twee.stand().schijf, true);
});

test('een regel gelijk aan zijn bron is geen vertaling en wordt niet bewaard', () => {
  const kast = maakVertaalkast({ dir: tijdelijk(), venster: 0 });
  assert.equal(kast.schrijf('de', 'Salon', 'Salon'), false);
  assert.equal(kast.lees('de', 'Salon'), null);
  assert.equal(kast.schrijf('de', 'Salon', 'Salon '), true, 'een echt andere waarde mag wel');
});

test('de kast is begrensd en laat de oudste vallen', () => {
  const kast = maakVertaalkast({ dir: tijdelijk(), maxPerTaal: 3, venster: 0 });
  for (let i = 1; i <= 5; i++) kast.schrijf('fr', 'bron' + i, 'trad' + i);
  assert.equal(kast.stand().regels, 3);
  assert.equal(kast.lees('fr', 'bron1'), null, 'de oudste is eruit gevallen');
  assert.equal(kast.lees('fr', 'bron5'), 'trad5');
});

test('een taalcode die geen taalcode is komt de kast niet in', () => {
  const kast = maakVertaalkast({ dir: tijdelijk(), venster: 0 });
  assert.equal(kast.schrijf('../../etc', 'a', 'b'), false);
  assert.equal(kast.lees('../../etc', 'a'), null);
  assert.equal(kast.stand().talen, 0);
});

test('zonder datamap draait de kast door, maar zegt dat hij niets bewaart', () => {
  const kast = maakVertaalkast({});
  assert.equal(kast.stand().schijf, false);
  kast.schrijf('es', 'Boeken', 'Reservar');
  assert.equal(kast.lees('es', 'Boeken'), 'Reservar', 'in het geheugen werkt hij gewoon');
});

test('alleen een aanroeper die bewaar zegt vult de kast', async () => {
  const i18n = require('../server/translate');
  const kast = maakVertaalkast({ dir: tijdelijk(), venster: 0 });
  i18n.setVertaalkast(kast);
  try {
    // het huiswoordenboek dekt nl->en zonder model; zonder `bewaar` mag dat
    // resultaat wel in het geheugen, maar niet op schijf.
    await i18n.translateBatch(['Boeken'], 'en');
    assert.equal(kast.stand().bewaard, 0, 'een gewone aanroeper schrijft niet in de kast');
  } finally { i18n.setVertaalkast(null); }
});

test('een UI-verzoek bewaart alleen bronregels die de broncontrole heeft toegelaten', async () => {
  const i18n = require('../server/translate');
  const kast = maakVertaalkast({ dir: tijdelijk(), venster: 0 });
  i18n.setVertaalkast(kast);
  try {
    const uit = await i18n.translateBatch(['huiswerk!', 'school!'], 'ja', 'nl',
      { bewaar: true, ai: tekst => tekst === 'school!' });
    assert.notEqual(uit[0].text, 'huiswerk!', 'de geweigerde regel is wel lokaal vertaald');
    assert.notEqual(uit[1].text, 'school!', 'de toegelaten interface is vertaald');
    kast.leegNu();
    const herstart = maakVertaalkast({ dir: path.dirname(kast.stand().map) });
    assert.equal(herstart.lees('ja', 'huiswerk!'), null, 'privé-invoer mag niet op schijf komen');
    assert.equal(herstart.lees('ja', 'school!'), uit[1].text, 'toegelaten interface overleeft de herstart');
  } finally { i18n.setVertaalkast(null); }
});
