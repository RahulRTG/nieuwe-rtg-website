/* HET HUIS: het reisdossier -- de hoofdingang van het reisbureau.

   Het Huis was tot nu toe een magazine: mooie bladen, nul gegevens. Dat is
   vreemd voor de voordeur van een reisbureau. Wat een reisbureau namelijk DOET,
   is precies dit: alles van uw reis bij elkaar houden en u eerlijk vertellen wat
   nog niet rond is. Vanaf nu doet Het Huis dat ook.

   WAT ELDERS GELD KOST. Bij de bekende reisapps heet dit de betaalde laag: al uw
   boekingen in een tijdlijn, een seintje als een document verloopt, en een
   dossier dat u kunt meenemen. Dat is precies de functie waar het
   jaarabonnement voor bestaat. Hier zit het in de pas.

   DE REGEL DIE DIT HUIS ERAAN TOEVOEGT: WAT NIET BEVESTIGD IS, STAAT ER OOK ZO
   BIJ. Een dossier dat alles even zeker laat lijken is erger dan geen dossier --
   dan staat u aan de balie met een papier dat niets waard blijkt. Elk onderdeel
   draagt daarom zijn eigen stand (bevestigd / wacht op betaling / in aanvraag),
   en de lijst "wat er nog moet" scheidt streng wat AAN U ligt van wat u alleen
   maar kunt AFWACHTEN. Iets afwachten is geen taak.

   Twee dingen die hier bewust NIET in zitten:
   - INREISVEREISTEN PER LAND. Die wisselen per week en per nationaliteit; iets
     beweren wat wij niet kunnen naslaan is erger dan zwijgen. Entourage weigert
     dat al om dezelfde reden (kern/rechterhand/entourage.js).
   - KUNSTMATIGE HAAST. Het aftellen zegt hoeveel dagen er nog zijn, en verder
     niets. Geen "nog maar", geen rode cijfers, geen lijst die nooit leeg raakt:
     als er niets meer te doen is, zegt het dossier dat gewoon. */
