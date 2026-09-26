package doctor.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;

public class ExecutiveDoctorAddRequest {

    @NotBlank(message = "Full name is required")
    private String fullName;
    
    private String email; 
    
    private String password;
    
    @NotBlank(message = "Phone number is required")
    private String phone;
    
    private String qualification;
    private String specializations;
    private Integer experienceYears;
    private Double consultationFee;
    private Integer pincode;
    private String city;

    private String profileImage;
    private String signatureImage;
    private String digitalSignatureImage;
    private String clinicInsideImage;
    private String clinicOutsideImage;

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getQualification() {
        return qualification;
    }

    public void setQualification(String qualification) {
        this.qualification = qualification;
    }

    public String getSpecializations() {
        return specializations;
    }

    public void setSpecializations(String specializations) {
        this.specializations = specializations;
    }

    public Integer getExperienceYears() {
        return experienceYears;
    }

    public void setExperienceYears(Integer experienceYears) {
        this.experienceYears = experienceYears;
    }

    public Double getConsultationFee() {
        return consultationFee;
    }

    public void setConsultationFee(Double consultationFee) {
        this.consultationFee = consultationFee;
    }

    public Integer getPincode() {
        return pincode;
    }

    public void setPincode(Integer pincode) {
        this.pincode = pincode;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getProfileImage() {
        return profileImage;
    }

    public void setProfileImage(String profileImage) {
        this.profileImage = profileImage;
    }

    public String getSignatureImage() {
        return signatureImage;
    }

    public void setSignatureImage(String signatureImage) {
        this.signatureImage = signatureImage;
    }

    public String getDigitalSignatureImage() {
        return digitalSignatureImage != null && !digitalSignatureImage.isBlank() ? digitalSignatureImage : signatureImage;
    }

    public void setDigitalSignatureImage(String digitalSignatureImage) {
        this.digitalSignatureImage = digitalSignatureImage;
    }

    public String getClinicInsideImage() {
        return clinicInsideImage;
    }

    public void setClinicInsideImage(String clinicInsideImage) {
        this.clinicInsideImage = clinicInsideImage;
    }

    public String getClinicOutsideImage() {
        return clinicOutsideImage;
    }

    public void setClinicOutsideImage(String clinicOutsideImage) {
        this.clinicOutsideImage = clinicOutsideImage;
    }
}
