const RESERVATION_TIME_SLOTS = [
    "07:30 A.M.", "08:00 A.M.", "08:30 A.M.", "09:00 A.M.",
    "09:30 A.M.", "10:00 A.M.", "10:30 A.M.", "11:00 A.M.",
    "11:30 A.M.", "12:00 P.M.", "12:30 P.M.", "01:00 P.M.",
    "01:30 P.M.", "02:00 P.M.", "02:30 P.M.", "03:00 P.M.",
    "03:30 P.M.", "04:00 P.M.", "04:30 P.M.", "05:00 P.M.",
    "05:30 P.M.", "06:00 P.M.", "06:30 P.M.", "07:00 P.M.",
    "07:30 P.M.", "08:00 P.M.", "08:30 P.M.", "09:00 P.M."
];

document.addEventListener("DOMContentLoaded", () => {
    const pageRoot = document.querySelector("[data-reservations-page]");

    if (!pageRoot) {
        return;
    }

    const state = {
        pageRoot,
        currentReservationId: null,
        originalEndTime: null,
        removePopup: document.getElementById("remove-reservation"),
        detailsPopup: document.getElementById("reservation-details"),
        overlay: document.getElementById("overlay"),
        editButton: document.getElementById("edit-btn"),
        doneButton: document.getElementById("done-btn"),
        fields: {
            reserveeName: document.getElementById("reservee-name"),
            labRoom: document.getElementById("lab-room"),
            seatNumber: document.getElementById("seat-num"),
            bookingDate: document.getElementById("booking-date"),
            bookingTime: document.getElementById("booking-time"),
            reservationDate: document.getElementById("reserve-date"),
            startTime: document.getElementById("start-time")
        }
    };

    bindEventHandlers(state);
    syncActionButtons(state);
});

function bindEventHandlers(state) {
    state.pageRoot.querySelector("[data-action='open-remove-popup']")?.addEventListener("click", () => {
        openRemovePopup(state);
    });

    state.pageRoot.querySelector("[data-action='cancel-remove']")?.addEventListener("click", () => {
        closePopup(state.removePopup, state.overlay);
    });

    state.pageRoot.querySelector("[data-action='confirm-remove']")?.addEventListener("click", async () => {
        try {
            await confirmRemoval(state);
        } catch (error) {
            console.error("Error confirming deletion:", error);
        }
    });

    state.pageRoot.querySelectorAll("[data-action='open-details']").forEach((trigger) => {
        trigger.addEventListener("click", async () => {
            try {
                await openDetailsPopup(state, trigger.dataset.reservationId);
            } catch (error) {
                console.error("Error opening reservation details:", error);
            }
        });
    });

    state.editButton?.addEventListener("click", async () => {
        if (!state.currentReservationId) {
            return;
        }

        if (isEditingReservation()) {
            cancelEditing(state);
            return;
        }

        try {
            await startEditing(state);
        } catch (error) {
            console.error("Error preparing reservation edit:", error);
        }
    });

    state.doneButton?.addEventListener("click", async () => {
        if (isEditingReservation()) {
            try {
                await saveChanges(state);
            } catch (error) {
                console.error("Error updating reservation:", error);
            }
            return;
        }

        closeDetailsPopup(state);
    });
}

function openRemovePopup(state) {
    if (!getSelectedReservationId()) {
        alert("Please select a reservation to delete.");
        return;
    }

    openPopup(state.removePopup, state.overlay);
}

async function confirmRemoval(state) {
    await deleteReservation(getSelectedReservationId());
    alert("Reservation deleted successfully!");
    closePopup(state.removePopup, state.overlay);
    window.location.reload();
}

async function deleteReservation(reservationId) {
    if (!reservationId) {
        throw new Error("No reservation selected.");
    }

    const response = await fetch(`/api/reservation/${reservationId}`, { method: "DELETE" });

    if (!response.ok) {
        throw new Error("Failed to delete reservation.");
    }
}

async function openDetailsPopup(state, reservationId) {
    if (!reservationId) {
        throw new Error("No reservation selected.");
    }

    cancelEditing(state);
    await loadReservationDetails(state, reservationId);
    state.currentReservationId = reservationId;
    openPopup(state.detailsPopup, state.overlay);
    syncActionButtons(state);
}

async function loadReservationDetails(state, reservationId) {
    const reservation = await fetchJson(`/api/reservation/${reservationId}`);
    const user = await fetchJson(`/api/user/${reservation.userId}`);
    const reserveeName = `${user.firstName} ${user.lastName}`;

    state.originalEndTime = reservation.endTime;
    state.fields.reserveeName.value = reserveeName;
    state.fields.labRoom.value = reservation.laboratoryRoom;
    state.fields.seatNumber.value = reservation.seatNumber;
    state.fields.bookingDate.value = formatDisplayDate(reservation.bookingDate);
    state.fields.bookingTime.value = formatTimeOfDay(reservation.bookingDate);
    state.fields.reservationDate.value = formatDisplayDate(reservation.reservationDate);
    state.fields.startTime.value = reservation.startTime;

    const endTimeField = document.getElementById("end-time");
    if (endTimeField) {
        endTimeField.value = reservation.endTime;
    }
}

