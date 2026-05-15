const express = require("express");
const loomRoutes = require("./routes/loomRoutes");
const weaverRoutes = require("./routes/weaverRoutes");
const taskRoutes = require("./routes/taskRoutes");
const productionPlanningRoutes = require("./routes/productionPlanningRoutes");
const usersRoutes = require("./routes/usersRoutes");
const authRoutes = require("./routes/authRoutes");
const orderRoutes = require("./routes/orderRoutes");
const dailyProductionRoutes = require("./routes/dailyProductionRoutes");
const deliveryScheduleRoutes = require("./routes/deliveryScheduleRoutes");
const beamReconciliationRoutes = require("./routes/beamReconciliationRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const path = require("path");

const organizationRoutes = require("./routes/organizationRoutes");

const cookieParser = require("cookie-parser");

const cors = require("cors");

const app = express();
app.use(express.json());
// app.use(cors());
app.use(
  cors({
    origin: ["http://localhost:8080", "https://192.168.1.12:8080"], // frontend URL
    credentials: true, // allow cookies
  })
);

app.use(cookieParser());

// Routes
app.use("/api/loom", loomRoutes);
app.use("/api/weaver", weaverRoutes);
app.use("/api/task", taskRoutes);
app.use("/api/loom/options", loomRoutes);
app.use("/api/task/options", taskRoutes);
app.use("/api/productionplanning", productionPlanningRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/authentication", authRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/production", dailyProductionRoutes);
app.use("/api/deliveryschedule", deliveryScheduleRoutes);
app.use("/api/beamReconciliation", beamReconciliationRoutes);

app.use("/api/organization/options", organizationRoutes);

app.use("/api/notification", notificationRoutes);

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// console.log("__dirname =", __dirname);
// console.log("uploads path =", path.join(__dirname, "../uploads"));

app.use("/api/organization", organizationRoutes);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
