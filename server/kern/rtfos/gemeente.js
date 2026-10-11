/* Foundation OS, deel "gemeente": het gemeentenportaal en de opdrachten.

   EEN GEMEENTE IS EEN FINANCIER EN EEN PARTNER, GEEN MEELEZER. Ze heeft recht
   op verantwoording: hoeveel mensen, welke buurten, wat er met het geld is
   gebeurd, welke prestatieafspraken zijn gehaald. Ze heeft geen recht op wie er
   in de voedselbank stond. Dat onderscheid is hier geen instelling maar de
   bouw: het portaal roept `cijfersVan` aan en heeft eenvoudigweg geen toegang
   tot casusdossiers, deelnemerslijsten of contactgegevens. Er is geen vinkje
   dat het aanzet.

   KLEINE GETALLEN ZIJN GEEN CIJFERS MAAR AANWIJZINGEN. "In de Zeewijk zijn twee
   mensen geholpen met schuldhulp" is in een buurt van een paar straten geen
   statistiek meer. Buurten met minder dan vijf hulpvragen worden daarom
   samengevoegd tot "overige buurten". Dat kost precisie en dat is de bedoeling:
   de gemeente stuurt op wijken, niet op huishoudens.

   DE OPDRACHT IS TWEEZIJDIG. Een gemeentelijke opdracht heeft een omschrijving,
   prestatieafspraken, een bedrag en een verantwoordingsdatum. RTF vult de
   voortgang in, de gemeente ziet hem -- dezelfde regel, geen twee versies. */

const K = 5; // onder dit aantal wordt een buurt niet apart genoemd

