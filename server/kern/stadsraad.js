/* De Stadsraad (kern/stadsraad): in elke stad waar RTG aanwezig is, werkt de
   RTFoundation samen met EEN invloedrijke partner (een foundation, club of
   instelling). Die partner krijgt een eigen raadcode en daarmee toegang tot
   de gezamenlijke raadkamer in het foundation-kantoor, naast het RTG-
   personeel. Daar beslissen beide kanten SAMEN over de lab-uitslagen van het
   onderzoek: wat wordt gedeeld, waar komt vervolgonderzoek, wat rolt uit.

   Grenzen, bewust:
   - de raad ziet alleen uitslagen (bevindingen) van rtf- en samen-projecten;
     het besloten RTG-bedrijfswerk uit het lab blijft dicht (geheimhouding)
   - een besluit valt pas als BEIDE kanten gestemd hebben: minstens een
     RTG-stem en een partnerstem, en aan beide kanten meer voor dan tegen
   - de raad adviseert en besluit over uitslagen; geld en uitvoering lopen
     langs de bestaande poorten waar een mens tekent.
   Opslag: db.data.stadsraad. */
const SOORTEN = ['foundation', 'club', 'instelling'];
module.exports = ({ db, save, crypto }) => {
  const nu = () => new Date().toISOString();
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 120);
  const rid = () => crypto.randomBytes(4).toString('hex');
  const TEKENS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codeMaak = () => 'RAAD-' + Array.from(crypto.randomBytes(6)).map(b => TEKENS[b % TEKENS.length]).join('');
  const S = () => {
    if (!db.data.stadsraad) db.data.stadsraad = { partners: [], besluiten: [] };
    return db.data.stadsraad;
  };
  const vindCode = code => S().partners.find(p => p.code === String(code || '').trim().toUpperCase() && p.actief);
  const pubPartner = p => ({ id: p.id, stad: p.stad, naam: p.naam, soort: p.soort, actief: p.actief, at: p.at });

  /* ---- partners: EEN invloedrijke partner per stad ---- */
  function partnerMaak(b) {
    b = b || {};
    const stad = schoon(b.stad, 60), naam = schoon(b.naam, 80);
    if (stad.length < 2) return { status: 400, error: 'In welke stad?' };
    if (naam.length < 2) return { status: 400, error: 'Hoe heet de partner?' };
    if (S().partners.some(p => p.actief && p.stad.toLowerCase() === stad.toLowerCase()))
      return { status: 409, error: 'Deze stad heeft al een stadspartner; per stad is er precies een.' };
    if (S().partners.length >= 2000) return { status: 400, error: 'Het partnerregister zit vol.' };
    const p = { id: rid(), code: codeMaak(), stad, naam, soort: SOORTEN.includes(b.soort) ? b.soort : 'foundation',
      actief: true, at: nu() };
    S().partners.unshift(p);
    save();
    return { ok: true, partner: Object.assign({ code: p.code }, pubPartner(p)) };
  }
  function partnerStop(id) {
    const p = S().partners.find(x => x.id === String(id || ''));
    if (!p) return { status: 404, error: 'Deze partner staat niet in het register.' };
    p.actief = false;
    save();
    return { ok: true };
  }

  /* ---- de uitslagen die de raad mag zien: alleen rtf/samen met bevindingen ---- */
  function uitslagen() {
    const lab = Array.isArray(db.data.labProjecten) ? db.data.labProjecten : [];
    return lab.filter(p => (p.voorWie === 'rtf' || p.voorWie === 'samen') && (p.bevindingen || []).length)
      .slice(0, 60).map(p => ({ id: p.id, titel: p.titel, veld: p.veld, fase: p.fase, voorWie: p.voorWie,
        bevindingen: (p.bevindingen || []).slice(0, 10) }));
  }

  /* ---- besluiten over die uitslagen: beide kanten stemmen ---- */
  const pubBesluit = b => ({ id: b.id, projectId: b.projectId, titel: b.titel, voorstel: b.voorstel,
    door: b.door, status: b.status, uitslag: b.uitslag || null, stemmen: b.stemmen, at: b.at });
  function besluitStart(projectId, voorstel, door, kant) {
    const u = uitslagen().find(x => x.id === String(projectId || ''));
    if (!u) return { status: 404, error: 'Deze uitslag ligt niet op de raadstafel.' };
    const v = schoon(voorstel, 240);
    if (v.length < 5) return { status: 400, error: 'Wat stelt u voor met deze uitslag?' };
    if (S().besluiten.filter(b => b.status === 'open').length >= 40) return { status: 400, error: 'Sluit eerst open besluiten.' };
    const b = { id: rid(), projectId: u.id, titel: u.titel, voorstel: v,
      door: (kant === 'partner' ? 'partner: ' : 'RTG: ') + schoon(door, 60), stemmen: [], status: 'open', at: nu() };
    S().besluiten.unshift(b);
    if (S().besluiten.length > 300) S().besluiten.length = 300;
    save();
    return { ok: true, besluit: pubBesluit(b) };
  }
  // een stem per kant-en-naam; een partner stemt namens zijn stad
  function stem(besluitId, kant, wie, voor) {
    const b = S().besluiten.find(x => x.id === String(besluitId || ''));
    if (!b) return { status: 404, error: 'Dit besluit staat niet (meer) op tafel.' };
    if (b.status !== 'open') return { status: 409, error: 'Dit besluit is al gevallen.' };
    const k = kant === 'partner' ? 'partner' : 'rtg';
    const naam = schoon(wie, 60) || (k === 'partner' ? 'de partner' : 'RTG');
    if (b.stemmen.some(s => s.kant === k && s.wie === naam)) return { status: 409, error: 'Deze stem is al uitgebracht.' };
    b.stemmen.push({ kant: k, wie: naam, voor: voor === true, at: nu() });
    save();
    return { ok: true, besluit: pubBesluit(b) };
  }
  // het besluit valt pas als beide kanten gestemd hebben
  function besluitSluit(besluitId) {
    const b = S().besluiten.find(x => x.id === String(besluitId || ''));
    if (!b) return { status: 404, error: 'Dit besluit staat niet (meer) op tafel.' };
    if (b.status !== 'open') return { status: 409, error: 'Dit besluit is al gevallen.' };
    const kantTel = k => ({ voor: b.stemmen.filter(s => s.kant === k && s.voor).length,
      tegen: b.stemmen.filter(s => s.kant === k && !s.voor).length });
    const rtg = kantTel('rtg'), partner = kantTel('partner');
    if (!(rtg.voor + rtg.tegen) || !(partner.voor + partner.tegen))
      return { status: 409, error: 'Beide kanten stemmen eerst: RTG-personeel en de stadspartner beslissen samen.' };
    const aangenomen = rtg.voor > rtg.tegen && partner.voor > partner.tegen;
    b.status = aangenomen ? 'aangenomen' : 'afgewezen';
    b.uitslag = 'RTG ' + rtg.voor + '-' + rtg.tegen + ', partners ' + partner.voor + '-' + partner.tegen;
    save();
    return { ok: true, besluit: pubBesluit(b) };
  }

  /* ---- de raadkamer zoals een kant hem ziet ---- */
  function raad(kant) {
    const uit = { ok: true, uitslagen: uitslagen(),
      besluiten: S().besluiten.slice(0, 30).map(pubBesluit),
      steden: S().partners.filter(p => p.actief).map(pubPartner) };
    if (kant === 'rtg') uit.partners = S().partners.slice(0, 100).map(p => Object.assign({ code: p.code }, pubPartner(p)));
    return uit;
  }
  function portaal(code) {
    const p = vindCode(code);
    if (!p) return { status: 404, error: 'Deze raadcode kennen we niet. Vraag het RTF-kantoor om de code.' };
    return Object.assign(raad('partner'), { partner: pubPartner(p) });
  }

  return { stadsraad: { partnerMaak, partnerStop, raad, portaal, vindCode, besluitStart, stem, besluitSluit, SOORTEN } };
};
