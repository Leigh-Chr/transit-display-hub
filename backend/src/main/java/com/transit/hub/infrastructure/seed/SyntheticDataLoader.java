package com.transit.hub.infrastructure.seed;

import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.Device;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.ItineraryStop;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Schedule;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.DeviceStatus;
import com.transit.hub.domain.model.enums.LineType;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.domain.model.enums.MessageSeverity;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.domain.util.ColorContrast;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.DeviceRepository;
import com.transit.hub.infrastructure.persistence.ItineraryRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.persistence.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.CacheManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "app.data-loader.source", havingValue = "synthetic")
public class SyntheticDataLoader implements CommandLineRunner {

    private final UserRepository userRepository;
    private final LineRepository lineRepository;
    private final StopRepository stopRepository;
    private final ItineraryRepository itineraryRepository;
    private final ScheduleRepository scheduleRepository;
    private final DeviceRepository deviceRepository;
    private final BroadcastMessageRepository messageRepository;
    private final PasswordEncoder passwordEncoder;
    private final CacheManager cacheManager;

    private final Random random = new Random(42); // Fixed seed for reproducibility

    @Override
    @Transactional
    public void run(String... args) {
        if (userRepository.count() == 0) {
            log.info("=== Starting Transit Display Hub Data Seeding ===");

            createUsers();
            Map<String, Line> lines = createLines();
            Map<String, Stop> stops = createStops(lines);
            Map<String, Itinerary> itineraries = createItineraries(lines, stops);
            createSchedules(itineraries);
            createDevices(stops);
            createMessages(lines, stops);

            log.info("=== Data Seeding Complete ===");
            logSummary();
        }
        // Evict the network-map / network-alerts caches whether we
        // just seeded or skipped (DB persisting from a previous run).
        // A warm-up request issued by the dev frontend during boot can
        // populate the cache with an empty snapshot before either the
        // seed completes or DevTools finishes its restart — clearing
        // here guarantees the first post-startup read returns fresh
        // data.
        evictNetworkCaches();
    }

    private void evictNetworkCaches() {
        for (String name : new String[]{"networkMap", "networkAlerts"}) {
            var cache = cacheManager.getCache(name);
            if (cache != null) {
                cache.clear();
            }
        }
    }

    private void createUsers() {
        log.info("Creating users...");

        // Admin users
        userRepository.save(User.builder()
                .username("admin")
                .password(passwordEncoder.encode("admin123"))
                .role(UserRole.ADMIN)
                .enabled(true)
                .build());

        userRepository.save(User.builder()
                .username("supervisor")
                .password(passwordEncoder.encode("super123"))
                .role(UserRole.ADMIN)
                .enabled(true)
                .build());

        // Agent users
        userRepository.save(User.builder()
                .username("agent")
                .password(passwordEncoder.encode("agent123"))
                .role(UserRole.AGENT)
                .enabled(true)
                .build());

        userRepository.save(User.builder()
                .username("operator1")
                .password(passwordEncoder.encode("oper123"))
                .role(UserRole.AGENT)
                .enabled(true)
                .build());

        userRepository.save(User.builder()
                .username("operator2")
                .password(passwordEncoder.encode("oper123"))
                .role(UserRole.AGENT)
                .enabled(true)
                .build());

        // Disabled users for testing
        userRepository.save(User.builder()
                .username("inactive")
                .password(passwordEncoder.encode("inactive123"))
                .role(UserRole.AGENT)
                .enabled(false)
                .build());

        userRepository.save(User.builder()
                .username("admin_disabled")
                .password(passwordEncoder.encode("admin123"))
                .role(UserRole.ADMIN)
                .enabled(false)
                .build());

        if (log.isInfoEnabled()) {
            log.info("Created {} users (3 admins, 4 agents, 2 disabled)", userRepository.count());
        }
    }

    private Map<String, Line> createLines() {
        log.info("Creating transit lines...");

        Map<String, Line> lines = new LinkedHashMap<>();

        lines.put("M1", saveLine("M1", "Red Line - East-West Express", "#E53935", LineType.METRO));
        lines.put("M2", saveLine("M2", "Blue Line - North-South", "#1E88E5", LineType.METRO));
        lines.put("M3", saveLine("M3", "Green Line - Ring", "#43A047", LineType.METRO));
        lines.put("M4", saveLine("M4", "Orange Line - Downtown Express", "#FB8C00", LineType.METRO));
        lines.put("A1", saveLine("A1", "Airport Express", "#8E24AA", LineType.TRAIN));
        lines.put("T1", saveLine("T1", "Tram - Riverside", "#00ACC1", LineType.TRAM));
        lines.put("T2", saveLine("T2", "Tram - University District", "#7CB342", LineType.TRAM));
        lines.put("B1", saveLine("B1", "Bus - Crosstown Connector", "#F4511E", LineType.BUS));

        if (log.isInfoEnabled()) {
            log.info("Created {} lines", lines.size());
        }
        return lines;
    }

    /** Builds a Line with the contrast-safe foreground color derived from
     *  {@code color}, so the synthetic seed mirrors the same invariant the
     *  GTFS importer enforces (every line carries an explicit textColor). */
    private Line saveLine(String code, String name, String color, LineType type) {
        return lineRepository.save(Line.builder()
                .code(code)
                .name(name)
                .color(color)
                .textColor(ColorContrast.readableTextColor(color))
                .type(type)
                .build());
    }

