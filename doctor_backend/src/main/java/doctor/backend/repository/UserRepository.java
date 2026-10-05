package doctor.backend.repository;

import doctor.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    Optional<User> findByPhone(String phone);

    @org.springframework.data.jpa.repository.Query("SELECT u FROM User u WHERE u.phone = :phone OR REPLACE(u.phone, ' ', '') = :phone OR REPLACE(REPLACE(u.phone, '+91', ''), ' ', '') = :phone")
    Optional<User> findByFlexiblePhone(@org.springframework.data.repository.query.Param("phone") String phone);

    boolean existsByEmail(String email);

    boolean existsByPhone(String phone);

    Optional<User> findByResetToken(String resetToken);
    
    Optional<User> findByLoginSessionToken(String loginSessionToken);
}
