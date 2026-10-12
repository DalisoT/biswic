"""Generate prisma/migrations/<timestamp>_zambia_literacy_seed.sql from
zambia-modules.clean.json.

Output is plain SQL wrapped in a single transaction, with chained CTEs
(one per module) doing:
  1. Upsert LearningModule (ON CONFLICT on slug)
  2. DELETE existing LearningLesson for that module
  3. INSERT new LearningLesson rows
  4. DELETE existing Quiz (CASCADE clears Questions/Options)
  5. INSERT new Quiz
  6. INSERT new QuizQuestion (RETURNING id)
  7. INSERT new QuizOption rows referencing that question

No DO block, no PL/pgSQL — pure SQL so the Supabase SQL editor and any
psql client can run it without PL/pgSQL body parsing edge cases.
"""

from __future__ import annotations

import json
from pathlib import Path

JSON_PATH = Path(r"C:\Users\RICHARD_TEMBO\Desktop\Projects\biswic\prisma\zambia-modules.clean.json")
MIGRATIONS_DIR = Path(r"C:\Users\RICHARD_TEMBO\Desktop\Projects\biswic\prisma\migrations")

TIMESTAMP = "20261012140000"
MIGRATION_NAME = f"{TIMESTAMP}_zambia_literacy_seed"
OUT_PATH = MIGRATIONS_DIR / MIGRATION_NAME / "migration.sql"


def sql_escape(s: str) -> str:
    return s.replace("'", "''")


def sql_text(s: str) -> str:
    return f"'{sql_escape(s)}'"


def sql_array(values: list[str], cast: str | None = None) -> str:
    inner = ", ".join(sql_text(v) for v in values)
    s = f"ARRAY[{inner}]"
    if cast:
        s += f"::{cast}"
    return s


def render_module_cte(mod: dict) -> str:
    """Render one module as a chained CTE block (single SQL statement)."""
    slug = mod["slug"]
    title = mod["title"]
    summary = mod["summary"]
    content = summary  # use summary as module-level content (NOT NULL)
    audience = mod["audience"]
    order = mod["order"]
    quiz = mod["quiz"]
    qtitle = quiz["title"]
    qpassing = quiz["passingScore"]
    lessons = mod.get("lessons", [])
    questions = quiz.get("questions", [])

    ctes: list[str] = []

    # 1. Module upsert
    ctes.append(f"""  m AS (
    INSERT INTO "LearningModule"
      ("slug", "title", "summary", "content", "audience", "isPublished", "order", "updatedAt")
    VALUES
      ('{sql_escape(slug)}', '{sql_escape(title)}', '{sql_escape(summary)}',
       '{sql_escape(content)}', {sql_array(audience, '"Role"[]')},
       true, {order}, now())
    ON CONFLICT ("slug") DO UPDATE SET
      "title"       = EXCLUDED."title",
      "summary"     = EXCLUDED."summary",
      "content"     = EXCLUDED."content",
      "audience"    = EXCLUDED."audience",
      "isPublished" = EXCLUDED."isPublished",
      "order"       = EXCLUDED."order",
      "updatedAt"   = now()
    RETURNING "id"
  )""")

    # 2. Delete existing lessons for this module
    ctes.append("""  dl AS (
    DELETE FROM "LearningLesson"
    WHERE "moduleId" IN (SELECT id FROM m)
    RETURNING 1
  )""")

    # 3. Insert lessons (one CTE per lesson would be needed to chain; instead use a
    #    single multi-row INSERT then chain questions through a separate CTE block)
    if lessons:
        lesson_rows = []
        for lesson in lessons:
            lesson_rows.append(
                f"      ((SELECT id FROM m), {lesson['order']}, "
                f"'{sql_escape(lesson['title'])}', '{sql_escape(lesson['content'])}', "
                f"{lesson.get('estimatedMin', 5)})"
            )
        ctes.append(f"""  il AS (
    INSERT INTO "LearningLesson"
      ("moduleId", "order", "title", "content", "estimatedMin")
    VALUES
{',\n'.join(lesson_rows)}
    RETURNING 1
  )""")

    # 4. Delete existing quiz (CASCADE will drop questions/options)
    ctes.append("""  dq AS (
    DELETE FROM "Quiz"
    WHERE "moduleId" IN (SELECT id FROM m)
    RETURNING 1
  )""")

    # 5. Insert quiz
    ctes.append(f"""  q AS (
    INSERT INTO "Quiz"
      ("moduleId", "title", "passingScore")
    VALUES
      ((SELECT id FROM m), '{sql_escape(qtitle)}', {qpassing})
    RETURNING "id"
  )""")

    # 6. Insert each question with RETURNING id, and reference it for options
    for i, q in enumerate(questions):
        qalias = f"q{i}"
        qorder = q["order"]
        qprompt = q["prompt"]
        qtype = q["type"]
        qexplain = q.get("explanation") or ""
        qpoints = q.get("points", 1)
        explain_sql = "NULL" if not qexplain else f"'{sql_escape(qexplain)}'"
        ctes.append(f"""  {qalias} AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), {qorder}, '{sql_escape(qprompt)}', '{sql_escape(qtype)}',
       {explain_sql}, {qpoints})
    RETURNING "id"
  )""")
        # Options for this question
        opts = q.get("options", [])
        if opts:
            opt_alias = f"o{i}"
            opt_rows = []
            for opt in opts:
                otext = opt["text"]
                oiscorrect = "true" if opt["isCorrect"] else "false"
                oorder = opt["order"]
                opt_rows.append(
                    f"      ((SELECT id FROM {qalias}), '{sql_escape(otext)}', {oiscorrect}, {oorder})"
                )
            ctes.append(f"""  {opt_alias} AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
{',\n'.join(opt_rows)}
    RETURNING 1
  )""")

    # Final SELECT to make the CTE chain return a row
    ctes.append("""  final AS (SELECT 'ok' AS status)""")

    # Wrap in WITH ... SELECT
    body = ",\n".join(ctes)
    return f"WITH\n{body}\nSELECT 1;\n\n"


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
--
-- Uses pure-SQL chained CTEs (no DO block, no PL/pgSQL) for maximum portability
-- across psql, Supabase SQL editor, and other clients.

BEGIN;

"""

    blocks = []
    for mod in data:
        blocks.append(f"-- ----- {mod['slug']} -----\n")
        blocks.append(render_module_cte(mod))

    tail = """COMMIT;
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
