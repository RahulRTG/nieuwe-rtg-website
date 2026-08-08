/* ========= HET GASTCONTACT VERHUIST NAAR DE KERN =========

   De derde voorraad, en de eerste waarin een LID en een ZAAK samen in een
   gesprek zitten: aan de ene kant een codenaam, aan de andere kant een
   bedrijf. Precies het gesprek waarvoor ./wie.js is gemaakt -- en precies het
   gesprek waar een fout twee kanten op lekt.

   Dezelfde drie regels als bij ./dm.js en ./collega.js: een gesprek per lijn
   uit de kern, de geschiedenis eenmalig mee op het moment dat de lijn toch al
   wordt geopend, en de oude voorraad blijft staan.

   DRIE DINGEN ZIJN HIER EIGEN, en alle drie zouden ze stil misgaan:

   1. DE AFDELING HOORT BIJ HET GESPREK. Een hotel heeft Receptie,
      Roomservice, Housekeeping, Onderhoud en Security, en dat waren vijf
      aparte lijnen -- de oude sleutel was CODE|lid|afdeling. Vallen ze samen,
      dan leest Housekeeping mee met wat je aan Security schreef. De sleutel
      draagt de afdeling dus mee, letterlijk dezelfde als vroeger, zodat
      importeer() de oude lijn ook terugvindt.

   2. TWEE TELLERS, EEN PER KANT. unreadGuest en unreadPartner. De kern houdt
      "gelezen tot" per DEELNEMER bij, dus dat komt vanzelf goed -- zolang je
      ze ook echt als twee behandelt. Een gedeelde stand zou de ene kant een
      badge geven die van de andere was.

   3. HET SYSTEEMBERICHT HEEFT GEEN AFZENDER. "U heeft nu een open lijn met X"
      stond er als from:'systeem'. De kern EIST dat een afzender deelnemer is
      -- dat is de poort, en die zetten we niet open voor een uitzondering.
      Dus staat de zaak eronder, met soort 'systeem', en gaat het in de oude
      vorm weer als 'systeem' naar buiten. Eerlijker dan een lege afzender:
      de regel gaat over die zaak en komt uit haar systeem.

   WAT HIER NIET IN ZIT: de controles en de bijwerking eromheen. Of de gastchat
   aanstaat bij deze zaak, of het lid geen gast is, de vertaling, de melding
   aan het personeel en het activiteitenlog -- dat blijft in de routes
   (member/terplaatse.js en supplier/gastcontact.js) staan. Die gaan over de
   zaak en niet over berichten. */
'use strict';

const wie = require('./wie');
const { maakGastVerhuizing } = require('./gast-verhuizing');
const { maakGastLijsten } = require('./gast-lijsten');

const MAX_TEKST = 500;      // zoals de oude routes hem afkapten

