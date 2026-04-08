const express = require("express");
const Reservation = require("../../database/models/Reservation");
const Laboratory = require("../../database/models/Laboratory");
const { addApplicationLog } = require("../../services/applicationLogService");
const {
    isValidReservationDate,
    parseSeatNumber,
    validateReservationTimeRange
} = require("../../utils/reservationValidation");
const { hasReservationConflict } = require("../../services/reservationService");

const router = express.Router();

function logValidationFailureForSessionUser(req, target, metadata) {
    const sessionUser = req.session?.user;

    addApplicationLog({
        actorName: sessionUser ? `${sessionUser.firstName} ${sessionUser.lastName}` : "Unknown User",
        actorType: sessionUser?.type || "Unknown",
        action: "VALIDATION_FAILED",
        target,
        metadata
    });
}

router.get("/api/reservations", async (req, res) => {
    try {
        const reservations = await Reservation.find();
        res.json(reservations);
    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
});

router.get("/api/reservations/user/:userId", async (req, res) => {
    try {
        const reservations = await Reservation.find({ userId: req.params.userId });
        res.json(reservations);
    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
});

router.get("/api/reservation/:id", async (req, res) => {
    try {
        console.log(`Checking reservation with ID: ${req.params.id}`);
        const reservation = await Reservation.findById(req.params.id);
        if (!reservation) {
            console.log(`Reservation not found with ID: ${req.params.id}`);
            return res.status(404).json({ message: "Reservation not found" });
        }
        console.log(`Found reservation: ${JSON.stringify(reservation)}`);
        res.json(reservation);
    } catch (error) {
        console.error(`Error finding reservation: ${error.message}`);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

router.post("/api/reservation", async (req, res) => {
    try {
        const reservation = new Reservation(req.body);
        await reservation.save();
        res.status(201).json(reservation);
    } catch (error) {
        if (error.name === "ValidationError") {
            const message = Object.values(error.errors).map((entry) => entry.message).join(", ");
            return res.status(400).json({ message });
        }

        res.status(500).json({ message: "Server error", error });
    }
});

router.delete("/api/reservation/:id", async (req, res) => {
    try {
        const reservationId = req.params.id;
        console.log(`Attempting to delete reservation with ID: ${reservationId}`);

        const reservation = await Reservation.findByIdAndDelete(reservationId);

        if (!reservation) {
            console.log(`Reservation not found with ID: ${reservationId}`);
            return res.status(404).json({ message: "Reservation not found" });
        }

        console.log(`Successfully deleted reservation with ID: ${reservationId}`);
        res.json({ message: "Reservation deleted successfully" });
    } catch (error) {
        console.error(`Error deleting reservation: ${error.message}`);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

router.patch("/api/reservation/:id", async (req, res) => {
    try {
        const reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({ message: "Reservation not found" });
        }

        reservation.set(req.body);
        await reservation.save();
        res.json(reservation);
    } catch (error) {
        if (error.name === "ValidationError") {
            const message = Object.values(error.errors).map((entry) => entry.message).join(", ");
            return res.status(400).json({ message });
        }

        res.status(500).json({ message: "Server error", error });
    }
});

router.get("/api/reservations/check-availability", async (req, res) => {
    try {
        const { lab, labId, date, seatNumber, startTime, endTime } = req.query;
        const parsedSeatNumber = parseSeatNumber(seatNumber);

        if ((!lab && !labId) || !date || seatNumber === undefined || seatNumber === null || seatNumber === "" || !startTime || !endTime) {
            logValidationFailureForSessionUser(req, "RESERVATION_AVAILABILITY_CHECK", "All parameters are required");
            return res.status(400).json({ available: false, message: "All parameters are required" });
        }

        if (!Number.isInteger(parsedSeatNumber) || parsedSeatNumber < 1) {
            logValidationFailureForSessionUser(req, "RESERVATION_AVAILABILITY_CHECK", "Seat number must be a positive whole number");
            return res.status(400).json({ available: false, message: "Seat number must be a positive whole number" });
        }

        if (!isValidReservationDate(date)) {
            logValidationFailureForSessionUser(req, "RESERVATION_AVAILABILITY_CHECK", "Reservation date is invalid");
            return res.status(400).json({ available: false, message: "Reservation date is invalid" });
        }

        const validatedTimeRange = validateReservationTimeRange(startTime, endTime);

        if (!validatedTimeRange.isValid) {
            logValidationFailureForSessionUser(req, "RESERVATION_AVAILABILITY_CHECK", validatedTimeRange.message);
            return res.status(400).json({ available: false, message: validatedTimeRange.message });
        }

        let laboratoryRoom = lab;
        let laboratoryCapacity = null;

        if (!laboratoryRoom && labId) {
            const laboratory = await Laboratory.findById(labId);

            if (!laboratory) {
                return res.status(404).json({ available: false, message: "Laboratory not found" });
            }

            laboratoryRoom = laboratory.room;
            laboratoryCapacity = laboratory.capacity;
        }

        if (laboratoryCapacity !== null && parsedSeatNumber > laboratoryCapacity) {
            logValidationFailureForSessionUser(req, "RESERVATION_AVAILABILITY_CHECK", "Seat number is not valid for the selected laboratory");
            return res.status(400).json({ available: false, message: "Seat number is not valid for the selected laboratory" });
        }

        const hasConflict = await hasReservationConflict({
            laboratoryRoom,
            date,
            seatNumber: parsedSeatNumber,
            startTime: validatedTimeRange.startTime,
            endTime: validatedTimeRange.endTime
        });

        if (hasConflict) {
            return res.json({ available: false, message: "This seat is already reserved for the selected time range" });
        }

        return res.json({ available: true, message: "Seat is available" });
    } catch (error) {
        console.error("Error checking seat availability:", error);
        res.status(500).json({ available: false, message: "An error occurred while checking seat availability" });
    }
});

router.get("/api/reservations/lab/:labId/date/:date", async (req, res) => {
    try {
        const { labId, date } = req.params;

        if (!labId || !date) {
            return res.status(400).json({ error: "Laboratory and date are required" });
        }

        console.log(`Fetching reservations for lab: ${labId}, date: ${date}`);

        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

        const lab = await Laboratory.findById(labId);
        if (!lab) {
            return res.status(404).json({ error: "Laboratory not found" });
        }

        const reservations = await Reservation.find({
            laboratoryRoom: lab.room,
            reservationDate: {
                $gte: startDate,
                $lt: endDate
            }
        }).populate("userId", "firstName lastName image type");

        console.log(`Found ${reservations.length} reservations`);

        const formattedReservations = reservations.map((reservation) => ({
            _id: reservation._id,
            seatNumber: reservation.seatNumber,
            startTime: reservation.startTime,
            endTime: reservation.endTime,
            userId: reservation.userId,
            studentName: reservation.studentName,
            isAnonymous: reservation.isAnonymous
        }));

        res.json({ reservations: formattedReservations });
    } catch (error) {
        console.error("Error fetching reservations:", error);
        res.status(500).json({ error: "An error occurred while fetching reservations" });
    }
});

module.exports = router;
