# SnapShare Scaling Plan

## Assumptions and estimates

- There are 10 million registered users, and 10% are active each day.
- Each daily active user uploads one photo and views 50 feed pages per day.
- An average original photo is 2 MB and its thumbnail is 50 KB. For storage arithmetic, MB and KB are decimal units.
- A day has 86,400 seconds and a year has 365 days. Estimates are averages unless marked as peak; peak feed traffic is five times the average.
- Storage estimates include originals and thumbnails, with no deletions, compression, replication, or extra metadata.

Daily active users (DAU) are `10,000,000 × 10% = 1,000,000`.

| Measure | Calculation | Estimate |
| --- | --- | ---: |
| Uploads per day | `1,000,000 × 1` | 1,000,000 |
| Uploads per second (average) | `1,000,000 ÷ 86,400` | 11.6 (about 12) |
| Feed views per day | `1,000,000 × 50` | 50,000,000 |
| Feed views per second (average) | `50,000,000 ÷ 86,400` | 579 |
| Feed views per second (peak) | `579 × 5` | about 2,900 |
| Original photo storage per year | `1,000,000 × 365 × 2 MB` | 730 TB |
| Thumbnail storage per year | `1,000,000 × 365 × 50 KB` | 18.25 TB |
| Total photo storage per year | `730 TB + 18.25 TB` | 748.25 TB (about 0.75 PB) |

## Workload and storage choice

SnapShare is **read-heavy**: users request about 50 feed pages for every photo they upload, and each feed page can also trigger multiple image requests. The design should therefore cache feed data and serve image files close to users through a CDN, while scaling application reads separately from writes.

Photo files should not be stored as blobs inside the database: large files make database storage, backups, replication, and queries more expensive. Store originals and thumbnails in object storage, and keep only photo metadata and object keys in the database; the CDN can deliver the files from object storage.

## Architecture

```text
                         +----------------------+
                         |         CDN          |
                         | cached images/feed   |
                         +----------+-----------+
                                    | cache miss / API request
                                    v
+--------+   API   +----------------------+   +------------------+
| Client | ------> |    Load balancer     |-->|   App servers    |
+---+----+         +----------------------+   +---+----------+---+
    |                                            |          |
    | upload photo                               |          +------> +-----------+
    v                                            |                  |   Cache   |
+------------------+                             |                  +-----------+
|  Object storage  |<----------------------------+                       ^
| originals +      |                                                     |
| thumbnails       |                               +---------------------+
+--------+---------+                               |
         ^                                         v
         |                                +-------------------+
         |                                | Database primary  |
         |                                +---------+---------+
         |                                          |
         |                                   replication
         |                                          v
         |                                +-------------------+
         |                                |   Read replica    |
         |                                +-------------------+
         |
         |                         +----------------+
         +-------------------------| Queue + worker |
                thumbnail output  | create thumbnail|
                                   +-------^--------+
                                           |
                                   thumbnail job
                                           |
                                  +--------+---------+
                                  |   App servers    |
                                  +------------------+
```

## Component responsibilities

- **CDN:** Caches and serves photo files near users, reducing image-delivery latency and origin traffic.
- **Load balancer:** Spreads incoming API traffic across healthy app servers so one server does not become a bottleneck.
- **App servers:** Authenticate requests, implement upload and feed APIs, and coordinate database, cache, object-storage, and queue operations.
- **Cache:** Holds frequently requested feed data and metadata to reduce repeated database reads and improve response time.
- **Database primary:** Stores authoritative photo metadata and upload status, and accepts metadata writes.
- **Database read replica:** Serves feed and other read queries separately from primary writes, increasing read capacity.
- **Object storage:** Stores original photo files and generated thumbnails durably and independently of the database.
- **Queue:** Buffers thumbnail jobs so image processing can happen asynchronously and absorb bursts in uploads.
- **Thumbnail worker:** Consumes queued jobs, creates a smaller thumbnail from each original, and saves it to object storage.

## Photo upload flow

1. The client sends an authenticated upload request to an app server with the photo's basic metadata.
2. The app server validates the request, creates a pending photo record in the primary database, and returns an authorized object-storage upload destination and photo ID.
3. The client uploads the original photo directly to object storage, avoiding the app server becoming a large-file bandwidth bottleneck.
4. After the upload succeeds, the client notifies the app server; the server marks the original as uploaded and publishes a thumbnail job containing the photo ID and object key to the queue.
5. A thumbnail worker consumes the job, reads the original from object storage, creates the 50 KB thumbnail, and writes it back to object storage.
6. The worker updates the photo metadata to indicate that the thumbnail is ready; the feed can now return the photo and its thumbnail URL, which the CDN can cache and serve.

## Trade-offs

- **Read replicas improve feed capacity but can lag behind the primary.** A newly uploaded photo or updated metadata may not appear immediately in feed reads; the app can use the primary for read-after-write requests or tolerate brief delay.
- **Asynchronous thumbnail generation keeps uploads fast but makes thumbnails temporarily unavailable.** The feed should represent pending thumbnail work and retry failed jobs rather than assuming the thumbnail is ready immediately.
- **Caching and CDN delivery reduce database and origin load but can serve stale content.** Cache expiration and invalidation improve freshness but add operational complexity and may reduce cache-hit rates.
- **Direct client uploads reduce app-server bandwidth but add a separate storage step.** The upload must be authorized and the server should only enqueue thumbnail work after confirming the original exists, so incomplete uploads do not create broken feed items.
