/* Life Command, deel "samenstel": Rahul stelt een weekend met vrienden samen in
   EEN voorstel. Romeproef schakel 19, LIFE.md par. 3.

   HET WERKWOORD. Samenstellen en klaarzetten; bevestigen doet de mens. Dit
   bestand voert NIETS uit: er staat geen enkele schrijvende aanroep in, en
   test/romeschakels.test.js houdt dat vast op de bron. Wat het voorstel wel
   doet, is per mens laten zien wat hij nog zelf moet doen -- in de vorm van een
   plan (kern/stuur/plan.js: stappen met `afhankelijkVan` en een bedoelde
   uitkomst, in golven gezet door dezelfde `golven()`). Er komt geen tweede
   plancompiler: het wegen tegen het AI-beleid (`compileer`) gaat over wat een
   MODEL mag doen, en hier doet het model niets -- elke stap is een mens.

   HET PROJECTEERT EN BEZIT NIETS. Vier bronnen, elk in de vorm die de
   organisator er al van mag zien, en geen kopie:
     - de datum: datumRaad van het genootschap (kern/genootschap/ai.js), alleen
       uit wat de leden zelf antwoordden of als venster opgaven;
     - de reis: het reisgezelschap van de organisator, door de poort
       (REISVELDEN.eigenaar), en daarvan alleen bestemming en venster;
     - de delen: per deelnemer de stand (kern/reisbureau-deelnemers.js);
     - het budget: alleen wat een deelnemer ZELF met de organisator deelde
       (besluit B2). `null` is "niet gedeeld", en dat onderscheidt met opzet
       niet tussen "geen toestemming" en "niet willen delen".
   Wat er NIET in staat: geen bedrag, geen saldo, geen vergelijking tussen
   deelnemers, en niets uit WorkOS (MN-02) -- er is geen weg vanuit hier naar
   een werkgever, een rooster of een verlofsaldo.

   EEN VOORSTEL WORDT NIET BEWAARD, om dezelfde reden als in ./voorstellen.js:
   het wordt bij elke vraag opnieuw afgeleid, zodat een voorstel dat niet meer
   klopt er gewoon niet meer is. */
'use strict';

const { golven } = require('../stuur/plan');

module.exports = ({ kern }) => {
  async function samenstel(key, invoer) {
    const v = invoer && typeof invoer === 'object' ? invoer : {};
    const groep = v.groep, reisId = String(v.reis || '');
    const gr = kern.genootschap.groepMet(groep);
    if (!gr || !kern.genootschap.isLid(gr, key)) return { status: 403, error: 'Je bent hier geen lid van.' };
    const dr = await kern.genootschapAI.datumRaad({ key }, groep);
    if (!dr.ok) return { status: dr.status || 400, error: dr.reden || 'De datum is niet te bepalen.' };
    const agenda = kern.bijeenkomst.agenda({ key }, groep);
    const beste = (agenda.komt || []).find(b => b.datum === dr.beste) || null;

    /* De reis alleen als de organisator er EIGENAAR van is: een voorstel samenstellen
       over de reis van een ander is meekijken in iemands boeking. */
    const gz = reisId ? kern.reisgezelschap.gezelschap(key, reisId) : null;
    const eigenaar = gz && gz.ok && gz.rol === 'eigenaar';
    const reisBeeld = eigenaar ? (kern.reisgezelschap.reisVoor(key, reisId).reis || null) : null;
    const reis = reisBeeld ? { id: reisBeeld.id, bestemming: reisBeeld.bestemming || null, venster: reisBeeld.venster || null } : null;
    const reisLeden = eigenaar ? gz.leden : [];
    const delen = eigenaar && kern.reisbureau.deelnemers ? kern.reisbureau.deelnemers.vanOrganisator(key, reisId) : [];
    const deelVan = new Map();
    for (const g of delen) for (const d of (g.delen || [])) deelVan.set(d.codenaam, Object.assign({ ref: g.ref }, d));

    const ik = kern.codenaamVan(key);
    const deelnemers = (gr.leden || []).map(l => kern.codenaamVan(l.key)).filter(c => c && c !== ik).map(c => {
      const r = reisLeden.find(x => x.codenaam === c);
      const d = deelVan.get(c);
      return { codenaam: c,
        datum: beste && (beste.komen || []).includes(c) ? 'ja' : 'geen ja',
        reis: r ? r.stand : 'niet uitgenodigd',
        deel: d ? d.stand : null,
        budget: d ? d.budget : null };
    });

    /* HET PLAN: per mens wat hij nog zelf doet. Een stap die al gedaan is,
       staat er niet meer in. */
    const stappen = [];
    if (!reis) stappen.push({ id: 'reis', wie: ik, wat: 'een reis kiezen of laten samenstellen waarvan u eigenaar bent', afhankelijkVan: [] });
    for (const d of deelnemers) {
      if (d.reis === 'gevraagd') stappen.push({ id: 'ja-' + d.codenaam, wie: d.codenaam, wat: 'zegt zelf ja als reisgenoot', afhankelijkVan: reis ? [] : ['reis'] });
      if (d.reis === 'aanvaard' && !d.deel) stappen.push({ id: 'klaar-' + d.codenaam, wie: ik, wat: 'zet zijn deel klaar bij het reisbureau', afhankelijkVan: [] });
      if (d.deel === 'klaargezet') stappen.push({ id: 'deel-' + d.codenaam, wie: d.codenaam, wat: 'bevestigt zelf zijn eigen deel', afhankelijkVan: [] });
      if (d.deel === 'bevestigd') stappen.push({ id: 'betaal-' + d.codenaam, wie: d.codenaam,
        wat: 'betaalt zelf zijn eigen deel, nadat een reisadviseur zijn aanvraag bevestigde', afhankelijkVan: [] });
    }
    const g = golven(stappen, new Map(stappen.map(s => [s.id, s.afhankelijkVan])));

    return { status: 200, ok: true, voorstel: {
      doel: gr.naam,
      datum: { beste: dr.beste || null, tekst: dr.tekst, venster: beste ? beste.venster : null },
      reis, deelnemers,
      plan: { stappen, golven: g.golven || [] },
      uitgevoerd: [],
      bron: 'lokale-regels', ai: false,
      grens: 'Rahul heeft dit samengesteld en niets uitgevoerd. Elke stap hierboven doet een mens zelf: ' +
        'een uitnodiging aanvaarden, een eigen deel bevestigen, een eigen deel betalen. Het budget staat er ' +
        'alleen bij als die deelnemer het zelf met u deelde, en dan alleen als past of past niet.'
    } };
  }
  return { samenstel };
};
