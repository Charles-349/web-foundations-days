# TicketHub Event Ticketing System

## 1. Requirements

### Functional requirements

- Visitors can browse and search events, view event details, and see seat availability and prices.
- Registered users can join the queue for an on-sale event, place a temporary hold on available seats, pay for an order, and view their tickets.
- A user can only hold seats for a limited time. An unpaid hold expires and its seats become available again.
- Users receive a clear result when seats sell out, a hold expires, or payment fails. A confirmed order can be retrieved later.
- Administrators can create events, configure seat maps and prices, and monitor inventory and sales.

### Non-functional requirements

- **Speed:** Event pages and catalog searches should respond within 300 ms at the 95th percentile under normal load. Seat-map availability should respond within 500 ms. During a major sale, users should see queue status promptly, and admitted purchase requests should complete or return a clear status within a few seconds.
- **Correctness:** A seat must never be sold to more than one user. Inventory changes and order status changes must be transactional and durable. Payment retries must not create duplicate charges or tickets.
- **Fairness:** A virtual waiting room admits buyers in a recorded queue order (or a clearly disclosed randomized order if the sale policy requires it). Queue tokens are server-issued, hard to forge, and bound to a user/session. Rate limits and one active hold attempt per account reduce refresh races and automated hoarding.
- **Availability and recovery:** The browsing experience should continue during an application instance failure. A sale may pause new admissions briefly rather than risk inconsistent seat ownership if the authoritative database is unavailable.
- **Security:** Users can access only their own holds and tickets; payment details are handled by a payment provider and are not stored as card data by TicketHub.

## 2. Traffic estimates

These are average request rates; actual traffic is bursty. For comparison, count one page view as one page/API request and ignore static assets, which are served separately by the CDN. A seat map or checkout may make additional API calls, so the estimates are baseline application demand rather than a capacity ceiling.

### Normal day

- Page views: `50,000 visitors × 10 pages = 500,000 page views/day`.
- Average page/API request rate: `500,000 ÷ 86,400 seconds ≈ 5.8 requests/second`.
- Tickets sold: `5,000/day`, or `5,000 ÷ 86,400 ≈ 0.058 tickets/second` on average.
- Registered users: 2 million. This is the account base, not the number simultaneously active.

### Popular concert sale

- Attempt rate in the first ten minutes: `200,000 people ÷ 600 seconds ≈ 333 purchase attempts/second`.
- Inventory: 20,000 seats, so only `20,000 ÷ 200,000 = 10%` of the interested crowd can obtain a seat; 180,000 people will not.
- If all seats are sold across the ten-minute window, the average sale rate is `20,000 ÷ 600 ≈ 33 tickets/second`. The first instant may be considerably busier than this average.
- The purchase-attempt rate is about `333 ÷ 5.8 ≈ 57 times` the normal average page/API request rate, and the completed ticket-sale rate is about `33 ÷ 0.058 ≈ 570 times` the normal average sales rate.

The sale is therefore a short, write-heavy burst, not just a larger version of normal browsing. The waiting room smooths admissions to a rate the order and inventory database can safely process; CDN and cache capacity handle the much larger read demand.

## 3. API

All endpoints require HTTPS. Authenticated endpoints use a user session or access token. Requests that create or pay for an order accept an idempotency key so safe retries do not create duplicate holds or charges.

| Method and endpoint | Purpose |
| --- | --- |
| `GET /api/events?query=&from=&to=&cursor=` | Browse and search published events; returns paginated event summaries. |
| `GET /api/events/{eventId}` | View event details, venue information, and on-sale status. |
| `GET /api/events/{eventId}/seats` | Get a seat map and availability/prices. Availability is advisory; the hold endpoint makes the authoritative check. |
| `POST /api/events/{eventId}/queue` | Join the waiting room and receive queue position/status and, when admitted, a short-lived signed purchase token. |
| `POST /api/events/{eventId}/holds` | Request one or more seats using the admitted queue token. Returns a hold/order ID and expiration time, or a conflict if a seat is no longer available. |
| `POST /api/orders/{orderId}/payment` | Authorize payment for a valid held order. Returns payment status; provider callbacks finalize asynchronous results. |
| `GET /api/me/tickets` | List the authenticated user's confirmed tickets and event details. |
| `DELETE /api/orders/{orderId}/hold` | Release an unpaid hold early; expiration also releases it automatically. |

