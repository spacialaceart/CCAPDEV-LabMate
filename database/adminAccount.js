require("../config/loadEnv");

const argon2 = require("argon2");

const User = require("./models/User");
const { demoAdmins } = require("./seedData");

function getDefaultAdminSeed() {
    const defaultAdminSeed = demoAdmins[0];

    if (!defaultAdminSeed) {
        throw new Error("No demo admin account is defined in database/seedData.js.");
    }

    return defaultAdminSeed;
}

async function ensureAdminAccount() {
    const defaultAdminSeed = getDefaultAdminSeed();
    const adminCount = await User.countDocuments({ type: "Admin" });

    if (adminCount > 0) {
        return false;
    }

    const existingAdminByEmail = await User.findOne({ email: defaultAdminSeed.email });

    if (existingAdminByEmail) {
        existingAdminByEmail.type = "Admin";
        await existingAdminByEmail.save();
        console.log(`Promoted existing ${defaultAdminSeed.email} account to Admin role.`);
        return true;
    }

    const defaultAdminPassword = await argon2.hash(defaultAdminSeed.password);
    const defaultAdminSecurityAnswer = defaultAdminSeed.securityAnswer
        ? await argon2.hash(defaultAdminSeed.securityAnswer)
        : null;
    const { password, securityAnswer, ...defaultAdminProfile } = defaultAdminSeed;

    await User.create({
        ...defaultAdminProfile,
        password: defaultAdminPassword,
        securityAnswer: defaultAdminSecurityAnswer
    });

    console.log(`Created default Administrator account (${defaultAdminSeed.email}).`);
    return true;
}

module.exports = {
    getDefaultAdminSeed,
    ensureAdminAccount
};
