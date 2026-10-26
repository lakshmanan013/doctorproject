package doctor.backend.service;

import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import doctor.backend.entity.DoctorProfile;
import doctor.backend.entity.Owner;
import doctor.backend.entity.Patient;
import doctor.backend.entity.Prescription;
import doctor.backend.entity.PrescriptionItem;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class PdfService {

        // =====================================================
        // GENERATE SIMPLE PDF
        // =====================================================

        public byte[] generatePdf(
                        String title,
                        String content) {

                if (title == null ||
                                title.trim().isEmpty()) {

                        throw new RuntimeException(
                                        "PDF title is required");
                }

                if (content == null) {
                        content = "";
                }

                try {

                        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();

                        Document document = new Document();

                        PdfWriter.getInstance(
                                        document,
                                        outputStream);

                        document.open();

                        Font titleFont = FontFactory.getFont(
                                        FontFactory.HELVETICA_BOLD,
                                        20);

                        Paragraph titleParagraph = new Paragraph(
                                        title,
                                        titleFont);

                        titleParagraph.setSpacingAfter(20);

                        document.add(titleParagraph);

                        Font contentFont = FontFactory.getFont(
                                        FontFactory.HELVETICA,
                                        12);

                        Paragraph contentParagraph = new Paragraph(
                                        content,
                                        contentFont);

                        document.add(contentParagraph);

                        document.add(
                                        Chunk.NEWLINE);

                        document.add(
                                        new Paragraph(
                                                        "Veterinary Hospital"));

                        document.close();

                        return outputStream.toByteArray();

                } catch (DocumentException e) {

                        throw new RuntimeException(
                                        "Failed to generate PDF",
                                        e);
                }
        }

        // =====================================================
        // GENERATE RICH PRESCRIPTION PDF
        // =====================================================

        public byte[] generatePrescriptionPdf(
                        Prescription prescription,
                        DoctorProfile doctorProfile,
                        Patient patient,
                        Owner owner,
                        List<PrescriptionItem> items) {

                try {
                        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
                        Document document = new Document(PageSize.A4, 36, 36, 36, 36);
                        PdfWriter.getInstance(document, outputStream);

                        document.open();

                        // Color Palette
                        Color primaryTeal = new Color(15, 118, 110); // #0F766E
                        Color darkGreen = new Color(0, 56, 34); // #003822
                        Color lightBg = new Color(248, 250, 252); // #F8FAFC
                        Color lightGreenBg = new Color(240, 253, 244); // #F0FDF4
                        Color borderGray = new Color(226, 232, 240); // #E2E8F0
                        Color textDark = new Color(15, 23, 42); // #0F172A
                        Color textMuted = new Color(100, 116, 139); // #64748B

                        // Fonts
                        Font headerTitleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, Color.WHITE);
                        Font headerSubFont = FontFactory.getFont(FontFactory.HELVETICA, 10, new Color(204, 251, 241));
                        Font sectionTitleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, darkGreen);
                        Font regularBoldFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, textDark);
                        Font regularFont = FontFactory.getFont(FontFactory.HELVETICA, 9, textDark);
                        Font thFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.WHITE);
                        Font footerFont = FontFactory.getFont(FontFactory.HELVETICA, 8, textMuted);

                        // ==========================================
                        // 1. TOP HEADER BANNER
                        // ==========================================
                        String clinicTitle = (doctorProfile != null && doctorProfile.getClinicHospital() != null
                                        && !doctorProfile.getClinicHospital().isBlank())
                                                        ? doctorProfile.getClinicHospital().trim()
                                                        : "ZENVE VET CLINICAL NETWORK";

                        PdfPTable headerTable = new PdfPTable(1);
                        headerTable.setWidthPercentage(100);

                        PdfPCell headerCell = new PdfPCell();
                        headerCell.setBackgroundColor(primaryTeal);
                        headerCell.setPaddingTop(12);
                        headerCell.setPaddingBottom(12);
                        headerCell.setPaddingLeft(16);
                        headerCell.setPaddingRight(16);
                        headerCell.setBorder(Rectangle.NO_BORDER);

                        Paragraph titleP = new Paragraph(clinicTitle.toUpperCase(), headerTitleFont);
                        titleP.setAlignment(Element.ALIGN_LEFT);
                        headerCell.addElement(titleP);

                        String doctorTitle = "Attending Doctor: "
                                        + (prescription.getDoctorName() != null ? prescription.getDoctorName()
                                                        : "Dr. Veterinary Surgeon");
                        if (doctorProfile != null && doctorProfile.getQualification() != null
                                        && !doctorProfile.getQualification().isBlank()) {
                                doctorTitle += " (" + doctorProfile.getQualification() + ")";
                        }
                        Paragraph subP = new Paragraph(doctorTitle
                                        + " • Certified Veterinary Medical Care • https://doctor.zenvevet.com",
                                        headerSubFont);
                        subP.setSpacingBefore(3);
                        headerCell.addElement(subP);

                        headerTable.addCell(headerCell);
                        document.add(headerTable);

                        // Spacer
                        document.add(new Paragraph(" ", FontFactory.getFont(FontFactory.HELVETICA, 4)));

                        // ==========================================
                        // 2. PATIENT & OWNER DETAILS (2 Columns)
                        // ==========================================
                        PdfPTable infoTable = new PdfPTable(2);
                        infoTable.setWidthPercentage(100);
                        infoTable.setWidths(new float[] { 1.1f, 0.9f });

                        // Left Cell: Patient Info
                        PdfPCell patientCell = new PdfPCell();
                        patientCell.setBackgroundColor(lightBg);
                        patientCell.setBorderColor(borderGray);
                        patientCell.setPadding(10);

                        Paragraph pSecTitle = new Paragraph("🐾 PATIENT / PET DETAILS", sectionTitleFont);
                        pSecTitle.setSpacingAfter(6);
                        patientCell.addElement(pSecTitle);

                        String petName = (patient != null && patient.getName() != null) ? patient.getName() : "—";
                        String petSpecies = (patient != null && patient.getSpecies() != null) ? patient.getSpecies()
                                        : "—";
                        String petBreed = (patient != null && patient.getBreed() != null
                                        && !patient.getBreed().isBlank()) ? (" (" + patient.getBreed() + ")") : "";
                        String petAge = (patient != null && patient.getAge() != null) ? patient.getAge() : "—";
                        String petGender = (patient != null && patient.getGender() != null) ? patient.getGender() : "—";
                        String petWeight = (patient != null && patient.getWeight() != null)
                                        ? (patient.getWeight() + " kg")
                                        : "—";

                        patientCell.addElement(new Paragraph("Pet Name: " + petName, regularBoldFont));
                        patientCell.addElement(new Paragraph("Species & Breed: " + petSpecies + petBreed, regularFont));
                        patientCell.addElement(
                                        new Paragraph("Age / Gender: " + petAge + " • " + petGender, regularFont));
                        patientCell.addElement(new Paragraph("Recorded Weight: " + petWeight, regularFont));
                        infoTable.addCell(patientCell);

                        // Right Cell: Owner & Visit Info
                        PdfPCell ownerCell = new PdfPCell();
                        ownerCell.setBackgroundColor(lightBg);
                        ownerCell.setBorderColor(borderGray);
                        ownerCell.setPadding(10);

                        Paragraph oSecTitle = new Paragraph("👤 PET PARENT & VISIT INFO", sectionTitleFont);
                        oSecTitle.setSpacingAfter(6);
                        ownerCell.addElement(oSecTitle);

                        String ownerName = (owner != null && owner.getFullName() != null)
                                        ? owner.getFullName()
                                        : (patient != null && patient.getOwner() != null
                                                        && patient.getOwner().getFullName() != null
                                                                        ? patient.getOwner().getFullName()
                                                                        : "—");
                        String ownerPhone = (owner != null && owner.getPhone() != null) ? owner.getPhone() : "—";
                        String ownerEmail = (owner != null && owner.getEmail() != null) ? owner.getEmail() : "—";
                        String dateStr = prescription.getPrescriptionDate() != null
                                        ? prescription.getPrescriptionDate()
                                                        .format(DateTimeFormatter.ofPattern("dd MMMM yyyy"))
                                        : "—";
                        String rxCode = "2026/Z" + String.format("%03d",
                                        prescription.getId() != null ? prescription.getId() : 1);

                        ownerCell.addElement(new Paragraph("Owner Name: " + ownerName, regularBoldFont));
                        ownerCell.addElement(new Paragraph("Phone: " + ownerPhone, regularFont));
                        ownerCell.addElement(new Paragraph("Email: " + ownerEmail, regularFont));
                        ownerCell.addElement(new Paragraph("Prescription Code: " + rxCode, regularBoldFont));
                        ownerCell.addElement(new Paragraph("Prescription Date: " + dateStr, regularFont));
                        infoTable.addCell(ownerCell);

                        document.add(infoTable);

                        // ==========================================
                        // 3. CLINICAL DIAGNOSIS & FINDINGS
                        // ==========================================
                        if (prescription.getDiagnosis() != null && !prescription.getDiagnosis().isBlank()) {
                                document.add(new Paragraph(" ", FontFactory.getFont(FontFactory.HELVETICA, 4)));

                                PdfPTable diagTable = new PdfPTable(1);
                                diagTable.setWidthPercentage(100);

                                PdfPCell diagCell = new PdfPCell();
                                diagCell.setBackgroundColor(lightBg);
                                diagCell.setBorderColor(borderGray);
                                diagCell.setPadding(8);

                                Paragraph diagTitle = new Paragraph("🩺 CLINICAL DIAGNOSIS & FINDINGS",
                                                sectionTitleFont);
                                diagTitle.setSpacingAfter(4);
                                diagCell.addElement(diagTitle);

                                diagCell.addElement(new Paragraph(prescription.getDiagnosis().trim(), regularFont));

                                if (prescription.getNotes() != null && !prescription.getNotes().isBlank()) {
                                        Paragraph notesP = new Paragraph(
                                                        "Clinical Notes: " + prescription.getNotes().trim(),
                                                        regularFont);
                                        notesP.setSpacingBefore(4);
                                        diagCell.addElement(notesP);
                                }

                                diagTable.addCell(diagCell);
                                document.add(diagTable);
                        }

                        // ==========================================
                        // 4. PRESCRIBED MEDICINES TABLE
                        // ==========================================
                        document.add(new Paragraph(" ", FontFactory.getFont(FontFactory.HELVETICA, 6)));

                        Paragraph medHeaderP = new Paragraph("💊 PRESCRIBED MEDICINES (Rx)", sectionTitleFont);
                        medHeaderP.setSpacingAfter(4);
                        document.add(medHeaderP);

                        PdfPTable medTable = new PdfPTable(6);
                        medTable.setWidthPercentage(100);
                        medTable.setWidths(new float[] { 0.35f, 2.2f, 1.2f, 1.2f, 0.8f, 2.25f });

                        // Table Headers
                        String[] headers = { "#", "Medicine Name", "Dosage", "Frequency", "Qty",
                                        "Instructions / Route" };
                        for (String h : headers) {
                                PdfPCell th = new PdfPCell(new Phrase(h, thFont));
                                th.setBackgroundColor(primaryTeal);
                                th.setPadding(6);
                                th.setHorizontalAlignment(Element.ALIGN_LEFT);
                                th.setBorderColor(primaryTeal);
                                medTable.addCell(th);
                        }

                        // Rows
                        if (items == null || items.isEmpty()) {
                                PdfPCell emptyCell = new PdfPCell(
                                                new Phrase("No medicines prescribed on this visit.", regularFont));
                                emptyCell.setColspan(6);
                                emptyCell.setPadding(8);
                                emptyCell.setHorizontalAlignment(Element.ALIGN_CENTER);
                                medTable.addCell(emptyCell);
                        } else {
                                int idx = 1;
                                for (PrescriptionItem item : items) {
                                        Color rowBg = (idx % 2 == 0) ? lightBg : Color.WHITE;

                                        // #
                                        PdfPCell cIndex = new PdfPCell(new Phrase(String.valueOf(idx), regularFont));
                                        cIndex.setBackgroundColor(rowBg);
                                        cIndex.setPadding(6);
                                        cIndex.setBorderColor(borderGray);
                                        medTable.addCell(cIndex);

                                        // Medicine Name
                                        String medName = (item.getMedicine() != null
                                                        && item.getMedicine().getName() != null)
                                                                        ? item.getMedicine().getName()
                                                                        : "Prescribed Medicine";
                                        PdfPCell cName = new PdfPCell(new Phrase(medName, regularBoldFont));
                                        cName.setBackgroundColor(rowBg);
                                        cName.setPadding(6);
                                        cName.setBorderColor(borderGray);
                                        medTable.addCell(cName);

                                        // Dosage
                                        String dosage = item.getDosage() != null ? item.getDosage() : "—";
                                        PdfPCell cDosage = new PdfPCell(new Phrase(dosage, regularFont));
                                        cDosage.setBackgroundColor(rowBg);
                                        cDosage.setPadding(6);
                                        cDosage.setBorderColor(borderGray);
                                        medTable.addCell(cDosage);

                                        // Frequency
                                        String freq = item.getFrequency() != null ? item.getFrequency() : "—";
                                        if (item.getDuration() != null && !item.getDuration().isBlank()) {
                                                freq += " (" + item.getDuration() + ")";
                                        }
                                        PdfPCell cFreq = new PdfPCell(new Phrase(freq, regularFont));
                                        cFreq.setBackgroundColor(rowBg);
                                        cFreq.setPadding(6);
                                        cFreq.setBorderColor(borderGray);
                                        medTable.addCell(cFreq);

                                        // Quantity
                                        String qty = item.getQuantity() != null ? item.getQuantity() : "—";
                                        PdfPCell cQty = new PdfPCell(new Phrase(qty, regularFont));
                                        cQty.setBackgroundColor(rowBg);
                                        cQty.setPadding(6);
                                        cQty.setBorderColor(borderGray);
                                        medTable.addCell(cQty);

                                        // Instructions / Route
                                        String inst = item.getInstructions() != null ? item.getInstructions() : "";
                                        if (item.getRoute() != null && !item.getRoute().isBlank()) {
                                                inst = (inst.isBlank() ? "" : (inst + " • ")) + "Route: "
                                                                + item.getRoute();
                                        }
                                        if (inst.isBlank())
                                                inst = "As directed by vet";
                                        PdfPCell cInst = new PdfPCell(new Phrase(inst, regularFont));
                                        cInst.setBackgroundColor(rowBg);
                                        cInst.setPadding(6);
                                        cInst.setBorderColor(borderGray);
                                        medTable.addCell(cInst);

                                        idx++;
                                }
                        }

                        document.add(medTable);

                        // ==========================================
                        // 5. INSTRUCTIONS & DIETARY ADVICE
                        // ==========================================
                        if (prescription.getInstructions() != null && !prescription.getInstructions().isBlank()) {
                                document.add(new Paragraph(" ", FontFactory.getFont(FontFactory.HELVETICA, 6)));

                                PdfPTable instTable = new PdfPTable(1);
                                instTable.setWidthPercentage(100);

                                PdfPCell instCell = new PdfPCell();
                                instCell.setBackgroundColor(lightGreenBg);
                                instCell.setBorderColor(new Color(167, 243, 208));
                                instCell.setPadding(10);

                                Paragraph instHeader = new Paragraph("📋 GENERAL INSTRUCTIONS & CARE ADVICE",
                                                sectionTitleFont);
                                instHeader.setSpacingAfter(4);
                                instCell.addElement(instHeader);

                                instCell.addElement(new Paragraph(prescription.getInstructions().trim(), regularFont));
                                instTable.addCell(instCell);

                                document.add(instTable);
                        }

                        // ==========================================
                        // 6. SIGNATURE & FOOTER
                        // ==========================================
                        document.add(new Paragraph(" ", FontFactory.getFont(FontFactory.HELVETICA, 10)));

                        PdfPTable sigTable = new PdfPTable(2);
                        sigTable.setWidthPercentage(100);
                        sigTable.setWidths(new float[] { 1.2f, 0.8f });

                        PdfPCell leftNoticeCell = new PdfPCell();
                        leftNoticeCell.setBorder(Rectangle.NO_BORDER);
                        leftNoticeCell.addElement(
                                        new Paragraph("• Administer medications strictly as prescribed.", footerFont));
                        leftNoticeCell.addElement(new Paragraph("• Keep out of reach of children and other animals.",
                                        footerFont));
                        leftNoticeCell.addElement(new Paragraph(
                                        "• In case of adverse reactions, contact emergency clinic immediately.",
                                        footerFont));
                        sigTable.addCell(leftNoticeCell);

                        PdfPCell rightSigCell = new PdfPCell();
                        rightSigCell.setBorder(Rectangle.NO_BORDER);
                        rightSigCell.setHorizontalAlignment(Element.ALIGN_RIGHT);

                        Paragraph docNameP = new Paragraph(
                                        prescription.getDoctorName() != null ? prescription.getDoctorName()
                                                        : "Attending Veterinary Surgeon",
                                        regularBoldFont);
                        docNameP.setAlignment(Element.ALIGN_RIGHT);
                        rightSigCell.addElement(docNameP);

                        Paragraph sigNoteP = new Paragraph("Digitally Certified • Zenve Vet Portal", footerFont);
                        sigNoteP.setAlignment(Element.ALIGN_RIGHT);
                        rightSigCell.addElement(sigNoteP);

                        sigTable.addCell(rightSigCell);
                        document.add(sigTable);

                        // Bottom Brand Divider
                        document.add(new Paragraph(" ", FontFactory.getFont(FontFactory.HELVETICA, 8)));
                        Paragraph finalFooter = new Paragraph(
                                        "Zenve Vet Care • India's Premier Veterinary Clinical Community & Network • https://doctor.zenvevet.com",
                                        footerFont);
                        finalFooter.setAlignment(Element.ALIGN_CENTER);
                        document.add(finalFooter);

                        document.close();
                        return outputStream.toByteArray();

                } catch (DocumentException e) {
                        throw new RuntimeException("Failed to generate veterinary prescription PDF: " + e.getMessage(),
                                        e);
                }
        }
}