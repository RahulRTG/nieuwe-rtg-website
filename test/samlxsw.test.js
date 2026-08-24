/* DE AANVALSTOETS OP DE SAML-DEUR.

   De faalvorm van een SAML-controle is geen foutmelding maar een STILLE
   AUTHENTICATIE-BYPASS: een document dat er perfect uitziet, met een
   handtekening die werkelijk klopt, waarna wij de verkeerde persoon binnenlaten.
   Een toets die alleen kapotte documenten voorlegt, bewijst daar niets over.
   Deze toets bouwt daarom echte, geldig ondertekende antwoorden met een
   wegwerpsleutel (test/saml-idp.js) en verminkt ze daarna zoals een aanvaller
   dat doet.

   ZEVEN AANVALLEN, en bij elk staat WELKE regel hem hoort te stoppen. Dat is
   met opzet: `assert.throws` zonder patroon slaagt ook als het document
   toevallig op een tikfout strandt, en dan meet je je eigen parser in plaats
   van je verdediging.

     2. XSW -- een tweede assertie erbij      -> er mag er precies EEN zijn
     3. de handtekening dekt een ANDER element -> de assertie moet BINNEN het
                                                  gecontroleerde stuk liggen
     4. de handtekening los van zijn element   -> hij moet er IN zitten
     5. een ongetekende assertie               -> geen handtekening, geen inlog
     6. inhoud veranderd na ondertekenen       -> de digest
     7. een verlopen assertie                  -> NotOnOrAfter
     8. een verkeerd publiek                   -> Audience

   Aanval 3 en 4 zijn de gevaarlijkste: daar KLOPT de handtekening wiskundig, en
   is de enige verdediging dat de controleur en de lezer naar hetzelfde stuk
   kijken. Wie die twee regels weghaalt, houdt een groene toets over bij drie
   van de andere -- en een deur die openstaat.

   Draai los: node --test test/samlxsw.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const idp = require('./saml-idp');
const antwoord = require('../server/sso/saml/antwoord');

const ACS = 'https://rtg.test/api/sso/saml/acs';
const ONS = 'https://rtg.test/saml/metadata';
const UITGEVER = 'https://idp.klant.nl/meta';
const VERZOEK = '_verzoek1';

const kp = idp.sleutelpaar();
const vreemd = idp.sleutelpaar('boef.test');
const KOPPELING = { org: 'klant', samlEntityId: UITGEVER, samlCert: kp.cert };
const VERWACHT = { entityId: ONS, acs: ACS, verzoekId: VERZOEK };

function basis(extra) {
  return Object.assign({
    id: '_a1', issuer: UITGEVER, sub: 'u-77', acs: ACS, inResponseTo: VERZOEK,
    publiek: ONS, email: 'pia@klant.nl', groepen: ['Uitvoering'], key: kp.key
  }, extra || {});
}
const lees = (xml, k) => antwoord.lees(xml, k || KOPPELING, VERWACHT);

test('1. het geldige antwoord komt binnen, op hetzelfde claimcontract als OIDC', () => {
  const { xml } = idp.geldig(basis());
  const uit = lees(xml);
  assert.deepEqual(Object.keys(uit.claims).sort(), ['email', 'email_verified', 'groups', 'name', 'sub']);
  assert.equal(uit.claims.sub, 'u-77');
  assert.equal(uit.claims.email, 'pia@klant.nl');
  assert.deepEqual(uit.claims.groups, ['Uitvoering']);
  assert.equal(uit.id, '_a1', 'het assertie-ID komt mee, want daar hangt het eenmalig gebruik aan');
});

test('2. XSW: een tweede, verzonnen assertie erbij', () => {
  const { assertieXml } = idp.geldig(basis());
  /* De klassieke vorm: de ECHTE, ondertekende assertie blijft ongemoeid staan
     en er komt een verzonnen exemplaar naast. Wie "de eerste assertie" leest,
     laat de baas van het bedrijf binnen op naam van een stagiair. */
  const vals = idp.assertie(basis({ id: '_vals', email: 'directeur@klant.nl', metSig: false }));
  for (const xml of [idp.response(vals + assertieXml), idp.response(assertieXml + vals)])
    assert.throws(() => lees(xml), /2 asserties/, 'de volgorde mag niet uitmaken');
});

test('3. XSW: de handtekening dekt een ANDER element -- en hij KLOPT', () => {
  /* Hier is niets stuk. De lokvogel is netjes ondertekend, de digest klopt, de
     RSA-controle slaagt. De assertie ernaast is verzonnen. Het enige dat deze
     inlog tegenhoudt is dat de assertie BUITEN het gecontroleerde stuk ligt. */
  const lok = idp.teken('<lokvogel ID="_lok">{{SIG}}<iets/></lokvogel>', '_lok', { key: kp.key });
  const vals = idp.assertie(basis({ id: '_vals', email: 'directeur@klant.nl', metSig: false }));
  const xml = idp.response('<samlp:Extensions>' + lok + '</samlp:Extensions>' + vals);
  assert.throws(() => lees(xml), /BUITEN het stuk dat is ondertekend/);
});