    private Map<String, Stop> createStops(Map<String, Line> lines) {
        log.info("Creating stops...");

        Map<String, Stop> stops = new LinkedHashMap<>();

        // Create shared multi-line stops first
        // Central Station is a major hub served by M1, M2, M3, M4, A1, T1, T2
        Stop centralStation = createStop("Central Station",
                lines.get("M1"), lines.get("M2"), lines.get("M3"),
                lines.get("M4"), lines.get("A1"), lines.get("T1"), lines.get("T2"));
        stops.put("Central Station", centralStation);

        // Convention Center is served by M1 and M3
        Stop conventionCenter = createStop("Convention Center",
                lines.get("M1"), lines.get("M3"));
        stops.put("Convention Center", conventionCenter);

        // University area is served by M1 and T2
        Stop university = createStop("University", lines.get("M1"), lines.get("T2"));
        stops.put("University", university);

        // M1 - Red Line (East to West) - unique stops
        String[] m1UniqueStops = {
            "Eastern Terminal", "Industrial Park",
            "City Hall", "Museum District",
            "Medical Center", "Technology Park", "Western Terminal"
        };
        createStopsForLine(lines.get("M1"), m1UniqueStops, stops);

        // M2 - Blue Line (North to South) - unique stops
        String[] m2UniqueStops = {
            "North Station", "Sports Complex", "Shopping Mall",
            "Financial District", "Opera House",
            "South Park", "Residential Area", "South Terminal"
        };
        createStopsForLine(lines.get("M2"), m2UniqueStops, stops);

        // M3 - Green Line (Ring) - unique stops
        String[] m3UniqueStops = {
            "Old Town", "Market Square", "Harbor",
            "Beach", "Marina", "Lighthouse Point", "Aquarium",
            "Botanical Garden", "Zoo", "Stadium"
        };
        createStopsForLine(lines.get("M3"), m3UniqueStops, stops);

        // M4 - Orange Line (Downtown Express) - unique stops
        String[] m4UniqueStops = {
            "Business Park", "Tech Hub",
            "Government Center", "Embassy Row", "International District"
        };
        createStopsForLine(lines.get("M4"), m4UniqueStops, stops);

        // A1 - Airport Express - unique stops
        String[] a1UniqueStops = {
            "Airport Terminal 1", "Airport Terminal 2", "Airport City",
            "Downtown Express"
        };
        createStopsForLine(lines.get("A1"), a1UniqueStops, stops);

        // T1 - Riverside Tram - unique stops
        String[] t1UniqueStops = {
            "Riverside Station", "Waterfront", "Ferry Terminal", "Fish Market",
            "Promenade", "Concert Hall", "Art Gallery"
        };
        createStopsForLine(lines.get("T1"), t1UniqueStops, stops);

        // T2 - University Tram - unique stops
        String[] t2UniqueStops = {
            "Science Campus", "Library", "Student Center",
            "Research Park", "Hospital"
        };
        createStopsForLine(lines.get("T2"), t2UniqueStops, stops);

        // B1 - Crosstown Bus - shares stops with M2, M1, M3, T2
        // This creates realistic multi-line correspondences (3-line stops)
        addLineToStop(stops, "M2-North Station", lines.get("B1"));
        addLineToStop(stops, "M2-Sports Complex", lines.get("B1"));
        addLineToStop(stops, "M2-Shopping Mall", lines.get("B1"));
        addLineToStop(stops, "Convention Center", lines.get("B1"));
        addLineToStop(stops, "University", lines.get("B1"));
        addLineToStop(stops, "T2-Research Park", lines.get("B1"));
        addLineToStop(stops, "T2-Hospital", lines.get("B1"));

        // B1-only stops
        String[] b1UniqueStops = {"Marketplace", "Campus Gardens"};
        createStopsForLine(lines.get("B1"), b1UniqueStops, stops);

        // Assign geographic and schematic coordinates to all stops
        assignCoordinates(stops);

        if (log.isInfoEnabled()) {
            log.info("Created {} stops across {} lines", stops.size(), lines.size());
        }
        return stops;
    }

    private Stop createStop(String name, Line... lines) {
        Set<Line> lineSet = new HashSet<>(Arrays.asList(lines));
        Stop stop = Stop.builder()
                .name(name)
                .lines(lineSet)
                .build();
        return stopRepository.save(stop);
    }

    private void createStopsForLine(Line line, String[] stopNames, Map<String, Stop> stops) {
        for (String name : stopNames) {
            String key = line.getCode() + "-" + name;
            Stop stop = Stop.builder()
                    .name(name)
                    .lines(new HashSet<>(Set.of(line)))
                    .build();
            stops.put(key, stopRepository.save(stop));
        }
    }

    private void addLineToStop(Map<String, Stop> stops, String key, Line line) {
        Stop stop = stops.get(key);
        if (stop != null) {
            stop.addLine(line);
            stopRepository.save(stop);
        } else {
            if (log.isWarnEnabled()) {
                log.warn("Stop key '{}' not found for line sharing with '{}'", key, line.getCode());
            }
        }
    }

