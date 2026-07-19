/* Het afdelingsregister, deel 2 (kern/afdelingen): de vijf jongere kamers
   van het RTG-kantoor: Support team, Ingenieurs, Consumenten-abonnementen,
   Partner-abonnementen en de Kantine. Zelfde vorm als register.js: per
   kamer de naam, KPI's en lijsten, alles defensief lezend. Kamers met
   naamInzage: true mogen via de identiteitskluis de echte naam bij een
   codenaam opvragen (elke opvraging komt in het auditlog). */
module.exports = (ctx) => {
  const { d, lijst, tel, recent, ledenGeteld, functies, accounts } = ctx;
  const functiesStand = () => ((d().techniek || {}).functies || {});
  const storingen = () => functies.catalogus(functiesStand()).flatMap(g => g.functies).filter(f => f.storing);
  const verificatiesOpen = () => { try { return accounts.listByVerification('pending') || []; } catch (e) { return []; } };

  return {
    support: { naam: 'Support team', emoji: '🛟', missie: 'Partners en personeel nooit laten wachten met een vraag of storing.', naamInzage: true,
      kpis: () => [
        ['Paniek-voorstellen open', tel(lijst(d().paniekVoorstellen).filter(v => v.status === 'open'))],
        ['Storingen (zekering open)', storingen().length],
        ['Doos-opdrachten open', tel(lijst(d().doosOpdrachten).filter(o => !o.klaar))],
        ['Gastgesprekken', tel(Object.keys(d().guestChats || {}))],
        ['Ledengesprekken', tel(Object.keys(d().memberChats || {}))]
      ],
      lijsten: () => [
        { titel: 'Open paniek-voorstellen (vier ogen)', items: lijst(d().paniekVoorstellen).filter(v => v.status === 'open').slice(0, 8).map(v => String(v.functie || v.tekst || v.id) + (v.reden ? ': ' + String(v.reden).slice(0, 50) : '')) },
        { titel: 'Storingen om op te pakken', items: storingen().slice(0, 8).map(f => f.naam + ': de zekering staat open') }
      ] },
    ingenieurs: { naam: 'Ingenieurs', emoji: '🛰️', missie: 'De motor van het platform gezond, snel en meetbaar houden.',
      kpis: () => [
        ['Functies in de catalogus', functies.catalogus(functiesStand()).reduce((n, g) => n + g.functies.length, 0)],
        ['Functies met storing', storingen().length],
        ['Doos-metingen (24u)', recent(d().doosMetingen, 'at', 1)],
        ['Uptime (uren)', Math.round(process.uptime() / 36) / 100],
        ['Geheugen (MB)', Math.round(process.memoryUsage().rss / 1048576)]
      ],
      lijsten: () => [
        { titel: 'Storingen (zekeringen open)', items: storingen().slice(0, 8).map(f => f.naam) },
        { titel: 'Verder kijken', items: ['Het volledige techniekbord staat op techniek.html (eigenaar-inlog); de Zaakdozen staan in de kamer Intern & IT.'] }
      ] },
    consumentenAbo: { naam: 'Consumenten-abonnementen', emoji: '💳', missie: 'Elke pas kloppend: van aanvraag en ballotage tot verlenging en afscheid.', naamInzage: true,
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
    partnerAbo: { naam: 'Partner-abonnementen', emoji: '🤝', missie: 'Elke zaak op het juiste plan, met eerlijke vergoedingen en groeiende samenwerkingen.', naamInzage: true,
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
    kantine: { naam: 'Kantine', emoji: '🥪', missie: 'De plek waar iedereen even mens is: goed eten, echte gesprekken, geen agenda.',
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
