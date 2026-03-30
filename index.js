const express = require("express");
const fileUpload = require('express-fileupload')
const path = require("path");
const mongoose = require("mongoose");
const exphbs = require("express-handlebars");
const argon2 = require("argon2") // password hashing
const session = require("express-session");
const cookieParser = require("cookie-parser");
const mongodbsesh = require("connect-mongodb-session")(session)

// Database
const dbUri = 'mongodb://localhost/LabMateDB';
const User = require('./database/models/User');
const Reservation = require('./database/models/Reservation');
const Laboratory = require("./database/models/Laboratory");
const { timeSlots } = require('./database/models/TimeSlotOptions');

const REMEMBER_ME_DURATION_MS = 3 * 7 * 24 * 60 * 60 * 1000;
const SESSION_COOKIE_NAME = "connect.sid";
const RESERVATION_DATE_FORMAT_OPTIONS = {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
};
const PROFILE_DATE_FORMAT_OPTIONS = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
};
const LAB_DATE_FORMAT_OPTIONS = {
    weekday: "long",
    month: "long",
    day: "numeric"
};
const PROFILE_SECTION_HASHES = {
    dashboard: "#dashboard",
    overview: "#dashboard",
    view: "#view",
    account: "#view",
    edit: "#edit",
    delete: "#delete",
    logout: "#logout"
};
const DEFAULT_UPCOMING_LAB_MESSAGE = "No upcoming reservations.";

// Configure middleware
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(fileUpload());

// Configure handlebars
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
app.engine("hbs", exphbs.engine({
    extname: "hbs",
    helpers: {
        eq: (a, b) => a === b,
        isRemovable: (reservationId, removableReservations, options) => {
            return removableReservations.some(r => r._id.toString() === reservationId.toString()) 
                ? options.fn(this) 
                : options.inverse(this);
        }
    }
}));

// Connect to MongoDB based on provided db uri (deployed or local)
mongoose.connect(process.env.DATABASE_URL || dbUri)
.then(async () => {
    console.log('Connected to MongoDB successfully');
    
    // Check if database is empty, seed if yez
    const userCount = await User.countDocuments();
    const labCount = await Laboratory.countDocuments();
    
    if (userCount === 0 && labCount === 0) {
        // Seed database with script
        console.log('Database is empty. Seeding database...');
        await require('./database/seedDatabase');
    } else {
        console.log('Database currently has '+userCount+' users & '+labCount+' laboratories.');
    }
})
.catch(err => {
    console.error('MongoDB connection error:', err);
});

// Store sessions in MongoDB
const store = new mongodbsesh({
    uri: process.env.DATABASE_URL || dbUri, 
    collection: "sessions"
});

// catch any errors
store.on('error', function(error) {
    console.error('Session store error:', error);
});

// Configure sessions and cookies
app.use(cookieParser());
app.use(session({
    secret: "secret-key-shhhh",
    resave: false,
    saveUninitialized: false, 
    cookie: {
        httpOnly: true,
        maxAge: null // to be set by remember me checkbox
    },
    store: store,
}));

// Authenticator (for signed-in pages)
const isAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect("/signin-page");
    }
};

// Type verifier (for type-specific pages) 
const verifyType = (req, res, next) => {
    if (req.session.user.type === "Faculty" && req.path.startsWith("/student")) {
        res.redirect("/labtech-home");
    } else if (req.session.user.type === "Student" && req.path.startsWith("/labtech")){
        res.redirect("/student-home")
    } else {
        next()
    }
};

// session checker; prints session details in console
app.use(async (req, res, next) => {
    if (req.session && req.session.user) {
        console.log("Current session user:", 
            req.session.user.firstName + " " + req.session.user.lastName,
            "/ Times visited:", req.session.visitCount,
            "/ Remember period:", (req.session.cookie.maxAge / (24 * 60 * 60 * 1000)).toFixed(1) + " days"
        );
    } else {
        console.log("No user is currently logged in.");
    }
    next();
});