    private void assignCoordinates(Map<String, Stop> stops) {
        // Schematic coordinates on a 1000x1000 grid
        // City center (Central Station) at (500, 450)
        Map<String, double[]> coords = new LinkedHashMap<>();

        // Central hub
        coords.put("Central Station", new double[]{500, 450});

        // M1 East-West (roughly horizontal through center)
        coords.put("Western Terminal", new double[]{50, 470});
        coords.put("Technology Park", new double[]{140, 465});
        coords.put("Medical Center", new double[]{240, 460});
        coords.put("Museum District", new double[]{350, 455});
        coords.put("Convention Center", new double[]{600, 430});
        coords.put("University", new double[]{700, 400});
        coords.put("City Hall", new double[]{790, 410});
        coords.put("Industrial Park", new double[]{870, 420});
        coords.put("Eastern Terminal", new double[]{960, 430});

        // M2 North-South (roughly vertical through center)
        coords.put("North Station", new double[]{510, 50});
        coords.put("Sports Complex", new double[]{505, 150});
        coords.put("Shopping Mall", new double[]{500, 270});
        coords.put("Financial District", new double[]{505, 560});
        coords.put("Opera House", new double[]{500, 650});
        coords.put("South Park", new double[]{495, 740});
        coords.put("Residential Area", new double[]{500, 830});
        coords.put("South Terminal", new double[]{500, 920});

        // M3 Ring (oval loop around center)
        coords.put("Old Town", new double[]{680, 370});
        coords.put("Market Square", new double[]{720, 290});
        coords.put("Harbor", new double[]{680, 210});
        coords.put("Beach", new double[]{590, 150});
        coords.put("Marina", new double[]{480, 130});
        coords.put("Lighthouse Point", new double[]{370, 170});
        coords.put("Aquarium", new double[]{300, 250});
        coords.put("Botanical Garden", new double[]{280, 350});
        coords.put("Zoo", new double[]{310, 440});
        coords.put("Stadium", new double[]{390, 490});

        // M4 Downtown Express (diagonal NW to SE)
        coords.put("Business Park", new double[]{240, 220});
        coords.put("Tech Hub", new double[]{330, 300});
        coords.put("Government Center", new double[]{420, 370});
        coords.put("Embassy Row", new double[]{590, 530});
        coords.put("International District", new double[]{680, 600});

        // A1 Airport Express (NE from center)
        coords.put("Downtown Express", new double[]{620, 330});
        coords.put("Airport City", new double[]{750, 220});
        coords.put("Airport Terminal 2", new double[]{850, 140});
        coords.put("Airport Terminal 1", new double[]{930, 70});

        // T1 Riverside Tram (NW to SE through center)
        coords.put("Art Gallery", new double[]{190, 310});
        coords.put("Concert Hall", new double[]{270, 360});
        coords.put("Promenade", new double[]{370, 410});
        coords.put("Fish Market", new double[]{590, 500});
        coords.put("Ferry Terminal", new double[]{670, 560});
        coords.put("Waterfront", new double[]{740, 630});
        coords.put("Riverside Station", new double[]{820, 700});

        // T2 University District (NW to E through center)
        coords.put("Science Campus", new double[]{120, 230});
        coords.put("Library", new double[]{230, 300});
        coords.put("Student Center", new double[]{340, 370});
        coords.put("Research Park", new double[]{760, 440});
        coords.put("Hospital", new double[]{830, 470});

        // B1 Crosstown Bus (unique stops)
        coords.put("Marketplace", new double[]{550, 350});
        coords.put("Campus Gardens", new double[]{730, 420});

        // Apply coordinates to all stops
        // Geographic: center at lat 48.8566, lng 2.3522 (Paris-like)
        // Scale: 1000 schematic units ≈ 0.06 degrees (~6.7 km)
        double centerLat = 48.8566;
        double centerLng = 2.3522;
        double schematicCenterX = 500;
        double schematicCenterY = 450;
        double scale = 0.00006;

        for (Stop stop : stops.values()) {
            double[] coord = coords.get(stop.getName());
            if (coord != null) {
                stop.setSchematicX(coord[0]);
                stop.setSchematicY(coord[1]);
                stop.setLongitude(centerLng + (coord[0] - schematicCenterX) * scale);
                stop.setLatitude(centerLat - (coord[1] - schematicCenterY) * scale);
                stopRepository.save(stop);
            }
        }

        if (log.isInfoEnabled()) {
            log.info("Assigned coordinates to {} stops", coords.size());
        }
    }

