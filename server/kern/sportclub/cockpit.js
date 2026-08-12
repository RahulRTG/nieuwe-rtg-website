/* Sportclub, deelbestand "cockpit": de signalen en de AI-clubmanager.

   ./zakelijk.js gaat over HANDELINGEN -- een kamp aanvragen, een sponsorpakket
   plaatsen, een moment maken, de financien optellen. Dit bestand doet iets
   anders: het KIJKT en het ADVISEERT, en verandert nooit iets.

   HET VERSCHIL DAT DEZE LAAG DRAAGT (het wereldpatroon uit PLATFORM.md): een
   signaal is geen mening en geen telling. "Er staat een thuiswedstrijd op een
   AFGEKEURD veld" is een feit dat uit twee lijsten tegelijk komt en dat niemand
   ziet zolang je die lijsten los bekijkt. Daarvoor bestaat een cockpit.

   EN DE AI ADVISEERT ALLEEN. Dat staat niet alleen in de systeemprompt maar
   ook in de vorm: deze module heeft geen enkele weg naar opslaan. Een verbod in
   een prompt is geen grens -- een module zonder schrijffunctie wel. Elk besluit
   (opstelling, sponsor, kamp, veld) neemt de club zelf.

   Zonder AI-sleutel komt er een VAST antwoord met hetzelfde beeld erin. Dat is
   met opzet geen "niet beschikbaar": het beeld is echt en komt uit de eigen
   gegevens; alleen de formulering is dan niet van een model. */
'use strict';

module.exports = ({ club, seed, vandaag, schoon, anthropic, financien }) => {

  function cockpit(code) {
    seed();
    const c = club(code);
    const signalen = [];
    for (const w of c.wedstrijden.filter(x => !x.uitslag && x.thuis && x.datum >= vandaag())) {
      const veld = c.velden.find(v => v.naam === w.veld);
      if (veld && veld.status === 'afgekeurd')
        signalen.push({ soort: 'veld', tekst: 'RTG - ' + w.tegenstander + ' (' + w.datum + ') staat op ' + veld.naam + ', maar dat veld is AFGEKEURD.' });
    }
    for (const k of c.kampen.filter(x => x.status === 'aangevraagd'))
      signalen.push({ soort: 'kamp', tekst: 'Trainingskamp ' + k.code + ' (' + k.team + ' naar ' + k.bestemming + ') wacht op een besluit van de RTG-reisdesk.' });
    for (const sp of c.sponsors.filter(x => x.status === 'open' && x.interesse.length))
      signalen.push({ soort: 'sponsor', tekst: '"' + sp.pakket + '" heeft ' + sp.interesse.length + ' kandidaat-sponsor(s); de club is aan zet.' });
    const f = financien(code);
    return { ok: true, teams: c.teams.length,
      programma: c.wedstrijden.filter(w => !w.uitslag && w.datum >= vandaag()).length,
      gespeeld: c.wedstrijden.filter(w => w.uitslag).length,
      ticketsVerkocht: f.ticketsVerkocht, veldenGoed: c.velden.filter(v => v.status === 'goed').length,
      veldenTotaal: c.velden.length, sponsorsOpen: c.sponsors.filter(s2 => s2.status === 'open').length,
      momenten: c.momenten.length, signalen: signalen.slice(0, 40) };
  }

  async function sportAI(code, vraag) {
    const co = cockpit(code);
    const f = financien(code);
    const beeld = co.teams + ' teams, ' + co.programma + ' wedstrijden op het programma (' + co.gespeeld + ' gespeeld), ' +
      co.ticketsVerkocht + ' tickets verkocht, velden ' + co.veldenGoed + '/' + co.veldenTotaal + ' goed, ' +
      co.sponsorsOpen + ' sponsorpakket(ten) open. Financien: tickets EUR ' + Math.round(f.ticketOmzetCenten / 100) +
      ', sponsors EUR ' + Math.round(f.sponsorsCenten / 100) + ', kantine EUR ' + Math.round(f.kantineCenten / 100) +
      ', kampen EUR ' + Math.round(f.kampKostenCenten / 100) + '. Signalen: ' +
      (co.signalen.length ? co.signalen.slice(0, 5).map(s => s.tekst).join(' | ') : 'geen') + '.';
    const q = schoon(vraag, 400);
    if (anthropic && q) {
      try {
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 350,
          system: require('../rahul').RAHUL_LEAD + 'je bent de AI-clubmanager van deze sportclub op het RTG-platform. Je adviseert het bestuur ' +
            'over tickets, jeugd, velden, sponsors, marketing en de financien, kort en praktisch. Je adviseert ALLEEN: elk besluit ' +
            '(opstelling, sponsor, kamp, veld) neemt de club zelf. Huidige beeld: ' + beeld,
          messages: [{ role: 'user', content: q }]
        });
        const tekst = r.content && r.content[0] && r.content[0].text;
        if (tekst) return { ok: true, antwoord: tekst };
      } catch (e) { /* val terug */ }
    }
    return { ok: true, demo: true, antwoord: 'Het beeld van de club: ' + beeld + ' Mijn advies: los eerst de veld-signalen op, zet de thuiswedstrijd groot in een moment op de socials, en nodig de kandidaat-sponsors uit in de bestuurskamer. Beslissen doet u zelf.' };
  }

  return { cockpit, sportAI };
};