function redirectToUserHome(res, userType) {
    return res.redirect(userType === "Faculty" ? "/labtech-home" : "/student-home");
}

function destroySession(req, res, onComplete) {
    req.session.destroy(() => {
        res.clearCookie(SESSION_COOKIE_NAME);
        onComplete();
    });
}

async function refreshSessionUser(req) {
    const user = await User.findById(req.session.user._id);

    if (!user) {
        return null;
    }

    req.session.user = user.toObject();
    return user;
}

function createGuestOnlyPageHandler(viewName) {
    return (req, res) => {
        if (req.session.user) {
            return redirectToUserHome(res, req.session.user.type);
        }

        res.render(viewName);
    };
}

function buildNext7Days() {
    const today = new Date();

    return Array.from({ length: 8 }, (_, offset) => {
        const date = new Date();
        date.setDate(today.getDate() + offset);

        return {
            formattedDate: date.toISOString().split("T")[0],
            displayDate: date.toLocaleDateString("en-US", LAB_DATE_FORMAT_OPTIONS)
        };
    });
}

async function getLaboratoryPageData(userFields) {
    const [labs, reservations] = await Promise.all([
        Laboratory.find({}).lean(),
        Reservation.find().lean().populate("userId", userFields)
    ]);

    return {
        labs,
        next7Days: buildNext7Days(),
        timeSlots,
        reservations
    };
}

function sortReservationsBySchedule(reservations) {
    return reservations.sort((a, b) => {
        const dateComparison = new Date(a.reservationDate) - new Date(b.reservationDate);
        if (dateComparison !== 0) return dateComparison;

        const startTimeComparison = convertTimeToMinutes(a.startTime) - convertTimeToMinutes(b.startTime);
        if (startTimeComparison !== 0) return startTimeComparison;

        return convertTimeToMinutes(a.endTime) - convertTimeToMinutes(b.endTime);
    });
}

async function getSortedReservations(query = {}, select) {
    let reservationQuery = Reservation.find(query);

    if (select) {
        reservationQuery = reservationQuery.select(select);
    }

    return sortReservationsBySchedule(await reservationQuery.lean());
}

function formatReservationDate(reservationDate) {
    return new Date(reservationDate).toLocaleDateString("en-US", RESERVATION_DATE_FORMAT_OPTIONS);
}

function formatReservationsForList(reservations) {
    return reservations.map((reservation) => ({
        ...reservation,
        reservationDate: formatReservationDate(reservation.reservationDate)
    }));
}

function getReservationDateTime(reservationDate, timeString) {
    const reservationDateTime = new Date(reservationDate);
    const reservationTime = convertTo24Hour(timeString);

    if (!reservationTime) {
        return null;
    }

    reservationDateTime.setHours(reservationTime.hours, reservationTime.minutes, 0, 0);
    return reservationDateTime;
}

function getRemovableReservationIds(reservations) {
    const currentDate = new Date();

    return reservations.reduce((removableReservations, reservation) => {
        const reservationDateTime = getReservationDateTime(reservation.reservationDate, reservation.startTime);

        if (!reservationDateTime) {
            return removableReservations;
        }

        const timeDiff = (currentDate - reservationDateTime) / (1000 * 60);
        const currentDateGMT8 = currentDate.toLocaleDateString("en-US", RESERVATION_DATE_FORMAT_OPTIONS);

        console.log(`Time Diff: ${timeDiff} Reservation Date: ${reservationDateTime} Current Date: ${currentDate}Date (GMT+8): ${currentDateGMT8}`);

        if (timeDiff >= 10) {
            removableReservations.push(reservation._id);
        }

        return removableReservations;
    }, []);
}

function formatProfileReservation(reservation) {
    return {
        lab: reservation.laboratoryRoom,
        date: new Date(reservation.reservationDate).toLocaleDateString("en-US", PROFILE_DATE_FORMAT_OPTIONS),
        time: `${reservation.startTime} - ${reservation.endTime}`,
        seat: reservation.seatNumber,
        status: getStatus(reservation)
    };
}