    private Map<String, Itinerary> createItineraries(Map<String, Line> lines, Map<String, Stop> stops) {
        log.info("Creating itineraries with ordered stops...");

        Map<String, Itinerary> itineraries = new LinkedHashMap<>();

        // M1 - Red Line - two directions with ordered stops
        itineraries.put("M1-E", createItineraryWithStops(lines.get("M1"), "Direction Eastern Terminal",
                stops, "M1-Western Terminal", "M1-Technology Park", "M1-Medical Center", "M1-Museum District",
                "Central Station", "Convention Center", "University", "M1-City Hall",
                "M1-Industrial Park", "M1-Eastern Terminal"));

        itineraries.put("M1-W", createItineraryWithStops(lines.get("M1"), "Direction Western Terminal",
                stops, "M1-Eastern Terminal", "M1-Industrial Park", "M1-City Hall",
                "University", "Convention Center", "Central Station",
                "M1-Museum District", "M1-Medical Center", "M1-Technology Park", "M1-Western Terminal"));

        // M2 - Blue Line - two directions
        itineraries.put("M2-N", createItineraryWithStops(lines.get("M2"), "Direction North Station",
                stops, "M2-South Terminal", "M2-Residential Area", "M2-South Park", "M2-Opera House",
                "M2-Financial District", "Central Station", "M2-Shopping Mall",
                "M2-Sports Complex", "M2-North Station"));

        itineraries.put("M2-S", createItineraryWithStops(lines.get("M2"), "Direction South Terminal",
                stops, "M2-North Station", "M2-Sports Complex", "M2-Shopping Mall",
                "Central Station", "M2-Financial District", "M2-Opera House",
                "M2-South Park", "M2-Residential Area", "M2-South Terminal"));

        // M3 - Green Line (Ring) - two directions
        itineraries.put("M3-CW", createItineraryWithStops(lines.get("M3"), "Clockwise",
                stops, "Central Station", "Convention Center", "M3-Old Town", "M3-Market Square",
                "M3-Harbor", "M3-Beach", "M3-Marina", "M3-Lighthouse Point",
                "M3-Aquarium", "M3-Botanical Garden", "M3-Zoo", "M3-Stadium"));

        itineraries.put("M3-CCW", createItineraryWithStops(lines.get("M3"), "Counter-clockwise",
                stops, "M3-Stadium", "M3-Zoo", "M3-Botanical Garden", "M3-Aquarium",
                "M3-Lighthouse Point", "M3-Marina", "M3-Beach", "M3-Harbor",
                "M3-Market Square", "M3-Old Town", "Convention Center", "Central Station"));

        // M4 - Orange Line
        itineraries.put("M4-BP", createItineraryWithStops(lines.get("M4"), "Direction Business Park",
                stops, "M4-International District", "M4-Embassy Row", "Central Station",
                "M4-Government Center", "M4-Tech Hub", "M4-Business Park"));

        itineraries.put("M4-ID", createItineraryWithStops(lines.get("M4"), "Direction International District",
                stops, "M4-Business Park", "M4-Tech Hub", "M4-Government Center",
                "Central Station", "M4-Embassy Row", "M4-International District"));

        // A1 - Airport Express
        itineraries.put("A1-AIR", createItineraryWithStops(lines.get("A1"), "Direction Airport Terminal 1",
                stops, "Central Station", "A1-Downtown Express", "A1-Airport City",
                "A1-Airport Terminal 2", "A1-Airport Terminal 1"));

        itineraries.put("A1-CTR", createItineraryWithStops(lines.get("A1"), "Direction Central Station",
                stops, "A1-Airport Terminal 1", "A1-Airport Terminal 2", "A1-Airport City",
                "A1-Downtown Express", "Central Station"));

        // T1 - Riverside Tram
        itineraries.put("T1-RS", createItineraryWithStops(lines.get("T1"), "Direction Riverside Station",
                stops, "T1-Art Gallery", "T1-Concert Hall", "T1-Promenade",
                "Central Station", "T1-Fish Market", "T1-Ferry Terminal",
                "T1-Waterfront", "T1-Riverside Station"));

        itineraries.put("T1-AG", createItineraryWithStops(lines.get("T1"), "Direction Art Gallery",
                stops, "T1-Riverside Station", "T1-Waterfront", "T1-Ferry Terminal",
                "T1-Fish Market", "Central Station", "T1-Promenade",
                "T1-Concert Hall", "T1-Art Gallery"));

        // T2 - University Tram
        itineraries.put("T2-SC", createItineraryWithStops(lines.get("T2"), "Direction Science Campus",
                stops, "T2-Hospital", "T2-Research Park", "University",
                "Central Station", "T2-Student Center", "T2-Library", "T2-Science Campus"));

        itineraries.put("T2-HP", createItineraryWithStops(lines.get("T2"), "Direction Hospital",
                stops, "T2-Science Campus", "T2-Library", "T2-Student Center",
                "Central Station", "University", "T2-Research Park", "T2-Hospital"));

        // B1 - Crosstown Bus (North to East, connecting M2 corridor to T2/M1 corridor)
        itineraries.put("B1-N", createItineraryWithStops(lines.get("B1"), "Direction North Station",
                stops, "T2-Hospital", "T2-Research Park", "B1-Campus Gardens", "University",
                "Convention Center", "B1-Marketplace", "M2-Shopping Mall", "M2-Sports Complex", "M2-North Station"));

        itineraries.put("B1-S", createItineraryWithStops(lines.get("B1"), "Direction Hospital",
                stops, "M2-North Station", "M2-Sports Complex", "M2-Shopping Mall", "B1-Marketplace",
                "Convention Center", "University", "B1-Campus Gardens", "T2-Research Park", "T2-Hospital"));

        if (log.isInfoEnabled()) {
            log.info("Created {} itineraries", itineraries.size());
        }
        return itineraries;
    }

