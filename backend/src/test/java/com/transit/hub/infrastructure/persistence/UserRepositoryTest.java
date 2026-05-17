package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.cache.autoconfigure.CacheAutoConfiguration;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@Execution(ExecutionMode.SAME_THREAD)
@DataJpaTest
@ImportAutoConfiguration(CacheAutoConfiguration.class)
@ActiveProfiles("test")
@DisplayName("UserRepository")
class UserRepositoryTest {

    @Autowired
    private UserRepository repository;

    @Autowired
    private TestEntityManager em;

    private User adminUser;
    private User agentUser;
    private User disabledUser;

    @BeforeEach
    void setUp() {
        adminUser = User.builder()
                .username("admin")
                .password("hashed_admin_password")
                .role(UserRole.ADMIN)
                .enabled(true)
                .build();
        em.persist(adminUser);

        agentUser = User.builder()
                .username("agent")
                .password("hashed_agent_password")
                .role(UserRole.AGENT)
                .enabled(true)
                .build();
        em.persist(agentUser);

        disabledUser = User.builder()
                .username("disabled_agent")
                .password("hashed_disabled_password")
                .role(UserRole.AGENT)
                .enabled(false)
                .build();
        em.persist(disabledUser);

        em.flush();
        em.clear();
    }

    @Nested
    @DisplayName("findByUsername")
    class FindByUsername {

        @Test
        @DisplayName("returns user when username exists")
        void returnsUserWhenExists() {
            Optional<User> result = repository.findByUsername("admin");

            assertThat(result).isPresent();
            User user = result.get();
            assertThat(user.getUsername()).isEqualTo("admin");
            assertThat(user.getRole()).isEqualTo(UserRole.ADMIN);
            assertThat(user.isEnabled()).isTrue();
        }

        @Test
        @DisplayName("returns empty when username does not exist")
        void returnsEmptyWhenDoesNotExist() {
            Optional<User> result = repository.findByUsername("nonexistent");

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("username search is case-sensitive")
        void usernameSearchIsCaseSensitive() {
            Optional<User> result = repository.findByUsername("Admin");

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("returns disabled user when found by username")
        void returnsDisabledUser() {
            Optional<User> result = repository.findByUsername("disabled_agent");

            assertThat(result).isPresent();
            assertThat(result.get().isEnabled()).isFalse();
            assertThat(result.get().getRole()).isEqualTo(UserRole.AGENT);
        }
    }

    @Nested
    @DisplayName("existsByUsername")
    class ExistsByUsername {

        @Test
        @DisplayName("returns true when username exists")
        void returnsTrueWhenExists() {
            boolean result = repository.existsByUsername("agent");

            assertThat(result).isTrue();
        }

        @Test
        @DisplayName("returns false when username does not exist")
        void returnsFalseWhenDoesNotExist() {
            boolean result = repository.existsByUsername("unknown");

            assertThat(result).isFalse();
        }

        @Test
        @DisplayName("returns true for disabled user")
        void returnsTrueForDisabledUser() {
            boolean result = repository.existsByUsername("disabled_agent");

            assertThat(result).isTrue();
        }
    }

    @Nested
    @DisplayName("findAll (paginated)")
    class FindAllPaginated {

        @Test
        @DisplayName("returns all users paginated")
        void returnsAllUsersPaginated() {
            Page<User> result = repository.findAll(PageRequest.of(0, 10));

            assertThat(result.getContent()).hasSize(3);
            assertThat(result.getTotalElements()).isEqualTo(3);
        }

        @Test
        @DisplayName("respects page size")
        void respectsPageSize() {
            Page<User> result = repository.findAll(PageRequest.of(0, 2));

            assertThat(result.getContent()).hasSize(2);
            assertThat(result.getTotalElements()).isEqualTo(3);
            assertThat(result.getTotalPages()).isEqualTo(2);
        }

        @Test
        @DisplayName("second page contains remaining users")
        void secondPageContainsRemaining() {
            Page<User> result = repository.findAll(PageRequest.of(1, 2));

            assertThat(result.getContent()).hasSize(1);
        }

        @Test
        @DisplayName("returns empty page when page number exceeds available pages")
        void returnsEmptyWhenPageExceedsAvailable() {
            Page<User> result = repository.findAll(PageRequest.of(5, 10));

            assertThat(result.getContent()).isEmpty();
            assertThat(result.getTotalElements()).isEqualTo(3);
        }
    }

    @Nested
    @DisplayName("findBySearch")
    class FindBySearch {

        @Test
        @DisplayName("finds users by exact username match")
        void findsByExactUsername() {
            Page<User> result = repository.findBySearch("admin", PageRequest.of(0, 10));

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().getFirst().getUsername()).isEqualTo("admin");
        }

        @Test
        @DisplayName("finds users by partial username match")
        void findsByPartialUsername() {
            Page<User> result = repository.findBySearch("agent", PageRequest.of(0, 10));

            assertThat(result.getContent()).hasSize(2);
        }

        @Test
        @DisplayName("search is case-insensitive")
        void searchIsCaseInsensitive() {
            Page<User> result = repository.findBySearch("ADMIN", PageRequest.of(0, 10));

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().getFirst().getUsername()).isEqualTo("admin");
        }

        @Test
        @DisplayName("returns empty page when no users match")
        void returnsEmptyWhenNoMatch() {
            Page<User> result = repository.findBySearch("nonexistent", PageRequest.of(0, 10));

            assertThat(result.getContent()).isEmpty();
            assertThat(result.getTotalElements()).isZero();
        }

        @Test
        @DisplayName("respects pagination for search results")
        void respectsPagination() {
            Page<User> result = repository.findBySearch("agent", PageRequest.of(0, 1));

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getTotalElements()).isEqualTo(2);
            assertThat(result.getTotalPages()).isEqualTo(2);
        }

        @Test
        @DisplayName("finds by substring within username")
        void findsBySubstring() {
            Page<User> result = repository.findBySearch("disabled", PageRequest.of(0, 10));

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().getFirst().getUsername()).isEqualTo("disabled_agent");
        }
    }
}
