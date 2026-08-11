/* Aanmeldingen-deel "bedrijf" (kern/aanmeldingen): de ondernemersintake en
   de automatische bedrijfsprovisioning.

   Bij de aanvraag vraagt de AI-intake al wat het bedrijf nodig heeft
   (naam, genre, behoeften); dat komt als a.bedrijf op de aanmelding.
   Na het menselijke akkoord EN zodra het personeel de eerste termijn als
   voldaan aftekent, wordt de zaak automatisch klaargezet: de leverancier
   bestaat, de eigenaar heeft een beheer-inlog met eigen PIN, en het
   bedrijfsdorp (de afdelingenset van het genre) staat klaar -- de motor
   in kern/hoteldorp geeft elke zaak vanzelf het dorp van zijn type.
   De behoeften uit de intake landen als openstaande wensen bij de zaak.

   Vaste regels: de AI kent nooit zelf toegang toe (beslis() blijft
   mensenwerk) en er wordt nooit geclaimd dat een echte betaling is
   verwerkt -- 'voldaan' is de administratieve bevestiging door een mens. */
/* DE LIJST WORDT GELEZEN, NIET OVERGETYPT.

   Hier stonden 31 genre-namen met de hand ingetikt, naast de 73 in het
   register. Twee lijsten over dezelfde vraag (LAT-regel 4), en ze liepen uiteen
   zoals dat altijd gaat: 42 genres bestonden wel in het register maar konden
   niet worden aangevraagd, en `GENRES.includes(type) ? type : 'zzp'` maakte er
   stilletjes een zzp-zaak van. Wie om een juwelier of een wellness-zaak vroeg,
   kreeg de zzp-caps en het vangnet-dorp, en merkte dat pas als de verkeerde
   tools op zijn scherm stonden. Geen foutmelding, geen spoor.

   Nu leest dit bestand de toegangsstand uit het register. Wie een genre
   openzet, doet dat op één plek en deze lijst verandert mee. */
const register = require('../../seed/genres');
const GENRES = register.aanvraagbareGenres();

/* De fabriek, met de genrelijst er los naast: het proefpubliek in
   test/gezelschap.js zet voor elk genre een lid neer en moet die lijst kunnen
   lezen zonder de hele kern op te bouwen. */
module.exports = Object.assign((ctx) => {
  const { db, save, kap, nu, accounts } = ctx;

  /* De behoeften-intake: wat de ondernemer invult (of aan Rahul vertelt)
     komt netjes geklemd op de aanmelding te staan.

     EEN GENRE DAT NIET OPENSTAAT WORDT NIET IETS ANDERS. Deze functie zette
     hier `: 'zzp'` en dat is de stille fallback die het register komt
     opruimen. Nu geeft zij de weigering terug en schrijft zij niets: de
     aanvrager hoort te lezen dat zijn genre nog niet open is, en waarom.

     Geeft { ok: true } terug, of een fout met een code die de aanroeper kan
     doorgeven. Geen bedrijf meegestuurd is geen fout -- niet elke aanmelding
     gaat over een zaak. */
  function zetBedrijf(a, data, opties) {
    if (!data || typeof data !== 'object') return { ok: true, bedrijf: false };
    const naam = kap(data.naam, 60);
    if (!naam) return { ok: true, bedrijf: false };

    const type = typeof data.type === 'string' ? data.type.trim() : '';
    if (!type) {
      return { status: 400, error: 'In welke branche werkt dit bedrijf?',
        uitleg: 'Zonder branche weten we niet welke tools de zaak nodig heeft. Eerder werd dit stil een zzp-zaak; dat doen we niet meer.' };
    }
    const poort = register.genreToegang(type, opties);
    if (!poort.ok) {
      return { status: poort.reden === 'onbekend' ? 400 : 409,
        error: poort.reden === 'onbekend'
          ? 'Deze branche kennen we niet.'
          : 'De branche "' + ((register.GENRES[type] || {}).label || type) + '" staat nog niet open voor aanvragen.',
        genre: type, stand: poort.reden, uitleg: poort.uitleg };
    }

    a.bedrijf = {
      naam,
      type,
      plaats: kap(data.plaats, 60),
      behoeften: (Array.isArray(data.behoeften) ? data.behoeften : [])
        .slice(0, 8).map(b => kap(b, 120)).filter(Boolean)
    };
    if (poort.bewijsNodig) a.bedrijf.bewijsNodig = true;
    return { ok: true, bedrijf: true };
  }

  // een leesbare, unieke zaakcode uit de bedrijfsnaam
  function codeVoor(naam) {
    let basis = String(naam).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10) || 'ZAAK';
    let code = basis, n = 2;
    while ((db.data.suppliers || []).some(s => s.code === code)) code = basis + n++;
    return code;
  }

  /* De provisioning zelf: zaak + eigenaarsinlog + wensen. Idempotent --
     een tweede aanroep doet niets. Geeft de eigenaars-PIN eenmalig terug
     (die staat alleen gehasht in de kluis). */
  function provisioneer(a) {
    if (!a.bedrijf || a.gezaakt) return a.gezaakt || null;
    if (!Array.isArray(db.data.suppliers)) db.data.suppliers = [];
    const code = codeVoor(a.bedrijf.naam);
    db.data.suppliers.push({ code, name: a.bedrijf.naam, type: a.bedrijf.type,
      city: a.bedrijf.plaats || '', loc: null, rate: 0, menu: [], photos: [] });
    // de eigenaar krijgt een beheer-inlog met een eigen, eenmalig getoonde PIN
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    let staffId = null;
    try {
      const st = accounts.createStaffSync({ supplierCode: code, name: kap(a.naam, 60) || 'Eigenaar',
        role: 'manager', func: 'Eigenaar', pin });
      staffId = st && st.id;
    } catch (e) { console.error('[bedrijf] eigenaarsinlog', e.message); }
    // de behoeften uit de intake landen als open wensen bij de nieuwe zaak
    if (a.bedrijf.behoeften.length) {
      if (!db.data.bedrijfsWensen) db.data.bedrijfsWensen = {};
      db.data.bedrijfsWensen[code] = a.bedrijf.behoeften.map(w => ({ wens: w, status: 'open', at: nu() }));
    }
    a.gezaakt = { code, staffId, at: nu() };
    a.bijgewerkt = nu();
    save();
    return { code, staffId, pin };
  }

  /* Het personeel tekent een termijn af als voldaan (geen betaalclaim; een
     administratieve bevestiging). Bij de eerste voldane termijn van een
     geaccepteerde ondernemersaanmelding wordt de zaak klaargezet. */
  function termijnVoldaan(B, a, maand, door) {
    const rij = B().find(r => r.aanmeldingId === a.id);
    if (!rij) return { status: 404, error: 'Geen betaalschema voor deze aanmelding.' };
    const t = (rij.termijnen || []).find(x => x.maand === Number(maand));
    if (!t) return { status: 404, error: 'Deze termijn bestaat niet.' };
    if (t.status === 'voldaan') return { status: 409, error: 'Deze termijn is al afgetekend.' };
    t.status = 'voldaan';
    t.voldaan = { door: kap(door, 60), at: nu() };
    let zaak = null;
    if (a.status === 'geaccepteerd' && !(rij.termijnen || []).some(x => x.maand < t.maand && x.status !== 'voldaan')) {
      if (t.maand === 1) zaak = provisioneer(a);
    }
    save();
    return { ok: true, maand: t.maand, zaak };
  }

  return { zetBedrijf, provisioneer, termijnVoldaan, GENRES };
}, { GENRES });
