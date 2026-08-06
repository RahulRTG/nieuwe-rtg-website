/* Foundation OS, deel "beleid": de landelijke regels, en wie ze heeft bevestigd.

   HET FEDERATIEVE MODEL STAAT OF VALT HIER. RTF levert merk, software,
   governance en geld; de steden leveren mensen en lokale kennis. Dat werkt
   alleen als er een set regels is die overal geldt -- gedragscode,
   privacyregels, inkoopregels, hoe je omgaat met beeldmateriaal van kinderen.
   Zonder zo'n set is "binnen de centrale regels van RTF" een zin in een
   overeenkomst en verder niets.

   DE GRENDEL DIE ERTOE DOET: EEN NIEUWE VERSIE WIST ALLE BEVESTIGINGEN. Dat is
   contra-intuitief -- het voelt als werk weggooien -- en het is precies het
   punt. Een handtekening onder versie 1 is geen handtekening onder versie 2.
   Wie dat niet afdwingt, bouwt een lijst met groene vinkjes waarvan niemand
   weet waaronder ze staan, en dat is gevaarlijker dan geen lijst: het ziet
   eruit als toezicht.

   VERDER:
   - EEN STAD KAN EEN LANDELIJKE REGEL NIET WIJZIGEN. Alleen bevestigen dat hij
     gelezen en toegepast is. Wie de regel wil veranderen, gaat naar het
     landelijke bestuur -- dat is wat "centraal bepaalt wat lokaal mag" betekent.
   - EEN REGEL DIE NOG NIET IS INGEGAAN, TELT NIET MEE in het "wie moet nog"-
     lijstje. Een stad afrekenen op een regel die volgende maand ingaat, leert
     hem alleen de lijst te negeren.
   - NIET BEVESTIGD IS ZICHTBAAR, met het aantal dagen erbij. Een openstaande
     bevestiging die nergens opvalt, blijft open. */

const SOORTEN = ['gedragscode', 'privacy', 'financieel', 'inkoop', 'veiligheid', 'communicatie', 'kwaliteit'];

