# User Guide

This guide explains how to use the Transit Display Hub
administration interface.

---

## Login

### Logging In

1. Open the application in your browser
2. Enter your **username** and **password**
3. Click **Log in**

### Default Accounts

| Username | Password | Role                    | Available in     |
| -------- | -------- | ----------------------- | ---------------- |
| admin    | admin123 | Full Administrator      | Dev + Production |
| agent    | agent123 | Agent (messages only)   | Dev only         |

> **Forced rotation on first sign-in** — Flyway V52 ships the admin row
> with `password_must_change = TRUE`. The very first login redirects you
> to `/auth/change-password` and refuses any new password shorter than
> 12 characters. The flag is cleared on success. The `agent` account is
> only seeded in the dev profile; in production, create additional users
> via `/admin/users`.

### Roles

- **Administrator**: Full access (lines, stops,
  itineraries, schedules, messages, devices, users)
- **Agent**: Broadcast message management, dashboard
  viewing (messages and alerts), network map access.
  The sidebar only shows Dashboard, Messages, and
  Network Map. Line and stop lists are accessible in
  read-only mode for message targeting (Line/Stop scope).

### Logging Out

Click **Logout** in the upper right corner.

---

## Dashboard

The dashboard displays a summary tailored to your role.

### Administrator View

- **Lines**: Total number of configured lines
- **Stops**: Total number of stops
- **Active Messages**: Currently broadcasting messages
- **Online Devices**: Number of connected screens / total
- **Overview**: Network lines overview and device health
- **Quick Actions**: Direct access to line, stop, schedule,
  device, user management, and hub display

### Agent View

- **Active Messages**: Currently broadcasting messages
- **Quick Actions**: Create a message, access network map

### Alerts

Alerts (critical messages and recent messages) are visible
to all roles. Offline device alerts are only visible to
administrators.

---

## Line Management

### View Lines

1. Click **Lines** in the sidebar
2. The list displays all lines with their code, name,
   type, color, and stop count
3. Use the search bar to filter

### Create a Line

1. Click **+ New Line**
2. Fill in the fields:
   - **Code**: Short identifier (e.g., M1, B2, T3)
   - **Name**: Full name (e.g., Metro Line 1 - Center)
   - **Type**: Metro, Bus, Tram, or Train
   - **Color**: Choose an identification color
3. Click **Create**

### Edit a Line

1. Click **Edit** next to the line
2. Modify the information
3. Click **Save**

### Delete a Line

1. Click **Delete**
2. Confirm the deletion

> **Warning**: Deleting a line also deletes its associated
> itineraries and schedules.

---

## Stop Management

### View Stops

1. Click **Stops** in the menu
2. Use the line filter if needed

### Create a Stop

1. Click **+ New Stop**
2. Enter the stop **Name**
3. Select one or more **Lines** (a stop can serve
   multiple lines)
4. Optionally, enter the GPS coordinates
   (**Latitude** and **Longitude**)
5. Click **Create**

### Edit a Stop

1. Click **Edit**
2. Modify the name, lines, or coordinates
3. Click **Save**

### Delete a Stop

1. Click **Delete**
2. Confirm

> Deleting a stop also deletes all its schedules and
> removes associated devices.

---

## Itinerary Management

An itinerary represents an ordered route of stops on a
line, corresponding to a direction
(e.g., "To Airport", "To City Center").

### View Itineraries

1. Click **Itineraries** in the menu
2. Filter by line if needed
3. Each itinerary displays its line, name, and ordered
   list of stops

### Create an Itinerary

1. Click **+ New Itinerary**
2. Select the **Line**
3. Enter the **Name** (e.g., To Airport)
4. Add **Stops** in route order
5. Click **Create**

### Edit an Itinerary

1. Click **Edit**
2. Modify the name or reorder stops
3. Click **Save**

### Manage Itinerary Stops

- **Add a stop**: Select a stop and its position in
  the sequence
- **Reorder**: Change the stop order by drag-and-drop
  or by modifying positions
- **Remove a stop**: Remove a stop from the itinerary
  without deleting the stop itself

### Delete an Itinerary

1. Click **Delete**
2. Confirm

> **Warning**: Deleting an itinerary also deletes all
> schedules that reference it.

---

## Schedule Management

### Access Schedules

1. Click **Schedules** in the menu
2. Select a **Stop**

The stop's schedules are displayed sorted by time.

### Create a Schedule

1. Click **+ New Schedule**
2. Fill in:
   - **Departure time**: HH:MM format
   - **Itinerary**: Select the itinerary
     (determines line and direction)
3. Click **Create**

> The selected itinerary automatically determines the
> line and terminus displayed to passengers.

### Edit a Schedule

