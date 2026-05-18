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

### Forgot password

Click **Forgot your password?** under the submit button on the login
screen. The dialog explains the recovery flow: this installation does
not send recovery emails — another administrator opens **Users** in
the admin menu and clicks **Edit** next to your account to set a new
password for you. For a single-admin install, see the bootstrap
password reset section in [`docs/deployment.md`](deployment.md).

### Logging Out

Click **Logout** in the upper right corner.

---

## Dashboard

The dashboard displays a summary tailored to your role.

### First-install onboarding

A brand-new install (zero lines, zero stops, zero devices) renders a
**"Welcome to Transit Display Hub"** banner instead of the regular
stat grid. The CTA points to **Operations → Import history**, the
actual first step — once a GTFS feed is imported, lines, stops,
itineraries and schedules all flow from it. The banner disappears as
soon as any data is present.

### Sidebar badges

The **Messages** and **Devices** items in the sidebar render a count
badge when there is something to attend to:

- Blue (info) on **Messages** — number of broadcast messages currently
  active.
- Amber (warning) on **Devices** — number of offline kiosks.

The counts refresh in the background every minute (no need to reload
the page). They are hidden until the first refresh completes so a
zero badge never flashes during boot.

### Administrator View

- **Lines**: Total number of configured lines
- **Stops**: Total number of stops
- **Active Messages**: Currently broadcasting messages
- **Online Devices**: Number of connected screens / total
- **Overview**: Network lines overview and device health
- **Critical messages preview** and **Recent messages**

### Agent View

- **Active Messages**: Currently broadcasting messages
  (the rest of the dashboard is admin-only — navigation
  happens via the sidebar)

### Alerts

Alerts (critical messages and recent messages) are visible
to all roles. Offline device alerts are only visible to
administrators.

---

## Line Management

### View Lines

1. Click **Lines** in the sidebar (under "Network data")
2. The list displays all lines with their code, name,
   type, color, and stop count
3. Use the search bar to filter
4. Each row exposes an **inline action bar**: map icon
   to open the schematic filtered on this line
   (`/map?lines={code}`), pencil to edit, trash to delete

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

### Bulk delete

The lines page supports multi-select for batch deletion:

1. Tick the checkbox in the top-left corner of each line card you
   want to remove (or use **Select all on this page** in the toolbar).
2. A sticky action bar appears at the top with the selection count.
3. Click **Delete selected (N)** and confirm in the dialog.

Selection is in-memory only — changing page, refreshing, or
navigating away clears it so you cannot act on rows you no longer
see.

### Export to CSV

The toolbar exposes an **Export CSV** button that downloads every
line as a CSV file with `code`, `name`, `type`, `color`, `stopCount`
and `itineraryCount` columns. Useful for offline auditing or
hand-off to an external spreadsheet.

---

## Stop Management

### View Stops

1. Click **Stops** in the menu (under "Network data")
2. Use the line filter if needed
3. The schedules-count cell on each row is a **deep link
   to `/admin/schedules`**: it opens the schedule editor
   with both the line and the stop pre-selected and the
   schedule list already loaded
4. The action column carries four icons: map (open the
   stop popup at `/map?stop={id}`), eye (kiosk preview),
   pencil (edit), trash (delete)

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

1. Click **Itineraries** in the menu (under "Network data")
2. Filter by line if needed
3. Each itinerary displays its line, name, and ordered
   list of stops
4. The action column starts with a **"View stops"** icon
   that jumps to `/admin/stops?lineId={id}` filtered on
   the line that owns the itinerary

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

1. Click **Schedules** in the menu (under "Network data")
2. Select a **Line**, then a **Stop**

The stop's schedules are displayed sorted by time.

> **Shortcut**: instead of selecting line + stop by hand,
> jump from `/admin/stops` by clicking the schedules-count
> cell on any row. The Schedules page reads `?lineId=…&stopId=…`
> at boot and pre-fills both selectors for you.

Each row in the schedule table starts with a **"View
itinerary"** icon that jumps to `/admin/itineraries?lineId={id}`
filtered on the line of the schedule.

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

### Bulk delete messages

When an event ends and a batch of ad-hoc messages need to be retired
at once, tick the checkbox on each message card (or **Select all on
this page** in the toolbar), then click **Delete selected (N)** in
the sticky action bar that appears. Same in-memory selection rules
as on the lines page.

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

