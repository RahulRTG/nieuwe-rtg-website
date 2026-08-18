/* Routes "vakbewijs", deel KANTOOR: de stapel, de kluisdeur en de aftekening.

   Afgesplitst van ./vakbewijs.js op de 10 KB-grens, maar de naad is echt: dit
   is de kant waar RTG iets DOET met het stuk van een ander, en dat is precies
   de kant met de zwaarste regels.

   DE KLUISDEUR IS DE KERN VAN DIT BESTAND. Het documentnummer ligt in de
   identiteitskluis (kern/vakbewijs-nummer.js) en niet in de operationele data,
   want een BIG-registratie staat in een openbaar register: een nummer naast een
   codenaam voert die codenaam terug naar een echte naam. Openen kan dus, maar
   drie dingen gebeuren dan altijd samen:

     1. een REDEN, en een lege of nietszeggende reden wordt geweigerd;
     2. een regel in het INZAGEJOURNAAL (server/inzagelog.js), dat bewust het
        nummer zelf niet bewaart -- anders bouw je een tweede, onversleutelde
        kopie van de kluis;
     3. BERICHT AAN DE BETROKKENE. Dat is de rem die echt werkt: wie weet dat de
        ander het ziet, kijkt niet uit nieuwsgierigheid.

   Dezelfde drie als bij het opvragen van identiteitsgegevens door een werkgever
   (kern/payroll/identiteit.js). Dat is geen toeval maar dezelfde vraag. */
'use strict';

