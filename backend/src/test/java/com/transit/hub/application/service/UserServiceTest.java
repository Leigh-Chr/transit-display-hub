package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.CreateUserRequest;
import com.transit.hub.application.dto.request.UpdateUserRequest;
import com.transit.hub.application.dto.response.PageResponse;
import com.transit.hub.application.dto.response.UserResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.application.exception.ValidationException;
import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.persistence.UserRepository;
import com.transit.hub.testutil.TestDataFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserService")
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserService userService;

    private User testAdmin;
    private User testAgent;
    private UUID testAdminId;

    @BeforeEach
    void setUp() {
        testAdminId = UUID.randomUUID();
        testAdmin = TestDataFactory.createUser("admin", UserRole.ADMIN);
        testAdmin.setId(testAdminId);
        testAgent = TestDataFactory.createUser("agent", UserRole.AGENT);
        // Default: assume there is more than one active admin so destructive admin
        // tests can run; per-test setups override when checking the guard itself.
        lenient().when(userRepository.countByRoleAndEnabledTrue(UserRole.ADMIN)).thenReturn(2L);
    }

    @Nested
    @DisplayName("getAll()")
    class GetAll {

        @Test
        @DisplayName("returns all users")
        void returnsAllUsers() {
            when(userRepository.findAll(any(Pageable.class)))
                    .thenReturn(new PageImpl<>(List.of(testAdmin, testAgent)));

            List<UserResponse> result = userService.getAll();

            assertThat(result).hasSize(2);
            assertThat(result).extracting(UserResponse::username).containsExactly("admin", "agent");
        }

        @Test
        @DisplayName("returns empty list when no users")
        void returnsEmptyList() {
            when(userRepository.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of()));

            List<UserResponse> result = userService.getAll();

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("getAll(search, pageable)")
    class GetAllPaginated {

        @Test
        @DisplayName("returns paginated results without search")
        void withoutSearch_ReturnsPaginated() {
            Pageable pageable = PageRequest.of(0, 10);
            Page<User> page = new PageImpl<>(List.of(testAdmin, testAgent), pageable, 2);
            when(userRepository.findAll(pageable)).thenReturn(page);

            PageResponse<UserResponse> result = userService.getAll(null, pageable);

            assertThat(result.content()).hasSize(2);
            verify(userRepository).findAll(pageable);
            verify(userRepository, never()).findBySearch(anyString(), any());
        }

        @Test
        @DisplayName("returns paginated results with blank search")
        void withBlankSearch_ReturnsPaginated() {
            Pageable pageable = PageRequest.of(0, 10);
            Page<User> page = new PageImpl<>(List.of(testAdmin), pageable, 1);
            when(userRepository.findAll(pageable)).thenReturn(page);

            PageResponse<UserResponse> result = userService.getAll("  ", pageable);

            assertThat(result.content()).hasSize(1);
            verify(userRepository).findAll(pageable);
            verify(userRepository, never()).findBySearch(anyString(), any());
        }

        @Test
        @DisplayName("returns filtered results with search")
        void withSearch_ReturnsFiltered() {
            Pageable pageable = PageRequest.of(0, 10);
            Page<User> page = new PageImpl<>(List.of(testAdmin), pageable, 1);
            when(userRepository.findBySearch("admin", pageable)).thenReturn(page);

            PageResponse<UserResponse> result = userService.getAll("admin", pageable);

            assertThat(result.content()).hasSize(1);
            assertThat(result.content().getFirst().username()).isEqualTo("admin");
            verify(userRepository).findBySearch("admin", pageable);
        }

        @Test
        @DisplayName("trims search string")
        void trimsSearch() {
            Pageable pageable = PageRequest.of(0, 10);
            Page<User> page = new PageImpl<>(List.of(), pageable, 0);
            when(userRepository.findBySearch("admin", pageable)).thenReturn(page);

            userService.getAll("  admin  ", pageable);

            verify(userRepository).findBySearch("admin", pageable);
        }
    }

    @Nested
    @DisplayName("getById()")
    class GetById {

        @Test
        @DisplayName("returns user when found")
        void returnsUserWhenFound() {
            when(userRepository.findById(testAdminId)).thenReturn(Optional.of(testAdmin));

            UserResponse result = userService.getById(testAdminId);

            assertThat(result.id()).isEqualTo(testAdminId);
            assertThat(result.username()).isEqualTo("admin");
            assertThat(result.role()).isEqualTo(UserRole.ADMIN);
            assertThat(result.enabled()).isTrue();
        }

        @Test
        @DisplayName("throws EntityNotFoundException when not found")
        void throwsWhenNotFound() {
            UUID unknownId = UUID.randomUUID();
            when(userRepository.findById(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> userService.getById(unknownId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("User");
        }
    }

    @Nested
    @DisplayName("create()")
    class Create {

        @Test
        @DisplayName("creates user with encoded password")
        void withValidRequest_Succeeds() {
            CreateUserRequest request = new CreateUserRequest("newuser", "password123", UserRole.AGENT);
            when(userRepository.existsByUsername("newuser")).thenReturn(false);
            when(passwordEncoder.encode("password123")).thenReturn("encoded_password");
            when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
                User saved = invocation.getArgument(0);
                saved.setId(UUID.randomUUID());
                return saved;
            });

            UserResponse result = userService.create(request);

            assertThat(result.username()).isEqualTo("newuser");
            assertThat(result.role()).isEqualTo(UserRole.AGENT);
            assertThat(result.enabled()).isTrue();

            ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(captor.capture());
            assertThat(captor.getValue().getPassword()).isEqualTo("encoded_password");
            verify(passwordEncoder).encode("password123");
        }

        @Test
        @DisplayName("throws ValidationException when username already exists")
        void withDuplicateUsername_ThrowsValidation() {
            CreateUserRequest request = new CreateUserRequest("admin", "password123", UserRole.ADMIN);
            when(userRepository.existsByUsername("admin")).thenReturn(true);

            assertThatThrownBy(() -> userService.create(request))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("Username already exists");

            verify(userRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("update()")
    class Update {

        @Test
        @DisplayName("updates role and enabled status")
        void updatesRoleAndEnabled() {
            UpdateUserRequest request = new UpdateUserRequest(null, UserRole.AGENT, false);
            when(userRepository.findById(testAdminId)).thenReturn(Optional.of(testAdmin));
            when(userRepository.save(any(User.class))).thenReturn(testAdmin);

            UserResponse result = userService.update(testAdminId, request);

            verify(passwordEncoder, never()).encode(anyString());
            verify(userRepository).save(testAdmin);
            assertThat(testAdmin.getRole()).isEqualTo(UserRole.AGENT);
            assertThat(testAdmin.isEnabled()).isFalse();
        }

        @Test
        @DisplayName("updates password when provided")
        void updatesPasswordWhenProvided() {
            UpdateUserRequest request = new UpdateUserRequest("newpassword", UserRole.ADMIN, true);
            when(userRepository.findById(testAdminId)).thenReturn(Optional.of(testAdmin));
            when(passwordEncoder.encode("newpassword")).thenReturn("new_encoded_password");
            when(userRepository.save(any(User.class))).thenReturn(testAdmin);

            userService.update(testAdminId, request);

            verify(passwordEncoder).encode("newpassword");
            assertThat(testAdmin.getPassword()).isEqualTo("new_encoded_password");
        }

        @Test
        @DisplayName("does not update password when blank")
        void doesNotUpdatePasswordWhenBlank() {
            UpdateUserRequest request = new UpdateUserRequest("  ", UserRole.ADMIN, true);
            when(userRepository.findById(testAdminId)).thenReturn(Optional.of(testAdmin));
            when(userRepository.save(any(User.class))).thenReturn(testAdmin);

            userService.update(testAdminId, request);

            verify(passwordEncoder, never()).encode(anyString());
        }

        @Test
        @DisplayName("throws EntityNotFoundException when user not found")
        void throwsWhenNotFound() {
            UUID unknownId = UUID.randomUUID();
            UpdateUserRequest request = new UpdateUserRequest(null, UserRole.ADMIN, true);
            when(userRepository.findById(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> userService.update(unknownId, request))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("User");

            verify(userRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("update() - edge cases")
    class UpdateEdgeCases {

        @Test
        @DisplayName("does not update password when password is blank string")
        void doesNotUpdatePasswordWhenBlankString() {
            String originalPassword = testAdmin.getPassword();
            UpdateUserRequest request = new UpdateUserRequest("", UserRole.ADMIN, true);
            when(userRepository.findById(testAdminId)).thenReturn(Optional.of(testAdmin));
            when(userRepository.save(any(User.class))).thenReturn(testAdmin);

            userService.update(testAdminId, request);

            verify(passwordEncoder, never()).encode(anyString());
            assertThat(testAdmin.getPassword()).isEqualTo(originalPassword);
        }

        @Test
        @DisplayName("updates role from AGENT to ADMIN")
        void updatesRoleFromAgentToAdmin() {
            UUID agentId = UUID.randomUUID();
            testAgent.setId(agentId);
            UpdateUserRequest request = new UpdateUserRequest(null, UserRole.ADMIN, true);
            when(userRepository.findById(agentId)).thenReturn(Optional.of(testAgent));
            when(userRepository.save(any(User.class))).thenReturn(testAgent);

            userService.update(agentId, request);

            assertThat(testAgent.getRole()).isEqualTo(UserRole.ADMIN);
        }

        @Test
        @DisplayName("updates role from ADMIN to AGENT")
        void updatesRoleFromAdminToAgent() {
            UpdateUserRequest request = new UpdateUserRequest(null, UserRole.AGENT, true);
            when(userRepository.findById(testAdminId)).thenReturn(Optional.of(testAdmin));
            when(userRepository.save(any(User.class))).thenReturn(testAdmin);

            userService.update(testAdminId, request);

            assertThat(testAdmin.getRole()).isEqualTo(UserRole.AGENT);
        }

        @Test
        @DisplayName("toggles enabled from true to false")
        void togglesEnabledToFalse() {
            assertThat(testAdmin.isEnabled()).isTrue();
            UpdateUserRequest request = new UpdateUserRequest(null, UserRole.ADMIN, false);
            when(userRepository.findById(testAdminId)).thenReturn(Optional.of(testAdmin));
            when(userRepository.save(any(User.class))).thenReturn(testAdmin);

            userService.update(testAdminId, request);

            assertThat(testAdmin.isEnabled()).isFalse();
        }

        @Test
        @DisplayName("toggles enabled from false to true")
        void togglesEnabledToTrue() {
            testAdmin.setEnabled(false);
            assertThat(testAdmin.isEnabled()).isFalse();
            UpdateUserRequest request = new UpdateUserRequest(null, UserRole.ADMIN, true);
            when(userRepository.findById(testAdminId)).thenReturn(Optional.of(testAdmin));
            when(userRepository.save(any(User.class))).thenReturn(testAdmin);

            userService.update(testAdminId, request);

            assertThat(testAdmin.isEnabled()).isTrue();
        }
    }

    @Nested
    @DisplayName("getAll(search, pageable) - null vs blank search")
    class GetAllSearchBehavior {

        @Test
        @DisplayName("null search uses findAll")
        void nullSearch_UsesFindAll() {
            Pageable pageable = PageRequest.of(0, 10);
            Page<User> page = new PageImpl<>(List.of(testAdmin), pageable, 1);
            when(userRepository.findAll(pageable)).thenReturn(page);

            userService.getAll(null, pageable);

            verify(userRepository).findAll(pageable);
            verify(userRepository, never()).findBySearch(anyString(), any());
        }

        @Test
        @DisplayName("empty string search uses findAll")
        void emptySearch_UsesFindAll() {
            Pageable pageable = PageRequest.of(0, 10);
            Page<User> page = new PageImpl<>(List.of(testAdmin), pageable, 1);
            when(userRepository.findAll(pageable)).thenReturn(page);

            userService.getAll("", pageable);

            verify(userRepository).findAll(pageable);
            verify(userRepository, never()).findBySearch(anyString(), any());
        }
    }

    @Nested
    @DisplayName("delete()")
    class Delete {

        @Test
        @DisplayName("deletes existing user")
        void withExistingId_Succeeds() {
            when(userRepository.findById(testAdminId)).thenReturn(Optional.of(testAdmin));

            userService.delete(testAdminId);

            verify(userRepository).deleteById(testAdminId);
        }

        @Test
        @DisplayName("throws EntityNotFoundException when user not found")
        void withNonExistentId_ThrowsNotFound() {
            UUID unknownId = UUID.randomUUID();
            when(userRepository.findById(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> userService.delete(unknownId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("User");

            verify(userRepository, never()).deleteById(any());
        }

        @Test
        @DisplayName("does not delete the last active admin")
        void refusesLastActiveAdmin() {
            when(userRepository.findById(testAdminId)).thenReturn(Optional.of(testAdmin));
            when(userRepository.countByRoleAndEnabledTrue(UserRole.ADMIN)).thenReturn(1L);

            assertThatThrownBy(() -> userService.delete(testAdminId))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("last active administrator");

            verify(userRepository, never()).deleteById(any());
        }

        @Test
        @DisplayName("allows deleting an agent regardless of admin count")
        void allowsAgentDelete() {
            UUID agentId = UUID.randomUUID();
            testAgent.setId(agentId);
            when(userRepository.findById(agentId)).thenReturn(Optional.of(testAgent));

            userService.delete(agentId);

            verify(userRepository).deleteById(agentId);
            // Guard should not query the count when subject isn't an active admin
            verify(userRepository, never()).countByRoleAndEnabledTrue(UserRole.ADMIN);
        }
    }

    @Nested
    @DisplayName("update() - last admin guard")
    class UpdateLastAdminGuard {

        @Test
        @DisplayName("refuses to disable the last active admin")
        void refusesDisableLastAdmin() {
            UpdateUserRequest request = new UpdateUserRequest(null, UserRole.ADMIN, false);
            when(userRepository.findById(testAdminId)).thenReturn(Optional.of(testAdmin));
            when(userRepository.countByRoleAndEnabledTrue(UserRole.ADMIN)).thenReturn(1L);

            assertThatThrownBy(() -> userService.update(testAdminId, request))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("last active administrator");

            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("refuses to demote the last active admin")
        void refusesDemoteLastAdmin() {
            UpdateUserRequest request = new UpdateUserRequest(null, UserRole.AGENT, true);
            when(userRepository.findById(testAdminId)).thenReturn(Optional.of(testAdmin));
            when(userRepository.countByRoleAndEnabledTrue(UserRole.ADMIN)).thenReturn(1L);

            assertThatThrownBy(() -> userService.update(testAdminId, request))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("last active administrator");

            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("allows promoting an agent even when only one admin exists")
        void allowsPromote() {
            UUID agentId = UUID.randomUUID();
            testAgent.setId(agentId);
            UpdateUserRequest request = new UpdateUserRequest(null, UserRole.ADMIN, true);
            when(userRepository.findById(agentId)).thenReturn(Optional.of(testAgent));
            when(userRepository.save(any(User.class))).thenReturn(testAgent);

            userService.update(agentId, request);

            assertThat(testAgent.getRole()).isEqualTo(UserRole.ADMIN);
        }
    }
}
