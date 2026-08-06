/* Foundation OS, deel "activiteiten": buurtmaaltijden, workshops, sportdagen,
   jongerenavonden, inloopspreekuren en vrijwilligersdagen.

   EEN ACTIVITEIT IS DE PLEK WAAR EEN STICHTING ECHT IETS KAN OVERKOMEN. Niet
   in de boekhouding maar in een gymzaal met veertig kinderen. Deze module is
   daarom niet gebouwd rond "inschrijven" maar rond de vier dingen die op die
   ochtend misgaan:

   1. TE VEEL MENSEN. Vol is geen weigering maar een wachtlijst. Wie afzegt,
      maakt automatisch een plek vrij -- en het systeem zegt wie er opschuift,
      want anders belt niemand die persoon.

   2. EEN KIND ZONDER TOESTEMMING VAN DE OUDERS. Die kan niet inchecken. Niet
      met een waarschuwing: op de ochtend zelf, met een rij bij de deur, is een
      waarschuwing hetzelfde als niets.

   3. GEEN BEGELEIDER MET EEN GELDIGE VOG. Een jeugdactiviteit gaat niet open
      zonder ten minste een begeleider die de VOG-toets doorstaat. Dezelfde
      functie als in vrijwilligers.js -- niet een tweede oordeel dat kan
      afwijken (LAT.md regel 4).

   4. FOTO'S. Toestemming om mee te doen is geen toestemming om op de foto te
      staan. Het zijn twee velden en twee vragen, en dat is met opzet
      onhandiger dan een vinkje: het scheelt precies de foto van het kind dat
      er niet op had gemogen.

   DE INCHECKCODE KOMT UIT DE CSPRNG en staat per inschrijving vast. Dat is de
   QR-code aan de deur. Hij is niet af te leiden uit een volgnummer of een tijd
   (check.js regel 15 gaat over precies die fout in de browser; hier geldt hij
   net zo goed). */

const SOORTEN = ['buurtmaaltijd', 'workshop', 'sportdag', 'jongerenavond', 'inloopspreekuur',
  'fondsenwerving', 'vrijwilligersdag', 'training', 'netwerkbijeenkomst'];
// Waar kinderen komen: dan is een begeleider met geldige VOG een voorwaarde.
const JEUGD = ['sportdag', 'jongerenavond', 'workshop'];
const STATUS = ['gepland', 'open', 'vol', 'bezig', 'afgerond', 'afgelast'];