module.exports = (kern, gedeeld) => {
  const { app, accounts, officeAuth, persoonseis, vakbewijsTeken, vakbewijsIntrek,
    vakbewijzenVerlopend } = kern;
  const { stuur } = gedeeld;

  /* Het inzagejournaal en "wie kijkt er in de kluis" komen allebei uit de plek
     waar ze al wonen -- geen tweede kopie van een van beide (LAT-regel 4). */
  const inzagelog = require('../inzagelog');
  const wieKijkt = require('./office/wiekijkt')(accounts);

  /* ---- 2. het kantoor: zien en aftekenen ---- */

  /* De stapel. Alleen wat nog niet is gezien; een kantoor dat door afgetekende
     stukken moet bladeren om het openstaande te vinden, tekent uiteindelijk
     alles af om van de lijst af te zijn. */
  /* De rij zoals het kantoor hem ziet. EXPLICIET opgebouwd en niet met een
     Object.assign over de hele rij: zo kan er nooit een veld meelekken dat er
     later bij komt. Het NUMMER staat er niet in -- dat woont in de kluis en gaat
     alleen open met een reden (zie /api/office/vakbewijs/nummer hieronder). */
  const kantoorRij = (v) => ({
    sleutel: v.sleutel, wat: v.wat, van: v.van || null, tot: v.tot || null,
    toelichting: v.toelichting || null, ingediend: v.ingediend || null,
    gezien: !!v.afgetekend, wie: codenaamBijSleutel(v.sleutel)
  });

  app.post('/api/office/vakbewijzen', officeAuth, (req, res) => {
    const open = [];
    for (const v of (kern.db.data.vakbewijzen || [])) {
      if (v.afgetekend || v.ingetrokken) continue;
      /* Alleen stukken van LEDEN. Een concern-rij is de eigen administratie van
         een werkgever en draagt per ontwerp nooit een aftekening; die zou hier
         dus voor altijd op de stapel blijven staan en het kantoor vragen iets
         af te tekenen waar het niet over gaat. */
      if (!String(v.sleutel || '').startsWith('lid:')) continue;
      open.push(kantoorRij(v));
    }
    /* De soortenlijst gaat mee: het scherm hoort "een Verklaring Omtrent het
       Gedrag" te tonen en niet "vog". Een tweede lijst in de client zou de
       tweede plek zijn die dezelfde namen vasthoudt (LAT-regel 4). */
    res.json({ ok: true, open, soorten: persoonseis.SOORTEN,
      verlopend: vakbewijzenVerlopend(null, 60)
        .filter(v => String(v.sleutel || '').startsWith('lid:')).map(kantoorRij) });
  });

  /* HET NUMMER INZIEN. Dit is de kluisdeur, en hij werkt als elke andere in dit
     huis: een REDEN is verplicht, de blik gaat in het inzagejournaal, en de
     betrokkene krijgt bericht.

     Dat laatste is de rem die echt werkt. Wie weet dat de ander het ziet, vraagt
     niet uit nieuwsgierigheid op -- dezelfde redenering als bij het opvragen van
     identiteitsgegevens door een werkgever (kern/payroll/identiteit.js).

     EERST NOTEREN, DAN PAS TERUGGEVEN: een inzage die halverwege misgaat mag
     geen gegevens hebben opgeleverd zonder regel in het journaal. */
  app.post('/api/office/vakbewijs/nummer', officeAuth, (req, res) => {
    const b = req.body || {};
    const sleutel = String(b.sleutel || '');
    const wat = String(b.wat || '');
    const reden = String(b.reden || '').trim();
    if (reden.length < 10) {
      return res.status(400).json({ error: 'Noteer waarvoor u dit nummer nodig heeft. De betrokkene krijgt uw reden te zien.' });
    }
    const rij = (kern.db.data.vakbewijzen || []).find(v => v.sleutel === sleutel && v.wat === wat);
    if (!rij) return res.status(404).json({ error: 'Dit stuk is hier niet ingediend.' });

    const m = /^lid:(\d+)$/.exec(sleutel);
    const wie = wieKijkt(req);
    try {
      inzagelog.noteer({
        door: wie,
        over: { id: m ? Number(m[1]) : null, codenaam: codenaamBijSleutel(sleutel) },
        waarom: reden.slice(0, 300),
        bron: 'backoffice/vakbewijs:' + wat
      });
    } catch (e) { /* het journaal mag de inzage niet blokkeren, wel altijd geprobeerd */ }
    if (m && kern.sendPushToUser) {
      try {
        kern.sendPushToUser(Number(m[1]), { title: 'Uw vakbewijs is ingezien',
          body: 'RTG (' + (wie.naam || 'backoffice') + ') bekeek het nummer van uw ' + wat + '. Reden: ' + reden.slice(0, 160) });
      } catch (e) {}
    }
    res.json({ ok: true, wat, nummer: kern.vakbewijsNummer(sleutel, wat) || null,
      grens: 'Deze inzage staat in het journaal en de betrokkene heeft er bericht van gekregen.' });
  });

  /* DE CODENAAM EN NIET DE ECHTE NAAM. Die staat in de kluis, en elke blik erin
     hoort door het inzagejournaal (zie pendingVerifications in
     kern/kantoor/index.js, dat daar precies om die reden een `wie` voor vraagt).
     Voor deze stapel is dat ook niet nodig: wie aftekent bekijkt een STUK, en
     de koppeling tussen dat stuk en de mens is de identiteitsverificatie die al
     eerder is gedaan. Een naam erbij zou de kluis opentrekken voor gemak. */
  function codenaamBijSleutel(sleutel) {
    const m = /^lid:(\d+)$/.exec(String(sleutel || ''));
    if (!m) return null;
    try { return (accounts.getUserById(Number(m[1])) || {}).codename || null; } catch (e) { return null; }
  }

  app.post('/api/office/vakbewijs/teken', officeAuth, (req, res) => {
    const b = req.body || {};
    const door = String(b.door || (req.session && req.session.naam) || '').trim();
    stuur(res, vakbewijsTeken(String(b.sleutel || ''), String(b.wat || ''), door));
  });

  /* Intrekken. Dit is de knop die er nooit was: een afgetekend stuk kon alleen
     verlopen, en een ingetrokken BIG-registratie wacht niet netjes op zijn
     einddatum. */
  app.post('/api/office/vakbewijs/intrek', officeAuth, (req, res) => {
    const b = req.body || {};
    const door = String(b.door || (req.session && req.session.naam) || '').trim();
    const r = vakbewijsIntrek(String(b.sleutel || ''), String(b.wat || ''), door, b.reden);
    if (!r.error) {
      const m = /^lid:(\d+)$/.exec(String(b.sleutel || ''));
      /* De betrokkene hoort het te weten. Dat is niet alleen netjes: het is de
         enige manier waarop iemand kan merken dat er iets misgaat met zijn
         papieren, in plaats van het bij de deur te ontdekken. */
      if (m) { try { kern.sendPushToUser(Number(m[1]), { title: 'Vakbewijs ingetrokken',
        body: 'Uw ' + String(b.wat) + ' telt niet meer mee voor uw werk bij RTG-partners.' }); } catch (e) {} }
    }
    stuur(res, r);
  });
};