    private Itinerary createItineraryWithStops(Line line, String name, Map<String, Stop> stops, String... stopKeys) {
        Itinerary itinerary = Itinerary.builder()
                .line(line)
                .name(name)
                .itineraryStops(new ArrayList<>())
                .build();

        itinerary = itineraryRepository.save(itinerary);

        int position = 0;
        for (String key : stopKeys) {
            Stop stop = stops.get(key);
            if (stop != null) {
                ItineraryStop itineraryStop = ItineraryStop.builder()
                        .itinerary(itinerary)
                        .stop(stop)
                        .position(position)
                        .build();
                itinerary.getItineraryStops().add(itineraryStop);
                position++;
            } else {
                if (log.isWarnEnabled()) {
                    log.warn("Stop key '{}' not found for itinerary '{}' (line '{}')", key, name, line.getCode());
                }
            }
        }

        return itineraryRepository.save(itinerary);
    }

    private void createSchedules(Map<String, Itinerary> itineraries) {
        log.info("Creating schedules...");

        int totalEntries = 0;

        for (Map.Entry<String, Itinerary> entry : itineraries.entrySet()) {
            Itinerary itinerary = entry.getValue();
            String lineCode = itinerary.getLine().getCode();

            List<ItineraryStop> orderedStops = itinerary.getItineraryStops().stream()
                    .sorted(Comparator.comparing(ItineraryStop::getPosition))
                    .toList();

            if (orderedStops.isEmpty()) {
                continue;
            }

            // Compute cumulative travel time based on line type
            int travelTimePerStop = getTravelTimePerStop(itinerary.getLine().getType());
            int[] cumulativeMinutes = new int[orderedStops.size()];
            cumulativeMinutes[0] = 0;
            for (int i = 1; i < orderedStops.size(); i++) {
                cumulativeMinutes[i] = cumulativeMinutes[i - 1] + travelTimePerStop + random.nextInt(2);
            }

            // Generate base departure times from the first stop
            List<LocalTime> baseTimes = generateScheduleTimes(lineCode);

            for (LocalTime baseTime : baseTimes) {
                for (int i = 0; i < orderedStops.size(); i++) {
                    LocalTime stopTime = baseTime.plusMinutes(cumulativeMinutes[i]);
                    // Skip if time wraps past midnight
                    if (i > 0 && stopTime.isBefore(baseTime)) {
                        break;
                    }

                    scheduleRepository.save(Schedule.builder()
                            .time(stopTime)
                            .stop(orderedStops.get(i).getStop())
                            .itinerary(itinerary)
                            .build());
                    totalEntries++;
                }
            }
        }

        log.info("Created {} schedules", totalEntries);
    }

    private int getTravelTimePerStop(LineType type) {
        if (type == null) {
            return 3;
        }
        return switch (type) {
            case METRO, MONORAIL -> 2;
            case TRAIN -> 4;
            case TRAM -> 3;
            case BUS, TROLLEYBUS -> 3;
            case FERRY -> 5;
            case FUNICULAR, CABLE_CAR -> 4;
            case OTHER -> 3;
        };
    }

    private List<LocalTime> generateScheduleTimes(String lineCode) {
        List<LocalTime> times = new ArrayList<>();

        // Different frequencies based on line type
        int peakInterval;
        int offPeakInterval;

        if (lineCode.startsWith("M")) {
            // Metro: high frequency
            peakInterval = 8;
            offPeakInterval = 15;
        } else if ("A1".equals(lineCode)) {
            // Airport Express: moderate frequency
            peakInterval = 15;
            offPeakInterval = 20;
        } else if (lineCode.startsWith("B")) {
            // Bus: lower frequency
            peakInterval = 12;
            offPeakInterval = 20;
        } else {
            // Tram: moderate frequency
            peakInterval = 10;
            offPeakInterval = 15;
        }

        // Early morning (6:00 - 7:00): off-peak
        addTimesInRange(times, LocalTime.of(6, 0), LocalTime.of(7, 0), offPeakInterval);

        // Morning rush (7:00 - 9:00): peak
        addTimesInRange(times, LocalTime.of(7, 0), LocalTime.of(9, 0), peakInterval);

        // Midday (9:00 - 16:00): off-peak
        addTimesInRange(times, LocalTime.of(9, 0), LocalTime.of(16, 0), offPeakInterval);

        // Evening rush (16:00 - 19:00): peak
        addTimesInRange(times, LocalTime.of(16, 0), LocalTime.of(19, 0), peakInterval);

        // Evening (19:00 - 23:00): off-peak
        addTimesInRange(times, LocalTime.of(19, 0), LocalTime.of(23, 0), offPeakInterval);

        return times;
    }

    private void addTimesInRange(List<LocalTime> times, LocalTime start, LocalTime end, int intervalMinutes) {
        LocalTime current = start;
        while (current.isBefore(end)) {
            times.add(current);
            current = current.plusMinutes(intervalMinutes);
        }
    }

