const mongoose = require("mongoose");
const { convertTimeToMinutes } = require("../../utils/time");
const {
    normalizeTimeSlot,
    allowedStartTimeSlots,
    allowedEndTimeSlots
} = require("../../utils/reservationValidation");

const ReservationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    studentName: {type: String,}, // optional (for reservations made by the labtech). 
    laboratoryRoom: { type: String, required: true },
    seatNumber: {
        type: Number,
        required: true,
        min: [1, "Seat number must be a positive whole number"],
        validate: {
            validator: Number.isInteger,
            message: "Seat number must be a positive whole number"
        }
    },
    bookingDate: { type: Date, required: true }, // booking time can be extracted from this
    reservationDate: { type: Date, required: true }, 
    startTime: {
        type: String,
        required: true,
        set: (value) => normalizeTimeSlot(value) ?? value,
        validate: {
            validator: (value) => allowedStartTimeSlots.has(normalizeTimeSlot(value)),
            message: "Start time must be a valid reservation slot"
        }
    },
    endTime: {
        type: String,
        required: true,
        set: (value) => normalizeTimeSlot(value) ?? value,
        validate: [
            {
                validator: (value) => allowedEndTimeSlots.has(normalizeTimeSlot(value)),
                message: "End time must be a valid reservation slot"
            },
            {
                validator: function(value) {
                    const normalizedStartTime = normalizeTimeSlot(this.startTime);
                    const normalizedEndTime = normalizeTimeSlot(value);

                    return Boolean(normalizedStartTime && normalizedEndTime) &&
                        convertTimeToMinutes(normalizedEndTime) > convertTimeToMinutes(normalizedStartTime);
                },
                message: "End time must be later than start time"
            }
        ]
    },
    isAnonymous: { type: Boolean, default: false } // Whether the reservation should be shown anonymously
});

const Reservation = mongoose.model("Reservation", ReservationSchema);

module.exports = Reservation
