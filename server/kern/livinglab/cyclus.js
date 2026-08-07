/* RTF Living Lab, deel "cyclus": de vaste keten van tien stappen, en de poort
   voor elke stap.

   Zonder deze module is dit een projectenlijst. De keten is wat het onderzoek
   maakt: je kunt geen deelnemers werven zonder plan, geen experiment beginnen
   zonder ethiek, geen resultaten schrijven zonder observaties, en geen besluit
   nemen over conclusies die nergens op rusten.

   DRIE ONTWERPKEUZES DIE HIER VASTLIGGEN:

   1. ALTIJD ÉÉN STAP. Nooit overslaan. Een "snelle" studie is een studie met
      lichte stappen, niet met minder stappen.
   2. NOOIT TERUG. Wie halverwege ontdekt dat de hypothese niet klopte, gaat niet
      terug om hem te herschrijven -- dat is de oudste manier om jezelf gelijk te
      geven. Zo'n bevinding hoort in de reflectie (soort `herzien`) en levert
      juist punten op in ./spel.js. Een echt nieuw plan is een nieuwe studie, en
      die kan als vervolg aan deze hangen.
   3. DE POORT GEEFT ALLE GEBREKEN. Niet het eerste. Een onderzoeker die er vijf
      keer achter elkaar op wordt gestuurd, gaat vinkjes zetten in plaats van
      werk doen. */
'use strict';

const kader = require('./kader');

