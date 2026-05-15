// controllers/productionController.js
const pool = require("../config/db");
const { v4: uuidv4 } = require('uuid');
require("dotenv").config();

const parseLoomsSelected = (raw) => {
  if (!raw || raw === null || raw === "null" || raw === "") return [];

  let input = String(raw).trim();

  // Case 1: Double-serialized JSON → your exact case!
  // Example: "[""36bc344b-3248-4d38-9609-db98d9515f7b""]"
  if (input.includes('""') && input.startsWith('["') && input.endsWith('"]')) {
    try {
      // Remove outer quotes if wrapped as string
      if (input.startsWith('"') && input.endsWith('"')) {
        input = input.slice(1, -1);
      }
      // Fix double quotes and parse
      const cleaned = input.replace(/\\"/g, '"').replace(/""/g, '"');
      const parsed = JSON.parse(cleaned);
      return Array.isArray(parsed)
        ? parsed.map((id) => id.toString().trim())
        : [];
    } catch (e) {
      // fall through
    }
  }

  // Case 2: Normal JSON array
  if (input.startsWith("[") && input.endsWith("]")) {
    try {
      const parsed = JSON.parse(input);
      return Array.isArray(parsed)
        ? parsed.map((id) => id.toString().trim())
        : [];
    } catch (e) {
      // fall through
    }
  }

  // Case 3: Extract UUIDs using regex (last resort)
  const uuidRegex =
    /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
  const matches = input.match(uuidRegex);
  if (matches && matches.length > 0) {
    return matches.map((m) => m.toLowerCase());
  }

  return [];
};

// GET /api/daily-production?date=YYYY-MM-DD
const getDailyProduction = async (req, res) => {
  const { date } = req.query;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Valid date (YYYY-MM-DD) required" });
  }

  const client = await pool.connect();

  try {
    // 1. All active looms
    const loomsQuery = `
      SELECT 
        l.id,
        l.name AS loom_name,
        l.status,
        l.currentorder,
        l.assignedweaverid AS weaver_id,
        l.assignedweaver AS weaver_name
      FROM loom l
    `;

    // 2. All production planning (target source)
    const planningQuery = `
      SELECT orderid, productionperdayloom, loomsselected

      FROM productionplanning
      WHERE productionperdayloom IS NOT NULL;
    `;

    // 3. Today's actual production only (we ignore target from this table)
    const actualQuery = `
      SELECT loomid, actualproduction
      FROM loomweaverproduction
      WHERE DATE(createdat) = $1;
    `;

    const [loomsRes, planningRes, actualRes] = await Promise.all([
      client.query(loomsQuery),
      client.query(planningQuery),
      client.query(actualQuery, [date]),
    ]);

    const looms = loomsRes.rows;
    const actualMap = new Map(
      actualRes.rows.map((r) => [
        r.loomid.toString(),
        Number(r.actualproduction || 0),
      ])
    );

    // Build target map: loom UUID → target from planning
    const targetMap = new Map(); // "uuid" → target

    planningRes.rows.forEach((plan) => {
      const target = Number(plan.productionperdayloom) || 0;
      const orderId = plan.orderid; // get orderId from productionplanning
      if (target <= 0) return;

      const selectedLooms = parseLoomsSelected(plan.loomsselected);

      selectedLooms.forEach((loomId) => {
        if (loomId && loomId.length >= 30) {
          targetMap.set(loomId.toString().trim(), { target, orderId });
        }
      });
    });

    // Build final loom data — target ONLY from planning
    const loomData = looms.map((loom) => {
      const loomUuid = loom.id.toString();
      const targetInfo = targetMap.get(loomUuid) || {
        target: 0,
        orderId: null,
      };
      const targetProduction = targetInfo.target;
      const orderId = targetInfo.orderId;
      const actualProduction = actualMap.get(loomUuid) || 0;

      const efficiency =
        targetProduction > 0
          ? Number(((actualProduction / targetProduction) * 100).toFixed(1))
          : 0;

      return {
        loomId: loom.id,
        loomName: loom.loom_name,
        orderId, // now comes from productionplanning
        weaverId: loom.weaver_id || null,
        weaverName: loom.weaver_name || "Unassigned",
        targetProduction,
        actualProduction,
        efficiency,
        status: loom.status,
      };
    });

    // Weaver aggregation
    const weaverMap = new Map();
    loomData.forEach((l) => {
      if (!l.weaverId) return;

      if (!weaverMap.has(l.weaverId)) {
        weaverMap.set(l.weaverId, {
          weaverId: l.weaverId,
          weaverName: l.weaverName,
          assignedLooms: [],
          totalTarget: 0,
          totalActual: 0,
          orders: new Set(), // use Set to avoid duplicates
        });
      }

      const w = weaverMap.get(l.weaverId);
      w.assignedLooms.push(l.loomId);
      w.totalTarget += l.targetProduction;
      w.totalActual += l.actualProduction;

      if (l.orderId) {
        w.orders.add(l.orderId); // add orderId to the set
      }
    });

    const weaverData = Array.from(weaverMap.values()).map((w) => ({
      weaverId: w.weaverId,
      weaverName: w.weaverName,
      assignedLooms: w.assignedLooms,
      totalTarget: w.totalTarget,
      totalActual: w.totalActual,
      efficiency:
        w.totalTarget > 0
          ? Number(((w.totalActual / w.totalTarget) * 100).toFixed(1))
          : 0,
      orders: Array.from(w.orders), // convert Set to array
    }));

    // Summary
    const totalTarget = loomData.reduce((s, l) => s + l.targetProduction, 0);
    const totalActual = loomData.reduce((s, l) => s + l.actualProduction, 0);
    const achievement =
      totalTarget > 0
        ? Number(((totalActual / totalTarget) * 100).toFixed(1))
        : 0;
    const activeLooms = loomData.filter((l) => l.status === "Running").length;

    res.json({
      summary: { totalTarget, totalActual, achievement, activeLooms },
      looms: loomData,
      weavers: weaverData,
      date,
    });
  } catch (err) {
    console.error("getDailyProduction error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
};

// GET /api/weekly-trend?start=2025-12-02&end=2025-12-09
// const getWeeklyTrend = async (req, res) => {
//   const { start, end } = req.query;

//   if (
//     !start ||
//     !end ||
//     !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
//     !/^\d{4}-\d{2}-\d{2}$/.test(end)
//   ) {
//     return res
//       .status(400)
//       .json({ error: "Valid start and end dates (YYYY-MM-DD) required" });
//   }

//   const client = await pool.connect();

//   try {
//     // Generate date array
//     const dates = [];
//     const cur = new Date(start);
//     const endDate = new Date(end);
//     while (cur <= endDate) {
//       dates.push(cur.toISOString().split("T")[0]);
//       cur.setDate(cur.getDate() + 1);
//     }

//     // 1. Active looms
//     const loomsRes = await client.query(`
//       SELECT id, name AS loom_name, currentorder
//       FROM loom
//       WHERE status NOT IN ('Scrap', 'Removed', 'Inactive')
//     `);

//     // 2. Planning (target + orderId)
//     const planningRes = await client.query(`
//       SELECT orderid, productionperdayloom, loomsselected
//       FROM productionplanning
//       WHERE productionperdayloom IS NOT NULL
//     `);

//     // 3. Actual production for the whole range – FIXED QUERY
//     // const actualRes = await client.query(`
//     //   SELECT
//     //     loomid,
//     //     DATE(createdat) AS prod_date,
//     //     SUM(actualproduction) AS daily_actual
//     //   FROM loomweaverproduction
//     //   WHERE createdat >= $1::date
//     //     AND createdat < ($2::date + INTERVAL '1 day')
//     //   GROUP BY loomid, DATE(createdat)
//     // `, [start, end]);

//     const actualRes = await client.query(
//       `  SELECT loomid, prod_date, SUM(actualproduction) AS daily_actual
//     FROM (
//       SELECT loomid,
//             createdat::date AS prod_date,
//             actualproduction
//       FROM loomweaverproduction
//       WHERE createdat >= $1
//         AND createdat < $2
//     ) AS t
//     GROUP BY loomid, prod_date
//     ORDER BY loomid, prod_date;
//     `,
//       [start, end]
//     );

//     const looms = loomsRes.rows;

//     // Build target map: loom UUID → { target, orderId }
//     const targetMap = new Map();
//     planningRes.rows.forEach((plan) => {
//       const target = Number(plan.productionperdayloom) || 0;
//       if (target <= 0) return;

//       const selected = parseLoomsSelected(plan.loomsselected);
//       selected.forEach((id) => {
//         if (id && id.length >= 30) {
//           targetMap.set(id.toString().trim(), {
//             target,
//             orderId: plan.orderid,
//           });
//         }
//       });
//     });

//     // Build actual map: date → loom → actual
//     const actualMap = new Map(); // date string → Map(loomId → actual)
//     actualRes.rows.forEach((r) => {
//       const d = r.prod_date;
//       const loom = r.loomid.toString();
//       if (!actualMap.has(d)) actualMap.set(d, new Map());
//       actualMap.get(d).set(loom, Number(r.daily_actual || 0));
//     });

//     // Final trend data
//     const trend = dates.map((date) => {
//       let dayTarget = 0;
//       let dayActual = 0;

//       looms.forEach((loom) => {
//         const uuid = loom.id.toString();
//         const info = targetMap.get(uuid);
//         if (info) dayTarget += info.target;

//         if (actualMap.has(date)) {
//           dayActual += actualMap.get(date).get(uuid) || 0;
//         }
//       });

//       return { date, target: dayTarget, actual: dayActual };
//     });

//     res.json(trend);
//   } catch (err) {
//     console.error("getWeeklyTrend error:", err);
//     res.status(500).json({ error: "Server error" });
//   } finally {
//     client.release();
//   }
// };

const getWeeklyTrend = async (req, res) => {
  const { start, end } = req.query;

  if (
    !start ||
    !end ||
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end)
  ) {
    return res
      .status(400)
      .json({ error: "Valid start and end dates (YYYY-MM-DD) required" });
  }

  const client = await pool.connect();

  try {
    // --- generate dates array ---
    const dates = [];
    const cur = new Date(start);
    const endDate = new Date(end);
    while (cur <= endDate) {
      dates.push(cur.toISOString().split("T")[0]);
      cur.setDate(cur.getDate() + 1);
    }

    // --- fetch looms ---
    const loomsRes = await client.query(`
      SELECT id, name AS loom_name, currentorder
      FROM loom
      WHERE status NOT IN ('Scrap', 'Removed', 'Inactive')
    `);

    const looms = loomsRes.rows;

    // --- fetch planning ---
    const planningRes = await client.query(`
      SELECT orderid, productionperdayloom, loomsselected
      FROM productionplanning
      WHERE productionperdayloom IS NOT NULL AND loomsselected IS NOT NULL

    `);

    // --- build target map: loomId => total target ---
    const targetMap = new Map();
    const parseLoomsSelected = (arr) => arr.map((id) => id.toString().trim());

    planningRes.rows.forEach((plan) => {
      const target = Number(plan.productionperdayloom) || 0;
      if (target <= 0) return;

      const selectedLooms = parseLoomsSelected(plan.loomsselected);
      selectedLooms.forEach((loomId) => {
        if (!targetMap.has(loomId)) targetMap.set(loomId, 0);
        targetMap.set(loomId, targetMap.get(loomId) + target);
      });
    });

    // --- fetch actual production ---
    const actualRes = await client.query(
      `
      SELECT loomid, createdat::date AS prod_date, SUM(actualproduction) AS daily_actual
      FROM loomweaverproduction
      WHERE createdat >= $1::date AND createdat < ($2::date + INTERVAL '1 day')
      GROUP BY loomid, createdat::date
    `,
      [start, end]
    );

    // --- build actual map: date => loomId => actual ---
    const actualMap = new Map();
    actualRes.rows.forEach((r) => {
      const date = r.prod_date.toISOString().split("T")[0];
      const loomId = r.loomid.toString().trim();
      if (!actualMap.has(date)) actualMap.set(date, new Map());
      const loomMap = actualMap.get(date);
      loomMap.set(loomId, Number(r.daily_actual || 0));
    });

    // --- build final trend ---
    const trend = dates.map((date) => {
      let dayTarget = 0;
      let dayActual = 0;

      looms.forEach((loom) => {
        const id = loom.id.toString().trim();
        dayTarget += targetMap.get(id) || 0;

        if (actualMap.has(date)) {
          dayActual += actualMap.get(date).get(id) || 0;
        }
      });

      return { date, target: dayTarget, actual: dayActual };
    });

    res.json(trend);
  } catch (err) {
    console.error("getWeeklyTrend error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
};


const getMonthlyTrend = async (req, res) => {
  const { start, end } = req.query;

  if (
    !start ||
    !end ||
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end)
  ) {
    return res
      .status(400)
      .json({ error: "Valid start and end dates (YYYY-MM-DD) required" });
  }

  const client = await pool.connect();

  try {
    // --- generate months array ---
    const months = [];
    const cur = new Date(start);
    cur.setDate(1); // normalize to month start

    const endDate = new Date(end);
    endDate.setDate(1);

    while (cur <= endDate) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      months.push(key);
      cur.setMonth(cur.getMonth() + 1);
    }

    // --- fetch looms ---
    const loomsRes = await client.query(`
      SELECT id
      FROM loom
      WHERE status NOT IN ('Scrap', 'Removed', 'Inactive')
    `);
    const looms = loomsRes.rows;

    // --- fetch planning ---
    const planningRes = await client.query(`
      SELECT productionperdayloom, loomsselected
      FROM productionplanning
      WHERE productionperdayloom IS NOT NULL
        AND loomsselected IS NOT NULL
    `);

    // --- build daily target per loom ---
    const targetMap = new Map();

    planningRes.rows.forEach((plan) => {
      const dailyTarget = Number(plan.productionperdayloom) || 0;
      if (dailyTarget <= 0) return;

      plan.loomsselected.forEach((loomId) => {
        loomId = loomId.toString().trim();
        targetMap.set(loomId, (targetMap.get(loomId) || 0) + dailyTarget);
      });
    });

    // --- fetch actual production (grouped by month) ---
    const actualRes = await client.query(
      `
      SELECT
        to_char(createdat, 'YYYY-MM') AS month,
        loomid,
        SUM(actualproduction) AS monthly_actual
      FROM loomweaverproduction
      WHERE createdat >= $1::date
        AND createdat < ($2::date + INTERVAL '1 day')
      GROUP BY month, loomid
    `,
      [start, end]
    );

    // --- actual map: month => loomId => actual ---
    const actualMap = new Map();

    actualRes.rows.forEach((r) => {
      if (!actualMap.has(r.month)) actualMap.set(r.month, new Map());
      actualMap
        .get(r.month)
        .set(r.loomid.toString().trim(), Number(r.monthly_actual || 0));
    });

    // --- build final monthly trend ---
    const trend = months.map((monthKey) => {
      let monthTarget = 0;
      let monthActual = 0;

      const [year, month] = monthKey.split("-");
      const daysInMonth = new Date(year, month, 0).getDate();

      looms.forEach((loom) => {
        const loomId = loom.id.toString().trim();

        // daily target × number of days
        monthTarget += (targetMap.get(loomId) || 0) * daysInMonth;

        if (actualMap.has(monthKey)) {
          monthActual += actualMap.get(monthKey).get(loomId) || 0;
        }
      });

      const label = new Date(`${monthKey}-01`).toLocaleString("en-US", {
        month: "short",
        year: "numeric",
      });

      return {
        month: label,
        target: monthTarget,
        production: monthActual,
      };
    });

    res.json(trend);
  } catch (err) {
    console.error("getMonthlyTrend error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
};

// Creates or updates production record for a loom/weaver on a specific date
// const updateProduction = async (req, res) => {
//   const {
//     loomId,
//     weaverId,
//     actualProduction,
//     loomWiseProduction,
//     shiftHours,
//     downtime,
//     downtimeReason,
//     qualityIssues,
//     additionalRemarks,
//     createdBy,
//     date,
//   } = req.body;

//   if (!loomId && !weaverId) {
//     return res.status(400).json({
//       error: "You must provide either loomId or weaverId",
//     });
//   }

//   const client = await pool.connect();

//   try {
//     await client.query("BEGIN");

//     let loomIds = [];

//     if (Array.isArray(loomId)) {
//       loomIds = loomId;
//     } else if (loomId) {
//       loomIds = [loomId];
//     } else if (weaverId) {
//       const { rows } = await client.query(
//         `SELECT id FROM loom WHERE assignedweaverid = $1`,
//         [weaverId]
//       );
//       if (rows.length === 0) {
//         return res.status(404).json({ error: "No loom found for this weaver" });
//       }
//       loomIds = rows.map((r) => r.id);
//     }

//     if (loomIds.length === 0) {
//       return res.status(400).json({ error: "No valid loom IDs found" });
//     }

//     const output = [];
//     const updatedOrderIds = new Set(); // Track unique orders to update planning once

//     for (const singleLoomId of loomIds) {
//       const thisLoomProduction =
//         loomWiseProduction && typeof loomWiseProduction === "object"
//           ? Number(loomWiseProduction[singleLoomId]) || 0
//           : Number(actualProduction) || 0;

//       if (thisLoomProduction === 0 && loomWiseProduction) continue;

//       const planQuery = `
//         SELECT orderid, productionperdayloom
//         FROM productionplanning
//         WHERE loomsselected::text LIKE $1 OR loomsselected::jsonb ? $2
//         LIMIT 1
//       `;

//       const { rows: planRows } = await client.query(planQuery, [
//         `%${singleLoomId}%`,
//         String(singleLoomId),
//       ]);

//       if (planRows.length === 0) {
//         throw new Error(`No production planning found for loom ${singleLoomId}`);
//       }

//       const { orderid: orderId, productionperdayloom: dailyTarget = 0 } = planRows[0];

//       const efficiency =
//         dailyTarget > 0
//           ? Number(((thisLoomProduction / dailyTarget) * 100).toFixed(1))
//           : 0;

//       const { rows: existing } = await client.query(
//         `
//         SELECT id, actualproduction 
//         FROM loomweaverproduction
//         WHERE loomid = $1 AND DATE(createdat) = $2
//       `,
//         [singleLoomId, date]
//       );

//       let result;
//       let isUpdate = false;
//       let diff = 0;

//       if (existing.length > 0) {
//         isUpdate = true;
//         const oldProd = Number(existing[0].actualproduction || 0);
//         diff = thisLoomProduction - oldProd;

//         result = await client.query(
//           `
//           UPDATE loomweaverproduction SET
//             actualproduction = $1,
//             efficiency = $2,
//             shifthours = $3,
//             downtime = $4,
//             downtimereason = $5,
//             qualityissues = $6,
//             additionalremarks = $7,
//             updatedat = NOW(),
//             updatedby = $8
//           WHERE id = $9
//           RETURNING *
//         `,
//           [
//             thisLoomProduction,
//             efficiency,
//             shiftHours || null,
//             downtime || null,
//             downtimeReason || null,
//             qualityIssues || null,
//             additionalRemarks || null,
//             createdBy,
//             existing[0].id,
//           ]
//         );
//       } else {
//         diff = thisLoomProduction;

//         result = await client.query(
//           `
//           INSERT INTO loomweaverproduction (
//             id, loomid, weaverid, actualproduction, efficiency,
//             shifthours, downtime, downtimereason, qualityissues,
//             additionalremarks, createdat, createdby
//           ) VALUES (
//             gen_random_uuid(), $1, $2, $3, $4,
//             $5, $6, $7, $8, $9, $10::date, $11
//           )
//           RETURNING *
//         `,
//           [
//             singleLoomId,
//             weaverId || null,
//             thisLoomProduction,
//             efficiency,
//             shiftHours || null,
//             downtime || null,
//             downtimeReason || null,
//             qualityIssues || null,
//             additionalRemarks || null,
//             date,
//             createdBy,
//           ]
//         );
//       }

//       // Update orders.actualproduction
//       if (diff !== 0) {
//         await client.query(
//           `
//           UPDATE orders
//           SET actualproduction = COALESCE(actualproduction, 0) + $1
//           WHERE id = $2
//         `,
//           [diff, orderId]
//         );

//         updatedOrderIds.add(orderId); // Mark this order for progress update
//       }

//       output.push({
//         loomId: singleLoomId,
//         orderId,
//         actualProduction: thisLoomProduction,
//         efficiency,
//         action: isUpdate ? "updated" : "inserted",
//         data: result.rows[0],
//       });
//     }

//     // === NEW LOGIC: Update productionprogress in productionplanning ===
//    for (const orderId of updatedOrderIds) {
//       // Fetch current actual and target quantity from orders table
//       const { rows: orderRows } = await client.query(
//         `SELECT 
//            COALESCE(actualproduction, 0) AS actualproduction, 
//            COALESCE(tobeproduced, 0) AS tobeproduced 
//          FROM orders 
//          WHERE id = $1`,
//         [orderId]
//       );

//       if (orderRows.length === 0) continue;

//       const { actualproduction, tobeproduced } = orderRows[0];

//       let productionProgress = 0;

//       if (tobeproduced > 0) {
//         const rawPercentage = (actualproduction / tobeproduced) * 100;
//         // Cap at 100% and round to 1 decimal
//         productionProgress = Math.min(100, Number(rawPercentage.toFixed(1)));
//       }
//       // If tobeproduced is 0, progress remains 0 (or you can set to 100 if needed)

//       // Update productionplanning with the correct progress percentage
//       const updatePlanningResult = await client.query(
//         `
//         UPDATE productionplanning
//         SET productionprogress = $1,
//             updateddate = NOW()
//         WHERE orderid = $2
//         RETURNING id, productionprogress
//       `,
//         [productionProgress, orderId]
//       );

//       // Optional: log if no planning row was updated (safety check)
//       if (updatePlanningResult.rowCount === 0) {
//         console.warn(`No productionplanning row found for orderId: ${orderId}`);
//       }
//     }

//     await client.query("COMMIT");

//     return res.status(200).json({
//       message: "Production processed successfully",
//       results: output,
//       updatedPlanningCount: updatedOrderIds.size,
//     });
//   } catch (err) {
//     await client.query("ROLLBACK");
//     console.error("updateProduction error:", err);
//     return res.status(500).json({
//       error: "Server error",
//       details: err.message,
//     });
//   } finally {
//     client.release();
//   }
// };


// const updateProduction = async (req, res) => {
//   const {
//     loomId,
//     weaverId,
//     actualProduction,
//     loomWiseProduction,
//     shiftHours,
//     downtime,
//     downtimeReason,
//     qualityIssues,
//     additionalRemarks,
//     createdBy,
//     date,
//   } = req.body;

//   if (!loomId && !weaverId) {
//     return res.status(400).json({
//       error: "You must provide either loomId or weaverId",
//     });
//   }

//   const client = await pool.connect();

//   try {
//     await client.query("BEGIN");

//     let loomIds = [];

//     if (Array.isArray(loomId)) {
//       loomIds = loomId;
//     } else if (loomId) {
//       loomIds = [loomId];
//     } else if (weaverId) {
//       const { rows } = await client.query(
//         `SELECT id FROM loom WHERE assignedweaverid = $1`,
//         [weaverId]
//       );
//       if (rows.length === 0) {
//         return res.status(404).json({ error: "No loom found for this weaver" });
//       }
//       loomIds = rows.map((r) => r.id);
//     }

//     if (loomIds.length === 0) {
//       return res.status(400).json({ error: "No valid loom IDs found" });
//     }

//     const output = [];
//     const updatedOrderIds = new Set(); // Track unique orders

//     for (const singleLoomId of loomIds) {
      
//       const thisLoomProduction =
//         loomWiseProduction && typeof loomWiseProduction === "object"
//           ? Number(loomWiseProduction[singleLoomId]) || 0
//           : Number(actualProduction) || 0;

//       if (thisLoomProduction === 0 && loomWiseProduction) continue;

//       const planQuery = `
//         SELECT orderid, productionperdayloom
//         FROM productionplanning
//         WHERE loomsselected::text LIKE $1 OR loomsselected::jsonb ? $2
//         LIMIT 1
//       `;

//       const { rows: planRows } = await client.query(planQuery, [
//         `%${singleLoomId}%`,
//         String(singleLoomId),
//       ]);

//       if (planRows.length === 0) {
//         throw new Error(`No production planning found for loom ${singleLoomId}`);
//       }

//       const { orderid: orderId, productionperdayloom: dailyTarget = 0 } = planRows[0];

//       const efficiency =
//         dailyTarget > 0
//           ? Number(((thisLoomProduction / dailyTarget) * 100).toFixed(1))
//           : 0;

//       const { rows: existing } = await client.query(
//         `
//         SELECT id, actualproduction 
//         FROM loomweaverproduction
//         WHERE loomid = $1 AND DATE(createdat) = $2
//       `,
//         [singleLoomId, date]
//       );

//       let result;
//       let isUpdate = false;
//       let diff = 0;

//       if (existing.length > 0) {
//         isUpdate = true;
//         const oldProd = Number(existing[0].actualproduction || 0);
//         diff = thisLoomProduction - oldProd;

//         result = await client.query(
//           `
//           UPDATE loomweaverproduction SET
//             actualproduction = $1,
//             efficiency = $2,
//             shifthours = $3,
//             downtime = $4,
//             downtimereason = $5,
//             qualityissues = $6,
//             additionalremarks = $7,
//             updatedat = NOW(),
//             updatedby = $8
//           WHERE id = $9
//           RETURNING *
//         `,
//           [
//             thisLoomProduction,
//             efficiency,
//             shiftHours || null,
//             downtime || null,
//             downtimeReason || null,
//             qualityIssues || null,
//             additionalRemarks || null,
//             createdBy,
//             existing[0].id,
//           ]
//         );
//       } else {
//         diff = thisLoomProduction;

//         result = await client.query(
//           `
//           INSERT INTO loomweaverproduction (
//             id, loomid, weaverid, actualproduction, efficiency,
//             shifthours, downtime, downtimereason, qualityissues,
//             additionalremarks, createdat, createdby
//           ) VALUES (
//             gen_random_uuid(), $1, $2, $3, $4,
//             $5, $6, $7, $8, $9, $10::date, $11
//           )
//           RETURNING *
//         `,
//           [
//             singleLoomId,
//             weaverId || null,
//             thisLoomProduction,
//             efficiency,
//             shiftHours || null,
//             downtime || null,
//             downtimeReason || null,
//             qualityIssues || null,
//             additionalRemarks || null,
//             date,
//             createdBy,
//           ]
//         );
//       }

//       // Update orders.actualproduction
//       if (diff !== 0) {
//         await client.query(
//           `
//           UPDATE orders
//           SET actualproduction = COALESCE(actualproduction, 0) + $1
//           WHERE id = $2
//         `,
//           [diff, orderId]
//         );

//         updatedOrderIds.add(orderId);
//       }

//       output.push({
//         loomId: singleLoomId,
//         orderId,
//         actualProduction: thisLoomProduction,
//         efficiency,
//         action: isUpdate ? "updated" : "inserted",
//         data: result.rows[0],
//       });
//     }

//     // === Update productionprogress in productionplanning ===
//     for (const orderId of updatedOrderIds) {
//       const { rows: orderRows } = await client.query(
//         `SELECT 
//            COALESCE(actualproduction, 0) AS actualproduction, 
//            COALESCE(tobeproduced, 0) AS tobeproduced 
//          FROM orders 
//          WHERE id = $1`,
//         [orderId]
//       );

//       if (orderRows.length === 0) continue;

//       const { actualproduction, tobeproduced } = orderRows[0];

//       let productionProgress = 0;
//       if (tobeproduced > 0) {
//         const rawPercentage = (actualproduction / tobeproduced) * 100;
//         productionProgress = Math.min(100, Number(rawPercentage.toFixed(1)));
//       }

//       await client.query(
//         `
//         UPDATE productionplanning
//         SET productionprogress = $1,
//             updateddate = NOW()
//         WHERE orderid = $2
//       `,
//         [productionProgress, orderId]
//       );
//     }

//     // === NEW: Auto-create delivery schedules when partialdispatchqty milestone is reached ===
//     let totalAutoCreatedSchedules = 0;

//     for (const orderId of updatedOrderIds) {
//       // Fetch order details including partialdispatchqty and meters calculation
//       const { rows: orderRows } = await client.query(
//         `SELECT 
//            o.tobeproduced,
//            COALESCE(o.actualproduction, 0) AS actualproduction,
//            COALESCE(o.partialdispatchqty, 0) AS partialdispatchqty,
//            o.customername,
//            o.orderdate,
//            o.meters,
//            COALESCE(o.meters, 0) / NULLIF(o.tobeproduced, 0) AS meters_per_unit
//          FROM orders o
//          WHERE o.id = $1`,
//         [orderId]
//       );

//       if (orderRows.length === 0) continue;
//       const order = orderRows[0];

//       // Skip if partial dispatch is not configured
//       if (order.partialdispatchqty <= 0) continue;

//       const milestonesReached = Math.floor(order.actualproduction / order.partialdispatchqty);

//       // Count existing delivery schedules for this order
//       const { rows: schedCount } = await client.query(
//         `SELECT COUNT(*) AS count FROM delivery_schedules WHERE order_id = $1`,
//         [orderId]
//       );
//       const existingCount = Number(schedCount[0].count);

//       const schedulesToCreate = milestonesReached - existingCount;
//       if (schedulesToCreate <= 0) continue;

//       totalAutoCreatedSchedules += schedulesToCreate;

//       // Get currently assigned weavers from production planning
//       const { rows: planningRows } = await client.query(
//         `SELECT loomsselected FROM productionplanning WHERE orderid = $1`,
//         [orderId]
//       );

//       let assignedWeavers = [];
//       if (planningRows.length > 0 && planningRows[0].loomsselected) {
//         const loomsSelected = planningRows[0].loomsselected;

//         if (Array.isArray(loomsSelected)) {
//           const { rows: weaverRows } = await client.query(
//             `SELECT DISTINCT assignedweaverid AS weaver_id, weavername 
//              FROM loom 
//              WHERE id = ANY($1::uuid[]) AND assignedweaverid IS NOT NULL`,
//             [loomsSelected]
//           );
//           assignedWeavers = weaverRows;
//         }
//         // If loomsselected is stored as text or other format, add handling here if needed
//       }

//       // Create the missing delivery schedules
//       for (let i = 1; i <= schedulesToCreate; i++) {
//         const scheduleId = uuidv4();
//         const now = new Date();
//         const tentativeDeliveryDate = new Date(now);
//         tentativeDeliveryDate.setDate(now.getDate() + 7); // 7 days ahead – change as per your business rule

//         const partialQty = order.partialdispatchqty;
//         const partialMeters = partialQty * (order.meters_per_unit || 0);

//         const remarks = `Auto-generated partial dispatch #${existingCount + i} (${partialQty} units)`;

//         // Insert into delivery_schedules
//         await client.query(
//           `INSERT INTO delivery_schedules
//            (id, order_id, customer, order_date, delivery_date,
//             total_fabric_meters, total_warp_meters, status, remarks, created_date, updated_date)
//            VALUES ($1, $2, $3, $4, $5, $6, $7, 'planned', $8, $9, $9)`,
//           [
//             scheduleId,
//             orderId,
//             order.customername,
//             order.orderdate,
//             tentativeDeliveryDate,
//             partialMeters || 0,
//             0, // total_warp_meters – update if you have this data
//             remarks,
//             now,
//           ]
//         );

//         // Distribute evenly across current weavers (if any)
//         if (assignedWeavers.length > 0) {
//           const metersPerWeaver = partialMeters / assignedWeavers.length || 0;

//           for (const w of assignedWeavers) {
//             const waId = uuidv4();

//             await client.query(
//               `INSERT INTO weaver_allocations
//                (id, schedule_id, weaver_id, weaver_name, planned_meters)
//                VALUES ($1, $2, $3, $4, $5)`,
//               [
//                 waId,
//                 scheduleId,
//                 w.weaver_id,
//                 w.weavername,
//                 metersPerWeaver,
//               ]
//             );

//             // Optional: You can auto-generate daily_schedule entries here if needed
//           }
//         }
//       }

//       console.log(`Auto-created ${schedulesToCreate} delivery schedule(s) for order ${orderId}`);
//     }

//     await client.query("COMMIT");

//     return res.status(200).json({
//       message: "Production processed successfully",
//       results: output,
//       updatedPlanningCount: updatedOrderIds.size,
//       autoCreatedDeliverySchedules: totalAutoCreatedSchedules,
//     });
//   } catch (err) {
//     await client.query("ROLLBACK");
//     console.error("updateProduction error:", err);
//     return res.status(500).json({
//       error: "Server error",
//       details: err.message,
//     });
//   } finally {
//     client.release();
//   }
// };

const updateProduction = async (req, res) => {
  const {
    loomId,
    weaverId,
    actualProduction,
    loomWiseProduction,
    shiftHours,
    downtime,
    downtimeReason,
    qualityIssues,
    additionalRemarks,
    createdBy,
    date,
  } = req.body;

  if (!loomId && !weaverId) {
    return res.status(400).json({
      error: "You must provide either loomId or weaverId",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let loomIds = [];
    if (Array.isArray(loomId)) {
      loomIds = loomId;
    } else if (loomId) {
      loomIds = [loomId];
    } else if (weaverId) {
      const { rows } = await client.query(
        `SELECT id FROM loom WHERE assignedweaverid = $1`,
        [weaverId]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: "No loom found for this weaver" });
      }
      loomIds = rows.map((r) => r.id);
    }

    if (loomIds.length === 0) {
      return res.status(400).json({ error: "No valid loom IDs found" });
    }

    const output = [];
    const updatedOrderIds = new Set();
    let totalAutoCreatedSchedules = 0;

    for (const singleLoomId of loomIds) {
      const thisLoomProduction =
        loomWiseProduction && typeof loomWiseProduction === "object"
          ? Number(loomWiseProduction[singleLoomId]) || 0
          : Number(actualProduction) || 0;

      if (thisLoomProduction === 0 && loomWiseProduction) continue;

      const { rows: planRows } = await client.query(
        `
        SELECT orderid, productionperdayloom
        FROM productionplanning
        WHERE loomsselected::text LIKE $1 OR loomsselected::jsonb ? $2
        LIMIT 1
        `,
        [`%${singleLoomId}%`, String(singleLoomId)]
      );

      if (planRows.length === 0) {
        throw new Error(`No production planning found for loom ${singleLoomId}`);
      }

      const { orderid: orderId, productionperdayloom: dailyTarget = 0 } = planRows[0];
      const efficiency = dailyTarget > 0 ? Number(((thisLoomProduction / dailyTarget) * 100).toFixed(1)) : 0;

      const { rows: existing } = await client.query(
        `
        SELECT id, actualproduction
        FROM loomweaverproduction
        WHERE loomid = $1 AND DATE(createdat) = $2
        `,
        [singleLoomId, date]
      );

      let result;
      let isUpdate = false;
      let diff = 0;

      if (existing.length > 0) {
        isUpdate = true;
        const oldProd = Number(existing[0].actualproduction || 0);
        diff = thisLoomProduction - oldProd;

        result = await client.query(
          `
          UPDATE loomweaverproduction
          SET actualproduction = $1, efficiency = $2, shifthours = $3,
              downtime = $4, downtimereason = $5, qualityissues = $6,
              additionalremarks = $7, updatedat = NOW(), updatedby = $8
          WHERE id = $9 RETURNING *
          `,
          [
            thisLoomProduction,
            efficiency,
            shiftHours || null,
            downtime || null,
            downtimeReason || null,
            qualityIssues || null,
            additionalRemarks || null,
            createdBy,
            existing[0].id,
          ]
        );
      } else {
        diff = thisLoomProduction;
        result = await client.query(
          `
          INSERT INTO loomweaverproduction (
            id, loomid, weaverid, actualproduction, efficiency,
            shifthours, downtime, downtimereason, qualityissues,
            additionalremarks, createdat, createdby
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11
          ) RETURNING *
          `,
          [
            singleLoomId,
            weaverId || null,
            thisLoomProduction,
            efficiency,
            shiftHours || null,
            downtime || null,
            downtimeReason || null,
            qualityIssues || null,
            additionalRemarks || null,
            date,
            createdBy,
          ]
        );
      }

      if (diff !== 0) {
        await client.query(
          `UPDATE orders SET actualproduction = COALESCE(actualproduction, 0) + $1 WHERE id = $2`,
          [diff, orderId]
        );
        updatedOrderIds.add(orderId);
      }

      // === daily_schedule: Safe Insert or Update (no ON CONFLICT) ===
      const productionDate = new Date(date);
      const isWeekend = productionDate.getDay() === 0 || productionDate.getDay() === 6;

      const { rows: cumRows } = await client.query(
        `SELECT COALESCE(SUM(actualproduction), 0) AS total
         FROM loomweaverproduction
         WHERE loomid = $1 AND DATE(createdat) <= $2`,
        [singleLoomId, date]
      );
      const cumulativeTotal = Number(cumRows[0].total);

      const { rows: existingDaily } = await client.query(
        `SELECT id FROM daily_schedule WHERE loom_id = $1 AND date = $2`,
        [singleLoomId, date]
      );

      if (existingDaily.length > 0) {
        // Update existing daily_schedule
        await client.query(
          `
          UPDATE daily_schedule
          SET planned_production = $1,
              actual_production = $2,
              is_weekend = $3,
              cumulative_total = $4,
              order_id = $5
          WHERE loom_id = $6 AND date = $7
          `,
          [
            Number(dailyTarget) || 0,
            thisLoomProduction,
            isWeekend,
            cumulativeTotal,
            orderId,
            singleLoomId,
            date,
          ]
        );
      } else {
        // Insert new daily_schedule
        await client.query(
          `
          INSERT INTO daily_schedule (
            id, weaver_allocation_id, loom_id, order_id, date,
            planned_production, actual_production, is_weekend, cumulative_total
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            uuidv4(),
            null,
            singleLoomId,
            orderId,
            date,
            Number(dailyTarget) || 0,
            thisLoomProduction,
            isWeekend,
            cumulativeTotal,
          ]
        );
      }

      output.push({
        loomId: singleLoomId,
        orderId,
        actualProduction: thisLoomProduction,
        efficiency,
        action: isUpdate ? "updated" : "inserted",
        data: result.rows[0],
      });
    }

    // Update production progress
    for (const orderId of updatedOrderIds) {
      const { rows: orderRows } = await client.query(
        `SELECT COALESCE(actualproduction, 0) AS actualproduction,
                COALESCE(tobeproduced, 0) AS tobeproduced
         FROM orders WHERE id = $1`,
        [orderId]
      );
      if (orderRows.length === 0) continue;
      const { actualproduction, tobeproduced } = orderRows[0];
      const productionProgress = tobeproduced > 0
        ? Math.min(100, Number(((actualproduction / tobeproduced) * 100).toFixed(1)))
        : 0;

      await client.query(
        `UPDATE productionplanning SET productionprogress = $1, updateddate = NOW() WHERE orderid = $2`,
        [productionProgress, orderId]
      );
    }

    // Auto-create delivery schedules (unchanged)
    for (const orderId of updatedOrderIds) {
      const { rows: orderRows } = await client.query(
        `
        SELECT o.tobeproduced, COALESCE(o.actualproduction, 0) AS actualproduction,
               COALESCE(o.partialdispatchqty, 0) AS partialdispatchqty,
               o.customername, o.orderdate, o.meters,
               COALESCE(o.meters, 0) / NULLIF(o.tobeproduced, 0) AS meters_per_unit
        FROM orders o WHERE o.id = $1
        `,
        [orderId]
      );
      if (orderRows.length === 0 || orderRows[0].partialdispatchqty <= 0) continue;

      const order = orderRows[0];
      const milestonesReached = Math.floor(order.actualproduction / order.partialdispatchqty);
      const { rows: schedCount } = await client.query(
        `SELECT COUNT(*) AS count FROM delivery_schedules WHERE order_id = $1`,
        [orderId]
      );
      const existingCount = Number(schedCount[0].count);
      const schedulesToCreate = milestonesReached - existingCount;
      if (schedulesToCreate <= 0) continue;

      totalAutoCreatedSchedules += schedulesToCreate;

      const { rows: planningRows } = await client.query(
        `SELECT loomsselected FROM productionplanning WHERE orderid = $1`,
        [orderId]
      );
      let assignedWeavers = [];
      if (planningRows.length > 0 && planningRows[0].loomsselected) {
        const loomsSelected = planningRows[0].loomsselected;
        if (Array.isArray(loomsSelected)) {
          const { rows: weaverRows } = await client.query(
            `SELECT DISTINCT assignedweaverid AS weaver_id, weavername
             FROM loom WHERE id = ANY($1::uuid[]) AND assignedweaverid IS NOT NULL`,
            [loomsSelected]
          );
          assignedWeavers = weaverRows;
        }
      }

      for (let i = 1; i <= schedulesToCreate; i++) {
        const scheduleId = uuidv4();
        const now = new Date();
        const tentativeDeliveryDate = new Date(now);
        tentativeDeliveryDate.setDate(now.getDate() + 7);
        const partialQty = order.partialdispatchqty;
        const partialMeters = partialQty * (order.meters_per_unit || 0);
        const remarks = `Auto-generated partial dispatch #${existingCount + i} (${partialQty} units)`;

        await client.query(
          `
          INSERT INTO delivery_schedules
          (id, order_id, customer, order_date, delivery_date, total_fabric_meters,
           total_warp_meters, status, remarks, created_date, updated_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'planned', $8, $9, $9)
          `,
          [
            scheduleId, orderId, order.customername, order.orderdate,
            tentativeDeliveryDate, partialMeters || 0, 0, remarks, now
          ]
        );

        if (assignedWeavers.length > 0) {
          const metersPerWeaver = partialMeters / assignedWeavers.length || 0;
          for (const w of assignedWeavers) {
            await client.query(
              `INSERT INTO weaver_allocations (id, schedule_id, weaver_id, weaver_name, planned_meters)
               VALUES ($1, $2, $3, $4, $5)`,
              [uuidv4(), scheduleId, w.weaver_id, w.weavername, metersPerWeaver]
            );
          }
        }
      }
    }

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Production processed successfully",
      results: output,
      updatedPlanningCount: updatedOrderIds.size,
      autoCreatedDeliverySchedules: totalAutoCreatedSchedules,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("updateProduction error:", err);
    return res.status(500).json({
      error: "Server error",
      details: err.message,
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getDailyProduction,
  updateProduction,
  getWeeklyTrend,
  getMonthlyTrend
};
