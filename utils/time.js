function parseTimeString(timeString) {
    if (typeof timeString !== "string") {
        return null;
    }

    const match = timeString.trim().match(/^(\d{1,2}):(\d{2})\s*(A\.?M\.?|P\.?M\.?)$/i);

    if (!match) {
        return null;
    }

    let hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2], 10);
    const modifier = match[3].toUpperCase().replace(/\./g, "");

    if (
        !Number.isInteger(hours) ||
        !Number.isInteger(minutes) ||
        hours < 1 ||
        hours > 12 ||
        (minutes !== 0 && minutes !== 30) ||
        (modifier !== "AM" && modifier !== "PM")
    ) {
        return null;
    }

    if (modifier === "PM" && hours !== 12) {
        hours += 12;
    }

    if (modifier === "AM" && hours === 12) {
        hours = 0;
    }

    return { hours, minutes };
}

function convertTimeToMinutes(timeString) {
    const parsedTime = parseTimeString(timeString);

    if (!parsedTime) {
        return Number.NaN;
    }

    return parsedTime.hours * 60 + parsedTime.minutes;
}

function convertTo24Hour(timeStr) {
    return parseTimeString(timeStr);
}

function getReservationDateTime(reservationDate, timeString) {
    const reservationDateTime = new Date(reservationDate);
    const reservationTime = convertTo24Hour(timeString);

    if (!reservationTime) {
        return null;
    }

    reservationDateTime.setHours(reservationTime.hours, reservationTime.minutes, 0, 0);
    return reservationDateTime;
}

function convertToHour(time12h) {
    const parsedTime = parseTimeString(time12h);

    if (!parsedTime) {
        return null;
    }

    return `${String(parsedTime.hours).padStart(2, "0")}:${String(parsedTime.minutes).padStart(2, "0")}`;
}

function timeToNumber(timeStr) {
    if (typeof timeStr !== "string") {
        return Number.NaN;
    }

    return parseInt(timeStr.replace(":", ""), 10);
}

function getStatus(reservation) {
    const reserveDate = new Date(reservation.reservationDate);
    const reservationDate = reserveDate.getFullYear() + "-" + String(reserveDate.getMonth() + 1).padStart(2, "0") + "-" +
        String(reserveDate.getDate()).padStart(2, "0");
    const now = new Date();
    const todayDate = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" +
        String(now.getDate()).padStart(2, "0");

    const startTime = timeToNumber(convertToHour(reservation.startTime));
    const endTime = timeToNumber(convertToHour(reservation.endTime));

    const nowHours = now.getHours().toString().padStart(2, "0");
    const nowMinutes = now.getMinutes().toString().padStart(2, "0");
    const nowTime = parseInt(`${nowHours}${nowMinutes}`, 10);

    if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
        return "Upcoming";
    }

    if (todayDate === reservationDate && nowTime >= startTime && nowTime < endTime) {
        return "Ongoing";
    }

    return "Upcoming";
}

module.exports = {
    convertTimeToMinutes,
    convertTo24Hour,
    getReservationDateTime,
    convertToHour,
    timeToNumber,
    getStatus
};
