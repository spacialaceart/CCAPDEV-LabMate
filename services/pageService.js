const { PROFILE_SECTION_HASHES } = require("../config/pageConfigs");
const { PROFILE_FIELD_LIMITS } = require("../utils/profileValidation");
const { destroySession, refreshSessionUser } = require("./sessionService");
const {
    getLaboratoryPageData,
    getSortedReservations,
    formatReservationsForList,
    getRemovableReservationIds,
    formatProfileReservation,
    getUpcomingLabSummary
} = require("./reservationService");

function getProfileSectionHash(section) {
    return PROFILE_SECTION_HASHES[section] || "";
}

async function renderHomePage(req, res, pageConfig) {
    const user = await refreshSessionUser(req);

    if (!user) {
        console.log("User no longer exists in database. Destroying session...");
        return destroySession(req, res, () => res.redirect("/signin-page"));
    }

    res.render("home", {
        user: req.session.user,
        ...pageConfig
    });
}

async function renderLaboratoryPage(req, res, viewName, userFields, pageConfig = {}, includeUser = false) {
    try {
        const pageData = await getLaboratoryPageData(userFields);
        const viewModel = {
            ...pageData,
            ...pageConfig
        };

        if (includeUser) {
            viewModel.user = req.session.user;
        }

        res.render(viewName, viewModel);
    } catch (error) {
        console.error("Error fetching laboratories:", error);
        res.status(500).send("Internal Server Error");
    }
}

async function renderReservationsPage(req, res, query, pageConfig, includeRemovableReservations = false) {
    try {
        const reservations = await getSortedReservations(query);
        const removableReservationIds = includeRemovableReservations
            ? new Set(getRemovableReservationIds(reservations).map((reservationId) => reservationId.toString()))
            : null;
        const formattedReservations = formatReservationsForList(reservations).map((reservation) => ({
            ...reservation,
            canRemove: !removableReservationIds || removableReservationIds.has(reservation._id.toString())
        }));
        const viewModel = {
            reservations: formattedReservations,
            user: req.session.user,
            ...pageConfig
        };

        res.render("reservations", viewModel);
    } catch (error) {
        console.error("Error fetching reservations:", error);
        res.status(500).send("Internal Server Error");
    }
}

async function renderProfilePage(req, res, reservationQuery) {
    const reservations = await getSortedReservations(
        reservationQuery,
        "laboratoryRoom reservationDate startTime endTime seatNumber"
    );

    res.render("profile", {
        upcomingLab: getUpcomingLabSummary(reservations),
        reservations: reservations.map(formatProfileReservation),
        user: req.session.user,
        profileFieldLimits: PROFILE_FIELD_LIMITS
    });
}

function createProfileSectionRedirectHandler(profilePath) {
    return (req, res) => {
        res.redirect(`${profilePath}${getProfileSectionHash(req.params.section)}`);
    };
}

module.exports = {
    renderHomePage,
    renderLaboratoryPage,
    renderReservationsPage,
    renderProfilePage,
    createProfileSectionRedirectHandler
};
