-- Track inbound webhook events so we can drop replays. The (source, event_id)
-- pair is the dedupe key — Keygen sends the event id in `data.id`, other
-- providers can reuse the same table with a different `source`.
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_webhook_events_source_event_id" ON "webhook_events"("source", "event_id");
CREATE INDEX "idx_webhook_events_received_at" ON "webhook_events"("received_at");
