/* Kern-module "leren": de leerlaag van de RTFoundation, op de vriendenlaag.

   - Overhoorlijsten: vraag-antwoordparen (woordjes, topografie, begrippen),
     zelf gemaakt of door de AI (met een nette demoterugval zonder sleutel).
     Solo overhoren gebeurt op het scherm; de server bewaart de lijsten en
     de beste score per lijst.
   - Samen leren: een overhoorduel over een van je lijsten. Je nodigt een
     leermaatje uit (vriend of codenaam; samen leren maakt je NIET
     automatisch vrienden), allebei krijgen dezelfde vragen in dezelfde
     volgorde en de standen lopen live mee.
   - Schrijven: schrijfopdrachten per leeftijdsgroep, met buddy-feedback
     (compliment plus tips, nooit een herschrijving) en bewaarde concepten.
   - Projecten: samen aan een werkstuk, spreekbeurt of knutsel. Leden
     verdelen taken (claimen, afvinken), verzamelen notities en kunnen de
     AI een projectplan laten voorstellen.

   Alles is server-authoritatief: de client toont, de server beslist. */
module.exports = ({ db, save, crypto, codenaamVan, zijnVrienden, socialZoek, isGeblokkeerd, sociaalRate, sseToCustomer, anthropic, leeftijdInstr }) => {
  const rid = n => crypto.randomBytes(n).toString('hex');
  const nu = () => new Date().toISOString();
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n);
  function L() {
    if (!db.data.leren) db.data.leren = { lijsten: {}, sessies: {}, projecten: {}, schrijfsels: {} };
    return db.data.leren;
  }
  const seintje = (naar, wat, id) => { try { sseToCustomer(naar, 'social', { kind: wat, id }); } catch (e) {} };
  function schud(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = crypto.randomInt(0, i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
  // antwoorden vergelijken zonder gedoe over hoofdletters, accenten en leestekens
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  /* ---------- opschonen: klare duels na een dag weg, wachtende na 6 uur ---------- */
  let opgeruimdOm = 0;
  function opruimen() {
    const t = Date.now();
    if (t - opgeruimdOm < 60000) return;
    opgeruimdOm = t;
    for (const [id, s] of Object.entries(L().sessies)) {
      const leeftijd = t - new Date(s.at).getTime();
      if ((s.status === 'klaar' && leeftijd > 86400000) || (s.status === 'wacht' && leeftijd > 6 * 3600000)) delete L().sessies[id];
    }
  }

  /* ================= overhoorlijsten ================= */
  function lijstenVan(mij) {
    return { status: 200, lijsten: Object.values(L().lijsten).filter(l => l.van === mij)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .map(l => ({ id: l.id, naam: l.naam, aantal: l.paren.length, beste: l.beste || null, at: l.at })) };
  }
  function lijstMaak(mij, { naam, paren }) {
    const p = (Array.isArray(paren) ? paren : []).map(x => ({ v: schoon(x.v, 120), a: schoon(x.a, 120) })).filter(x => x.v && x.a).slice(0, 100);
    if (p.length < 2) return { status: 400, error: 'Een lijst heeft minstens twee vraag-antwoordparen nodig.' };
    if (Object.values(L().lijsten).filter(l => l.van === mij).length >= 50) return { status: 400, error: 'Je hebt al vijftig lijsten; ruim er eerst een op.' };
    const l = { id: rid(5), van: mij, naam: schoon(naam, 60) || 'Mijn lijst', paren: p, at: nu() };
    L().lijsten[l.id] = l; save();
    return { status: 200, ok: true, id: l.id, aantal: p.length };
  }
  function lijstHaal(mij, id) {
    const l = L().lijsten[id];
    if (!l || l.van !== mij) return { status: 404, error: 'Deze lijst is er niet (meer).' };
    return { status: 200, lijst: { id: l.id, naam: l.naam, paren: l.paren, beste: l.beste || null } };
  }
  function lijstWeg(mij, id) {
    const l = L().lijsten[id];
    if (!l || l.van !== mij) return { status: 404, error: 'Deze lijst is er niet (meer).' };
    delete L().lijsten[id]; save();
    return { status: 200, ok: true };
  }
  function overhoorKlaar(mij, id, goed, totaal) {
    const l = L().lijsten[id];
    if (!l || l.van !== mij) return { status: 404, error: 'Deze lijst is er niet (meer).' };
    const g = Math.max(0, Math.min(1000, Math.floor(Number(goed) || 0)));
    const t = Math.max(1, Math.min(1000, Math.floor(Number(totaal) || 0)));
    if (!l.beste || g / t > l.beste.goed / l.beste.totaal) { l.beste = { goed: g, totaal: t, at: nu() }; save(); }
    return { status: 200, ok: true, beste: l.beste };
  }

  /* De AI maakt een lijst over een onderwerp; zonder sleutel valt hij terug op
     nette kant-en-klare setjes, zodat de knop in de demo gewoon werkt. */
  const DEMO_LIJSTEN = [
    { test: /hoofdstad|europ/i, naam: 'Hoofdsteden van Europa', paren: [
      { v: 'Nederland', a: 'Amsterdam' }, { v: 'Belgie', a: 'Brussel' }, { v: 'Frankrijk', a: 'Parijs' }, { v: 'Duitsland', a: 'Berlijn' },
      { v: 'Spanje', a: 'Madrid' }, { v: 'Italie', a: 'Rome' }, { v: 'Portugal', a: 'Lissabon' }, { v: 'Polen', a: 'Warschau' },
      { v: 'Griekenland', a: 'Athene' }, { v: 'Noorwegen', a: 'Oslo' }] },
    { test: /engels|english/i, naam: 'Engelse woordjes', paren: [
      { v: 'de hond', a: 'dog' }, { v: 'de kat', a: 'cat' }, { v: 'het huis', a: 'house' }, { v: 'de school', a: 'school' },
      { v: 'het boek', a: 'book' }, { v: 'de vriend', a: 'friend' }, { v: 'het water', a: 'water' }, { v: 'de zon', a: 'sun' },
      { v: 'de maan', a: 'moon' }, { v: 'het brood', a: 'bread' }] },
    { test: /frans/i, naam: 'Franse woordjes', paren: [
      { v: 'de hond', a: 'le chien' }, { v: 'de kat', a: 'le chat' }, { v: 'het huis', a: 'la maison' }, { v: 'het brood', a: 'le pain' },
      { v: 'de kaas', a: 'le fromage' }, { v: 'het water', a: "l'eau" }, { v: 'de school', a: "l'ecole" }, { v: 'de vriend', a: "l'ami" }] },
    { test: /provincie|topo|nederland/i, naam: 'Provincies en hoofdsteden', paren: [
      { v: 'Noord-Holland', a: 'Haarlem' }, { v: 'Zuid-Holland', a: 'Den Haag' }, { v: 'Utrecht', a: 'Utrecht' }, { v: 'Gelderland', a: 'Arnhem' },
      { v: 'Overijssel', a: 'Zwolle' }, { v: 'Friesland', a: 'Leeuwarden' }, { v: 'Groningen', a: 'Groningen' }, { v: 'Drenthe', a: 'Assen' },
      { v: 'Flevoland', a: 'Lelystad' }, { v: 'Noord-Brabant', a: 'Den Bosch' }, { v: 'Limburg', a: 'Maastricht' }, { v: 'Zeeland', a: 'Middelburg' }] },
    { test: /reken|tafel/i, naam: 'De tafels van 6 tot en met 9', paren: [
      { v: '6 x 7', a: '42' }, { v: '7 x 8', a: '56' }, { v: '8 x 9', a: '72' }, { v: '6 x 9', a: '54' },
      { v: '7 x 7', a: '49' }, { v: '8 x 8', a: '64' }, { v: '9 x 9', a: '81' }, { v: '6 x 8', a: '48' }] }
  ];
  async function lijstAi(mij, onderwerp, groep) {
    onderwerp = schoon(onderwerp, 80);
    if (!onderwerp) return { status: 400, error: 'Zeg waarover de lijst moet gaan.' };
    if (!sociaalRate(mij, 'leren-ai', 30, 3600000)) return { status: 429, error: 'Rustig aan; probeer het over een uurtje weer.' };
    if (anthropic) {
      try {
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 900,
          system: 'Je maakt overhoorlijsten voor leerlingen. Feitelijk juist, korte antwoorden (een woord of getal waar het kan). ' + (leeftijdInstr ? leeftijdInstr(groep) : ''),
          messages: [{ role: 'user', content: 'Maak een overhoorlijst van 10 vraag-antwoordparen over: ' + onderwerp + '. Antwoord ALLEEN met JSON in deze vorm: {"naam":"korte titel","paren":[{"v":"vraag","a":"antwoord"}]}' }] });
        const tekst = (r.content || []).map(b => b.text || '').join('');
        const m = tekst.match(/\{[\s\S]*\}/);
        if (m) {
          const j = JSON.parse(m[0]);
          const uit = lijstMaak(mij, { naam: j.naam || onderwerp, paren: j.paren });
          if (uit.ok) return uit;
        }
      } catch (e) { /* val terug op het demosetje */ }
    }
    const kk = DEMO_LIJSTEN.find(k => k.test.test(onderwerp)) || DEMO_LIJSTEN[0];
    const uit = lijstMaak(mij, { naam: kk.naam, paren: kk.paren });
    return uit.ok ? Object.assign(uit, { demo: true }) : uit;
  }

  /* ================= samen leren: het overhoorduel ================= */
  async function nodigUit(mij, vrienden, codenamen, maxErbij, rateSleutel) {
    // gedeeld uitnodigingspad: vrienden op sleutel, anderen op exacte codenaam.
    // Samen leren of samen werken maakt je NIET automatisch vrienden.
    if (!sociaalRate(mij, rateSleutel, 20, 3600000)) return { error: { status: 429, error: 'Rustig aan met uitnodigen.' } };
    const uit = (Array.isArray(vrienden) ? vrienden : []).slice(0, maxErbij).filter(v => zijnVrienden(mij, v));
    for (const cn of (Array.isArray(codenamen) ? codenamen : []).slice(0, maxErbij)) {
      const zoek = await socialZoek(mij, String(cn));
      const hit = (zoek || []).find(r => String(r.codename).toLowerCase() === String(cn).trim().toLowerCase());
      if (!hit) return { error: { status: 404, error: 'De codenaam "' + String(cn).slice(0, 40) + '" is niet gevonden.' } };
      if (isGeblokkeerd(mij, hit.key)) return { error: { status: 403, error: 'Dit contact is niet beschikbaar.' } };
      if (!uit.includes(hit.key) && hit.key !== mij) uit.push(hit.key);
    }
    return { uitgenodigd: uit.slice(0, maxErbij) };
  }
  async function sessieStart(mij, { lijstId, vrienden, codenamen }) {
    opruimen();
    const l = L().lijsten[String(lijstId || '')];
    if (!l || l.van !== mij) return { status: 404, error: 'Kies eerst een van je eigen lijsten.' };
    const wie = await nodigUit(mij, vrienden, codenamen, 1, 'leer-uitnodiging');
    if (wie.error) return wie.error;
    if (wie.uitgenodigd.length !== 1) return { status: 400, error: 'Nodig precies een leermaatje uit (vriend of codenaam).' };
    const s = { id: rid(5), naam: l.naam, paren: l.paren.map(p => ({ v: p.v, a: p.a })), volgorde: schud(l.paren.map((_, i) => i)),
      spelers: [mij], uitgenodigd: wie.uitgenodigd, status: 'wacht', idx: { [mij]: 0 }, goed: { [mij]: 0 }, at: nu(), door: codenaamVan(mij) };
    L().sessies[s.id] = s; save();
    seintje(wie.uitgenodigd[0], 'leersessie', s.id);
    return { status: 200, ok: true, id: s.id };
  }
  function sessieAntwoord(mij, id, akkoord) {
    const s = L().sessies[id];
    if (!s || s.status !== 'wacht' || !s.uitgenodigd.includes(mij)) return { status: 404, error: 'Deze uitnodiging is er niet meer.' };
    s.uitgenodigd = [];
    if (akkoord === true) {
      s.spelers.push(mij); s.idx[mij] = 0; s.goed[mij] = 0; s.status = 'bezig';
    } else delete L().sessies[id];
    save();
    s.spelers.forEach(sp => seintje(sp, 'leersessie', id));
    return { status: 200, ok: true, gestart: s.status === 'bezig' };
  }
  function sessiesVan(mij) {
    opruimen();
    const alle = Object.values(L().sessies);
    return { status: 200,
      sessies: alle.filter(s => s.spelers.includes(mij)).map(s => ({ id: s.id, naam: s.naam, status: s.status, spelers: s.spelers.map(codenaamVan), at: s.at }))
        .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 10),
      uitnodigingen: alle.filter(s => s.status === 'wacht' && s.uitgenodigd.includes(mij)).map(s => ({ id: s.id, naam: s.naam, van: s.door, aantal: s.paren.length })) };
  }
  function sessieStaat(mij, id) {
    const s = L().sessies[id];
    if (!s || !s.spelers.includes(mij)) return { status: 404, error: 'Deze leersessie bestaat niet (meer).' };
    const ander = s.spelers.find(sp => sp !== mij);
    const mijnIdx = s.idx[mij] || 0;
    return { status: 200, sessie: { id: s.id, naam: s.naam, status: s.status, aantal: s.paren.length,
      ik: { idx: mijnIdx, goed: s.goed[mij] || 0, klaar: mijnIdx >= s.paren.length },
      ander: ander ? { codenaam: codenaamVan(ander), idx: s.idx[ander] || 0, goed: s.goed[ander] || 0, klaar: (s.idx[ander] || 0) >= s.paren.length } : null,
      vraag: s.status === 'bezig' && mijnIdx < s.paren.length ? s.paren[s.volgorde[mijnIdx]].v : null,
      winnaar: s.winnaar || null, gelijk: !!s.gelijk } };
  }
  function sessieZet(mij, id, antwoord) {
    const s = L().sessies[id];
    if (!s || !s.spelers.includes(mij)) return { status: 404, error: 'Deze leersessie bestaat niet (meer).' };
    if (s.status !== 'bezig') return { status: 409, error: 'Deze sessie loopt niet (meer).' };
    const i = s.idx[mij] || 0;
    if (i >= s.paren.length) return { status: 409, error: 'Jij bent al klaar; wacht op de ander.' };
    const p = s.paren[s.volgorde[i]];
    const goed = norm(antwoord) === norm(p.a);
    if (goed) s.goed[mij] = (s.goed[mij] || 0) + 1;
    s.idx[mij] = i + 1;
    // allebei klaar: de stand bepaalt de winnaar (gelijkspel kan)
    if (s.spelers.length === 2 && s.spelers.every(sp => (s.idx[sp] || 0) >= s.paren.length)) {
      s.status = 'klaar';
      const [a, b] = s.spelers;
      if (s.goed[a] === s.goed[b]) s.gelijk = true;
      else s.winnaar = codenaamVan(s.goed[a] > s.goed[b] ? a : b);
    }
    save();
    s.spelers.filter(sp => sp !== mij).forEach(sp => seintje(sp, 'leersessie', id));
    return { status: 200, ok: true, goed, juist: p.a, klaar: s.idx[mij] >= s.paren.length };
  }

  /* ================= samen aan een project ================= */
  function projectenVan(mij) {
    const alle = Object.values(L().projecten);
    return { status: 200,
      projecten: alle.filter(p => p.leden.includes(mij)).map(p => ({ id: p.id, titel: p.titel, wat: p.wat, leden: p.leden.map(codenaamVan),
        taken: p.taken.length, af: p.taken.filter(t => t.af).length, at: p.at }))
        .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 20),
      uitnodigingen: alle.filter(p => p.uitgenodigd.includes(mij)).map(p => ({ id: p.id, titel: p.titel, van: codenaamVan(p.door) })) };
  }
  function projectMaak(mij, { titel, wat }) {
    titel = schoon(titel, 80);
    if (!titel) return { status: 400, error: 'Geef je project een naam (bijv. "Spreekbeurt over dolfijnen").' };
    if (Object.values(L().projecten).filter(p => p.door === mij).length >= 20) return { status: 400, error: 'Je hebt al twintig projecten; rond er eerst een af.' };
    const p = { id: rid(5), titel, wat: schoon(wat, 300), door: mij, leden: [mij], uitgenodigd: [], taken: [], notities: [], at: nu() };
    L().projecten[p.id] = p; save();
    return { status: 200, ok: true, id: p.id };
  }
  async function projectUitnodig(mij, { id, vrienden, codenamen }) {
    const p = L().projecten[String(id || '')];
    if (!p || !p.leden.includes(mij)) return { status: 404, error: 'Dit project bestaat niet (meer).' };
    if (p.leden.length + p.uitgenodigd.length >= 6) return { status: 400, error: 'Een project heeft hooguit zes deelnemers.' };
    const wie = await nodigUit(mij, vrienden, codenamen, 6 - p.leden.length - p.uitgenodigd.length, 'project-uitnodiging');
    if (wie.error) return wie.error;
    if (!wie.uitgenodigd.length) return { status: 400, error: 'Nodig minstens een projectmaatje uit (vriend of codenaam).' };
    for (const h of wie.uitgenodigd) if (!p.leden.includes(h) && !p.uitgenodigd.includes(h)) { p.uitgenodigd.push(h); seintje(h, 'project', p.id); }
    save();
    return { status: 200, ok: true };
  }
  function projectAntwoord(mij, id, akkoord) {
    const p = L().projecten[String(id || '')];
    if (!p || !p.uitgenodigd.includes(mij)) return { status: 404, error: 'Deze uitnodiging is er niet meer.' };
    p.uitgenodigd = p.uitgenodigd.filter(h => h !== mij);
    if (akkoord === true) p.leden.push(mij);
    save();
    p.leden.forEach(sp => seintje(sp, 'project', p.id));
    return { status: 200, ok: true, lid: akkoord === true };
  }
  function projectStaat(mij, id) {
    const p = L().projecten[String(id || '')];
    if (!p || !p.leden.includes(mij)) return { status: 404, error: 'Dit project bestaat niet (meer).' };
    return { status: 200, project: { id: p.id, titel: p.titel, wat: p.wat, ikMaakte: p.door === mij,
      leden: p.leden.map(codenaamVan), wachtOp: p.uitgenodigd.length,
      taken: p.taken, notities: p.notities.slice(-60), mijnCodenaam: codenaamVan(mij) } };
  }
  function projectWeg(mij, id) {
    const p = L().projecten[String(id || '')];
    if (!p || p.door !== mij) return { status: 404, error: 'Alleen wie het project startte kan het opruimen.' };
    delete L().projecten[String(id)]; save();
    return { status: 200, ok: true };
  }
  function taakMaak(mij, { id, tekst }) {
    const p = L().projecten[String(id || '')];
    if (!p || !p.leden.includes(mij)) return { status: 404, error: 'Dit project bestaat niet (meer).' };
    tekst = schoon(tekst, 140);
    if (!tekst) return { status: 400, error: 'Wat moet er gebeuren?' };
    if (p.taken.length >= 40) return { status: 400, error: 'Veertig taken is echt genoeg; vink er eerst wat af.' };
    p.taken.push({ id: rid(3), tekst, wie: null, af: false }); save();
    return { status: 200, ok: true };
  }
  function taakZet(mij, { id, taakId, af, claim }) {
    const p = L().projecten[String(id || '')];
    if (!p || !p.leden.includes(mij)) return { status: 404, error: 'Dit project bestaat niet (meer).' };
    const t = p.taken.find(x => x.id === String(taakId || ''));
    if (!t) return { status: 404, error: 'Deze taak is er niet meer.' };
    if (claim === true) t.wie = codenaamVan(mij);
    if (claim === false) t.wie = null;
    if (af === true || af === false) t.af = af;
    save();
    p.leden.filter(sp => sp !== mij).forEach(sp => seintje(sp, 'project', p.id));
    return { status: 200, ok: true };
  }
  function notitie(mij, { id, tekst }) {
    const p = L().projecten[String(id || '')];
    if (!p || !p.leden.includes(mij)) return { status: 404, error: 'Dit project bestaat niet (meer).' };
    tekst = schoon(tekst, 500);
    if (!tekst) return { status: 400, error: 'Schrijf eerst iets op.' };
    p.notities.push({ id: rid(3), van: codenaamVan(mij), tekst, at: nu() });
    if (p.notities.length > 200) p.notities.shift();
    save();
    p.leden.filter(sp => sp !== mij).forEach(sp => seintje(sp, 'project', p.id));
    return { status: 200, ok: true };
  }
  // de AI stelt een projectplan voor als taken; zonder sleutel een net standaardplan
  const DEMO_PLANNEN = [
    { test: /spreekbeurt|presentatie/i, taken: ['Kies je onderwerp en schrijf op waarom je het koos', 'Zoek drie goede bronnen (boek, site, iemand die er veel van weet)', 'Maak een begin, een midden en een slot', 'Maak je poster of je dia-presentatie', 'Oefen hardop, ook op de tijd', 'Bedenk twee vragen voor je publiek'] },
    { test: /werkstuk|verslag/i, taken: ['Maak een hoofdstukindeling (inleiding, drie vragen, slot)', 'Zoek per hoofdstuk een bron en schrijf steekwoorden op', 'Schrijf de eerste versie zonder aan mooi te denken', 'Lees elkaars stukken en geef een tip en een top', 'Maak een voorkant en de bronnenlijst', 'Laat iemand anders de spelling controleren'] },
    { test: /knutsel|bouw|maak/i, taken: ['Teken eerst hoe het eruit moet zien', 'Maak een lijstje van alle spullen', 'Verdeel wie wat meeneemt', 'Bouw een proefversie en kijk wat beter kan', 'Maak de echte versie samen af', 'Ruim samen op en maak een foto van het resultaat'] }
  ];
  const DEMO_PLAN_ALGEMEEN = ['Schrijf samen op wat het doel is', 'Verdeel de eerste taken: wie doet wat', 'Spreek een moment af om elkaar bij te praten', 'Maak een eerste versie of proefopstelling', 'Vraag iemand om mee te kijken en verwerk de tips', 'Rond af en vier het samen'];
  async function projectAi(mij, { id, groep }) {
    const p = L().projecten[String(id || '')];
    if (!p || !p.leden.includes(mij)) return { status: 404, error: 'Dit project bestaat niet (meer).' };
    if (!sociaalRate(mij, 'leren-ai', 30, 3600000)) return { status: 429, error: 'Rustig aan; probeer het over een uurtje weer.' };
    let plan = null, demo = false;
    if (anthropic) {
      try {
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 600,
          system: 'Je helpt kinderen en gezinnen een project in behapbare taken te verdelen. Concreet, kort, doe-taal. ' + (leeftijdInstr ? leeftijdInstr(groep) : ''),
          messages: [{ role: 'user', content: 'Project: "' + p.titel + '". ' + (p.wat ? 'Omschrijving: ' + p.wat + '. ' : '') + 'Stel 5 tot 7 taken voor. Antwoord ALLEEN met een JSON-array van strings.' }] });
        const tekst = (r.content || []).map(b => b.text || '').join('');
        const m = tekst.match(/\[[\s\S]*\]/);
        if (m) plan = JSON.parse(m[0]).map(t => schoon(t, 140)).filter(Boolean).slice(0, 8);
      } catch (e) { /* val terug op het standaardplan */ }
    }
    if (!plan || !plan.length) { plan = (DEMO_PLANNEN.find(k => k.test.test(p.titel + ' ' + p.wat)) || { taken: DEMO_PLAN_ALGEMEEN }).taken; demo = true; }
    const bestaand = new Set(p.taken.map(t => norm(t.tekst)));
    let erbij = 0;
    for (const tekst of plan) {
      if (bestaand.has(norm(tekst)) || p.taken.length >= 40) continue;
      p.taken.push({ id: rid(3), tekst, wie: null, af: false }); erbij++;
    }
    save();
    p.leden.filter(sp => sp !== mij).forEach(sp => seintje(sp, 'project', p.id));
    return { status: 200, ok: true, erbij, demo };
  }

  /* ================= schrijven ================= */
  const OPDRACHTEN = {
    mini: ['Vertel samen met papa, mama of je verzorger een verhaaltje over jullie huisdier (of het huisdier dat je zou willen). De grote schrijft, jij verzint.',
      'Verzin samen een liedje over je lievelingseten en schrijf de woorden op.'],
    kind: ['Schrijf een verhaaltje over een dier dat een dag kan praten. Wat zegt het als eerste?',
      'Je vindt een deur in je school die er gisteren nog niet was. Schrijf op wat erachter zit.',
      'Schrijf een brief aan jezelf over tien jaar. Wat wil je later kunnen?',
      'Verzin een nieuw feest voor jouw familie en beschrijf hoe jullie het vieren.',
      'Schrijf een verhaaltje waarin je huisdier (of knuffel) een geheim heeft.',
      'Beschrijf je perfecte dag van wakker worden tot slapen gaan.'],
    tiener: ['Schrijf een kort verhaal dat begint met: "De telefoon ging precies om middernacht."',
      'Overtuig iemand in een brief van iets waar jij echt in gelooft.',
      'Beschrijf een plek waar jij helemaal jezelf bent, zo dat de lezer er ook wil zijn.',
      'Schrijf het verhaal van een dag uit het leven van je schoen.',
      'Interview (op papier) je held: bedenk vijf vragen en de antwoorden.',
      'Schrijf een recensie over de beste of slechtste film die je ooit zag.'],
    jong: ['Schrijf een motivatiebrief voor je droombaan, alsof je hem morgen verstuurt.',
      'Beschrijf het moment waarop je iets voor het eerst alleen deed.',
      'Schrijf een betoog: moet iedereen een jaar tussenjaar nemen? Kies een kant.',
      'Schrijf een brief aan je zestienjarige zelf.',
      'Beschrijf jouw ideale woonplek over vijf jaar, en wat ervoor nodig is.'],
    volw: ['Schrijf op wat je een jonger gezinslid over geld zou willen leren, in gewone taal.',
      'Beschrijf een familietraditie die je wilt doorgeven, en waarom.',
      'Schrijf een brief aan iemand die je lang niet gesproken hebt (versturen hoeft niet).',
      'Beschrijf de dag die je opnieuw zou willen beleven.']
  };
  function schrijfOpdracht(groep, anders) {
    const lijst = OPDRACHTEN[groep] || OPDRACHTEN.kind;
    const dag = Math.floor(Date.now() / 86400000);
    const i = anders ? crypto.randomInt(0, lijst.length) : dag % lijst.length;
    return { status: 200, opdracht: lijst[i] };
  }
  async function schrijfFeedback(mij, { tekst, opdracht, groep, buddy }) {
    tekst = String(tekst || '').slice(0, 6000);
    if (norm(tekst).length < 20) return { status: 400, error: 'Schrijf eerst een stukje; dan lees ik mee.' };
    if (!sociaalRate(mij, 'leren-ai', 30, 3600000)) return { status: 429, error: 'Rustig aan; probeer het over een uurtje weer.' };
    const NAAM = { vrouw: 'Amber', man: 'Fayaz', nonbinair: 'Robin' };
    const naam = NAAM[buddy] || 'Amber';
    if (anthropic) {
      try {
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 450,
          system: 'Je heet ' + naam + ' en bent een warme schrijfcoach. Geef eerst een oprecht compliment over iets specifieks, daarna hooguit twee concrete tips. Herschrijf NOOIT de tekst; de schrijver blijft de schrijver. ' + (leeftijdInstr ? leeftijdInstr(groep) : ''),
          messages: [{ role: 'user', content: (opdracht ? 'De opdracht was: ' + schoon(opdracht, 200) + '\n\n' : '') + 'Mijn tekst:\n' + tekst }] });
        const uit = (r.content || []).map(b => b.text || '').join('').trim();
        if (uit) return { status: 200, feedback: uit };
      } catch (e) { /* val terug op de demofeedback */ }
    }
    // demoterugval: een compliment plus eenvoudige, eerlijke tips uit de tekst zelf
    const zinnen = tekst.split(/[.!?]+/).map(z => z.trim()).filter(Boolean);
    const woorden = tekst.split(/\s+/).filter(Boolean);
    const tips = [];
    if (zinnen.some(z => z.split(/\s+/).length > 25)) tips.push('Een paar zinnen zijn heel lang; knip de langste eens in tweeen, dan leest het lekkerder.');
    if (/(^|[.!?]\s+)[a-z]/.test(tekst)) tips.push('Kijk nog even naar de hoofdletters aan het begin van je zinnen.');
    if ((tekst.match(/\ben\b/gi) || []).length > woorden.length / 12) tips.push('Je gebruikt vaak "en"; probeer eens een zin te beginnen met "daarna", "opeens" of "toen".');
    if (tips.length < 2) tips.push('Lees je tekst een keer hardop; waar je struikelt, kan een zin mooier.');
    return { status: 200, demo: true, feedback: 'Wat goed dat je ' + woorden.length + ' woorden hebt geschreven, en je ' +
      (zinnen.length > 4 ? 'bouwt je verhaal echt op in ' + zinnen.length + ' zinnen' : 'begin staat er al') + '. ' +
      'Twee dingen om naar te kijken: ' + tips.slice(0, 2).join(' ') + ' - ' + naam };
  }
  function schrijfBewaar(mij, { opdracht, tekst, feedback }) {
    tekst = String(tekst || '').slice(0, 6000);
    if (!tekst.trim()) return { status: 400, error: 'Er is nog niets om te bewaren.' };
    const s = L().schrijfsels;
    if (!s[mij]) s[mij] = [];
    s[mij].unshift({ id: rid(4), opdracht: schoon(opdracht, 200), tekst, feedback: String(feedback || '').slice(0, 1500), at: nu() });
    s[mij] = s[mij].slice(0, 20);
    save();
    return { status: 200, ok: true };
  }
  function schrijfselsVan(mij) { return { status: 200, schrijfsels: L().schrijfsels[mij] || [] }; }

  return { leren: { lijstenVan, lijstMaak, lijstHaal, lijstWeg, overhoorKlaar, lijstAi,
    sessieStart, sessieAntwoord, sessiesVan, sessieStaat, sessieZet,
    projectenVan, projectMaak, projectUitnodig, projectAntwoord, projectStaat, projectWeg, taakMaak, taakZet, notitie, projectAi,
    schrijfOpdracht, schrijfFeedback, schrijfBewaar, schrijfselsVan } };
};
