/* DE KLANTKANT VAN EEN BIJSTANDSSESSIE -- uitnodigen, goedkeuren, intrekken.

   Dit bestand staat apart van ./bijstand-rtg.js omdat het verschil ertussen de
   hele belofte is. Hier ontstaat een sessie, hier wordt ja gezegd, en hier gaat
   hij weer dicht. Aan de andere kant staat wat RTG dan mag. Twee bestanden, en
   wie wil weten of RTG zichzelf toegang kan geven, hoeft maar op één plek te
   kijken: `vraag()` staat hier, en nergens anders.

   `org` KOMT NIET UIT DE BODY. De aanroeper is de werkruimte zelf --
   routes/tenant/bijstand.js haalt hem uit het beheer-token of uit een lid met
   het recht `werkruimte`, met dezelfde functies die de rest van de tenantlaag
   gebruikt. Er is geen parameter waarmee iemand een andere organisatie kan
   opgeven; dat is dezelfde grendel als bij de zaakcode in kern/zaakcommand/.

   EN INTREKKEN VRAAGT GEEN REDEN. Een uitnodiging die je niet zonder uitleg
   kunt terugnemen, is geen uitnodiging. */
'use strict';

const klok = require('../../lib/klok');

const niveaus = require('./bijstand-niveaus');

function maakKlantkant(C) {
  const { rij, vind, levend, kort, dossier, spoor, noteer, nu, save, crypto, tenantNu } = C;

  function vraag(org, o) {
    const opt = o || {};
    const T = tenantNu();
    const t = T && T.register ? T.register.haal(org) : null;
    if (!t) return { error: 'Deze werkruimte hoort bij geen enkele organisatie met een contract.', status: 404 };
    const niveau = String(opt.niveau || '');
    const N = niveaus.NIVEAUS[niveau];
    if (!N) return { error: 'Kies een niveau: ' + niveaus.NAMEN.join(', ') + '.', status: 400,
      niveaus: niveaus.keuzelijst() };
    const onderwerp = String(opt.onderwerp || '').trim();
    if (onderwerp.length < 4) {
      return { error: 'Waarmee mogen wij helpen? Zonder onderwerp heeft de sessie geen grens.', status: 400 };
    }
    const reden = String(opt.reden || '').trim();
    if (N.vraagtReden && reden.length < 10) {
      return { error: 'Bij het niveau "nood" geeft u vooraf toestemming om te handelen. Schrijf op waarom.', status: 400 };
    }
    const lopend = rij().find(s => s.org === t.org && levend(s));
    if (lopend) return { error: 'Er loopt al een bijstandssessie voor deze organisatie (' + lopend.id + ').', status: 409 };

    const minuten = niveaus.duurVan(niveau, opt.minuten);
    const s = {
      id: 'BIJ-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      org: t.org, orgNaam: t.naam, werkruimte: String(opt.werkruimte || ''),
      onderwerp: onderwerp.slice(0, 200), niveau, minuten,
      gevraagdDoor: String(opt.door || 'de werkruimte'), at: nu(),
      tot: new Date(klok.nu() + minuten * 60000).toISOString(),
      status: 'open', medewerker: null, betredenAt: null,
      voorafAkkoord: !!N.vooraf, voorafReden: N.vooraf ? reden.slice(0, 500) : null,
      inhoud: { open: false, verzoek: null },
      handelingen: [], spoor: [], verslag: null
    };
    rij().push(s);
    save();
    noteer(s, s.gevraagdDoor, 'bijstand gevraagd', 'niveau ' + niveau + ', ' + minuten + ' min: ' + s.onderwerp);
    spoor(s, 'De organisatie vroeg om bijstand.');
    save();
    return { sessie: kort(s), niveau: niveaus.keuzelijst().find(x => x.id === niveau) };
  }

  function trekIn(org, id, door) {
    const s = vind(id);
    if (!s || s.org !== String(org)) return { error: 'Die sessie bestaat niet.', status: 404 };
    if (!levend(s)) return { error: 'Die sessie loopt niet meer.', status: 409 };
    s.status = 'ingetrokken'; s.tot = nu();
    noteer(s, String(door || 'de werkruimte'), 'bijstand ingetrokken', 'de organisatie beëindigde de sessie');
    spoor(s, 'De organisatie trok de toegang in.');
    save();
    return { sessie: kort(s) };
  }

  /* Ja of nee op ÉÉN handeling. Dit is de enige weg naar uitvoeren -- behalve
     bij `nood`, waar de klant dat ja vooraf en met een reden heeft gegeven. */
  function besluit(org, id, index, akkoord, door) {
    const s = vind(id);
    if (!s || s.org !== String(org)) return { error: 'Die sessie bestaat niet.', status: 404 };
    if (!levend(s)) return { error: 'Die sessie loopt niet meer.', status: 409 };
    const h = s.handelingen[Number(index)];
    if (!h) return { error: 'Die handeling bestaat niet.', status: 404 };
    if (h.status !== 'voorgesteld') return { error: 'Over die handeling is al besloten (' + h.status + ').', status: 409 };
    h.status = akkoord ? 'goedgekeurd' : 'geweigerd';
    h.besluitDoor = String(door || 'de werkruimte'); h.besluitAt = nu();
    noteer(s, h.besluitDoor, 'bijstand handeling ' + h.status, h.wat);
    spoor(s, 'De organisatie ' + (akkoord ? 'keurde goed' : 'weigerde') + ': ' + h.wat);
    save();
    return { sessie: dossier(s.id, { voorKlant: true }) };
  }

  /* Inhoud opengaan is een APART besluit, met de reden van de medewerker erbij.
     Wie een mailmodule repareert hoeft geen mails te kunnen lezen -- en de klant
     hoort te zien waarom dat deze keer anders zou zijn. */
  function inhoudBesluit(org, id, akkoord, door) {
    const s = vind(id);
    if (!s || s.org !== String(org)) return { error: 'Die sessie bestaat niet.', status: 404 };
    if (!levend(s)) return { error: 'Die sessie loopt niet meer.', status: 409 };
    if (!s.inhoud.verzoek) return { error: 'Er ligt geen verzoek om inhoud te mogen zien.', status: 409 };
    s.inhoud.open = !!akkoord;
    s.inhoud.besluitDoor = String(door || 'de werkruimte'); s.inhoud.besluitAt = nu();
    noteer(s, s.inhoud.besluitDoor, 'bijstand inhoud ' + (akkoord ? 'geopend' : 'geweigerd'), s.inhoud.verzoek.reden);
    spoor(s, 'De organisatie ' + (akkoord ? 'gaf toegang tot inhoud' : 'hield de inhoud dicht') + '.');
    save();
    return { sessie: dossier(s.id, { voorKlant: true }) };
  }

  return { vraag, trekIn, besluit, inhoudBesluit };
}

module.exports = { maakKlantkant };
