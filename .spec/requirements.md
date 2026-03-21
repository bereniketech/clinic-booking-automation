# Requirements: Clinic Booking Automation OS

## Introduction
A multi-tenant SaaS clinic operating system serving any clinic type (medical, dental, veterinary, aesthetic, etc.). WhatsApp is the primary customer-facing interface; staff operate through a web dashboard. The system handles appointment scheduling, customer CRM, WhatsApp messaging, workflow automation, dynamic forms, and subscription-based multi-tenancy. MVP is English-only. No payment processing in Phase 1.

---

## Requirement 1: Multi-Tenant Clinic Onboarding

**User Story:** As a clinic owner, I want to register my clinic and configure it independently, so that my data and workflows are isolated from other clinics on the platform.

#### Acceptance Criteria
1. WHEN a clinic registers THEN the system SHALL create a `clinics` record and a default admin user scoped to that clinic.
2. The system SHALL enforce `clinic_id` on every data query — no cross-tenant data access is possible at any layer.
3. WHEN a clinic exceeds its subscription plan's message or booking limit THEN the system SHALL block the action and notify the admin.
4. IF a clinic account is suspended THEN the system SHALL deny all API and dashboard access for users of that clinic.
5. The system SHALL support a platform-level super-admin view to manage all clinics.

---

## Requirement 2: Staff & Role Management

**User Story:** As a clinic admin, I want to invite staff and assign roles, so that each person has appropriate access.

#### Acceptance Criteria
1. WHEN an admin invites a staff member THEN the system SHALL send an invite via email and create a pending user record scoped to the clinic.
2. The system SHALL support at minimum: `admin`, `provider` (doctor/specialist), `receptionist` roles with distinct permission sets.
3. WHEN a staff member is deactivated THEN the system SHALL revoke their session and deny future logins.
4. IF a user attempts an action outside their role permissions THEN the system SHALL return a 403 and log the attempt.

---

## Requirement 3: Service & Availability Configuration

**User Story:** As a clinic admin, I want to define services and staff availability, so that the scheduling engine can generate accurate slots.

#### Acceptance Criteria
1. WHEN a service is created THEN the system SHALL persist: name, duration (minutes), price, buffer time, assigned staff list, and category.
2. WHEN staff working hours are set THEN the system SHALL use them as the base for slot generation.
3. IF a service has no assigned staff THEN the system SHALL not expose that service for booking.
4. WHEN a holiday or block is added THEN the system SHALL exclude those windows from all generated slots.
5. The system SHALL support per-service booking limits (max bookings per slot).

---

## Requirement 4: Scheduling Engine

**User Story:** As a customer, I want to book, reschedule, or cancel an appointment via WhatsApp, so that I can manage my visits without calling the clinic.

#### Acceptance Criteria
1. WHEN a customer requests available slots THEN the system SHALL return only non-conflicting slots within clinic working hours for the selected service and staff.
2. WHEN a customer confirms a booking THEN the system SHALL atomically create the appointment and mark the slot unavailable.
3. IF two customers attempt to book the same slot simultaneously THEN the system SHALL confirm only one and notify the other of unavailability.
4. WHEN a customer cancels THEN the system SHALL release the slot and trigger any configured cancellation workflows.
5. WHEN a customer reschedules THEN the system SHALL release the old slot and claim the new slot atomically.
6. The system SHALL prevent booking outside configured working hours or on holidays.

---

## Requirement 5: WhatsApp Integration

**User Story:** As a customer, I want to interact with the clinic entirely via WhatsApp using text or voice messages, so that I don't need to install any app or visit a website.

#### Acceptance Criteria
1. WHEN a WhatsApp message arrives at the webhook THEN the system SHALL verify the Meta signature before processing.
2. WHEN a verified inbound message is received THEN the system SHALL enqueue it for async processing — the webhook response SHALL return 200 immediately.
3. WHEN the system needs to send a WhatsApp message THEN it SHALL do so via a worker process, not from an API route.
4. The system SHALL handle both text messages and voice messages (audio). WHEN a voice message is received THEN the system SHALL store the media URL and surface it in the inbox for staff to listen to.
5. The system SHALL track conversation state (active session, last message, assigned staff) per customer per clinic.
6. WHEN a conversation is assigned to a staff member THEN that staff member SHALL see it in the dashboard inbox.
7. IF the Meta API returns an error for a message send THEN the system SHALL retry with exponential backoff up to 3 times, then mark the message as failed.
8. The system SHALL support English only in MVP. No multi-language handling is required in Phase 1.

