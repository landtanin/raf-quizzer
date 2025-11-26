#!/usr/bin/env node
/**
 * Parse quizzer-1.xlsx and merge questions with existing deck.json
 * The xlsx has questions as column headers with answers in rows below
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get raw JSON from xlsx using npx xlsx-cli
const xlsxPath = path.resolve(__dirname, '../quizzer-1.xlsx');
const deckPath = path.resolve(__dirname, '../web/public/deck.json');

console.log('Parsing quizzer-1.xlsx...');
const rawJson = execSync(`npx xlsx-cli "${xlsxPath}" --json`, { encoding: 'utf-8' });
const rows = JSON.parse(rawJson);

// Convert column-based format to question/answers format
// Each column header is a question, each row has an answer for that question
const questionMap = new Map();

for (const row of rows) {
  for (const [question, answer] of Object.entries(row)) {
    if (!question || !answer) continue;

    // Skip if this looks like a header for another question (starts with TK)
    const trimmedAnswer = String(answer).trim();
    if (!trimmedAnswer) continue;
    if (/^TK\d/.test(trimmedAnswer)) continue;

    // Clean up question text (remove trailing numbers like _1)
    const cleanQuestion = question.replace(/_\d+$/, '').trim();

    if (!questionMap.has(cleanQuestion)) {
      questionMap.set(cleanQuestion, new Set());
    }
    questionMap.get(cleanQuestion).add(trimmedAnswer);
  }
}

// Convert to deck format
const newCards = [];
for (const [question, answersSet] of questionMap.entries()) {
  const answers = Array.from(answersSet);
  if (answers.length > 0) {
    newCards.push({ question, answers });
  }
}

console.log(`Found ${newCards.length} questions in quizzer-1.xlsx`);

// Load existing deck
let existingDeck = [];
if (fs.existsSync(deckPath)) {
  existingDeck = JSON.parse(fs.readFileSync(deckPath, 'utf-8'));
  console.log(`Existing deck has ${existingDeck.length} questions`);
}

// Merge: add new questions that don't exist
const existingQuestions = new Set(existingDeck.map(c => c.question));
let addedCount = 0;

for (const card of newCards) {
  if (!existingQuestions.has(card.question)) {
    existingDeck.push(card);
    addedCount++;
  }
}

console.log(`Added ${addedCount} new questions`);
console.log(`Total deck size: ${existingDeck.length} questions`);

// Write merged deck
fs.writeFileSync(deckPath, JSON.stringify(existingDeck, null, 2), 'utf-8');
console.log(`Wrote merged deck to ${deckPath}`);