test('4. de handtekening losgemaakt van het element dat hij dekt', () => {
  /* Ook hier klopt alles: de handtekening dekt de assertie, de digest klopt
     (het enveloped-transform haalt de handtekening er toch uit, dus buiten de
     assertie zetten verandert de bytes niet), en de sleutel is de goede. Alleen
     zit hij er niet meer IN -- en dan mag hij niet gelden, want anders kan een
     losse handtekening naast elk willekeurig element worden gehangen. */
  const { assertieXml } = idp.geldig(basis());
  const m = /<ds:Signature[\s\S]*?<\/ds:Signature>/.exec(assertieXml);
  assert.ok(m, 'de handtekening zit in de assertie');
  const zonder = assertieXml.replace(m[0], '');
  assert.throws(() => lees(idp.response(zonder + m[0])), /zit niet IN het element dat hij dekt/);
});

test('5. een ongetekende assertie', () => {
  const kaal = idp.assertie(basis({ metSig: false }));
  assert.throws(() => lees(idp.response(kaal)), /draagt geen handtekening/);
});

test('6. de inhoud is na het ondertekenen veranderd', () => {
  const { assertieXml } = idp.geldig(basis());
  const geknoeid = assertieXml.replace('pia@klant.nl', 'directeur@klant.nl');
  assert.notEqual(geknoeid, assertieXml);
  assert.throws(() => lees(idp.response(geknoeid)), /na het ondertekenen veranderd/);
});

test('7. een verlopen assertie, en een die nooit verloopt', () => {
  const oud = idp.geldig(basis({ tijd: Date.now() - 3600000 }));
  assert.throws(() => lees(oud.xml), /verlopen/);

  /* Geen NotOnOrAfter is erger dan verlopen: dat is een wachtwoord zonder
     einddatum. Hij wordt geweigerd en niet stilzwijgend van een grens voorzien.
     Het weghalen gebeurt VOOR het ondertekenen -- anders strandt hij op de
     digest en toetst deze regel niets. */
  const kaal = idp.assertie(basis({ metSig: false })).replace(/ NotOnOrAfter="[^"]*">(<saml:AudienceRestriction)/, '>$1');
  assert.ok(!/NotOnOrAfter="[^"]*"><saml:AudienceRestriction/.test(kaal), 'het einde is er echt uit');
  const eeuwig = idp.teken(kaal.replace('</saml:Issuer>', '</saml:Issuer>{{SIG}}'), '_a1', { key: kp.key });
  assert.throws(() => lees(idp.response(eeuwig)), /verloopt nooit/);
});

test('8. een verkeerd publiek, en helemaal geen publiek', () => {
  const ander = idp.geldig(basis({ publiek: 'https://andere-dienst.nl/saml' }));
  assert.throws(() => lees(ander.xml), /niet voor ons/);

  const zonder = idp.assertie(basis({ metSig: false })).replace(/<saml:AudienceRestriction>[\s\S]*?<\/saml:AudienceRestriction>/, '');
  const getekend = idp.teken(zonder.replace('</saml:Issuer>', '</saml:Issuer>{{SIG}}'), '_a1', { key: kp.key });
  assert.throws(() => lees(idp.response(getekend)), /noemt geen publiek/);
});

test('9. een handtekening van een andere sleutel', () => {
  const { xml } = idp.geldig(basis({ key: vreemd.key }));
  assert.throws(() => lees(xml), /niet van de sleutel van deze koppeling/);
  /* En de goede sleutel met de VERKEERDE uitgever erin telt ook niet: anders
     mag de provider van klant A een assertie namens klant B ondertekenen. */
  const b = idp.geldig(basis({ issuer: 'https://idp.andere-klant.nl/meta' }));
  assert.throws(() => lees(b.xml), /niet van de provider van deze koppeling/);
});

test('10. twee elementen met hetzelfde ID', () => {
  const { assertieXml } = idp.geldig(basis());
  const xml = idp.response('<samlp:Extensions ID="_a1"/>' + assertieXml);
  assert.throws(() => lees(xml), /dragen ID "_a1"/);
});

test('11. zwakke en verkeerde algoritmen', () => {
  for (const [opties, patroon] of [
    [{ tekenAlg: 'sha1' }, /niet toegestaan/],
    [{ tekenAlg: 'hmac' }, /niet toegestaan/],
    [{ digest: 'sha1' }, /geen SHA-1/]
  ]) {
    const sjabloon = idp.assertie(basis());
    const xml = idp.response(idp.teken(sjabloon, '_a1', Object.assign({ key: kp.key }, opties)));
    assert.throws(() => lees(xml), patroon, JSON.stringify(opties));
  }
});

test('12. het antwoord hoort bij ONS verzoek, en bij ONS adres', () => {
  for (const [wat, verwacht] of [
    ['ander verzoek', { entityId: ONS, acs: ACS, verzoekId: '_ergensanders' }],
    ['ander antwoordadres', { entityId: ONS, acs: 'https://boef.nl/acs', verzoekId: VERZOEK }]
  ]) {
    const { xml } = idp.geldig(basis());
    assert.throws(() => antwoord.lees(xml, KOPPELING, verwacht), /hoort niet bij het verzoek/, wat);
  }
});
