/* Het Lab-fonds (kern/labfonds): leden zamelen samen geld in voor het RTF
   Onderzoekslab. Het opgehaalde geld wordt PER LOCATIE verdeeld, zodat elke plek
   zelf in zijn eigen omgeving kan investeren. Wat er per locatie met de pot
   gebeurt, beslissen de leden GEZAMENLIJK -- met een AI-scheidsrechter die let
   op eerlijkheid, of het echt de omgeving dient (geen privaat gewin) en of het
   binnen de pot past. De AI adviseert en breekt gelijke stand; de leden stemmen.

   Dit is de OPENBARE, ledenkant. De besloten R&D van personeel (bedrijfsgeheimen)
   staat los in kern/onderzoekslab.js en is niet via dit fonds zichtbaar.

   Geld is hier een toezegging in het fondsgrootboek (centen); er wordt nooit
   geclaimd dat een echte betaling is verwerkt. Opslag: db.data.labFonds. */

module.exports = ({ db, save, crypto, anthropic }) => {
  const nu = () => new Date().toISOString();
  const rid = () => crypto.randomBytes(4).toString('hex');
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 200);
  const centen = (euro) => Math.max(0, Math.round(Number(euro) * 100) || 0);
  const eur = (c) => Math.round(c) / 100;
  // richtingen die geen omgeving dienen maar privaat gewin: de scheidsrechter raadt af
  const PRIVAAT = ['mezelf', 'mijzelf', 'eigen zak', 'prive', 'privé', 'vakantie voor mij', 'cadeau voor mij', 'zakgeld', 'mijn rekening'];

  function F() {
    if (!db.data.labFonds || typeof db.data.labFonds !== 'object') db.data.labFonds = {};
    const f = db.data.labFonds;
    if (!f.locaties || typeof f.locaties !== 'object') f.locaties = {};
    if (!Array.isArray(f.bijdragen)) f.bijdragen = [];
    if (!Array.isArray(f.voorstellen)) f.voorstellen = [];
    // een startset locaties (elke plek een eigen pot); leden kunnen er bij maken
    if (!Object.keys(f.locaties).length) {
      [['ibiza', 'Ibiza', 'ES'], ['amsterdam', 'Amsterdam', 'NL'], ['rotterdam', 'Rotterdam', 'NL']]
        .forEach(([id, naam, land]) => { f.locaties[id] = { id, naam, land, pot: 0, opgehaald: 0, uitgekeerd: 0 }; });
    }
    return f;
  }
  const loc = (id) => F().locaties[String(id || '')];
  const vindV = (id) => F().voorstellen.find(v => v.id === String(id || ''));

  function locSlug(naam) {
    return schoon(naam, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || rid();
  }
  function locatieMaak(naam, land) {
    const f = F();
    const n = schoon(naam, 40);
    if (n.length < 2) return { status: 400, error: 'Geef de locatie een duidelijke naam.' };
    const id = locSlug(n);
    if (!f.locaties[id]) { f.locaties[id] = { id, naam: n, land: schoon(land, 2).toUpperCase() || '', pot: 0, opgehaald: 0, uitgekeerd: 0 }; save(); }
    return { ok: true, locatie: f.locaties[id] };
  }

  function locBeeld(l, lidKey) {
    const voorstellen = F().voorstellen.filter(v => v.locId === l.id);
    return {
      id: l.id, naam: l.naam, land: l.land,
      pot: eur(l.pot), opgehaald: eur(l.opgehaald), uitgekeerd: eur(l.uitgekeerd),
      open: voorstellen.filter(v => v.status === 'open').length,
      mijnBijdrage: eur(F().bijdragen.filter(b => b.lidKey === lidKey && b.locId === l.id).reduce((s, b) => s + b.centen, 0))
    };
  }
  function voorstelBeeld(v, lidKey) {
    const voor = (v.stemmen.voor || []).length, tegen = (v.stemmen.tegen || []).length;
    return {
      id: v.id, locId: v.locId, titel: v.titel, doel: v.doel, bedrag: eur(v.centen),
      door: v.doorNaam, status: v.status, voor, tegen,
      mijnStem: (v.stemmen.voor || []).includes(lidKey) ? 'voor' : (v.stemmen.tegen || []).includes(lidKey) ? 'tegen' : null,
      scheids: v.scheids || null, besluit: v.besluit || null, at: v.at
    };
  }

  // het openbare fondsoverzicht voor een lid
  function fonds(lidKey) {
    const f = F();
    const locaties = Object.values(f.locaties).map(l => locBeeld(l, lidKey))
      .sort((a, b) => b.pot - a.pot);
    const voorstellen = f.voorstellen.filter(v => v.status === 'open')
      .slice(0, 100).map(v => voorstelBeeld(v, lidKey));
    return {
      ok: true,
      totaalOpgehaald: eur(Object.values(f.locaties).reduce((s, l) => s + l.opgehaald, 0)),
      totaalPot: eur(Object.values(f.locaties).reduce((s, l) => s + l.pot, 0)),
      mijnBijdrage: eur(f.bijdragen.filter(b => b.lidKey === lidKey).reduce((s, b) => s + b.centen, 0)),
      locaties, voorstellen
    };
  }

  // een lid zamelt in: de bijdrage gaat naar de pot van EEN locatie (de omgeving)
  function doneer(lidKey, lidNaam, locId, euro) {
    if (!lidKey) return { status: 403, error: 'Log in met je RTG-account om mee in te zamelen.' };
    const l = loc(locId); if (!l) return { status: 404, error: 'Deze locatie bestaat niet.' };
    const c = centen(euro);
    if (c < 100) return { status: 400, error: 'Zamel minimaal EUR 1 in.' };
    if (c > 5000000) return { status: 400, error: 'Dat is te veel voor een keer; verdeel het over meerdere keren.' };
    l.pot += c; l.opgehaald += c;
    F().bijdragen.unshift({ id: rid(), lidKey, lidNaam: schoon(lidNaam, 40) || 'Lid', locId: l.id, centen: c, at: nu() });
    if (F().bijdragen.length > 5000) F().bijdragen.pop();
    save();
    return { ok: true, locatie: locBeeld(l, lidKey) };
  }

  // een voorstel om uit de pot van een locatie in de omgeving te investeren
  function voorstelMaak(lidKey, lidNaam, locId, titel, doel, euro) {
    if (!lidKey) return { status: 403, error: 'Log in om een voorstel te doen.' };
    const l = loc(locId); if (!l) return { status: 404, error: 'Deze locatie bestaat niet.' };
    const t = schoon(titel, 100), d = schoon(doel, 500);
    if (t.length < 4) return { status: 400, error: 'Geef het voorstel een duidelijke titel.' };
    if (d.length < 10) return { status: 400, error: 'Leg kort uit wat het voor de omgeving oplevert.' };
    const c = centen(euro);
    if (c < 100) return { status: 400, error: 'Noem een bedrag van minimaal EUR 1.' };
    const v = { id: rid(), locId: l.id, doorKey: lidKey, doorNaam: schoon(lidNaam, 40) || 'Lid',
      titel: t, doel: d, centen: c, status: 'open',
      stemmen: { voor: [lidKey], tegen: [] }, scheids: null, besluit: null, at: nu() };
    // de scheidsrechter geeft meteen een eerste oordeel mee
    v.scheids = weegAf(v, l);
    F().voorstellen.unshift(v);
    if (F().voorstellen.length > 3000) F().voorstellen.pop();
    save();
    return { ok: true, voorstel: voorstelBeeld(v, lidKey) };
  }

  function stem(lidKey, voorstelId, keuze) {
    if (!lidKey) return { status: 403, error: 'Log in om te stemmen.' };
    const v = vindV(voorstelId); if (!v) return { status: 404, error: 'Dit voorstel bestaat niet.' };
    if (v.status !== 'open') return { status: 409, error: 'Over dit voorstel is al beslist.' };
    if (!['voor', 'tegen'].includes(keuze)) return { status: 400, error: 'Stem voor of tegen.' };
    v.stemmen.voor = (v.stemmen.voor || []).filter(k => k !== lidKey);
    v.stemmen.tegen = (v.stemmen.tegen || []).filter(k => k !== lidKey);
    v.stemmen[keuze].push(lidKey);
    save();
    return { ok: true, voorstel: voorstelBeeld(v, lidKey) };
  }

  /* De AI-scheidsrechter: weegt eerlijkheid, of het de OMGEVING dient (geen
     privaat gewin) en of het binnen de pot past. Regelgebaseerd zodat het altijd
     werkt; met een echte sleutel verrijkt Rahul de motivatie (hier kort gehouden). */
  function weegAf(v, l) {
    const laag = (v.titel + ' ' + v.doel).toLowerCase();
    if (PRIVAAT.some(w => laag.includes(w)))
      return { oordeel: 'afraden', reden: 'Dit lijkt privaat gewin; het fonds is er voor de omgeving, niet voor een persoon.', at: nu() };
    if (v.centen > l.pot)
      return { oordeel: 'afraden', reden: 'Er zit niet genoeg in de pot van ' + l.naam + ' (' + eur(l.pot) + ' beschikbaar).', at: nu() };
    if (v.centen > l.pot * 0.6 && l.pot > 0)
      return { oordeel: 'twijfel', reden: 'Dit legt in een keer beslag op een groot deel van de pot; overweeg te faseren of te verkleinen.', at: nu() };
    if (v.doel.length < 40)
      return { oordeel: 'twijfel', reden: 'Het doel is nog summier; een duidelijker plan helpt de leden om eerlijk te wegen.', at: nu() };
    return { oordeel: 'steun', reden: 'Past binnen de pot en dient de omgeving; eerlijk om over te stemmen.', at: nu() };
  }
  function scheidsrechter(voorstelId) {
    const v = vindV(voorstelId); if (!v) return { status: 404, error: 'Dit voorstel bestaat niet.' };
    v.scheids = weegAf(v, loc(v.locId) || { naam: '', pot: 0 });
    save();
    return { ok: true, scheids: v.scheids };
  }

  /* De gezamenlijke beslissing: de leden stemmen, de scheidsrechter bewaakt de
     grenzen en breekt een gelijke stand. Toegekend geld gaat uit de pot. */
  function beslis(voorstelId) {
    const v = vindV(voorstelId); if (!v) return { status: 404, error: 'Dit voorstel bestaat niet.' };
    if (v.status !== 'open') return { status: 409, error: 'Over dit voorstel is al beslist.' };
    const l = loc(v.locId); if (!l) return { status: 404, error: 'Deze locatie bestaat niet.' };
    const sc = weegAf(v, l); v.scheids = sc;
    const voor = (v.stemmen.voor || []).length, tegen = (v.stemmen.tegen || []).length;
    let toe = false, reden = '';
    if (sc.oordeel === 'afraden') { reden = 'De scheidsrechter raadt af: ' + sc.reden; }
    else if (v.centen > l.pot) { reden = 'Niet genoeg in de pot.'; }
    else if (voor > tegen) { toe = true; reden = 'Meerderheid voor; de scheidsrechter had geen bezwaar.'; }
    else if (voor === tegen && sc.oordeel === 'steun') { toe = true; reden = 'Gelijke stand; de scheidsrechter geeft de doorslag (steun).'; }
    else { reden = 'Geen meerderheid voor.'; }
    if (toe) { l.pot -= v.centen; l.uitgekeerd += v.centen; }
    v.status = toe ? 'toegekend' : 'afgewezen';
    v.besluit = { toegekend: toe, voor, tegen, reden, at: nu() };
    save();
    return { ok: true, voorstel: voorstelBeeld(v, v.doorKey), locatie: locBeeld(l, v.doorKey) };
  }

  // voor de boardroom: het hele fonds op een bord (alle locaties, alle voorstellen)
  function boardroom() {
    const f = F();
    return {
      ok: true,
      locaties: Object.values(f.locaties).map(l => ({ ...locBeeld(l, null) })),
      voorstellen: f.voorstellen.slice(0, 200).map(v => voorstelBeeld(v, null)),
      bijdragen: f.bijdragen.length
    };
  }

  return { labfonds: { fonds, locatieMaak, doneer, voorstelMaak, stem, scheidsrechter, beslis, boardroom } };
};
