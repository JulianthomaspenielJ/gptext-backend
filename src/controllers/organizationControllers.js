const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// UPDATE ORG
exports.updateOrganization = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      website,
      gst,
      currency,
      address,
      // logo,
      updatedby,
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Fill required fields" });
    }
    // 👇 FILE PATH (if uploaded)
    const logoPath = req.file
      ? `/uploads/company-logos/${req.file.filename}`
      : null;

    const query = `UPDATE organization SET name = $1, phone = $2, email = $3, website = $4, gst = $5, currency = $6, address = $7, logo = COALESCE($8, logo), updateddate = $9, updatedby = $10 RETURNING *`;
    const values = [
      name,
      phone,
      email,
      website,
      gst,
      currency,
      address,
      logoPath,
      "NOW()",
      updatedby,
    ];

    const result = await pool.query(query, values);
    res.status(201).json({
      message: "Organization updated",
      status: 201,
      users: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.getOrganizationOptions = async (_req, res) => {
  try {
    const organizationOptionsQuery = `SELECT id, currency FROM currency WHERE status = 1 ORDER BY currency`;

    // Run all queries in parallel
    const [currency] = await Promise.all([
      pool.query(organizationOptionsQuery),
    ]);

    res.status(200).json({
      message: "All option values retrieved",
      currency: currency.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
// GET USERS
exports.getOrganizationById = async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, phone, email, website, gst, currency, address, logo, createddate, updateddate, createdby, updatedby FROM Organization"
    );
    res.status(200).json({
      message: "Organization Retrieved successfully",
      organization: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
