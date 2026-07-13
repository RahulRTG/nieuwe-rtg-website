/* De werk-laag: vacatures, de sollicitatiechat tussen werkgever en sollicitant,
   en de automatische berichtvertaling van chats. VAC_SOORTEN is pure data; de
   rekenende functies dragen db + i18n + de leverancier-/realtime-helpers en
   komen uit maakWerk(state).

   Privacy: wie via de RTFoundation solliciteert, is voor de werkgever niet als
   zodanig herkenbaar (werkgeverSollicitatie verwijdert de interne velden). */

const VAC_SOORTEN = ['bijbaan', 'fulltime', 'parttime', 'stage', 'vrijwilliger', 'vakantiewerk'];

function maakWerk({ db, save, i18n, mail, LANDEN, findSupplier, sseToSupplier, sseToCustomer, notifySupplier, notify }) {
  /* Chatvertaling: iedereen schrijft in de eigen taal, de ontvanger leest het in
     de zijne. Vertalingen worden per bericht gecachet. */
  async function trChat(messages, to) {
    const out = [];
    for (const m of messages) {
      const from = m.lang || 'nl';
      if (from === to || !m.text) { out.push({ ...m, orig: null }); continue; }
      m.tr = m.tr || {};
      if (!m.tr[to]) {
        try {
          const r = await i18n.translate(m.text, to, from);
          m.tr[to] = (r && typeof r === 'object') ? (r.text || m.text) : String(r || m.text);
          save();
        } catch (e) { m.tr[to] = m.text; }
      }
      out.push({ ...m, text: m.tr[to], orig: m.text, tr: undefined });
    }
    return out;
  }

  function chatApplicant(a) {
    if (a.viaRTF && a.rtf) return { kind: 'rtf', gezinCode: a.rtf.code, profielId: a.rtf.profielId, naam: a.name };
    if (a.key) return { kind: 'rtg', key: a.key, naam: a.name };
    return null; // anoniem: geen in-app chat
  }
  function ensureApplyChat(supplierCode, a) {
    if (db.data.applyChats[a.id]) return db.data.applyChats[a.id];
    const applicant = chatApplicant(a);
    if (!applicant) return null;
    const s = findSupplier(supplierCode);
    const chat = { id: a.id, supplierCode, func: a.func, bedrijf: s ? s.name : supplierCode, applicant, berichten: [], at: new Date().toISOString() };
    db.data.applyChats[a.id] = chat;
    return chat;
  }
  function applyChatPubliek(chat) {
    return { id: chat.id, func: chat.func, bedrijf: chat.bedrijf, metWie: chat.applicant.naam,
      berichten: (chat.berichten || []).map(m => ({ van: m.van, wie: m.wie, tekst: m.tekst, at: m.at })) };
  }
  // stuur een chatbericht; 'van' is 'werkgever' of 'sollicitant'
  function chatStuur(chat, van, wie, tekst) {
    const t = String(tekst || '').trim().slice(0, 1000);
    if (!t) return null;
    const bericht = { van, wie: String(wie || '').slice(0, 60), tekst: t, at: new Date().toISOString() };
    chat.berichten.push(bericht);
    chat.berichten = chat.berichten.slice(-200);
    save();
    // live seintje naar de andere kant
    sseToSupplier(chat.supplierCode, 'sync', { scope: 'team' });
    if (chat.applicant.kind === 'rtg' && chat.applicant.key) sseToCustomer(chat.applicant.key, 'sync', { scope: 'apply' });
    return bericht;
  }
  // een bericht van de sollicitant laat de werkgever meteen iets weten
  function meldWerkgever(chat, tekst) {
    notifySupplier(chat.supplierCode, { icon: '💬', title: 'Bericht van ' + chat.applicant.naam, body: String(tekst).slice(0, 80) });
  }

  /* Openbare lijst met alle openstaande vacatures over alle partners heen. De
     RTF-app filtert op de leeftijdsgroep van het profiel (vanaf 16 jaar). */
  function openVacatures(minLeeftijd, land) {
    const uit = [];
    for (const [code, list] of Object.entries(db.data.vacatures || {})) {
      const s = findSupplier(code);
      if (!s) continue;
      const t = db.data.supplierTypes[s.type] || {};
      const landCode = (s.settings && LANDEN[s.settings.land]) ? s.settings.land : 'NL';
      if (land && landCode !== land) continue;
      for (const v of list) {
        if (!v.open) continue;
        if (minLeeftijd != null && v.minLeeftijd > minLeeftijd) continue;
        uit.push({
          id: v.id, supplierCode: code, bedrijf: s.name, soort: v.soort,
          type: s.type || null, typeLabel: t.label || null, icon: t.icon || '🏢',
          func: v.func, omschrijving: v.omschrijving, plaats: v.plaats, uren: v.uren,
          minLeeftijd: v.minLeeftijd, at: v.at,
          // land van het bedrijf: RTG is internationaal, dus je solliciteert ook
          // gerust in het buitenland
          land: landCode, landNaam: LANDEN[landCode].naam,
          // locatie van het bedrijf, zodat de app de afstand kan tonen
          loc: s.loc ? { lat: s.loc.lat, lng: s.loc.lng, label: s.loc.label } : null,
          stad: s.city || null
        });
      }
    }
    uit.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    return uit;
  }

  /* Wat de werkgever van een sollicitatie te zien krijgt. Wie via de RTFoundation
     solliciteert, verschijnt bij het bedrijf precies als een gewoon RTG-lid; de
     herkomst (viaRTF), de sessiesleutel en de gezinsverwijzing blijven intern. */
  function werkgeverSollicitatie(a) {
    if (!a) return a;
    const { viaRTF, key, rtf, ...rest } = a;
    if (viaRTF) rest.viaRTG = true; // RTF-sollicitant lijkt op een gewoon RTG-lid
    return rest;
  }

  // Solliciteerde een RTG-lid, dan hoort het lid direct van het besluit:
  // live in de app en (bij demo-profielen) als notificatie met push.
  function notifyApplicant(a, supplier) {
    const hired = a.status === 'aangenomen';
    // e-mail werkt voor iedereen met een e-mailadres als contact, ook zonder RTG-account
    if (/@/.test(a.contact || '')) {
      mail.send(a.contact, hired ? 'U bent aangenomen bij ' + supplier.name : 'Uw sollicitatie bij ' + supplier.name,
        'Beste ' + a.name + ',\n\n' + supplier.name + ' heeft uw sollicitatie als ' + a.func +
        (hired ? ' geaccepteerd. Het bedrijf neemt contact met u op over uw eerste werkdag.' : ' helaas afgewezen.') +
        '\n\nRahul Travel Group');
    }
    if (!a.key) return;
    if (db.data.notifications[a.key]) {
      notify(a.key, {
        icon: hired ? '🎉' : '📝',
        title: hired ? 'U bent aangenomen!' : 'Sollicitatie afgerond',
        body: supplier.name + ' heeft uw sollicitatie als ' + a.func + (hired ? ' geaccepteerd. Het bedrijf neemt contact met u op.' : ' helaas afgewezen.')
      });
    }
    sseToCustomer(a.key, 'sync', { scope: 'apply' });
  }

  return { trChat, chatApplicant, ensureApplyChat, applyChatPubliek, chatStuur, meldWerkgever, openVacatures, werkgeverSollicitatie, notifyApplicant };
}

module.exports = { VAC_SOORTEN, maakWerk };