function getUpcomingLabSummary(reservations) {
    const now = new Date();

    const upcomingReservations = reservations
        .filter((reservation) => {
            const reservationDateTime = getReservationDateTime(reservation.reservationDate, reservation.startTime);
            return reservationDateTime && reservationDateTime > now;
        })
        .sort((one, two) => (
            getReservationDateTime(one.reservationDate, one.startTime) -
            getReservationDateTime(two.reservationDate, two.startTime)
        ));

    if (upcomingReservations.length === 0) {
        return DEFAULT_UPCOMING_LAB_MESSAGE;
    }

    const nextReservation = upcomingReservations[0];
    return `${nextReservation.laboratoryRoom} on ${new Date(nextReservation.reservationDate).toLocaleDateString("en-US", PROFILE_DATE_FORMAT_OPTIONS)} at ${nextReservation.startTime}`;
}

function getProfileSectionHash(section) {
    return PROFILE_SECTION_HASHES[section] || "";
}

function normalizeReservationDate(date) {
    const reservationDate = new Date(date);
    reservationDate.setDate(reservationDate.getDate() - 1);
    reservationDate.setHours(24, 0, 0, 0);
    return reservationDate;
}

async function renderHomePage(req, res, viewName) {
    const user = await refreshSessionUser(req);

    if (!user) {
        console.log("User no longer exists in database. Destroying session...");
        return destroySession(req, res, () => res.redirect("/signin-page"));
    }

    res.render(viewName, { user: req.session.user });
}

async function renderLaboratoryPage(req, res, viewName, userFields, includeUser = false) {
    try {
        const pageData = await getLaboratoryPageData(userFields);
        const viewModel = includeUser
            ? { ...pageData, user: req.session.user }
            : pageData;

        res.render(viewName, viewModel);
    } catch (error) {
        console.error("Error fetching laboratories:", error);
        res.status(500).send("Internal Server Error");
    }
}

async function renderReservationsPage(req, res, viewName, query, includeRemovableReservations = false) {
    try {
        const reservations = formatReservationsForList(await getSortedReservations(query));
        const viewModel = {
            reservations,
            user: req.session.user
        };

        if (includeRemovableReservations) {
            viewModel.removableReservations = getRemovableReservationIds(reservations);
        }

        res.render(viewName, viewModel);
    } catch (error) {
        console.error("Error fetching reservations:", error);
        res.status(500).send("Internal Server Error");
    }
}

async function renderProfilePage(req, res, viewName, reservationQuery) {
    const reservations = await getSortedReservations(
        reservationQuery,
        "laboratoryRoom reservationDate startTime endTime seatNumber"
    );

    res.render(viewName, {
        upcomingLab: getUpcomingLabSummary(reservations),
        reservations: reservations.map(formatProfileReservation),
        user: req.session.user
    });
}

async function createReservationAndRedirect(req, res, redirectPath, options = {}) {
    const { includeAnonymous = false } = options;
    const { labId, date, seatNumber, startTime, endTime, userId, isAnonymous } = req.body;
    const parsedSeatNumber = parseInt(seatNumber, 10);

    if (!labId || !date || !seatNumber || !startTime || !endTime || !userId) {
        return res.status(400).send("All fields are required");
    }

    console.log("Creating reservation with data:", req.body);

    const reservationDate = normalizeReservationDate(date);
    const lab = await Laboratory.findById(labId);

    if (!lab) {
        return res.status(404).send("Laboratory not found");
    }

    const existingReservation = await Reservation.findOne({
        laboratoryRoom: lab.room,
        seatNumber: parsedSeatNumber,
        reservationDate,
        startTime
    });

    if (existingReservation) {
        return res.status(400).send("This seat is already reserved for the selected time");
    }

    const user = await User.findById(userId);

    if (!user) {
        return res.status(404).send("User not found");
    }

    const reservationPayload = {
        userId,
        studentName: `${user.firstName} ${user.lastName}`,
        laboratoryRoom: lab.room,
        seatNumber: parsedSeatNumber,
        bookingDate: new Date(),
        reservationDate,
        startTime,
        endTime
    };

    if (includeAnonymous) {
        reservationPayload.isAnonymous = isAnonymous;
    }

    await new Reservation(reservationPayload).save();
    res.redirect(redirectPath);
}

