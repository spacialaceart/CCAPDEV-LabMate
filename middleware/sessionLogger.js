const { addApplicationLog } = require("../services/applicationLogService");

function logSessionState(req, res, next) {
    const hasUser = Boolean(req.session && req.session.user);

    if (req.session && req.session.user) {
        const rememberPeriodDays = ((req.session.cookie?.maxAge ?? 0) / (24 * 60 * 60 * 1000)).toFixed(1);

        console.log(
            "Current session user:",
            `${req.session.user.firstName} ${req.session.user.lastName}`,
            "/ Times visited:", req.session.visitCount,
            "/ Remember period:", `${rememberPeriodDays} days`
        );
    } else {
        console.log("No user is currently logged in.");
    }

    metadata = null;
    metadata = req.body?.email;

    addApplicationLog({
        actorName: hasUser ? `${req.session.user.firstName} ${req.session.user.lastName}` : "Guest",
        actorType: hasUser ? req.session.user.type : "Guest",
        action: `${req.method} ${req.originalUrl}`,
        target: "HTTP_REQUEST",
        metadata
    });

    next();
}

module.exports = {
    logSessionState
};
