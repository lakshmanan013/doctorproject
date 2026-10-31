package doctor.backend.controller;

import doctor.backend.dto.whatsapp.WhatsAppRequest;
import doctor.backend.dto.whatsapp.WhatsAppResponse;
import doctor.backend.service.WhatsAppService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/whatsapp")
public class WhatsAppController {

    private final WhatsAppService whatsAppService;

    public WhatsAppController(
            WhatsAppService whatsAppService) {

        this.whatsAppService = whatsAppService;
    }

    // =====================================================
    // SEND WHATSAPP MESSAGE
    // POST /api/whatsapp
    // =====================================================

    @PostMapping
    public ResponseEntity<WhatsAppResponse> sendMessage(
            @RequestBody WhatsAppRequest request) {

        WhatsAppResponse response =
                whatsAppService.sendMessage(request);

        return new ResponseEntity<>(
                response,
                HttpStatus.CREATED
        );
    }

    // =====================================================
    // GET ALL
    // GET /api/whatsapp
    // =====================================================

    @GetMapping
    public ResponseEntity<List<WhatsAppResponse>>
    getAllMessages() {

        return ResponseEntity.ok(
                whatsAppService.getAllMessages()
        );
    }

    // =====================================================
    // GET BY ID
    // GET /api/whatsapp/{id}
    // =====================================================

    @GetMapping("/{id}")
    public ResponseEntity<WhatsAppResponse>
    getMessageById(@PathVariable("id") Long id) {

        return ResponseEntity.ok(
                whatsAppService.getMessageById(id)
        );
    }

    // =====================================================
    // GET BY PHONE
    // GET /api/whatsapp/phone/{phoneNumber}
    // =====================================================

    @GetMapping("/phone/{phoneNumber}")
    public ResponseEntity<List<WhatsAppResponse>>
    getByPhoneNumber(
            @PathVariable("phoneNumber") String phoneNumber) {

        return ResponseEntity.ok(
                whatsAppService.getByPhoneNumber(
                        phoneNumber
                )
        );
    }

    // =====================================================
    // GET BY STATUS
    // GET /api/whatsapp/status/{status}
    // =====================================================

    @GetMapping("/status/{status}")
    public ResponseEntity<List<WhatsAppResponse>>
    getByStatus(@PathVariable("status") String status) {

        return ResponseEntity.ok(
                whatsAppService.getByStatus(status)
        );
    }

    // =====================================================
    // GET BY TYPE
    // GET /api/whatsapp/type/{type}
    // =====================================================

    @GetMapping("/type/{type}")
    public ResponseEntity<List<WhatsAppResponse>>
    getByType(@PathVariable("type") String type) {

        return ResponseEntity.ok(
                whatsAppService.getByType(type)
        );
    }

    // =====================================================
    // GET BY PROVIDER
    // GET /api/whatsapp/provider/{provider}
    // =====================================================

    @GetMapping("/provider/{provider}")
    public ResponseEntity<List<WhatsAppResponse>>
    getByProvider(@PathVariable("provider") String provider) {

        return ResponseEntity.ok(
                whatsAppService.getByProvider(provider)
        );
    }

    // =====================================================
    // GET BY PHONE + STATUS
    // GET /api/whatsapp/search
    // =====================================================

    @GetMapping("/search")
    public ResponseEntity<List<WhatsAppResponse>>
    getByPhoneAndStatus(
            @RequestParam("phoneNumber") String phoneNumber,
            @RequestParam("status") String status) {

        return ResponseEntity.ok(
                whatsAppService.getByPhoneAndStatus(
                        phoneNumber,
                        status
                )
        );
    }

    // =====================================================
    // GET BY PROVIDER MESSAGE ID
    // GET /api/whatsapp/provider-message/{providerMessageId}
    // =====================================================

    @GetMapping("/provider-message/{providerMessageId}")
    public ResponseEntity<List<WhatsAppResponse>>
    getByProviderMessageId(
            @PathVariable("providerMessageId") String providerMessageId) {

        return ResponseEntity.ok(
                whatsAppService.getByProviderMessageId(
                        providerMessageId
                )
        );
    }

    // =====================================================
    // UPDATE STATUS
    // PUT /api/whatsapp/{id}/status
    // =====================================================

    @PutMapping("/{id}/status")
    public ResponseEntity<WhatsAppResponse>
    updateStatus(
            @PathVariable("id") Long id,
            @RequestParam("status") String status,
            @RequestParam(value = "providerMessageId", required = false)
            String providerMessageId,
            @RequestParam(value = "errorMessage", required = false)
            String errorMessage) {

        return ResponseEntity.ok(
                whatsAppService.updateStatus(
                        id,
                        status,
                        providerMessageId,
                        errorMessage
                )
        );
    }

    // =====================================================
    // DELETE
    // DELETE /api/whatsapp/{id}
    // =====================================================

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMessage(
            @PathVariable("id") Long id) {

        whatsAppService.deleteMessage(id);

        return ResponseEntity.noContent().build();
    }
}