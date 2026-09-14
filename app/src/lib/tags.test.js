import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parseTags } from './tags.js'

test('tags are split on commas and trimmed', () => {
  assert.deepEqual(parseTags('מחסן עצים, גימור שמן'), ['מחסן עצים', 'גימור שמן'])
})

test('a trailing comma does not produce an empty tag', () => {
  assert.deepEqual(parseTags('חיבורים, '), ['חיבורים'])
})

test('the same tag twice is kept once', () => {
  assert.deepEqual(parseTags('גימור, גימור'), ['גימור'])
})

test('nothing typed is no tags, not one empty one', () => {
  assert.deepEqual(parseTags(''), [])
  assert.deepEqual(parseTags('   '), [])
})