async function startEditing(state) {
    const endTimeField = document.getElementById("end-time");

    if (!endTimeField) {
        return;
    }

    const reservation = await fetchJson(`/api/reservation/${state.currentReservationId}`);
    const laboratory = await fetchJson(`/api/laboratories/${reservation.laboratoryRoom}`);
    const reservationData = await fetchJson(
        `/api/reservations/lab/${laboratory._id}/date/${formatApiDate(reservation.reservationDate)}`
    );

    const selectField = createEndTimeSelect(
        endTimeField,
        reservation,
        reservationData.reservations || []
    );

    endTimeField.parentNode.replaceChild(selectField, endTimeField);
    syncActionButtons(state);
}

function createEndTimeSelect(currentField, reservation, reservations) {
    const selectField = document.createElement("select");
    const seatNumber = reservation.seatNumber.toString();
    const startIndex = RESERVATION_TIME_SLOTS.indexOf(reservation.startTime);

    if (startIndex === -1) {
        throw new Error(`Invalid start time: ${reservation.startTime}`);
    }

    const nextReservationIndex = findNextReservationIndex(reservations, seatNumber, startIndex);
    const endTimeOptions = RESERVATION_TIME_SLOTS.slice(startIndex + 1, nextReservationIndex + 1);

    if (!endTimeOptions.includes(currentField.value)) {
        endTimeOptions.push(currentField.value);
    }

    endTimeOptions.forEach((timeSlot) => {
        const option = document.createElement("option");
        option.value = timeSlot;
        option.text = timeSlot;
        selectField.appendChild(option);
    });

    selectField.className = currentField.className;
    selectField.id = "end-time-select";
    selectField.name = "endTime";
    selectField.style.cursor = "pointer";
    selectField.dataset.originalValue = currentField.value;
    selectField.value = currentField.value;

    return selectField;
}

function findNextReservationIndex(reservations, seatNumber, startIndex) {
    const futureReservations = reservations.filter((reservation) => (
        reservation.seatNumber.toString() === seatNumber &&
        RESERVATION_TIME_SLOTS.indexOf(reservation.startTime) > startIndex
    ));

    if (futureReservations.length === 0) {
        return RESERVATION_TIME_SLOTS.length - 1;
    }

    const earliestReservation = futureReservations.reduce((earliest, current) => {
        const earliestIndex = RESERVATION_TIME_SLOTS.indexOf(earliest.startTime);
        const currentIndex = RESERVATION_TIME_SLOTS.indexOf(current.startTime);

        return currentIndex < earliestIndex ? current : earliest;
    });

    return RESERVATION_TIME_SLOTS.indexOf(earliestReservation.startTime);
}

function cancelEditing(state) {
    const selectField = document.getElementById("end-time-select");

    if (!selectField) {
        return;
    }

    restoreEndTimeField(selectField.dataset.originalValue || state.originalEndTime || "");
    syncActionButtons(state);
}

async function saveChanges(state) {
    const selectField = document.getElementById("end-time-select");

    if (!selectField) {
        return;
    }

    const updatedEndTime = selectField.value;
    await fetchJson(`/api/reservation/${state.currentReservationId}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ endTime: updatedEndTime })
    });

    restoreEndTimeField(updatedEndTime);
    syncActionButtons(state);
    alert("Reservation updated successfully");
    window.location.reload();
}

function restoreEndTimeField(value) {
    const selectField = document.getElementById("end-time-select");

    if (!selectField) {
        return;
    }

    const textField = document.createElement("input");
    textField.className = selectField.className;
    textField.id = "end-time";
    textField.type = "text";
    textField.name = "editable";
    textField.value = value;
    textField.disabled = true;
    textField.setAttribute("data-label", "endTime");

    selectField.parentNode.replaceChild(textField, selectField);
}

function closeDetailsPopup(state) {
    cancelEditing(state);
    closePopup(state.detailsPopup, state.overlay);
    state.detailsPopup.scrollTop = 0;
    state.currentReservationId = null;
    state.originalEndTime = null;
    syncActionButtons(state);
}

function syncActionButtons(state) {
    const isEditing = isEditingReservation();

    if (state.editButton) {
        state.editButton.textContent = isEditing ? "Cancel" : "Edit Reservation";
    }

    if (state.doneButton) {
        state.doneButton.textContent = isEditing ? "Save Changes" : "Done";
    }
}

function isEditingReservation() {
    return Boolean(document.getElementById("end-time-select"));
}

function getSelectedReservationId() {
    return document.querySelector('input[name="select-option"]:checked')?.value || null;
}

function openPopup(popup, overlay) {
    popup.classList.add("open-popup");
    overlay.style.display = "block";
}

function closePopup(popup, overlay) {
    popup.classList.remove("open-popup");
    overlay.style.display = "none";
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json();
}

function formatDisplayDate(dateValue) {
    return new Date(dateValue).toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });
}

function formatApiDate(dateValue) {
    const date = new Date(dateValue);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatTimeOfDay(dateValue) {
    const date = new Date(dateValue);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${hours}:${minutes}`;
}
