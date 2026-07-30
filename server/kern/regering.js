/* Het REGERINGSKANTOOR: het bureau van de minister-president. Niet nog een
   dashboard, maar de plek waar alles wat het land raakt samenkomt op één
   bord -- en waar een besluit pas een besluit is als een tweede bewindspersoon
   heeft meegetekend.

   Wat er samenkomt (allemaal uit de lagen die er al zijn, niets dubbel):
   economie en regels (de Regelwacht + de landtabel), geld (de bank), de
   veiligheidsketen (het gezamenlijke rampbeeld), defensie, de opvang
   (AZC/COA), de steden, het OV en de bevolking. Elk onderdeel blijft van
   zijn eigen afdeling; dit kantoor kijkt mee en beslist.

   Vier ogen op elk besluit: de MP tekent, een tweede bewindspersoon
   ondertekent mee. Zonder tweede handtekening blijft het een voornemen. */
module.exports = ({ db, save, crypto, LANDEN, regelwacht, bank, opvang, afdelingen, ledenAantal }) => {
  const nu = () => new Date().toISOString();
  const d = () => db.data;
  const besluiten = () => { if (!Array.isArray(d().regeringBesluiten)) d().regeringBesluiten = []; return d().regeringBesluiten; };

  const PORTEFEUILLES = {
    economie: 'Economische Zaken & Financiën', veiligheid: 'Justitie & Veiligheid',
    defensie: 'Defensie', opvang: 'Asiel & Migratie', wonen: 'Volkshuisvesting',
    zorg: 'Volksgezondheid', onderwijs: 'Onderwijs', infra: 'Infrastructuur & Mobiliteit',
    buitenland: 'Buitenlandse Zaken', klimaat: 'Klimaat & Energie'
  };
  const schoonTekst = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n);

  const tel = (arr) => (Array.isArray(arr) ? arr.length : 0);

  /* Het landelijke beeld: elke poot vertelt zijn eigen stand, met een
     eerlijk 'niet ingericht' als een laag nog leeg is. */
  function situatie() {
    const uit = { ok: true, at: nu(), portefeuilles: PORTEFEUILLES };

    // bevolking en deelname
    uit.bevolking = { leden: typeof ledenAantal === 'function' ? ledenAantal() : 0,
      zaken: tel(d().suppliers), steden: [...new Set((d().suppliers || []).map(s => s.city).filter(Boolean))].length };

    // economie en regels: waar rekent het hele land mee?
    const rw = regelwacht ? regelwacht.status() : null;
    uit.economie = rw ? { peiljaar: rw.peiljaar, landen: rw.totaal, bijgewerkt: (rw.landenMetUpdates || []).length,
      laatsteCheck: rw.laatsteCheck, uitslag: rw.checkUitslag,
      eigenLand: (rw.landen || []).find(l => l.code === 'NL') || null } : null;

    // geld: de gezondheid van het eigen stelsel
    try { const g = bank ? bank.gezondheid() : null;
      uit.geld = g ? { depositoCenten: g.depositoCenten, kredietCenten: g.kredietCenten,
        inOmloopCenten: g.inOmloopCenten, rekeningen: g.aantalRekeningen, sluit: g.sluit.klopt } : null;
    } catch (e) { uit.geld = null; }

    // veiligheid: het gezamenlijke rampbeeld (als er is opgeschaald)
    const ramp = (d().rampbeeld && d().rampbeeld.actief) ? d().rampbeeld : null;
    uit.veiligheid = { opgeschaald: !!ramp, niveau: ramp ? ramp.niveau : 0,
      beeld: ramp ? (ramp.omschrijving || null) : null,
      meldingen: tel(d().meldingen), korpsen: [...new Set((d().suppliers || []).filter(s => s.korps).map(s => s.korps))].length };

    // defensie: paraatheid zonder ooit wapensystemen
    uit.defensie = { eenheden: tel(d().defEenheden), oefeningen: tel(d().defOefeningen),
      opmerking: 'RTG Defensie draait op logistiek, paraatheid, onderhoud, oefeningen en zorg -- nooit op wapensystemen.' };

    // opvang: de AZC-/COA-keten
    try { const b = opvang ? opvang.bord() : null;
      uit.opvang = b ? { capaciteit: b.totaal.capaciteit, bezet: b.totaal.bezet, vrij: b.totaal.vrij,
        bezettingPct: b.totaal.bezettingPct, wachtOpWoning: b.wachtOpWoning, seinen: b.seinen } : null;
    } catch (e) { uit.opvang = null; }

    // steden en mobiliteit
    uit.stad = { dozen: Object.keys(d().stadDozen || {}).length, scenario: (d().stadRegie && d().stadRegie.scenario) || null };
    uit.mobiliteit = { vervoerders: (d().suppliers || []).filter(s => db.capsVan(s).includes('rides')).length,
      ovLijnen: (d().suppliers || []).reduce((s2, s) => s2 + tel(s.ovLijnen), 0) };

    uit.aandacht = aandachtspunten(uit);
    return uit;
  }

  /* Wat zou een minister-president vandaag als eerste willen weten? */
  function aandachtspunten(s) {
    const uit = [];
    if (s.veiligheid.opgeschaald) uit.push({ portefeuille: 'veiligheid', urgent: true,
      tekst: 'De veiligheidsketen staat opgeschaald op niveau ' + s.veiligheid.niveau + '. Vraag de meldkamer om het actuele beeld voor u iets anders doet.' });
    if (s.opvang && s.opvang.bezettingPct >= 90) uit.push({ portefeuille: 'opvang', urgent: true,
      tekst: 'De opvang zit op ' + s.opvang.bezettingPct + '%. Zonder extra plekken of snellere doorstroom loopt dit binnen weken vast.' });
    if (s.opvang && s.opvang.wachtOpWoning > 0) uit.push({ portefeuille: 'wonen', urgent: false,
      tekst: s.opvang.wachtOpWoning + ' dossier(s) met een status wachten op een woning; dat is tegelijk de goedkoopste manier om opvangplekken vrij te maken.' });
    if (s.geld && s.geld.sluit === false) uit.push({ portefeuille: 'economie', urgent: true,
      tekst: 'Het bankgrootboek sluit niet. Laat Techniek dit vóór alles uitzoeken; geldstelsel gaat voor beleid.' });
    if (s.economie && s.economie.uitslag && /niet bereikbaar/.test(s.economie.uitslag)) uit.push({ portefeuille: 'economie', urgent: false,
      tekst: 'De Regelwacht kon de externe bron niet bereiken; de huidige regels blijven gelden, maar controleer de koppeling.' });
    if (!uit.length) uit.push({ portefeuille: 'economie', urgent: false,
      tekst: 'Geen acute signalen. Een goed moment voor de lange lijn: onderwijs, wonen en de begroting van volgend jaar.' });
    return uit;
  }

  /* ---------- kabinetsbesluiten met vier ogen ---------- */
  function besluitMaak(door, data) {
    data = data || {};
    const titel = schoonTekst(data.titel, 120);
    if (!titel) return { status: 400, error: 'Geef het besluit een titel.' };
    if (!PORTEFEUILLES[data.portefeuille]) return { status: 400, error: 'Kies een bestaande portefeuille.' };
    const b = {
      id: 'KB-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      titel, portefeuille: data.portefeuille, portefeuilleNaam: PORTEFEUILLES[data.portefeuille],
      toelichting: schoonTekst(data.toelichting, 800),
      door: schoonTekst(door, 60) || 'minister-president',
      status: 'voorgenomen', medeondertekend: null, at: nu()
    };
    besluiten().unshift(b);
    if (besluiten().length > 5000) besluiten().length = 5000;
    save();
    return { ok: true, besluit: b, opmerking: 'Voorgenomen besluit. Het wordt pas een besluit als een tweede bewindspersoon meetekent.' };
  }

  function besluitTeken(door, id) {
    const b = besluiten().find(x => x.id === String(id || ''));
    if (!b) return { status: 404, error: 'Dat besluit bestaat niet.' };
    if (b.status !== 'voorgenomen') return { status: 409, error: 'Dit besluit is al afgerond.' };
    const wie = schoonTekst(door, 60);
    if (!wie) return { status: 400, error: 'Wie tekent mee?' };
    if (wie.toLowerCase() === String(b.door).toLowerCase())
      return { status: 403, error: 'Vier ogen: wie het besluit neemt, tekent het niet zelf mee.' };
    b.status = 'genomen'; b.medeondertekend = wie; b.getekendAt = nu();
    save();
    return { ok: true, besluit: b };
  }

  function besluitLijst(f) {
    f = f || {};
    let lijst = besluiten();
    if (PORTEFEUILLES[f.portefeuille]) lijst = lijst.filter(b => b.portefeuille === f.portefeuille);
    if (f.status) lijst = lijst.filter(b => b.status === f.status);
    return { ok: true, besluiten: lijst.slice(0, 100), portefeuilles: PORTEFEUILLES,
      open: besluiten().filter(b => b.status === 'voorgenomen').length };
  }

  /* De ochtendbriefing: het beeld in zinnen, in de volgorde die telt. */
  function briefing() {
    const s = situatie();
    const regels = [
      'Bevolking en economie: ' + s.bevolking.leden + ' leden, ' + s.bevolking.zaken + ' zaken in ' + s.bevolking.steden + ' steden.' +
        (s.economie ? ' De Regelwacht houdt ' + s.economie.landen + ' landen bij op peiljaar ' + s.economie.peiljaar + '.' : ''),
      s.veiligheid.opgeschaald ? 'Veiligheid: OPGESCHAALD op niveau ' + s.veiligheid.niveau + '.' : 'Veiligheid: geen opschaling; de keten staat op normaal.',
      s.opvang ? 'Opvang: ' + s.opvang.bezet + ' van ' + s.opvang.capaciteit + ' plekken bezet (' + s.opvang.bezettingPct + '%), ' + s.opvang.wachtOpWoning + ' dossiers wachten op een woning.' : 'Opvang: nog geen locaties ingericht.',
      s.geld ? 'Geld: het grootboek ' + (s.geld.sluit ? 'sluit' : 'SLUIT NIET') + '; ' + s.geld.rekeningen + ' rekeningen.' : 'Geld: de bank staat nog niet live.',
      'Mobiliteit: ' + s.mobiliteit.vervoerders + ' vervoerders, ' + s.mobiliteit.ovLijnen + ' OV-lijnen.'
    ];
    return { ok: true, at: s.at, regels, aandacht: s.aandacht,
      slot: 'Dit bord vat samen; het besluit blijft mensenwerk, en elk besluit vraagt een tweede handtekening.' };
  }

  return { regering: { PORTEFEUILLES, situatie, briefing, besluitMaak, besluitTeken, besluitLijst } };
};
