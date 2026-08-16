/* Supplier-submodule "ai": De AI-assistent van de zaak: vraagt en doet, met de
   coach-regels en de kennis van de eigen administratie. Afgesplitst uit
   routes/supplier.js; alleen de routes, de helpers komen via het kern-object
   binnen. De rijks-/gemeentebalie (ambtenaar via Rahul) is een eigen laag in
   ./ambtenaar; hier de acties (kamers, deuren, klussen), de vragen (omzet,
   status, berichten) en de vrije vraag via het AI-stuur. */
module.exports = (kern) => {
  // alleen wat deze AI-module echt gebruikt (de rest van de gedeelde kern hoort
  // hier niet thuis; opgeruimd om dode destructuring te vermijden)
  const { aiFindDoor, aiFindRoom, app, db, guestsFor, posDay, scheduleFor, supplierAuth, ordersVanZaak, commGast } = kern;
  const { fluisterZeg } = kern.fluister;
  const ambtenaar = require('./ambtenaar')(kern);

app.post('/api/supplier/ai', supplierAuth, async (req, res) => {
  const s = req.supplier;
  const q = String(req.body.q || '').trim().slice(0, 300);
  if (!q) return res.status(400).json({ error: 'Stel een vraag.' });
  const ql = q.toLowerCase();
  const A = (reply, did, extra) => res.json(Object.assign({ reply, did: !!did,
    aiBeschikbaar: !!(kern.anthropic && kern.anthropic.messages),
    modus: 'workflow' }, extra || {}));
  const isAmbt = !!((kern.overheid && kern.overheid.magBehandelen && kern.overheid.magBehandelen(s)) ||
    (kern.gemeente && kern.gemeente.magBehandelen && kern.gemeente.magBehandelen(s)));
  const wereld = isAmbt ? 'supplier' : (req.actor && req.actor.staffId != null ? 'staff' : 'supplier');
  const viaStuur = (pad, body, klaar) =>
    require('./stuur')(kern, req, wereld, A, pad, body, klaar);

  // het persoonlijke geheugen (dezelfde motor als Rahul van de leden):
  // onthouden, opvragen en wissen, per persoon binnen deze zaak
  if (fluisterZeg && (/^onthoud\b/i.test(q) || /vergeet alles/i.test(q) || /wat (weet|onthoud) je (over|van) mij/i.test(q) || /plan (mijn|onze|de) (service)?dag|dagplan|servicedag/i.test(q))) {
    const fKey = 'zaak:' + s.code + ':' + (req.actor && req.actor.staffId != null ? req.actor.staffId : 'eigenaar');
    const r = await fluisterZeg(fKey, (req.actor && req.actor.name) || s.name, q);
    if (!r.error) return A(r.antwoord, !!r.geleerd);
  }

  // ---- ambtenaar: de rijks-/gemeentebalie behandelt zaken via Rahul ----
  const amb = ambtenaar(s, q, req);
  if (amb && amb.actie) return viaStuur(amb.actie.pad, amb.actie.body, amb.reply);
  if (amb) return A(amb.reply, amb.did);

  // ---- acties ----
  // kamerstatus: "zet <kamer> op schoon/vuil/bezig/bezet" of "meld <kamer> defect: reden"
  const hkWord = { schoon:'schoon', clean:'schoon', vuil:'vuil', dirty:'vuil', bezig:'bezig', bezet:'bezet', occupied:'bezet', defect:'defect', kapot:'defect', stuk:'defect' };
  const hkHit = Object.keys(hkWord).find(w => ql.includes(w));
  const room = aiFindRoom(s, ql);
  if (room && hkHit && /\b(zet|meld|maak|markeer|set|mark|is)\b/.test(ql)) {
    const status = hkWord[hkHit];
    const note = (q.split(/[:,]/)[1] || '').trim().slice(0, 140);
    return viaStuur('/api/supplier/room/hk', { id: room.id, status,
      note: status === 'defect' ? (note || 'gemeld via AI') : '' }, status === 'defect'
      ? room.name + ' staat op defect: uit de verkoop en er staat een klus klaar voor onderhoud.'
      : room.name + ' wordt op "' + status + '" gezet.');
  }
  // deuren: "open de voordeur" / "vergrendel machiya 1"
  if (/\b(open|vergrendel|lock|sluit)\b/.test(ql) && (s.doors || []).length) {
    const door = aiFindDoor(s, ql);
    if (door) {
      const locked = /\b(vergrendel|lock|sluit)\b/.test(ql);
      return viaStuur('/api/supplier/door/zet', { id: door.id, locked }, locked
        ? door.name + ' wordt vergrendeld.'
        : door.name + ' wordt geopend en vergrendelt zichzelf daarna weer.');
    }
  }
  // klus melden: "meld klus: lamp kapot" / "nieuwe klus ..."
  const klusMatch = q.match(/(?:meld(?:\s+een)?\s+klus|nieuwe\s+klus|new\s+job)[:\s]+(.{3,})/i);
  if (klusMatch) {
    const text = klusMatch[1].trim().slice(0, 160);
    return viaStuur('/api/supplier/ticket/add', { text, room: room ? room.name : null },
      'De klus' + (room ? ' voor ' + room.name : '') + ' wordt genoteerd: "' + text + '".');
  }

  // ---- vragen ----
  if (/(omzet|dagtotaal|z.rapport|verdiend|revenue|kassa)/.test(ql)) {
    const p = posDay(s.code);
    const methods = Object.entries(p.byMethod).map(([m, v]) => m + ' € ' + v).join(', ');
    const open = Object.entries(p.openRooms || {}).map(([r, v]) => r + ' € ' + v.total).join(', ');
    return A('Vandaag ontvangen: € ' + p.total + ' over ' + p.count + ' bon(nen)' + (methods ? ' (' + methods + ')' : '') +
      (open ? '. Nog open op kamers: ' + open + '.' : '.'));
  }
  if (/(vuil|schoon|status|kamers?\b).*(kamer|room|status)|welke kamers/.test(ql) && (s.rooms || []).length) {
    const lines = s.rooms.map(r => r.name + ': ' + ((r.hk && r.hk.status) || 'schoon') + (r.available ? '' : ' (uit de verkoop)'));
    return A('Kamerstatus. ' + lines.join('. ') + '.');
  }
  if (/(klus|onderhoud|jobs?|tickets?)/.test(ql)) {
    const open = (db.data.tickets[s.code] || []).filter(t => t.status !== 'klaar');
    return A(open.length
      ? 'Er staan ' + open.length + ' klus(sen) open: ' + open.map(t => t.text + (t.room ? ' (' + t.room + ')' : '') + (t.status === 'bezig' ? ', wordt opgepakt' : '')).join('; ') + '.'
      : 'Er zijn geen openstaande klussen.');
  }
  if (/(onderweg|gast(en)?\b|eta|guests?)/.test(ql)) {
    const g = guestsFor(s.code);
    return A(g.length
      ? g.map(x => x.codename + (x.arrived ? ' is gearriveerd' : x.etaMin != null ? ' arriveert over ~' + x.etaMin + ' min' : ' is onderweg')).join('. ') + '.'
      : 'Er is nu geen gast live onderweg naar u.');
  }
  if (/(bericht|chat|onbeantwoord|messages?)/.test(ql)) {
    // sinds de verhuizing uit de communicatiekern (kern/comm/gast.js)
    const chats = (commGast ? commGast.voorZaak(s.code) : []).filter(c => c.unread > 0);
    return A(chats.length
      ? 'U heeft ' + chats.reduce((n, c) => n + c.unread, 0) + ' onbeantwoord(e) bericht(en): ' + chats.map(c => c.codename + ' (' + c.dept + '): "' + String(c.last).slice(0, 40) + '"').join('; ') + '.'
      : 'Alle gastberichten zijn beantwoord.');
  }
  if (/(minibar)/.test(ql) && Array.isArray(s.minibar)) {
    const today = new Date().toISOString().slice(0, 10);
    const counted = [...new Set((db.data.minibarCounts[s.code] || []).filter(e => e.at.slice(0, 10) === today).map(e => e.room))];
    const todo = (s.rooms || []).map(r => r.name).filter(n => !counted.includes(n));
    return A(todo.length ? 'Nog te tellen: ' + todo.join(', ') + '.' : 'Alle minibars zijn vandaag geteld.');
  }
  if (/(bestelling|orders?|bon(nen)?\b)/.test(ql)) {
    const open = ordersVanZaak(s.code).filter(o => !['geserveerd', 'geweigerd', 'terugbetaald', 'bezorgd', 'opgehaald'].includes(o.status));
    return A(open.length
      ? open.length + ' open bestelling(en): ' + open.map(o => o.customerCodename + ' € ' + o.total + ' (' + o.status + ', code ' + o.pickup + ')').join('; ') + '.'
      : 'Er zijn geen open bestellingen.');
  }
  if (/(rooster|dienst|schedule|shift)/.test(ql)) {
    const wk = scheduleFor(s.code);
    const today = wk.days[0];
    return A('Vandaag: ' + today.staff.map(x => x.name + ' ' + x.shift).join('; ') + '. Het volledige rooster staat in de personeels-app.');
  }

  // vrije vraag: Rahul aan het stuur; hij beantwoordt niet alleen, hij DOET
  // (alles wat de zaak zelf kan, met de eigen inlog en de geld-drempel)
  if (kern.stuurLus) {
    const p = posDay(s.code);
    const ctx = 'Bedrijf: ' + s.name + ' (' + s.type + ', ' + s.city + '). Vandaag ontvangen: € ' + p.total + '. ' +
      'Kamers: ' + (s.rooms || []).map(r => r.name + '=' + ((r.hk && r.hk.status) || 'schoon')).join(', ') + '. ' +
      'Open klussen: ' + (db.data.tickets[s.code] || []).filter(t => t.status !== 'klaar').length + '.';
    const lus = await kern.stuurLus(req, {
      vraag: q,
      wereld,
      filter: pd => wereld === 'staff' ? pd.startsWith('/api/staff') || pd.startsWith('/api/supplier')
        : pd.startsWith('/api/supplier') || pd.startsWith('/api/overheid') || pd.startsWith('/api/gemeente'),
      systeem: require('../../../kern/rahul').RAHUL_LEAD +
        'Je bent de AI-assistent van een RTG-partner (ingelogd: ' + ((req.actor && req.actor.name) || 'Beheer') + '). Context: ' + ctx
    });
    if (lus && lus.tekst) return A(lus.tekst, lus.acties.some(a => a.status < 400), {
      stuur: lus.acties,
      goedkeuringen: lus.acties.filter(a => a.goedkeuring).map(a => a.goedkeuring),
      goedkeuringWereld: wereld
    });
  }
  return A('Dat begrijp ik nog niet helemaal. U kunt mij bijvoorbeeld vragen: "dagomzet", "welke kamers zijn vuil", "zet Riverside suite op schoon", "meld Garden kamer defect: douche lekt", "open de voordeur", "meld klus: lamp vervangen", "wie is er onderweg", "onbeantwoorde berichten", "welke minibars nog tellen" of "open bestellingen".');
});

};