## 4. Data model

The relational database is authoritative for users, event inventory, holds, and orders. IDs are primary keys; foreign keys enforce valid relationships.

| Table | Important columns and constraints | Relationships |
| --- | --- | --- |
| `Users` | `user_id` PK, `email` UNIQUE, `created_at`, `status` | One user can have many orders. |
| `Events` | `event_id` PK, `name`, `venue`, `starts_at`, `sale_opens_at`, `status` | One event has many seats. |
| `Seats` | `seat_id` PK, `event_id` FK, `section`, `row`, `seat_number`, `price`, `state`, `hold_expires_at`; UNIQUE(`event_id`, `section`, `row`, `seat_number`) | Each seat belongs to one event. `state` is `available`, `held`, or `sold`. |
| `Orders` | `order_id` PK, `user_id` FK, `status`, `total`, `idempotency_key`, `payment_reference`, `created_at`; UNIQUE(`user_id`, `idempotency_key`) | One user can have many orders. |
| `OrderSeats` | `order_id` FK, `seat_id` FK, `hold_expires_at`; composite PK (`order_id`, `seat_id`); UNIQUE(`seat_id`) for active inventory ownership | Join table connects orders and seats; one order can contain multiple seats, but a seat can belong to at most one order. |

Order statuses include `held`, `payment_pending`, `paid`, `expired`, `cancelled`, and `payment_failed`. The uniqueness rule for `OrderSeats` applies while an order is active; expired or cancelled allocations are removed or otherwise excluded from the active-seat uniqueness constraint. Seat state and its active allocation are changed together in a database transaction. Foreign keys, unique constraints, and check constraints reject invalid relationships or state values.

### Preventing two people from buying the same seat

The seat map does not reserve a seat. When a hold is requested, the service starts a database transaction, locks the requested seat rows (or performs a conditional update), and checks that each seat is available or has a genuinely expired hold. It changes the seat state to `held`, records the hold expiry, and creates the order and seat allocations in the same transaction. A concurrent request for the same seat must wait for the lock or lose the conditional update; it receives a conflict instead of a hold.

For payment, the provider first authorizes the amount using an idempotency key. A transaction then verifies that the hold is still valid, records the authorization, and changes the order and seats to a committed-but-not-yet-ticketed state. The provider captures the authorized amount; only after capture is confirmed does the order become `paid` and tickets become visible. If capture definitively fails, the service releases the seats in a transaction. If the capture result is unknown, the order remains pending and reconciliation checks the provider before changing inventory; it must not release the seats based only on a timeout. The unique active allocation constraint is a final guard if application logic races or retries. Expiration workers release only holds whose expiry has passed and which have not entered payment processing, using conditional updates so they cannot release committed seats. If the database cannot confirm a transaction, the service fails closed and does not claim that a seat was sold. If an authorization expires or is voided, the pending order can be safely failed and the seats released.

## 5. Architecture

```text
 Buyers
   |
   v
+--------------------+       +---------------------------+
| CDN / DDoS edge     |------>| Redundant load balancers  |
| cached event pages  |       +-------------+-------------+
| static seat map     |                     |
+--------------------+                     v
                              +---------------------------+
                              | Stateless API instances   |
                              | autoscaled across zones   |
                              +-----+-----------+---------+
                                    |           |
               browse/catalog      |           | queue token / admission
                   +----------------+           v
                   |                    +-----------------------+
                   v                    | Durable waiting-room  |
          +-------------------+          | queue + rate limiter  |
          | Catalog cache     |          +-----------+-----------+
          +---------+---------+                      |
                    |                                | controlled
                    v                                | admission
          +-------------------+                      v
          | Event catalog DB  |<----------+  +---------------------+
          | primary + standby |           +->| Seat/order service  |
          +-------------------+              +----+-----------+----+
                                                   |           |
                                      transaction  |           | payment request
                                                   v           v
                                       +----------------+  +------------------+
                                       | Inventory DB   |  | Payment provider |
                                       | primary,       |  | idempotent calls |
                                       | standby,       |  +--------+---------+
                                       | read replicas  |           |
                                       +--------+-------+           | callback
                                                |                   |
                                                +-------------------+
                                                |
                                      +---------v----------+
                                      | Durable event queue |
                                      | expiry/reconciliation|
                                      +---------+----------+
                                                |
                                                v
                                      +---------------------+
                                      | Redundant workers   |
                                      | expire holds,       |
                                      | reconcile payments  |
                                      +---------------------+
```

