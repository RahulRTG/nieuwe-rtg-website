/* De documentenuitgifte (kern/uitgifte.js): met EEN druk op de knop de
   officiele documentatie overschrijven naar oude apparatuur of een harde
   schijf -- maar nooit alleen. Elke uitgifte staat achter het vier- of
   zes-ogenprincipe (keuze van de aanvrager): 4 ogen = twee verschillende
   personen tekenen, 6 ogen = drie. De aanvrager is de eerste handtekening;
   dezelfde ogen tellen nooit dubbel.

   Drie huizen gebruiken dezelfde motor:
     zaak    elke leverancier/partner (facturen, kassabonnen)
     office  het RTG-kantoor (partnerregister, alle facturen van het platform)
     rijk    de overheid (belastingaanslagen, bezwaren)

   De keten is een kant op: wacht-op-ogen -> vrijgegeven -> overgeschreven.
   De bundel (het tekstblad dat naar de schijf gaat) komt maar EEN keer vrij;
   daarna is de uitgifte verbruikt en start je een nieuwe. Alles op codenaam
   waar het om klanten gaat; elke handtekening staat op naam van de
   medewerker. Vast patroon: maakUitgifte(state) -> { uitgifte: api }. */

const BRONNEN = {
  zaak: {
    facturen: 'Alle facturen van de zaak',
    kassabonnen: 'Alle kassabonnen van de zaak'
  },
  office: {
    partnerregister: 'Het partnerregister van het platform',
    facturen: 'Alle facturen van het platform'
  },
  rijk: {
    aanslagen: 'Alle belastingaanslagen',
    bezwaren: 'Alle bezwaren'
  }
};

