// controllers/createOrder.js
const { v4: uuidv4 } = require("uuid");
const pool = require("../config/db");

// create
const createOrder = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orderData = req.body;

    // Extract main order fields
    const {
      orderDate,
      id,
      progress,
      jobStatus,
      unit,
      quantity,
      priority,
      customer,
      buyerPO,
      meters,
      gsm,
      rate,
      deliveryDate,
      checklist,
      fabric,
      construction1,
      construction2,
      construction3,
      construction4,
      construction5,
      fabricStock,
      toBeProduced,
      partialDispatchQty,
      endsDents,
      warpEndsBeam,
      warpCrimp,
      warpMeterReqd,
      warpYarnCount,
      warpYarnMill,
      reedYarnKgs,
      reedOnLoom,
      reedSpace,
      flangeWidth,
      weftGmsMtr,
      weftYarnCount,
      weftYarnMill,
      weftYarnKgs,
      loomType,
      loomSpeed,
      widthLoom,
      beamLoom,
      productionPerDayLoom,
      availableDays,
      loomsRequired,
      loomsPlanned,
      selectedLooms = [],
      isJobWork = false,
      timeActionPlan = [], // Array of loom-specific plans from frontend
      tasks = [], // Pre-generated tasks from frontend
    } = orderData;

    // 1. Insert into orders table
    const orderQuery = `
      INSERT INTO orders (
        id, customername, buyerponumber, meters, gsm, rate, deliverydate, checklist, fabrictype,
        constructionvalue1, constructionvalue2, constructionvalue3, constructionvalue4, constructionvalue5,
        fabricstock, tobeproduced, endsdents, warpendsbeam, warpcrimp, warpmeterrequired, warpyarncount,
        warpyarnmill, reedyarnkgs, reedonloom, reedspace, flangewidth, weftgmsmtr, weftyarncount,
        weftyarnmill, weftyarnkgs, orderdate, status, progress, unit, quantity, priority, partialdispatchqty, createddate
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,$31,$32, $33, $34, $35, $36, $37, NOW())
      RETURNING id
    `;

    await client.query(orderQuery, [
      id,
      customer || null,
      buyerPO || null,
      parseFloat(meters) || 0,
      parseFloat(gsm) || null,
      parseFloat(rate) || null,
      deliveryDate || null,
      checklist || null,
      fabric || null,
      construction1 || 0,
      construction2 || 0,
      construction3 || 0,
      construction4 || 0,
      construction5 || 0,
      fabricStock || 0,
      parseFloat(toBeProduced) || 0,
      parseFloat(endsDents) || null,
      parseFloat(warpEndsBeam) || null,
      parseFloat(warpCrimp) || null,
      parseFloat(warpMeterReqd) || null,
      warpYarnCount || 0,
      warpYarnMill || null,
      parseFloat(reedYarnKgs) || null,
      parseFloat(reedOnLoom) || null,
      parseFloat(reedSpace) || null,
      parseFloat(flangeWidth) || null,
      parseFloat(weftGmsMtr) || null,
      parseFloat(weftYarnCount) || null,
      weftYarnMill || null,
      parseFloat(weftYarnKgs) || null,
      orderDate || null,
      jobStatus || null,
      progress,
      unit || 0,
      quantity || 0,
      priority || null,
      partialDispatchQty
    ]);

    // 2. Insert into productionplanning table (only if not Job Work or has planning data)
    if (!isJobWork || loomType) {
      const ppQuery = `
        INSERT INTO productionplanning (
          id, orderid, loomtype, loomspeed, loomwidth, loombeam, productionperdayloom,
          availabledays, loomsrequired, loomsplanned, loomsselected, createddate
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      `;

      await client.query(ppQuery, [
        uuidv4(),
        id,
        loomType || null,
        parseFloat(loomSpeed) || null,
        parseFloat(widthLoom) || null,
        parseFloat(beamLoom) || null,
        parseFloat(productionPerDayLoom) || null,
        parseInt(availableDays) || null,
        parseInt(loomsRequired) || null,
        parseInt(loomsPlanned) || null,
        selectedLooms.length > 0 ? JSON.stringify(selectedLooms) : null, // Store as comma-separated string
      ]);
    }

    // 3. Handle Time & Action Plans (only for regular orders)
    if (
      !isJobWork &&
      Array.isArray(timeActionPlan) &&
      timeActionPlan.length > 0
    ) {
      const taQuery = `
        INSERT INTO timeandactionplans (
          id, days, process, orderid, responsible, tastatus, targetdate, actualdate, loomid
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE 
        SET 
          days = EXCLUDED.days,
          process = EXCLUDED.process,
          responsible = EXCLUDED.responsible,
          tastatus = EXCLUDED.tastatus,
          targetdate = EXCLUDED.targetdate,
          actualdate = EXCLUDED.actualdate,
          loomid = EXCLUDED.loomid
      `;

      for (const loomPlan of timeActionPlan) {
        const loomId = loomPlan.loomId; // e.g., "5b1f24fe-d11b-4f85-bfb7-48e469745edd"

        for (const process of loomPlan.processes) {
          // Use the frontend-sent process.id directly!
          const processId = process.id;

          if (!processId) {
            console.warn("Missing process ID, skipping:", process);
            continue;
          }

          await client.query(taQuery, [
            uuidv4(),
            process.days || null,
            process.process || process.name || "Unnamed Process",
            id, // orderid
            process.responsible || null,
            process.status || "Pending",
            process.targetDate || null,
            process.actualDate || null,
            loomId, // ← Save which loom this belongs to
          ]);
        }
      }
    }

    // 4. Insert Tasks (only for regular orders)
    if (!isJobWork && Array.isArray(tasks) && tasks.length > 0) {
      const taskQuery = `
        INSERT INTO task (
          id, relatedorder, tasktitle, description, category, priority, assignedto, duedate, estimatedhours, createddate
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `;

      for (const task of tasks) {
        await client.query(taskQuery, [
          uuidv4(),
          id,
          task.title || task.tasktitle,
          task.description,
          task.category || null,
          task.priority || "Medium",
          task.assignedTo || null,
          task.dueDate || null,
          task.estimatedhours || null,
        ]);
      }
    }

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: isJobWork
        ? "Job Work order created successfully"
        : "Order created with full planning",
      id,
      orderType: isJobWork ? "Job Work" : "Regular Production",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

