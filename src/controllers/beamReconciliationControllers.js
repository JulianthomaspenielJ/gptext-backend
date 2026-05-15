// controllers/beamReconciliationController.js
const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const getBeamReconciliationList = async (req, res) => {
  const client = await pool.connect();

  try {
    // Single query to get both the list and the counts
    const query = `
      WITH stats AS (
        SELECT 
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'completed') AS completed,
          COUNT(*) FILTER (WHERE status = 'approved') AS approved,
          COUNT(*) FILTER (WHERE status = 'pending') AS pending,
          COUNT(*) FILTER (WHERE status = 'in-progress') AS in_progress
        FROM beam_reconciliations
      )
      SELECT 
        (SELECT total FROM stats)::integer AS total_records,
        (SELECT completed FROM stats)::integer AS completed,
        (SELECT approved FROM stats)::integer AS approved,
        (SELECT pending FROM stats)::integer AS pending,
        (SELECT in_progress FROM stats)::integer AS in_progress,
        json_agg(
          json_build_object(
            'id', br.id,
            'sl_no', br.sl_no,
            'gpt_no', br.gpt_no,
            'job_order_no', br.job_order_no,
            'job_order_date', br.job_order_date,
            'created_date_time', br.created_date_time,
            'loom_id', br.loom_id,
            'weaver_name', br.weaver_name,
            'weaver_inv_no', br.weaver_inv_no,
            'construction', br.construction,
            'weft_quality', br.weft_quality,
            'warp_crimp_report', br.warp_crimp_report,
            'warp_mtr', br.warp_mtr,
            'expected_fabric_meters', br.expected_fabric_meters,
            'ends', br.ends,
            'ends_per_dent', br.ends_per_dent,
            'reed_space', br.reed_space,
            'weft_wt', br.weft_wt,
            'reed_count', br.reed_count,
            'crimp_percentage', br.crimp_percentage,
            'req_weft', br.req_weft,
            'yarn_outward_details', br.yarn_outward_details,
            'yarn_return_details', br.yarn_return_details,
            'sale_order_splits', br.sale_order_splits,
            'status', br.status,
            'remarks', br.remarks,
            'prepared_by', br.prepared_by,
            'approved_by', br.approved_by,
            'created_at', br.created_at,
            'updated_at', br.updated_at
          ) ORDER BY br.created_at DESC
        ) AS data
      FROM beam_reconciliations br, stats;
    `;

    const result = await client.query(query);

    const row = result.rows[0];

    return res.status(200).json({
      success: true,
      message: "Beam reconciliation records fetched successfully",
      totalRecords: row.total_records,
      completed: row.completed,
      approved: row.approved,
      pending: row.pending,
      inProgress: row.in_progress, // optional
      data: row.data || [],
    });

  } catch (error) {
    console.error("Error fetching beam reconciliation list:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch reconciliation records",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const getBeamReconciliationById = async (req, res) => {
  const client = await pool.connect();
  const { id } = req.params; // UUID from URL

  try {
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Record ID is required",
      });
    }

    const query = `
      SELECT 
        id,
        sl_no,
        gpt_no,
        job_order_no,
        job_order_date,
        created_date_time,
        loom_id,
        weaver_name,
        weaver_inv_no,
        construction,
        weft_quality,
        warp_crimp_report,
        warp_mtr,
        expected_fabric_meters,
        ends,
        ends_per_dent,
        reed_space,
        weft_wt,
        reed_count,
        crimp_percentage,
        req_weft,
        yarn_outward_details,
        yarn_return_details,
        sale_order_splits,
        status,
        remarks,
        prepared_by,
        approved_by,
        created_at,
        updated_at
      FROM beam_reconciliations
      WHERE id = $1
    `;

    const result = await client.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Beam reconciliation record not found",
      });
    }

    const record = result.rows[0];

    return res.status(200).json({
      success: true,
      message: "Record fetched successfully",
      data: record,
    });
  } catch (error) {
    console.error("Error fetching record by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch record",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const createBeamReconciliation = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      sl_no,
      gpt_no,
      job_order_no,
      job_order_date,
      loom_id,
      weaver_name,
      weaver_inv_no,
      construction = {},
      weft_quality = {},
      warp_crimp_report = {},
      warp_mtr = 0,
      expected_fabric_meters = 0,
      ends = 0,
      ends_per_dent = 0,
      reed_space = 0,
      weft_wt = 0,
      reed_count = 0,
      crimp_percentage = 0,
      req_weft = 0,
      yarn_outward_details = [],
      yarn_return_details = [],
      sale_order_splits = [],
      status = "pending",
      remarks = "",
      prepared_by,
      approved_by,
    } = req.body;

    if (!gpt_no || !job_order_no ) {
      return res.status(400).json({
        success: false,
        message: "gpt_no and job_order_no are required",
      });
    }

    const id = uuidv4();
    const now = new Date();
    const created_date_time = now.toLocaleString("en-IN");

    const query = `
      INSERT INTO beam_reconciliations (
        id, sl_no, gpt_no, job_order_no, job_order_date, created_date_time,
        loom_id, weaver_name, weaver_inv_no,
        construction, weft_quality, warp_crimp_report,
        warp_mtr, expected_fabric_meters, ends, ends_per_dent,
        reed_space, weft_wt, reed_count, crimp_percentage, req_weft,
        yarn_outward_details, yarn_return_details, sale_order_splits,
        status, remarks, prepared_by, approved_by,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9,
        $10::jsonb, $11::jsonb, $12::jsonb,
        $13, $14, $15, $16,
        $17, $18, $19, $20, $21,
        $22::jsonb[], $23::jsonb[], $24::jsonb[],
        $25, $26, $27, $28,
        $29, $30
      ) RETURNING *
    `;

    const values = [
      id,
      sl_no || null,
      gpt_no,
      job_order_no,
      job_order_date || null,
      created_date_time,
      loom_id || null,
      weaver_name || null,
      weaver_inv_no || null,
      construction,              // pg will auto-convert JS object → jsonb
      weft_quality,              // same
      warp_crimp_report,         // same
      parseFloat(warp_mtr) || 0,
      parseFloat(expected_fabric_meters) || 0,
      parseInt(ends) || 0,
      parseInt(ends_per_dent) || 0,
      parseFloat(reed_space) || 0,
      parseFloat(weft_wt) || 0,
      parseInt(reed_count) || 0,
      parseFloat(crimp_percentage) || 0,
      parseFloat(req_weft) || 0,
      yarn_outward_details,      // ← Pass JS array directly!
      yarn_return_details,       // ← PostgreSQL + node-pg handles conversion
      sale_order_splits,         // ← Perfectly!
      status,
      remarks || null,
      prepared_by,
      approved_by || null,
      now,
      now,
    ];

    const result = await client.query(query, values);

    return res.status(201).json({
      success: true,
      message: "Beam reconciliation created successfully",
      data: result.rows[0],
    });

  } catch (error) {
    console.error("Error creating beam reconciliation:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create beam reconciliation",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const updateBeamReconciliation = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Beam reconciliation ID is required",
      });
    }

    const {
      sl_no,
      gpt_no,
      job_order_no,
      job_order_date,
      loom_id,
      weaver_name,
      weaver_inv_no,
      construction = {},
      weft_quality = {},
      warp_crimp_report = {},
      warp_mtr = 0,
      expected_fabric_meters = 0,
      ends = 0,
      ends_per_dent = 0,
      reed_space = 0,
      weft_wt = 0,
      reed_count = 0,
      crimp_percentage = 0,
      req_weft = 0,
      yarn_outward_details = [],
      yarn_return_details = [],
      sale_order_splits = [],
      status,
      remarks,
      prepared_by,
      approved_by,
    } = req.body;

    // Validate minimum fields (optional but recommended)
    if (!gpt_no || !job_order_no) {
      return res.status(400).json({
        success: false,
        message: "gpt_no and job_order_no are required",
      });
    }

    const now = new Date();

    const query = `
      UPDATE beam_reconciliations
      SET
        sl_no = $1,
        gpt_no = $2,
        job_order_no = $3,
        job_order_date = $4,
        loom_id = $5,
        weaver_name = $6,
        weaver_inv_no = $7,
        construction = $8::jsonb,
        weft_quality = $9::jsonb,
        warp_crimp_report = $10::jsonb,
        warp_mtr = $11,
        expected_fabric_meters = $12,
        ends = $13,
        ends_per_dent = $14,
        reed_space = $15,
        weft_wt = $16,
        reed_count = $17,
        crimp_percentage = $18,
        req_weft = $19,
        yarn_outward_details = $20::jsonb[],
        yarn_return_details = $21::jsonb[],
        sale_order_splits = $22::jsonb[],
        status = $23,
        remarks = $24,
        prepared_by = $25,
        approved_by = $26,
        updated_at = $27
      WHERE id = $28
      RETURNING *
    `;

    const values = [
      sl_no || null,
      gpt_no,
      job_order_no,
      job_order_date || null,
      loom_id || null,
      weaver_name || null,
      weaver_inv_no || null,
      construction,
      weft_quality,
      warp_crimp_report,
      parseFloat(warp_mtr) || 0,
      parseFloat(expected_fabric_meters) || 0,
      parseInt(ends) || 0,
      parseInt(ends_per_dent) || 0,
      parseFloat(reed_space) || 0,
      parseFloat(weft_wt) || 0,
      parseInt(reed_count) || 0,
      parseFloat(crimp_percentage) || 0,
      parseFloat(req_weft) || 0,
      yarn_outward_details,
      yarn_return_details,
      sale_order_splits,
      status,
      remarks || null,
      prepared_by,
      approved_by || null,
      now,
      id,
    ];

    const result = await client.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Beam reconciliation not found",
      });
    }

    return res.json({
      success: true,
      message: "Beam reconciliation updated successfully",
      data: result.rows[0],
    });

  } catch (error) {
    console.error("Error updating beam reconciliation:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update beam reconciliation",
      error: error.message,
    });
  } finally {
    client.release();
  }
};


module.exports = { createBeamReconciliation, getBeamReconciliationList, getBeamReconciliationById, updateBeamReconciliation };