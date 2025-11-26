#!/usr/bin/env node
/**
 * Parse quizzer-1.xlsx and merge questions with existing deck.json
 *
 * The xlsx structure:
 * - Column headers are TK1.1 questions
 * - Within each column, TK headers in cells mark new questions
 * - Non-TK cells following a TK header are answers for that question
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const xlsxPath = path.resolve(__dirname, '../quizzer-1.xlsx');
const deckPath = path.resolve(__dirname, '../web/public/deck.json');

console.log('Parsing quizzer-1.xlsx...');
const rawJson = execSync(`npx xlsx-cli "${xlsxPath}" --json`, { encoding: 'utf-8' });
const rows = JSON.parse(rawJson);

// Build column-wise data: for each column, collect all values in order
const columns = new Map();

// Get all column names from first row
if (rows.length > 0) {
  for (const colName of Object.keys(rows[0])) {
    const cleanName = colName.replace(/_\d+$/, '').trim();
    if (!columns.has(cleanName)) {
      columns.set(cleanName, []);
    }
  }
}

// Collect all values for each column
for (const row of rows) {
  for (const [colName, value] of Object.entries(row)) {
    const cleanName = colName.replace(/_\d+$/, '').trim();
    if (value && String(value).trim()) {
      columns.get(cleanName).push(String(value).trim());
    }
  }
}

// Parse each column: TK headers start new questions, other cells are answers
const questionMap = new Map();
const tkPattern = /^TK\d/;

for (const [colHeader, values] of columns.entries()) {
  // Start with column header as first question
  let currentQuestion = colHeader;
  let currentAnswers = [];

  for (const value of values) {
    if (tkPattern.test(value)) {
      // Save previous question if it has answers
      if (currentQuestion && currentAnswers.length > 0) {
        if (!questionMap.has(currentQuestion)) {
          questionMap.set(currentQuestion, new Set());
        }
        currentAnswers.forEach(a => questionMap.get(currentQuestion).add(a));
      }
      // Start new question
      currentQuestion = value;
      currentAnswers = [];
    } else {
      // Add as answer to current question
      currentAnswers.push(value);
    }
  }

  // Save last question
  if (currentQuestion && currentAnswers.length > 0) {
    if (!questionMap.has(currentQuestion)) {
      questionMap.set(currentQuestion, new Set());
    }
    currentAnswers.forEach(a => questionMap.get(currentQuestion).add(a));
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

// Load existing deck (original 7 questions only)
// Reset to sample-deck.json to avoid duplicates from previous run
const sampleDeckPath = path.resolve(__dirname, '../sample-deck.json');
let existingDeck = [];
if (fs.existsSync(sampleDeckPath)) {
  existingDeck = JSON.parse(fs.readFileSync(sampleDeckPath, 'utf-8'));
  console.log(`Starting from sample deck with ${existingDeck.length} questions`);
}

// Merge: add new questions that don't exist
const existingQuestions = new Set(existingDeck.map(c => c.question));
let addedCount = 0;

for (const card of newCards) {
  if (!existingQuestions.has(card.question)) {
    existingDeck.push(card);
    existingQuestions.add(card.question);
    addedCount++;
  }
}

console.log(`Added ${addedCount} new questions`);
console.log(`Total deck size: ${existingDeck.length} questions`);

// Write merged deck
fs.writeFileSync(deckPath, JSON.stringify(existingDeck, null, 2), 'utf-8');
console.log(`Wrote merged deck to ${deckPath}`);