function createProfileSectionRedirectHandler(profilePath) {
    return (req, res) => {
        res.redirect(`${profilePath}${getProfileSectionHash(req.params.section)}`);
    };
}

async function findUserOrRespondNotFound(res, userId) {
    const user = await User.findById(userId);

    if (!user) {
        console.log(`User not found with ID: ${userId}`);
        res.status(404).json({ message: "User not found" });
        return null;
    }

    return user;
}

function buildDetailedUserData(user) {
    return {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        department: user.department,
        biography: user.biography,
        image: user.image,
        isLabTech: user.type === "Faculty"
    };
}

function buildBasicUserData(user) {
    return {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isLabTech: user.type === "Faculty"
    };
}

// get session data (for temporary localstorage stuff)
app.get("/api/session", (req, res) => {
    if (req.session && req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.status(401).json({ error: "No user session found" });
    }
});

/* SIGNED-OUT ROUTES */

app.get("/", async (req, res) => {
    if (req.session.user) {
        const user = await refreshSessionUser(req);

        if (!user) {
            console.log("User no longer exists in database. Destroying session...");
            return destroySession(req, res, () => res.render("index"));
        }

        if (req.session.cookie.maxAge) {
            req.session.cookie.maxAge += REMEMBER_ME_DURATION_MS;
        }

        req.session.visitCount = (req.session.visitCount || 0) + 1;

        return redirectToUserHome(res, user.type);
    }

    res.render("index");
});

app.get("/about", (req, res) => {
    res.render("about");
});

app.get("/signin-page", createGuestOnlyPageHandler("signin-page"));
app.get("/signup-page", createGuestOnlyPageHandler("signup-page"));

app.post("/signin", async (req, res) => {
    try {
        let { email, password, rememberMe} = req.body;
        email = email.toLowerCase();

        console.log("Received sign-in request for email:", email);
        
        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }
        
        // Find if user exists
        let user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ error: "Account does not exist. Please try again with a different email" });
        }

        try {
            // Verify passwords are the same
            const passMatch = await argon2.verify(user.password, password);
            if (!passMatch) {
                return res.status(401).json({ error: "Password is incorrect. Please try again." });
            }
        } catch (verifyError) {
            console.error("Password verification error:", verifyError.message);
            
            // Check if the error is related to the hash format
            if (verifyError.message.includes("must contain a $ as first char")) {
                // This indicates the password hash in the database is incorrectly formatted
                return res.status(401).json({ 
                    error: "There was an issue with your password. Please try again later or contact support."
                });
            }
            
            // For any other password verification errors
            return res.status(401).json({ error: "Authentication failed. Please try again." });
        }

        // Store user data in session
        req.session.user = user.toObject();

        if (rememberMe) {
            req.session.cookie.maxAge = REMEMBER_ME_DURATION_MS;
        }  else {
            req.session.cookie.expires = false;
        }

        req.session.visitCount = 1;

        return redirectToUserHome(res, user.type);
        
    } catch (error) {
        console.error("Error during sign-in:", error.message, error.stack);
        res.status(500).json({ error: "An error occurred during sign-in" });
    }
});

