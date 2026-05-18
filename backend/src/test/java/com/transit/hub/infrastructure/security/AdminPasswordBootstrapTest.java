package com.transit.hub.infrastructure.security;

import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.persistence.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("AdminPasswordBootstrap")
class AdminPasswordBootstrapTest {

    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;

    @InjectMocks
    private AdminPasswordBootstrap bootstrap;

    private User admin;

    @BeforeEach
    void seedAdmin() {
        admin = User.builder()
                .username(AdminPasswordBootstrap.ADMIN_USERNAME)
                .password(AdminPasswordBootstrap.SEEDED_HASH)
                .role(UserRole.ADMIN)
                .enabled(true)
                .passwordMustChange(true)
                .build();
    }

    @Nested
    @DisplayName("when INITIAL_ADMIN_PASSWORD is empty or blank")
    class WhenUnset {

        @Test
        @DisplayName("noop on empty string")
        void noopOnEmpty() {
            ReflectionTestUtils.setField(bootstrap, "initialAdminPassword", "");
            bootstrap.run();
            verify(userRepository, never()).findByUsername(any());
            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("noop on blank string")
        void noopOnBlank() {
            ReflectionTestUtils.setField(bootstrap, "initialAdminPassword", "   ");
            bootstrap.run();
            verify(userRepository, never()).findByUsername(any());
        }

        @Test
        @DisplayName("noop on null")
        void noopOnNull() {
            ReflectionTestUtils.setField(bootstrap, "initialAdminPassword", null);
            bootstrap.run();
            verify(userRepository, never()).findByUsername(any());
        }
    }

    @Nested
    @DisplayName("when INITIAL_ADMIN_PASSWORD is provided")
    class WhenSet {

        @BeforeEach
        void setEnv() {
            ReflectionTestUtils.setField(bootstrap, "initialAdminPassword", "operator-chosen");
        }

        @Test
        @DisplayName("replaces the seeded hash and keeps passwordMustChange = TRUE")
        void replacesSeededHash() {
            when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin));
            when(passwordEncoder.encode("operator-chosen")).thenReturn("$2b$10$encoded-fresh-hash");

            bootstrap.run();

            ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(captor.capture());
            User saved = captor.getValue();
            assertThat(saved.getPassword()).isEqualTo("$2b$10$encoded-fresh-hash");
            assertThat(saved.isPasswordMustChange()).isTrue();
        }

        @Test
        @DisplayName("leaves a rotated admin password alone")
        void leavesRotatedAdminAlone() {
            admin.setPassword("$2b$10$some-other-already-rotated-hash");
            when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin));

            bootstrap.run();

            verify(userRepository, never()).save(any());
            verify(passwordEncoder, never()).encode(any());
        }

        @Test
        @DisplayName("does nothing when there is no admin user")
        void noopWhenAdminMissing() {
            when(userRepository.findByUsername("admin")).thenReturn(Optional.empty());

            bootstrap.run();

            verify(userRepository, never()).save(any());
        }
    }
}
