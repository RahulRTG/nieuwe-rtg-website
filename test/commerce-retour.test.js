/* REVERSE COMMERCE -- de weg terug.

   WAAROM DEZE LAAG NIEUWBOUW IS: COMMERCE.json telt het werkwoord `retour` in
   6 van de 100 koopbare domeinen, en geen van die zes is een goederenretour --
   drie geldomkeringen en een pakket dat terugrijdt. Grondslag, inspectie,
   voorraadstand en btw-correctie bestonden nergens.

   DE VIER ZWAARSTE TOETSEN HIERONDER houden vast wat deze laag met opzet NIET
   doet, want dat is precies waar hij vanzelf naartoe zou groeien:

     5. de standenmachine laat geen sprongen toe -- "aanvaard" en "beoordeeld"
        samentrekken zou betekenen dat niemand meer kan zeggen of de verkoper
        het goed heeft GEZIEN of alleen het verzoek;
     6. RTG zet nooit een stand namens de verkoper (COMMERCE.md grens 6);
     7. geld wordt KLAARGEZET en nooit verplaatst (GELD.md par. 3);
     9 en 10. wiens retour is dit -- die controle stond er eerst NIET, en zonder
        haar beweegt elke verkoper de retour van de buurman en elk lid die van
        een ander. De standentabel zegt namelijk alleen welke PARTIJ een stand
        zet, niet welke verkoper.

   Draai los: node --test test/commerce-retour.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const K = require('../server/kern/commerce/koopbaar');
const maakRetour = require('../server/kern/commerce/retour');
const maakAfrekening = require('../server/kern/commerce/afrekening');
const tarief = require('../server/kern/fiscaal/tarief');
const { GRONDEN, STANDEN, UITKOMSTEN, NA } = require('../server/kern/commerce/retourlijst');

const ZAAK = { code: 'MODE', type: 'retail', settings: { land: 'NL' } };
const rekenaar = maakAfrekening({ tariefVan: tarief.tariefVan, basisCat: tarief.basisCat,
  zaakVan: () => ZAAK, capsVan: () => [] });

/* Een verse motor per toets: deze laag schrijft in db.data, en toetsen die een
   tabel delen, gaan elkaar beinvloeden zodra er een volgorde in komt. */
function motor(nu) {
  const db = { data: {} };
  return maakRetour({ db, save: () => {}, nu: nu || (() => 1700000000000),
    btwUit: rekenaar.btwUit, zaakVan: () => ZAAK });
}
const eur = (bedrag) => ({ bedrag, eenheid: 'per stuk', valuta: 'EUR', vanaf: false });
const jas = (o) => K.vanAanbod(Object.assign({
  id: 'jas', bron: 'retail', type: 'product', titel: 'Wollen jas',
  aanbieder: { soort: 'zaak', code: 'MODE', naam: 'Atelier' },
  prijs: eur(249), beschikbaar: { voorraad: 3 }, bezorgt: true
}, o));
const vraag = (R, o) => R.vraag(Object.assign({ sleutel: 'lid1', koopbaar: jas(), orderRef: 'ORD-1',
  grond: 'defect', centen: 24900 }, o));

test('1. terugsturen kan alleen wat de verkoper heeft ingericht', () => {
  const R = motor();
  // een dienst kent geen retour: het type belooft het niet
  const dienst = jas({ type: 'dienst', titel: 'Taxatie', bezorgt: false });
  assert.ok(!dienst.werkwoorden.includes('retour'));
  const r = R.vraag({ sleutel: 'lid1', koopbaar: dienst, orderRef: 'O', grond: 'defect', centen: 100 });
  assert.equal(r.status, 409);
  assert.match(r.error, /belooft dat niet namens hem/);
});

test('2. een grond is een keuze uit de lijst, geen vrij tekstveld', () => {
  const R = motor();
  assert.equal(vraag(R, { grond: 'past niet zo lekker' }).status, 400);
  assert.ok(vraag(R, { grond: 'bedenktijd' }).ok);
  assert.ok(GRONDEN.length >= 5 && GRONDEN.every(g => g.id && g.label && g.wie));
});

