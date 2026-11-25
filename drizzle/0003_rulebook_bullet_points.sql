INSERT INTO "rulebook_versions" ("version", "content", "note", "published", "created_by")
SELECT v."version" + 1,
  regexp_replace(regexp_replace(v."content", '(^|\n)[0-9]+\.[0-9]+\.[0-9]+ ', '\1  - ', 'g'), '(^|\n)[0-9]+\.[0-9]+ ', '\1- ', 'g'),
  'Clause numbers replaced with bullet points', true, 'system'
FROM (SELECT * FROM "rulebook_versions" ORDER BY "version" DESC LIMIT 1) v
WHERE v."content" ~ '(^|\n)[0-9]+\.[0-9]+ ';--> statement-breakpoint
INSERT INTO "audit_log" ("username", "action", "entity", "entity_id", "reason")
SELECT 'system', 'rulebook.publish', 'rulebook', 'version ' || "version", 'Clause numbers replaced with bullet points at the organisers'' request. Earlier versions are kept'
FROM "rulebook_versions" WHERE "note" = 'Clause numbers replaced with bullet points';