module.exports = (ctx) => {
  const { nu, rid, schoon, audit, vindStudie, save, ethiek, spel } = ctx;

  /* Wat er af moet zijn om stap `doel` binnen te gaan. Elke regel is een echte
     lezing van het dossier, geen vlag die iemand ergens zette. */
  function poort(s, doel) {
    const d = s.dossier, uit = [];
    if (d.ethiek.stilgelegd && doel !== 'reflectie')
      uit.push('Dit onderzoek is stilgelegd door ' + d.ethiek.stilgelegd.door + ': ' + d.ethiek.stilgelegd.reden);
    switch (doel) {
      case 'hypothese':
        if (String(s.vraagstuk || '').length < 10) uit.push('Het vraagstuk is nog te dun om een hypothese op te bouwen.');
        break;
      case 'plan':
        if (!d.hypothese.at) uit.push('Er is nog geen hypothese, met het tegendeel erbij.');
        break;
      case 'deelnemers':
        if (!d.plan.at) uit.push('Er is nog geen onderzoeksplan (methoden, steekproef, meetmomenten).');
        for (const g of ethiek.gebreken(s)) uit.push(g);
        break;
      case 'experiment':
        if (!d.deelnemers.length) uit.push('Er staat nog niemand op dit onderzoek.');
        if (d.plan.raaktMensen && d.deelnemers.length < d.plan.steekproef)
          uit.push('Het plan gaat uit van ' + d.plan.steekproef + ' deelnemers; er staan er ' + d.deelnemers.length + '. Pas het plan aan of werf verder.');
        if (!d.ethiek.stopcriteria.length) uit.push('Een experiment begint niet zonder stopcriterium.');
        break;
      case 'observaties':
        if (!d.logboek.some(l => l.stap === 'experiment')) uit.push('Het experiment is nog niet begonnen.');
        break;
      case 'reflectie':
        if (!d.observaties.length && !d.datasets.length) uit.push('Er is nog niets waargenomen of vastgelegd.');
        break;
      case 'resultaten':
        if (!d.reflectie.length) uit.push('De reflectie is leeg. Wat viel tegen, wat ging mis, wat was onverwacht?');
        break;
      case 'besluit': {
        if (!d.conclusies.length) uit.push('Er is nog geen enkele conclusie.');
        /* Een conclusie zonder dragers mag bestaan -- als AANNAME. Wat niet mag,
           is hem als indicatie of hoger het besluit in dragen. Dit is de laatste
           plek waar een mooi verhaal nog kan stranden. */
        const zwevend = d.conclusies.filter(c => (kader.graad(c.graad) || {}).rang >= 2 && !(c.bewijs || []).length);
        if (zwevend.length) uit.push(zwevend.length + ' conclusie(s) staan op indicatie of hoger zonder één drager eronder.');
        break;
      }
      case 'vervolg':
        if (!s.besluit) uit.push('Er is nog geen besluit genomen.');
        break;
      default: break;
    }
    return uit;
  }

  function stapZet(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const doel = String(b.stap || '');
    const van = kader.STAPPEN.indexOf(s.stap), naar = kader.STAPPEN.indexOf(doel);
    if (naar < 0) return { status: 400, error: 'Kies een geldige stap uit de cyclus.' };
    if (naar === van) return { status: 400, error: 'Dit onderzoek staat al bij ' + doel + '.' };
    if (naar < van)
      return { status: 409, error: 'De cyclus gaat niet terug. Wat er nu anders blijkt, hoort in de reflectie -- en een echt nieuw plan is een nieuwe studie, die u als vervolg aan deze kunt hangen.' };
    if (naar !== van + 1)
      return { status: 400, error: 'Geen stap overslaan: van ' + s.stap + ' gaat het naar ' + kader.STAPPEN[van + 1] + '.' };
    const gebreken = poort(s, doel);
    if (gebreken.length) return { status: 409, error: gebreken[0], gebreken };
    s.stap = doel;
    s.dossier.logboek.unshift({ id: rid(), stap: doel, tekst: 'Stap gezet naar ' + (kader.CYCLUS[naar] || {}).naam + '.', wie: schoon(wie, 80) || 'lab', at: nu() });
    audit(s.labId, 'cyclus.stap', wie, s.id, s.stap);
    spel.beloon(s, 'stap', wie);
    save();
    return { ok: true, stap: s.stap, volgende: kader.STAPPEN[naar + 1] || null };
  }

  /* Wat er nog moet gebeuren om de volgende stap te halen. Dit is wat het scherm
     als "wat nu" toont, en het is dezelfde functie die de stap straks toelaat --
     geen tweede lijst die uit de pas kan lopen (regel 4). */
  function watNu(id) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    const ix = kader.STAPPEN.indexOf(s.stap);
    const volgende = kader.STAPPEN[ix + 1] || null;
    if (!volgende) return { ok: true, stap: s.stap, volgende: null, gebreken: [], klaar: true };
    const gebreken = poort(s, volgende);
    return { ok: true, stap: s.stap, volgende, volgendeNaam: (kader.CYCLUS[ix + 1] || {}).naam,
      gebreken, klaar: !gebreken.length };
  }

  /* ---------- het besluit ----------
     Drie uitkomsten, en ze zijn met opzet gelijkwaardig geformuleerd. "Gestopt"
     is geen mislukking maar een onderzoeksresultaat: het bewijs viel tegen en
     dat weten we nu. ./impact.js telt gestopte studies dan ook als opbrengst en
     niet als verlies. */
  const BESLUITEN = ['doorzetten', 'opschalen', 'gestopt'];
  function besluitZet(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    if (s.stap !== 'besluit' && s.stap !== 'vervolg')
      return { status: 409, error: 'Een besluit hoort bij de stap besluit; dit onderzoek staat bij ' + s.stap + '.' };
    const soort = BESLUITEN.includes(b.soort) ? b.soort : null;
    if (!soort) return { status: 400, error: 'Kies doorzetten, opschalen of gestopt.' };
    const door = schoon(b.door, 80);
    if (door.length < 2) return { status: 400, error: 'Een besluit draagt de naam van wie het neemt.' };
    const reden = schoon(b.reden, 600);
    if (reden.length < 10) return { status: 400, error: 'Waarom dit besluit? Juist bij "gestopt" is dat de waardevolle regel.' };
    s.besluit = { soort, door, reden, at: nu() };
    s.dossier.besluitenlog.unshift({ id: rid(), tekst: 'Besluit: ' + soort + ' -- ' + reden, wie: door, at: nu() });
    audit(s.labId, 'cyclus.besluit', door, s.id, soort);
    if (soort === 'gestopt') spel.beloon(s, 'gestopt', door);
    save();
    return { ok: true, besluit: s.besluit };
  }

  return { poort, stapZet, watNu, besluitZet, BESLUITEN };
};
