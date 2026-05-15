const pool = require("../config/db");

// GET PRODUCTIONPLANNING
exports.getAllProductionPlanning = async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT o.id as orderid, o.customername, pp.loomtype, pp.loomsselected, pp.productionperdayloom, o.orderdate as startdate, o.deliverydate as enddate,o.quantity, o.priority, o.actualproduction, pp.productionprogress as progress, o.status, o.meters, o.fabrictype as fabric FROM Orders o INNER JOIN Productionplanning pp on o.id = pp.orderid"
    );
    res.status(200).json({
      message: "Product Planning details Retrieved successfully",
      productionplanning: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
