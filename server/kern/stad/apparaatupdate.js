/* RTG Stad, deel "apparaatupdate": ondertekende updates en sabotage.

   Twee dingen die pas gaan leven als er echt hardware buiten hangt.

   EEN UPDATE DRAAGT EEN HANDTEKENING, gezet met de eigen sleutel van het
   apparaat. Daarmee kan een doos narekenen dat het pakket van ZIJN stad komt en
   niet van iemand die zijn netwerk heeft gevonden. Er staat altijd een
   terugvalversie bij: een update zonder weg terug is een fout die je maar een
   keer maakt, en dan staat er een straat vol bakstenen.

   EN SABOTAGE IS GEEN ONDERHOUD. Een kastje dat is opengebroken hoort niet op
   de klussenlijst maar bij de beveiligingslaag, naast de rest van de
   inbraakmeldingen. Krijgt de gedeelde ctx plus de paspoorthelpers. */
module.exports = (ctx, H) => {
  const { d, save, crypto, schoon, nu, seintje, beveilig } = ctx;
  const { paspoort } = H;

  const updates = () => { if (!Array.isArray(d().stadUpdates)) d().stadUpdates = []; return d().stadUpdates; };

  /* Een ondertekend updatemanifest. De handtekening is een HMAC met de EIGEN
     sleutel van het apparaat: alleen deze doos kan hem narekenen, en alleen
     deze stad kan hem zetten. Er staat altijd een TERUGVALVERSIE bij -- een
     update zonder weg terug is een fout die je maar een keer maakt. */
  function updateUit({ versie, sha256, notitie, wie }) {
    const v = schoon(versie, 20);
    if (!/^\d+\.\d+\.\d+$/.test(v)) return { status: 400, error: 'Geef een versie als 1.2.3.' };
    const sh = String(sha256 || '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(sh)) return { status: 400, error: 'Geef de sha256 van het pakket (64 tekens hex).' };
    if (updates().some(u => u.versie === v)) return { status: 400, error: 'Versie ' + v + ' is al uitgegeven.' };
    const vorige = updates()[0] || null;
    const u = { versie: v, sha256: sh, terugval: vorige ? vorige.versie : null,
      notitie: schoon(notitie, 200) || null, door: schoon(wie, 60) || 'kantoor', at: nu() };
    updates().unshift(u);
    if (updates().length > 50) updates().length = 50;
    save();
    return { ok: true, update: u,
      let_op: vorige ? 'Terugvalversie: ' + vorige.versie : 'Dit is de eerste versie; er is nog geen weg terug.' };
  }

  // wat een doos te horen krijgt als hij vraagt of er iets nieuws is
  function updateVoor(n) {
    const u = updates()[0];
    if (!u) return { ok: true, update: null, reden: 'er is nog geen versie uitgegeven' };
    const pp = paspoort(n.serial);
    if (pp.firmware === u.versie) return { ok: true, update: null, reden: 'deze doos draait al ' + u.versie };
    const bericht = u.versie + '|' + u.sha256 + '|' + u.at;
    const handtekening = crypto.createHmac('sha256', n.sleutelHash || 'geen').update(bericht).digest('hex');
    return { ok: true, update: { ...u, bericht, handtekening },
      let_op: 'Controleer de handtekening met je eigen apparaatsleutel voordat je iets installeert, en houd ' +
        (u.terugval || 'de huidige versie') + ' als terugval.' };
  }

  // de doos meldt zelf welke versie hij draait (na een geslaagde installatie)
  function firmwareGemeld(n, versie) {
    const v = schoon(versie, 20);
    if (!/^\d+\.\d+\.\d+$/.test(v)) return;
    const pp = paspoort(n.serial);
    if (pp.firmware === v) return;
    pp.vorigeFirmware = pp.firmware;
    pp.firmware = v;
    pp.historie.unshift({ fase: pp.fase, at: nu(), door: 'apparaat', notitie: 'draait nu firmware ' + v });
    save();
  }

  /* Sabotage. Dit is geen onderhoudsklus: een kastje dat is opengebroken is
     een beveiligingsvraag, en hij gaat dus naar dezelfde laag als de rest van
     de inbraakmeldingen. */
  function sabotage(n, melding) {
    const pp = paspoort(n.serial);
    pp.sabotage = { at: nu(), melding: schoon(melding, 140) || 'apparaat meldt manipulatie' };
    save();
    if (beveilig && beveilig.meld) {
      try { beveilig.meld('stadsdoos-sabotage', 'hoog',
        'Stadsdoos ' + n.naam + ' (' + n.serial + ') meldt manipulatie: ' + pp.sabotage.melding, { bron: 'stad' }); }
      catch (e) { console.error('[stad] sabotagemelding', e && e.message); }
    }
    seintje();
  }

  return { updates, updateUit, updateVoor, firmwareGemeld, sabotage };
};
