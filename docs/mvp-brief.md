# MVP Brief -- Real-Time Passenger Information Platform

## 1. Executive Summary

This project is a **centralized real-time passenger
information platform** designed for public transport stops
within a local transit network.

It allows internal staff to:

- manage simplified schedules
- publish service information and disruption messages
- instantly synchronize all connected displays

The system relies on a **single source of truth** and
**precomputed display states**, ensuring consistency,
performance, and reliability.

---

## 2. MVP Objectives

- demonstrate a **modern Angular + Java architecture**
- implement **controlled real-time data propagation**
- model a **real-world business domain**
- deliver a **clear, convincing demo**

This MVP does **not** aim to fully model public transport
systems. Its purpose is to showcase the design of a
**robust, extensible information distribution core**.

---

## 3. Scope & Assumptions

- single transport network
- single operating authority
- public displays limited to **stops**
- simplified schedule data
- no vehicle tracking

---

## 4. User Roles

### Administrator

- manages network structure (lines, stops)
- manages schedules
- publishes and removes broadcast messages
- monitors connected displays

### Agent

- publishes broadcast messages
- has no access to network structure

### Device (Display)

- read-only access
- authenticated via secure token
- receives real-time updates

---

## 5. Core Domain Concepts

### Network

- **Line**
  - identifier
  - code
  - name
  - color

- **Stop**
  - identifier
  - name
  - associated line

- **TimedEntry**
  - scheduled arrival time (HH:mm)

---

### Broadcast Message

- **BroadcastMessage**
  - title
  - content
  - severity (INFO / WARNING / CRITICAL)
  - active time window (start / end)
  - scope (network, line, or stop)

---

## 6. Core Concept: Display State

The backend computes a **ready-to-render view** called
**DisplayState**.

It contains:

- stop identifier
- upcoming scheduled arrivals
- active broadcast messages
- version number
- generation timestamp

Public displays:

- perform **no business logic**
- only render the received state

This approach guarantees:

- global consistency
- backend-driven business rules
- minimal client complexity
- easier testing and debugging

---

## 7. Display Rules

- maximum of 3 messages displayed simultaneously
- severity priority: CRITICAL > WARNING > INFO
- messages displayed only when active at the current time
- fallback message shown if no data is available

---

## 8. Real-Time Communication

### Principle

- each stop has a dedicated real-time channel
- any relevant change triggers a display state
  recalculation
- updated states are pushed instantly to subscribed
  displays

### Transport

- WebSocket (STOMP)
- automatic reconnection
- REST fallback if WebSocket is unavailable

---

## 9. Device Management

- each device is linked to a stop
- secure token-based authentication
- periodic heartbeat
- status tracking (ONLINE / OFFLINE)

---

## 10. Technical Architecture

### Frontend (Angular)

- Angular (single application)
  - admin interface
  - public stop display (kiosk mode)
- secured routing
- REST + WebSocket services
- fullscreen, read-only public UI

---

### Backend (Spring Boot)

- Java using **Spring Boot**
- REST API
- WebSocket messaging
- JWT authentication (users)
- token-based authentication (devices)
- validation and structured error handling

---

## 11. Business Triggers

Display state recalculation is triggered by:

- creation, update, or expiration of a broadcast message
- schedule modification
- stop-line association changes

Each trigger produces an **internal domain event** handled
by the display state service.

---

## 12. Demonstration Scenario

1. open a live stop display
2. publish a CRITICAL broadcast message from the admin
   console
3. observe instant update on the public display
4. modify a scheduled arrival time
5. observe automatic state recalculation and update
6. view device status in the admin panel

---

## 13. Success Criteria

- visible real-time synchronization
- consistent data across all displays
- clear separation of concerns
- readable, well-structured code
- demo understandable without lengthy explanation

---

## 14. Explicitly Out of Scope

- real-time vehicle tracking
- multi-authority / multi-tenant support
- GTFS / SIRI standards
- route planning
- traffic optimization

These features are **compatible with the architecture**
but intentionally deferred.

---

## Conclusion

This MVP represents a **credible, production-inspired
foundation** for a real-time passenger information system,
while remaining **realistic for a solo developer project**.

It emphasizes:

- sound architectural decisions
- controlled real-time complexity
- clear business modeling
- professional engineering trade-offs
