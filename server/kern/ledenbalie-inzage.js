/* DE INZAGE ZELF -- zoeken en het dossier, allebei achter hetzelfde spoor.

   Los van ./ledenbalie.js langs de naad die deze reparatie zelf heeft
   getrokken. De balie had er al drie: toegang (./ledenbalie-zetels.js), eigen
   administratie (./ledenbalie-zaken.js) en de vertaling naar een steuncode
   (./ledenbalie-pseudoniem.js). Wat overbleef was "wat kijkt er in de kluis",
   en dat is sinds 13 september 2026 een subject met een eigen regel:

     GEEN AANTOONBAAR JOURNAAL, GEEN INZAGE.

   Hier stond `try { inzagelog.noteer(...); } catch (e) {}` en daarna gewoon het
   antwoord. Drie dingen konden stil misgaan, en bij alle drie kreeg de
   medewerker de gegevens terwijl er geen regel stond: een uitzondering
   verdween in de lege catch; zonder database legde noteer() de regel in een
   verse array die meteen daarna werd weggegooid, met een geslaagde terugkeer;
   en ook zonder uitzondering betekent save() niet dat er iets STAAT -- binnen
   een bundel zet hij alleen een vlag, en in PostgreSQL-modus markeert hij dat
   de responsepoort later moet committen. Uitgevoerd, geaccepteerd, gecommit en
   duurzaam bewezen zijn vier dingen, en de code las ze als een.

   DE PLEK IS GEKOZEN EN NIET TOEVALLIG. Niet in de poort ervoor
   (kern/kantoor/kluispoort.js, balieAuth): die kent de MENS maar niet het
   onderwerp en niet de reden. Een garantie hoort waar alle informatie ervoor
   samenkomt, en dat is hier -- waar WIE, WAAROM en OVER WIE tegelijk bekend
   zijn. En niet in inzagelog zelf: dat weet niet wat er zou worden getoond, en
   een poort die weigert zonder te weten waarover, weigert het verkeerde. Het
   journaal levert een UITSLAG; deze module beslist.

   Beproefd in test/ledenbaliespoor.test.js, met de mutatie: haal de
   spoor-poort eruit en /api/office/balie/dossier levert onder `schrijf-verloren`
   weer 200 met de codenaam erin. */
'use strict';

module.exports = ({ inzagelog, kort, redenOf, lidOf, geenReden, geenLid, accounts,
                    steuncodeVan, stadVan, aboVan, klachtenVan, pasVan }) => {
  /* ---------- zoeken ---------- */
  /* Op codenaam of op steuncode. `door` hoort niet bij de zoekvraag maar bij
     het spoor: zonder wie er keek is een journaalregel een half antwoord. */
  async function balieZoek({ codenaam, steuncode, door } = {}) {
    const c = kort(codenaam, 60).toLowerCase();
    const s = kort(steuncode, 20).toUpperCase().replace(/\s+/g, '');
    if (!c && !s) return { status: 400, error: 'Zoek op codenaam of op de steuncode van het lid.' };
    if (c && c.length < 2) return { status: 400, error: 'Geef minstens twee tekens van de codenaam.' };
    const rijen = accounts.ledenRegisterRijen ? accounts.ledenRegisterRijen(20000) : [];
    const treffers = rijen.filter(r =>
      (c && String(r.codename || '').toLowerCase().includes(c)) || (s && steuncodeVan(r.key) === s)
    ).slice(0, 20).map(r => {
      const u = lidOf(r.id);
      return { id: r.id, key: r.key, codename: r.codename || null, pas: pasVan(r.tier),
        land: r.land || null, stad: stadVan(r.key), sinds: (u && u.created_at) || null };
    });
    /* Een lijstscherm hoort als EEN regel in het journaal (zie noteerVeel);
       twintig losse regels per zoekopdracht verdrinken het echte signaal.

       En ook hier: geen aantoonbaar spoor, geen treffers. Een zoekopdracht
       toont de codenaam, de pas, het land en de stad van maximaal twintig
       leden; dat zonder spoor laten passeren is precies de weg waarlangs men
       een dossier leest zonder het te openen. Vindt hij niemand, dan is er
       niets in te zien en gaat het antwoord gewoon door -- noteerVeelVast()
       houdt "leeg" en "mislukt" met opzet uit elkaar. */
    const spoor = await inzagelog.noteerVeelVast({ door, overIds: treffers.map(t => t.id),
      waarom: 'Ledenbalie: lid opzoeken', bron: 'ledenbalie/zoek' });
    if (!spoor.ok) return { status: spoor.status || 503, error: spoor.error, spoor: spoor.reden };
    return { ok: true, treffers };
  }

  /* ---------- dossier ---------- */
  /* GEEN AANTOONBAAR JOURNAAL, GEEN INZAGE -- en dat is hier een harde volgorde
     en geen gebaar.

     Hier stond `try { inzagelog.noteer(...) } catch (e) {}` en daarna gewoon het
     dossier. Drie dingen konden daardoor stil misgaan, en bij alle drie kreeg de
     medewerker het dossier te zien terwijl er geen spoor was: een uitzondering
     verdween in de lege catch; zonder database legde noteer() de regel in een
     verse array die meteen daarna werd weggegooid; en ook zonder uitzondering
     betekent save() niet dat er iets STAAT (binnen een bundel zet hij alleen een
     vlag). Het hele privacy-ontwerp van dit huis leunt op dat spoor, en het was
     de goedkoopste van de twee beloftes om te breken.

     DE PLEK IS GEKOZEN EN NIET TOEVALLIG. Niet in de poort ervoor: die kent de
     mens maar niet het onderwerp en niet de reden, en een garantie hoort waar
     alle informatie ervoor samenkomt -- hier, waar WIE, WAAROM en OVER WIE
     tegelijk bekend zijn. Niet in inzagelog zelf: dat weet niet wat er zou
     worden getoond, en een poort die weigert zonder te weten waarover, weigert
     het verkeerde. Het journaal levert een uitslag; deze functie beslist.

     ASYNC GEWORDEN, EN DAT IS DE PRIJS. De duurzame commit is synchroon met een
     fsync eronder; wachten is precies wat hem bewijskracht geeft. De route liep
     al door een `veilig()` die een belofte afwacht, dus de vorm hoefde niet om. */
  async function balieDossier(id, { door, reden } = {}) {
    const r = redenOf(reden);
    if (!r) return geenReden;
    const u = lidOf(id);
    if (!u) return geenLid;
    const spoor = await inzagelog.noteerVast({
      door, over: { id: u.id, codenaam: u.codename }, waarom: r, bron: 'ledenbalie/dossier' });
    if (!spoor.ok) return { status: spoor.status || 503, error: spoor.error, spoor: spoor.reden };
    /* Veld voor veld opgebouwd, nooit een spread van de accountrij. Dat is het
       verschil tussen "we tonen deze acht dingen" en "we tonen alles wat er
       morgen aan kolommen bij komt" -- en die kolom is een keer het
       telefoonnummer. */
    return { ok: true, lid: {
      codename: u.codename || null,
      pas: pasVan(u.tier),
      land: (accounts.getMemberState ? (accounts.getMemberState(u.id) || {}) : {}).land || null,
      stad: stadVan('user-' + u.id),
      sinds: u.created_at || null,
      abo: aboVan(u),
      klachten: klachtenVan(u.id),
      steuncode: steuncodeVan('user-' + u.id)
    } };
  }

  return { balieZoek, balieDossier };
};
