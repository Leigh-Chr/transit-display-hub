package com.transit.hub.infrastructure;

import com.transit.hub.domain.model.*;
import com.transit.hub.domain.model.enums.*;
import com.transit.hub.infrastructure.persistence.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataLoader implements CommandLineRunner {

    private final UserRepository userRepository;
    private final LineRepository lineRepository;
    private final StopRepository stopRepository;
    private final TimedEntryRepository timedEntryRepository;
    private final DeviceRepository deviceRepository;
    private final BroadcastMessageRepository messageRepository;
    private final PasswordEncoder passwordEncoder;

    private final Random random = new Random(42); // Fixed seed for reproducibility

    @Override
    @Transactional
    public void run(String... args) {
        if (userRepository.count() == 0) {
            log.info("=== Starting Transit Display Hub Data Seeding ===");

            createUsers();
            Map<String, Line> lines = createLines();
            Map<String, Stop> stops = createStops(lines);
            createSchedules(stops);
            createDevices(stops);
            createMessages(lines, stops);

            log.info("=== Data Seeding Complete ===");
            logSummary();
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

        // Disabled user for testing
        userRepository.save(User.builder()
                .username("inactive")
                .password(passwordEncoder.encode("inactive123"))
                .role(UserRole.AGENT)
                .enabled(false)
                .build());

        log.info("Created {} users (2 admins, 3 agents, 1 disabled)", userRepository.count());
    }

    private Map<String, Line> createLines() {
        log.info("Creating transit lines...");

        Map<String, Line> lines = new LinkedHashMap<>();

        // Metro Lines
        lines.put("M1", lineRepository.save(Line.builder()
                .code("M1")
                .name("Red Line - East-West Express")
                .color("#E53935")
                .build()));

        lines.put("M2", lineRepository.save(Line.builder()
                .code("M2")
                .name("Blue Line - North-South")
                .color("#1E88E5")
                .build()));

        lines.put("M3", lineRepository.save(Line.builder()
                .code("M3")
                .name("Green Line - Ring")
                .color("#43A047")
                .build()));

        lines.put("M4", lineRepository.save(Line.builder()
                .code("M4")
                .name("Orange Line - Downtown Express")
                .color("#FB8C00")
                .build()));

        // Airport Express
        lines.put("A1", lineRepository.save(Line.builder()
                .code("A1")
                .name("Airport Express")
                .color("#8E24AA")
                .build()));

        // Tram Lines
        lines.put("T1", lineRepository.save(Line.builder()
                .code("T1")
                .name("Tram - Riverside")
                .color("#00ACC1")
                .build()));

        lines.put("T2", lineRepository.save(Line.builder()
                .code("T2")
                .name("Tram - University District")
                .color("#7CB342")
                .build()));

        log.info("Created {} lines", lines.size());
        return lines;
    }

    private Map<String, Stop> createStops(Map<String, Line> lines) {
        log.info("Creating stops...");

        Map<String, Stop> stops = new LinkedHashMap<>();

        // M1 - Red Line (East to West) - 10 stops
        String[] m1Stops = {
            "Eastern Terminal", "Industrial Park", "Convention Center",
            "Central Station", "City Hall", "Museum District",
            "University", "Medical Center", "Technology Park", "Western Terminal"
        };
        createStopsForLine(lines.get("M1"), m1Stops, stops);

        // M2 - Blue Line (North to South) - 9 stops
        String[] m2Stops = {
            "North Station", "Sports Complex", "Shopping Mall",
            "Central Station", "Financial District", "Opera House",
            "South Park", "Residential Area", "South Terminal"
        };
        createStopsForLine(lines.get("M2"), m2Stops, stops);

        // M3 - Green Line (Ring) - 12 stops
        String[] m3Stops = {
            "Central Station", "Old Town", "Market Square", "Harbor",
            "Beach", "Marina", "Lighthouse Point", "Aquarium",
            "Botanical Garden", "Zoo", "Stadium", "Convention Center"
        };
        createStopsForLine(lines.get("M3"), m3Stops, stops);

        // M4 - Orange Line (Downtown Express) - 6 stops
        String[] m4Stops = {
            "Business Park", "Tech Hub", "Central Station",
            "Government Center", "Embassy Row", "International District"
        };
        createStopsForLine(lines.get("M4"), m4Stops, stops);

        // A1 - Airport Express - 5 stops
        String[] a1Stops = {
            "Airport Terminal 1", "Airport Terminal 2", "Airport City",
            "Central Station", "Downtown Express"
        };
        createStopsForLine(lines.get("A1"), a1Stops, stops);

        // T1 - Riverside Tram - 8 stops
        String[] t1Stops = {
            "Riverside Station", "Waterfront", "Ferry Terminal", "Fish Market",
            "Promenade", "Concert Hall", "Art Gallery", "Central Station"
        };
        createStopsForLine(lines.get("T1"), t1Stops, stops);

        // T2 - University Tram - 7 stops
        String[] t2Stops = {
            "University Main", "Science Campus", "Library", "Student Center",
            "Research Park", "Hospital", "Central Station"
        };
        createStopsForLine(lines.get("T2"), t2Stops, stops);

        log.info("Created {} stops across {} lines", stops.size(), lines.size());
        return stops;
    }

    private void createStopsForLine(Line line, String[] stopNames, Map<String, Stop> stops) {
        for (String name : stopNames) {
            String key = line.getCode() + "-" + name;
            Stop stop = Stop.builder()
                    .name(name)
                    .line(line)
                    .build();
            stops.put(key, stopRepository.save(stop));
        }
    }

    private void createSchedules(Map<String, Stop> stops) {
        log.info("Creating schedules...");

        int totalEntries = 0;

        for (Map.Entry<String, Stop> entry : stops.entrySet()) {
            Stop stop = entry.getValue();
            String lineCode = stop.getLine().getCode();

            List<LocalTime> times = generateScheduleTimes(lineCode);

            for (LocalTime time : times) {
                timedEntryRepository.save(TimedEntry.builder()
                        .time(time)
                        .stop(stop)
                        .build());
                totalEntries++;
            }
        }

        log.info("Created {} timed entries", totalEntries);
    }

    private List<LocalTime> generateScheduleTimes(String lineCode) {
        List<LocalTime> times = new ArrayList<>();

        // Different frequencies based on line type
        int peakInterval, offPeakInterval;

        if (lineCode.startsWith("M")) {
            // Metro: high frequency
            peakInterval = 8;
            offPeakInterval = 15;
        } else if (lineCode.equals("A1")) {
            // Airport Express: moderate frequency
            peakInterval = 15;
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
        List<Stop> stopList = new ArrayList<>(stops.values());

        // Create devices for major stops (Central Station gets multiple devices)
        for (Stop stop : stopList) {
            int numDevices = 1;

            // Major stops get more devices
            if (stop.getName().contains("Central") ||
                stop.getName().contains("Terminal") ||
                stop.getName().contains("Airport")) {
                numDevices = 2;
            }

            for (int i = 0; i < numDevices; i++) {
                // Generate a token (in production this would be secure random)
                String token = generateDeviceToken();
                String tokenHash = passwordEncoder.encode(token);

                DeviceStatus status = random.nextDouble() < 0.85 ? DeviceStatus.ONLINE : DeviceStatus.OFFLINE;
                Instant lastHeartbeat = status == DeviceStatus.ONLINE
                    ? Instant.now().minus(random.nextInt(60), ChronoUnit.SECONDS)
                    : Instant.now().minus(random.nextInt(24 * 60) + 5, ChronoUnit.MINUTES);

                deviceRepository.save(Device.builder()
                        .tokenHash(tokenHash)
                        .stop(stop)
                        .status(status)
                        .lastHeartbeat(lastHeartbeat)
                        .build());

                deviceCount++;

                // Log a few sample tokens for testing
                if (deviceCount <= 3) {
                    log.info("Sample device token for {} ({}): {}",
                            stop.getName(), stop.getLine().getCode(), token);
                }
            }
        }

        log.info("Created {} devices ({} online, {} offline)",
                deviceCount,
                deviceRepository.findByStatus(DeviceStatus.ONLINE).size(),
                deviceRepository.findByStatus(DeviceStatus.OFFLINE).size());
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

        // STOP-specific messages
        Stop centralM1 = stops.get("M1-Central Station");
        if (centralM1 != null) {
            messageRepository.save(BroadcastMessage.builder()
                    .title("Elevator Out of Service")
                    .content("The elevator at Platform 2 is temporarily out of service. Please use Platform 1 elevator or escalators.")
                    .severity(MessageSeverity.WARNING)
                    .scopeType(MessageScope.STOP)
                    .scopeId(centralM1.getId())
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

        Stop university = stops.get("M1-University");
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

        log.info("Created {} messages (network: {}, line: {}, stop: {})",
                messageRepository.count(),
                messageRepository.findAll().stream().filter(m -> m.getScopeType() == MessageScope.NETWORK).count(),
                messageRepository.findAll().stream().filter(m -> m.getScopeType() == MessageScope.LINE).count(),
                messageRepository.findAll().stream().filter(m -> m.getScopeType() == MessageScope.STOP).count());
    }

    private void logSummary() {
        log.info("========================================");
        log.info("         DATA SEEDING SUMMARY          ");
        log.info("========================================");
        log.info("Users:          {}", userRepository.count());
        log.info("Lines:          {}", lineRepository.count());
        log.info("Stops:          {}", stopRepository.count());
        log.info("Timed Entries:  {}", timedEntryRepository.count());
        log.info("Devices:        {}", deviceRepository.count());
        log.info("Messages:       {}", messageRepository.count());
        log.info("========================================");
        log.info("Default login: admin / admin123");
        log.info("========================================");
    }
}
