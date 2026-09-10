/* HOE EEN BERICHT BIJ EEN LID LANDT -- twee wegen, een schrijver.

   Dit bestand had er een: `meldAan`, de veiligheidsmelding. Daar is `meldLid`
   bij gekomen, de gewone, en die twee delen alles behalve twee dingen. Ze staan
   daarom in EEN functie met een schakelaar en niet als twee kopieen: twee
   schrijvers naar dezelfde lijst lopen uiteen, en dan komt de ene melding wel in
   het dossier van het lid en de andere niet (LAT-regel 4).

   HET VERSCHIL, en het is precies twee dingen:

     veiligheid   gaat ook over de 'veilig'-baan, waar de vier veiligheids-apps
                  op luisteren, en hoort daar thuis. Een reisbevestiging op die
                  baan laat een alarmscherm oplichten voor een hotelboeking.
     gewoon       volgt de meldingsvoorkeur van het lid (kern/ervaring.js,
                  MELDING_SCOPES). Een veiligheidsmelding doet dat niet: die
                  vraagt alleen `rustMagDoor`, en dat is de bedoeling.

   DE RUST-STAND. Een rust-stand ("niet storen tot thuis") mag een
   veiligheidsmelding NOOIT tegenhouden. Daarom vraagt deze weg dat expliciet
   aan `rustMagDoor` in plaats van de gewone voorkeuren te volgen: wie hier
   langskomt heeft voorrang, en dat hoort te blijken uit de code en niet uit een
   afspraak.

   DRIE KANALEN, en geen ervan mag de andere tegenhouden. De melding gaat in de
   lijst van het lid (hoogstens veertig, de oudste valt eraf), over de
   live-verbinding als 'notify' (en bij veiligheid ook als 'veilig') EN als push
   naar het toestel. De push staat in een try: een pushdienst die stukligt mag
   een alarm niet laten verdwijnen.

   DE SLEUTEL IS DIE VAN HET LID en niet zijn pas. `notify()` in
   ./meldingen.js schrijft op TIER -- dat is de weg voor "alle Business-leden
   krijgen bericht". Wie een van beide voor de ander aanziet, schrijft een
   persoonlijk bericht in een bak die /api/notifications nooit leest; zie de
   naad daar. */
'use strict';

module.exports = ({ kern, db, save, crypto, sseToCustomer, sendPush, sendPushToUser }) => {

  function schrijf(handle, note, veiligheid) {
    if (!handle) return null;
    const n = { id: crypto.randomBytes(4).toString('hex'), read: false, at: new Date().toISOString(), ...note };
    if (kern.rustMagDoor && !kern.rustMagDoor(handle, n)) return n;
    /* De voorkeur van het lid geldt alleen voor gewone berichten. Afwezig
       betekent aan -- dezelfde regel als in notify(). */
    if (!veiligheid && n.scope) {
      const vk = (db.data.meldingVoorkeur || {})[handle];
      if (vk && vk[n.scope] === false) return n;
    }
    db.data.notifications[handle] = (db.data.notifications[handle] || []);
    db.data.notifications[handle].unshift(n);
    db.data.notifications[handle] = db.data.notifications[handle].slice(0, 40);
    save();
    sseToCustomer(handle, 'notify', n);
    if (veiligheid) sseToCustomer(handle, 'veilig', n);   // de vier apps luisteren hierop
    try { sendPush(handle, n); } catch (e) { /* push mag een alarm nooit tegenhouden */ }
    const m = /^user-(.+)$/.exec(String(handle));
    if (m) { try { sendPushToUser(m[1], n); } catch (e) {} }
    return n;
  }

  return {
    meldAan: (handle, note) => schrijf(handle, note, true),
    meldLid: (handle, note) => schrijf(handle, note, false)
  };
};