1. Click **Edit**
2. Modify the time or itinerary
3. Click **Save**

### Delete a Schedule

1. Click **Delete**
2. Confirm

---

## Broadcast Messages

Broadcast messages allow you to communicate with
passengers.

### Message Types

| Severity     | Usage                | Display                      |
| ------------ | -------------------- | ---------------------------- |
| **Info**     | General information  | Side panel                   |
| **Warning**  | Moderate disruption  | Side panel, highlighted      |
| **Critical** | Emergency, shutdown  | Flashing red banner          |

### Message Scope

- **Network**: Displayed on all screens
- **Line**: Displayed at stops on this line
- **Stop**: Displayed only at this stop

### Create a Message

1. Click **Messages** in the menu
2. Click **+ New Message**
3. Fill in:
   - **Title**: Short summary
   - **Content**: Message details
   - **Severity**: Info, Warning, or Critical
   - **Scope**: Network, Line, or Stop
   - **Start date**: When the message appears
   - **End date**: When the message disappears
4. Click **Create**

### Message Examples

#### Info

- Title: "Remember to validate"
- Content: "Don't forget to validate your travel pass."

#### Warning

- Title: "Ongoing works"
- Content: "Travel time extended by 5 minutes on the
  Center-Station section."

#### Critical

- Title: "Service interrupted"
- Content: "Due to an incident, no trains are running
  between Station and Airport. Replacement buses are
  in service."

### Filter Messages

- Filter by **Active only** status to see current messages
- Filter by **Severity** to target a specific type

### Edit a Message

1. Click **Edit**
2. Modify the information
3. Click **Save**

### Delete a Message

1. Click **Delete**
2. Confirm

---

## Device Management

Devices are display screens installed at stops.

### View Devices

1. Click **Devices** in the menu
2. Each card displays:
   - Stop name
   - Served lines
   - Status (Online / Offline)
   - Last connection

### Filter by Status

Use the dropdown menu to filter:

- **All**: All devices
- **Online**: Connected devices
- **Offline**: Disconnected devices

### Register a Device

1. Click **+ Register a device**
2. Select the **Stop**
3. Click **Register**
4. **Copy the token** displayed

> **Important**: The token is only displayed once.
> Keep it safe.

### Configure the Screen

On the display device, configure the URL:

```text
https://transit.example.com/display?token=YOUR_TOKEN
```

Or for direct access by stop (testing):

```text
https://transit.example.com/display/STOP_ID
```

### Kiosk accessibility toolbar

Three buttons in the kiosk header let any passenger
adapt the screen on the fly:

- **High-contrast mode** (icon `contrast`) — switches
  to a WCAG-AAA black/yellow palette. Useful in direct
  sunlight or for low-vision passengers.
- **Larger text** (icon `format_size`) — boosts every
  font size by ~1.4×.
- **Read the next departure aloud** (icon `volume_up`)
  — speaks the head of the arrivals list through the
  device's text-to-speech engine.

Each toggle is independent and persisted on the device,
so a passenger's preference survives a kiosk restart.

### Language switch

The network map and admin app expose an `EN`/`FR`
toggle in their headers. The kiosk reads its language
from the device-wide setting (resolved at boot from
`localStorage` → `navigator.language` → French as
default), so there is no on-screen toggle on the kiosk
itself — language follows the operator's configuration.

### Delete a Device

1. Click **Delete**
2. Confirm

> The screen will display an error until it is
> re-registered.

---

## User Management

### View Users

1. Click **Users** in the menu
2. The list displays all accounts with their name,
   role, and status

### Create a User

1. Click **+ New User**
2. Fill in:
   - **Username**: 3 to 50 characters
   - **Password**: 6 characters minimum
   - **Role**: Administrator or Agent
3. Click **Create**

### Edit a User

1. Click **Edit**
2. Modify the role, password, or
   enable/disable the account
3. Click **Save**

### Disable an Account

To prevent a user from logging in without deleting
their account:

1. Click **Edit**
2. Uncheck **Active**
3. Click **Save**

### Delete a User

1. Click **Delete**
2. Confirm

---

## Network Map

The network map offers an interactive visualization of
the entire transport network.

### Access the Map

The map is publicly accessible at `/map`
(no authentication required).

### Features

- **Schematic view**: clear network visualization with
  lines and stops; stroke width scales with each line's
  schedule volume so the busy backbone reads at a glance
- **Parent-station collapse**: a station with several
  platforms appears as one node; the popup shows the
  union of lines, accessibility info and TAD status
