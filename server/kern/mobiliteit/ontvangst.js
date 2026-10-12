/* Mobility OS (deelmodule): wat de REIZIGER zelf over zijn rit zegt.

   DE CHAUFFEUR MELDT, DE REIZIGER BEVESTIGT, EN DAT ZIJN TWEE DINGEN. Tot
   12 oktober 2026 was `aangekomen` het enige spoor van een aankomst, en die
   stand zet de chauffeur (driver.arrived). Een melding van de leverancier is
   geen bewijs dat de dienst bij de klant is aangekomen: een serverbon zegt niet
   dat er een auto voor de deur staat. Besluit van de eigenaar: de chauffeur mag
   aankomst blijven melden, maar wat het lid bevestigt staat ernaast, apart en
   met zijn eigen tijd -- en het lid kan zeggen dat er iets niet klopt.

   WAAROM GEEN NIEUWE STAND IN DE KETEN. De keten (./keten.js) is het verloop
   van de opdracht, en daar hangt geld aan. Een bevestiging van de reiziger
   houdt de rit niet tegen en schuift hem niet door; ze legt vast wat een
   TWEEDE partij zegt. Een stand `bevestigd` erbij zou de chauffeur laten
   wachten op een lid dat zijn telefoon in zijn tas heeft.

   TWEE BEVESTIGINGEN, EN ALLEEN NA DE MELDING WAAR ZE OP SLAAN:
     aankomst    "mijn chauffeur is er": pas als de chauffeur aankomst meldde
     aflevering  "ik ben aangekomen": pas als de rit voltooid is
   Een bevestiging zonder melding ervoor zou de volgorde omdraaien: dan
   bevestigt het lid iets wat niemand heeft beweerd.

   EEN PROBLEEM IS EEN MELDING EN GEEN OORDEEL. De soort komt uit een gesloten
   lijst; het systeem zet de rit er niet op incident, annuleert niets en betaalt
   niets terug. Een mens van RTG (de dispatch) ziet het en beslist. Bij
   `onveilig` zegt het antwoord dat de veiligheidsknop de snelle weg is: die
   bestaat al (RTG Veilig) en hoort hier niet nagebouwd te worden. */
'use strict';

const BEVESTIG_NA = {
  aankomst: ['aangekomen', 'ingestapt', 'rijdt', 'voltooid', 'afgerekend', 'incident'],
  aflevering: ['voltooid', 'afgerekend']
};
const PROBLEMEN = Object.freeze({
  'niet-aangekomen': 'De chauffeur meldde aankomst, maar is er niet.',
  'ander-voertuig': 'Er staat een ander voertuig dan aangekondigd.',
  'andere-chauffeur': 'Er komt een andere chauffeur dan aangekondigd.',
  'niet-afgeleverd': 'De rit is als voltooid gemeld, maar ik ben niet op mijn bestemming.',
  'onveilig': 'Ik voel me niet veilig.',
  'anders': 'Er klopt iets anders niet.'
});

/* Wat elk scherm over de ontvangst laat zien: wie zei wat, en wanneer. Een
   melding van de chauffeur en een bevestiging van de reiziger staan naast
   elkaar en worden nooit samengevoegd tot een vinkje. */
function ontvangstBeeld(o) {
  const r = o.reizigerZegt || {};
  return {
    aankomst: { gemeldDoorChauffeur: o.aangekomenAt || null, bevestigdDoorReiziger: r.aankomst || null },
    aflevering: { gemeldDoorChauffeur: o.voltooidAt || null, bevestigdDoorReiziger: r.aflevering || null },
    problemen: (r.problemen || []).map(p => ({ soort: p.soort, wat: PROBLEMEN[p.soort], at: p.at, toelichting: p.toelichting || null }))
  };
}

module.exports = (ctx) => {
  const { save, nu, schoon, notify, opdrachtMet, sseToOffice, sseToCustomer } = ctx;

  function vanMij(sess, ref) {
    const o = opdrachtMet(schoon(ref, 30));
    if (!o) return { fout: { status: 404, error: 'Opdracht niet gevonden.' } };
    if (o.reiziger !== (sess && sess.key)) return { fout: { status: 403, error: 'Dit is uw rit niet.' } };
    return { o };
  }
  function spoor(o, soort, extra) {
    o.gebeurtenissen = (o.gebeurtenissen || []).concat([Object.assign({ soort, at: nu(), door: 'reiziger' }, extra || {})]);
  }

  /* Bevestigen. Hetzelfde nog eens verandert niets: de eerste tijd blijft. */
  function ontvangstBevestig(sess, body) {
    const { o, fout } = vanMij(sess, body.ref); if (fout) return fout;
    const wat = String(body.wat || '');
    if (!BEVESTIG_NA[wat]) return { status: 400, error: 'Bevestig de aankomst of de aflevering.' };
    if (!BEVESTIG_NA[wat].includes(o.status)) {
      return { status: 409, error: wat === 'aankomst'
        ? 'De chauffeur heeft nog geen aankomst gemeld. Is hij er toch, meld dan wat er niet klopt.'
        : 'De rit is nog niet als voltooid gemeld.' };
    }
    o.reizigerZegt = o.reizigerZegt || {};
    if (o.reizigerZegt[wat]) return { ok: true, gewijzigd: false, ontvangst: ontvangstBeeld(o) };
    o.reizigerZegt[wat] = nu();
    spoor(o, wat === 'aankomst' ? 'passenger.confirmed_arrival' : 'passenger.confirmed_dropoff');
    save();
    sseToOffice('sync', { scope: 'mobiliteit' });
    return { ok: true, gewijzigd: true, ontvangst: ontvangstBeeld(o) };
  }

  /* Een probleem melden. Een mens van RTG ziet het; er wordt niets vanzelf
     geannuleerd, op incident gezet of terugbetaald. */
  function ontvangstProbleem(sess, body) {
    const { o, fout } = vanMij(sess, body.ref); if (fout) return fout;
    const soort = String(body.soort || '');
    if (!PROBLEMEN[soort]) return { status: 400, error: 'Kies wat er niet klopt: ' + Object.keys(PROBLEMEN).join(', ') + '.' };
    o.reizigerZegt = o.reizigerZegt || {};
    const lijst = o.reizigerZegt.problemen = o.reizigerZegt.problemen || [];
    if (lijst.some(p => p.soort === soort)) return { ok: true, gewijzigd: false, ontvangst: ontvangstBeeld(o) };
    if (lijst.length >= 6) return { status: 409, error: 'Er staan al zes meldingen bij deze rit; de dispatch kijkt ernaar.' };
    lijst.push({ soort, at: nu(), toelichting: schoon(body.toelichting, 300) || null });
    spoor(o, 'passenger.reported_problem', { probleem: soort });
    save();
    sseToOffice('sync', { scope: 'mobiliteit' });
    if (o.reiziger) {
      notify(o.reiziger, { icon: 'auto', title: 'RTG Vervoer', scope: 'mobiliteit',
        body: 'Uw melding is binnen. Een mens van RTG kijkt ernaar; er is nog niets aan de rit veranderd.' });
      sseToCustomer(o.reiziger, 'sync', { scope: 'mobiliteit' });
    }
    return { ok: true, gewijzigd: true, ontvangst: ontvangstBeeld(o),
      ookNu: soort === 'onveilig' ? 'Voelt u zich nu onveilig, gebruik dan de veiligheidsknop in RTG Veilig of bel 112.' : null };
  }

  return { ontvangstBevestig, ontvangstProbleem };
};
module.exports.ontvangstBeeld = ontvangstBeeld;
module.exports.PROBLEMEN = PROBLEMEN;