function maakCommGast({ db, save, comm }) {
  const codeVan = (c) => String(c || '').trim().toUpperCase();
  // exact de oude sleutel (kern/leverancier/gastcontact.js, chatKeyOf)
  const lijnSleutel = (code, key, dept) => codeVan(code) + '|' + key + '|' + (dept || 'Team');
  const zaakVan = (code) => wie.zaak(code);
  const verhuizing = maakGastVerhuizing({ db, save, comm, lijnSleutel, zaakVan });

  /* De vertaling tussen de twee vormen, op EEN plek. `from` was de kant van
     het gesprek ('guest' | 'partner' | 'systeem'); in de kern is dat de
     afzender plus, voor de systeemregel, het soort. */
  const kantVan = (m, lidKey) => (m.soort === 'systeem' ? 'systeem' : (m.van === lidKey ? 'guest' : 'partner'));

  /* `kijker` is 'gast' of 'zaak', en hij bepaalt EEN ding: hoeveel van de naam
     van de medewerker meegaat. Buiten de zaak de voornaam, binnen de zaak de
     hele naam -- dezelfde regel als in de kern (zie ./index.js, toonBericht),
     en om dezelfde reden: een achternaam maakt iemand vindbaar, een voornaam
     maakt hem aanspreekbaar. Vroeger ging hier de hele naam naar de gast,
     want het personeelsregister draagt "Marta Colom".

     Alleen de kant van de ZAAK wordt geknipt. Wat de gast zelf schreef draagt
     zijn eigen codenaam, en die is al een pseudoniem. */
  const oudeVorm = (m, lidKey, kijker) => {
    const kant = kantVan(m, lidKey);
    const heel = m.who || '';
    return {
      id: m.id, from: kant,
      who: (kant === 'partner' && kijker !== 'zaak') ? wie.voornaam(heel) : heel,
      text: m.tekst || '', lang: m.lang || null, at: m.at
    };
  };

  /* De lijn tussen dit lid en deze zaak, voor deze afdeling. De enige ingang.
     `soort: 'order'` zet hem in de la Onderweg van de inbox -- het gaat over
     iets dat loopt -- en `meta` draagt wat het scherm nodig heeft. */
  function gesprek(code, lidKey, dept, opties) {
    const o = opties || {};
    const c = codeVan(code);
    const g = comm.gesprekMaak({
      soort: 'order', deelnemers: [String(lidKey), zaakVan(c)], door: String(lidKey),
      titel: o.zaakNaam || null,
      meta: { sleutel: 'gast:' + lijnSleutel(c, lidKey, dept), zaak: c,
        dept: dept || 'Team', bron: 'Zaak', codename: o.codename || null,
        /* De pas van het lid reist mee omdat de zaak-route er een melding op
           adresseert. Hij hoort bij de LIJN en niet bij een los record in een
           tweede voorraad -- anders is er weer een plek die dit weet. */
        tier: o.tier || null }
    });
    if (o.codename && g.meta.codename !== o.codename) g.meta.codename = o.codename;
    if (o.tier && g.meta.tier !== o.tier) g.meta.tier = o.tier;
    return verhuizing.importeer(g, c, String(lidKey), dept);
  }

  /* De lijn OPZOEKEN zonder hem aan te leggen, en dat verschil is een
     beveiliging en geen netheid. Er hangt een controle aan ("een zaak mag de
     Salon van een lid alleen zien als er echt een open lijn is"), en die valt
     om zodra de vraag zelf de lijn aanlegt: dan bestaat elke lijn die je
     noemt. Een verzonnen sleutel was zo genoeg geweest om het profiel van elk
     lid op te vragen.

     Een lijn die alleen nog in de OUDE voorraad staat, telt wel als bestaand
     -- die is er immers echt; hij is alleen nog niet verhuisd. Daarom eerst
     daar kijken, en pas dan in de kern. */
  function bestaand(code, lidKey, dept) {
    const c = codeVan(code);
    let oud = null;
    try { oud = (db.data.guestChats || {})[lijnSleutel(c, lidKey, dept)]; } catch (e) {}
    if (oud) return gesprek(c, lidKey, dept);
    return comm.gesprekMetSleutel('gast:' + lijnSleutel(c, lidKey, dept));
  }

  /* Sturen, per kant. Twee functies en geen vlag: wie stuurt bepaalt de
     afzender, en dat is niet iets wat je aan een parameter wilt ophangen die
     iemand per ongeluk andersom zet. */
  function stuurGast(code, lidKey, dept, tekst, codename, opties) {
    return stuur(code, lidKey, dept, tekst, String(lidKey), codename, opties);
  }
  function stuurZaak(code, lidKey, dept, tekst, wieSchreef, opties) {
    return stuur(code, lidKey, dept, tekst, zaakVan(code), wieSchreef, opties);
  }
  function stuur(code, lidKey, dept, tekst, van, who, opties) {
    const o = opties || {};
    const g = gesprek(code, lidKey, dept, { codename: o.codename, tier: o.tier });
    const m = comm.bericht({ gesprekId: g.id, van,
      tekst: String(tekst == null ? '' : tekst).slice(0, MAX_TEKST), lang: o.lang || null });
    /* `who` -- de voornaam van wie er namens de zaak antwoordde -- stond ook in
       de oude vorm en gaat mee zoals hij ging. Het is geen deelnemer en geen
       codenaam; het scherm van de gast toonde hem al. */
    if (who) { m.who = String(who).slice(0, 60); save(); }
    /* De schrijver krijgt zijn eigen bericht terug; hij hoort bij de kant die
       hij zelf koos, dus de zaak ziet de hele naam en de gast de voornaam. */
    return oudeVorm(m, String(lidKey), van === zaakVan(code) ? 'zaak' : 'gast');
  }

  /* De openingsregel van een nieuwe lijn. Van de zaak, met soort 'systeem'. */
  function opening(code, lidKey, dept, tekst, opties) {
    const g = gesprek(code, lidKey, dept, opties);
    const lijst = comm.berichtenVan(g.id);
    if (lijst.length) return null;                 // er staat al iets: geen opening meer
    const m = comm.bericht({ gesprekId: g.id, van: zaakVan(code), tekst: String(tekst || '').slice(0, MAX_TEKST) });
    m.soort = 'systeem';
    save();
    return oudeVorm(m, String(lidKey));
  }

  function berichten(code, lidKey, dept, hoeveel, kijker) {
    const g = gesprek(code, lidKey, dept);
    const lijst = comm.berichtenVan(g.id).filter((m) => !m.weg);
    return lijst.slice(-(hoeveel || 120)).map((m) => oudeVorm(m, String(lidKey), kijker));
  }

  const ongelezenGast = (code, lidKey, dept) =>
    comm.gesprek(String(lidKey), gesprek(code, lidKey, dept).id, { aantal: 500 }).ongelezen;
  const ongelezenZaak = (code, lidKey, dept) =>
    comm.gesprek(zaakVan(code), gesprek(code, lidKey, dept).id, { aantal: 500 }).ongelezen;

  function leesGast(code, lidKey, dept) {
    comm.leesZet(String(lidKey), gesprek(code, lidKey, dept).id, new Date().toISOString()); save();
  }
  function leesZaak(code, lidKey, dept) {
    comm.leesZet(zaakVan(code), gesprek(code, lidKey, dept).id, new Date().toISOString()); save();
  }

  /* De verhuizing van de oude voorraad staat in ./gast-verhuizing.js (dat
     bestand kan weg zodra de laatste lijn binnen is), de twee lijsten in
     ./gast-lijsten.js. De lijsten krijgen gesprek() mee -- dat is hun enige
     manier om een oude lijn binnen te halen, en meteen de reden dat ze niet
     zelf in db.data.guestChats hoeven te schrijven. */
  const lijsten = maakGastLijsten({ db, comm, lijnSleutel, codeVan, zaakVan,
    kantVan, oudeVorm, gesprek });

  return { gesprek, bestaand, stuurGast, stuurZaak, opening, berichten, oudeVorm,
    ongelezenGast, ongelezenZaak, leesGast, leesZaak,
    voorZaak: lijsten.voorZaak, voorLid: lijsten.voorLid, lijnSleutel };
}

module.exports = { maakCommGast };
