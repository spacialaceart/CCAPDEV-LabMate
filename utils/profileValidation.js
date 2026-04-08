const PROFILE_FIELD_LIMITS = {
    department: 100,
    biography: 500
};

const REQUIRED_PROFILE_FIELDS = new Set(["department"]);
const PROFILE_TEXT_DISALLOWED_PATTERN = /[<>]/;

function validateProfileField(value, fieldName, fieldLabel) {
    if (typeof value !== "string") {
        return null;
    }

    const normalizedValue = value.trim();

    if (REQUIRED_PROFILE_FIELDS.has(fieldName) && normalizedValue.length === 0) {
        return "Please fill in all required fields.";
    }

    if (PROFILE_TEXT_DISALLOWED_PATTERN.test(value)) {
        return `${fieldLabel} cannot contain angle brackets or HTML-like input.`;
    }

    const maxLength = PROFILE_FIELD_LIMITS[fieldName];

    if (maxLength && value.length > maxLength) {
        return `${fieldLabel} must not exceed ${maxLength} characters.`;
    }

    return null;
}

module.exports = {
    PROFILE_FIELD_LIMITS,
    PROFILE_TEXT_DISALLOWED_PATTERN,
    validateProfileField
};
