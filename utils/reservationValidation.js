const { timeSlots, endTimeOptions } = require("../database/models/TimeSlotOptions");
const { convertTimeToMinutes } = require("./time");

function normalizeTimeSlot(timeString) {
    if (typeof timeString !== "string") {
        return null;
    }

    const match = timeString.trim().match(/^(\d{1,2}):(\d{2})\s*(A\.?M\.?|P\.?M\.?)$/i);

    if (!match) {
        return null;
    }

    const hours = Number.parseInt(match[1], 10);
    const minutes = match[2];
    const meridiem = match[3].toUpperCase().replace(/\./g, "");

    if (hours < 1 || hours > 12 || !["00", "30"].includes(minutes)) {
        return null;
    }

    if (meridiem !== "AM" && meridiem !== "PM") {
        return null;
    }

    return `${String(hours).padStart(2, "0")}:${minutes} ${meridiem === "AM" ? "A.M." : "P.M."}`;
}

const allowedStartTimeSlots = new Set(timeSlots.map(normalizeTimeSlot).filter(Boolean));
const allowedEndTimeSlots = new Set(endTimeOptions.map(normalizeTimeSlot).filter(Boolean));

function parseSeatNumber(seatNumber) {
    if (typeof seatNumber === "number") {
        return Number.isInteger(seatNumber) ? seatNumber : Number.NaN;
    }

    if (typeof seatNumber !== "string" || seatNumber.trim() === "") {
        return Number.NaN;
    }

    const trimmedSeatNumber = seatNumber.trim();

    if (!/^-?\d+$/.test(trimmedSeatNumber)) {
        return Number.NaN;
    }

    return Number.parseInt(trimmedSeatNumber, 10);
}

function isValidReservationDate(date) {
    const parsedDate = new Date(date);
    return !Number.isNaN(parsedDate.getTime());
}

function validateReservationTimeRange(startTime, endTime) {
    const normalizedStartTime = normalizeTimeSlot(startTime);
    const normalizedEndTime = normalizeTimeSlot(endTime);

    if (!normalizedStartTime || !allowedStartTimeSlots.has(normalizedStartTime)) {
        return {
            isValid: false,
            message: "Start time must be a valid reservation slot"
        };
    }

    if (!normalizedEndTime || !allowedEndTimeSlots.has(normalizedEndTime)) {
        return {
            isValid: false,
            message: "End time must be a valid reservation slot"
        };
    }

    if (convertTimeToMinutes(normalizedEndTime) <= convertTimeToMinutes(normalizedStartTime)) {
        return {
            isValid: false,
            message: "End time must be later than start time"
        };
    }

    return {
        isValid: true,
        startTime: normalizedStartTime,
        endTime: normalizedEndTime
    };
}

module.exports = {
    allowedStartTimeSlots,
    allowedEndTimeSlots,
    isValidReservationDate,
    normalizeTimeSlot,
    parseSeatNumber,
    validateReservationTimeRange
};