module.exports = ({ reisVan, entourageVan }) => {
  const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli',
    'augustus', 'september', 'oktober', 'november', 'december'];
  const DAG = 86400000;

  /* De vertrekdatum uit de reisregel halen ("18 - 25 juli 2026"). Dit is
     bewust voorzichtig: lukt het niet, dan geven we null terug en zegt het
     scherm dat de datum als tekst bekend is. Een verzonnen datum in een
     reisdossier is gevaarlijker dan een ontbrekende. */
  function vertrekUit(regel) {
    const s = String(regel || '').toLowerCase();
    const jaar = (s.match(/\b(20\d{2})\b/) || [])[1];
    const maand = MAANDEN.findIndex(m => s.includes(m));
    const dag = (s.match(/\b(\d{1,2})\b/) || [])[1];
    if (!jaar || maand < 0 || !dag) return null;
    const d = new Date(Date.UTC(+jaar, maand, +dag));
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  const dagenTot = (datum) => {
    if (!datum) return null;
    const nu = new Date().toISOString().slice(0, 10);
    return Math.round((Date.parse(datum + 'T00:00:00Z') - Date.parse(nu + 'T00:00:00Z')) / DAG);
  };

  /* De drie standen die een reisonderdeel kan hebben. Ze komen uit de gegevens
     zelf; we verzinnen er niets bij en we maken niets mooier. */
  const STAND = {
    paid: { bevestigd: true, aanU: false, label: 'Bevestigd' },
    open: { bevestigd: false, aanU: true, label: 'Wacht op betaling' },
    req: { bevestigd: false, aanU: false, label: 'In aanvraag bij de partner' }
  };
  const standVan = (s) => STAND[s] || { bevestigd: false, aanU: false, label: 'Nog niet bevestigd' };

  /* Het dossier. Alles wat van deze reis bekend is, op een rij, plus wat er nog
     moet -- en dat laatste met een bodem: het is een afgeleide van de reis, niet
     een lijst die uit zichzelf blijft groeien. */
  function dossier(sess) {
    const reis = (reisVan && reisVan(sess)) || null;
    if (!reis) {
      return { ok: true, reis: null, tijdlijn: [], open: [], afwachten: [], gereed: true,
        tekst: 'Er staat nog geen reis in uw dossier. Zodra er iets geboekt is, komt het hier vanzelf bij elkaar.' };
    }
    const vertrek = vertrekUit(reis.dates);
    const dagen = dagenTot(vertrek);
    const items = Array.isArray(reis.items) ? reis.items : [];

    const tijdlijn = items.map((it, i) => {
      const st = standVan(it.status);
      return { nr: i + 1, wanneer: it.when || '', titel: it.title || '', toelichting: it.sub || '',
        stand: it.status || 'onbekend', label: it.label || st.label,
        bevestigd: st.bevestigd, factuur: it.invoiceId || null };
    });

    // Wat aan U ligt, en wat u alleen maar kunt afwachten -- streng gescheiden.
    const open = [], afwachten = [];
    for (const t of tijdlijn) {
      if (t.bevestigd) continue;
      const st = standVan(t.stand);
      (st.aanU ? open : afwachten).push({
        wat: t.titel,
        waarom: t.factuur ? ('Deze staat open op factuur ' + t.factuur + '.') : (t.label + '.'),
        waar: st.aanU ? '/apps/betalen.html' : null
      });
    }

    // De papieren van het gezelschap: Entourage rekent al uit wat verloopt, dus
    // dat rekenen we hier niet nog een keer. Een grens hoort op EEN plek.
    const ent = (entourageVan && entourageVan(sess)) || null;
    const papieren = ((ent && ent.attenties) || []).map(a => ({
      wat: (a.verlopen ? 'Verlopen: ' : 'Verloopt binnenkort: ') + a.soort + ' van ' + a.naam,
      waarom: 'Geldig tot ' + a.tot + '.', waar: '/apps/rechterhand.html', verlopen: !!a.verlopen
    }));
    for (const p of papieren) open.push(p);

    return { ok: true,
      reis: { bestemming: reis.dest || '', datums: reis.dates || '', dagen: reis.days || null,
        vertrek, nogDagen: dagen, datumBekend: !!vertrek },
      tijdlijn, open, afwachten,
      bevestigd: tijdlijn.filter(t => t.bevestigd).length,
      gereed: open.length === 0,
      gezelschap: ent ? ent.aantal : 0,
      tekst: zin(open.length, afwachten.length, dagen),
      bron: 'Alles hierin komt uit uw eigen boekingen en de datums die u zelf invulde. ' +
        'Inreisvereisten per land staan er bewust niet in: die wisselen te snel om ze te beloven.' };
  }

  /* De vaste zin. De module TELT, de AI verwoordt hoogstens; daarom staat hier
     geen aanmoediging en geen uitroepteken. */
  function zin(open, afwachten, dagen) {
    const wanneer = dagen == null ? '' : dagen > 1 ? ('Over ' + dagen + ' dagen vertrekt u. ')
      : dagen === 1 ? 'Morgen vertrekt u. ' : dagen === 0 ? 'Vandaag vertrekt u. ' : 'Deze reis is geweest. ';
    if (!open && !afwachten) return wanneer + 'Alles is rond.';
    if (!open) return wanneer + 'Er ligt niets meer bij u; ' +
      (afwachten === 1 ? 'één onderdeel wacht' : afwachten + ' onderdelen wachten') + ' nog op een partner.';
    return wanneer + (open === 1 ? 'Er is één ding' : 'Er zijn ' + open + ' dingen') + ' die uw aandacht vragen' +
      (afwachten ? ('; ' + afwachten + ' wacht' + (afwachten === 1 ? '' : 'en') + ' op een partner') : '') + '.';
  }

  /* De reismap: het dossier als platte tekst, om te bewaren, te printen of aan
     iemand mee te geven. Een reisbureau geeft u een mapje mee; dit is dat mapje.
     Platte tekst met opzet -- dat opent overal, ook zonder ons. */
  function map(sess) {
    const d = dossier(sess);
    if (!d.reis) return { ok: true, naam: 'reisdossier.txt', tekst: d.tekst };
    const r = [];
    r.push('RTG - REISDOSSIER');
    r.push(r[0].replace(/./g, '='));
    r.push('');
    r.push('Bestemming: ' + r0(d.reis.bestemming));
    r.push('Wanneer:    ' + r0(d.reis.datums));
    if (d.reis.dagen) r.push('Duur:       ' + d.reis.dagen + ' dagen');
    r.push('');
    r.push('DE REIS');
    for (const t of d.tijdlijn) {
      r.push('  ' + (t.wanneer || '--') + '  ' + t.titel);
      if (t.toelichting) r.push('        ' + t.toelichting);
      r.push('        [' + t.label + ']' + (t.factuur ? ('  factuur ' + t.factuur) : ''));
    }
    if (d.open.length) {
      r.push('');
      r.push('WAT ER NOG MOET');
      for (const o of d.open) r.push('  - ' + o.wat + ' (' + o.waarom + ')');
    }
    if (d.afwachten.length) {
      r.push('');
      r.push('WAT NOG BIJ EEN PARTNER LIGT (niets voor u te doen)');
      for (const a of d.afwachten) r.push('  - ' + a.wat);
    }
    r.push('');
    r.push(d.bron);
    return { ok: true, naam: 'reisdossier.txt', tekst: r.join('\n') };
  }
  const r0 = (s) => String(s == null ? '' : s);

  return { dossier, map, vertrekUit, dagenTot };
};