test('3. zonder ordekenmerk geen retour, en RTG controleert het niet zelf', () => {
  const R = motor();
  assert.equal(vraag(R, { orderRef: '' }).status, 400);
  const r = vraag(R, {});
  assert.equal(r.retour.orderGecontroleerd, false,
    'de order is van het domein; RTG kan hem niet nakijken en doet niet alsof');
});

test('4. bedrag en btw worden BEVROREN op het moment van aanvragen', () => {
  const R = motor();
  const r = vraag(R, { centen: 24900 });
  assert.equal(r.retour.btw.tariefProcent, 21);
  assert.equal(r.retour.btw.btwCenten + r.retour.btw.nettoCenten, 24900);
  /* Zonder bevriezing zou een teruggave van maart in juni met het tarief van
     juni worden gerekend; de landentabel is levend (fiscaal/regelwacht.js). */
  assert.ok(r.retour.btw, 'het tarief hangt aan de aanvraag en niet aan de afhandeling');
});

test('5. de standenmachine laat geen sprongen toe', () => {
  const R = motor();
  const id = vraag(R, {}).retour.id;
  const spring = R.zet({ id, naar: 'afgehandeld', door: 'verkoper', uitkomst: 'geld-terug' });
  assert.equal(spring.status, 409);
  assert.match(spring.error, /kan het niet naar/);
  // de enige toegestane vervolgen staan in de tabel, en eindstanden hebben er geen
  assert.deepEqual(NA.afgehandeld, []);
  assert.deepEqual(NA.afgewezen, []);
});

test('6. RTG zet nooit een stand namens de verkoper', () => {
  const R = motor();
  const id = vraag(R, {}).retour.id;
  const alsKoper = R.zet({ id, naar: 'aanvaard', door: 'koper' });
  assert.equal(alsKoper.status, 403);
  assert.match(alsKoper.error, /zet de verkoper/);
  // en vervallen doet de termijn, niet een mens
  assert.equal(R.zet({ id, naar: 'vervallen', door: 'verkoper' }).status, 403);
});

test('7. een uitkomst met geld ZET KLAAR en voert niets uit', () => {
  const R = motor();
  const id = vraag(R, {}).retour.id;
  R.zet({ id, naar: 'aanvaard', door: 'verkoper' });
  R.zet({ id, naar: 'onderweg', door: 'koper' });
  R.zet({ id, naar: 'beoordeeld', door: 'verkoper', staat: 'ongebruikt' });
  const r = R.zet({ id, naar: 'afgehandeld', door: 'verkoper', uitkomst: 'geld-terug' });
  const b = r.retour.besluit;
  assert.equal(b.geldTerug, true);
  assert.equal(b.centen, 24900);
  assert.equal(b.uitgevoerd, false, 'GELD.md par. 3: geld verlaat het huis nooit vanzelf');
  assert.equal(b.uitgevoerdOp, null);
  assert.equal(b.btwCenten, 4321, 'de btw van de teruggave rust op het bevroren tarief');
});

test('8. een deelteruggave draagt een bedrag EN een reden, en de btw gaat naar rato', () => {
  const R = motor();
  const id = vraag(R, {}).retour.id;
  R.zet({ id, naar: 'aanvaard', door: 'verkoper' });
  R.zet({ id, naar: 'onderweg', door: 'koper' });
  R.zet({ id, naar: 'beoordeeld', door: 'verkoper', staat: 'gebruikt' });
  assert.equal(R.zet({ id, naar: 'afgehandeld', door: 'verkoper', uitkomst: 'deels-terug', bedragCenten: 12000 }).status, 400,
    'een bedrag zonder uitleg is een bedrag waar niemand iets mee kan');
  assert.equal(R.zet({ id, naar: 'afgehandeld', door: 'verkoper', uitkomst: 'deels-terug', bedragCenten: 24900, reden: 'x' }).status, 400,
    'een deel is minder dan het geheel');
  const r = R.zet({ id, naar: 'afgehandeld', door: 'verkoper', uitkomst: 'deels-terug', bedragCenten: 12000, reden: 'Schade door gebruik' });
  assert.equal(r.retour.besluit.centen, 12000);
  assert.equal(r.retour.besluit.btwCenten, Math.round(4321 * (12000 / 24900)));
});

