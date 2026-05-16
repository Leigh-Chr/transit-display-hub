package com.transit.hub.infrastructure.seed.gtfs;

import com.transit.hub.application.service.GtfsImportOrchestrator;
import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.ImportStatus;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.persistence.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GtfsDataLoaderTest {

    @Mock private UserRepository userRepository;
    @Mock private LineRepository lineRepository;
    @Mock private StopRepository stopRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private GtfsImportOrchestrator orchestrator;

    @InjectMocks private GtfsDataLoader loader;

    @BeforeEach
    void setUp() {
        // Mirror the values @Value would inject; ReflectionTestUtils is the
        // standard way to do this when bypassing the Spring context.
        ReflectionTestUtils.setField(loader, "feedUrl", "https://example.test/gtfs.zip");
        ReflectionTestUtils.setField(loader, "networkName", "Test Network");
    }

    @Test
    void skipsWhenUsersAlreadySeeded() {
        when(userRepository.count()).thenReturn(5L);

        loader.run();

        // Critical: must not re-create users (would duplicate the admin row,
        // which then breaks login on the second boot) and must not re-trigger
        // an import that the daily scheduler will handle.
        verify(userRepository, never()).save(any());
        verifyNoInteractions(orchestrator);
    }

    @Test
    void skipsWhenLinesAlreadyExist() {
        when(userRepository.count()).thenReturn(0L);
        when(lineRepository.count()).thenReturn(120L);

        loader.run();

        verify(userRepository, never()).save(any());
        verifyNoInteractions(orchestrator);
    }

    @Test
    void seedsFiveDefaultUsersOnEmptyDatabase() {
        when(userRepository.count()).thenReturn(0L).thenReturn(5L);
        when(lineRepository.count()).thenReturn(0L);
        when(passwordEncoder.encode(anyString())).thenAnswer(inv -> "encoded:" + inv.getArgument(0));
        when(orchestrator.runImport(anyString(), anyString()))
                .thenReturn(new GtfsImportOrchestrator.ImportOutcome(
                        ImportStatus.SUCCESS, null, null));

        loader.run();

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository, times(5)).save(userCaptor.capture());
        // admin, supervisor, agent, operator1, operator2
        assertThat(userCaptor.getAllValues())
                .extracting(User::getUsername)
                .containsExactly("admin", "supervisor", "agent", "operator1", "operator2");
        assertThat(userCaptor.getAllValues())
                .extracting(User::getRole)
                .containsExactly(UserRole.ADMIN, UserRole.ADMIN, UserRole.AGENT,
                                 UserRole.AGENT, UserRole.AGENT);
        assertThat(userCaptor.getAllValues())
                .allSatisfy(u -> assertThat(u.getPassword()).startsWith("encoded:"));
    }

    @Test
    void delegatesToOrchestratorWithBootTrigger() {
        when(userRepository.count()).thenReturn(0L).thenReturn(5L);
        when(lineRepository.count()).thenReturn(0L);
        when(passwordEncoder.encode(anyString())).thenReturn("encoded");
        when(orchestrator.runImport(anyString(), anyString()))
                .thenReturn(new GtfsImportOrchestrator.ImportOutcome(
                        ImportStatus.SUCCESS, null, null));

        loader.run();

        // The "boot" label is what surfaces in import_audit rows and lets
        // operators distinguish the boot-time seed from the daily scheduler
        // run or a manual admin re-import.
        verify(orchestrator).runImport(eq("https://example.test/gtfs.zip"), eq("boot"));
    }

    @Test
    void doesNotThrowWhenOrchestratorReturnsNullResult() {
        when(userRepository.count()).thenReturn(0L).thenReturn(5L);
        when(lineRepository.count()).thenReturn(0L);
        when(passwordEncoder.encode(anyString())).thenReturn("encoded");
        when(orchestrator.runImport(anyString(), anyString()))
                .thenReturn(new GtfsImportOrchestrator.ImportOutcome(
                        ImportStatus.SKIPPED_UNCHANGED, null,
                        "feed unchanged since last import"));

        // The SKIPPED branch returns a null ImportResult — the loader must
        // log the warning rather than NPE through the summary table.
        loader.run();

        verify(orchestrator).runImport(anyString(), anyString());
    }
}
