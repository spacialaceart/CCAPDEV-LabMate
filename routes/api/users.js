const express = require("express");
const { isAuth } = require("../../middleware/auth");
const {
    findUserById,
    buildDetailedUserData,
    buildBasicUserData,
    updateUserProfile,
    updateUserPassword,
    deleteUserAccount
} = require("../../services/userService");

const User = require("../../database/models/User");
const argon2 = require("argon2");

const { addApplicationLog } = require("../../services/applicationLogService");

function validatePassword(newPass) {
  const errors = [];

  if (newPass.length < 8) {
    errors.push(" must be at least 8 characters long");
  }

  if (!/[a-z]/.test(newPass)) {
    errors.push(" must include at least one lowercase letter");
  }

  if (!/[A-Z]/.test(newPass)) {
    errors.push(" must include at least one uppercase letter");
  }

  if (!/\d/.test(newPass)) {
    errors.push(" must include at least one number");
  }

  if (!/[^A-Za-z\d]/.test(newPass)) {
    errors.push(" must include at least one special character");
  }

  if (errors.length > 0) {
    errors[0] = "Password" + errors[0];
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

const router = express.Router();

router.get("/api/session", (req, res) => {
    if (req.session && req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.status(401).json({ error: "No user session found" });
    }
});

router.get("/api/user/details/:id", async (req, res) => {
    try {
        console.log(`Fetching detailed user info with ID: ${req.params.id}`);
        const user = await findUserById(req.params.id);

        if (!user) {
            console.log(`User not found with ID: ${req.params.id}`);
            return res.status(404).json({ message: "User not found" });
        }

        const userDetails = buildDetailedUserData(user);

        console.log(`Found detailed user info: ${JSON.stringify(userDetails)}`);
        res.json(userDetails);
    } catch (error) {
        console.error(`Error finding detailed user info: ${error.message}`);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

router.get("/api/user/:id", async (req, res) => {
    try {
        console.log(`Fetching user with ID: ${req.params.id}`); 
        const user = await findUserById(req.params.id);

        if (!user) {
            console.log(`User not found with ID: ${req.params.id}`);
            return res.status(404).json({ message: "User not found" });
        }

        const userData = buildBasicUserData(user);

        console.log(`Found user: ${JSON.stringify(userData)}`);
        res.json(userData);
    } catch (error) {
        console.error(`Error finding user: ${error.message}`);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

router.put("/api/user/update", isAuth, async (req, res) => {
    try {
        console.log(`Updating user with ID: ${req.session.user._id}`, req.body);

        const user = await updateUserProfile(req.session.user._id, req.body, req.files);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        req.session.user = user.toObject();

        res.json({
            success: true,
            message: "Profile updated successfully",
            user
        });
    } catch (error) {
        console.error(`Error updating user: ${error.message}`);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

router.put("/api/user/password", isAuth, async (req, res) => {
    try {
        const { oldPassword, newPassword, confirmPassword } = req.body;
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match." });
        } 

        const email = req.session.user?.email;
        if (!email) {
            return res.status(400).json({ success: false, message: "No email found." });
        } 

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ success: false, message: "No user found." });
        } 

        // NEW: Prevent password reuse
        if (user.passwordHistory) {
            for (const oldHash of user.passwordHistory) {
                const isReuse = await argon2.verify(oldHash, newPassword);
                if (isReuse) {
                    return res.status(400).json({
                        success: false, message: "You cannot reuse a previous password."
                    });
                }
            }
        }

        try {
            const passMatch = await argon2.verify(user.password, oldPassword);
            if (!passMatch) {
                return res.status(400).json({ success: false, message: "Old password is incorrect." });
            }
        } catch (verifyError) {
            console.error("Password verification error:", verifyError.message);

            if (verifyError.message.includes("must contain a $ as first char")) {
                return res.status(401).json({
                    success: false,
                    error: "There was an issue with your password. Please try again later or contact support."
                });
            }

            return res.status(401).json({ success: false, error: "Authentication failed. Please try again." });
        }

        const passStrengthCheck = validatePassword(newPassword);
        if(!passStrengthCheck.isValid) {
            return res.status(400).json({ success: false, message: passStrengthCheck.errors });
        }

        // NEW: Enforce 1-day rule
        const ONE_DAY = 24 * 60 * 60 * 1000;
        if (user.lastPasswordChange && (Date.now() - user.lastPasswordChange < ONE_DAY)) {
            return res.status(400).json({
                success: false, message: "Password can only be changed once per day."
            });
        }

        // NEW: Save current password to history
        if (!user.passwordHistory) user.passwordHistory = [];
        const newHashedPassword = await argon2.hash(newPassword);
        user.passwordHistory.push(newHashedPassword);

        // limit history to last 3 passwords
        if (user.passwordHistory.length > 3) {
            user.passwordHistory.shift();
        } 

        await user.save();

        const user2 = await updateUserPassword(req.session.user._id, newPassword);

        req.session.user = user2.toObject();

        // NEW: Update timestamp
        user.lastPasswordChange = Date.now();

        // Logging
        addApplicationLog({
            actorName: `${user.firstName} ${user.lastName}`,
            actorType: user.type,
            action: "CHANGE_PASSWORD",
            target: user.email
        });

        return res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        console.error("Error during password change:", error.message, error.stack);
        res.status(500).json({ success: false, error: "An error occurred during password change" });
    }
});

router.delete("/api/user/delete", isAuth, async (req, res) => {
    try {
        console.log(`Attempting to delete user account with ID: ${req.session.user._id}`);

        const result = await deleteUserAccount(req.session.user._id, req.body.password);
        res.status(result.status).json(result.body);
    } catch (error) {
        console.error(`Error deleting user account: ${error.message}`);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

module.exports = router;
