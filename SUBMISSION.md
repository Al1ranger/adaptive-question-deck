**Contribution type** Builder → Intelligent Contracts

**Title** AdaptiveQuestionDeck — Interactive Consensus-Audited Questions

**Notes / Description**

AdaptiveQuestionDeck runs a narrowing session over authored options. A leader generates a yes/no question about the surviving descriptions. Validators independently assess that exact question and each description, requiring exact agreement on every Y/N/? label. The creator’s answer removes only contradicted options. Uncertain options survive either answer. Requiring at least one Y and one N makes each answered round strictly reduce the set.

Storage consists of original descriptions, surviving indices, a pending question and the completed question/answer history. Questions bind their session and round. Only the creator may answer. Consumers can read a selection once one option remains.

StudioNet proofs include 2 generated questions and four expected error cases. All 10 receipts finalized. The demonstration uses synthetic descriptions and scripted answers. Results depend on those authored descriptions, answers and model judgments.

**Evidence**

- [Repository](https://github.com/Al1ranger/adaptive-question-deck)
- [Deployed source](https://github.com/Al1ranger/adaptive-question-deck/blob/50b8ce91a75bf7e8723ba8c7f58b3541baf27d21/contracts/AdaptiveQuestionDeck.py)
- [StudioNet deployment](https://explorer-studio.genlayer.com/address/0x50bfd7135738Cea7eFef3cC5925B96d7873F6e3c)
- [10 finalized receipts and session proof](https://github.com/Al1ranger/adaptive-question-deck/blob/main/LIVE_PROOFS.md)
