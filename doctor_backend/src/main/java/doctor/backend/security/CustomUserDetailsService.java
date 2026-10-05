package doctor.backend.security;

import doctor.backend.entity.User;
import doctor.backend.repository.UserRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String identifier) throws UsernameNotFoundException {

        if (identifier == null || identifier.isBlank()) {
            throw new UsernameNotFoundException("Identifier is required");
        }

        String cleanIdentifier = identifier.trim().toLowerCase();
        String digitsOnly = identifier.replaceAll("[^0-9]", "");

        User user = findUserByIdentifier(cleanIdentifier, digitsOnly)
                .orElseThrow(() -> new UsernameNotFoundException("No account found for: " + identifier));

        return org.springframework.security.core.userdetails.User.builder()
                .username(user.getEmail())
                .password(user.getPassword())
                .disabled(!user.isActive())
                .authorities(List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole())))
                .build();
    }

    private Optional<User> findUserByIdentifier(String cleanIdentifier, String digitsOnly) {
        Optional<User> byEmail = userRepository.findByEmail(cleanIdentifier);
        if (byEmail.isPresent()) {
            return byEmail;
        }
        if (!digitsOnly.isBlank()) {
            Optional<User> byPhone = userRepository.findByFlexiblePhone(digitsOnly);
            if (byPhone.isPresent()) {
                return byPhone;
            }
            byPhone = userRepository.findByPhone(digitsOnly);
            if (byPhone.isPresent()) {
                return byPhone;
            }
        }
        return userRepository.findByPhone(cleanIdentifier);
    }
}