test('9. een verkoper beweegt de retour van de buurman niet', () => {
  const R = motor();
  const id = vraag(R, {}).retour.id;
  const vreemd = R.zet({ id, naar: 'aanvaard', door: 'verkoper', verkoper: 'ANDERE' });
  assert.equal(vreemd.status, 403);
  assert.match(vreemd.error, /niet bij deze zaak/);
  assert.ok(R.zet({ id, naar: 'aanvaard', door: 'verkoper', verkoper: 'MODE' }).ok);
});

test('10. een lid beweegt de retour van een ander niet', () => {
  const R = motor();
  const id = vraag(R, {}).retour.id;
  R.zet({ id, naar: 'aanvaard', door: 'verkoper', verkoper: 'MODE' });
  assert.equal(R.zet({ id, naar: 'onderweg', door: 'koper', sleutel: 'lid2' }).status, 403);
  assert.ok(R.zet({ id, naar: 'onderweg', door: 'koper', sleutel: 'lid1' }).ok);
});

test('11. afwijzen kan niet zonder reden', () => {
  const R = motor();
  const id = vraag(R, {}).retour.id;
  assert.equal(R.zet({ id, naar: 'afgewezen', door: 'verkoper' }).status, 400);
  const r = R.zet({ id, naar: 'afgewezen', door: 'verkoper', reden: 'Buiten de termijn' });
  assert.equal(r.retour.stand, 'afgewezen');
  assert.equal(r.retour.besluit.reden, 'Buiten de termijn');
});

test('12. de staat zegt of het TERUG KAN, en boekt de voorraad niet', () => {
  const R = motor();
  const loop = (staat) => {
    const id = vraag(R, {}).retour.id;
    R.zet({ id, naar: 'aanvaard', door: 'verkoper' });
    R.zet({ id, naar: 'onderweg', door: 'koper' });
    return R.zet({ id, naar: 'beoordeeld', door: 'verkoper', staat }).retour;
  };
  assert.equal(loop('ongebruikt').voorraadKan, true);
  assert.equal(loop('beschadigd').voorraadKan, false);
  /* Er komt geen vijfde voorraad bij (kern/onderneming/voorraad.js): deze laag
     zegt alleen of het KAN, het domein boekt. */
  assert.equal(R.bij(loop('ongebruikt').id).voorraadKan, true);
});

test('13. een aanvraag die blijft liggen, vervalt -- en een afgehandelde niet', () => {
  let t = 1700000000000;
  const R = motor(() => t);
  const open = vraag(R, {}).retour.id;
  const klaar = vraag(R, { orderRef: 'ORD-2' }).retour.id;
  R.zet({ id: klaar, naar: 'afgewezen', door: 'verkoper', reden: 'Buiten de termijn' });

  t += (R.VERVAL_DAGEN + 1) * 24 * 3600 * 1000;
  R.ruim();
  assert.equal(R.bij(open).stand, 'vervallen');
  assert.equal(R.bij(klaar).stand, 'afgewezen', 'een eindstand is een eindstand');
});

test('14. wat er met opzet niet is, staat er met de reden', () => {
  const R = motor();
  assert.match(R.NIET_GEBOUWD['automatisch-terugboeken'], /Nooit/);
  assert.match(R.NIET_GEBOUWD['retourpercentage'], /ranglijst/,
    'CLAUDE.md verbiedt een score op mensen; een retourpercentage is er een');
  assert.ok(Object.keys(R.NIET_GEBOUWD).length >= 4);
});

test('15. elke stand noemt WIE hem zet, en elke uitkomst of er geld bij hoort', () => {
  for (const s of STANDEN) assert.ok(s.door, s.id + ' hoort een partij te noemen');
  for (const u of UITKOMSTEN) assert.equal(typeof u.geldTerug, 'boolean', u.id);
  // en de tijdlijn groeit aan: elke stap blijft staan
  const R = motor();
  const id = vraag(R, {}).retour.id;
  R.zet({ id, naar: 'aanvaard', door: 'verkoper' });
  R.zet({ id, naar: 'onderweg', door: 'koper' });
  assert.deepEqual(R.bij(id).stappen.map(s => s.stand), ['gevraagd', 'aanvaard', 'onderweg']);
});
