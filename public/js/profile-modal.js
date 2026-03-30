(function () {
    const modal = document.getElementById("profile-modal");
    const overlay = document.getElementById("profile-modal-overlay");

    if (!modal || !overlay) {
        return;
    }

    const elements = {
        image: document.getElementById("profile-modal-image"),
        name: document.getElementById("profile-modal-name"),
        type: document.getElementById("profile-modal-type"),
        email: document.getElementById("profile-modal-email"),
        department: document.getElementById("profile-modal-department"),
        biography: document.getElementById("profile-modal-biography")
    };

    function hideReservationPopups() {
        document.querySelectorAll(".popup2.show").forEach((popup) => {
            popup.classList.remove("show");
        });
    }

    function closeProfileModal() {
        modal.hidden = true;
        overlay.hidden = true;
    }

    async function openProfileModal(userId) {
        try {
            const response = await fetch(`/api/user/details/${userId}`);

            if (!response.ok) {
                throw new Error(`Failed to load profile: ${response.status}`);
            }

            const user = await response.json();

            elements.image.src = user.image || "/img/default-profile.png";
            elements.name.textContent = `${user.firstName} ${user.lastName}`;
            elements.type.textContent = user.isLabTech ? "Faculty" : "Student";
            elements.email.textContent = user.email || "N/A";
            elements.department.textContent = user.department || "N/A";
            elements.biography.textContent = user.biography || "No biography provided yet.";

            hideReservationPopups();
            modal.hidden = false;
            overlay.hidden = false;
        } catch (error) {
            console.error("Error loading profile modal:", error);
            alert("Unable to load that profile right now.");
        }
    }

    overlay.addEventListener("click", closeProfileModal);
    modal.querySelectorAll("[data-profile-modal-close]").forEach((button) => {
        button.addEventListener("click", closeProfileModal);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !modal.hidden) {
            closeProfileModal();
        }
    });

    window.openProfileModal = openProfileModal;
    window.closeProfileModal = closeProfileModal;
})();