function maakUitgifte({ db, save, crypto }) {
  const nu = () => new Date().toISOString();
  const id = () => 'ug' + crypto.randomBytes(4).toString('hex');
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 120);

  function U() {
    if (!Array.isArray(db.data.uitgiften)) db.data.uitgiften = [];
    return db.data.uitgiften;
  }
  const vind = (domein, eigenaar, uid) => U().find(u => u.id === String(uid || '') && u.domein === domein && u.eigenaar === eigenaar);
  const nodig = u => u.ogen / 2;

  function publiek(u) {
    return { id: u.id, code: u.code, domein: u.domein, bron: u.bron, bronLabel: (BRONNEN[u.domein] || {})[u.bron] || u.bron,
      ogen: u.ogen, doel: u.doel, status: u.status,
      handtekeningen: u.handtekeningen.map(h => ({ door: h.door, at: h.at })),
      nogNodig: u.status === 'wacht-op-ogen' ? nodig(u) - u.handtekeningen.length : 0,
      at: u.at, overgeschrevenAt: u.overgeschrevenAt || null };
  }

  /* ---- de knop: een uitgifte starten (de aanvrager is de eerste ogen) ---- */
  function start(domein, eigenaar, actor, data) {
    data = data || {};
    if (!BRONNEN[domein]) return { status: 400, error: 'Onbekend domein.' };
    const bron = String(data.bron || '');
    if (!BRONNEN[domein][bron]) return { status: 400, error: 'Kies een bron: ' + Object.keys(BRONNEN[domein]).join(', ') + '.' };
    const ogen = Number(data.ogen) === 6 ? 6 : Number(data.ogen) === 4 ? 4 : null;
    if (!ogen) return { status: 400, error: 'Kies het vier- of zes-ogenprincipe (4 of 6).' };
    const wie = schoon(actor, 60);
    if (wie.length < 2) return { status: 400, error: 'De aanvraag staat altijd op naam.' };
    const u = { id: id(), code: 'UG-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      domein, eigenaar, bron, ogen, doel: schoon(data.doel, 80) || 'harde schijf',
      handtekeningen: [{ door: wie, at: nu() }], status: 'wacht-op-ogen', at: nu(), overgeschrevenAt: null };
    U().unshift(u);
    db.data.uitgiften = U().slice(0, 10000);
    save();
    return { ok: true, uitgifte: publiek(u) };
  }

  /* ---- meetekenen: andere ogen, nooit dezelfde twee keer ---- */
  function teken(domein, eigenaar, uid, actor) {
    const u = vind(domein, eigenaar, uid);
    if (!u) return { status: 404, error: 'Uitgifte niet gevonden.' };
    if (u.status !== 'wacht-op-ogen') return { status: 409, error: 'Deze uitgifte is al ' + u.status + '.' };
    const wie = schoon(actor, 60);
    if (wie.length < 2) return { status: 400, error: 'Een handtekening staat altijd op naam.' };
    if (u.handtekeningen.some(h => h.door.toLowerCase() === wie.toLowerCase()))
      return { status: 409, error: 'Dezelfde ogen tellen niet dubbel; een ANDERE collega moet meetekenen.' };
    u.handtekeningen.push({ door: wie, at: nu() });
    if (u.handtekeningen.length >= nodig(u)) u.status = 'vrijgegeven';
    save();
    return { ok: true, uitgifte: publiek(u) };
  }

  function lijst(domein, eigenaar) {
    return { ok: true, bronnen: Object.entries(BRONNEN[domein] || {}).map(([k, v]) => ({ id: k, label: v })),
      uitgiften: U().filter(u => u.domein === domein && u.eigenaar === eigenaar).slice(0, 30).map(publiek) };
  }

  /* ---- de bron-bladen: wat er daadwerkelijk naar de schijf gaat ---- */
  function regelsVoor(u) {
    const d = db.data;
    if (u.domein === 'zaak' && u.bron === 'facturen')
      return (d.facturen || []).filter(f => f.verkoper && f.verkoper.code === u.eigenaar).slice(0, 5000)
        .map(f => [f.nummer || f.id, f.datum, (f.koper && f.koper.naam) || '-', 'EUR ' + (f.totaal || 0), 'btw EUR ' + (f.btwBedrag || 0)].join(' | '));
    if (u.domein === 'zaak' && u.bron === 'kassabonnen')
      return ((d.posSales || {})[u.eigenaar] || []).slice(0, 5000)
        .map(s => [s.bon, s.at, s.desc || (s.items ? s.items.map(i => i.qty + 'x ' + i.name).join(', ') : '-'), 'EUR ' + s.total, s.method].join(' | '));
    if (u.domein === 'office' && u.bron === 'partnerregister')
      return (d.suppliers || []).slice(0, 5000).map(s => [s.code, s.name, s.type, s.city || '-'].join(' | '));
    if (u.domein === 'office' && u.bron === 'facturen')
      return (d.facturen || []).slice(0, 5000).map(f => [f.nummer || f.id, f.datum, (f.verkoper && f.verkoper.naam) || '-', 'EUR ' + (f.totaal || 0)].join(' | '));
    if (u.domein === 'rijk' && u.bron === 'aanslagen')
      return (d.rijkAanslagen || []).slice(0, 5000).map(a => [a.ref, a.codenaam, a.jaar, 'inkomen EUR ' + a.inkomen, 'saldo EUR ' + a.saldo, a.betaald ? 'betaald' : a.kwijtgescholden ? 'kwijtgescholden' : 'open'].join(' | '));
    if (u.domein === 'rijk' && u.bron === 'bezwaren')
      return (d.rijkBezwaren || []).slice(0, 5000).map(b => [b.ref, b.codenaam, b.tegen, b.status].join(' | '));
    return [];
  }

  /* ---- de overdracht: EEN keer, daarna is de uitgifte verbruikt ---- */
  function bundel(domein, eigenaar, uid, actor) {
    const u = vind(domein, eigenaar, uid);
    if (!u) return { status: 404, error: 'Uitgifte niet gevonden.' };
    if (u.status === 'wacht-op-ogen') return { status: 409, error: 'Nog niet vrijgegeven: er ontbreken ' + (nodig(u) - u.handtekeningen.length) + ' handtekening(en) (' + u.ogen + '-ogen).' };
    if (u.status === 'overgeschreven') return { status: 409, error: 'Deze uitgifte is al overgeschreven op ' + u.overgeschrevenAt + '; start een nieuwe uitgifte.' };
    const regels = regelsVoor(u);
    const kop = ['=== OFFICIELE UITGIFTE ' + u.code + ' ===',
      'Bron: ' + ((BRONNEN[u.domein] || {})[u.bron] || u.bron),
      'Doel: ' + u.doel + ' (' + u.ogen + '-ogenprincipe)',
      'Getekend door: ' + u.handtekeningen.map(h => h.door).join(', '),
      'Overgeschreven: ' + nu() + ' door ' + (schoon(actor, 60) || u.handtekeningen[0].door),
      'Regels: ' + regels.length, ''];
    u.status = 'overgeschreven';
    u.overgeschrevenAt = nu();
    save();
    return { ok: true, bestandsnaam: 'rtg-uitgifte-' + u.code.toLowerCase() + '.txt',
      blad: kop.concat(regels.length ? regels : ['(geen regels in deze bron)']).join('\n') };
  }

  return { uitgifte: { start, teken, lijst, bundel, UITGIFTE_BRONNEN: BRONNEN } };
}

module.exports = { maakUitgifte };