### Accessibility toolbar

The same `<app-a11y-toolbar>` component sits in the
header of every public passenger surface — opt-in per
surface:

- **Kiosk** (`/display/{stopId}`): the three toggles
  below.
- **Hub** (`/hub?stopIds=…`): high-contrast + large-text
  (speech is omitted — a multi-stop board has no single
  "next departure" to read aloud).
- **Network map** (`/map`, `/map/list`): high-contrast +
  large-text (speech omitted — a static schematic has
  nothing to announce).

Buttons:

- **High-contrast mode** (icon `contrast`) — switches
  to a WCAG-AAA black/yellow palette. Useful in direct
  sunlight or for low-vision passengers.
- **Larger text** (icon `format_size`) — boosts every
  font size by ~1.4×.
- **Read the next departure aloud** (icon `volume_up`,
  kiosk only) — speaks the head of the arrivals list
  through the device's text-to-speech engine.

Each toggle is independent and persisted on the device,
so a passenger's preference survives a restart and
follows them across all three surfaces.

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
- **Popup footer actions**: every stop popup ends with
  a "Full-screen kiosk" link that opens
  `/display/{stopId}` in a new tab. Administrators see
  a second link "Edit stop" that closes the popup and
  routes to `/admin/stops` with the stop name pre-filled
  in the search field

---

## Hub Display

The hub display aggregates departures from multiple stops on a
single screen, ideal for interchange stations or transport hubs.

### Opening the Hub Display

Administrators open the hub display from the **Stops** page —
click the **"New hub display"** button in the toolbar. A hub is by
definition an aggregate of stops, so the entry point lives where
stops are managed; the tooltip on the button reminds you to pick at
least two stops in the dialog that opens.

It opens a configuration dialog where you can:

- **Filter by line**: Show only stops served by a specific line
- **Search**: Find stops by name
- **Select stops**: Check at least 2 stops to include
- **Name the hub**: Auto-generated from selected stop names,
  editable

Click "Open Hub Display" to open the hub view in a new tab.

### Displayed Elements

1. **Header**: Hub name and all served lines
2. **Offline-stops banner** (if any): a coloured strip naming any
   stop that was selected in the URL but did not make it into the
   current rebuild (deleted upstream, disabled, or the backend has
   gone quiet for that stop for more than 30 minutes). Falls back to
   the last known name so the indicator stays readable.
3. **Next departures**: Combined list from all selected stops
   with line, direction, scheduled time, and platform (stop name)
4. **Messages**: Alerts affecting the selected stops
5. **Footer**: Current time and connection status

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

### Global (admin shell)

| Shortcut | Action |
| -------- | ------ |
| `Ctrl + K` / `Cmd + K` | Open the command palette — type the name or path of any admin destination and press Enter to jump straight there. Admin-only routes are filtered out for agents. |
| `Escape` | Close any modal dialog (command palette, confirmations, forms). |
| `Enter` | Submit the focused form or activate the first match in the command palette. |

### Network map

The map exposes the same shortcut surface as a desktop GIS tool. A
keyboard-icon button on the zoom-controls cluster opens an in-app
help dialog listing them, but for reference:

| Shortcut | Action |
| -------- | ------ |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Reset to the full network view |
| `↑` `↓` `←` `→` | Pan the map |
| `Tab` | Step through every stop one by one |
| `Enter` | Open the focused stop's panel |

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

### Where do I find the help / user guide from inside the app?

The admin toolbar carries a `?` (help) icon that opens this guide on
GitHub in a new tab. The icon is hidden on small viewports to keep
the toolbar uncluttered; on phones, navigate to
<https://github.com/Leigh-Chr/transit-display-hub/blob/main/docs/user-guide.md>
directly.

### A kiosk shows "Display Error" with a "Retry" button

The error card now includes a **recovery hint** listing the two
valid URL formats: `/display/<stop-id>` or `/display?token=<device-token>`.
If retrying doesn't help, the kiosk's URL needs to be adjusted on
the device itself — the on-screen message tells the installer what
shape the URL must take.

### My session expired in the middle of editing

You will see a **"Session expired. Please sign in again."** toast
and be sent to the login screen. After re-authenticating you land
back where you were (the URL is preserved). A **"Logged in"** toast
confirms the new session.
