document.addEventListener("DOMContentLoaded", () => {
    const labSelect = document.getElementById("labs");
    const dateSelect = document.getElementById("dates");
    const viewButton = document.getElementById("view-button");
    const timetable = document.getElementById("timetable");
    const chartBody = document.getElementById("chart-body");
    const chartHeader = document.getElementById("chart-header");
    const timeSlots = [
        "07:30 A.M.", "08:00 A.M.", "08:30 A.M.", "09:00 A.M.",
        "09:30 A.M.", "10:00 A.M.", "10:30 A.M.", "11:00 A.M.",
        "11:30 A.M.", "12:00 P.M.", "12:30 P.M.", "01:00 P.M.",
        "01:30 P.M.", "02:00 P.M.", "02:30 P.M.", "03:00 P.M.",
        "03:30 P.M.", "04:00 P.M.", "04:30 P.M.", "05:00 P.M.",
        "05:30 P.M.", "06:00 P.M.", "06:30 P.M.", "07:00 P.M.",
        "07:30 P.M.", "08:00 P.M.", "08:30 P.M."
    ];

    function toggleViewSlots(event) {
        event.preventDefault();

        if (chartBody.dataset.expanded === "true") {
            chartBody.style.height = "";
            chartBody.style.overflowY = "";
            chartBody.dataset.expanded = "false";
            event.currentTarget.textContent = "Minimize view";
            return;
        }

        chartBody.style.height = "500px";
        chartBody.style.overflowY = "scroll";
        chartBody.dataset.expanded = "true";
        event.currentTarget.textContent = "Expand view";
    }

    function ensureViewToggle() {
        if (document.getElementById("view-toggle")) {
            return;
        }

        chartHeader.insertAdjacentHTML(
            "beforeend",
            ` (<a id="view-toggle" href="#" style="text-decoration: underline; cursor: pointer;">Minimize view</a>)`
        );

        document.getElementById("view-toggle").addEventListener("click", toggleViewSlots);
    }

    function toMinutes(timeValue) {
        const match = timeValue.match(/(\d+):(\d+)\s+(A\.M\.|P\.M\.)/);
        if (!match) {
            return 0;
        }

        let [, hour, minute, period] = match;
        hour = parseInt(hour, 10);
        minute = parseInt(minute, 10);

        let totalMinutes = hour * 60 + minute;

        if (period === "P.M." && hour !== 12) totalMinutes += 12 * 60;
        if (period === "A.M." && hour === 12) totalMinutes = minute;

        return totalMinutes;
    }

    function isTimeInRange(time, startTime, endTime) {
        const currentTime = toMinutes(time);
        const start = toMinutes(startTime);
        const end = toMinutes(endTime);

        return currentTime >= start && currentTime < end;
    }

    function getDisplayTimeSlots(selectedDate) {
        const today = new Date().toISOString().split("T")[0];
        const isToday = selectedDate === today;

        if (!isToday) {
            return timeSlots;
        }

        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        return timeSlots.filter((timeSlot) => {
            const match = timeSlot.match(/(\d+):(\d+)\s+(A\.M\.|P\.M\.)/);
            if (!match) {
                return false;
            }

            let [, hourStr, minuteStr, period] = match;
            let hour = parseInt(hourStr, 10);
            const minute = parseInt(minuteStr, 10);

            if (period === "P.M." && hour !== 12) hour += 12;
            if (period === "A.M." && hour === 12) hour = 0;

            return hour > currentHour || (hour === currentHour && minute > currentMinute);
        });
    }

    function renderEmptyState(message) {
        timetable.innerHTML = `<tr><td colspan="100%" style="text-align: center; padding: 20px;">${message}</td></tr>`;
    }

    function renderTimetable(reservations, displayTimeSlots, capacity) {
        let timetableHtml = `<th id="seat-header">Seat</th>`;

        displayTimeSlots.forEach((time) => {
            timetableHtml += `
                <div id="time-header">
                    <th>${time}</th>
                </div>
            `;
        });

        for (let seat = 1; seat <= capacity; seat += 1) {
            timetableHtml += `<tr><td class="freezecol">Seat ${seat}</td>`;

            displayTimeSlots.forEach((time) => {
                const matchingReservation = reservations.find((reservation) =>
                    reservation.seatNumber === seat && isTimeInRange(time, reservation.startTime, reservation.endTime)
                );

                const seatClass = matchingReservation ? "taken-seat" : "clickable-seat";

                timetableHtml += `
                    <td>
                        <button class="${seatClass}" seat-number="${seat}" seat-time="${time}"></button>
                    </td>
                `;
            });

            timetableHtml += "</tr>";
        }

        timetable.innerHTML = timetableHtml;

        document.querySelectorAll(".taken-seat").forEach((seatButton) => {
            seatButton.addEventListener("click", () => {
                alert("Please sign in to view reservation details for this seat.");
            });
        });
    }

    viewButton.addEventListener("click", async () => {
        const selectedOption = labSelect.options[labSelect.selectedIndex];
        const selectedDate = dateSelect.value;
        const capacity = selectedOption ? Number(selectedOption.getAttribute("data-capacity")) : 0;

        if (!selectedOption || !capacity || !selectedDate) {
            timetable.innerHTML = "";
            return;
        }

        const displayTimeSlots = getDisplayTimeSlots(selectedDate);
        if (displayTimeSlots.length === 0) {
            renderEmptyState("No available time slots for today. Please select another date.");
            return;
        }

        try {
            const response = await fetch(`/api/reservations/lab/${selectedOption.value}/date/${selectedDate}`);
            const data = await response.json();
            const reservations = data.reservations || [];

            renderTimetable(reservations, displayTimeSlots, capacity);
            ensureViewToggle();
        } catch (error) {
            console.error("Error fetching reservations:", error);
        }
    });
});