//update
const updateOrder = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orderData = req.body;
    const { id } = req.params; // PUT /api/orders/:id

    if (!id) {
      throw new Error("Order ID is required for update");
    }

    // Destructure main order fields directly from payload
    const {
      customername,
      buyerponumber,
      checklist,
      fabrictype,
      deliverydate,
      meters,
      gsm,
      rate,
      constructionvalue1,
      constructionvalue2,
      constructionvalue3,
      constructionvalue4,
      constructionvalue5,
      fabricstock,
      tobeproduced,
      endsdents,
      warpendsbeam,
      warpcrimp,
      warpmeterrequired,
      warpyarncount,
      warpyarnmill,
      reedyarnkgs,
      reedonloom,
      reedspace,
      flangewidth,
      weftgmsmtr,
      weftyarncount,
      weftyarnmill,
      weftyarnkgs,
      partialDispatchQty,
      status, // jobStatus equivalent
      productionPlanning = [], // Array of planning objects
      timeAndActionPlans = [], // Array of { loomId, processes[] }
      // tasks = [] // optional, not in sample but can be added later
    } = orderData;

    // 1. Update main orders table
    const orderUpdateQuery = `
      UPDATE orders
      SET 
        customername = $1,
        buyerponumber = $2,
        checklist = $3,
        fabrictype = $4,
        deliverydate = $5,
        meters = $6,
        gsm = $7,
        rate = $8,
        constructionvalue1 = $9,
        constructionvalue2 = $10,
        constructionvalue3 = $11,
        constructionvalue4 = $12,
        constructionvalue5 = $13,
        fabricstock = $14,
        tobeproduced = $15,
        endsdents = $16,
        warpendsbeam = $17,
        warpcrimp = $18,
        warpmeterrequired = $19,
        warpyarncount = $20,
        warpyarnmill = $21,
        reedyarnkgs = $22,
        reedonloom = $23,
        reedspace = $24,
        flangewidth = $25,
        weftgmsmtr = $26,
        weftyarncount = $27,
        weftyarnmill = $28,
        weftyarnkgs = $29,
        partialdispatchqty = $30,
        status = $31,
        updateddate = NOW()
      WHERE id = $32
      RETURNING id
    `;

    const orderResult = await client.query(orderUpdateQuery, [
      customername || null,
      buyerponumber || null,
      checklist || null,
      fabrictype || null,
      deliverydate || null,
      parseFloat(meters) || 0,
      parseFloat(gsm) || null,
      parseFloat(rate) || null,
      constructionvalue1 || 0,
      constructionvalue2 || 0,
      constructionvalue3 || 0,
      constructionvalue4 || 0,
      constructionvalue5 || 0,
      parseFloat(fabricstock) || 0,
      parseFloat(tobeproduced) || 0,
      parseFloat(endsdents) || null,
      parseFloat(warpendsbeam) || null,
      parseFloat(warpcrimp) || null,
      parseFloat(warpmeterrequired) || null,
      warpyarncount || null,
      warpyarnmill || null,
      parseFloat(reedyarnkgs) || null,
      parseFloat(reedonloom) || null,
      parseFloat(reedspace) || null,
      parseFloat(flangewidth) || null,
      parseFloat(weftgmsmtr) || null,
      weftyarncount || null,
      weftyarnmill || null,
      parseFloat(weftyarnkgs) || null,
      parseFloat(partialDispatchQty) || 0,
      status || null,
      id
    ]);

    if (orderResult.rowCount === 0) {
      throw new Error("Order not found");
    }

    // 2. Handle Production Planning (array, possibly multiple, but likely one)
    // Delete existing and re-insert (cleanest approach when full replace)
    await client.query("DELETE FROM productionplanning WHERE orderid = $1", [id]);

    if (Array.isArray(productionPlanning) && productionPlanning.length > 0) {
      const ppQuery = `
        INSERT INTO productionplanning (
          id, orderid, loomtype, loomspeed, loomwidth, loombeam, productionperdayloom,
          availabledays, loomsrequired, loomsplanned, loomsselected, createddate
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      `;

      for (const plan of productionPlanning) {
        const selectedLooms = plan.loomsselected || [];

        await client.query(ppQuery, [
          uuidv4(),
          id,
          plan.loomtype || null,
          parseFloat(plan.loomspeed) || null,
          parseFloat(plan.loomwidth) || null,
          parseFloat(plan.loombeam) || null,
          parseFloat(plan.productionperdayloom) || null,
          parseInt(plan.availabledays) || null,
          parseInt(plan.loomsrequired) || null,
          parseInt(plan.loomsplanned) || null,
          selectedLooms.length > 0 ? JSON.stringify(selectedLooms) : null,
        ]);
      }
    }

    // 3. Handle Time & Action Plans
    // Delete all existing for this order, then insert new ones
    await client.query("DELETE FROM timeandactionplans WHERE orderid = $1", [id]);

    if (Array.isArray(timeAndActionPlans) && timeAndActionPlans.length > 0) {
      const taQuery = `
        INSERT INTO timeandactionplans (
          id, days, process, orderid, responsible, tastatus, targetdate, actualdate, loomid
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;

      for (const loomPlan of timeAndActionPlans) {
        const loomId = loomPlan.loomId;

        if (!Array.isArray(loomPlan.processes)) continue;

        for (const process of loomPlan.processes) {
          // Use the frontend-provided `id` if available, otherwise generate new
          const processId = process.id && process.id.trim() !== '' ? process.id : uuidv4();

          await client.query(taQuery, [
            processId,
            parseInt(process.days) || null,
            process.process || "Unnamed Process",
            id,
            process.responsible || null,
            process.status || "pending",
            process.targetDate || null,
            process.actualDate || null,
            loomId || null,
          ]);
        }
      }
    }

    // Optional: Handle tasks (if you add them later)
    // if (Array.isArray(tasks) && tasks.length > 0) { ... }

    await client.query("COMMIT");

    res.status(200).json({
      success: true,
      message: "Order updated successfully with planning and time & action plans",
      id,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

//list
const getOrdersList = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Fetch all orders
    const ordersResult = await client.query(`
  SELECT 
    id, customername, buyerponumber, constructionvalue1, constructionvalue2, constructionvalue3, constructionvalue4, constructionvalue5, checklist, fabrictype,
    meters, gsm, rate, status, actualproduction, tobeproduced,
    progress,quantity, priority, unit, fabricstock,
    actualproduction, endsdents, warpendsbeam, warpmeterrequired, 
    warpyarncount, warpyarnmill, reedyarnkgs, reedonloom, reedspace, flangewidth, weftgmsmtr, 
    weftyarncount, weftyarnmill, weftyarnkgs,
    TO_CHAR(deliverydate, 'YYYY-MM-DD') AS deliverydate,
    TO_CHAR(orderdate, 'YYYY-MM-DD') AS orderdate,
    TO_CHAR(createddate, 'YYYY-MM-DD HH24:MI:SS') AS createddate,
    TO_CHAR(updateddate, 'YYYY-MM-DD HH24:MI:SS') AS updateddate
  FROM orders
  ORDER BY createddate DESC
`);

    if (ordersResult.rows.length === 0) {
      await client.query("COMMIT");
      return res.status(200).json({
        success: true,
        totalOrders: 0,
        totalPlanning: 0,
        totalInProgress: 0,
        totalOverdue: 0,
        orders: [],
      });
    }

    const orderIds = ordersResult.rows.map((o) => o.id);

    // 2. Summary counts
    const today = new Date().toISOString().split("T")[0];

    const [
      {
        rows: [totalRow],
      },
      {
        rows: [planningRow],
      },
      {
        rows: [inProgressRow],
      },
      {
        rows: [overdueRow],
      },
    ] = await Promise.all([
      client.query(`SELECT COUNT(*) FROM orders`),
      client.query(`SELECT COUNT(*) FROM orders WHERE status = 'Planning'`),
      client.query(`SELECT COUNT(*) FROM orders WHERE status = 'In Progress'`),
      client.query(
        `SELECT COUNT(*) FROM orders WHERE deliverydate < $1 AND status != 'Completed'`,
        [today]
      ),
    ]);

    const totalOrders = Number(totalRow.count);
    const totalPlanning = Number(planningRow.count);
    const totalInProgress = Number(inProgressRow.count);
    const totalOverdue = Number(overdueRow.count);

    // 3. Fetch related data in bulk
    const [productionPlanningResult, timeAndActionPlansResult, tasksResult] =
      await Promise.all([
        client.query(
          `SELECT * FROM productionplanning WHERE orderid = ANY($1)`,
          [orderIds]
        ),
        client.query(
          `SELECT * FROM timeandactionplans WHERE orderid = ANY($1)`,
          [orderIds]
        ),
        client.query(`SELECT * FROM task WHERE relatedorder = ANY($1)`, [
          orderIds,
        ]),
      ]);

    // 4. Collect all loom IDs that are used across all production plans
    const allLoomIds = new Set();
    productionPlanningResult.rows.forEach((pp) => {
      if (pp.loomsselected && Array.isArray(pp.loomsselected)) {
        pp.loomsselected.forEach((id) => allLoomIds.add(String(id)));
      }
    });

    // 5. Fetch full loom details once (if any loom is referenced)
    const loomDetailsMap = {};
    if (allLoomIds.size > 0) {
      const loomResult = await client.query(
        `
  SELECT *
  FROM loom
  WHERE id = ANY($1::text[])
  `,
        [[...allLoomIds]]
      );

      loomResult.rows.forEach((loom) => {
        loomDetailsMap[loom.id] = loom;
      });
    }

    // 6. Build final orders array (same shape as getByOrderId)
    const ordersWithDetails = ordersResult.rows.map((order) => {
      // Production planning for this order
      let productionPlanning = productionPlanningResult.rows
        .filter((pp) => pp.orderid === order.id)
        .map((plan) => {
          // Replace loom IDs with full loom objects
          if (plan.loomsselected && Array.isArray(plan.loomsselected)) {
            const enrichedLooms = plan.loomsselected
              .map((id) => loomDetailsMap[String(id)])
              .filter(Boolean); // in case a loom was deleted
            return { ...plan, loomsselected: enrichedLooms };
          }
          return { ...plan, loomsselected: [] };
        });

      const timeAndActionPlans = timeAndActionPlansResult.rows.filter(
        (ta) => ta.orderid === order.id
      );

      const tasks = tasksResult.rows.filter(
        (task) => task.relatedorder === order.id
      );

      return {
        ...order,
        productionPlanning, // array of plans, each with full loom objects
        timeAndActionPlans,
        tasks,
      };
    });

    await client.query("COMMIT");

    res.status(200).json({
      success: true,
      totalOrders,
      totalPlanning,
      totalInProgress,
      totalOverdue,
      orders: ordersWithDetails, // now identical structure to getByOrderId
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error getting all orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get all orders",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

//get by id
// const getByOrderId = async (req, res) => {
//   const client = await pool.connect();
//   const { orderId } = req.params;

//   try {
//     // Start a transaction
//     await client.query("BEGIN");

//     // Fetch order
//     const orderQuery = `SELECT * FROM orders WHERE id = $1`;
//     const orderResult = await client.query(orderQuery, [orderId]);

//     if (orderResult.rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Order not found",
//       });
//     }

//     const order = orderResult.rows[0];

//     // Fetch production planning
//     const productionPlanningQuery = `
//       SELECT * FROM productionplanning WHERE orderid = $1
//     `;
//     const productionPlanningResult = await client.query(
//       productionPlanningQuery,
//       [orderId]
//     );
//     const productionPlanning = productionPlanningResult.rows;

//     // Enhance production planning with loom details (not just names)
//     // for (let plan of productionPlanning) {
//     //   if (plan.loomsselected && Array.isArray(plan.loomsselected)) {
//     //     const loomIds = plan.loomsselected; // Already an array

//     //     if (loomIds.length > 0) {
//     //       const loomsQuery = `
//     //         SELECT * FROM loom WHERE id = ANY($1::text[])
//     //       `;
//     //       const loomsResult = await client.query(loomsQuery, [
//     //         loomIds.map(String),
//     //       ]);
//     //       // Instead of just the name, include all loom details
//     //       plan.loomsselected = loomsResult.rows; // Contains all loom data
//     //     } else {
//     //       plan.loomsselected = [];
//     //     }
//     //   } else {
//     //     plan.loomsselected = [];
//     //   }
//     // }
// // Enhance production planning with loom details
// for (let plan of productionPlanning) {
//   if (plan.loomsselected) {
//     // Parse if it's a string (safety), otherwise assume it's already an object/array
//     let selectedLooms = plan.loomsselected;

//     if (typeof selectedLooms === 'string') {
//       try {
//         selectedLooms = JSON.parse(selectedLooms);
//       } catch (e) {
//         console.warn("Failed to parse loomsselected JSON:", selectedLooms);
//         selectedLooms = [];
//       }
//     }

//     // Ensure it's an array
//     if (!Array.isArray(selectedLooms)) {
//       selectedLooms = [];
//     }

//     // Since we already stored full loom objects, just use them!
//     plan.loomsselected = selectedLooms;
//   } else {
//     plan.loomsselected = [];
//   }
// }
//     // Fetch time and action plans
//     const timeAndActionPlansQuery = `
//       SELECT * FROM timeandactionplans WHERE orderid = $1
//     `;
//     const timeAndActionPlansResult = await client.query(
//       timeAndActionPlansQuery,
//       [orderId]
//     );

//     // Fetch tasks
//     const tasksQuery = `
//       SELECT * FROM task WHERE relatedorder = $1
//     `;
//     const tasksResult = await client.query(tasksQuery, [orderId]);

//     // Combine all data
//     const orderWithDetails = {
//       ...order,
//       productionPlanning,
//       timeAndActionPlans: timeAndActionPlansResult.rows,
//       tasks: tasksResult.rows,
//     };

//     await client.query("COMMIT");

//     res.status(200).json({
//       success: true,
//       order: orderWithDetails,
//     });
//   } catch (error) {
//     await client.query("ROLLBACK");
//     console.error("Error getting order by ID:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to get order by ID",
//       error: error.message,
//     });
//   } finally {
//     client.release();
//   }
// };

const getByOrderId = async (req, res) => {
  const client = await pool.connect();
  const { orderId } = req.params;

  try {
    await client.query("BEGIN");

    // Fetch order
    const orderQuery = `SELECT * FROM orders WHERE id = $1`;
    const orderResult = await client.query(orderQuery, [orderId]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const order = orderResult.rows[0];

    // Fetch production planning
    const productionPlanningQuery = `
      SELECT * FROM productionplanning WHERE orderid = $1
    `;
    const productionPlanningResult = await client.query(productionPlanningQuery, [orderId]);
    let productionPlanning = productionPlanningResult.rows;

    // Enhance each production plan with full loom details
    for (let plan of productionPlanning) {
      let loomIds = [];

      if (plan.loomsselected) {
        let selectedLooms = plan.loomsselected;

        // Handle case where it's stored as JSON string
        if (typeof selectedLooms === 'string') {
          try {
            selectedLooms = JSON.parse(selectedLooms);
          } catch (e) {
            console.warn("Failed to parse loomsselected JSON:", selectedLooms);
            selectedLooms = [];
          }
        }

        // Ensure it's an array of IDs (strings or numbers)
        if (Array.isArray(selectedLooms)) {
          loomIds = selectedLooms.map(id => String(id)); // Normalize to strings for ANY query
        }
      }

      // If there are loom IDs, fetch full details from loom table
      if (loomIds.length > 0) {
        const loomsQuery = `
          SELECT * FROM loom WHERE id = ANY($1::text[])
        `;
        const loomsResult = await client.query(loomsQuery, [loomIds]);
        plan.loomsselected = loomsResult.rows; // Replace IDs with full loom objects
      } else {
        plan.loomsselected = []; // No looms selected
      }
    }

    // Fetch time and action plans
    const timeAndActionPlansQuery = `
      SELECT * FROM timeandactionplans WHERE orderid = $1
    `;
    const timeAndActionPlansResult = await client.query(timeAndActionPlansQuery, [orderId]);

    // Fetch tasks
    const tasksQuery = `
      SELECT * FROM task WHERE relatedorder = $1
    `;
    const tasksResult = await client.query(tasksQuery, [orderId]);

    // Combine all data
    const orderWithDetails = {
      ...order,
      productionPlanning,
      timeAndActionPlans: timeAndActionPlansResult.rows,
      tasks: tasksResult.rows,
    };

    await client.query("COMMIT");

    res.status(200).json({
      success: true,
      order: orderWithDetails,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error getting order by ID:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get order by ID",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const deleteOrder = async (req, res) => {
  const client = await pool.connect();
  const { orderId } = req.params;

  try {
    // Start a transaction to ensure data integrity
    await client.query("BEGIN");

    // Check if the order exists in the orders table
    const orderQuery = `
      SELECT * FROM orders WHERE id = $1
    `;
    const orderResult = await client.query(orderQuery, [orderId]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Delete related records in the productionplanning table
    const deleteProductionPlanningQuery = `
      DELETE FROM productionplanning WHERE orderid = $1
    `;

    await client.query(deleteProductionPlanningQuery, [orderId]);

    // Delete related records in the timeandactionplans table
    const deleteTimeAndActionPlansQuery = `
      DELETE FROM timeandactionplans WHERE orderid = $1
    `;
    await client.query(deleteTimeAndActionPlansQuery, [orderId]);

    // Delete related records in the task table
    const deleteTasksQuery = `
      DELETE FROM task WHERE relatedorder = $1
    `;
    await client.query(deleteTasksQuery, [orderId]);
    // Delete the order from the orders table
    const deleteOrderQuery = `
      DELETE FROM orders WHERE id = $1
    `;
    await client.query(deleteOrderQuery, [orderId]);
    // Commit the transaction
    await client.query("COMMIT");

    // Send success response
    res.status(200).json({
      success: true,
      message: "Order and related records have been deleted",
    });
  } catch (error) {
    // Rollback transaction in case of an error
    await client.query("ROLLBACK");
    console.error("Error deleting order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete order",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

// const updateTAPlan = async (req, res) => {
//   const client = await pool.connect();

//   try {
//     const { id } = req.params;
//     const { tastatus, targetdate, actualdate, progressPercentage } = req.body;

//     if (!id) {
//       return res.status(400).json({
//         success: false,
//         message: "T&A Plan ID is required",
//       });
//     }

//     const updateQuery = `
//       UPDATE timeandactionplans
//       SET
//         tastatus = COALESCE($2, tastatus),
//         targetdate = COALESCE($3, targetdate),
//         actualdate = COALESCE($4, actualdate)
//       WHERE id = $1
//       RETURNING *
//     `;

//     const result = await client.query(updateQuery, [
//       id,
//       tastatus || null,
//       targetdate || null,
//       actualdate || null,
//     ]);

//     if (result.rowCount === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "T&A Plan not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "T&A Plan updated successfully",
//       updatedPlan: result.rows[0],
//     });
//   } catch (error) {
//     console.error("Error updating T&A Plan:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to update T&A Plan",
//       error: error.message,
//     });
//   } finally {
//     client.release();
//   }
// };

const updateTAPlan = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { tastatus, targetdate, actualdate, progressPercentage } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "T&A Plan ID is required",
      });
    }

    await client.query("BEGIN"); // Start transaction

    // Step 1: Update the individual timeandactionplans row
    const updatePlanQuery = `
      UPDATE timeandactionplans
      SET 
        tastatus = COALESCE($1, tastatus),
        targetdate = COALESCE($2, targetdate),
        actualdate = COALESCE($3, actualdate)
      WHERE id = $4
      RETURNING orderid;  -- We need the order ID to update the parent order
    `;

    const planResult = await client.query(updatePlanQuery, [
      tastatus || null,
      targetdate || null,
      actualdate || null,
      id,
    ]);

    if (planResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "T&A Plan not found",
      });
    }

    const orderId = planResult.rows[0].orderid;

    // Step 2: If progressPercentage is provided, update it in the orders table
    if (progressPercentage !== undefined && progressPercentage !== null) {
      const updateOrderQuery = `
        UPDATE orders
        SET progress = $1
        WHERE id = $2
      `;

      await client.query(updateOrderQuery, [progressPercentage, orderId]);
    }

    await client.query("COMMIT"); // Commit transaction

    res.status(200).json({
      success: true,
      message: "T&A Plan updated successfully",
      data: {
        updatedPlanId: id,
        orderId,
        progressUpdated:
          progressPercentage !== undefined && progressPercentage !== null,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating T&A Plan:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update T&A Plan",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

// const updateOrder = async (req, res) => {
//   const client = await pool.connect();

//   try {
//     await client.query("BEGIN");

//     const orderData = req.body;
//     const { orderId } = req.params; // Assuming order orderId comes from URL params: /orders/:id

//     if (!orderId) {
//       throw new Error("Order ID is required for update");
//     }

//     // Extract fields (same structure as create)
//     const {
//       orderdate,
//       progress,
//       jobstatus,
//       unit,
//       quantity,
//       priority,
//       customername,
//       buyerponumber,
//       meters,
//       gsm,
//       rate,
//       deliverydate,
//       checklist,
//       fabrictype,
//       constructionvalue1,
//       constructionvalue2,
//       constructionvalue3,
//       constructionvalue4,
//       constructionvalue5,
//       fabricstock,
//       tobeproduced,
//       endsdents,
//       warpendsbeam,
//       warpcrimp,
//       warpmeterreqd,
//       warpyarncount,
//       warpyarnmill,
//       reedyarnkgs,
//       reedonloom,
//       reedspace,
//       flangewidth,
//       weftgmsmtr,
//       weftyarncount,
//       weftyarnmill,
//       weftyarnkgs,
//       loomType,
//       loomSpeed,
//       widthLoom,
//       beamLoom,
//       partialDispatchQty,
//       productionPerDayLoom,
//       availableDays,
//       loomsRequired,
//       loomsPlanned,
//       selectedLooms = [],
//       isJobWork = false,
//       timeActionPlan = [], // Array of loom-specific plans
//       tasks = [], // Array of tasks
//     } = orderData;

//     // 1. Update main orders table
//     const orderQuery = `
//       UPDATE orders SET
//         customername = $1,
//         buyerponumber = $2,
//         meters = $3,
//         gsm = $4,
//         rate = $5,
//         deliverydate = $6,
//         checklist = $7,
//         fabrictype = $8,
//         constructionvalue1 = $9,
//         constructionvalue2 = $10,
//         constructionvalue3 = $11,
//         constructionvalue4 = $12,
//         constructionvalue5 = $13,
//         fabricstock = $14,
//         tobeproduced = $15,
//         endsdents = $16,
//         warpendsbeam = $17,
//         warpcrimp = $18,
//         warpmeterrequired = $19,
//         warpyarncount = $20,
//         warpyarnmill = $21,
//         reedyarnkgs = $22,
//         reedonloom = $23,
//         reedspace = $24,
//         flangewidth = $25,
//         weftgmsmtr = $26,
//         weftyarncount = $27,
//         weftyarnmill = $28,
//         weftyarnkgs = $29,
//         orderdate = $30,
//         status = $31,
//         progress = $32,
//         unit = $33,
//         quantity = $34,
//         priority = $35,
//         partialdispatchqty =$36,
//         updateddate = NOW()
//       WHERE id = $37
//     `;

//     const orderResult = await client.query(orderQuery, [
//       customername || null,
//       buyerponumber || null,
//       parseFloat(meters) || 0,
//       parseFloat(gsm) || null,
//       parseFloat(rate) || null,
//       deliverydate || null,
//       checklist || null,
//       fabrictype || null,
//       constructionvalue1 || 0,
//       constructionvalue2 || 0,
//       constructionvalue3 || 0,
//       constructionvalue4 || 0,
//       constructionvalue5 || 0,
//       fabricstock || 0,
//       parseFloat(tobeproduced) || 0,
//       parseFloat(endsdents) || null,
//       parseFloat(warpendsbeam) || null,
//       parseFloat(warpcrimp) || null,
//       parseFloat(warpmeterreqd) || null,
//       warpyarncount || 0,
//       warpyarnmill || null,
//       parseFloat(reedyarnkgs) || null,
//       parseFloat(reedonloom) || null,
//       parseFloat(reedspace) || null,
//       parseFloat(flangewidth) || null,
//       parseFloat(weftgmsmtr) || null,
//       parseFloat(weftyarncount) || null,
//       weftyarnmill || null,
//       parseFloat(weftyarnkgs) || null,
//       orderdate || null,
//       jobstatus || null,
//       progress,
//       unit || 0,
//       quantity || 0,
//       priority || null,
//       partialDispatchQty,
//       orderId,
//     ]);

//     if (orderResult.rowCount === 0) {
//       throw new Error("Order not found");
//     }

//     // 2. Handle productionplanning (upsert)
//     if (!isJobWork || loomType) {
//       const ppUpsertQuery = `
//         INSERT INTO productionplanning (
//           id, orderid, loomtype, loomspeed, loomwidth, loombeam, productionperdayloom,
//           availabledays, loomsrequired, loomsplanned, loomsselected, createddate
//         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
//         ON CONFLICT (orderid) DO UPDATE SET
//           loomtype = EXCLUDED.loomtype,
//           loomspeed = EXCLUDED.loomspeed,
//           loomwidth = EXCLUDED.loomwidth,
//           loombeam = EXCLUDED.loombeam,
//           productionperdayloom = EXCLUDED.productionperdayloom,
//           availabledays = EXCLUDED.availabledays,
//           loomsrequired = EXCLUDED.loomsrequired,
//           loomsplanned = EXCLUDED.loomsplanned,
//           loomsselected = EXCLUDED.loomsselected
//       `;

//       await client.query(ppUpsertQuery, [
//         uuidv4(), // new ID if not exists, but conflict uses orderid
//         orderId,
//         loomType || null,
//         parseFloat(loomSpeed) || null,
//         parseFloat(widthLoom) || null,
//         parseFloat(beamLoom) || null,
//         parseFloat(productionPerDayLoom) || null,
//         parseInt(availableDays) || null,
//         parseInt(loomsRequired) || null,
//         parseInt(loomsPlanned) || null,
//         selectedLooms.length > 0 ? JSON.stringify(selectedLooms) : null,
//       ]);
//     } else {
//       // If switched to Job Work, optionally delete planning data
//       await client.query("DELETE FROM productionplanning WHERE orderid = $1", [
//         orderId,
//       ]);
//     }

//     // 3. Handle Time & Action Plans (delete old + insert new - only for regular orders)
//     if (!isJobWork) {
//       // Clear existing plans for this order
//       await client.query("DELETE FROM timeandactionplans WHERE orderid = $1", [
//         orderId,
//       ]);

//       if (Array.isArray(timeActionPlan) && timeActionPlan.length > 0) {
//         const taQuery = `
//           INSERT INTO timeandactionplans (
//             id, days, process, orderid, responsible, tastatus, targetdate, actualdate, loomid
//           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
//         `;

//         for (const loomPlan of timeActionPlan) {
//           const loomId = loomPlan.loomId;

//           for (const process of loomPlan.processes) {
//             if (!process.process && !process.name) continue;

//             await client.query(taQuery, [
//               uuidv4(),
//               process.days || null,
//               process.process || process.name || "Unnamed Process",
//               orderId,
//               process.responsible || null,
//               process.status || process.tastatus || "Pending",
//               process.targetDate || null,
//               process.actualDate || null,
//               loomId || null,
//             ]);
//           }
//         }
//       }
//     } else {
//       // For Job Work, remove any existing T&A plans
//       await client.query("DELETE FROM timeandactionplans WHERE orderid = $1", [
//         orderId,
//       ]);
//     }

//     // 4. Handle Tasks (delete old + insert new - only for regular orders)
//     if (!isJobWork) {
//       await client.query("DELETE FROM task WHERE relatedorder = $1", [orderId]);

//       if (Array.isArray(tasks) && tasks.length > 0) {
//         const taskQuery = `
//           INSERT INTO task (
//             id, relatedorder, tasktitle, description, category, priority, assignedto, duedate, estimatedhours, createddate
//           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
//         `;

//         for (const task of tasks) {
//           await client.query(taskQuery, [
//             uuidv4(),
//             orderId,
//             task.title || task.tasktitle || "Untitled Task",
//             task.description || null,
//             task.category || null,
//             task.priority || "Medium",
//             task.assignedTo || null,
//             task.dueDate || null,
//             task.estimatedhours || null,
//           ]);
//         }
//       }
//     } else {
//       await client.query("DELETE FROM task WHERE relatedorder = $1", [orderId]);
//     }

//     await client.query("COMMIT");

//     res.status(200).json({
//       success: true,
//       message: isJobWork
//         ? "Job Work order updated successfully"
//         : "Order and planning updated successfully",
//       orderId,
//       orderType: isJobWork ? "Job Work" : "Regular Production",
//     });
//   } catch (error) {
//     await client.query("ROLLBACK");
//     console.error("Error updating order:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to update order",
//       error: error.message,
//     });
//   } finally {
//     client.release();
//   }
// };



module.exports = {
  createOrder,
  updateOrder,
  getOrdersList,
  getByOrderId,
  deleteOrder,
  updateTAPlan,
};
