/* DE REISWACHT -- fase 3 van REIZEN.md: wat er speelt rond uw komende reizen.

   DE GEVAARLIJKSTE FUNCTIE VAN DEZE WERELD, en daarom staan de eerlijkheids-
   regels boven de functies (REIZEN.md par. 4.2). Een groen vinkje "wij houden
   uw vlucht in de gaten" bij een wachter die niets ophaalt, stuurt iemand
   ontspannen naar een vliegveld waar zijn vlucht al drie uur geschrapt is.

   DRIE REGELS, EN ZE ZIJN HARD.

   1. DIT IS EEN MOMENTOPNAME, GEEN ACHTERGRONDWACHTER. Alles hieronder wordt
      berekend op het moment van opvragen. RTG waakt NIET door terwijl de app
      dicht is, en het antwoord zegt dat met zoveel woorden (`momentopname`).
      Een echte achtergrondwachter met meldingen is een eigen stap met een
      eigen besluit -- niet iets dat hier stilletjes bij groeit.
   2. ELKE BRON MELDT ZICHZELF, ook als hij stilvalt en JUIST als hij er niet
      is. Externe luchtvaart- en spoorbronnen zijn niet aangesloten; die staan
      als `ontbreekt` in de lijst in plaats van weggelaten. Een bron die bij
      het rekenen omvalt wordt `stil` -- met de tekst "RTG kijkt hier nu niet
      mee" -- en de rest rekent door (LAT-regel 3: stilvallen is geen uitkomst,
      en zeker geen groene).
   3. ER WORDT NIETS BEWEERD DAT NIET UIT EEN EIGEN BRON KOMT. Een document-
      signaal komt uit de datums die het lid zelf invulde (Entourage zegt dat
      er ook bij), een visumsignaal uit de Reiswijzer plus de eigen agenda.
      Inreisvereisten worden hier niet geraden -- dat weigert Entourage al met
      reden, en die reden geldt hier net zo hard.

   Wat de wacht WEL kan, uit de bronnen die dit huis echt heeft:
   - een onderdeel dat aandacht vraagt (afgewezen, vertraagd, na te kijken);
   - een document van het gezelschap dat verloopt voor het einde van een reis;
   - een visumplichtige bestemming met een open taak, of zonder taak terwijl
     het vertrek dichtbij komt;
   - een onvolledig beeld: een bron van de reiswereld die stilviel.

   Leest alleen; bezit niets; geen eigen collectie (REIZEN.md par. 4.1). */
'use strict';
const klok = require('../lib/klok');

const { agendaLidSleutel } = require('./agenda');