module.exports = (ctx, eigen) => {
  const { nu, rid, schoon, centen, euro, S, audit, wie, poort, save } = ctx;
  const { vogGeldig } = eigen;

  const A = () => S().activiteiten;
  const vind = id => A().find(a => a.id === String(id || '')) || null;
  const ingeschreven = a => (a.inschrijvingen || []).filter(i => i.status === 'ingeschreven' || i.status === 'aanwezig');
  const wachtlijst = a => (a.inschrijvingen || []).filter(i => i.status === 'wachtlijst');
  const aanwezig = a => (a.inschrijvingen || []).filter(i => i.status === 'aanwezig');

  /* Het beeld toont codenamen en tellingen, nooit een naam. Wie er komt staat
     in de casus of in het vrijwilligersregister; een deelnemerslijst bij een
     activiteit zou dezelfde gegevens een derde keer op een derde plek zetten. */
  const beeld = a => ({ id: a.id, stad: a.stad, projectId: a.projectId || null, naam: a.naam,
    soort: a.soort, wanneer: a.wanneer, tijd: a.tijd, locatie: a.locatie, status: a.status,
    capaciteit: a.capaciteit, ingeschreven: ingeschreven(a).length, wachtlijst: wachtlijst(a).length,
    aanwezig: aanwezig(a).length, jeugd: JEUGD.includes(a.soort),
    begeleiders: (a.begeleiders || []).length, veiligheidsplan: a.veiligheidsplan || null,
    kosten: euro(a.kostenCenten), sponsors: a.sponsors || [],
    evaluatie: a.evaluatie || null,
    inschrijvingen: (a.inschrijvingen || []).map(i => ({ id: i.id, codenaam: i.codenaam,
      minderjarig: !!i.minderjarig, oudertoestemming: !!i.oudertoestemming,
      fototoestemming: !!i.fototoestemming, status: i.status })),
    at: a.at });

  function lijst(req, stadId) {
    const w = wie(req);
    const g = poort(w, stadId, 'stad.lezen');
    if (!g.ok) return g;
    return { ok: true, soorten: SOORTEN, jeugdsoorten: JEUGD, statussen: STATUS,
      activiteiten: A().filter(a => a.stad === g.stad.id).map(beeld) };
  }

  function maak(req, b) {
    b = b || {};
    const w = wie(req);
    const g = poort(w, b.stad, 'project.beheren', 'events');
    if (!g.ok) return g;
    const soort = String(b.soort || '');
    if (!SOORTEN.includes(soort)) return { status: 400, error: 'Kies een soort (' + SOORTEN.join(', ') + ').' };
    const naam = schoon(b.naam, 120);
    if (naam.length < 3) return { status: 400, error: 'Hoe heet deze activiteit?' };
    const cap = Math.round(Number(b.capaciteit));
    if (!Number.isFinite(cap) || cap <= 0) return { status: 400, error: 'Hoeveel mensen kunnen er mee? Zonder capaciteit is een wachtlijst onmogelijk.' };
    const wanneer = schoon(b.wanneer, 10);
    if (wanneer && Number.isNaN(Date.parse(wanneer))) return { status: 400, error: 'Gebruik een datum als 2026-09-12.' };
    const kosten = centen(b.kosten === undefined ? 0 : b.kosten);
    if (kosten === null) return { status: 400, error: 'Wat kost de activiteit? Nul mag ook.' };
    let projectId = schoon(b.projectId, 20) || null;
    if (projectId) {
      const p = S().projecten.find(x => x.id === projectId);
      if (!p || p.stad !== g.stad.id) return { status: 400, error: 'Dat project hoort niet bij deze stad.' };
    }
    if (A().length >= 100000) return { status: 400, error: 'Het activiteitenregister zit vol.' };
    const a = { id: rid(), stad: g.stad.id, projectId, naam, soort,
      wanneer: wanneer || null, tijd: schoon(b.tijd, 20), locatie: schoon(b.locatie, 120),
      capaciteit: Math.min(cap, 100000), status: 'gepland', begeleiders: [],
      veiligheidsplan: null, kostenCenten: kosten, sponsors: [], inschrijvingen: [],
      evaluatie: null, door: w.key, at: nu() };
    A().push(a);
    audit(w.key, 'activiteit.maak', naam, g.stad.naam + ', ' + (wanneer || 'datum volgt'));
    save();
    return { ok: true, activiteit: beeld(a) };
  }

  /* Het beheer van een activiteit (wijzigen, begeleiders, openzetten,
     afronden) staat in ./activiteiten-beheer.js; de deur (inschrijven,
     afmelden, inchecken) in ./activiteiten-deur.js. Dit bestand liep over de
     10 KB van keuringsregel 13, en het zijn ook drie momenten: voorbereiden,
     openzetten, en de ochtend zelf. */
  const beheer = require('./activiteiten-beheer')(ctx, { vind, beeld, ingeschreven, wachtlijst, aanwezig, vogGeldig, JEUGD, STATUS });

  const deur = require('./activiteiten-deur')(ctx, { vind, beeld, ingeschreven, wachtlijst, schuifOp: beheer.schuifOp });

  return { lijst, maak, zet: beheer.zet, open: beheer.open, status: beheer.status,
    begeleiders: beheer.begeleiders,
    inschrijven: deur.inschrijven, afmelden: deur.afmelden, inchecken: deur.inchecken,
    vind, beeld, SOORTEN, JEUGD, STATUS };
};
module.exports.SOORTEN = SOORTEN;
module.exports.JEUGD = JEUGD;
