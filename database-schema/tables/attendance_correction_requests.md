# attendance_correction_requests

Stores student-submitted requests to correct an attendance record.

## Purpose

Students can request a correction from their attendance history when a class, The Well, Ministry, or Activation Saturday record is wrong or missing. Administrators review the request and either approve it, which updates the underlying attendance table, or reject it.

## Key Columns

- `id`: Identity primary key.
- `student_id`: Student requesting the correction.
- `course_id`: Related year group when applicable.
- `gate`: Attendance gate: `classes`, `the_well`, `activation`, or `ministry`.
- `record_date`: Date shown to the student for the attendance record.
- `title`: Human-readable record title shown in review UI.
- `class_id`: Linked class for class/activation corrections.
- `well_week_start`: Linked Well week for Well corrections.
- `ministry_session_id`: Linked ministry service report for ministry corrections.
- `current_status`: Current attendance status, nullable when not marked.
- `requested_status`: Student-requested corrected status.
- `reason`: Student explanation.
- `status`: Review status: `pending`, `approved`, or `rejected`.
- `requested_at`: When the student submitted the request.
- `resolved_at`, `resolved_by`, `resolution_note`: Admin review metadata.

## Access Pattern

- Students can select and insert only their own requests.
- Students can see their own requests.
- Administrators can see and update all requests.

## Maintenance Culture

When adding a new attendance gate or changing attendance record keys, update this table and the correction resolver in `useAttendance` so approved corrections still update the correct source-of-truth table.
