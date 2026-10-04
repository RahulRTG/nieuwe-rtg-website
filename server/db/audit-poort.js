'use strict';
/* Dezelfde adapter overleeft standby -> schrijver -> standby. Een passieve
   constructor migreert niets; promotie hoeft domeinservices niet te herbouwen. */
const vorm = require('./audit-vorm');
module.exports = ({ db, store, sqlite, bundelDoos, bewaar }) => ({
  open(naam) {
    if (store !== 'sqlite') return null;
    vorm.eis(naam);
    const motor = sqlite.auditMotor(); motor.context(bundelDoos);
    function bereid() {
      if (motor.bestaat(naam)) return true;
      if (!db.writable) return false;
      motor.open(naam); return true;
    }
    bereid();
    const voer = op => {
      if (!db.writable) return undefined;
      bereid(); bewaar([], op); return op.resultaat;
    };
    return {
      view() {
        if (bereid()) return motor.view(naam);
        const waarde = db.data?.[naam];
        return vorm.alleenLezen(vorm.pak(naam, vorm.rijen(naam, waarde), vorm.totaal(naam, waarde), vorm.extra(naam, waarde)));
      },
      append: (maak, kopTest) => voer({ naam, type: 'append', maak, kopTest, resultaat: {} }),
      rewrite: werk => voer({ naam, type: 'rewrite', werk, resultaat: {} })
    };
  }
});
