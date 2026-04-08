const express = require("express");
const argon2 = require("argon2");
const User = require("../database/models/User");
const { REMEMBER_ME_DURATION_MS } = require("../config/pageConfigs");
const { renderLaboratoryPage } = require("../services/pageService");
const {
    createGuestOnlyPageHandler,
    redirectToUserHome,
    refreshSessionUser,
    destroySession
} = require("../services/sessionService");
const {
    updateUserPassword
} = require("../services/userService");
const { addApplicationLog } = require("../services/applicationLogService");

const router = express.Router();

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

router.get("/", async (req, res) => {
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

router.get("/about", (req, res) => {
    res.render("about");
});

router.get("/signin-page", createGuestOnlyPageHandler("signin-page"));
router.get("/signup-page", createGuestOnlyPageHandler("signup-page"));
router.get("/forgotpass-page", createGuestOnlyPageHandler("forgotpass-page"));

router.post("/signin", async (req, res) => {
    try {
        let { email, password, rememberMe } = req.body;
        email = email.toLowerCase();

        console.log("Received sign-in request for email:", email);

        //NEW: add logging for missing fields
        if (!email || !password) {

            addApplicationLog({
                actorName: "Guest",
                actorType: "Guest",
                action: "VALIDATION_FAILED",
                target: "SIGN_IN",
                metadata: "Missing email or password"
            });

            return res.status(400).json({ error: "Email and password are required" });
        }

        const user = await User.findOne({ email });

        if (!user) {
            addApplicationLog({
                actorName: email,
                actorType: "Guest",
                action: "SIGN_IN_FAILED",
                target: "SIGN_IN",
                metadata: "Attempted sign-in with a nonexistent account"
            });

            return res.status(401).json({ error: "Invalid username and/or password." }); 
        }

        //NEW: check for account lockout before verifying password
        if (user.lockUntil && user.lockUntil > Date.now()) {
            return res.status(403).json({
                error: "Account is temporarily locked. Please try again later."
            });
        }

        try {
            const passMatch = await argon2.verify(user.password, password);

        
            if (!passMatch) {
                user.failedLoginAttempts += 1;

                //account lock for 15 mins after 5 failed attempts
                if (user.failedLoginAttempts >= 5) {
                    user.lockUntil = Date.now() + (15 * 60 * 1000); // 15 mins

                    addApplicationLog({
                        actorName: user.email,
                        actorType: user.type,
                        action: "ACCOUNT_LOCKED",
                        target: user.email
                    });
                }

                await user.save();

                return res.status(401).json({
                    error: "Invalid username and/or password."
                });
            }

        } catch (verifyError) {
            console.error("Password verification error:", verifyError.message);

            return res.status(401).json({ error: "Authentication failed. Please try again." });
        }

        // if success restore default values for lockout and failed attempts
        user.failedLoginAttempts = 0;
        user.lockUntil = null;
        await user.save();

        req.session.user = user.toObject();

        if (rememberMe) {
            req.session.cookie.maxAge = REMEMBER_ME_DURATION_MS;
        } else {
            req.session.cookie.expires = false;
        }

        req.session.visitCount = 1;

        addApplicationLog({
            actorName: `${user.firstName} ${user.lastName}`,
            actorType: user.type,
            action: "SIGN_IN",
            target: user.email
        });

        return redirectToUserHome(res, user.type);
    } catch (error) {
        console.error("Error during sign-in:", error.message, error.stack);
        res.status(500).json({ error: "An error occurred during sign-in" });
    }
});

router.post("/signup", async (req, res) => {
    try {
        let { firstName, lastName, email, newPass, confirmPass, type, securityAnswer } = req.body;
        email = email.toLowerCase();
        type = type || "Student";

        console.log("Received sign-up request:", { firstName, lastName, email, type });

        if (!firstName || !lastName || !email || !newPass || !confirmPass || !securityAnswer) {
            //NEW: add logging for missing fields
            addApplicationLog({
                actorName: "Guest",
                actorType: "Guest",
                action: "VALIDATION_FAILED",
                target: "SIGN_UP",
                metadata: "Missing required fields"
            });

            return res.status(400).json({ error: "All fields are required" });
        }

        const passStrengthCheck = validatePassword(newPass);
        if (!passStrengthCheck.isValid) {
            //NEW: add logging for password strength failure
            addApplicationLog({
                actorName: email,
                actorType: "Guest",
                action: "VALIDATION_FAILED",
                target: "SIGN_UP",
                metadata: passStrengthCheck.errors.join(", ")
            });

            return res.status(400).json({ error: passStrengthCheck.errors });
        }

       //if (newPassword !== confirmPassword) {
       if (newPass !== confirmPass) {
            //NEW: add logging for password mismatch
            addApplicationLog({
                actorName: email,
                actorType: "Guest",
                action: "VALIDATION_FAILED",
                target: "SET_PASSWORD",
                metadata: "Passwords do not match"
            });

            return res.status(400).json({ error: "Passwords do not match" });
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(400).json({ error: "Email is already in use" });
        }

        if (type !== "Student") {
            return res.status(403).json({
                error: "Only student accounts can be self-registered. LabTech and Admin accounts must be created by an Administrator."
            });
        }

        const hashPass = await argon2.hash(newPass);
        const hashAns = await argon2.hash(securityAnswer);

        const newUser = new User({
            firstName,
            lastName,
            email,
            password: hashPass,
            type: "Student",
            //NEW: initialize password history
            passwordHistory: [hashPass],

            //NEW: track last successful password change
            lastPasswordChange: Date.now(),
            failedLoginAttempts: 0,
            lockUntil: null,
            securityAnswer: hashAns
        });

        await newUser.save();
        console.log("New Student user created:", newUser._id);

        req.session.user = newUser.toObject();
        req.session.visitCount = 1;

        addApplicationLog({
            actorName: `${newUser.firstName} ${newUser.lastName}`,
            actorType: newUser.type,
            action: "SIGN_UP",
            target: newUser.email
        });

        return redirectToUserHome(res, newUser.type);
    } catch (error) {
        console.error("Error during sign-up:", error);
        res.status(500).json({ error: "An error occurred during sign-up" });
    }
});

router.get("/signedout-laboratories", async (req, res) => {
    await renderLaboratoryPage(req, res, "signedout-laboratories", "firstName lastName isAnonymous type");
});

router.get("/logout", (req, res) => { 
    console.log("Destroying session and clearing remember me period...");

    if (req.session?.user) {
        addApplicationLog({
            actorName: `${req.session.user.firstName} ${req.session.user.lastName}`,
            actorType: req.session.user.type,
            action: "SIGN_OUT",
            target: req.session.user.email
        });
    }

    destroySession(req, res, () => res.redirect("/"));
});

router.post("/resetpassword", async (req, res) => {
    try {
        const { email, securityQuestion } = req.body;

        if (!email || !securityQuestion) {
            return res.status(400).json({ success: false, message: "Failed to read inputs." });
        } 

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ success: false, message: "User not found or answer is incorrect." });
        } 

        try {
            const ansMatch = await argon2.verify(user.securityAnswer, securityQuestion);
            if (!ansMatch) {
                return res.status(400).json({ success: false, message: "User not found or answer is incorrect." });
            }
        } catch (verifyError) {
            console.error("Security verification error:", verifyError.message);

            if (verifyError.message.includes("must contain a $ as first char")) {
                return res.status(401).json({
                    success: false,
                    message: "There was an issue with your security question. Please try again later or contact support."
                });
            }

            return res.status(401).json({ success: false, message: "Authentication failed. Please try again." });
        }

        const user2 = await updateUserPassword(user._id, "NewPassword123!");

        //req.session.user = user2.toObject();

        // Logging
        addApplicationLog({
            actorName: `${user.firstName} ${user.lastName}`,
            actorType: user.type,
            action: "RESET_PASSWORD", 
            target: user.email
        });

        return res.json({ success: true, message: "Your password has been changed to NewPassword123!" });
    } catch (error) {
        console.error("Error during password reset:", error.message, error.stack);
        res.status(500).json({ success: false, message: "An error occurred during password reset" });
    }
});

module.exports = router;
