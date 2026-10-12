"""Generate prisma/migrations/<timestamp>_zambia_literacy_seed.sql from
zambia-modules.clean.json.

Output is a single idempotent migration wrapped in one plpgsql DO block:
  - upserts each LearningModule by slug (ON CONFLICT)
  - deletes stale LearningLesson rows for that module, re-inserts from seed
  - deletes the existing Quiz (cascade handles Questions/Options), re-inserts
  - inserts each QuizQuestion and its QuizOption rows
"""

from __future__ import annotations

import json
from pathlib import Path

JSON_PATH = Path(r"C:\Users\RICHARD_TEMBO\Desktop\Projects\biswic\prisma\zambia-modules.clean.json")
MIGRATIONS_DIR = Path(r"C:\Users\RICHARD_TEMBO\Desktop\Projects\biswic\prisma\migrations")

TIMESTAMP = "20261012140000"
MIGRATION_NAME = f"{TIMESTAMP}_zambia_literacy_seed"
OUT_PATH = MIGRATIONS_DIR / MIGRATION_NAME / "migration.sql"


def sql_str(s: str) -> str:
    return s.replace("'", "''")


def sql_escape(s: str) -> str:
    return sql_str(s)


def sql_array_literal(values: list[str], cast: str | None = None) -> str:
    inner = ", ".join(f"'{sql_escape(v)}'" for v in values)
    s = f"ARRAY[{inner}]"
    if cast:
        s += f"::{cast}"
    return s


def render_module(mod: dict, is_first: bool) -> str:
    slug = mod["slug"]
    title = mod["title"]
    summary = mod["summary"]
    content = summary
    audience = mod["audience"]
    order = mod["order"]

    blocks: list[str] = []

    # ---- Module upsert ----
    blocks.append(f"""  -- ============================================================
  -- module: {slug}
  -- ============================================================
  INSERT INTO "LearningModule"
    ("slug", "title", "summary", "content", "audience", "isPublished", "order", "updatedAt")
  VALUES
    ('{sql_escape(slug)}', '{sql_escape(title)}', '{sql_escape(summary)}',
     '{sql_escape(content)}', {sql_array_literal(audience, '"Role"[]')},
     true, {order}, now())
  ON CONFLICT ("slug") DO UPDATE SET
    "title"       = EXCLUDED."title",
    "summary"     = EXCLUDED."summary",
    "content"     = EXCLUDED."content",
    "audience"    = EXCLUDED."audience",
    "isPublished" = EXCLUDED."isPublished",
    "order"       = EXCLUDED."order",
    "updatedAt"   = now()
  RETURNING "id" INTO v_module_id;
""")

    # ---- Lessons: wipe + recreate ----
    blocks.append(f"""  -- lessons for {slug}
  DELETE FROM "LearningLesson" WHERE "moduleId" = v_module_id;
""")
    for lesson in mod.get("lessons", []):
        order_n = lesson["order"]
        title = lesson["title"]
        content = lesson["content"]
        estimated = lesson.get("estimatedMin", 5)
        blocks.append(f"""  INSERT INTO "LearningLesson"
    ("moduleId", "order", "title", "content", "estimatedMin")
  VALUES
    (v_module_id, {order_n}, '{sql_escape(title)}', '{sql_escape(content)}', {estimated});
""")

    # ---- Quiz: upsert by moduleId (UNIQUE) ----
    quiz = mod["quiz"]
    qtitle = quiz["title"]
    qpassing = quiz["passingScore"]
    blocks.append(f"""  -- quiz for {slug}
  INSERT INTO "Quiz"
    ("moduleId", "title", "passingScore")
  VALUES
    (v_module_id, '{sql_escape(qtitle)}', {qpassing})
  ON CONFLICT ("moduleId") DO UPDATE SET
    "title"        = EXCLUDED."title",
    "passingScore" = EXCLUDED."passingScore";

  -- wipe & recreate questions (and via cascade, options)
  DELETE FROM "QuizQuestion" WHERE "quizId" = (SELECT "id" FROM "Quiz" WHERE "moduleId" = v_module_id);
""")
    for q in quiz["questions"]:
        qorder = q["order"]
        qprompt = q["prompt"]
        qtype = q["type"]
        qexplain = q.get("explanation") or ""
        qpoints = q.get("points", 1)
        explain_sql = "NULL" if not qexplain else f"'{sql_escape(qexplain)}'"
        blocks.append(f"""  -- question {qorder} for {slug}
  INSERT INTO "QuizQuestion"
    ("quizId", "order", "prompt", "type", "explanation", "points")
  VALUES
    ((SELECT "id" FROM "Quiz" WHERE "moduleId" = v_module_id),
     {qorder}, '{sql_escape(qprompt)}', '{sql_escape(qtype)}',
     {explain_sql}, {qpoints})
  RETURNING "id" INTO v_question_id;
""")
        for opt in q.get("options", []):
            otext = opt["text"]
            oiscorrect = "true" if opt["isCorrect"] else "false"
            oorder = opt["order"]
            blocks.append(f"""  INSERT INTO "QuizOption"
    ("questionId", "text", "isCorrect", "order")
  VALUES
    (v_question_id, '{sql_escape(otext)}', {oiscorrect}, {oorder});
""")

    return "".join(blocks)


def main() -> None:
    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    print(f"loaded {len(data)} modules from {JSON_PATH.name}")

    header = f"""-- Migration: {MIGRATION_NAME}
-- Seeds 10 Zambia-specific financial literacy modules + quizzes.
-- Generated from prisma/seed-learning-zambia.ts via ts_to_json.py + json_to_sql.py.
-- Idempotent: safe to re-run; modules upsert on slug, lessons + quiz
-- are wiped and recreated each run (CASCADE drops questions/options).
--
-- Topics covered:
--   1. Mastering Your Civil Servant Salary (PAYE, NAPSA, allowances)
--   2. The Debt Trap: Mobile Money Loans, Sakawa & Pyramid Schemes
--   3. Building Your 3-Month Emergency Fund
--   4. NAPSA & Retirement: How to Maximize Your Benefits
--   5. Banking in Zambia: Hidden Costs & Smart Choices
--   6. Insurance & Risk Protection for Civil Servants
--   7. Why Your Cooperative is Your Best Investment
--   8. Avoiding Scams: Sakawa, Kachalo & Pyramid Schemes in Zambia
--   9. Property & Land: Building Wealth You Can Pass Down
--  10. Teaching Your Family About Money: Generational Wealth

BEGIN;

DO $$
DECLARE
  v_module_id UUID;
  v_question_id UUID;
BEGIN
"""

    blocks = []
    for i, mod in enumerate(data):
        blocks.append(render_module(mod, is_first=(i == 0)))

    tail = """
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Migration failed: % %', SQLERRM, SQLSTATE;
  ROLLBACK;
  RAISE;
END $$;

COMMIT;
"""

    full = header + "".join(blocks) + tail

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(full, encoding="utf-8")
    print(f"wrote {OUT_PATH} ({len(full):,} chars)")

    total_lessons = sum(len(m.get("lessons") or []) for m in data)
    total_questions = sum(len(m["quiz"]["questions"]) for m in data)
    total_options = sum(len(q.get("options", [])) for m in data for q in m["quiz"]["questions"])
    print(f"summary: 10 modules, {total_lessons} lessons, {total_questions} questions, {total_options} options")


if __name__ == "__main__":
    main()