    private void createDevices(Map<String, Stop> stops) {
        log.info("Creating devices...");

        int deviceCount = 0;
        int skippedStops = 0;
        int nullHeartbeatCount = 0;
        List<Stop> stopList = new ArrayList<>(stops.values());

        for (int idx = 0; idx < stopList.size(); idx++) {
            Stop stop = stopList.get(idx);

            // ~15% of minor stops have no display device (realistic: not all stops are equipped)
            boolean isMajorStop = stop.getName().contains("Central") ||
                stop.getName().contains("Terminal") ||
                stop.getName().contains("Airport") ||
                stop.getLines().size() > 1;
            if (!isMajorStop && idx % 7 == 0) {
                skippedStops++;
                continue;
            }

            int numDevices = 1;
            // Major hubs get multiple devices
            if (stop.getName().contains("Central") ||
                stop.getName().contains("Terminal") ||
                stop.getName().contains("Airport")) {
                numDevices = 2;
            }

            for (int i = 0; i < numDevices; i++) {
                String token = generateDeviceToken();
                String tokenLookup = token.substring(0, 8);
                String tokenHash = passwordEncoder.encode(token);

                DeviceStatus status;
                Instant lastHeartbeat;

                if (!isMajorStop && nullHeartbeatCount < 2) {
                    // Freshly registered devices on minor stops, never connected (null heartbeat)
                    status = DeviceStatus.OFFLINE;
                    lastHeartbeat = null;
                    nullHeartbeatCount++;
                } else if (random.nextDouble() < 0.85) {
                    status = DeviceStatus.ONLINE;
                    lastHeartbeat = Instant.now().minus(random.nextInt(60), ChronoUnit.SECONDS);
                } else {
                    status = DeviceStatus.OFFLINE;
                    lastHeartbeat = Instant.now().minus(random.nextInt(24 * 60) + 5, ChronoUnit.MINUTES);
                }

                deviceRepository.save(Device.builder()
                        .tokenLookup(tokenLookup)
                        .tokenHash(tokenHash)
                        .stop(stop)
                        .status(status)
                        .lastHeartbeat(lastHeartbeat)
                        .build());

                deviceCount++;

                // Log a few sample tokens for testing
                if (deviceCount <= 3) {
                    String lineCodes = stop.getLines().stream()
                            .map(Line::getCode)
                            .sorted()
                            .collect(Collectors.joining(", "));
                    // Log the plain token at DEBUG so dev terminals can copy it,
                    // without leaking it to default INFO-level prod logs.
                    if (log.isDebugEnabled()) {
                        log.debug("Sample device token for {} ({}): {}",
                                stop.getName(), lineCodes, token);
                    }
                }
            }
        }

        if (log.isInfoEnabled()) {
            log.info("Created {} devices ({} online, {} offline, {} stops without device)",
                    deviceCount,
                    deviceRepository.findByStatus(DeviceStatus.ONLINE).size(),
                    deviceRepository.findByStatus(DeviceStatus.OFFLINE).size(),
                    skippedStops);
        }
    }