app.post("/signup", async (req, res) => {
    try {
        let { firstName, lastName, email, newPass, confirmPass, type, facultyCode} = req.body;
        email = email.toLowerCase();

        console.log("Received sign-up request:", { firstName, lastName, email, type });
        
        // Validate input
        if (!firstName || !lastName || !email || !newPass || !confirmPass) {
            return res.status(400).json({ error: "All fields are required" });
        }
        
        // Check if passwords match
        if (newPass !== confirmPass) {
            return res.status(400).json({ error: "Passwords do not match" });
        }
        
        // Check if email is already in use
        const existingUser = await User.findOne({ email });
        
        if (existingUser) {
            return res.status(400).json({ error: "Email is already in use" });
        }

        // Faculty code is blank
        if (type === "Faculty" && !facultyCode) {
            return res.status(400).json({ error: "Please enter a faculty code to proceed" });
        }

        // Verify faculty code (for demo: i-am-faculty)
        if (type === "Faculty" && facultyCode !== "i-am-faculty") {
            return res.status(400).json({ error: "Invalid faculty code" });
        }

        // Hash password
        const hashPass = await argon2.hash(newPass);

        // Create new user
        const newUser = new User({
                firstName,
                lastName,
                email,
                password: hashPass,
                type: type
        });

        // Add to the database
        await newUser.save();
        console.log("New "+type+" user created:", newUser._id);
        
        // Store user data in session
        req.session.user = newUser.toObject();

        req.session.visitCount = 1;

        return redirectToUserHome(res, newUser.type);
        
    } catch (error) {
        console.error("Error during sign-up:", error);
        res.status(500).json({ error: "An error occurred during sign-up" });
    }
});

app.get("/signedout-laboratories", async (req, res) => {
    await renderLaboratoryPage(req, res, "signedout-laboratories", "firstName lastName isAnonymous type");
});

/* SIGNED-IN ROUTES */

// Homes

[
    { path: "/student-home", view: "student/home" },
    { path: "/labtech-home", view: "labtech/home" }
].forEach(({ path, view }) => {
    app.get(path, isAuth, verifyType, async (req, res) => {
        await renderHomePage(req, res, view);
    });
});

// Laboratories

[
    { path: "/student-laboratories", view: "student/laboratories" },
    { path: "/labtech-laboratories", view: "labtech/laboratories" }
].forEach(({ path, view }) => {
    app.get(path, isAuth, verifyType, async (req, res) => {
        await renderLaboratoryPage(req, res, view, "firstName lastName type", true);
    });
});

// Reservations

app.get("/student-reservations", isAuth, verifyType, async (req, res) => {
    await renderReservationsPage(req, res, "student/reservations", { userId: req.session.user._id });
});

app.get("/labtech-reservations", isAuth, verifyType, async (req, res) => {
    await renderReservationsPage(req, res, "labtech/reservations", {}, true);
});


