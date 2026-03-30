# LabMate Role-Based CRUD Documentation

This document explains the current CRUD operations available to the three application roles in LabMate:

- `Student`
- `LabTech`
- `Admin`

The descriptions below are based on the current Express routes, shared API routes, and service-layer behavior in this codebase.

## Scope

This documentation covers CRUD behavior for these main objects:

- User accounts and profiles
- Reservations
- Privileged account management
- Application logs
- Laboratory data access

## Student

### Create

- Create a student account through public signup via `POST /signup`.
- Create a reservation through `POST /create-reservation`.
- Student reservation creation supports the `isAnonymous` flag.

### Read

- Access student-only pages:
  - `GET /student-home`
  - `GET /student-laboratories`
  - `GET /student-reservations`
  - `GET /student-profile`
- Read only the student's own reservations on the reservations page.
- Read laboratory slot availability on the laboratories page.
- Read the student's own dashboard and profile data.
- Read selected reservation details from the reservations page popup.

### Update

- Update own profile through `PUT /api/user/update`.
  - Current editable fields: `department`, `biography`, `image`
  - `firstName`, `lastName`, and `email` are displayed but not editable in the profile form
- Update own password through `PUT /api/user/password`.
- Update the end time of reservations shown on the student reservations page through `PATCH /api/reservation/:id`.
  - In normal page flow, a student only sees their own reservations, so the intended behavior is "update own reservation end time only".

### Delete

- Delete own reservation from the student reservations page through `DELETE /api/reservation/:id`.
- Delete own account through `DELETE /api/user/delete`.
  - This also deletes reservations owned by that student account.

## LabTech

### Create

- Cannot self-register through public signup.
- Must be created or promoted by an administrator.
- Can create walk-in reservations through `POST /create-reservation-labtech`.
  - These reservations are created under the current labtech account.

### Read

- Access labtech-only pages:
  - `GET /labtech-home`
  - `GET /labtech-laboratories`
  - `GET /labtech-reservations`
  - `GET /labtech-profile`
- Read all reservations on the labtech reservations page.
- Read laboratory slot availability on the laboratories page.
- Read reservation details for records shown in the labtech reservations page.
- Read the labtech's own dashboard and profile data.

### Update

- Update own profile through `PUT /api/user/update`.
- Update own password through `PUT /api/user/password`.
- Update reservation end times through `PATCH /api/reservation/:id`.
  - In normal page flow, labtech users can edit reservations shown on the labtech reservations page.
  - Since that page loads all reservations, the effective behavior is that labtech users can update the end time of any reservation shown there.

### Delete

- Delete reservations through `DELETE /api/reservation/:id`.
  - In normal page flow, deletion is only enabled when a reservation is at least 10 minutes past its start time.
  - This removable-state logic is calculated in `services/reservationService.js` via `getRemovableReservationIds()`.
- Delete own account through `DELETE /api/user/delete`.
  - This also deletes reservations owned by that labtech account.

## Admin

### Create

- Cannot self-register through public signup.
- Can create privileged accounts through `POST /admin-accounts`.
- Current privileged account types that admins can create:
  - `LabTech`
  - `Admin`

### Read

- Access admin-only pages:
  - `GET /admin-home`
  - `GET /admin-accounts`
  - `GET /admin-logs`
  - `GET /admin-profile`
- Read the list of privileged accounts (`LabTech` and `Admin`) on the admin accounts page.
- Read application logs through the admin logs page.
- Read own dashboard and profile data.

### Update

- Update privileged account roles through `POST /admin-accounts/:id/role`.
  - Supported role targets:
    - `LabTech`
    - `Admin`
- Update own profile through `PUT /api/user/update`.
- Update own password through `PUT /api/user/password`.

### Delete

- Delete privileged accounts through `POST /admin-accounts/:id/delete`.
- The admin accounts page enforces these safeguards:
  - An admin cannot delete their own account from the admin panel
  - An admin cannot remove their own admin role from the admin panel
  - At least one `Admin` account must remain when deleting or demoting another admin through the admin panel
- Delete own account through `DELETE /api/user/delete`.
  - This is part of the shared profile flow available to authenticated users.
  - It also deletes reservations owned by that admin account.

## Shared Rules Across Roles

- Public signup creates `Student` accounts only.
- `LabTech` and `Admin` accounts can only be created or reassigned by an administrator.
- All authenticated roles can:
  - read their own profile page
  - update their own profile
  - update their own password
  - delete their own account
- Laboratory records are read-only in the current implementation.
  - There is a read API at `GET /api/laboratories/:room`
  - There is no role-specific create, update, or delete flow for laboratories in the current app

## Reservation Summary By Role

| Role | Create Reservation | Read Reservations | Update Reservation | Delete Reservation |
| --- | --- | --- | --- | --- |
| Student | Yes, own reservation via `/create-reservation` | Own reservations | End time of reservations shown on student page | Own reservations from student page |
| LabTech | Yes, walk-in reservation via `/create-reservation-labtech` | All reservations on labtech page | End time of reservations shown on labtech page | Reservations that are at least 10 minutes past start time |
| Admin | No dedicated reservation UI | No dedicated reservation UI | No dedicated reservation UI | No dedicated reservation UI |

## Important Implementation Notes

- The role descriptions above reflect the intended page-level behavior.
- Some shared API routes are not protected with role-specific authorization checks.
  - Examples include parts of `routes/api/reservations.js` and public read routes in `routes/api/users.js`.
- Because of that, this document should be read as a guide to the current application workflow, not as a strict security specification.
- If stricter role enforcement is needed, it should be added directly to the API routes and service layer, not only in page navigation or UI controls.