### Component responsibilities and resilience

- **CDN and DDoS edge:** Serve cached event content and static assets near buyers, absorb repeated reads, and filter abusive traffic. Multiple edge locations and origin failover reduce dependence on one point of presence. Seat availability shown in cached content is explicitly advisory.
- **Redundant load balancers and stateless API instances:** Health checks route around failed instances. API servers run across availability zones and can scale horizontally; sessions and authoritative order state are not kept only in one server's memory.
- **Catalog cache and event catalog database:** Cache hot event details to protect the catalog database during the sale. The cache is a performance layer, not the seat-ownership authority; cache failure can degrade response speed but cannot permit double booking. Catalog database replicas and backups support recovery.
- **Durable waiting-room queue and rate limiter:** Keep the burst outside the transactional inventory service and admit buyers at a controlled rate. Queue state is replicated/durable, with monitored recovery; if admission state is unavailable, new purchase admissions pause rather than silently bypassing fairness controls.
- **Seat/order service and inventory database:** The service validates queue tokens and applies seat locks, transactions, and constraints. The database uses a primary writer for each seat inventory partition to preserve strong consistency, with a synchronous standby in another availability zone and automated failover. Read replicas can serve non-authoritative seat-map reads, but checkout decisions always use the writer. Backups and point-in-time recovery cover operator error or data loss.
- **Payment provider:** Payment is outside the inventory transaction. Idempotency keys prevent duplicate charges; asynchronous callbacks and a durable reconciliation queue resolve timeouts or missed callbacks. A provider outage leaves orders pending and holds bounded by expiry; the system does not issue tickets until payment is confirmed. Provider failover is only used if an alternate provider is configured and supports safe reconciliation.
- **Durable event queue and redundant workers:** Queue retries and dead-letter monitoring prevent a worker crash from losing expiration or reconciliation work. Multiple workers can process jobs, and operations are idempotent so retries are safe.
- **Observability and operations:** Health checks, queue-depth and database-latency alerts, automated failover, tested backups, and a documented sale-pause procedure help detect and recover from failures. The inventory database is a critical dependency, but its primary is not an unrecoverable single point of failure because it has a tested standby and backups.

## 6. Trade-offs

- **Strong seat consistency versus maximum availability:** A single authoritative writer and transactional locks prevent overselling, but may limit checkout throughput and can briefly pause sales during database failover. Partitioning inventory by event can increase write capacity while preserving one writer per event, but adds operational complexity. For correctness, TicketHub prefers pausing admissions over accepting conflicting seat claims.
- **Fair waiting room versus instant access:** Admission control smooths load and gives buyers a defensible queue position, but adds waiting time and another critical service. Persisting queue entries and tokens enables recovery and auditing, at the cost of queue infrastructure and operational overhead.
- **Temporary holds versus inventory utilization:** Holds give buyers time to pay and reduce checkout races, but seats remain unavailable while payment is pending. Short hold durations improve utilization but may penalize slow legitimate buyers; longer durations make hoarding and abandoned checkouts more costly.
- **Caching versus freshness:** CDN and cache layers keep event browsing responsive and protect databases during a burst, but cached seat maps may be stale. The UI must label availability as provisional, and the hold transaction must always recheck authoritative inventory.
- **Payment decoupling versus immediate confirmation:** Keeping payment outside the inventory transaction avoids holding database locks during a slow provider call, but creates a pending state and requires idempotent callbacks and reconciliation. This is safer and more scalable than treating a network timeout as either a definite payment success or failure.
