/* DE POSITIE VAN DE RTFOUNDATION: waar een gift landt, en wie hem uitbetaalt.

   WAAROM DIT ER IS. De giftstand (kern/rtfos/gift.js) kan niet open zonder
   walletcode -- terecht, want een knop die opengaat zonder ontvanger stuurt geld
   nergens heen. Maar er was geen WEG om die positie te maken. Een leverancier
   ontstaat in dit huis uit een partnerAANVRAAG met een ledenbewijs en een
   toelatingsdossier (routes/office/partners.js), en de stichting is geen partner
   die solliciteert; ze is de rechtspersoon waar RTG zelf 30% naartoe brengt.
   De eigenaar kon dus wel een code INTIKKEN, maar er stond niets achter.

   DEZELFDE WEG ALS EEN INSTELLING, EN DAT IS EEN BESLUIT. kern/instelling.js
   loste hetzelfde probleem op voor gemeenten en vervoerders: de boardroom maakt
   de zaak, met makeSupplierCode, ensureSupplierDefaults en accounts.createStaff.
   Dit bestand doet het niet anders. Er komt geen tweede manier bij om een
   werkplek te maken (LAT.md regel 4).

   VIER GRENDELS:

   1. ER IS ER PRECIES EEN. Twee posities zijn twee plekken waar giften landen,
      en dan klopt geen enkele verantwoording meer. Een tweede poging krijgt de
      bestaande terug en geen nieuwe code. Het genre staat daarom op de stand
      'huis' en niet op 'intern': anders had de instellingsweg hem in zijn lijst
      gezet en kon iemand er een tweede naast aansluiten.

   2. HIJ LANDT IN DE ECONOMISCHE WERELD VAN DE STICHTING. Een leverancier is
      in kern/economie/werelden.js een `zaak:` en dus `commercieel` -- een wereld
      die WEL factureert. Zonder deze regel zou de stichting een commerciele
      klant van RTG zijn, terwijl ECONOMIE.md haar een eigen rechtspersoon met
      een eigen vermogen noemt. De firewall had daar niets van gezegd, want een
      klant mag een rekening krijgen.

   3. HIJ GAAT NOOIT ONLINE. Dit is geen zaak in de etalage: leden hoeven de
      stichting niet te vinden tussen de restaurants. `online: false`, en er is
      hier geen knop die dat omzet.

   4. AANMAKEN OPENT DE GIFTSTAND NIET. De positie is een feit, de stand is een
      besluit -- zoals de terugstortstand in kern/bankregie/vergunning.js. Dit
      vult de ontvanger in en laat de schakelaar staan waar hij stond. Wie hem
      omzet, doet dat met de hand en met zijn naam eronder.

   NIET GESEED, om dezelfde reden als bij een instelling: het merkteken `geseed`
   betekent "door de demo neergezet en bij een schone start op te ruimen", en dit
   is het tegendeel. */
'use strict';
const klok = require('../lib/klok');

const GENRE = 'rtfoundation';

function maakRtfWallet({ db, save, accounts, ensureSupplierDefaults, makeSupplierCode, economie, rtfos }) {
  const nu = () => klok.datum().toISOString();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);

  const bestaande = () => (db.data.suppliers || []).find(s => s && s.type === GENRE) || null;

  function beeld(s) {
    if (!s) return null;
    const drager = 'zaak:' + s.code;
    return { code: s.code, naam: s.name, sinds: s.aangeslotenAt || null,
      door: s.aangeslotenDoor || null, online: s.online === true,
      /* Wat de economielaag over deze positie zegt -- gelezen, niet aangenomen. */
      wereld: economie ? economie.wereldVanDrager(drager) : null,
      rekening: !!(s.uitbetaal && s.uitbetaal.iban) };
  }

  function stand() {
    const s = bestaande();
    return { ok: true, bestaat: !!s, wallet: beeld(s),
      uitleg: s
        ? 'De RTFoundation heeft een positie in RTG Pay. Giften landen hier; uitbetalen naar de eigen bankrekening doet de stichting zelf.'
        : 'De RTFoundation heeft nog geen positie in RTG Pay. Zolang die er niet is, kan de giftstand niet open: een gift zou nergens heen gaan.' };
  }

  async function maak(invoer, door) {
    const b = invoer || {};
    const al = bestaande();
    /* GRENDEL 1: geen tweede. Geen fout maar de bestaande stand terug -- twee
       keer op de knop drukken is geen tweede stichting. */
    if (al) {
      return { status: 409, error: 'De RTFoundation heeft al een positie: ' + al.code + '. Er is er precies een, want twee plekken waar giften landen maakt elke verantwoording onnavolgbaar.',
        wallet: beeld(al) };
    }
    const naam = schoon(b.naam, 80) || 'RTFoundation';
    const beheerder = schoon(b.beheerder, 60);
    if (!beheerder) return { status: 400, error: 'Op wiens naam komt de eerste beheer-inlog te staan? Zonder mens is er niemand die kan uitbetalen.' };

    const code = makeSupplierCode(naam);
    const s = { code, name: naam, type: GENRE, city: schoon(b.plaats, 60) || null, loc: null,
      rate: 0, menu: [], online: false,
      aangeslotenDoor: schoon(door, 60) || 'boardroom', aangeslotenAt: nu() };
    /* GRENDEL 3 staat hierboven in `online: false`, en die regel is geen
       overbodige zekerheid: kern/supplierdefaults.js doet
       `if (s.online === undefined) s.online = true`. Laat je hem weg, dan zet
       de standaardwaarde de stichting in de etalage tussen de restaurants.
       (Een tweede `s.online = false` NA deze aanroep stond hier ook, met een
       comment dat de standaardwaarden hem zouden overschrijven. Een mutatie
       liet zien dat die regel nergens op zakte: hij deed niets.) */
    ensureSupplierDefaults(s);
    db.data.suppliers.push(s);
    save();

    /* GRENDEL 2: de economische wereld. Mislukt dit, dan is de positie er WEL
       en staat ze in de verkeerde wereld -- dat wordt gemeld en niet
       weggeslikt, want stil in `commercieel` staan is precies de fout. */
    let wereldFout = null;
    try {
      const r = economie.identiteitZet({ drager: 'zaak:' + code, wereld: 'rtfoundation',
        grond: 'De RTFoundation is een eigen rechtspersoon met een eigen vermogen; zij is geen commerciele klant van RTG (ECONOMIE.md).',
        door: schoon(door, 60) || 'boardroom' });
      if (!r || !r.ok) wereldFout = (r && r.error) || 'onbekend';
    } catch (e) { wereldFout = String((e && e.message) || e); }

    const pin = accounts.makePin();
    await accounts.createStaff({ supplierCode: code, name: beheerder, role: 'manager', func: 'Beheer', pin });

    /* GRENDEL 4: de ontvanger invullen, de schakelaar laten staan. */
    let giftFout = null;
    try {
      const g = rtfos && rtfos.gift
        ? rtfos.gift.standZet({ ontvanger: { soort: 'wallet', code } }, schoon(door, 60) || 'boardroom')
        : null;
      if (g && g.error) giftFout = g.error;
    } catch (e) { giftFout = String((e && e.message) || e); }

    return { ok: true, wallet: beeld(bestaande()), code, pin, wereldFout, giftFout,
      vervolg: 'De positie staat er. Geef de code en de PIN aan de beheerder van de stichting; die stelt in de partner-app de bankrekening in en kan daarna uitbetalen. De giftstand staat nog zoals hij stond -- die zet u zelf om.' };
  }

  return { rtfWallet: { stand, maak, GENRE } };
}

module.exports = { maakRtfWallet, GENRE };
