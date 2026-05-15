const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// CREATE LOOM
exports.createLoom = async (req, res) => {
  try {
    const {
      id,
      name,
      type,
      status,
      efficiency,
      currentOrder,
      nextMaintenance,
      location,
      manufacturer,
      model,
      weaver,
      weaverId,
      width,
      reedSpace,
      maxRPM,
      fullLength,
      leftLength,
      createdby,
      updatedby,
      mode,
    } = req.body.loomData;

    if (!name || !type || !location || !manufacturer || !model) {
      return res.status(400).json({ error: "Fill required fields" });
    }

    if (mode == "create") {
      // Check if loom name already exists
      const checkQuery = `SELECT id FROM Users WHERE name = $1`;
      const checkResult = await pool.query(checkQuery, [name]);

      if (checkResult.rows.length > 0) {
        return res.status(400).json({
          error:
            "This loom name is already created. Please use a different name.",
        });
      }
      const id = uuidv4(); // Generate unique ID

      const query = `INSERT INTO loom (id,name, loomtype, status, efficiency, currentorder, nextmaintenance, location, manufacturer, model, assignedweaver, assignedweaverid, width,reedspace,maxrpm, fulllength, leftlength, createddate, updateddate, createdby, updatedby) 
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) RETURNING *`;
      const values = [
        id,
        name,
        type,
        status,
        efficiency,
        currentOrder,
        nextMaintenance,
        location,
        manufacturer,
        model,
        weaver,
        weaverId,
        width,
        reedSpace,
        maxRPM,
        fullLength,
        leftLength,
        "NOW()",
        "NOW()",
        createdby,
        updatedby,
      ];

      console.log(query, values);
      const result = await pool.query(query, values);

      res
        .status(201)
        .json({ message: "Loom created", status: 201, weaver: result.rows[0] });
    } else if (mode == "edit") {
      const query = `UPDATE loom SET  loomtype = $1, status = $2, efficiency = $3, currentorder = $4, nextmaintenance = $5,  location = $6, manufacturer = $7, model = $8, assignedweaver = $9, assignedweaverid = $10, width = $11, reedspace = $12, maxrpm = $13,fulllength = $14, leftlength = $15,  updateddate = $16, updatedby = $17 WHERE id = $18 RETURNING *`;
      const values = [
        type,
        status,
        efficiency,
        currentOrder,
        nextMaintenance,
        location,
        manufacturer,
        model,
        weaver,
        weaverId,
        width,
        reedSpace,
        maxRPM,
        fullLength,
        leftLength,
        "NOW()",
        updatedby,
        id,
      ];

      const result = await pool.query(query, values);
      res
        .status(201)
        .json({ message: "Loom updated", status: 201, weaver: result.rows[0] });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// GET LOOMS
exports.getAlllooms = async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id,name, loomtype, status, efficiency, currentorder, nextmaintenance, location, manufacturer, model,assignedweaver, assignedweaverid, width,reedspace,maxrpm, fulllength, leftlength, createddate, updateddate, createdby, updatedby FROM Loom ORDER BY updateddate DESC"
    );
    res
      .status(200)
      .json({ message: "Loom Retrieved successfully", loom: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteLoomById = async (req, res) => {
  const loomId = req.params.loomid;
  console.log(loomId);
  try {
    const query = `DELETE FROM loom WHERE id = $1`;
    const values = [loomId];
    const result = await pool.query(query, values);
    res.status(200).json({ message: "Loom Deleted successfully" });
  } catch (err) {
    console.error(err);
    // Check for foreign key violation
    if (err.code === "23503") {
      let message =
        "Cannot delete this record because it is used in another table.";

      // // Optional: Map constraint to a user-friendly message
      // if (err.constraint === "fk_loomid") {
      //   message =
      //     "Cannot delete this Loom because it is referenced in Time and Action Plans.";
      // }

      return res.status(400).json({ error: message });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.getDropdown = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, loomtype FROM loomtype WHERE status = 1`
    );
    res.status(200).json({
      message: "Dropdown values retrieved successfully",
      options: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.getLoomOptions = async (_req, res) => {
  try {
    const loomTypeQuery = `SELECT id, loomtype FROM loomtype WHERE status = 1 ORDER BY loomtype `;
    const loomStatusQuery = `SELECT id, loomstatus FROM loomstatus WHERE status = 1 ORDER BY loomstatus`;
    const orderQuery = `SELECT id FROM orders ORDER BY id`;
    // const loomModelQuery = `SELECT id, model FROM loommodel ORDER BY model`;

    // Run all queries in parallel
    const [types, status, orders] = await Promise.all([
      pool.query(loomTypeQuery),
      pool.query(loomStatusQuery),
      pool.query(orderQuery),
      // pool.query(loomBrandQuery),
      // pool.query(loomModelQuery)
    ]);

    res.status(200).json({
      message: "All option values retrieved",
      loomTypes: types.rows,
      loomStatus: status.rows,
      orders: orders.rows,
      // loomBrands: brands.rows,
      // loomModels: models.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.getWeavers = async (_req, res) => {
  try {
    const weaverResult = `SELECT id, name FROM weaver WHERE status = 'Active' ORDER BY name `;

    res.status(200).json({
      message: "Weavers retrieved successfully",
      weavers: weaverResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// GET LOOMS BY TYPE
// exports.getByLoomType = async (req, res) => {
//   try {
//     const { loomType } = req.params;

//     if (!loomType) {
//       return res.status(400).json({ error: "loomType parameter is required" });
//     }

//     const query = `
//       SELECT id, name, loomtype, status, efficiency, currentorder, nextmaintenance,
//              location, manufacturer, model, assignedweaver, assignedweaverid,
//              width, reedspace, maxrpm, createddate, updateddate, createdby, updatedby
//       FROM loom
//       WHERE loomtype = $1
//       ORDER BY updateddate DESC
//     `;
//     const values = [loomType];

//     const result = await pool.query(query, values);

//     if (result.rows.length === 0) {
//       return res
//         .status(404)
//         .json({ message: `No looms found for type: ${loomType}` });
//     }

//     res.status(200).json({
//       message: "Looms retrieved successfully by type",
//       looms: result.rows,
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// };
exports.getByLoomType = async (req, res) => {
  try {
    const { loomType } = req.params;

    if (!loomType) {
      return res.status(400).json({ error: "loomType parameter is required" });
    }

    const query = `
      SELECT 
        l.id, 
        l.name, 
        l.loomtype, 
        l.status, 
        l.efficiency, 
        l.currentorder, 
        l.nextmaintenance,
        l.location, 
        l.manufacturer, 
        l.model, 
        l.assignedweaver, 
        l.assignedweaverid,
        l.width, 
        l.reedspace, 
        l.maxrpm, 
        l.createddate, 
        l.updateddate, 
        l.createdby, 
        l.updatedby
      FROM loom l
      WHERE l.loomtype = $1
        AND NOT EXISTS (
          SELECT 1 
          FROM productionplanning pp
          WHERE pp.loomsselected IS NOT NULL
            AND json_typeof(pp.loomsselected) = 'array'
            AND l.id::text = ANY (
              SELECT json_array_elements_text(pp.loomsselected)
            )
        )
      ORDER BY l.updateddate DESC
    `;

    const values = [loomType];

    const result = await pool.query(query, values);

    // Always return the same structure: message, count, looms
    res.status(200).json({
      message: result.rows.length > 0 
        ? "Available looms retrieved successfully by type"
        : "No available looms found for this type (all may be already selected in production planning)",
      count: result.rows.length,
      looms: result.rows,
    });

  } catch (err) {
    console.error("Error fetching looms by type:", err);
    res.status(500).json({ 
      error: "Internal server error", 
      details: err.message 
    });
  }
};

//GET LOOM BY ID
// GET LOOM BY ID
exports.getLoomById = async (req, res) => {
  const { loomid } = req.params; // Correct way to read param

  try {
    const query = `
      SELECT id, name, loomtype, status, efficiency, currentorder,
             nextmaintenance, location, manufacturer, model, assignedweaver,
             assignedweaverid, width, reedspace, maxrpm, createddate,
             updateddate, createdby, updatedby
      FROM loom
      WHERE id = $1
    `;

    const values = [loomid];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Loom not found" });
    }

    res.status(200).json({
      message: "Loom retrieved successfully",
      loom: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