---

## Requirement 6: Workflow Automation Engine

**User Story:** As a clinic admin, I want to define automated workflows, so that the system handles follow-ups, reminders, and routine actions without manual staff effort.

#### Acceptance Criteria
1. WHEN a clinic admin creates a workflow THEN the system SHALL persist: trigger type, conditions, and ordered action list.
2. WHEN a trigger event fires (appointment created/completed, no-response, time-based) THEN the system SHALL evaluate matching workflows for that clinic and enqueue execution.
3. WHEN a workflow action is `send_whatsapp` THEN the worker SHALL enqueue a message job — not send directly.
4. IF a workflow execution fails THEN the system SHALL log the failure with reason, retry up to 3 times, then mark as failed.
5. WHEN a time-based trigger is scheduled THEN the system SHALL use a delayed BullMQ job — not a polling loop.
6. The system SHALL maintain a `workflow_runs` log for every execution with status, timestamps, and output.

---

## Requirement 7: Dynamic Forms

**User Story:** As a clinic admin, I want to create custom forms, so that I can collect structured data from customers before or after appointments.

#### Acceptance Criteria
1. WHEN a form is created THEN the system SHALL persist the schema as JSON — not as hardcoded columns.
2. The system SHALL support field types: text, number, dropdown (enum), date, boolean (yes/no).
3. WHEN a form is attached to a booking trigger THEN the system SHALL send the form link via WhatsApp after booking confirmation.
4. WHEN a customer submits a form THEN the system SHALL store the response linked to the customer and clinic.
5. IF a required field is missing from a submission THEN the system SHALL reject and prompt the customer to complete the field.

---

## Requirement 8: CRM — Customer Profiles

**User Story:** As a clinic staff member, I want to view a complete customer profile, so that I have full context before and during interactions.

#### Acceptance Criteria
1. WHEN a new customer contacts the clinic via WhatsApp THEN the system SHALL create a customer record if one does not exist for that phone number + clinic.
2. The system SHALL display a customer timeline: all messages (text and voice), appointments, notes, and form responses in chronological order.
3. WHEN a tag is added to a customer THEN it SHALL be immediately usable in workflow conditions and filters.
4. The system SHALL support search and filter by: name, phone, tag, last appointment date.
5. The system SHALL support optional linked sub-entities (e.g. `pets` for veterinary clinics) without requiring them.

---

## Requirement 9: Web Dashboard

**User Story:** As a clinic staff member, I want a fast, minimal web dashboard, so that I can manage operations without training.

#### Acceptance Criteria
1. WHEN a new WhatsApp message arrives THEN the inbox SHALL update in real-time without a page refresh.
2. WHEN viewing the calendar THEN the system SHALL display all appointments for the current day/week with service, customer, and staff details.
3. WHEN a staff member replies in the inbox THEN the message SHALL be enqueued and sent via WhatsApp within 5 seconds.
4. The system SHALL be fully functional on modern desktop browsers and responsive on tablet.
5. WHEN a clinic admin accesses settings THEN they SHALL be able to configure services, staff, working hours, and workflows without developer involvement.

---

## Requirement 10: Notifications & Reminders

**User Story:** As a customer, I want to receive appointment reminders, so that I don't miss scheduled visits.

#### Acceptance Criteria
1. WHEN an appointment is booked THEN the system SHALL schedule a reminder job for 24 hours before the appointment by default.
2. WHEN a reminder job fires THEN the worker SHALL send the reminder via WhatsApp using the clinic's configured template.
3. IF a reminder has already been sent for an appointment THEN the system SHALL not send a duplicate.
4. WHEN an appointment is cancelled THEN any pending reminder jobs for that appointment SHALL be removed from the queue.
5. The system SHALL support clinic-configurable reminder timing (e.g. 24h, 1h, or both).

---

## Constraints
- English only in MVP — no i18n infrastructure needed in Phase 1.
- No payment collection of any kind in Phase 1.
- Workers MUST run as a separate process from the API.
- Every DB query MUST include `clinic_id` — enforced at service layer, with RLS as second defence.
- WhatsApp handled via webhooks only — no synchronous outbound calls from API routes.
