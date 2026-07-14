/* De persoonlijke, interactieve AI-agenda. Elke leverancier en elk lid heeft er
   een, in de boardroom/backoffice. Je zet er zelf afspraken op, of je typt het in
   gewone taal ("vergadering morgen om 15u over de zomerkaart") en de AI zet het
   op de juiste datum en tijd. Een ballon (badge) op de voorkant telt wat er nog
   aankomt.

   De opslag is per eigenaar-sleutel: 'sup:<code>' voor een leverancier,
   'lid:<key>' voor een lid. maakAgenda(state) volgt het vaste kern-patroon. */

const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

function maakAgenda({ db, save, crypto, anthropic, schoon }) {
  const id = () => 'ag' + crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  const vandaagStr = () => new Date().toISOString().slice(0, 10);
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));

  function store() { if (!db.data.agendas || typeof db.data.agendas !== 'object') db.data.agendas = {}; return db.data.agendas; }
  function ruw(ownerKey) { const s = store(); if (!Array.isArray(s[ownerKey])) s[ownerKey] = []; return s[ownerKey]; }

  function itemPubliek(i) { return { id: i.id, titel: i.titel, datum: i.datum, tijd: i.tijd || null, notitie: i.notitie || null, gedaan: !!i.gedaan }; }
  function lijst(ownerKey) {
    return ruw(ownerKey).slice().sort((a, b) =>
      (a.gedaan - b.gedaan) || String(a.datum).localeCompare(String(b.datum)) || String(a.tijd || '').localeCompare(String(b.tijd || ''))
    ).map(itemPubliek);
  }
  // Voor de badge: hoeveel niet-afgeronde items er vandaag of later staan.
  function telling(ownerKey) {
    const t = vandaagStr();
    return ruw(ownerKey).filter(i => !i.gedaan && String(i.datum) >= t).length;
  }

  function geldigeDatum(d) { return /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')); }
  function geldigeTijd(t) { return /^\d{2}:\d{2}$/.test(String(t || '')); }

  function voegToe(ownerKey, data) {
    const titel = scho(data.titel, 120);
    if (!titel) return { error: 'Geef de afspraak een titel.' };
    if (!geldigeDatum(data.datum)) return { error: 'Kies een geldige datum.' };
    const arr = ruw(ownerKey);
    if (arr.length >= 2000) return { error: 'Uw agenda zit vol; ruim eerst wat op.' };
    const item = { id: id(), titel, datum: data.datum, tijd: geldigeTijd(data.tijd) ? data.tijd : null, notitie: scho(data.notitie, 300) || null, gedaan: false, at: nu() };
    arr.push(item);
    save();
    return { ok: true, item: itemPubliek(item) };
  }
  function wijzig(ownerKey, data) {
    const arr = ruw(ownerKey);
    const i = arr.find(x => x.id === data.id);
    if (!i) return { error: 'Afspraak niet gevonden.' };
    if (data.titel != null) i.titel = scho(data.titel, 120) || i.titel;
    if (geldigeDatum(data.datum)) i.datum = data.datum;
    if (data.tijd != null) i.tijd = geldigeTijd(data.tijd) ? data.tijd : null;
    if (data.notitie != null) i.notitie = scho(data.notitie, 300) || null;
    if (data.gedaan != null) i.gedaan = !!data.gedaan;
    save();
    return { ok: true };
  }
  function verwijder(ownerKey, itemId) {
    const s = store(); s[ownerKey] = ruw(ownerKey).filter(x => x.id !== itemId); save(); return { ok: true };
  }

  /* ---- de natuurlijke-taal-parser (werkt zonder Claude) ---- */
  function datumUit(q) {
    const t = new Date(); t.setHours(12, 0, 0, 0);
    const plus = n => { const d = new Date(t); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    if (/\bvandaag\b/.test(q)) return plus(0);
    if (/\bovermorgen\b/.test(q)) return plus(2);
    if (/\bmorgen\b/.test(q)) return plus(1);
    // weekdag -> eerstvolgende
    for (let d = 0; d < 7; d++) if (new RegExp('\\b' + DAGEN[d] + '\\b').test(q)) {
      let add = (d - t.getDay() + 7) % 7; if (add === 0) add = 7; return plus(add);
    }
    // DD-MM of DD/MM (dit jaar, of volgend jaar als het al voorbij is)
    const m = q.match(/\b(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?\b/);
    if (m) {
      const dag = +m[1], maand = +m[2];
      let jaar = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : t.getFullYear();
      if (dag >= 1 && dag <= 31 && maand >= 1 && maand <= 12) {
        let ds = jaar + '-' + String(maand).padStart(2, '0') + '-' + String(dag).padStart(2, '0');
        if (!m[3] && ds < t.toISOString().slice(0, 10)) ds = (jaar + 1) + '-' + String(maand).padStart(2, '0') + '-' + String(dag).padStart(2, '0');
        return ds;
      }
    }
    return null;
  }
  function tijdUit(q) {
    let m = q.match(/\bom\s+(\d{1,2})[:.u](\d{2})/) || q.match(/\b(\d{1,2}):(\d{2})\b/);
    if (m) return String(Math.min(23, +m[1])).padStart(2, '0') + ':' + m[2];
    m = q.match(/\bom\s+(\d{1,2})\s*(?:u|uur)\b/);
    if (m) return String(Math.min(23, +m[1])).padStart(2, '0') + ':00';
    return null;
  }
  function titelUit(q) {
    // haal het onderwerp: na "over"/"voor" is meestal de kern; anders de zin ontdaan
    // van datum-/tijdwoorden.
    let m = q.match(/\b(?:over|voor|met|:)\s+(.{2,80})$/i);
    let titel = m ? m[1] : q;
    titel = titel
      .replace(/\b(vandaag|morgen|overmorgen|zondag|maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag)\b/gi, '')
      .replace(/\bom\s+\d{1,2}([:.u]\d{2})?\s*(?:uur|u)?\b/gi, '')
      .replace(/\b\d{1,2}[:.]\d{2}\b/g, '')
      .replace(/\b\d{1,2}[-/]\d{1,2}([-/]\d{2,4})?\b/g, '')
      .replace(/\b(zet|plan|voeg|maak|herinner|me|aan|toe|een|de|het|afspraak|op|agenda|in)\b/gi, ' ')
      .replace(/\s+/g, ' ').trim();
    return titel || 'Afspraak';
  }

  async function aiVoegToe(ownerKey, opdracht, aiAan) {
    opdracht = scho(opdracht, 300);
    if (!opdracht) return { antwoord: 'Vertel welke afspraak ik moet inplannen.' };
    let titel = null, datum = null, tijd = null;
    if (aiAan && anthropic) {
      try {
        const sys = 'Je zet een afspraak om in JSON. Antwoord ALLEEN met een JSON-object {"titel":"...","datum":"YYYY-MM-DD","tijd":"HH:MM of null"}. Vandaag is ' + vandaagStr() + '. Reken relatieve dagen (morgen, volgende week) uit naar een datum.';
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 200, system: sys, messages: [{ role: 'user', content: opdracht }] });
        const tekst = (r && r.content && r.content[0] && r.content[0].text || '');
        const jm = tekst.match(/\{[\s\S]*\}/);
        if (jm) { const o = JSON.parse(jm[0]); titel = scho(o.titel, 120); if (geldigeDatum(o.datum)) datum = o.datum; if (geldigeTijd(o.tijd)) tijd = o.tijd; }
      } catch (e) { /* val terug op de parser */ }
    }
    const q = opdracht.toLowerCase();
    if (!datum) datum = datumUit(q);
    if (!tijd) tijd = tijdUit(q);
    if (!titel) titel = titelUit(opdracht);
    if (!datum) return { antwoord: 'Ik kon geen datum vinden. Probeer bijv. "vergadering morgen om 15u" of "levering 20-08".' };
    const r = voegToe(ownerKey, { titel, datum, tijd });
    if (r.error) return { antwoord: r.error };
    return { antwoord: 'Ingepland: ' + titel + ' op ' + datum + (tijd ? ' om ' + tijd : '') + '.', gedaan: true, item: r.item };
  }

  return { lijst, telling, voegToe, wijzig, verwijder, aiVoegToe };
}

module.exports = { maakAgenda };
