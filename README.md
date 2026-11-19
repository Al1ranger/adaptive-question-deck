# AdaptiveQuestionDeck

AdaptiveQuestionDeck runs an interactive elimination session over two to six
authored option descriptions. A leader generates a yes/no question about a
property of the remaining options. Each validator independently evaluates
that exact question against every surviving description and agrees on the
complete Y/N/? vector. The session retains that question until its creator
answers Y or N.

A Y answer removes only options labelled N. A N answer removes only options
labelled Y. Every ? option survives either answer. A question needs at least
one Y and one N, so either valid answer strictly reduces the remaining set.
At most n−1 successful rounds can occur before one of n options remains.
If no valid split can be generated and audited, asking reverts. It does not
establish that no distinguishing question exists.

The contract stores each session's immutable creator and original descriptions,
remaining option indices, pending question, and completed question/answer
history. The question digest binds its session, round and survivor set.
Only the creator may answer. A caller supplies the expected round to ask.
Pending questions and stale answers cannot be replaced or replayed.

The LLM's question and semantic labels determine which options survive.
Validators re-evaluate the substantive labels against the original option text.
The [GenLayer equivalence principle](https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle)
describes the custom leader/validator pattern.

The result expresses consistency with authored descriptions and the creator's
answers. Those descriptions and answers can be incomplete or inaccurate.
Model mistakes can also affect the result. The fixture is a synthetic set of
four containers. Live proofs use answers chosen to exercise elimination.

## API

- `open_session(nonce, options_json)` creates a session bound to its creator.
- `ask(session, expected_round)` generates and audits a question.
- `answer(session, question_id, "Y" | "N")` narrows that session.
- `get_session(session)` returns descriptions, questions and survivor history.
- `selection(session)` returns the single remaining option, or reverts.

Descriptions contain at most 280 UTF-8 bytes each. Sessions accept 2–6 options
and at most 2048 bytes of JSON. Questions contain at most 240 UTF-8 bytes.

```sh
python -m pip install -r requirements-dev.txt
genvm-lint check contracts/AdaptiveQuestionDeck.py
python -m pytest tests -q
```
