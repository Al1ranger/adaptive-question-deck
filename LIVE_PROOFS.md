# StudioNet proofs

[StudioNet deployment](https://explorer-studio.genlayer.com/address/0x50bfd7135738Cea7eFef3cC5925B96d7873F6e3c) · [Deployed source](https://github.com/Al1ranger/adaptive-question-deck/blob/50b8ce91a75bf7e8723ba8c7f58b3541baf27d21/contracts/AdaptiveQuestionDeck.py) · [Receipt and state data](PROOFS.json)

All 10 transactions finalized with majority agreement. 6 executed successfully and four reverted with the expected errors. The deployed source matches the pinned commit. Normalized source SHA-256 is `2edeb1b98a57d7b80d8d0c9c01b8551c3ff71b6f383db4b2c19e528b737cc010`.

[Hosted verification run](https://github.com/Al1ranger/adaptive-question-deck/actions/runs/44468850837)

The demonstration used two temporary StudioNet accounts. The creator registered the synthetic options and answered alternating Y/N. The peer asked questions and attempted an unauthorized answer. Accounts were generated in memory by the hosted runner.

| Round | AI question | Active option indices | Agreed labels | Demo answer | Remaining indices |
| --- | --- | --- | --- | --- | --- |
| 0 | Is it insulated? | 0, 1, 2, 3 | YNYN | Y | 0, 2 |
| 1 | Does it have a handle? | 0, 2 | NY | N | 0 |

The final selection was option 0, “Insulated stainless steel bottle holding 500 ml, with a screw cap. It has no handle.”

The final state preserved every original option and completed question. Duplicate session creation, peer answering, replacing a pending question and replaying an answered question each reverted. Receipt records include native sender, nonce and zero-value checks.

| Transaction | Execution | Agree votes |
| --- | --- | ---: |
| [deploy](https://explorer-studio.genlayer.com/tx/0xe56cf7cf59020659c55602eac62ef17598056d8b3de57000e2e8c2dfc903c454) | SUCCESS | 3 |
| [open](https://explorer-studio.genlayer.com/tx/0xa9782c52d0827565c99d5cc53e4bffaa3c8a22fb002cbe3cfc89ad3caf8ef948) | SUCCESS | 4 |
| [duplicate-session](https://explorer-studio.genlayer.com/tx/0x5e2302affc8d25c7bcb97072a642e0a4606429e91c20b3dbeceac83624883406) | ERROR | 4 |
| [ask-0](https://explorer-studio.genlayer.com/tx/0xa090b00a9a4cc95687fa6f4a454f1b807e5f37a3c90f26ae8763b73dd2e154aa) | SUCCESS | 3 |
| [peer-answer-denied](https://explorer-studio.genlayer.com/tx/0x1dbe704f7f75d0f2377739321d3442fb892a073693c62c9dfcf26577ffe7a8a5) | ERROR | 3 |
| [pending-question-denied](https://explorer-studio.genlayer.com/tx/0xcf71693b3c49841b963fd84bc05aa2e391ccbe9f7beb769936928f2fda3f28dd) | ERROR | 4 |
| [answer-0](https://explorer-studio.genlayer.com/tx/0x4e82799d6be5193458bd68097469c6b856e5ef024593ab0f9968b57bc0a67809) | SUCCESS | 4 |
| [ask-1](https://explorer-studio.genlayer.com/tx/0xf04a35dedebdf29e9bb0929892feaa3e0885770b4a66e0fbcc606113f5d4630c) | SUCCESS | 3 |
| [answer-1](https://explorer-studio.genlayer.com/tx/0x320c3e116df2d14e442db364b29b91e035fdd407dd866a16acd8db6d1f23c6f7) | SUCCESS | 4 |
| [answer-replay-denied](https://explorer-studio.genlayer.com/tx/0x5429b0e2178282587b0876e731bdbb7be59a79e84f19cf28a7ba4059a40ca922) | ERROR | 3 |
