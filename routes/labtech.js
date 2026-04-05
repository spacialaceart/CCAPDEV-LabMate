const express = require("express");
const {
    HOME_PAGE_CONFIGS,
    LABORATORY_PAGE_CONFIGS,
    RESERVATIONS_PAGE_CONFIGS
} = require("../config/pageConfigs");
const { isAuth, requireLabtech } = require("../middleware/auth");
const {
    renderHomePage,
    renderLaboratoryPage,
    renderReservationsPage,
    renderProfilePage,
    createProfileSectionRedirectHandler
} = require("../services/pageService");
const { getApplicationLogs } = require("../services/applicationLogService");
const { createReservationAndRedirect } = require("../services/reservationService");

const router = express.Router();

router.get("/labtech-home", isAuth, requireLabtech, async (req, res) => {
    const currentUser = req.session.user;

    const logs = getApplicationLogs();

    const userSigninLogs = logs.filter(entry =>
        entry.metadata == currentUser.email &&
        entry.action == "POST /signin"
        
    ); 

    const FIFTEEN_MINUTES = 15 * 60 * 1000;
    const now = Date.now();

    const validLogs = userSigninLogs.filter(entry => {
        const logTime = new Date(entry.timestamp).getTime();
        return (now - logTime) > FIFTEEN_MINUTES;
    });

    let lastLogin = null;
    if (validLogs.length > 0) {
        lastLogin = validLogs[validLogs.length - 1];
    }

    let displayTimestamp = null;

    if (lastLogin) {
        displayTimestamp = new Date(lastLogin.timestamp).toLocaleString("en-PH", {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
    }
    
    await renderHomePage(req, res, {
        ...HOME_PAGE_CONFIGS.labtech,
        lastLogin: displayTimestamp
    });
    //await renderHomePage(req, res, HOME_PAGE_CONFIGS.labtech);
});

router.get("/labtech-laboratories", isAuth, requireLabtech, async (req, res) => {
    await renderLaboratoryPage(
        req,
        res,
        "laboratories",
        "firstName lastName type",
        LABORATORY_PAGE_CONFIGS.labtech,
        true
    );
});

router.get("/labtech-reservations", isAuth, requireLabtech, async (req, res) => {
    await renderReservationsPage(
        req,
        res,
        {},
        RESERVATIONS_PAGE_CONFIGS.labtech,
        true
    );
});

router.get("/labtech-profile", isAuth, requireLabtech, async (req, res) => {
    await renderProfilePage(req, res, { userId: req.session.user._id });
});

router.get(
    "/labtech-profile-:section",
    isAuth,
    requireLabtech,
    createProfileSectionRedirectHandler("/labtech-profile")
);

router.post("/create-reservation-labtech", isAuth, requireLabtech, async (req, res) => {
    try {
        await createReservationAndRedirect(req, res, "/labtech-reservations");
    } catch (error) {
        console.error("Error creating reservation:", error);
        res.status(500).send("An error occurred while creating the reservation");
    }
});

module.exports = router;