    private String generateDeviceToken() {
        byte[] tokenBytes = new byte[32];
        random.nextBytes(tokenBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
    }

    private void createMessages(Map<String, Line> lines, Map<String, Stop> stops) {
        log.info("Creating broadcast messages...");

        Instant now = Instant.now();

        // NETWORK-wide messages
        messageRepository.save(BroadcastMessage.builder()
                .title("Welcome to Transit Hub")
                .content("Thank you for using our transit system. For real-time updates, download our mobile app.")
                .severity(MessageSeverity.INFO)
                .scopeType(MessageScope.NETWORK)
                .scopeId(null)
                .startTime(now.minus(7, ChronoUnit.DAYS))
                .endTime(now.plus(30, ChronoUnit.DAYS))
                .build());

        messageRepository.save(BroadcastMessage.builder()
                .title("Holiday Schedule")
                .content("Please note: Reduced service on weekends and holidays. Check our website for detailed schedules.")
                .severity(MessageSeverity.INFO)
                .scopeType(MessageScope.NETWORK)
                .scopeId(null)
                .startTime(now.minus(1, ChronoUnit.DAYS))
                .endTime(now.plus(14, ChronoUnit.DAYS))
                .build());

        messageRepository.save(BroadcastMessage.builder()
                .title("Safety Reminder")
                .content("Please stand clear of the doors. Mind the gap between the train and the platform.")
                .severity(MessageSeverity.WARNING)
                .scopeType(MessageScope.NETWORK)
                .scopeId(null)
                .startTime(now.minus(30, ChronoUnit.DAYS))
                .endTime(now.plus(365, ChronoUnit.DAYS))
                .build());

        // LINE-specific messages
        Line m1 = lines.get("M1");
        messageRepository.save(BroadcastMessage.builder()
                .title("M1 Track Maintenance")
                .content("Minor delays expected on the Red Line due to scheduled track maintenance between University and Medical Center.")
                .severity(MessageSeverity.WARNING)
                .scopeType(MessageScope.LINE)
                .scopeId(m1.getId())
                .startTime(now.minus(2, ChronoUnit.HOURS))
                .endTime(now.plus(6, ChronoUnit.HOURS))
                .build());

        Line m2 = lines.get("M2");
        messageRepository.save(BroadcastMessage.builder()
                .title("M2 Service Update")
                .content("Blue Line running normally. Next scheduled maintenance: Sunday 2am-5am.")
                .severity(MessageSeverity.INFO)
                .scopeType(MessageScope.LINE)
                .scopeId(m2.getId())
                .startTime(now)
                .endTime(now.plus(3, ChronoUnit.DAYS))
                .build());

        Line m3 = lines.get("M3");
        messageRepository.save(BroadcastMessage.builder()
                .title("M3 Special Event Service")
                .content("Extended service on the Green Ring Line for tonight's stadium event. Last train at 1:00 AM.")
                .severity(MessageSeverity.INFO)
                .scopeType(MessageScope.LINE)
                .scopeId(m3.getId())
                .startTime(now)
                .endTime(now.plus(12, ChronoUnit.HOURS))
                .build());

        Line a1 = lines.get("A1");
        messageRepository.save(BroadcastMessage.builder()
                .title("Airport Express - Flight Delays")
                .content("Due to weather conditions, some flights are delayed. Please check your flight status before traveling.")
                .severity(MessageSeverity.WARNING)
                .scopeType(MessageScope.LINE)
                .scopeId(a1.getId())
                .startTime(now.minus(1, ChronoUnit.HOURS))
                .endTime(now.plus(8, ChronoUnit.HOURS))
                .build());

        Line t1 = lines.get("T1");
        messageRepository.save(BroadcastMessage.builder()
                .title("T1 Riverside Festival")
                .content("Free rides on the Riverside Tram this Saturday for the annual River Festival!")
                .severity(MessageSeverity.INFO)
                .scopeType(MessageScope.LINE)
                .scopeId(t1.getId())
                .startTime(now)
                .endTime(now.plus(5, ChronoUnit.DAYS))
                .build());

        Line m4 = lines.get("M4");
        messageRepository.save(BroadcastMessage.builder()
                .title("M4 Signal Failure")
                .content("Critical signal failure between Government Center and Tech Hub. Expect major delays on the Orange Line.")
                .severity(MessageSeverity.CRITICAL)
                .scopeType(MessageScope.LINE)
                .scopeId(m4.getId())
                .startTime(now.minus(30, ChronoUnit.MINUTES))
                .endTime(now.plus(4, ChronoUnit.HOURS))
                .build());

        Line t2 = lines.get("T2");
        messageRepository.save(BroadcastMessage.builder()
                .title("T2 Exam Period Service")
                .content("Additional trams running on the University District line during exam period.")
                .severity(MessageSeverity.INFO)
                .scopeType(MessageScope.LINE)
                .scopeId(t2.getId())
                .startTime(now)
                .endTime(now.plus(14, ChronoUnit.DAYS))
                .build());

        Line b1 = lines.get("B1");
        messageRepository.save(BroadcastMessage.builder()
                .title("B1 Route Detour")
                .content("Due to road works near Marketplace, buses are diverted via alternate route. Allow extra travel time.")
                .severity(MessageSeverity.WARNING)
                .scopeType(MessageScope.LINE)
                .scopeId(b1.getId())
                .startTime(now.minus(1, ChronoUnit.DAYS))
                .endTime(now.plus(7, ChronoUnit.DAYS))
                .build());

        // Past LINE message (inactive)
        messageRepository.save(BroadcastMessage.builder()
                .title("M2 Past Maintenance Complete")
                .content("Blue Line maintenance has been completed. Normal service restored.")
                .severity(MessageSeverity.INFO)
                .scopeType(MessageScope.LINE)
                .scopeId(m2.getId())
                .startTime(now.minus(14, ChronoUnit.DAYS))
                .endTime(now.minus(7, ChronoUnit.DAYS))
                .build());

        // Future LINE message (not yet active)
        messageRepository.save(BroadcastMessage.builder()
                .title("A1 Planned Track Renewal")
                .content("Airport Express service will be suspended for 48h for track renewal. Bus replacement service available.")
                .severity(MessageSeverity.WARNING)
                .scopeType(MessageScope.LINE)
                .scopeId(a1.getId())
                .startTime(now.plus(20, ChronoUnit.DAYS))
                .endTime(now.plus(22, ChronoUnit.DAYS))
                .build());

        // STOP-specific messages
        Stop centralStation = stops.get("Central Station");
        if (centralStation != null) {
            messageRepository.save(BroadcastMessage.builder()
                    .title("Elevator Out of Service")
                    .content("The elevator at Platform 2 is temporarily out of service. Please use Platform 1 elevator or escalators.")
                    .severity(MessageSeverity.WARNING)
                    .scopeType(MessageScope.STOP)
                    .scopeId(centralStation.getId())
                    .startTime(now.minus(4, ChronoUnit.HOURS))
                    .endTime(now.plus(48, ChronoUnit.HOURS))
                    .build());
        }

        Stop airportT1 = stops.get("A1-Airport Terminal 1");
        if (airportT1 != null) {
            messageRepository.save(BroadcastMessage.builder()
                    .title("Terminal 1 - Check-in Reminder")
                    .content("International flights: Please arrive at least 3 hours before departure for security and customs.")
                    .severity(MessageSeverity.INFO)
                    .scopeType(MessageScope.STOP)
                    .scopeId(airportT1.getId())
                    .startTime(now.minus(30, ChronoUnit.DAYS))
                    .endTime(now.plus(365, ChronoUnit.DAYS))
                    .build());
        }

        Stop stadium = stops.get("M3-Stadium");
        if (stadium != null) {
            messageRepository.save(BroadcastMessage.builder()
                    .title("Match Day - Heavy Crowds Expected")
                    .content("Football match at 7:30 PM. Expect heavy crowds. Extra trains will run after the match.")
                    .severity(MessageSeverity.WARNING)
                    .scopeType(MessageScope.STOP)
                    .scopeId(stadium.getId())
                    .startTime(now)
                    .endTime(now.plus(8, ChronoUnit.HOURS))
                    .build());
        }

        Stop university = stops.get("University");
        if (university != null) {
            messageRepository.save(BroadcastMessage.builder()
                    .title("Graduation Ceremony")
                    .content("University graduation today. Congratulations to all graduates! Expect busy platforms.")
                    .severity(MessageSeverity.INFO)
                    .scopeType(MessageScope.STOP)
                    .scopeId(university.getId())
                    .startTime(now)
                    .endTime(now.plus(10, ChronoUnit.HOURS))
                    .build());
        }

        // CRITICAL message on a STOP
        Stop financialDistrict = stops.get("M2-Financial District");
        if (financialDistrict != null) {
            messageRepository.save(BroadcastMessage.builder()
                    .title("Suspicious Package - Platform Closed")
                    .content("Platform B temporarily closed due to security investigation. Use Platform A. Follow staff instructions.")
                    .severity(MessageSeverity.CRITICAL)
                    .scopeType(MessageScope.STOP)
                    .scopeId(financialDistrict.getId())
                    .startTime(now.minus(20, ChronoUnit.MINUTES))
                    .endTime(now.plus(3, ChronoUnit.HOURS))
                    .build());
        }

        // Past STOP message (inactive)
        Stop shoppingMall = stops.get("M2-Shopping Mall");
        if (shoppingMall != null) {
            messageRepository.save(BroadcastMessage.builder()
                    .title("Escalator Repair Completed")
                    .content("The escalator at the east entrance has been repaired and is now operational.")
                    .severity(MessageSeverity.INFO)
                    .scopeType(MessageScope.STOP)
                    .scopeId(shoppingMall.getId())
                    .startTime(now.minus(10, ChronoUnit.DAYS))
                    .endTime(now.minus(3, ChronoUnit.DAYS))
                    .build());
        }

        // Future STOP message (not yet active)
        Stop northStation = stops.get("M2-North Station");
        if (northStation != null) {
            messageRepository.save(BroadcastMessage.builder()
                    .title("Platform Renovation")
                    .content("North Station Platform 1 will be closed for renovation. All trains will depart from Platform 2.")
                    .severity(MessageSeverity.WARNING)
                    .scopeType(MessageScope.STOP)
                    .scopeId(northStation.getId())
                    .startTime(now.plus(15, ChronoUnit.DAYS))
                    .endTime(now.plus(45, ChronoUnit.DAYS))
                    .build());
        }

        // Critical messages (rare but important)
        messageRepository.save(BroadcastMessage.builder()
                .title("Emergency Contact")
                .content("In case of emergency, press the red button on any platform or call 112. Staff available 24/7.")
                .severity(MessageSeverity.CRITICAL)
                .scopeType(MessageScope.NETWORK)
                .scopeId(null)
                .startTime(now.minus(365, ChronoUnit.DAYS))
                .endTime(now.plus(365, ChronoUnit.DAYS))
                .build());

        // A past message (inactive) for testing
        messageRepository.save(BroadcastMessage.builder()
                .title("Past Event - No Longer Active")
                .content("This message should not be displayed as its end time has passed.")
                .severity(MessageSeverity.INFO)
                .scopeType(MessageScope.NETWORK)
                .scopeId(null)
                .startTime(now.minus(10, ChronoUnit.DAYS))
                .endTime(now.minus(5, ChronoUnit.DAYS))
                .build());

        // A future message (not yet active) for testing
        messageRepository.save(BroadcastMessage.builder()
                .title("Upcoming Maintenance")
                .content("System-wide maintenance scheduled for next month. More details coming soon.")
                .severity(MessageSeverity.INFO)
                .scopeType(MessageScope.NETWORK)
                .scopeId(null)
                .startTime(now.plus(25, ChronoUnit.DAYS))
                .endTime(now.plus(30, ChronoUnit.DAYS))
                .build());

        if (log.isInfoEnabled()) {
            log.info("Created {} messages (network: {}, line: {}, stop: {})",
                    messageRepository.count(),
                    messageRepository.findAll().stream().filter(m -> m.getScopeType() == MessageScope.NETWORK).count(),
                    messageRepository.findAll().stream().filter(m -> m.getScopeType() == MessageScope.LINE).count(),
                    messageRepository.findAll().stream().filter(m -> m.getScopeType() == MessageScope.STOP).count());
        }
    }

    private void logSummary() {
        if (log.isInfoEnabled()) {
            log.info("========================================");
            log.info("         DATA SEEDING SUMMARY          ");
            log.info("========================================");
            log.info("Users:          {}", userRepository.count());
            log.info("Lines:          {}", lineRepository.count());
            log.info("Itineraries:    {}", itineraryRepository.count());
            log.info("Stops:          {}", stopRepository.count());
            log.info("Schedules:      {}", scheduleRepository.count());
            log.info("Devices:        {}", deviceRepository.count());
            log.info("Messages:       {}", messageRepository.count());
            log.info("========================================");
            log.info("Default login: admin / admin123");
            log.info("========================================");
        }
    }
}