// Get reservations across all users
app.get("/api/reservations", async (req, res) => {
    try {
        const reservations = await Reservation.find();
        res.json(reservations);
    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
});


// Get reservations for a specific user
app.get("/api/reservations/user/:userId", async (req, res) => {
    try {
        const reservations = await Reservation.find({ userId: req.params.userId });
        res.json(reservations);
    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
});

// Get a specific reservation by ID
app.get("/api/reservation/:id", async (req, res) => {
    try {
        console.log(`Checking reservation with ID: ${req.params.id}`);
        const reservation = await Reservation.findById(req.params.id);
        if (!reservation) {
            console.log(`Reservation not found with ID: ${req.params.id}`);
            return res.status(404).json({ message: "Reservation not found" });
        }
        console.log(`Found reservation: ${JSON.stringify(reservation)}`);
        res.json(reservation);
    } catch (error) {
        console.error(`Error finding reservation: ${error.message}`);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

app.get("/logout", (req, res) => {
    console.log("Destroying session and clearing remember me period...");
    destroySession(req, res, () => res.redirect("/"));
});

// Get detailed user information by ID (must be defined BEFORE the more general route)
app.get("/api/user/details/:id", async (req, res) => {
    try {
        console.log(`Fetching detailed user info with ID: ${req.params.id}`);
        const user = await findUserOrRespondNotFound(res, req.params.id);

        if (!user) {
            return;
        }

        const userDetails = buildDetailedUserData(user);
        
        console.log(`Found detailed user info: ${JSON.stringify(userDetails)}`);
        res.json(userDetails);
    } catch (error) {
        console.error(`Error finding detailed user info: ${error.message}`);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// Get user by ID (basic info)
app.get("/api/user/:id", async (req, res) => {
    try {
        console.log(`Fetching user with ID: ${req.params.id}`);
        const user = await findUserOrRespondNotFound(res, req.params.id);

        if (!user) {
            return;
        }

        const userData = buildBasicUserData(user);
        
        console.log(`Found user: ${JSON.stringify(userData)}`);
        res.json(userData);
    } catch (error) {
        console.error(`Error finding user: ${error.message}`);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// Create a new reservation
app.post("/api/reservation", async (req, res) => {
    try {
        const reservation = new Reservation(req.body);
        await reservation.save();
        res.status(201).json(reservation);
    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
});

app.put("/api/user/update", isAuth, async (req, res) => {
    try {
        console.log(`Updating user with ID: ${req.session.user._id}`, req.body);
        
        let user = await User.findById(req.session.user._id);

        if(!user) {
            return res.status(404).json({message: "User not found"});
        }

        // Update text fields
        user.department = req.body.department || user.department;
        user.biography = req.body.biography || user.biography;
        
        // Handle image upload if provided
        if (req.files && req.files.image) {
            const image = req.files.image;
            const uploadPath = path.join(__dirname, 'public/uploads', `${user._id}_${image.name}`);
            
            // Save the file
            await image.mv(uploadPath);
            
            // Update the user's image path in database
            user.image = `/uploads/${user._id}_${image.name}`;
        }

        // Save the updated user
        await user.save();
        
        // Update session with new user data;
        req.session.user = user.toObject();
        

        res.json({
            success: true,
            message: "Profile updated successfully",
            user: user
        });

    } catch (error) {
        console.error(`Error updating user: ${error.message}`);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// Delete a specific reservation
app.delete("/api/reservation/:id", async (req, res) => {
    try {
        const reservationId = req.params.id;
        console.log(`Attempting to delete reservation with ID: ${reservationId}`);
        
        // Find and delete the reservation
        const reservation = await Reservation.findByIdAndDelete(reservationId);
        
        if (!reservation) {
            console.log(`Reservation not found with ID: ${reservationId}`);
            return res.status(404).json({ message: "Reservation not found" });
        }
        
        console.log(`Successfully deleted reservation with ID: ${reservationId}`);
        res.json({ message: "Reservation deleted successfully" });
    } catch (error) {
        console.error(`Error deleting reservation: ${error.message}`);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// Delete past reservations

async function deletePastReservations() {
    try {
        const currentDateTime = new Date();
        
        const reservations = await Reservation.find({});
        
        let deletionsOccurred = false;

        const pastReservations = reservations.filter(reservation => {
            const reservationDateTime = getReservationDateTime(reservation.reservationDate, reservation.endTime);
            return reservationDateTime && reservationDateTime <= currentDateTime;
        })

        if (pastReservations.length > 0) {
            await Promise.all(pastReservations.map(async (reservation) => {
                await Reservation.findByIdAndDelete(reservation._id);
                console.log(`Deleted past reservation: ${reservation.laboratoryRoom} on ${reservation.reservationDate}`);
            }))
            deletionsOccurred = true;
        }

        if (deletionsOccurred) {
            console.log('Reservation Deletion Check: Past reservations deleted.');
        } else {
            console.log('Reservation Deletion Check: All reservations are ongoing/upcoming.');
        }
    } catch (error) {
        console.error("Error deleting past reservations:", error);
    }
}

app.delete("/api/user/delete", async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { password } = req.body;
        
        console.log(`Attempting to delete user account with ID: ${userId}`);
        
        // Try to find the user in the User first
        let user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Verify password
        const matchPass = await argon2.verify(user.password, password)
        if (!matchPass) {
            return res.status(401).json({ message: "Incorrect password" });
        }
        
        // Delete all reservations associated with the user
        await Reservation.deleteMany({ userId: userId });
        
        // Delete the user account
        await User.findByIdAndDelete(userId);
        
        console.log(`Successfully deleted user account with ID: ${userId}`);
        res.json({ success: true, message: "Account deleted successfully" });
        
    } catch (error) {
        console.error(`Error deleting user account: ${error.message}`);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// Edit a specific reservation
app.patch("/api/reservation/:id", async(req,res) => {
    try{
        const reservation = await Reservation.findByIdAndUpdate(req.params.id, {$set: req.body}, {new: true});
        if (!reservation){
            return res.status(404).json({ message: "Reservation not found" });
        }
        res.json(reservation);
    } catch (error){
        res.status(500).json({ message: "Server error", error });
    }
});

app.get("/student-profile", isAuth, async (req, res) => {
    await renderProfilePage(req, res, "student/profile", { userId: req.session.user._id });
});

app.get("/labtech-profile", isAuth, async (req, res) => {
    await renderProfilePage(req, res, "labtech/profile", {});
});


// Profile Section Routes - Using route parameters for cleaner code
app.get("/profile-:section", isAuth, createProfileSectionRedirectHandler("/student-profile"));

// Labtech Profile Section Routes
app.get("/labtech-profile-:section", isAuth, createProfileSectionRedirectHandler("/labtech-profile"));


// API endpoint to check seat availability
app.get("/api/reservations/check-availability", async (req, res) => {
    try {
        const { lab, date, seatNumber, startTime, endTime } = req.query;
        
        // Validate inputs
        if (!lab || !date || !seatNumber || !startTime || !endTime) {
            return res.status(400).json({ available: false, message: "All parameters are required" });
        }
        
        // Check if there's already a reservation for this seat, date, and time
        const existingReservation = await Reservation.findOne({
            laboratoryRoom: lab,
            seatNumber: parseInt(seatNumber, 10),
            reservationDate: date,
            startTime: startTime
        });
        
        if (existingReservation) {
            return res.json({ available: false, message: "This seat is already reserved for the selected time" });
        }
        
        // If no reservation found, the seat is available
        return res.json({ available: true, message: "Seat is available" });
    } catch (error) {
        console.error("Error checking seat availability:", error);
        res.status(500).json({ available: false, message: "An error occurred while checking seat availability" });
    }
});

// API endpoint to get a specific lab by name
app.get("/api/laboratories/:room", async (req, res) => {
    try {
        const { room } = req.params; 
        const laboratory = await Laboratory.findOne({ room });

        if (!laboratory) {
            return res.status(404).json({ message: "Laboratory not found" });
        }

        res.json(laboratory);
    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
});

// API endpoint to get reservations for a lab and date
app.get("/api/reservations/lab/:labId/date/:date", async (req, res) => {
    try {
        const { labId, date } = req.params;
        // Validate inputs
        if (!labId || !date) {
            return res.status(400).json({ error: "Laboratory and date are required" });
        }
        
        console.log(`Fetching reservations for lab: ${labId}, date: ${date}`);
        
        // Create start and end date for the query (beginning and end of the day)
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
        
        // fetch lab data
        const lab = await Laboratory.findById(labId);
        if (!lab) {
            return res.status(404).json({ error: "Laboratory not found" });
        }

        // Find all reservations for the given lab and date
        const reservations = await Reservation.find({
            laboratoryRoom: lab.room,
            reservationDate: {
                $gte: startDate,
                $lt: endDate
            }
        }).populate('userId', 'firstName lastName image type');
        
        console.log(`Found ${reservations.length} reservations`);
        
        // Format the reservations for the response
        const formattedReservations = reservations.map(reservation => ({
            _id: reservation._id,
            seatNumber: reservation.seatNumber,
            startTime: reservation.startTime,
            endTime: reservation.endTime,
            userId: reservation.userId,
            studentName: reservation.studentName,
            isAnonymous: reservation.isAnonymous,
        }));
        
        res.json({ reservations: formattedReservations });
    } catch (error) {
        console.error("Error fetching reservations:", error);
        res.status(500).json({ error: "An error occurred while fetching reservations" });
    }
});

// Create a new reservation
app.post("/create-reservation", isAuth, async (req, res) => {
    try {
        await createReservationAndRedirect(req, res, "/student-reservations", { includeAnonymous: true });
    } catch (error) {
        console.error("Error creating reservation:", error);
        res.status(500).send("An error occurred while creating the reservation");
    }
});

// Create a new reservation as labtech
app.post("/create-reservation-labtech", isAuth, async (req, res) => {
    try {
        await createReservationAndRedirect(req, res, "/labtech-reservations");
    } catch (error) {
        console.error("Error creating reservation:", error);
        res.status(500).send("An error occurred while creating the reservation");
    }
});

// Helper Functions
function convertTimeToMinutes(timeString) {
    const [time, modifier] = timeString.split(" ");
    let [hours, minutes] = time.split(":").map(Number);

    if (modifier === "P.M." && hours !== 12) hours += 12;
    if (modifier === "A.M." && hours === 12) hours = 0;

    return hours * 60 + minutes; 
}

function convertTo24Hour(timeStr){
    const match = timeStr.match(/(\d+):(\d+) (\w+\.?\w*)/);

    if(!match)
        return null;

    let [_, hours, minutes, period] = match;
    hours = Number(hours);
    minutes = Number(minutes);

    if(period.toUpperCase().includes("P") && hours !== 12){
        hours += 12;
    } else if (period.toUpperCase().includes("A") && hours === 12) {
        hours = 0;
    }

    return {hours, minutes};
}

// checks for past reservations and delete if there is any every half hour (30 minutes)
function runAtNextHalfHour() {
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const millisToNextHalfHour= (30 - minutes % 30) * 60 * 1000 - seconds * 1000;

    deletePastReservations(); // at start of program, delete past reservations if any

    setTimeout(() => {
        deletePastReservations();
        setInterval(deletePastReservations, 30*60*1000);
    }, millisToNextHalfHour);
}

runAtNextHalfHour();

function convertToHour(time12h) {
    const [time, modifier] = time12h.split(" ");
    let [hours, minutes] = time.split(":");
 
    if (modifier === "P.M." && hours !== "12") {
        hours = String(parseInt(hours, 10) + 12);
    } else if (modifier === "A.M." && hours === "12") {
        hours = "00";
    }
 
    return `${hours}:${minutes}`;
}
 
function timeToNumber(timeStr) {
    return parseInt(timeStr.replace(':', ''), 10);
}

function getStatus(reservation){
        const reserveDate = new Date(reservation.reservationDate);
        const reservationDate = reserveDate.getFullYear() + '-' + String(reserveDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(reserveDate.getDate()).padStart(2, '0'); // replaced toISOString() since it always converts the time to UTC
        var statusText = "";
        const now = new Date();
        const todayDate = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0'); // replaced toISOString() since it always converts the time to UTC
        var statusText = "";

        // get reservation start and end times
        const startTime = timeToNumber(convertToHour(reservation.startTime));
        const endTime = timeToNumber(convertToHour(reservation.endTime));

        // get current time
        const nowHours = now.getHours().toString().padStart(2, '0');
        const nowMinutes = now.getMinutes().toString().padStart(2, '0');
        const nowTime = parseInt(`${nowHours}${nowMinutes}`, 10);

        if (todayDate === reservationDate && nowTime >= startTime && nowTime < endTime) {
            statusText = "Ongoing";
        } else {
            statusText = "Upcoming";
        }

        return statusText;
    
}

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
