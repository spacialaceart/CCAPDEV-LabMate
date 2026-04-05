const express = require("express");
const argon2 = require("argon2");
const User = require("../database/models/User");
const { isAuth, requireAdmin } = require("../middleware/auth");
const {
    renderProfilePage,
    createProfileSectionRedirectHandler
} = require("../services/pageService");
const { addApplicationLog, getApplicationLogs } = require("../services/applicationLogService");

const router = express.Router();
const MANAGED_SOURCE_ROLES = ["LabTech", "Admin"];
const ASSIGNABLE_ROLES = ["LabTech", "Admin"];

function buildAdminActor(req) {
    return {
        actorName: `${req.session.user.firstName} ${req.session.user.lastName}`,
        actorType: req.session.user.type
    };
}

function buildRedirect(path, key, value) {
    const params = new URLSearchParams({ [key]: value });
    return `${path}?${params.toString()}`;
}

router.get("/admin-home", isAuth, requireAdmin, (req, res) => {
    res.redirect("/admin-accounts");
});

router.get("/admin-accounts", isAuth, requireAdmin, async (req, res) => {
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

    const privilegedUsers = await User.find({ type: { $in: MANAGED_SOURCE_ROLES } })
        .sort({ type: 1, firstName: 1, lastName: 1 })
        .lean();

    res.render("admin-accounts", {
        user: req.session.user,
        privilegedUsers,
        message: req.query.message,
        error: req.query.error,
        lastLogin: displayTimestamp
    });
});

router.post("/admin-accounts", isAuth, requireAdmin, async (req, res) => {
    try {
        const { firstName, lastName, email, password, confirmPassword, type } = req.body;

        if (!firstName || !lastName || !email || !password || !confirmPassword || !type) {
            return res.redirect(buildRedirect("/admin-accounts", "error", "All fields are required."));
        }

        if (!ASSIGNABLE_ROLES.includes(type)) {
            return res.redirect(buildRedirect("/admin-accounts", "error", "Only LabTech or Admin accounts can be created here."));
        }

        if (password !== confirmPassword) {
            return res.redirect(buildRedirect("/admin-accounts", "error", "Passwords do not match."));
        }

        const normalizedEmail = email.toLowerCase();
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.redirect(buildRedirect("/admin-accounts", "error", "Email is already in use."));
        }

        const hashedPassword = await argon2.hash(password);

        const createdUser = await User.create({
            firstName,
            lastName,
            email: normalizedEmail,
            password: hashedPassword,
            type
        });

        addApplicationLog({
            ...buildAdminActor(req),
            action: "CREATE_PRIVILEGED_ACCOUNT",
            target: createdUser.email,
            metadata: `Assigned role ${type}`
        });

        return res.redirect(buildRedirect("/admin-accounts", "message", `${type} account created successfully.`));
    } catch (error) {
        console.error("Error creating privileged account:", error);
        return res.redirect(buildRedirect("/admin-accounts", "error", "Failed to create privileged account."));
    }
});

router.post("/admin-accounts/:id/role", isAuth, requireAdmin, async (req, res) => {
    try {
        const { type } = req.body;

        if (!ASSIGNABLE_ROLES.includes(type)) {
            return res.redirect(buildRedirect("/admin-accounts", "error", "Invalid role assignment."));
        }

        const targetUser = await User.findById(req.params.id);

        if (!targetUser || !MANAGED_SOURCE_ROLES.includes(targetUser.type)) {
            return res.redirect(buildRedirect("/admin-accounts", "error", "Privileged account not found."));
        }

        if (targetUser.type === "Admin" && type !== "Admin") {
            if (targetUser._id.toString() === req.session.user._id.toString()) {
                return res.redirect(buildRedirect("/admin-accounts", "error", "You cannot remove your own Admin role."));
            }

            const adminCount = await User.countDocuments({ type: "Admin" });
            if (adminCount <= 1) {
                return res.redirect(buildRedirect("/admin-accounts", "error", "At least one Administrator account must remain."));
            }
        }

        const previousRole = targetUser.type;
        targetUser.type = type;
        await targetUser.save();

        addApplicationLog({
            ...buildAdminActor(req),
            action: "ASSIGN_PRIVILEGED_ROLE",
            target: targetUser.email,
            metadata: `Changed role from ${previousRole} to ${type}`
        });

        return res.redirect(buildRedirect("/admin-accounts", "message", "Role updated successfully."));
    } catch (error) {
        console.error("Error assigning role:", error);
        return res.redirect(buildRedirect("/admin-accounts", "error", "Failed to assign role."));
    }
});

router.post("/admin-accounts/:id/delete", isAuth, requireAdmin, async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.id);

        if (!targetUser || !MANAGED_SOURCE_ROLES.includes(targetUser.type)) {
            return res.redirect(buildRedirect("/admin-accounts", "error", "Privileged account not found."));
        }

        if (targetUser._id.toString() === req.session.user._id.toString()) {
            return res.redirect(buildRedirect("/admin-accounts", "error", "You cannot delete your own account."));
        }

        if (targetUser.type === "Admin") {
            const adminCount = await User.countDocuments({ type: "Admin" });
            if (adminCount <= 1) {
                return res.redirect(buildRedirect("/admin-accounts", "error", "At least one Administrator account must remain."));
            }
        }

        await User.findByIdAndDelete(targetUser._id);

        addApplicationLog({
            ...buildAdminActor(req),
            action: "DELETE_PRIVILEGED_ACCOUNT",
            target: targetUser.email,
            metadata: `Deleted ${targetUser.type} account`
        });

        return res.redirect(buildRedirect("/admin-accounts", "message", "Account deleted successfully."));
    } catch (error) {
        console.error("Error deleting account:", error);
        return res.redirect(buildRedirect("/admin-accounts", "error", "Failed to delete account."));
    }
});

router.get("/admin-logs", isAuth, requireAdmin, (req, res) => {
    const logs = getApplicationLogs().map((entry) => ({
        ...entry,
        displayTimestamp: new Date(entry.timestamp).toLocaleString("en-PH", {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        })
    }));

    res.render("admin-logs", {
        user: req.session.user,
        logs
    });
});

router.get("/admin-profile", isAuth, requireAdmin, async (req, res) => {
    await renderProfilePage(req, res, { userId: req.session.user._id });
});

router.get(
    "/admin-profile-:section",
    isAuth,
    requireAdmin,
    createProfileSectionRedirectHandler("/admin-profile")
);

module.exports = router;
