package com.transit.hub.infrastructure.seed.gtfs;

import com.transit.hub.application.service.GtfsImportOrchestrator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class GtfsRefreshSchedulerTest {

    @Mock
    private GtfsImportOrchestrator orchestrator;

    @InjectMocks
    private GtfsRefreshScheduler scheduler;

    @Test
    void refresh_doesNothingWhenFeedUrlIsBlank() {
        ReflectionTestUtils.setField(scheduler, "feedUrl", "");

        scheduler.refresh();

        verifyNoInteractions(orchestrator);
    }

    @Test
    void refresh_doesNothingWhenFeedUrlIsNull() {
        ReflectionTestUtils.setField(scheduler, "feedUrl", null);

        scheduler.refresh();

        verifyNoInteractions(orchestrator);
    }

    @Test
    void refresh_delegatesToOrchestratorWhenFeedUrlIsSet() {
        String url = "https://example.test/gtfs.zip";
        ReflectionTestUtils.setField(scheduler, "feedUrl", url);

        scheduler.refresh();

        verify(orchestrator).runImport(url, "scheduler");
    }

    @Test
    void refresh_doesNotRunWhenFeedUrlIsWhitespace() {
        ReflectionTestUtils.setField(scheduler, "feedUrl", "   ");

        scheduler.refresh();

        verify(orchestrator, never()).runImport(org.mockito.ArgumentMatchers.anyString(),
                                                org.mockito.ArgumentMatchers.anyString());
    }
}
