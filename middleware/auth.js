const { getHomePathByType } = require("../services/sessionService");

function isAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect("/signin-page");
    }
}

function createRoleGuard(expectedType, fallbackRedirectPath = "/student-home") {
    const expectedTypes = Array.isArray(expectedType) ? expectedType : [expectedType];

    return (req, res, next) => {
        if (!req.session.user) {
            //NEW: Add logging for unauthenticated access attempts
            addApplicationLog({
                actorName: "Guest",
                actorType: "Guest",
                action: "ACCESS_DENIED",
                target: req.originalUrl,
                metadata: "Unauthenticated access attempt"
            });
            return res.redirect("/signin-page");
        }

        if (!expectedTypes.includes(req.session.user.type)) {
            //NEW: Add logging for unauthorized role access attempts
            addApplicationLog({
                actorName: req.session.user.email,
                actorType: req.session.user.type,
                action: "ACCESS_DENIED",
                target: req.originalUrl,
                metadata: "Unauthorized role access attempt"
            });

            return res.redirect(getHomePathByType(req.session.user.type) || fallbackRedirectPath);
        }

        next();
    };
}

const requireStudent = createRoleGuard("Student");
const requireLabtech = createRoleGuard("LabTech");
const requireAdmin = createRoleGuard("Admin");

module.exports = {
    isAuth,
    createRoleGuard,
    requireStudent,
    requireLabtech,
    requireAdmin
};
