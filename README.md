# CSSECDV App Demo

Taken from CCAPDEV - Capote

# Pre-requisites

1. Must have [https://www.docker.com/get-started/](Docker).

# How to Run the Application

To start the application, follow the steps:
1. Run `npm install` in the root directory of the project.
2. Make a copy of .sample.env to .env

The app runs on [http://localhost:3000/](http://localhost:3000/).

Note that upon first run, the database will be automatically seeded with users, laboratories, and reservations. The database will automatically be seeded whenever there are no users and no laboratories.

## Signing in - Demo Profiles 

To test student-related views and facilities, use the following account credentials upon sign-in:
* Email: `student@dlsu.edu.ph`
* Password: `student`

To test faculty (lab technician) views and facilities, use the following account credentials upon sign-in:
* Email: `faculty@dlsu.edu.ph`
* Password: `faculty`

## Signing up

To test student / faculty views and facilities via a newly created user account, navigate to "Sign Up" to create a new account. Take note that the following has been implemented:
* Simple input checking (i.e., passwords don't match, field missing, etc.) to test error message outputting
* Checking new email against existing accounts as to not disrupt logic for fetching user data from database
* Creating faculty (lab technician) account requires a faculty code to proceed. As of this implementation, the code is "i-am-faculty"

# Notes on Implementation

## Reserving a Laboratory Seat

The **Laboratories page** allows users to view available slots, given the laboratory room and date. For a successful creation of a reservation:
1. A laboratory room and date must be selected
2. A seat number and start time must be selected under the Slot Availability view
3. A valid end time must be selected (which are already given in the dropdown)

Students may also view the details of an existing reservation in the Slot Availability view by clicking the red slot, and clicking the user's profile image, if given. Students cannot view the profile of anonymous reservations, as well as reservations booked by faculty member. Faculty members however may freely view profiles tied to existing reservations, whether it is anonymous or booked by another faculty member. For logged-out users, they cannot view profiles tied to existing reservations.

## Viewing Reservations

The **Reservations page** allows users to view and delete their existing reservations. For a successful deletion of a reservation, a reservation must be selected. For faculty members, the delete facility is only available *10 minutes after the reservation's start time* (assuming the student does not show up after 10 minutes).

Students may edit the end time of their reservations, while faculty may edit the end time of any reservations booked within the system. 

## Profile Page

The **Profile page** allows users to view and edit their profile information. The Dashboard view provides a quick overview of a user's reservations (all reservations for the faculty view), such as total number of reservations and reservation status.

The View Profile view allows shows the user's profile information, such as name, email address, account type, biography, department, and profile image. To customize user's profile, click the Edit Profile button. Edit Profile only allows users to edit their biography, department, and profile image.

Delete Profile allows users to delete their account. This will also delete all reservations booked by the user.

