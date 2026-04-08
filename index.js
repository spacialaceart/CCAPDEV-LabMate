require("./config/loadEnv");

const express = require("express");
const fileUpload = require("express-fileupload");
const path = require("path");
const mongoose = require("mongoose");
const exphbs = require("express-handlebars");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const mongodbsesh = require("connect-mongodb-session")(session);

const { DATABASE_URI } = require("./config/pageConfigs");
const { logSessionState } = require("./middleware/sessionLogger");
const { deletePastReservations } = require("./services/reservationService");
const { startReservationCleanupJob } = require("./jobs/reservationCleanup");
const { seedDatabaseIfEmpty } = require("./database/seedDatabase");
const { getHomePathByType } = require("./services/sessionService");

const publicRouter = require("./routes/public");
const studentRouter = require("./routes/student");
const labtechRouter = require("./routes/labtech");
const adminRouter = require("./routes/admin");
const userApiRouter = require("./routes/api/users");
const reservationApiRouter = require("./routes/api/reservations");
const laboratoryApiRouter = require("./routes/api/laboratories");

const app = express();

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(fileUpload());

app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
app.engine("hbs", exphbs.engine({
    extname: "hbs",
    helpers: {
        eq: (a, b) => a === b,
        isLabtechRole: (type) => type === "LabTech"
    }
}));

mongoose.connect(process.env.DATABASE_URL || DATABASE_URI)
    .then(async () => {
        console.log("Connected to MongoDB successfully");
        await seedDatabaseIfEmpty();
    })
    .catch((err) => {
        console.error("MongoDB connection error:", err);
    });

const store = new mongodbsesh({
    uri: process.env.DATABASE_URL || DATABASE_URI,
    collection: "sessions"
});

store.on("error", (error) => {
    console.error("Session store error:", error);
});

app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || "secret-key-shhhh",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: null
    },
    store
}));

app.use(logSessionState);

app.use(publicRouter);
app.use(studentRouter);
app.use(labtechRouter);
app.use(adminRouter);
app.use(userApiRouter);
app.use(reservationApiRouter);
app.use(laboratoryApiRouter);

app.use((req, res) => {
    if (req.originalUrl.startsWith("/api/")) {
        return res.status(404).json({ message: "Not found" });
    }

    const user = req.session?.user || null;
    const homePath = user ? getHomePathByType(user.type) : "/";

    return res.status(404).render("404", {
        user,
        homePath,
        missingPath: req.originalUrl
    });
});

startReservationCleanupJob(deletePastReservations);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
