package doctor.backend.controller;

import doctor.backend.dto.appointment.AppointmentRequest;
import doctor.backend.dto.appointment.AppointmentResponse;
import doctor.backend.service.AppointmentService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/appointments")
public class AppointmentController {

    private final AppointmentService appointmentService;

    public AppointmentController(
            AppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    // =====================================================
    // CREATE APPOINTMENT
    // POST /api/appointments
    // =====================================================

    @PostMapping
    public ResponseEntity<AppointmentResponse> createAppointment(
            @RequestBody AppointmentRequest request) {

        AppointmentResponse response =
                appointmentService.createAppointment(request);

        return new ResponseEntity<>(
                response,
                HttpStatus.CREATED
        );
    }

    // =====================================================
    // GET ALL APPOINTMENTS
    // GET /api/appointments
    // =====================================================

    @GetMapping
    public ResponseEntity<List<AppointmentResponse>> getAllAppointments() {

        return ResponseEntity.ok(
                appointmentService.getAllAppointments()
        );
    }

    // =====================================================
    // GET APPOINTMENT BY ID
    // GET /api/appointments/{id}
    // =====================================================

    @GetMapping("/{id}")
    public ResponseEntity<AppointmentResponse> getAppointmentById(
            @PathVariable("id") Long id) {

        return ResponseEntity.ok(
                appointmentService.getAppointmentById(id)
        );
    }

    // =====================================================
    // GET APPOINTMENTS BY PATIENT
    // GET /api/appointments/patient/{patientId}
    // =====================================================

    @GetMapping("/patient/{patientId}")
    public ResponseEntity<List<AppointmentResponse>>
    getAppointmentsByPatient(
            @PathVariable("patientId") Long patientId) {

        return ResponseEntity.ok(
                appointmentService
                        .getAppointmentsByPatient(patientId)
        );
    }

    // =====================================================
    // GET APPOINTMENTS BY DATE
    // GET /api/appointments/date/{date}
    // =====================================================

    @GetMapping("/date/{date}")
    public ResponseEntity<List<AppointmentResponse>>
    getAppointmentsByDate(
            @PathVariable("date") LocalDate date) {

        return ResponseEntity.ok(
                appointmentService
                        .getAppointmentsByDate(date)
        );
    }

    // =====================================================
    // GET APPOINTMENTS BY STATUS
    // GET /api/appointments/status/{status}
    // =====================================================

    @GetMapping("/status/{status}")
    public ResponseEntity<List<AppointmentResponse>>
    getAppointmentsByStatus(
            @PathVariable("status") String status) {

        return ResponseEntity.ok(
                appointmentService
                        .getAppointmentsByStatus(status)
        );
    }

    // =====================================================
    // GET BY DATE + STATUS
    // GET /api/appointments/filter
    // =====================================================

    @GetMapping("/filter")
    public ResponseEntity<List<AppointmentResponse>>
    getAppointmentsByDateAndStatus(
            @RequestParam("date") LocalDate date,
            @RequestParam("status") String status) {

        return ResponseEntity.ok(
                appointmentService
                        .getAppointmentsByDateAndStatus(
                                date,
                                status
                        )
        );
    }

    // =====================================================
    // GET APPOINTMENTS BETWEEN DATES
    // GET /api/appointments/range
    // =====================================================

    @GetMapping("/range")
    public ResponseEntity<List<AppointmentResponse>>
    getAppointmentsBetweenDates(
            @RequestParam("startDate") LocalDate startDate,
            @RequestParam("endDate") LocalDate endDate) {

        return ResponseEntity.ok(
                appointmentService
                        .getAppointmentsBetweenDates(
                                startDate,
                                endDate
                        )
        );
    }

    // =====================================================
    // UPDATE APPOINTMENT
    // PUT /api/appointments/{id}
    // =====================================================

    @PutMapping("/{id}")
    public ResponseEntity<AppointmentResponse> updateAppointment(
            @PathVariable("id") Long id,
            @RequestBody AppointmentRequest request) {

        return ResponseEntity.ok(
                appointmentService
                        .updateAppointment(id, request)
        );
    }

    // =====================================================
    // DELETE APPOINTMENT
    // DELETE /api/appointments/{id}
    // =====================================================

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAppointment(
            @PathVariable("id") Long id) {

        appointmentService.deleteAppointment(id);

        return ResponseEntity.noContent().build();
    }

    // =====================================================
    // SEND APPOINTMENT CONFIRMATION EMAIL
    // POST /api/appointments/{id}/send-email
    // =====================================================

    @PostMapping("/{id}/send-email")
    public ResponseEntity<doctor.backend.dto.email.EmailResponse> sendAppointmentEmail(
            @PathVariable("id") Long id,
            @RequestParam(value = "email", required = false) String email) {

        doctor.backend.dto.email.EmailResponse response =
                appointmentService.sendAppointmentConfirmationEmail(id, email);

        return ResponseEntity.ok(response);
    }
}