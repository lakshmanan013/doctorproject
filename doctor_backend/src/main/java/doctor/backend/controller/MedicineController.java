package doctor.backend.controller;

import doctor.backend.dto.medicine.MedicineRequest;
import doctor.backend.dto.medicine.MedicineResponse;
import doctor.backend.service.MedicineService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/medicines")
public class MedicineController {

    private final MedicineService medicineService;

    public MedicineController(MedicineService medicineService) {
        this.medicineService = medicineService;
    }

    // =====================================================
    // CREATE MEDICINE
    // POST /api/medicines
    // =====================================================

    @PostMapping
    public ResponseEntity<MedicineResponse> createMedicine(
            @RequestBody MedicineRequest request) {

        MedicineResponse response =
                medicineService.createMedicine(request);

        return new ResponseEntity<>(
                response,
                HttpStatus.CREATED
        );
    }

    // =====================================================
    // GET ALL MEDICINES
    // GET /api/medicines
    // =====================================================

    @GetMapping
    public ResponseEntity<List<MedicineResponse>>
    getAllMedicines() {

        return ResponseEntity.ok(
                medicineService.getAllMedicines()
        );
    }

    // =====================================================
    // GET MEDICINE BY ID
    // GET /api/medicines/{id}
    // =====================================================

    @GetMapping("/{id}")
    public ResponseEntity<MedicineResponse>
    getMedicineById(@PathVariable("id") Long id) {

        return ResponseEntity.ok(
                medicineService.getMedicineById(id)
        );
    }

    // =====================================================
    // SEARCH MEDICINES
    // GET /api/medicines/search?name=Amoxicillin
    // =====================================================

    @GetMapping("/search")
    public ResponseEntity<List<MedicineResponse>>
    searchMedicines(@RequestParam("name") String name) {

        return ResponseEntity.ok(
                medicineService.searchMedicines(name)
        );
    }

    // =====================================================
    // GET BY CATEGORY
    // GET /api/medicines/category/{category}
    // =====================================================

    @GetMapping("/category/{category}")
    public ResponseEntity<List<MedicineResponse>>
    getByCategory(@PathVariable("category") String category) {

        return ResponseEntity.ok(
                medicineService.getByCategory(category)
        );
    }

    // =====================================================
    // GET BY STATUS
    // GET /api/medicines/status/{status}
    // =====================================================

    @GetMapping("/status/{status}")
    public ResponseEntity<List<MedicineResponse>>
    getByStatus(@PathVariable("status") String status) {

        return ResponseEntity.ok(
                medicineService.getByStatus(status)
        );
    }

    // =====================================================
    // UPDATE MEDICINE
    // PUT /api/medicines/{id}
    // =====================================================

    @PutMapping("/{id}")
    public ResponseEntity<MedicineResponse>
    updateMedicine(
            @PathVariable("id") Long id,
            @RequestBody MedicineRequest request) {

        return ResponseEntity.ok(
                medicineService.updateMedicine(id, request)
        );
    }

    // =====================================================
    // UPDATE STOCK
    // PATCH /api/medicines/{id}/stock
    // =====================================================

    @PatchMapping("/{id}/stock")
    public ResponseEntity<MedicineResponse>
    updateStock(
            @PathVariable("id") Long id,
            @RequestParam("quantity") Integer quantity) {

        return ResponseEntity.ok(
                medicineService.updateStock(id, quantity)
        );
    }

    // =====================================================
    // DELETE MEDICINE
    // DELETE /api/medicines/{id}
    // =====================================================

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMedicine(
            @PathVariable("id") Long id) {

        medicineService.deleteMedicine(id);

        return ResponseEntity.noContent().build();
    }
}