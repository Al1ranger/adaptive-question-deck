import assert from 'node:assert/strict';
import fs from 'node:fs';
import {digest} from './check.mjs';

const repo = 'https://github.com/Al1ranger/adaptive-question-deck';
const explorer = 'https://explorer-studio.genlayer.com';
const proof = JSON.parse(fs.readFileSync('PROOFS.json', 'utf8'));
assert.equal(proof.verified, true);
assert.equal(proof.source.source_match, true);
assert.match(proof.address, /^0x[a-f0-9]{40}$/i);
assert.match(proof.source_commit, /^[a-f0-9]{40}$/);
assert.equal(proof.final.pending, null);
assert.equal(proof.final.alive.length, 1);
assert.equal(proof.selection.index, proof.final.alive[0]);
assert.deepEqual(proof.final.options, JSON.parse(fs.readFileSync('fixtures/options.json')));
const history = [];
let alive = proof.final.options.map((_, i) => i);
for (const event of proof.final.history) {
  const {id, answer, after, ...question} = event;
  assert.equal(id, digest(question));
  assert.equal(question.round, history.length);
  assert.deepEqual(question.alive, alive);
  assert.equal(question.binding, digest({
    session: proof.session, round: history.length, alive, options: proof.final.options, history,
  }));
  assert.equal(question.labels.length, alive.length);
  assert(question.labels.includes('Y') && question.labels.includes('N'));
  const retained = alive.filter((_, i) => [answer, '?'].includes(question.labels[i]));
  assert(retained.length > 0 && retained.length < alive.length);
  assert.deepEqual(after, retained);
  alive = retained;
  history.push(event);
}
assert.deepEqual(alive, proof.final.alive);
for (const step of ['deploy', 'open', 'duplicate-session', 'peer-answer-denied',
  'pending-question-denied', 'answer-replay-denied']) {
  assert(proof.transactions.some(tx => tx.step === step));
}
assert.equal(proof.transactions.length, 6 + 2 * history.length);
let errors = 0;
const receiptRows = proof.transactions.map(tx => {
  const {receipt} = tx;
  assert.match(tx.hash, /^0x[a-f0-9]{64}$/i);
  assert.equal(receipt.status, 'FINALIZED');
  assert.equal(receipt.execution, tx.error ? 'ERROR' : 'SUCCESS');
  assert.equal(receipt.committed, !tx.error);
  assert.equal(receipt.consensus, 'MAJORITY_AGREE');
  assert.equal(receipt.leader_only, false);
  assert(receipt.agree_votes >= 2);
  if (tx.error) {
    assert.equal(receipt.expected_error_matched, true);
    errors++;
  }
  return `| [${tx.step}](${explorer}/tx/${tx.hash}) | ${receipt.execution} | ${receipt.agree_votes} |`;
});
assert.equal(errors, 4);

const contract = `[StudioNet deployment](${explorer}/address/${proof.address})`;
const source = `[Deployed source](${repo}/blob/${proof.source_commit}/contracts/AdaptiveQuestionDeck.py)`;
const total = proof.transactions.length;
const questionRows = history.map(event =>
  `| ${event.round} | ${event.question.replaceAll('|', '\\|')} | ${event.alive.join(', ')} | ${event.labels} | ${event.answer} | ${event.after.join(', ')} |`);

fs.writeFileSync('LIVE_PROOFS.md', [
  '# StudioNet proofs', '',
  `${contract} · ${source} · [Receipt and state data](PROOFS.json)`, '',
  `All ${total} transactions finalized with majority agreement. ${total - errors} executed successfully and four reverted with the expected errors. The deployed source matches the pinned commit. Normalized source SHA-256 is \`${proof.source.sha256}\`.`, '',
  `[Hosted verification run](${repo}/actions/runs/44468850837)`, '',
  'The demonstration used two temporary StudioNet accounts. The creator registered the synthetic options and answered alternating Y/N. The peer asked questions and attempted an unauthorized answer. Accounts were generated in memory by the hosted runner.', '',
  '| Round | AI question | Active option indices | Agreed labels | Demo answer | Remaining indices |',
  '| --- | --- | --- | --- | --- | --- |',
  ...questionRows, '',
  `The final selection was option ${proof.selection.index}, “${proof.selection.description}”`, '',
  'The final state preserved every original option and completed question. Duplicate session creation, peer answering, replacing a pending question and replaying an answered question each reverted. Receipt records include native sender, nonce and zero-value checks.', '',
  '| Transaction | Execution | Agree votes |',
  '| --- | --- | ---: |', ...receiptRows, '',
].join('\n'));

fs.writeFileSync('SUBMISSION.md', [
  '**Contribution type** Builder → Intelligent Contracts', '',
  '**Title** AdaptiveQuestionDeck — Interactive Consensus-Audited Questions', '',
  '**Notes / Description**', '',
  'AdaptiveQuestionDeck runs a narrowing session over authored options. A leader generates a yes/no question about the surviving descriptions. Validators independently assess that exact question and each description, requiring exact agreement on every Y/N/? label. The creator’s answer removes only contradicted options. Uncertain options survive either answer. Requiring at least one Y and one N makes each answered round strictly reduce the set.',
  '',
  'Storage consists of original descriptions, surviving indices, a pending question and the completed question/answer history. Questions bind their session and round. Only the creator may answer. Consumers can read a selection once one option remains.',
  '',
  `StudioNet proofs include ${history.length} generated questions and four expected error cases. All ${total} receipts finalized. The demonstration uses synthetic descriptions and scripted answers. Results depend on those authored descriptions, answers and model judgments.`, '',
  '**Evidence**', '',
  `- [Repository](${repo})`, `- ${source}`, `- ${contract}`,
  `- [${total} finalized receipts and session proof](${repo}/blob/main/LIVE_PROOFS.md)`, '',
].join('\n'));
