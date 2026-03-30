// userProfile.js - JavaScript for User Profile functionality

document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on a user profile page
    const isUserProfilePage = window.location.pathname.includes('student-profile') || 
                             window.location.pathname.includes('profile_');
    
    if (isUserProfilePage) {
        setupProfileFunctionality();
    }
    
    // Setup event listeners for reservations if on reservations page
    const isReservationsPage = window.location.pathname.includes('student-reservations');
    if (isReservationsPage) {
        setupReservationManagement();
    }
});

function setupProfileFunctionality() {
    // Handle profile image upload
    const profileImageInput = document.getElementById('profile-image-input');
    if (profileImageInput) {
        profileImageInput.addEventListener('change', handleProfileImageUpload);
    }
    
    // Handle profile edit form submission
    const profileEditForm = document.getElementById('profile-edit-form');
    if (profileEditForm) {
        profileEditForm.addEventListener('submit', handleProfileEditSubmit);
    }
    
    // Handle account deletion confirmation
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', confirmAccountDeletion);
    }
    
    // Handle reservation cancellation
    const cancelButtons = document.querySelectorAll('.cancel-btn');
    cancelButtons.forEach(button => {
        if (button.getAttribute('data-reservation-id')) {
            button.addEventListener('click', function() {
                const reservationId = this.getAttribute('data-reservation-id');
                cancelReservation(reservationId);
            });
        }
    });
}

function handleProfileImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.querySelector('.profile-picture-large img').src = e.target.result;
            
            // Here you would typically upload the image to the server
            // This is a placeholder for the actual implementation
            console.log('Image would be uploaded to server');
        };
        reader.readAsDataURL(file);
    }
}

function handleProfileEditSubmit(event) {
    event.preventDefault();
    
    // Get form data
    const formData = new FormData(event.target);
    const profileData = {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email'),
        department: formData.get('department'),
        biography: formData.get('biography')
    };
    
    // Validate passwords if new password is provided
    const newPassword = formData.get('newPassword');
    const confirmPassword = formData.get('confirmPassword');
    
    if (newPassword && newPassword !== confirmPassword) {
        alert('New passwords do not match!');
        return;
    }
    
    // Here you would typically send the data to the server
    // This is a placeholder for the actual implementation
    console.log('Profile data would be sent to server:', profileData);
    
    // Show success message
    alert('Profile updated successfully!');
    
    // Redirect to overview page
    document.getElementById('overview-nav').click();
}

function confirmAccountDeletion() {
    const password = document.getElementById('delete-password').value;
    
    if (!password) {
        alert('Please enter your password to confirm account deletion.');
        return;
    }
    
    const confirmDelete = confirm('Are you sure you want to delete your account? This action cannot be undone.');
    
    if (confirmDelete) {
        // Here you would typically send a request to delete the account
        // This is a placeholder for the actual implementation
        console.log('Account would be deleted');
        
        // Redirect to homepage or login page
        window.location.href = '/';
    }
}

function cancelReservation(reservationId) {
    const confirmCancel = confirm('Are you sure you want to cancel this reservation?');
    
    if (confirmCancel) {
        // Here you would typically send a request to cancel the reservation
        // This is a placeholder for the actual implementation
        console.log('Cancelling reservation:', reservationId);
        
        // For demo purposes, just remove the row
        const row = document.querySelector(`[data-reservation-id="${reservationId}"]`).closest('tr');
        if (row) {
            row.remove();
            
            // Update counts
            const count = document.getElementById('reservations-body').childElementCount;
            const countElement = document.getElementById('reserved-count');
            if (countElement) {
                countElement.textContent = count;
            }
            
            if (count === 0) {
                const upcomingLabInfo = document.getElementById('upcoming-lab-info');
                if (upcomingLabInfo) {
                    upcomingLabInfo.textContent = 'No upcoming laboratory sessions.';
                }
            }
        }
    }
}

function setupReservationManagement() {
    // Add event listeners for reservation actions
    const reserveButtons = document.querySelectorAll('.reserve-btn');
    
    reserveButtons.forEach(button => {
        button.addEventListener('click', function() {
            const labId = this.getAttribute('data-lab-id');
            const seatId = this.getAttribute('data-seat-id');
            const timeSlot = this.getAttribute('data-time-slot');
            
            reserveSeat(labId, seatId, timeSlot);
        });
    });
}

function reserveSeat(labId, seatId, timeSlot) {
    // Here you would typically send a request to reserve the seat
    // This is a placeholder for the actual implementation
    console.log('Reserving seat:', { labId, seatId, timeSlot });
    
    // Show success message
    alert('Seat reserved successfully!');
    
    // Update UI to reflect the change
    const button = document.querySelector(`[data-lab-id="${labId}"][data-seat-id="${seatId}"][data-time-slot="${timeSlot}"]`);
    if (button) {
        button.textContent = 'RESERVED';
        button.disabled = true;
        button.classList.remove('reserve-btn');
        button.classList.add('reserved-btn');
    }
}