module.exports.maakReiswacht = ({ kern }) => {
  const nu = () => klok.datum().toISOString();
  const vandaag = () => nu().slice(0, 10);
  const dagenTot = (d) => Math.round((Date.parse(d + 'T00:00:00Z') - Date.parse(vandaag() + 'T00:00:00Z')) / 86400000);

  /* Een bron aanspreken zonder dat hij de rest meeneemt. Geeft [waarde, null]
     of [null, bronregel-met-stil]: de aanroeper ziet dus ALTIJD wat er met de
     bron gebeurd is. */
  function meet(naam, uitleg, fn, bronnen) {
    try {
      const w = fn();
      bronnen.push({ naam, stand: 'gemeten', uitleg, at: nu() });
      return w;
    } catch (e) {
      bronnen.push({ naam, stand: 'stil', at: nu(),
        uitleg: 'RTG kijkt hier nu niet mee: deze bron gaf geen antwoord. ' + uitleg });
      return null;
    }
  }

  const signaal = (ernst, tekst, bron, grond) => ({ ernst, tekst, bron, grond });

  /* De signalen van EEN reis, tegen de gemeten bronnen. Puur: alle invoer komt
     binnen, zodat de toetsen dit los kunnen narekenen. */
  function signalenVan(reis, { attenties, taken, wijzer }) {
    const uit = [];

    // 1. onderdelen die zelf al aandacht vragen -- het oordeel is van de wereld
    for (const o of reis.onderdelen) {
      if (o.sig !== 'incident' && o.sig !== 'aandacht') continue;
      uit.push(signaal(o.sig,
        (o.titel || o.soort) + ': ' + o.status + (o.wacht ? ' (wacht op ' + o.wacht + ')' : ''),
        o.app || 'reiswereld', 'de stand van dit onderdeel in zijn eigen domein'));
    }

    // 2. documenten die verlopen voor het einde van deze reis
    for (const a of (attenties || [])) {
      if (!a.tot || a.tot > reis.venster.tot) continue;
      uit.push(signaal(a.verlopen ? 'incident' : 'aandacht',
        (a.verlopen ? 'Verlopen: ' : 'Verloopt voor het einde van deze reis: ') +
          a.soort + ' van ' + a.naam + ' (geldig tot ' + a.tot + ')',
        'documenten', 'de datums die u zelf bij uw gezelschap invulde'));
    }

    /* 3. het visum. Drie uitkomsten, en de derde is bewust een vraag en geen
       bewering: een taak die er niet (meer) staat kan ook gewoon geregeld
       zijn. Wij zien alleen wat wij zien, en dat staat er dan ook. */
    if (wijzer && wijzer.ok && wijzer.visum && ['toestemming', 'evisum', 'visum'].includes(wijzer.visum.soort)) {
      const open = (taken || []).filter(t => !t.gedaan);
      const dagen = dagenTot(reis.venster.van);
      if (open.length) {
        uit.push(signaal(dagen <= 14 ? 'incident' : 'aandacht',
          open[0].titel + ' staat nog open' + (dagen >= 0 ? ' en u vertrekt over ' + dagen + ' dagen' : ''),
          'visumtaken', 'de open taak in uw eigen agenda, plus de Reiswijzer van ' + wijzer.naam));
      } else if (!(taken || []).length && dagen >= 0 && dagen <= 30) {
        uit.push(signaal('aandacht',
          wijzer.naam + ' vraagt vooraf een ' + wijzer.visum.label.toLowerCase() +
            '; wij zien daarvoor geen taak in uw agenda. Al geregeld? Dan is dit signaal klaar.',
          'landregels', 'de Reiswijzer van ' + wijzer.naam + '; of het al geregeld is, weet alleen u'));
      }
    }
    return uit;
  }

  function wacht(key) {
    const bronnen = [];

    const w = meet('reizen', 'uw reizen, uit de reisdomeinen zelf',
      () => kern.mijnReizen(key), bronnen);
    if (!w) {
      /* Zonder De Reis is er niets om tegenaan te leggen. Dan is de wacht niet
         "rustig" maar STUK, en dat is de enige eerlijke uitkomst hier. */
      return { ok: false, status: 503, error: 'De reiswacht kan uw reizen nu niet lezen. Probeer het zo opnieuw.', bronnen };
    }

    const ent = meet('documenten', 'de vervaldatums van uw gezelschap (Entourage)',
      () => (kern.entourage(key) || {}).attenties || [], bronnen);
    const agendaTaken = meet('visumtaken', 'de reistaken in uw eigen agenda',
      () => kern.agenda.lijst(agendaLidSleutel(key)).filter(t => String(t.bron || '').startsWith('reis:')), bronnen);

    /* De Reiswijzer loopt per reis, dus zijn bronregel wordt hier verzameld en
       pas NA de lus gezet: viel hij bij ook maar een reis om, dan staat hij als
       stil -- niet als gemeten omdat de andere reizen toevallig wel lukten. */
    let wijzerStil = false;
    const reizen = w.reizen.map(reis => {
      let wijzer = null;
      try { wijzer = kern.reiswijzer(reis.bestemming); } catch (e) { wijzerStil = true; }
      const taken = (agendaTaken || []).filter(t =>
        reis.onderdelen.some(o => t.bron === 'reis:' + o.kenmerk));
      const signalen = signalenVan(reis, { attenties: ent, taken, wijzer });
      return { id: reis.id, bestemming: reis.bestemming, venster: reis.venster,
        signalen, gereed: !signalen.length };
    });
    bronnen.push(wijzerStil
      ? { naam: 'landregels', stand: 'stil', at: nu(),
          uitleg: 'RTG kijkt hier nu niet mee: de Reiswijzer gaf voor minstens één bestemming geen antwoord.' }
      : { naam: 'landregels', stand: 'gemeten', uitleg: 'de Reiswijzer per bestemming', at: nu() });

    /* De bronnen die er NIET zijn, met naam. Weglaten zou de lijst compleet
       laten lijken, en dat is precies de leugen waar par. 4.2 over gaat. */
    bronnen.push({ naam: 'luchtvaart (extern)', stand: 'ontbreekt',
      uitleg: 'RTG kijkt hier nu niet mee: er is geen externe luchtvaartbron aangesloten. Vluchtstatussen komen alleen uit de eigen RTG-luchthaven.' });
    bronnen.push({ naam: 'spoor (extern)', stand: 'ontbreekt',
      uitleg: 'RTG kijkt hier nu niet mee: er is geen spoorbron aangesloten.' });

    return {
      ok: true, reizen,
      /* De stille bronnen van de reiswereld reizen door: een reis waarvan een
         domein niet meedeed, is onvolledig en geen rustige. */
      stil: w.stil || [],
      bronnen,
      momentopname: true, at: nu(),
      uitleg: 'Dit beeld is berekend op het moment dat u het opvroeg. RTG waakt niet op de achtergrond door; open dit scherm opnieuw voor een verse meting.'
    };
  }

  return { reiswacht: { wacht, signalenVan } };
};
