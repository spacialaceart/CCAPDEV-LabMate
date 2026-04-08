const { getHomePathByType } = require("../services/sessionService");
const { addApplicationLog } = require("../services/applicationLogService");

function isAuth(req, res, next) {
    if (req.session.user) {
        //NEW: Add logging for successful authentication
        addApplicationLog({
            actorName: req.session.user.email,
            actorType: req.session.user.type,
            action: "AUTH_SUCCESS",
            target: req.originalUrl
        });
        next();
    } else {
        //NEW: Add logging for failed authentication attempts
        addApplicationLog({
            actorName: "Guest",
            actorType: "Guest",
            action: "AUTH_FAILED",
            target: req.originalUrl
        });

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
            const redirectPath = getHomePathByType(req.session.user.type) || fallbackRedirectPath;
            const deniedAction = expectedTypes.includes("Admin")
                ? "UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT"
                : "ACCESS_DENIED";

            console.warn(
                `[${deniedAction}] ${req.session.user.email} (${req.session.user.type}) attempted ${req.originalUrl}; redirected to ${redirectPath}`
            );

            //NEW: Add logging for unauthorized role access attempts
            addApplicationLog({
                actorName: req.session.user.email,
                actorType: req.session.user.type,
                action: deniedAction,
                target: req.originalUrl,
                metadata: `Unauthorized role access attempt. Expected role: ${expectedTypes.join(", ")}. Redirected to: ${redirectPath}`
            });

            return res.redirect(redirectPath);
        }
        //NEW: Add logging for successful role access
        addApplicationLog({
            actorName: req.session.user.email,
            actorType: req.session.user.type,
            action: "ACCESS_GRANTED",
            target: req.originalUrl,
            metadata: `Access granted for role: ${req.session.user.type}`
        });
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
