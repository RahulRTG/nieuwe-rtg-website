/* Supplier-submodule "kamers": Kamers en huishouding: kamers toevoegen/schakelen, housekeeping-status,
   klussen (tickets), lost & found, foto's, de minibar en de slimme deuren.
   Verbatim afgesplitst uit routes/supplier.js; alleen de routes, de helpers
   komen via het kern-object binnen. */
module.exports = (kern) => {

/* De huishouding- en voorzieningenlaag draaien als submodules op de
   gedeelde kern. */
require('./kamers/huishouding')(kern);
require('./kamers/voorzieningen')(kern);
};