module.exports = (ctx) => {
  const { nu, rid, schoon, S, audit, wie, save } = ctx;

  const vind = id => S().beleid.find(b => b.id === String(id || '')) || null;
  const dagen = d => Math.max(0, Math.floor((Date.now() - Date.parse(d)) / 86400000));
  const geldt = r => !r.ingangsdatum || Date.parse(r.ingangsdatum) <= Date.now();

  function beeld(r) {
    const steden = S().steden.filter(s => s.status === 'actief');
    const bevestigd = r.bevestigingen || {};
    return { id: r.id, titel: r.titel, soort: r.soort, versie: r.versie, tekst: r.tekst,
      ingangsdatum: r.ingangsdatum, vanKracht: geldt(r), at: r.at, gewijzigd: r.gewijzigd || null,
      bevestigd: steden.filter(s => bevestigd[s.id]).map(s => ({ stad: s.id, naam: s.naam,
        at: bevestigd[s.id].at, door: bevestigd[s.id].door })),
      /* Alleen als de regel van kracht is; anders is "open" een verwijt over
         iets dat nog niet geldt. */
      open: geldt(r)
        ? steden.filter(s => !bevestigd[s.id]).map(s => ({ stad: s.id, naam: s.naam, dagen: dagen(r.ingangsdatum || r.at) }))
        : [] };
  }

  function maak(req, b) {
    b = b || {};
    const w = wie(req);
    if (!w.landelijk) return { status: 403, error: 'Landelijk beleid stelt het landelijke bestuur vast. Een stad kan het bevestigen, niet schrijven.' };
    const titel = schoon(b.titel, 120);
    if (!titel) return { status: 400, error: 'Hoe heet deze regel?' };
    const tekst = schoon(b.tekst, 4000);
    if (tekst.length < 20) return { status: 400, error: 'Schrijf de regel uit. Een titel zonder tekst is niets om je aan te houden.' };
    const soort = SOORTEN.includes(b.soort) ? b.soort : 'kwaliteit';
    const r = { id: rid(), titel, soort, versie: 1, tekst,
      ingangsdatum: /^\d{4}-\d{2}-\d{2}$/.test(schoon(b.ingangsdatum, 10)) ? schoon(b.ingangsdatum, 10) : nu().slice(0, 10),
      bevestigingen: {}, at: nu(), gewijzigd: null };
    S().beleid.push(r);
    audit(w.key, 'beleid.maak', r.id, titel + ' v1');
    save();
    return { ok: true, regel: beeld(r) };
  }

  /* Herzien: nieuwe versie, en ALLE bevestigingen vervallen. */
  function herzien(req, id, b) {
    b = b || {};
    const w = wie(req);
    if (!w.landelijk) return { status: 403, error: 'Landelijk beleid herziet het landelijke bestuur.' };
    const r = vind(id);
    if (!r) return { status: 404, error: 'Deze beleidsregel bestaat niet.' };
    const tekst = schoon(b.tekst, 4000);
    if (tekst.length < 20) return { status: 400, error: 'Schrijf de nieuwe tekst uit.' };
    if (tekst === r.tekst) return { status: 400, error: 'De tekst is niet veranderd. Een nieuwe versie zonder nieuwe tekst zet alleen alle bevestigingen op nul.' };
    const kwijt = Object.keys(r.bevestigingen || {}).length;
    r.versie += 1;
    r.tekst = tekst;
    if (/^\d{4}-\d{2}-\d{2}$/.test(schoon(b.ingangsdatum, 10))) r.ingangsdatum = schoon(b.ingangsdatum, 10);
    if (schoon(b.titel, 120)) r.titel = schoon(b.titel, 120);
    r.bevestigingen = {};
    r.gewijzigd = nu();
    audit(w.key, 'beleid.herzien', r.id, 'v' + r.versie + ', ' + kwijt + ' bevestiging(en) vervallen');
    save();
    return { ok: true, regel: beeld(r),
      melding: 'Versie ' + r.versie + ' staat klaar. ' + kwijt + ' eerdere bevestiging(en) zijn vervallen: ' +
        'een handtekening onder de vorige tekst is geen handtekening onder deze.' };
  }

  function bevestig(req, id, stadId) {
    const r = vind(id);
    if (!r) return { status: 404, error: 'Deze beleidsregel bestaat niet.' };
    const w = wie(req);
    const g = ctx.poort(w, stadId, 'stad.beheren');
    if (!g.ok) return g;
    if (!geldt(r)) return { status: 400, error: 'Deze regel gaat pas in op ' + r.ingangsdatum + '. Bevestigen kan vanaf die datum.' };
    if (!r.bevestigingen) r.bevestigingen = {};
    if (r.bevestigingen[g.stad.id]) {
      return { status: 400, error: g.stad.naam + ' heeft versie ' + r.versie + ' al bevestigd op ' +
        String(r.bevestigingen[g.stad.id].at).slice(0, 10) + '.' };
    }
    r.bevestigingen[g.stad.id] = { at: nu(), door: w.key, versie: r.versie };
    audit(w.key, 'beleid.bevestigd', r.id, g.stad.naam + ' bevestigt v' + r.versie);
    save();
    return { ok: true, regel: beeld(r),
      melding: g.stad.naam + ' bevestigt versie ' + r.versie + '. Bij een volgende versie vraagt het systeem het opnieuw.' };
  }

  function lijst(req, filter) {
    const f = filter || {};
    const w = wie(req);
    let rijen = S().beleid.slice();
    if (f.soort) rijen = rijen.filter(r => r.soort === String(f.soort));
    const alles = rijen.map(beeld);
    /* Voor een stad is de vraag niet "welke regels zijn er" maar "wat moet ik
       nog". Dat getal komt hier mee in plaats van dat elk scherm het zelf
       uitrekent. */
    const mijn = w.landelijk ? [] : [...new Set(w.zetels.map(z => z.stad))];
    const openVoorMij = mijn.length
      ? alles.filter(r => r.open.some(o => mijn.includes(o.stad))).length
      : alles.filter(r => r.open.length).length;
    return { ok: true, aantal: alles.length, openVoorMij, soorten: SOORTEN, regels: alles.slice(0, 200) };
  }

  return { maak, herzien, bevestig, lijst, vind, beeld, geldt, SOORTEN };
};
module.exports.SOORTEN = SOORTEN;