module.exports = (ctx, eigen) => {
  const { nu, rid, schoon, naarCenten, euro, code, S, audit, wie, poort, stadVan, save } = ctx;
  const { cijfersVan } = eigen;

  const vind = id => S().gemeenten.find(g => g.id === String(id || '')) || null;
  const vindCode = c => S().gemeenten.find(g => g.code === String(c || '').trim().toUpperCase()) || null;
  const opdrachtBeeld = o => ({ id: o.id, omschrijving: o.omschrijving, kpi: o.kpi,
    bedrag: euro(o.bedragCenten), deadline: o.deadline, status: o.status,
    voortgang: o.voortgang || '', at: o.at });
  const beeld = g => ({ id: g.id, stad: g.stad, naam: g.naam, contact: g.contact, code: g.code,
    opdrachten: (g.opdrachten || []).map(opdrachtBeeld), at: g.at });

  function lijst(req, stadId) {
    const w = wie(req);
    const g = poort(w, stadId, 'stad.lezen');
    if (!g.ok) return g;
    return { ok: true, gemeenten: S().gemeenten.filter(x => x.stad === g.stad.id).map(beeld) };
  }

  function maak(req, b) {
    b = b || {};
    const w = wie(req);
    const g = poort(w, b.stad, 'stad.beheren', 'municipal_reporting');
    if (!g.ok) return g;
    const naam = schoon(b.naam, 80);
    if (naam.length < 2) return { status: 400, error: 'Welke gemeente?' };
    if (S().gemeenten.length >= 2000) return { status: 400, error: 'Het gemeenteregister zit vol.' };
    const rij = { id: rid(), stad: g.stad.id, naam, contact: schoon(b.contact, 120),
      code: code('RTFG'), opdrachten: [], at: nu() };
    S().gemeenten.push(rij);
    audit(w.key, 'gemeente.maak', naam, 'stad ' + g.stad.naam);
    save();
    return { ok: true, gemeente: beeld(rij) };
  }

  function opdrachtZet(req, id, b) {
    b = b || {};
    const rij = vind(id);
    if (!rij) return { status: 404, error: 'Deze gemeente staat niet in het register.' };
    const w = wie(req);
    const g = poort(w, rij.stad, 'stad.beheren', 'municipal_reporting');
    if (!g.ok) return g;
    const oms = schoon(b.omschrijving, 300);
    if (oms.length < 3) return { status: 400, error: 'Wat is de opdracht?' };
    const c = naarCenten(b.bedrag === undefined ? 0 : b.bedrag);
    if (c === null) return { status: 400, error: 'Wat is het subsidiebedrag? Nul mag ook.' };
    const deadline = schoon(b.deadline, 10);
    if (deadline && Number.isNaN(Date.parse(deadline))) return { status: 400, error: 'Gebruik een datum als 2027-01-31.' };
    if (!Array.isArray(rij.opdrachten)) rij.opdrachten = [];
    const bestaand = b.id ? rij.opdrachten.find(o => o.id === String(b.id)) : null;
    if (!bestaand && rij.opdrachten.length >= 100) return { status: 400, error: 'Honderd opdrachten is genoeg.' };
    const o = bestaand || { id: rid(), at: nu() };
    Object.assign(o, { omschrijving: oms, kpi: schoon(b.kpi, 300), bedragCenten: c,
      deadline: deadline || null, status: ['lopend', 'verantwoord', 'afgesloten'].includes(String(b.status)) ? String(b.status) : (o.status || 'lopend'),
      voortgang: schoon(b.voortgang, 600) });
    if (!bestaand) rij.opdrachten.push(o);
    audit(w.key, 'gemeente.opdracht', rij.naam, oms.slice(0, 60));
    save();
    return { ok: true, gemeente: beeld(rij) };
  }

  /* Buurten samenvoegen onder de drempel. Het aantal samengevoegde buurten
     staat er WEL bij: "overige buurten: 7" is informatie, stilzwijgend weglaten
     zou de gemeente een onvolledig beeld geven zonder dat ze het weet.

     CELVEILIG IS NIET QUERYVEILIG (VERDER.md par. 6, besluit B1). Het portaal
     toont ook het TOTAAL, dus de som van wat er niet genoemd wordt is altijd
     uit te rekenen. De vraag is dus niet "staat er een klein getal" maar "is
     het aantal van een verborgen buurt AF TE LEIDEN". Drie vormen die alle drie
     gedraaid zijn (golf 3, tegenlezing):
       - een groep van een buurt: haar aantal is de groep;
       - een uiterste som: twee buurten met samen 2 zijn er allebei 1;
       - grenzen: een buurt die meegaat om een kleine buurt te dekken ligt
         tussen K en het kleinste genoemde aantal, dus {1, 5, 12} geeft een groep
         van 6 en daarmee 1 en 5.
     Daarom rekent deze functie per verborgen buurt het bereik uit dat een
     gemeente met maximale kennis (zij weet welke buurten klein zijn en welke
     zijn meegenomen) nog openhoudt, en voegt zij de volgende kleinste buurt
     toe zolang er een buurt is met maar EEN mogelijke waarde. Lukt dat niet
     meer, dan staat er geen aantal (null) met de reden. Labels worden op hun
     schrijfwijze samengevoegd (hoofdletters, spaties): "Zeewijk" en "zeewijk"
     zijn een buurt en mogen niet als twee buurten een groep vormen. Een
     tikfout ("Zeewyk") vangt dat niet; daarvoor is een vaste buurtenlijst per
     stad nodig, en dat is een besluit (VERDER.md par. 6). */
  const sleutel = w => String(w).trim().toLowerCase().replace(/\s+/g, ' ');
  /* Het bereik van lid i bij som S: wat de anderen samen minimaal en maximaal
     kunnen dragen, bepaalt wat er voor i overblijft. */
  function afleidbaar(leden, S) {
    const lo = leden.reduce((a, l) => a + l.lo, 0), hi = leden.reduce((a, l) => a + l.hi, 0);
    return leden.some(l => Math.min(l.hi, S - (lo - l.lo)) - Math.max(l.lo, S - (hi - l.hi)) < 1);
  }
  function buurten(perWijk) {
    const per = new Map();
    for (const [wijk, n] of Object.entries(perWijk || {})) {
      const k = sleutel(wijk);
      if (!k) continue;
      const r = per.get(k) || { wijk: String(wijk).trim(), aantal: 0 };
      r.aantal += Number(n) || 0;
      per.set(k, r);
    }
    const groot = [], klein = [];
    for (const r of per.values()) (r.aantal >= K ? groot : klein).push(r);
    groot.sort((a, b) => b.aantal - a.aantal || (a.wijk < b.wijk ? -1 : 1));
    if (!klein.length) return groot;
    const groep = klein.map(r => ({ aantal: r.aantal, lo: 1, hi: K - 1 }));
    let meegenomen = 0;
    const veilig = () => {
      if (groep.length < 2) return false;
      const U = groot.length ? groot[groot.length - 1].aantal : Infinity;
      for (const l of groep) if (l.mee) l.hi = U;
      return !afleidbaar(groep, groep.reduce((a, l) => a + l.aantal, 0));
    };
    while (!veilig() && groot.length) { groep.push({ aantal: groot.pop().aantal, lo: K, hi: Infinity, mee: true }); meegenomen++; }
    const ok = veilig();
    const uit = groot.slice();
    uit.push({ wijk: 'overige buurten (' + groep.length + ')', buurten: groep.length,
      aantal: ok ? groep.reduce((a, l) => a + l.aantal, 0) : null, samengevoegd: true,
      ...(meegenomen ? { complementair: meegenomen + ' buurt(en) boven de drempel meegenomen, anders was het aantal van een buurt af te leiden' } : {}),
      ...(ok ? {} : { onderdrukt: 'ook na samenvoegen zou het aantal van een buurt af te leiden zijn; daarom staat hier geen getal' }) });
    return uit;
  }

  /* Het portaal op de gemeentecode. Alles wat hier teruggaat is geteld; er komt
     geen enkel dossier, geen naam en geen hulpvraagtekst langs. */
  function portaal(c) {
    const rij = vindCode(c);
    if (!rij) return { status: 404, error: 'Deze gemeentecode kennen we niet. Vraag het RTF-kantoor om de code.' };
    const stad = stadVan(rij.stad);
    if (!stad) return { status: 404, error: 'De stadsafdeling achter deze code bestaat niet meer.' };
    const cij = cijfersVan(stad.id);
    const projecten = S().projecten.filter(p => p.stad === stad.id && ['actief', 'afgerond'].includes(p.status))
      .map(p => ({ naam: p.naam, soort: p.soort, doelgroep: p.doelgroep, status: p.status,
        van: p.van, tot: p.tot, deelnemersUniek: Number(p.deelnemersUniek) || 0,
        indicatoren: (p.indicatoren || []).map(i => ({ naam: i.naam, doel: i.doel, bereikt: i.bereikt,
          doorgestroomd: i.doorgestroomd, uitgevallen: i.uitgevallen })) }));
    return { ok: true, gemeente: { naam: rij.naam, stad: stad.naam },
      opdrachten: (rij.opdrachten || []).map(opdrachtBeeld),
      projecten,
      bereik: {
        gemeten: cij.mensen.gemeten,
        uniekGeholpen: cij.mensen.uniekGeholpen, herhaaldGeholpen: cij.mensen.herhaaldGeholpen,
        vrijwilligers: cij.mensen.vrijwilligers, vrijwilligersuren: cij.mensen.vrijwilligersuren,
        hulpvragen: cij.hulpvragen.totaal, hulpvragenOpen: cij.hulpvragen.open,
        perSoort: cij.hulpvragen.perSoort, buurten: buurten(cij.hulpvragen.perWijk)
      },
      besteding: { binnen: cij.geld.binnen, besteed: cij.geld.besteed,
        kostenPerPersoon: cij.geld.kostenPerPersoon },
      doelen: cij.doelen };
  }

  return { lijst, maak, opdrachtZet, portaal, vind, vindCode, buurten, K };
};
module.exports.K = K;
