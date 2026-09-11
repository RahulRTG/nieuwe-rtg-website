/* ============================================================================
   EEN SCHEMA VAN EEN BEVOEGDE VAKMAN -- RUGDEKKING.md par. 4.4, besluit 4.

   HET PROBLEEM. `kern/trainingsschema.js` houdt een schema vast en schrijft er
   met zoveel woorden bij wat er NIET in zit: geen belastingsmodel, geen
   hartslagzones, geen opbouw. De reden staat in `kern/zorgniveau.js`: dat is
   het niveau `professioneel`, waar RTG *"mag helpen de weg te vinden, niet de
   inhoud te geven"*. Terecht -- en het liet een gat achter.

   Want `vanWie` op een schema is vandaag VRIJE TEKST die het lid zelf intypt.
   "Mijn fysio" is daarmee een bewering en geen bevoegdheid: er is geen enkele
   weg waarlangs een aantoonbaar bevoegde professional iets in het dossier van
   een lid kan zetten. RTG mag geen inhoud geven, en de mens die dat wel mag kon
   er niet bij.

   DE UITWEG IS NIET EEN UITZONDERING OP DE GRENS MAAR DE PROFESSIONAL IN HET
   SYSTEEM (RUGDEKKING.md par. 4.4). `kern/persoonseis.js` en `kern/vakbewijs.js`
   doen dat werk al voor recepten en verwijzingen: per genre vastleggen dat de
   MENS die de handeling doet bevoegd is, met een stuk dat verloopt en bij elke
   vraag opnieuw wordt gerekend. Dit bestand hangt er een derde handeling aan.
   `zorgniveau.js` verandert geen letter: RTG geeft nog steeds geen inhoud.

   VIER DINGEN DIE HIER NIET MOGEN SNEUVELEN.

   1. DE VAKMAN STELT VOOR, HET LID BEVESTIGT. Een voorstel komt NIET in het
      schema van het lid terecht (LIFE.md: samenstellen en klaarzetten --
      bevestigen doet de mens). Wie dat omdraait, geeft een derde schrijfrecht
      in andermans dossier.

   2. EEN VOORSTEL VERKLAPT NIET OF EEN CODENAAM BESTAAT. Deze weg staat open
      voor elke zaak met een bevoegde medewerker, en een antwoord dat verschilt
      tussen "bestaat" en "bestaat niet" maakt er een zoekmachine naar leden van.
      Het antwoord is daarom hetzelfde, en dat staat er hardop bij in plaats van
      dat het als succes wordt gepresenteerd.

   3. DE VAKMAN LEEST NIETS. Er is geen functie hier die iets van het lid
      teruggeeft -- geen metingen, geen ander schema, geen of het is aanvaard.
      Hij ziet alleen wat hij zelf heeft gestuurd. Wie hier een leesweg bij zet,
      bouwt een dossierinzage zonder machtiging.

   4. EN DE BETALER LEEST DE GEZONDHEID NOOIT (RUGDEKKING.md grens 8). Er loopt
      geen enkele draad van `kern/rugdekking` hierheen, en die hoort er ook niet
      te komen: dat RTG achter een sporter staat, geeft RTG geen blik op zijn
      knie.

   WAT DIT MET OPZET NIET IS: een raamwerk waarin "een bevoegde professional
   inhoud geeft". Het is EEN handeling, voor een schema, omdat dat de plek is
   waar het gat gemeten kon worden. Een tweede handeling verdient zijn eigen
   meting en zijn eigen regels.
   ========================================================================== */
'use strict';

const MAX_OPEN = 20;



