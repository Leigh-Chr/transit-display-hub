package com.transit.hub.bench;

import com.transit.hub.application.dto.response.FareCalculationResponse;
import com.transit.hub.application.service.FareCalculatorService;
import com.transit.hub.domain.model.Area;
import com.transit.hub.domain.model.FareAttribute;
import com.transit.hub.domain.model.FareLegRule;
import com.transit.hub.domain.model.FareProduct;
import com.transit.hub.domain.model.FareRule;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.infrastructure.persistence.AreaRepository;
import com.transit.hub.infrastructure.persistence.FareAttributeRepository;
import com.transit.hub.infrastructure.persistence.FareLegRuleRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.openjdk.jmh.annotations.Benchmark;
import org.openjdk.jmh.annotations.BenchmarkMode;
import org.openjdk.jmh.annotations.Mode;
import org.openjdk.jmh.annotations.OutputTimeUnit;
import org.openjdk.jmh.annotations.Param;
import org.openjdk.jmh.annotations.Scope;
import org.openjdk.jmh.annotations.Setup;
import org.openjdk.jmh.annotations.State;
import org.mockito.Mockito;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Measures the wall-clock cost of {@link FareCalculatorService#calculate}
 * over the V1 + V2 pipelines. Repositories are stubbed with Mockito
 * (constant-time {@code thenReturn}) so the measurement isolates the
 * service-side filtering / sorting work from the JPA round-trip.
 *
 * <p>The size sweep covers feeds we ingest in production:
 * 10 ≈ a small bus operator with one product per zone pair,
 * 100 ≈ a metropolitan operator with both V1 + V2 catalogues,
 * 1000 ≈ a regional rail or multi-modal feed with rider categories.
 *
 * <p>Target P95 < 50ms confirmed in
 * {@code project_deferred_backlog#5}.
 */
@State(Scope.Benchmark)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MICROSECONDS)
public class FareCalculatorServiceBenchmark {

    @Param({"10", "100", "1000"})
    public int catalogSize;

    private FareCalculatorService service;
    private UUID fromStopId;
    private UUID toStopId;

    @Setup
    public void setUp() {
        StopRepository stopRepo = Mockito.mock(StopRepository.class);
        FareAttributeRepository fareAttrRepo = Mockito.mock(FareAttributeRepository.class);
        FareLegRuleRepository legRuleRepo = Mockito.mock(FareLegRuleRepository.class);
        AreaRepository areaRepo = Mockito.mock(AreaRepository.class);
        MeterRegistry registry = new SimpleMeterRegistry();

        Stop from = new Stop();
        from.setId(UUID.randomUUID());
        from.setName("From");
        from.setZoneId("Z1");
        Stop to = new Stop();
        to.setId(UUID.randomUUID());
        to.setName("To");
        to.setZoneId("Z2");
        fromStopId = from.getId();
        toStopId = to.getId();
        Mockito.when(stopRepo.findById(fromStopId)).thenReturn(Optional.of(from));
        Mockito.when(stopRepo.findById(toStopId)).thenReturn(Optional.of(to));

        Area areaA = new Area();
        areaA.setId(UUID.randomUUID());
        areaA.setExternalId("AREA_A");
        areaA.setName("Area A");
        Area areaB = new Area();
        areaB.setId(UUID.randomUUID());
        areaB.setExternalId("AREA_B");
        areaB.setName("Area B");
        Mockito.when(areaRepo.findByStopId(fromStopId)).thenReturn(List.of(areaA));
        Mockito.when(areaRepo.findByStopId(toStopId)).thenReturn(List.of(areaB));

        // Build a representative catalogue. Half the entries match the
        // (Z1, Z2) pair / (areaA, areaB) pair, the other half don't —
        // mirrors a feed where most rules are scoped to other zones.
        List<FareAttribute> v1 = new ArrayList<>(catalogSize);
        for (int i = 0; i < catalogSize; i++) {
            FareAttribute attr = new FareAttribute();
            attr.setExternalId("FA" + i);
            attr.setPrice(java.math.BigDecimal.valueOf(1.7 + (i % 5) * 0.1));
            attr.setCurrency("EUR");
            FareRule rule = new FareRule();
            rule.setOriginId(i % 2 == 0 ? "Z1" : "ZX");
            rule.setDestinationId(i % 2 == 0 ? "Z2" : "ZY");
            attr.setRules(List.of(rule));
            v1.add(attr);
        }
        Mockito.when(fareAttrRepo.findAllWithRules()).thenReturn(v1);

        List<FareLegRule> v2 = new ArrayList<>(catalogSize);
        for (int i = 0; i < catalogSize; i++) {
            FareLegRule rule = new FareLegRule();
            rule.setLegGroupId("LG" + i);
            rule.setRulePriority(i);
            FareProduct product = new FareProduct();
            product.setExternalId("FP" + i);
            product.setName("Product " + i);
            product.setAmount(java.math.BigDecimal.valueOf(1.7 + (i % 5) * 0.1));
            product.setCurrency("EUR");
            rule.setFareProduct(product);
            // Half the rules match (areaA → areaB), half don't.
            rule.setFromArea(i % 2 == 0 ? areaA : null);
            rule.setToArea(i % 2 == 0 ? areaB : null);
            v2.add(rule);
        }
        Mockito.when(legRuleRepo.findAllWithRefs()).thenReturn(v2);

        service = new FareCalculatorService(stopRepo, fareAttrRepo, legRuleRepo,
                areaRepo, registry);
    }

    @Benchmark
    public Optional<FareCalculationResponse> calculate() {
        return service.calculate(fromStopId, toStopId);
    }
}
