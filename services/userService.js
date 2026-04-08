const path = require("path");
const argon2 = require("argon2");
const User = require("../database/models/User");
const Reservation = require("../database/models/Reservation");
const {
    validateProfileField
} = require("../utils/profileValidation");

const UPLOADS_DIRECTORY = path.join(__dirname, "..", "public", "uploads");

function formatRoleLabel(type) {
    if (type === "LabTech") {
        return "Lab Tech";
    }

    if (type === "Admin") {
        return "Administrator";
    }

    return "Student";
}

async function findUserById(userId) {
    return User.findById(userId);
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
        isLabTech: user.type === "LabTech",
        userType: user.type,
        roleLabel: formatRoleLabel(user.type)
    };
}

function buildBasicUserData(user) {
    return {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isLabTech: user.type === "LabTech",
        userType: user.type,
        roleLabel: formatRoleLabel(user.type)
    };
}

async function updateUserProfile(userId, body, files) {
    const user = await User.findById(userId);

    if (!user) {
        return null;
    }

    const departmentError = validateProfileField(body.department, "department", "Department");
    if (departmentError) {
        const error = new Error(departmentError);
        error.status = 400;
        throw error;
    }

    const biographyError = validateProfileField(body.biography, "biography", "Biography");
    if (biographyError) {
        const error = new Error(biographyError);
        error.status = 400;
        throw error;
    }

    if (Object.prototype.hasOwnProperty.call(body, "department")) {
        user.department = body.department.trim();
    }

    if (Object.prototype.hasOwnProperty.call(body, "biography")) {
        user.biography = body.biography.trim();
    }

    if (files && files.image) {
        const image = files.image;
        const uploadPath = path.join(UPLOADS_DIRECTORY, `${user._id}_${image.name}`);

        await image.mv(uploadPath);
        user.image = `/uploads/${user._id}_${image.name}`;
    }

    await user.save();
    return user;
}

async function updateUserPassword(userId, newPassword) {
    const user = await User.findById(userId);

    if (!user) {
        return null;
    }

    user.password = await argon2.hash(newPassword);
    await user.save();

    return user;
}

async function deleteUserAccount(userId, password) {
    const user = await User.findById(userId);

    if (!user) {
        return {
            status: 404,
            body: { message: "User not found" }
        };
    }

    const matchPass = await argon2.verify(user.password, password);
    if (!matchPass) {
        return {
            status: 401,
            body: { message: "Incorrect password" }
        };
    }

    await Reservation.deleteMany({ userId });
    await User.findByIdAndDelete(userId);

    return {
        status: 200,
        body: { success: true, message: "Account deleted successfully" }
    };
}

async function updateSecurityAnswer(userId, newAnswer) {
    const user = await User.findById(userId);

    if (!user) {
        return null;
    }

    user.securityAnswer = await argon2.hash(newAnswer);
    await user.save();

    return user;
}

module.exports = {
    findUserById,
    buildDetailedUserData,
    buildBasicUserData,
    updateUserProfile,
    updateUserPassword,
    deleteUserAccount,
    updateSecurityAnswer
};
