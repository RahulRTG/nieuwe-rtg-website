/* Care (deelmodule): de behandelaar die iets VASTLEGT in het dossier van het
   lid. De derde herkomst, en de eerste waarbij een ander dan het lid schrijft.

   DAT IS EEN APARTE TOESTEMMING, en met opzet niet dezelfde als de intake.
   De intake gaat de andere kant op: daar deelt het lid iets MET de aanbieder.
   Hier legt de aanbieder iets vast IN het dossier van het lid. Dat een kliniek
   uw bloedverdunner mag weten, betekent niet dat ze uw gewicht in uw dossier
   mag zetten; wie die twee op een schakelaar zet, zegt het ene en doet het
   andere.

   DE AFSPRAAK IS DE INGANG. Een behandelaar schrijft nooit op codenaam maar
   altijd op een REFERENTIE van een afspraak bij zijn eigen aanbieder. Daarmee
   is er geen enkele manier om bij een lid te komen waar je geen afspraak mee
   hebt: er valt niets te raden en niets op te zoeken.

   WAT ER VASTLIGT, BLIJFT LIGGEN. Intrekken stopt nieuwe vastleggingen; wat de
   behandelaar heeft gemeten, is echt gemeten en blijft staan met zijn herkomst
   en zijn naam erbij. Precies zoals bij een ingetrokken toestel. */

module.exports = (ctx) => {
  const { db, save, crypto, nu, vandaag, lijsten, aanbiederVan, notify,
    aanbiedersVanSupplier, metingVanBehandelaar } = ctx;

  const bak = () => { if (!Array.isArray(db.data.careVastlegging)) db.data.careVastlegging = []; return db.data.careVastlegging; };

  const vastleggingActief = (key, aanbiederId) =>
    bak().find(v => v.key === key && v.aanbiederId === aanbiederId && v.status === 'actief');

  /* het lid zet het aan, per aanbieder */
  function vastleggingDeel(key, aanbiederIdIn) {
    lijsten();
    const a = aanbiederVan(aanbiederIdIn);
    if (!a) return { status: 404, error: 'Zorgaanbieder niet gevonden.' };
    let v = vastleggingActief(key, a.id);
    if (!v) {
      v = { id: crypto.randomBytes(4).toString('hex'), key, aanbiederId: a.id, aanbiederNaam: a.naam,
        status: 'actief', at: nu() };
      bak().push(v);
      save();
    }
    return { ok: true, vastlegging: { id: v.id, aanbiederNaam: a.naam } };
  }

  function vastleggingStop(key, idIn) {
    const v = bak().find(x => x.id === String(idIn || '') && x.key === key && x.status === 'actief');
    if (!v) return { status: 404, error: 'Deze toestemming is er niet (meer).' };
    v.status = 'gestopt';
    v.gestoptOp = nu();
    save();
    return { ok: true, gestopt: v.aanbiederNaam,
      uitleg: 'Deze aanbieder legt niets meer vast. Wat er al staat blijft; dat is echt gemeten.' };
  }

  function vastleggingenVan(key) {
    return { ok: true, vastleggingen: bak().filter(v => v.key === key && v.status === 'actief')
      .map(v => ({ id: v.id, aanbiederNaam: v.aanbiederNaam, sinds: v.at })) };
  }

  /* de behandelaar legt vast, via een afspraak bij zijn eigen aanbieder */
  function careVastleg(supplierCode, body, nuDate = new Date()) {
    lijsten();
    const ids = aanbiedersVanSupplier(supplierCode).map(a => a.id);
    if (!ids.length) return { status: 409, error: 'Dit account is geen zorgaanbieder.' };
    const bk = db.data.careBoekingen.find(x => x.ref === String(body.ref || '') && ids.includes(x.aanbiederId));
    if (!bk) return { status: 404, error: 'Afspraak niet gevonden.' };

    const toestemming = vastleggingActief(bk.key, bk.aanbiederId);
    if (!toestemming) {
      return { status: 403, error: 'Dit lid heeft u geen toestemming gegeven om iets vast te leggen. '
        + 'Vraag het bij de afspraak; het lid zet het zelf aan.' };
    }

    const r = metingVanBehandelaar(bk.key, body, bk.aanbiederNaam, nuDate);
    if (!r.ok) return r;

    /* Het lid hoort het te WETEN. Iets in uw dossier dat er stil bij komt, is
       het tegenovergestelde van wat deze laag moet zijn. */
    notify(bk.key, { icon: 'zorg', title: bk.aanbiederNaam + ' legde een meting vast',
      body: r.onderwerp + ': ' + body.waarde + '. U ziet hem bij uw metingen; de toestemming kunt u altijd stoppen.',
      scope: 'care' });
    return { ok: true, onderwerp: r.onderwerp, bron: r.bron, door: bk.aanbiederNaam, datum: vandaag() };
  }

  return { vastleggingDeel, vastleggingStop, vastleggingenVan, vastleggingActief, careVastleg };
};
