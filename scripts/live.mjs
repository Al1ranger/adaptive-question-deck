import assert from 'node:assert/strict';
import fs from 'node:fs';
import {abi, createAccount, createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {digest, rpc, receipt, source, read} from './check.mjs';

const journal = 'PROOFS.json';
const code = 'contracts/AdaptiveQuestionDeck.py';
const verifyOnly = process.argv.includes('--verify-only');
const proof = fs.existsSync(journal)
  ? JSON.parse(fs.readFileSync(journal, 'utf8'))
  : {network: 'StudioNet', transactions: [], snapshots: []};
const save = () => fs.writeFileSync(journal, JSON.stringify(proof, null, 2) + '\n');
assert.equal(await rpc('eth_chainId', []), '0xf22f');
assert.equal(studionet.id, 61999);

// Persist acknowledged sends before an SDK error or process interruption.
const originalFetch = globalThis.fetch;
const sent = new Map();
let currentEntry;
globalThis.fetch = async (input, options) => {
  const url = String(input);
  const request = JSON.parse(options?.body ?? '{}');
  if (url !== 'https://studio.genlayer.com/api' || request.method !== 'eth_sendRawTransaction') {
    return originalFetch(input, options);
  }
  assert(currentEntry && !currentEntry.hash, 'Inspect the journal before another send');
  const payload = request.params[0];
  assert.match(payload, /^0x[a-f0-9]+$/i);
  if (!sent.has(payload)) {
    sent.set(payload, (async () => {
      const response = await originalFetch(input, options);
      const body = await response.text();
      const data = JSON.parse(body);
      if (data.result) {
        assert.match(data.result, /^0x[a-f0-9]{64}$/i);
        currentEntry.hash = data.result;
        save();
        console.log(currentEntry.step, data.result);
      }
      return {body, status: response.status};
    })());
  }
  const response = await sent.get(payload);
  return new Response(response.body, {status: response.status, headers: {'content-type': 'application/json'}});
};

async function transaction(step, account, functionName, args, error) {
  let entry = proof.transactions.find(tx => tx.step === step);
  if (!entry) {
    assert(!verifyOnly && account, 'Missing broadcast journal');
    const nonce = await rpc('eth_getTransactionCount', [account.address, 'latest']);
    assert.equal(await rpc('eth_getTransactionCount', [account.address, 'pending']), nonce);
    entry = {step, signer: account.address, nonce, functionName, args, ...(error ? {error} : {})};
    proof.transactions.push(entry);
    save();
    currentEntry = entry;
    const client = createClient({chain: studionet, account});
    const hash = functionName === 'deploy'
      ? await client.deployContract({code: fs.readFileSync(code), args: [], leaderOnly: false})
      : await client.writeContract({
        address: proof.address, functionName, args, value: 0n, leaderOnly: false,
      });
    assert.equal(hash, entry.hash);
    currentEntry = undefined;
  }
  assert.deepEqual(entry.args, args);
  assert.equal(entry.functionName, functionName);
  assert.equal(entry.error, error);
  assert(entry.hash, 'Broadcast status unknown. Inspect the recorded nonce before resuming.');
  entry.receipt = await receipt(entry.hash, error ? 'ERROR' : 'SUCCESS', error);
  save();
  assert.equal(entry.receipt.committed, !error);
  const native = await rpc('eth_getTransactionByHash', [entry.hash]);
  assert.equal(native.from_address.toLowerCase(), entry.signer.toLowerCase());
  assert.equal(BigInt(native.nonce), BigInt(entry.nonce));
  assert.equal(BigInt(native.value), 0n);
  console.log(step, entry.receipt.status, entry.receipt.execution);
  if (error) return;
  if (functionName === 'deploy') return {address: entry.receipt.address};
  const leader = native.consensus_data.leader_receipt.find(item => item.mode === 'leader');
  const bytes = Buffer.from(leader.result, 'base64');
  assert.equal(bytes[0], 0);
  return {address: entry.receipt.address, result: abi.calldata.decode(bytes.subarray(1))};
}

function verifySession(state) {
  assert.deepEqual(state.options, JSON.parse(fs.readFileSync('fixtures/options.json')));
  assert.equal(state.creator, proof.creator);
  let alive = state.options.map((_, i) => i);
  const history = [];
  for (const event of state.history) {
    const {id, answer, after, ...pending} = event;
    assert.equal(pending.round, history.length);
    assert.deepEqual(pending.alive, alive);
    assert.equal(pending.binding, digest({
      session: proof.session, round: history.length, alive, options: state.options, history,
    }));
    assert.equal(id, digest(pending));
    assert.match(pending.question, /\?$/);
    assert(Buffer.byteLength(pending.question) <= 240);
    assert.equal(pending.labels.length, alive.length);
    assert.match(pending.labels, /^[YN?]+$/);
    assert(pending.labels.includes('Y') && pending.labels.includes('N'));
    assert(['Y', 'N'].includes(answer));
    const retained = alive.filter((_, i) => [answer, '?'].includes(pending.labels[i]));
    assert(retained.length > 0 && retained.length < alive.length);
    assert.deepEqual(after, retained);
    alive = retained;
    history.push(event);
  }
  assert.deepEqual(state.alive, alive);
  return alive;
}

if (verifyOnly) {
  assert(proof.verified && proof.address && proof.session);
  for (const tx of proof.transactions) {
    await transaction(tx.step, null, tx.functionName, tx.args, tx.error);
  }
  assert.deepEqual(await source(proof.address), proof.source);
  const state = await read(proof.address, 'get_session', [proof.session]);
  verifySession(state);
  assert.deepEqual(state, proof.final);
  assert.deepEqual(await read(proof.address, 'selection', [proof.session]), proof.selection);
  console.log('Verified all receipts and the final session');
} else {
  assert(!proof.transactions.length, 'Use --verify-only for an existing journal. Never rerun for new AI answers.');
  const creator = createAccount();
  const peer = createAccount();
  proof.creator = creator.address;
  proof.peer = peer.address;
  save();
  const deployment = await transaction('deploy', creator, 'deploy', []);
  proof.address = deployment.address;
  proof.source = await source(proof.address);
  save();
  const options = JSON.stringify(JSON.parse(fs.readFileSync('fixtures/options.json')));
  const opened = await transaction('open', creator, 'open_session', ['containers', options]);
  proof.session = opened.result;
  assert.equal(proof.session, digest({contract: proof.address, creator: proof.creator, nonce: 'containers'}));
  save();
  await transaction('duplicate-session', creator, 'open_session', ['containers', options],
    'Session nonce already used');

  for (let round = 0; round < 3; round++) {
    const before = await read(proof.address, 'get_session', [proof.session]);
    verifySession(before);
    if (before.alive.length === 1) break;
    const {result: questionId} = await transaction(`ask-${round}`, peer, 'ask', [proof.session, round]);
    const pendingState = await read(proof.address, 'get_session', [proof.session]);
    assert.deepEqual({...pendingState, pending: null}, before);
    const pending = pendingState.pending;
    assert.equal(questionId, pending.id);
    assert.deepEqual(pending.alive, before.alive);
    proof.snapshots.push({step: `ask-${round}`, state: pendingState});
    save();
    if (round === 0) {
      await transaction('peer-answer-denied', peer, 'answer', [proof.session, questionId, 'Y'],
        'Only the session creator can answer');
      assert.deepEqual(await read(proof.address, 'get_session', [proof.session]), pendingState);
      await transaction('pending-question-denied', peer, 'ask', [proof.session, round],
        'Round is stale or a question is pending');
    }
    // This is a demonstration answer, chosen before seeing any next question.
    const answer = round % 2 === 0 ? 'Y' : 'N';
    await transaction(`answer-${round}`, creator, 'answer', [proof.session, questionId, answer]);
    const after = await read(proof.address, 'get_session', [proof.session]);
    verifySession(after);
    assert.equal(after.pending, null);
    assert.equal(after.history.length, before.history.length + 1);
    proof.snapshots.push({step: `answer-${round}`, state: after});
    save();
  }
  proof.final = await read(proof.address, 'get_session', [proof.session]);
  assert.equal(verifySession(proof.final).length, 1);
  proof.selection = await read(proof.address, 'selection', [proof.session]);
  assert.deepEqual(proof.selection, {
    index: proof.final.alive[0], description: proof.final.options[proof.final.alive[0]],
  });
  const last = proof.final.history.at(-1);
  await transaction('answer-replay-denied', creator, 'answer', [proof.session, last.id, last.answer],
    'No matching pending question');
  assert.deepEqual(await read(proof.address, 'get_session', [proof.session]), proof.final);
  proof.verified = true;
  save();
}
