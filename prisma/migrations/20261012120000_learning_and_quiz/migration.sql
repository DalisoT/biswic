-- Migration: 2026-10-12 — Learning modules + quiz
-- Adds LearningModule, LearningLesson, LessonProgress, Quiz, QuizQuestion,
-- QuizOption, QuizAttempt, QuizAnswer, QuizQuestionType enum.

CREATE TYPE "QuizQuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'MULTI_SELECT');

CREATE TABLE "LearningModule" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug"        TEXT NOT NULL UNIQUE,
  "title"       TEXT NOT NULL,
  "summary"     TEXT NOT NULL,
  "content"     TEXT NOT NULL,
  "audience"    "Role"[] NOT NULL DEFAULT ARRAY['MEMBER']::"Role"[],
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "order"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "LearningModule_isPublished_order_idx" ON "LearningModule"("isPublished", "order");

CREATE TABLE "LearningLesson" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "moduleId"      UUID NOT NULL REFERENCES "LearningModule"("id") ON DELETE CASCADE,
  "order"         INTEGER NOT NULL,
  "title"         TEXT NOT NULL,
  "content"       TEXT NOT NULL,
  "estimatedMin"  INTEGER NOT NULL DEFAULT 5,
  CONSTRAINT "LearningLesson_moduleId_order_key" UNIQUE ("moduleId", "order")
);
CREATE INDEX "LearningLesson_moduleId_order_idx" ON "LearningLesson"("moduleId", "order");

CREATE TABLE "LessonProgress" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"      UUID NOT NULL REFERENCES "User"("id"),
  "lessonId"    UUID NOT NULL REFERENCES "LearningLesson"("id") ON DELETE CASCADE,
  "completedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "LessonProgress_userId_lessonId_key" UNIQUE ("userId", "lessonId")
);
CREATE INDEX "LessonProgress_userId_completedAt_idx" ON "LessonProgress"("userId", "completedAt");

CREATE TABLE "Quiz" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "moduleId"      UUID NOT NULL UNIQUE REFERENCES "LearningModule"("id") ON DELETE CASCADE,
  "title"         TEXT NOT NULL,
  "passingScore"  INTEGER NOT NULL DEFAULT 70,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "QuizQuestion" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "quizId"      UUID NOT NULL REFERENCES "Quiz"("id") ON DELETE CASCADE,
  "order"       INTEGER NOT NULL,
  "prompt"      TEXT NOT NULL,
  "type"        "QuizQuestionType" NOT NULL,
  "explanation" TEXT,
  "points"      INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "QuizQuestion_quizId_order_key" UNIQUE ("quizId", "order")
);

CREATE TABLE "QuizOption" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "questionId" UUID NOT NULL REFERENCES "QuizQuestion"("id") ON DELETE CASCADE,
  "text"       TEXT NOT NULL,
  "isCorrect"  BOOLEAN NOT NULL DEFAULT false,
  "order"      INTEGER NOT NULL
);
CREATE INDEX "QuizOption_questionId_order_idx" ON "QuizOption"("questionId", "order");

CREATE TABLE "QuizAttempt" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"       UUID NOT NULL REFERENCES "User"("id"),
  "quizId"       UUID NOT NULL REFERENCES "Quiz"("id"),
  "score"        INTEGER NOT NULL,
  "passed"       BOOLEAN NOT NULL,
  "startedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completedAt"  TIMESTAMPTZ
);
CREATE INDEX "QuizAttempt_userId_completedAt_idx" ON "QuizAttempt"("userId", "completedAt");
CREATE INDEX "QuizAttempt_quizId_score_idx" ON "QuizAttempt"("quizId", "score");

CREATE TABLE "QuizAnswer" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "attemptId"         UUID NOT NULL REFERENCES "QuizAttempt"("id") ON DELETE CASCADE,
  "questionId"        UUID NOT NULL REFERENCES "QuizQuestion"("id"),
  "selectedOptionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isCorrect"         BOOLEAN NOT NULL
);
CREATE INDEX "QuizAnswer_attemptId_idx" ON "QuizAnswer"("attemptId");
