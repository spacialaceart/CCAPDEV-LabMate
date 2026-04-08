const mongoose = require('mongoose')
const { PROFILE_FIELD_LIMITS } = require("../../utils/profileValidation");

const PostSchema = new mongoose.Schema({
    type: { type: String, enum: ["Student", "LabTech", "Admin"], required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    image: { type: String, default: "/img/default-profile.png" },
    email: { type: String, required: true, unique: true},
    password: { type: String, required: true },
    biography: {
        type: String,
        default: "No biography provided yet.",
        maxlength: [PROFILE_FIELD_LIMITS.biography, `Biography must not exceed ${PROFILE_FIELD_LIMITS.biography} characters.`]
    },
    department: {
        type: String,
        default: "N/A",
        trim: true,
        required: [true, "Please fill in all required fields."],
        maxlength: [PROFILE_FIELD_LIMITS.department, `Department must not exceed ${PROFILE_FIELD_LIMITS.department} characters.`]
    },

    //account lockout fields
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },

    //password history fields
    passwordHistory: {
    type: [String],
    default: []
    },
    lastPasswordChange: {
        type: Date,
        default: Date.now
    },

    /*account lockout fields
    failedLoginAttempts: {
    type: Number,
    default: 0
    },
    lockUntil: {
        type: Date,
        default: null
    },*/

    securityAnswer: { type: String, default: null }
})

const User = mongoose.model('User', PostSchema)

module.exports = User
