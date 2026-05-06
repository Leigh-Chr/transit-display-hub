-- Hot foreign keys whose seq scans showed up under listing/cascade operations.
--
--   stop_lines.line_id : the M2M PK is (stop_id, line_id), so only the prefix
--                        (stop_id) is indexed. Every "stops on line X" query
--                        currently scans the whole join table.
--
--   devices.stop_id    : no index at all, so deleteByStopId and findByStopId
--                        scan the devices table on every Stop deletion.

CREATE INDEX IF NOT EXISTS idx_stop_lines_line ON stop_lines(line_id);
CREATE INDEX IF NOT EXISTS idx_devices_stop   ON devices(stop_id);
