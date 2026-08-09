/* De veiligheidsmelding: hoe een alarm bij een lid terechtkomt.

   Dit stond als losse functie midden in `opzet/kernlaag1.js` -- een bestand dat
   verder alleen kernen ophangt. Een ophanglijst met een functie erin is precies
   het bestand waarin niemand die functie zoekt, en het is ook de reden dat die
   lijst over de 10 kB-grens ging.

   DE VEILIGHEIDSBAAN. Een rust-stand ("niet storen tot thuis") mag een
   veiligheidsmelding NOOIT tegenhouden. Daarom vraagt deze weg dat expliciet
   aan `rustMagDoor` in plaats van de gewone meldingsvoorkeuren te volgen: wie
   hier langskomt heeft voorrang, en dat hoort te blijken uit de code en niet
   uit een afspraak.

   DRIE KANALEN, en geen ervan mag de andere tegenhouden. De melding gaat in de
   lijst van het lid (hoogstens veertig, de oudste valt eraf), over de
   live-verbinding als 'notify' EN als 'veilig' (de vier veiligheids-apps
   luisteren op die tweede), en als push naar het toestel. De push staat in een
   try: een pushdienst die stukligt mag een alarm niet laten verdwijnen. */
'use strict';

module.exports = ({ kern, db, save, crypto, sseToCustomer, sendPush, sendPushToUser }) =>
  function meldAan(handle, note) {
    if (!handle) return null;
    const n = { id: crypto.randomBytes(4).toString('hex'), read: false, at: new Date().toISOString(), ...note };
    if (kern.rustMagDoor && !kern.rustMagDoor(handle, n)) return n;
    db.data.notifications[handle] = (db.data.notifications[handle] || []);
    db.data.notifications[handle].unshift(n);
    db.data.notifications[handle] = db.data.notifications[handle].slice(0, 40);
    save();
    sseToCustomer(handle, 'notify', n);
    sseToCustomer(handle, 'veilig', n);          // de vier apps luisteren hierop
    try { sendPush(handle, n); } catch (e) { /* push mag een alarm nooit tegenhouden */ }
    const m = /^user-(.+)$/.exec(String(handle));
    if (m) { try { sendPushToUser(m[1], n); } catch (e) {} }
    return n;
  };
