/* Afdelingsregister deel 2, kamergroep "kantoorkamers" (kern/afdelingen): de
   zeven jongere bedrijfskamers - Support team, Ingenieurs, Integratiekamer, Controleregister,
   Consumenten- en Partner-abonnementen en de Kantine (het Reisbureau staat in
   ./reisbalie.js). Zelfde vorm als register.js:
   per kamer de naam, KPI's en lijsten, alles defensief lezend. Kamers met
   naamInzage: true mogen via de identiteitskluis de echte naam bij een codenaam
   opvragen (elke opvraging komt in het auditlog). Verbatim uit register2.js. */
module.exports = (ctx) => {
  const { d, lijst, tel, recent, ledenGeteld, functies, accounts } = ctx;
  const functiesStand = () => ((d().techniek || {}).functies || {});
  const storingen = () => functies.catalogus(functiesStand()).flatMap(g => g.functies).filter(f => f.storing);
  const verificatiesOpen = () => { try { return accounts.listByVerification('pending') || []; } catch (e) { return []; } };

  return {
    support: { naam: 'Support team', icoon: 'rechterhand', missie: 'Partners en personeel nooit laten wachten met een vraag of storing.', naamInzage: true,
      kpis: () => [
        ['Paniek-voorstellen open', tel(lijst(d().paniekVoorstellen).filter(v => v.status === 'open'))],
        ['Storingen (zekering open)', storingen().length],
        ['Doos-opdrachten open', tel(lijst(d().doosOpdrachten).filter(o => !o.klaar))],
        /* Uit de communicatiekern en niet meer uit guestChats/memberChats: die
           twee zijn sinds de verhuizing bevroren archieven. Bleven deze
           tellers daarop staan, dan zouden ze langzaam stilvallen op het
           aantal van de dag van de verhuizing -- een KPI die niet meer
           beweegt ziet er hetzelfde uit als een KPI waar niets gebeurt. */
        ['Gastgesprekken', tel(lijst(d().commGesprekken).filter(g => g.meta && g.meta.bron === 'Zaak'))],
        ['Ledengesprekken', tel(lijst(d().commGesprekken).filter(g =>
          (g.soort === 'personal' || g.soort === 'group') &&
          (g.deelnemers || []).every(x => !String(x).includes(':'))))]
      ],
      lijsten: () => [
        { titel: 'Open paniek-voorstellen (vier ogen)', items: lijst(d().paniekVoorstellen).filter(v => v.status === 'open').slice(0, 8).map(v => String(v.functie || v.tekst || v.id) + (v.reden ? ': ' + String(v.reden).slice(0, 50) : '')) },
        { titel: 'Storingen om op te pakken', items: storingen().slice(0, 8).map(f => f.naam + ': de zekering staat open') }
      ] },
    ingenieurs: { naam: 'Ingenieurs', icoon: 'antenne', missie: 'De motor van het platform gezond, snel en meetbaar houden.',
      kpis: () => [
        ['Functies in de catalogus', functies.catalogus(functiesStand()).reduce((n, g) => n + g.functies.length, 0)],
        ['Functies met storing', storingen().length],
        ['Doos-metingen (24u)', recent(d().doosMetingen, 'at', 1)],
        ['Uptime (uren)', Math.round(process.uptime() / 36) / 100],
        ['Geheugen (MB)', Math.round(process.memoryUsage().rss / 1048576)]
      ],
      lijsten: () => [
        { titel: 'Storingen (zekeringen open)', items: storingen().slice(0, 8).map(f => f.naam) },
        // het beheer op afstand: welke software draait er in het veld
        { titel: 'Software in het veld' + ((d().doosUpdate || {}).versie ? ' (doel: v' + d().doosUpdate.versie + ')' : ''), items: (() => {
          const per = {};
          for (const m of lijst(d().doosMetingen)) if (!per[m.doos]) per[m.doos] = m;
          return Object.values(per).slice(0, 10).map(m => m.doos + ': v' + (m.versie || '?')
            + (m.wifi && m.wifi !== 'uit' ? ', wifi: ' + m.wifi : '')
            + (m.stroom && m.stroom.bron === 'batterij' ? ', OP BATTERIJ' + (m.stroom.pct != null ? ' (' + m.stroom.pct + '%)' : '') : ''));
        })() },
        { titel: 'Laatste update-meldingen', items: lijst(d().doosUpdateStatus).slice(0, 6).map(s => s.doos + ': ' + (s.gelukt ? 'gelukt' : 'NIET gelukt') + (s.naar ? ' naar v' + s.naar : '') + ', ' + s.melding) },
        /* GEEN TWEEDE DEKKINGSCIJFER HIER, EN DAT IS OPZET.

           Een KPI met de routedekking erin zou aantrekkelijk zijn, maar deze
           kamer heeft de routekaart van de server niet (die komt uit
           app._routes(), en dit register wordt lang voor de routes opgehangen).
           Ze zou dus moeten rekenen met alleen DEKKING.json -- en dan kan hier
           100% staan terwijl het kantoorscherm "achterhaald" meldt, omdat dat
           laatste het bewijsstuk WEL naast de levende routekaart houdt. Twee
           plekken die een waarheid vasthouden, lopen uiteen (LAT.md regel 4),
           en bij een cijfer dat 100% moet zijn is dat het ergste wat er kan
           gebeuren. Dus een wegwijzer en geen getal. */
        { titel: 'Verder kijken', items: ['De routedekking -- elke route van dit huis en of een toets hem echt heeft aangeroepen -- staat op routedekking.html.',
          'Het volledige techniekbord staat op techniek.html (eigenaar-inlog); de Zaakdozen staan in de kamer Intern & IT.'] }
      ] },
    integraties: { naam: 'Integratiekamer', icoon: 'antenne', eigenApp: true,
      missie: 'SMTP, SMS, Connect en SEPA veilig testen, bewaken en als één keten laten samenwerken.',
      kpis: () => {
        const s = d().integratiekamer || {}, schakels = s.schakelaars || {}, tests = s.tests || {};
        return [
          ['Lokale rails aan', Object.values(schakels).filter(Boolean).length + ' / 4'],
          ['Contractproeven groen', ['smtp', 'sms', 'connect', 'sepa'].filter(id => tests[id] && tests[id].ok).length + ' / 4'],
          ['Schakelbesluiten open', lijst(s.verzoeken).filter(v => v.status === 'wacht').length],
          ['Verantwoordelijken toegewezen', Object.values(s.verantwoordelijk || {}).filter(Boolean).length + ' / 4']
        ];
      },
      lijsten: () => {
        const s = d().integratiekamer || {};
        return [
          { titel: 'Besluiten die op de eigenaar wachten', items: lijst(s.verzoeken).filter(v => v.status === 'wacht').slice(0, 8).map(v => (v.aan ? 'AAN: ' : 'UIT: ') + String(v.kanaal || 'rail')) },
          { titel: 'Harde grens', items: ['Live providers hebben hier geen aan-knop. De kamer bedient uitsluitend lokale contract-sandboxes.'] }
        ];
      } },
    controleregister: { naam: 'RTG Controleregister', icoon: 'schild', eigenApp: true,
      missie: 'Iedere codefunctie aantoonbaar koppelen aan kantoor, rol, stand, proef, audit, gameplay en economie.',
      kpis: () => {
        const c = ((d().magnaatWereld || {}).controle || {}), taken = lijst(c.taken);
        return [
          ['Controlepunten bijgestuurd', Object.keys(c.overrides || {}).length],
          ['Dekkingstaken open', taken.filter(t => t.status !== 'klaar').length],
          ['Dekkingstaken klaar', taken.filter(t => t.status === 'klaar').length],
          ['Auditregels', lijst(c.audit).length]
        ];
      },
      lijsten: () => {
        const c = ((d().magnaatWereld || {}).controle || {}), taken = lijst(c.taken);
        return [
          { titel: 'Dekkingswerk voor de kantoren', items: taken.filter(t => t.status !== 'klaar').slice(0, 8).map(t => String(t.titel || t.id) + ' · ' + String(t.kantoorNaam || 'nog te verdelen')) },
          { titel: 'Harde grens', items: ['Het register bestuurt de Magnaat-trainingskopie. Productie verandert alleen via de bestaande RTG-goedkeuringsroutes.'] }
        ];
      } },
    consumentenAbo: { naam: 'Consumenten-abonnementen', icoon: 'pas', missie: 'Elke pas kloppend: van aanvraag en ballotage tot verlenging en afscheid.', naamInzage: true,
      kpis: () => [
        ['Leden in de gids', ledenGeteld()],
        ['Verificaties in behandeling', verificatiesOpen().length],
        ['Cadeaukaarten actief', tel(lijst(d().giftcards).filter(g => !g.verzilverd))],
        ['RTG Pay grootboek (7d)', recent(d().payBoekingen, 'at', 7)],
        ['Vonk-profielen', tel(d().vonk)]
      ],
      lijsten: () => [
        { titel: 'Verificaties om te beoordelen (op codenaam; echte naam via de kluis hieronder)', items: verificatiesOpen().slice(0, 8).map(u => (u.codename || 'lid') + ' (' + (u.tier || 'pas') + ')') },
        { titel: 'Verder kijken', items: ['De pasprijzen zet de boardroom in de geld-regie; de voorwaarden volgen live.'] }
      ] },
    partnerAbo: { naam: 'Partner-abonnementen', icoon: 'rendezvous', missie: 'Elke zaak op het juiste plan, met eerlijke vergoedingen en groeiende samenwerkingen.', naamInzage: true,
      kpis: () => [
        ['Partners aangesloten', tel(d().suppliers)],
        ['Open partner-aanvragen', tel(lijst(d().partnerApplications).filter(a => a.status === 'nieuw'))],
        ['Synergie-deals actief', tel(lijst(d().synergie).filter(s => s.status === 'actief'))],
        ['Pakketten verkocht', tel(d().synergieKopen)],
        ['Genres open', Object.keys(d().supplierTypes || {}).length]
      ],
      lijsten: () => [
        { titel: 'Partners per genre', items: (() => {
          const per = {};
          for (const s of lijst(d().suppliers)) { const g = s.type || 'overig'; per[g] = (per[g] || 0) + 1; }
          return Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([g, n]) => g + ': ' + n);
        })() },
        { titel: 'Actieve Synergie-deals', items: lijst(d().synergie).filter(s => s.status === 'actief').slice(0, 8).map(s => String(s.titel || s.naam || s.id)) }
      ] },
    kantine: { naam: 'Kantine', icoon: 'horeca', missie: 'De plek waar iedereen even mens is: goed eten, echte gesprekken, geen agenda.',
      kpis: () => [
        ['Nu aangemeld (kantoor en thuis)', tel(lijst(d().kantoorDienst).filter(x => !x.uit))],
        ['Gerechten op de kaart', ((d().kantineMenu || {}).items || []).length],
        ['Kantine-berichten', tel((d().kantoorChat || {}).kantine)]
      ],
      lijsten: () => [
        { titel: 'De kaart van vandaag' + ((d().kantineMenu || {}).datum ? ' (' + d().kantineMenu.datum + ')' : ''), items: ((d().kantineMenu || {}).items || []).slice(0, 12) },
        { titel: 'Huisregel', items: ['In de kantine praten we niet over cijfers; werkvragen mogen mee terug naar de kamer.'] }
      ] }
  };
};
