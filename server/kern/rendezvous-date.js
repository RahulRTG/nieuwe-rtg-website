/* Rendez-vous, deelbestand "date": RAHUL DE KOPPELAAR.

   Bij een wederzijdse match schetst Rahul een ontmoeting. De regel die hier het
   zwaarst weegt staat al in de system prompt en blijft daar: hij BELOOFT nooit
   een reservering en noemt geen echte zaak als bevestigde optie -- hij schetst,
   en De Rechterhand legt het vast zodra beiden akkoord zijn (CLAUDE.md, en
   ONTMOETEN.md par. 2.2: Rahul denkt, de leden kiezen, De Rechterhand regelt).

   Afgesplitst van ./rendezvous.js toen de Presence Graph erbij kwam. Krijgt de
   gedeelde context van daar. */
module.exports = (ctx) => {
  const { R, AW, B, mag, codenaam, schoon, matchesVan, anthropic, Projection } = ctx;

  // Rahul stelt een jetset-date voor bij een match, op een gedeelde/openstaande locatie
  async function rvDate(key, targetKey, vraag) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const r = R();
    const m = matchesVan(key).find(x => x.id === targetKey);
    if (!m) return { status: 400, error: 'Dit is (nog) geen wederzijdse match.' };
    const mij = r.profielen[key] || { locaties: [], wensen: [] };
    const zij = r.profielen[targetKey] || { locaties: [], wensen: [] };
    /* WAAR U TEGELIJK BENT GAAT VOOR. Een gedeelde stad zegt dat u er allebei
       weleens komt; een overlap zegt wanneer. Rahul krijgt die dagen mee, zodat
       zijn schets over een echt weekend gaat in plaats van over "een keer". */
    const samen = AW.overlapTussen(mij, zij);
    const ruweOpties = (m.gedeeldeLocaties.length ? m.gedeeldeLocaties : [...new Set([...(mij.locaties || []), ...(zij.locaties || [])])]).slice(0, 5);
    /* En het dagdeel dat u allebei aankruiste, als dat er is. Rahul krijgt het
       WOORD ("donderdagavond") en nooit de hokjes van een van beiden. */
    const dagdeel = B.samenValt(mij.beschikbaar, zij.beschikbaar);
    const projectie = Projection.project(Projection.NAMES.RAHUL_CONNECTION, {
      matchCodenaam: m.codenaam,
      gedeeldeLocaties: m.gedeeldeLocaties,
      openLocaties: ruweOpties,
      watIkZoek: mij.zoekt || 'niet opgegeven',
      presence: samen,
      gedeeldDagdeel: dagdeel ? dagdeel.label : null,
      voorkeursStad: (samen[0] && samen[0].stad) || m.gedeeldeLocaties[0] || ruweOpties[0] || ''
    });
    const locatie = projectie.voorkeursStad || '';
    const opties = projectie.openLocaties || [];
    const wanneer = projectie.presence && projectie.presence[0]
      ? ' U bent daar allebei van ' + projectie.presence[0].van + ' tot ' + projectie.presence[0].tot + '.' : '';
    const q = schoon(vraag, 300);
    const ctxTekst = JSON.stringify(projectie);
    if (anthropic) {
      try {
        const res = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 320,
          system: require('./rahul').RAHUL_LEAD + 'u bent de koppelaar van Rendez-vous, de besloten datingdienst van de Lifestyle Pass. ' +
            'Het lid heeft een match. Stel een smaakvolle jetset-date voor op een locatie die beiden hebben aangegeven of voor openstaan' +
            (locatie ? ' (bij voorkeur ' + locatie + ')' : '') + '. Spreek het lid aan met "u", warm maar ingetogen. ' +
            'Noem GEEN echte hotel- of restaurantnamen als bevestigde optie en beloof NOOIT een reservering: u schetst het idee en zegt dat De Rechterhand het regelt zodra beiden akkoord zijn. Context: ' + ctxTekst,
          messages: [{ role: 'user', content: q || 'Stel een date voor.' }]
        });
        const tekst = res.content && res.content[0] && res.content[0].text;
        if (tekst) {
          const veilig = Projection.rahulOutputGuard(tekst, projectie, [mij, zij]);
          return { status: 200, ok: true, locatie, opties, antwoord: veilig.tekst, gefilterd: !veilig.ok };
        }
      } catch (e) { /* val terug */ }
    }
    const demo = locatie
      ? 'Wat een mooie match. U bent allebei in ' + locatie + '.' + wanneer + (projectie.gedeeldDagdeel ? ' ' + projectie.gedeeldDagdeel.charAt(0).toUpperCase() + projectie.gedeeldDagdeel.slice(1) + ' komt u beiden uit.' : '') + ' Een uitgelezen moment voor een eerste ontmoeting. Denk aan een rustig diner met uitzicht, ruim de tijd, niets gehaast. Zegt u het woord, dan legt De Rechterhand het samen met ' + projectie.matchCodenaam + ' vast; ik beloof niets voordat het rond is.'
      : 'Wat een mooie match met ' + projectie.matchCodenaam + '. U heeft nog geen gedeelde locatie aangegeven; laat mij weten waar u openstaat voor een ontmoeting, dan schets ik een date en regelt De Rechterhand de rest.';
    const veilig = Projection.rahulOutputGuard(demo, projectie, [mij, zij]);
    return { status: 200, ok: true, demo: true, locatie, opties, antwoord: veilig.tekst, gefilterd: !veilig.ok };
  }

  return { rvDate };
};