module.exports = ({ db, save, crypto, schoon, findSupplier, persoonseis, keyVanCodenaam, trainingZet }) => {
  const scho = schoon || ((v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 200));
  const nu = () => new Date().toISOString();
  const id = () => 'vs' + crypto.randomBytes(5).toString('hex');

  /* Het opslagcontract van dit domein (kern/eigencollectie.js). Een kaart van
     ledensleutel naar zijn openstaande en beslisde voorstellen, en niemand
     anders schrijft erin -- keuringsregel 63 bewaakt dat. `kijk()` maakt met
     opzet niets aan: een vakman die een voorstel stuurt naar een codenaam die
     niet bestaat, hoort geen lege rij achter te laten die verraadt dat er naar
     gevraagd is. */
  const eigen = require('./eigencollectie')({ db, domein: 'kern/vakschema',
    bezit: { vakschema: 'kaart' } });
  const bak = () => eigen.bak('vakschema');
  const kijk = () => eigen.kijk('vakschema') || {};
  const rij = (key) => { const b = bak(); if (!Array.isArray(b[key])) b[key] = []; return b[key]; };

  const persoonMag = require('./vakschema-poort')({ findSupplier, persoonseis });

  /* ---------- de vakman ---------- */

  async function voorstel(code, data, actor) {
    const mag = persoonMag(code, actor);
    if (!mag.ok) {
      return { status: 403, error: mag.error || 'Hiervoor is een eigen bevoegdheid nodig.',
        persoonseis: mag.missend || mag.reden || true };
    }
    const d = data || {};
    const naam = scho(d.naam, 80);
    const wat = scho(d.wat, 600);
    if (naam.length < 2 || wat.length < 5) {
      return { status: 400, error: 'Zet er een naam en een omschrijving bij; een leeg schema helpt niemand.' };
    }
    const zaak = findSupplier(code) || {};
    const mens = scho(d.mens, 80);
    const gevonden = keyVanCodenaam ? await keyVanCodenaam(mens) : null;
    const key = gevonden && gevonden.key;

    /* HETZELFDE ANTWOORD, BESTAAT DE CODENAAM OF NIET. Zie punt 2 in de kop:
       een verschil hier maakt van deze route een zoekmachine naar leden. Het
       antwoord zegt daarom wat het WEL weet en doet niet alsof het meer weet. */
    const antwoord = { status: 200, klaargezet: true,
      let: 'Hoort deze codenaam bij een lid van RTG, dan ziet hij uw voorstel staan en kan hij het ' +
        'aannemen of weigeren. Of dat zo is, krijgt u van ons niet te horen -- en u hoort het pas ' +
        'als hij het zelf aanneemt.' };
    if (!key) return antwoord;

    const r = rij(key);

    /* DE DUBBELKLIK, en hij moest hier anders worden opgelost dan elders. De
       ronde vond 0 -> 2: twee identieke kaarten in de inbox van een ander, en
       dat is andermans scherm dat je volzet.

       Een 409 zou hier een LEK zijn. "Deze stond er al" bestaat alleen als de
       codenaam bestaat, dus dat antwoord verklapt precies wat punt 2 in de kop
       geheim houdt. De tweede oproep doet daarom NIETS en krijgt exact hetzelfde
       antwoord -- wat voor de afzender ook het eerlijke antwoord is: zijn
       voorstel staat klaar, een keer. */
    const zelfde = (v) => v.stand === 'open' && v.zaak === scho(zaak.code, 40) &&
      v.naam === naam && v.wat === wat;
    if (r.some(zelfde)) return antwoord;

    if (r.filter(v => v.stand === 'open').length >= MAX_OPEN) {
      /* Ook dit antwoord verschilt niet: een volle rij is een eigenschap van het
         lid, en die hoort een vreemde niet te kunnen aflezen. */
      return antwoord;
    }
    r.push({ id: id(), at: nu(), stand: 'open',
      zaak: scho(zaak.code, 40), zaakNaam: scho(zaak.name || zaak.code, 80),
      genre: scho(zaak.type, 40),
      door: scho((actor && actor.name) || 'een medewerker', 80),
      naam, wat, dagen: scho(d.dagen, 40) || null, duurMin: Number(d.duurMin) || null });
    save();
    return antwoord;
  }

  /* Wat DEZE zaak zelf heeft klaargezet. Met opzet geen stand en geen lid erbij:
     de vakman ziet zijn eigen verzonden post en nooit wat het lid ermee deed.
     Zie punt 3 in de kop. */
  function mijnVoorstellen(code, actor) {
    const mag = persoonMag(code, actor);
    if (!mag.ok) {
      return { status: 403, error: mag.error || 'Hiervoor is een eigen bevoegdheid nodig.',
        persoonseis: mag.missend || mag.reden || true };
    }
    const zc = scho(code, 40);
    const uit = [];
    for (const lijst of Object.values(kijk())) {
      for (const v of (Array.isArray(lijst) ? lijst : [])) {
        if (v.zaak === zc) uit.push({ id: v.id, at: v.at, naam: v.naam, door: v.door });
      }
    }
    uit.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return { status: 200, voorstellen: uit,
      let: 'U ziet wat u heeft gestuurd. Of een lid het heeft aangenomen, staat er niet bij: dat is ' +
        'zijn dossier en niet het uwe.' };
  }

  /* De ledenkant staat in ./vakschema-lid.js. De knip loopt langs de PARTIJ en
     niet langs een getal: hier stuurt een zaak iets, daar beslist een mens erover.
     Dat die twee uit elkaar staan is de hele opzet van deze laag -- en het
     bestand liep bovendien over de 10 kB van keuringsregel 13, wat doorgaans
     zegt dat er een tweede onderwerp in zit. Dat klopte hier. */
  const lid = require('./vakschema-lid')({ kijk, save, scho, nu, trainingZet });

  return { vakschema: { voorstel, mijnVoorstellen,
    mijn: lid.mijn, aanvaard: lid.aanvaard, weiger: lid.weiger } };
};