- **Stop popup**: click a stop for departures and served
  lines, with pictogram pills for accessibility
  (`ACCESSIBLE` / `NOT_ACCESSIBLE`), TAD ("Réservation
  requise") and Fares v2 zones the stop belongs to.
  When the stop is on-demand and a `locations.geojson`
  polygon is attached to it, the popup inlines a small
  SVG preview of the pickup zone.
- **Filters**: line chips per category, "Accessible PMR"
  toggle that dims non-accessible stops, single-select
  fare-zone chip row that dims stops outside the chosen
  zone (only visible when the feed ships `areas.txt`)
- **Fare-zone overlay**: "Zones" toggle next to the PMR
  filter paints a translucent halo behind every stop
  coloured by its primary fare zone. Orthogonal to the
  chip filter — the chip dims, the overlay paints. Off
  by default to avoid visual noise on dense feeds.
- **TAD ring**: dashed blue circle around stops with at
  least one on-request schedule
- **Route search**: dual stop search to plan a journey
  with transfer-cost weighting from `transfers.txt`
- **Active alerts**: broadcast messages and GTFS-RT
  ServiceAlerts overlay both lines and stops

---

## Hub Display

The hub display aggregates departures from multiple stops on a
single screen, ideal for interchange stations or transport hubs.

### Opening the Hub Display

The hub display can be opened from three places in the admin
interface (administrator only):

1. **Sidebar**: Click "Hub Display" in the navigation
2. **Dashboard**: Use the "Hub Display" quick action button
3. **Stops page**: Click the "Hub Display" button in the toolbar

Each opens a configuration dialog where you can:

- **Filter by line**: Show only stops served by a specific line
- **Search**: Find stops by name
- **Select stops**: Check at least 2 stops to include
- **Name the hub**: Auto-generated from selected stop names,
  editable

Click "Open Hub Display" to open the hub view in a new tab.

### Displayed Elements

1. **Header**: Hub name and all served lines
2. **Next departures**: Combined list from all selected stops
   with line, direction, scheduled time, and platform (stop name)
3. **Messages**: Alerts affecting the selected stops
4. **Footer**: Current time and connection status

---

## Kiosk Display

The kiosk screen displays passenger information for a single stop.

### Displayed Elements

1. **Header**: Stop name, GTFS `stop_code` (the small id
   printed on the physical signpost), and served lines
2. **Next departures**: List of upcoming services with:
   - Line code, destination (`stop_headsign` when the
     feed publishes a per-stop one)
   - Scheduled time, projected time when GTFS-RT delays
     apply
   - **Live badge** (green / amber / red) when GTFS-RT
     covers the trip — shows "+3 min", "−1 min" or
     "à l'heure" — pulses to signal real-time data
   - **TAD CTA** with phone number and minimum prior
     notice on on-request arrivals (`pickup_type` 2 / 3)
   - Wheelchair / bicycle pictograms reflecting the
     itinerary defaults plus per-schedule overrides
   - **Per-arrival platform badge** when the kiosk is
     bound to a parent station that aggregates several
     platforms — indicates which quay each arrival
     departs from
   - Frequency badge ("toutes les 6 min") when the trip
     comes from `frequencies.txt`
3. **Messages**: Broadcast alerts plus GTFS-RT
   ServiceAlerts overlaid in the same ticker
4. **Footer**: Current time and connection status

### Connection Status

- **Connected** (green): Real-time updates via WebSocket
- **Disconnected** (red): Automatic reconnection attempt

---

## Best Practices

### Messages (best practices)

1. **Be concise**: Passengers read quickly
2. **Use the right level**: Reserve CRITICAL for real
   emergencies
3. **Set an end time**: Avoid messages that stay
   indefinitely

### Schedules (best practices)

1. **Create itineraries first**: Schedules reference an
   existing itinerary
2. **One itinerary per direction**: Create a
   "To A" and a "To B" itinerary for each line

### Devices (best practices)

1. **Monitor disconnections**: An offline device does
   not display updates
2. **Secure tokens**: Do not share tokens publicly

---

## Keyboard Shortcuts

| Shortcut | Action              |
| -------- | ------------------- |
| `Escape` | Close modal window  |
| `Enter`  | Submit a form       |

---

## FAQ

### The screen displays "Loading..."

1. Check the device's internet connection
2. Check that the token is correct
3. Check that the backend server is running

### A message does not appear on the screen

1. Check the message scope (Network/Line/Stop)
2. Check the start and end dates
3. The message must be active (between start and end)

### Schedules are not displayed

1. Check that schedules are created for this stop
2. Check that the departure time has not already passed
3. Check that the associated itinerary is properly
   configured

### How to change a password?

1. Log in as an administrator
2. Go to **Users**
3. Click **Edit** next to the user
4. Enter the new password
5. Click **Save**

### How to assign a stop to multiple lines?

When creating or editing a stop, select multiple lines.
A stop can serve as many lines as needed (interchange).
