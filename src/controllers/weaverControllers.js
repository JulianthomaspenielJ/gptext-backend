const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// CREATE WEAVER
exports.createWeaver = async (req, res) => {
  try {
    const {
      id,
      name,
      email,
      status,
      phoneNumber,
      numberOfLooms,
      address,
      city,
      state,
      gstNumber,
      panNumber,
      createdby,
      updatedby,
      mode,
    } = req.body.weaverData;

    if (!name || !numberOfLooms) {
      return res.status(400).json({ error: "Fill required fields" });
    }

    if (mode == "create") {
      const id = uuidv4(); // Generate unique ID

      const query = `INSERT INTO weaver (id, name, email, status, phone, numberoflooms, address, city, state, gstnumber, pannumber, createddate, updateddate, createdby, updatedby) 
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`;
      const values = [
        id,
        name,
        email,
        status,
        phoneNumber,
        numberOfLooms,
        address,
        city,
        state,
        gstNumber,
        panNumber,
        "NOW()",
        "NOW()",
        createdby,
        updatedby,
      ];

      const result = await pool.query(query, values);
      res.status(201).json({
        message: "Weaver created",
        status: 201,
        weaver: result.rows[0],
      });
    } else if (mode == "edit") {
      const query = `UPDATE weaver SET name = $1, email = $2, status = $3, phone = $4, numberoflooms = $5, address = $6, city = $7, state = $8, gstnumber = $9, pannumber = $10, updateddate = $11, updatedby = $12 WHERE id = $13 RETURNING *`;
      const values = [
        name,
        email,
        status,
        phoneNumber,
        numberOfLooms,
        address,
        city,
        state,
        gstNumber,
        panNumber,
        "NOW()",
        updatedby,
        id,
      ];

      const result = await pool.query(query, values);
      res.status(201).json({
        message: "Weaver updated",
        status: 201,
        weaver: result.rows[0],
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// GET WEAVERS
exports.getAllWeavers = async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, status, phone, numberoflooms, address, city, state, gstnumber, pannumber, createddate, updateddate, createdby, updatedby FROM Weaver ORDER BY updateddate DESC"
    );
    res
      .status(200)
      .json({ message: "Weaver Retrieved successfully", weaver: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// GET WEAVERSBYID
exports.getWeaverById = async (req, res) => {
  const weaverId = req.params.weaverid;
  console.log(weaverId);
  try {
    const query = `SELECT id, name, email, status, phone, numberoflooms, address, city, state, gstnumber, pannumber, createddate, updateddate, createdby, updatedby FROM Weaver WHERE Id = $1`;
    const values = [weaverId];
    const result = await pool.query(query, values);
    res
      .status(200)
      .json({ message: "Weaver Retrieved successfully", weaver: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteWeaverById = async (req, res) => {
  const weaverId = req.params.weaverid;
  console.log(weaverId);
  try {
    const query = `DELETE FROM weaver WHERE id = $1`;
    const values = [weaverId];
    const result = await pool.query(query, values);
    res.status(200).json({ message: "Weaver Deleted successfully" });
  } catch (err) {
    console.error(err);
    if (err.code === "23503") {
      let message =
        "Cannot delete this record because it is used in another table.";

      return res.status(400).json({ error: message });
    }
    res.status(500).json({ error: err.message });
  }
};
