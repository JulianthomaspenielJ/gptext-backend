const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid"); // ← ADD THIS

const createDeliverySchedule = async (req, res) => {
  const client = await pool.connect();

  try {
    const schedule = req.body;

    // Validation (basic)
    if (!schedule.orderId || !schedule.deliveryDate || !schedule.weaverAllocations?.length) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const scheduleId = uuidv4();
    const now = new Date().toISOString(); // Consistent ISO string

    await client.query("BEGIN");

    // 1️⃣ Insert into delivery_schedules
    // Assuming your table has: status VARCHAR DEFAULT 'planned'
    await client.query(
      `INSERT INTO delivery_schedules
      (id, order_id, customer, order_date, delivery_date,
       total_fabric_meters, total_warp_meters, status, remarks, created_date, updated_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
      [
        scheduleId,
        schedule.orderId,
        schedule.customer,
        schedule.orderDate,
        schedule.deliveryDate,
        schedule.totalFabricMeters,
        schedule.totalWarpMeters,
        schedule.status || "planned", // ← Add status
        schedule.remarks || null,
        now,
      ]
    );

    // 2️⃣ Insert weaver allocations + daily schedules
    for (const wa of schedule.weaverAllocations) {
      const waId = uuidv4();

      await client.query(
        `INSERT INTO weaver_allocations
         (id, schedule_id, weaver_id, weaver_name, planned_meters)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          waId,
          scheduleId,
          wa.weaverId,
          wa.weaverName,
          wa.plannedMeters
        ]
      );

      // 3️⃣ Insert daily schedules (only if provided)
      if (wa.dailySchedule && Array.isArray(wa.dailySchedule)) {
        for (const  day of wa.dailySchedule) {
          await client.query(
            `INSERT INTO daily_schedule
            (id, weaver_allocation_id, date, planned_production, actual_production, is_weekend, cumulative_total)
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              uuidv4(),
              waId,
              day.date,
              day.plannedProduction || 0,
              schedule.actualProduction || null, // in case you add later
              day.isWeekend || false,
              day.cumulativeTotal || null
            ]
          );
        }
      }
    }

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      id: scheduleId,
      message: "Delivery schedule created successfully"
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating delivery schedule:", error);
    return res.status(500).json({ 
      error: "Failed to create schedule",
      details: error.message 
    });
  } finally {
    client.release();
  }
};

// GET /api/deliveryschedule/list
const getAllDeliverySchedules = async (req, res) => {
  const client = await pool.connect();
  try {
    // 1. Fetch all schedules
    const scheduleResult = await client.query(`
      SELECT *
      FROM delivery_schedules
      ORDER BY created_date DESC
    `);

    const schedules = scheduleResult.rows;

    // Extract all schedule IDs
    const scheduleIds = schedules.map(s => s.id);
    if (scheduleIds.length === 0) {
      return res.json({ stats: {}, schedules: [] });
    }

    // 2. Fetch all weaver allocations for these schedules
    const allocResult = await client.query(
      `
      SELECT 
        id,
        schedule_id,
        weaver_id AS "weaverId",
        weaver_name AS "weaverName",
        planned_meters AS "plannedMeters"
      FROM weaver_allocations
      WHERE schedule_id = ANY($1)
      `,
      [scheduleIds]
    );

    const allocations = allocResult.rows;

    // Extract allocation IDs
    const allocationIds = allocations.map(a => a.id);

    // 3. Fetch all daily schedules for these allocations
    let dailySchedules = [];
    if (allocationIds.length > 0) {
      const dailyResult = await client.query(
        `
        SELECT 
          id,
          weaver_allocation_id,
          date::text AS date,
          planned_production AS "plannedProduction",
          actual_production AS "actualProduction",
          is_weekend AS "isWeekend",
          cumulative_total AS "cumulativeTotal"
        FROM daily_schedule
        WHERE weaver_allocation_id = ANY($1)
        ORDER BY date
        `,
        [allocationIds]
      );

      dailySchedules = dailyResult.rows;
    }

    // 4. Attach daily schedules → allocations
    const allocMap = {};
    allocations.forEach(a => {
      allocMap[a.id] = { ...a, dailySchedule: [] };
    });

    dailySchedules.forEach(d => {
      if (allocMap[d.weaver_allocation_id]) {
        allocMap[d.weaver_allocation_id].dailySchedule.push(d);
      }
    });

    // 5. Attach allocations → schedules
    const scheduleMap = {};
    schedules.forEach(s => {
      scheduleMap[s.id] = { ...s, weaverAllocations: [] };
    });

    Object.values(allocMap).forEach(a => {
      if (scheduleMap[a.schedule_id]) {
        scheduleMap[a.schedule_id].weaverAllocations.push(a);
      }
    });

    const finalSchedules = Object.values(scheduleMap);

    // 6. Calculate stats
    const stats = {
      totalSchedules: finalSchedules.length,
      inProgress: finalSchedules.filter(s => s.status === "in-progress").length,
      planned: finalSchedules.filter(s => s.status === "planned").length,
      completed: finalSchedules.filter(s => s.status === "completed").length,
      delayed: finalSchedules.filter(s => s.status === "delayed").length,
    };

    // 7. Response
    res.json({
      stats,
      schedules: finalSchedules
    });

  } catch (error) {
    console.error("Error fetching delivery schedules:", error);
    res.status(500).json({ error: "Failed to fetch delivery schedules" });
  } finally {
    client.release();
  }
};

// const getDeliveryScheduleById = async (req, res) => {
//   const { scheduleId } = req.params;  // Assume you're passing scheduleId as a URL parameter
//   const client = await pool.connect();
//   try {
//     // 1. Fetch the schedule by id
//     const scheduleResult = await client.query(`
//       SELECT *
//       FROM delivery_schedules
//       WHERE id = $1
//     `, [scheduleId]);

//     const schedule = scheduleResult.rows[0];

//     if (!schedule) {
//       return res.status(404).json({ error: "Schedule not found" });
//     }

//     // 2. Fetch all weaver allocations for this schedule
//     const allocResult = await client.query(`
//       SELECT 
//         id,
//         schedule_id,
//         weaver_id AS "weaverId",
//         weaver_name AS "weaverName",
//         planned_meters AS "plannedMeters"
//       FROM weaver_allocations
//       WHERE schedule_id = $1
//     `, [scheduleId]);

//     const allocations = allocResult.rows;

//     // 3. Fetch all daily schedules for these allocations
//     let dailySchedules = [];
//     if (allocations.length > 0) {
//       const allocationIds = allocations.map(a => a.id);
//       const dailyResult = await client.query(`
//         SELECT 
//           id,
//           weaver_allocation_id,
//           date::text AS date,
//           planned_production AS "plannedProduction",
//           actual_production AS "actualProduction",
//           is_weekend AS "isWeekend",
//           cumulative_total AS "cumulativeTotal"
//         FROM daily_schedule
//         WHERE weaver_allocation_id = ANY($1)
//         ORDER BY date
//       `, [allocationIds]);

//       dailySchedules = dailyResult.rows;
//     }

//     // 4. Attach daily schedules to allocations
//     const allocMap = {};
//     allocations.forEach(a => {
//       allocMap[a.id] = { ...a, dailySchedule: [] };
//     });

//     dailySchedules.forEach(d => {
//       if (allocMap[d.weaver_allocation_id]) {
//         allocMap[d.weaver_allocation_id].dailySchedule.push(d);
//       }
//     });

//     // 5. Attach allocations to the schedule
//     schedule.weaverAllocations = allocations.map(a => allocMap[a.id]);

//     // 6. Calculate stats (you could skip this part if not needed for a single schedule)
//     const stats = {
//       totalAllocations: schedule.weaverAllocations.length,
//       inProgress: schedule.weaverAllocations.filter(a => a.status === "in-progress").length,
//       planned: schedule.weaverAllocations.filter(a => a.status === "planned").length,
//       completed: schedule.weaverAllocations.filter(a => a.status === "completed").length,
//       delayed: schedule.weaverAllocations.filter(a => a.status === "delayed").length,
//     };

//     // 7. Return the schedule and stats
//     res.json({
//       stats,
//       schedule
//     });

//   } catch (error) {
//     console.error("Error fetching delivery schedule by id:", error);
//     res.status(500).json({ error: "Failed to fetch delivery schedule" });
//   } finally {
//     client.release();
//   }
// };

const getDeliveryScheduleById = async (req, res) => {
  const { scheduleId } = req.params;
  const client = await pool.connect();

  try {
    // 1. Fetch delivery schedule
    const scheduleResult = await client.query(`
      SELECT *
      FROM delivery_schedules
      WHERE id = $1
    `, [scheduleId]);

    const schedule = scheduleResult.rows[0];

    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    // 🔑 Extract order_id
    const { order_id } = schedule;

    // 2. Fetch weaver allocations (unchanged)
    const allocResult = await client.query(`
      SELECT
        id,
        schedule_id,
        weaver_id AS "weaverId",
        weaver_name AS "weaverName",
        planned_meters AS "plannedMeters",
        status
      FROM weaver_allocations
      WHERE schedule_id = $1
    `, [scheduleId]);

    const allocations = allocResult.rows;

    // 3. Fetch daily_schedule by order_id ✅
    const dailyResult = await client.query(`
      SELECT
        id,
        order_id AS "orderId",
        date::text AS date,
        planned_production AS "plannedProduction",
        actual_production AS "actualProduction",
        is_weekend AS "isWeekend",
        cumulative_total AS "cumulativeTotal"
      FROM daily_schedule
      WHERE order_id = $1
      ORDER BY date
    `, [order_id]);

    const dailySchedules = dailyResult.rows;

    // 4. Attach data
    schedule.weaverAllocations = allocations;
    schedule.dailySchedule = dailySchedules;

    // 5. Stats (optional)
    const stats = {
      totalAllocations: allocations.length,
      inProgress: allocations.filter(a => a.status === "in-progress").length,
      planned: allocations.filter(a => a.status === "planned").length,
      completed: allocations.filter(a => a.status === "completed").length,
      delayed: allocations.filter(a => a.status === "delayed").length,
    };

    // 6. Response
    res.json({
      stats,
      schedule
    });

  } catch (error) {
    console.error("Error fetching delivery schedule by id:", error);
    res.status(500).json({ error: "Failed to fetch delivery schedule" });
  } finally {
    client.release();
  }
};


const updateDeliverySchedule = async (req, res) => {
  const { scheduleId } = req.params; // Assuming route: PUT /api/deliveryschedule/:scheduleId
  const updates = req.body; // Expect same structure as create, but partial
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Check if schedule exists
    const scheduleCheck = await client.query(
      `SELECT id FROM delivery_schedules WHERE id = $1`,
      [scheduleId]
    );

    if (scheduleCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Delivery schedule not found" });
    }

    const now = new Date().toISOString();

    // 2. Update main delivery_schedules fields (only if provided)
    const updatableFields = [
      "customer",
      "order_date",
      "delivery_date",
      "total_fabric_meters",
      "total_warp_meters",
      "status",
      "remarks"
    ];

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    updatableFields.forEach(field => {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = $${paramIndex}`);
        values.push(updates[field]);
        paramIndex++;
      }
    });

    // Always update updated_date
    setClauses.push(`updated_date = $${paramIndex}`);
    values.push(now);
    paramIndex++;

    if (setClauses.length > 1) { // >1 because updated_date is always there
      values.push(scheduleId); // for WHERE clause
      await client.query(
        `UPDATE delivery_schedules SET ${setClauses.join(", ")} WHERE id = $${paramIndex}`,
        values
      );
    }

    // 3. Handle weaver allocations (full replace strategy - safer and simpler)
    if (updates.weaverAllocations && Array.isArray(updates.weaverAllocations)) {
      // Delete existing allocations and daily schedules (cascade if you have FK)
      await client.query(
        `DELETE FROM daily_schedule WHERE weaver_allocation_id IN (
          SELECT id FROM weaver_allocations WHERE schedule_id = $1
        )`,
        [scheduleId]
      );

      await client.query(
        `DELETE FROM weaver_allocations WHERE schedule_id = $1`,
        [scheduleId]
      );

      // Insert new allocations and daily schedules
      for (const wa of updates.weaverAllocations) {
        const waId = uuidv4();

        await client.query(
          `INSERT INTO weaver_allocations
           (id, schedule_id, weaver_id, weaver_name, planned_meters)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            waId,
            scheduleId,
            wa.weaverId,
            wa.weaverName,
            wa.plannedMeters
          ]
        );

        // Insert daily schedules if provided
        if (wa.dailySchedule && Array.isArray(wa.dailySchedule)) {
          for (const day of wa.dailySchedule) {
            await client.query(
              `INSERT INTO daily_schedule
               (id, weaver_allocation_id, date, planned_production, actual_production, is_weekend, cumulative_total)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                uuidv4(),
                waId,
                day.date,
                day.plannedProduction || 0,
                day.actualProduction || null,
                day.isWeekend || false,
                day.cumulativeTotal || null
              ]
            );
          }
        }
      }
    }

    await client.query("COMMIT");

    return res.json({
      success: true,
      id: scheduleId,
      message: "Delivery schedule updated successfully"
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating delivery schedule:", error);
    return res.status(500).json({
      error: "Failed to update delivery schedule",
      details: error.message
    });
  } finally {
    client.release();
  }
};


module.exports = { createDeliverySchedule, getAllDeliverySchedules, getDeliveryScheduleById, updateDeliverySchedule };
