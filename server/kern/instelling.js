/* DE INSTELLINGSWEG: hoe een echte gemeente, luchthaven, vervoerder of dienst
   in een RTG-installatie terechtkomt.

   WAAROM DIT ER IS. Acht genres staan in het register op `status: 'intern'` --
   ov, luchthaven, gemeente, rijk, politie, brandweer, ambulance, marechaussee.
   De uitleg daarbij is: "dit genre hoort bij de wereld zelf en wordt niet door
   een partner aangevraagd". Dat klopt: je wilt niet dat iemand zich via het
   partnerformulier tot Gemeente Amsterdam uitroept.

   Maar daarmee was er GEEN weg. Die instellingen kwamen uitsluitend uit de
   demo-seed, en die begint zonder RTG_DEMO leeg (kern/demostand.js). Op een
   echte installatie stonden vier werelden dus permanent leeg, met een eerlijke
   lege stand ("er is nog geen gemeente aangesloten") en geen deur ernaast. Een
   wereld die alleen in de demo kan bestaan is geen wereld (LAT-regel 6).

   Dit is die deur, en hij zit waar hij hoort: bij de boardroom. Aansluiten
   maakt een bedrijfscode en een beheer-inlog aan -- precies het gewicht van een
   partnerbesluit, dus dezelfde poort en dezelfde menselijke hand.

   DE LIJST KOMT UIT HET REGISTER, NIET UIT DIT BESTAND. Welke genres intern
   zijn staat in server/seed/genres-lijst.js. Wie hier een eigen lijstje zou
   overtypen, heeft twee plekken voor dezelfde waarheid en merkt het pas als ze
   uit elkaar lopen (LAT-regel 4).

   NIET GESEED. Een instelling die hier wordt aangesloten krijgt geen `geseed`-
   merkteken. Dat teken betekent "door de demo neergezet en bij een schone start
   op te ruimen" (kern/initdata/index.js), en dit is juist het tegendeel: een
   echte instelling, door een mens neergezet. Zou het teken er wel op staan, dan
   ruimde de eerstvolgende start hem op. */
'use strict';
const klok = require('../lib/klok');

const register = require('../seed/genres');

function maakInstelling({ db, save, accounts, ensureSupplierDefaults, makeSupplierCode }) {
  const nu = () => klok.datum().toISOString();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);
  const internGenres = () => Object.keys(register.GENRES).filter(id => register.GENRES[id].status === 'intern');

  /* Wat kan er worden aangesloten. Label en sector komen uit het register mee,
     zodat het scherm niets hoeft te weten wat daar niet staat. */
  function instellingGenres() {
    return { ok: true, genres: internGenres().map(id => ({
      id, label: register.GENRES[id].label, sector: register.GENRES[id].industry || null
    })) };
  }

  /* Wat er al staat. Alleen de instellingen: de gewone catalogus staat elders en
     hoort hier niet doorheen te lopen. */
  function instellingen() {
    const intern = new Set(internGenres());
    const lijst = (db.data.suppliers || []).filter(s => s && intern.has(s.type)).map(s => ({
      code: s.code, naam: s.name, genre: s.type, plaats: s.city || null,
      online: s.online !== false, status: s.partnerStatus || 'actief',
      door: s.aangeslotenDoor || null, sinds: s.aangeslotenAt || null,
      // een instelling uit de demo is te herkennen, en dat hoort zichtbaar te zijn
      demo: s.geseed === true
    }));
    return { ok: true, aantal: lijst.length, instellingen: lijst };
  }

  /* Aansluiten. Levert een bedrijfscode en een eenmalige beheer-PIN op, net als
     een goedgekeurde partneraanvraag -- dezelfde weg, dus dezelfde bouwstenen
     (makeSupplierCode, ensureSupplierDefaults, accounts.createStaff) en geen
     tweede manier om een werkplek te maken.

     OFFLINE TOT DE INSTELLING ZELF ZOVER IS, om dezelfde reden als bij een
     nieuwe partner: eerst inrichten, dan zichtbaar voor leden. */
  async function instellingAansluiten(invoer, door) {
    const b = invoer || {};
    const genre = schoon(b.genre, 40).toLowerCase();
    if (!internGenres().includes(genre))
      return { status: 400, error: 'Kies een instelling uit de lijst: ' + internGenres().join(', ') + '.' };
    const naam = schoon(b.naam, 80);
    if (naam.length < 2) return { status: 400, error: 'Hoe heet deze instelling?' };
    const plaats = schoon(b.plaats, 60);
    if (!plaats) return { status: 400, error: 'In welke plaats zit deze instelling?' };
    const beheerder = schoon(b.beheerder, 60);
    if (!beheerder) return { status: 400, error: 'Op wiens naam komt de eerste beheer-inlog te staan?' };
    const beheerLid = accounts.findByLogin(schoon(b.beheerderLogin, 120));
    const legacyPin = !!(accounts.legacyStaffPinToegestaan && accounts.legacyStaffPinToegestaan());
    if ((!beheerLid || (accounts.isActief && !accounts.isActief(beheerLid))) && !legacyPin)
      return { status: 409, error: 'Koppel de eerste beheerder aan een bestaand actief RTG-account.',
        uitleg: 'Vul bij beheerder ook diens persoonlijke RTG-login in. De beheerder logt daarna met dat eigen account in; er wordt geen aparte PIN uitgegeven.' };
    if ((db.data.suppliers || []).some(s => s && s.type === genre &&
        String(s.name || '').toLowerCase() === naam.toLowerCase()))
      return { status: 409, error: 'Deze instelling is al aangesloten.' };

    // het genre moet in supplierTypes staan; de definitie komt uit het register
    register.zetGenre(db, genre);

    const code = makeSupplierCode(naam);
    const s = { code, name: naam, type: genre, city: plaats, loc: null, rate: 0, menu: [], online: false,
      aangeslotenDoor: String(door || 'boardroom').slice(0, 60), aangeslotenAt: nu() };
    ensureSupplierDefaults(s);
    db.data.suppliers.push(s);
    save();

    const pin = legacyPin ? accounts.makePin() : null;
    if (legacyPin) {
      await accounts.createStaff({ supplierCode: code, name: beheerder, role: 'manager',
        func: 'Beheer', pin, ...(beheerLid ? { memberId: beheerLid.id, memberTier: beheerLid.tier } : {}) });
    } else {
      accounts.createAccountStaff({ supplierCode: code, name: beheerder, role: 'manager',
        func: 'Beheer', memberId: beheerLid.id, memberTier: beheerLid.tier });
    }
    return { ok: true, code, ...(legacyPin ? { pin } : {}), naam, genre, plaats,
      toegang: legacyPin ? 'magnaat-test-pin' : 'persoonlijk-rtg-account',
      // wat er NU staat, in plaats van "geregeld": de instelling is er, en moet
      // zichzelf nog inrichten voordat leden hem zien
      vervolg: legacyPin
        ? 'De instelling staat op de kaart en is nog OFFLINE. Geef de testcode en test-PIN aan de beheerder.'
        : 'De instelling staat op de kaart en is nog OFFLINE. De beheerder logt met het gekoppelde persoonlijke RTG-account in en richt de pagina in.' };
  }

  return { instelling: { instellingGenres, instellingen, instellingAansluiten } };
}

module.exports = { maakInstelling };
