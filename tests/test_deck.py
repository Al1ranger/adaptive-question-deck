import itertools
import json
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
OPTIONS = (ROOT / "fixtures/options.json").read_text()


@pytest.fixture
def deck(direct_deploy):
    contract = direct_deploy(str(ROOT / "contracts/AdaptiveQuestionDeck.py"))
    return contract, sys.modules[type(contract._instance).__module__]


def mock_question(vm, question="Is it made of stainless steel?", labels="YYNN", valid=True):
    vm.mock_llm(r".*GENERATE QUESTION DECK.*", json.dumps({"question": question}))
    vm.mock_llm(r".*AUDIT QUESTION DECK.*", json.dumps({"valid": valid, "labels": labels}))


def test_adaptive_rounds_and_independent_validator(deck, direct_vm, direct_alice, direct_bob):
    contract, mod = deck
    direct_vm.sender = direct_alice
    session = contract.open_session("first", OPTIONS)
    mock_question(direct_vm)
    # Anyone can ask, but only the creator can supply an answer.
    direct_vm.sender = direct_bob
    question = contract.ask(session, 0)
    assert direct_vm.run_validator()
    state = contract.get_session(session)
    assert state["pending"]["labels"] == "YYNN"
    forged = {"question": state["pending"]["question"], "labels": "YNNN",
              "binding": state["pending"]["binding"]}
    assert not direct_vm.run_validator(leader_result=mod.canonical(forged))
    assert not direct_vm.run_validator(leader_result=mod.canonical({**forged, "binding": "0" * 64}))
    with direct_vm.expect_revert("Only the session creator"):
        contract.answer(session, question, "Y")
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("pending"):
        contract.ask(session, 0)
    with direct_vm.expect_revert("Answer must"):
        contract.answer(session, question, "?")
    contract.answer(session, question, "Y")
    assert contract.get_session(session)["alive"] == [0, 1]
    with direct_vm.expect_revert("No matching pending question"):
        contract.answer(session, question, "N")
    with direct_vm.expect_revert("stale"):
        contract.ask(session, 0)
    direct_vm.clear_mocks()
    mock_question(direct_vm, "Is it insulated?", "YN")
    second = contract.ask(session, 1)
    assert direct_vm.run_validator()
    assert second != question
    with direct_vm.expect_revert("No matching pending question"):
        contract.answer(session, question, "N")
    contract.answer(session, second, "N")
    assert contract.selection(session) == {"index": 1, "description": json.loads(OPTIONS)[1]}
    state = contract.get_session(session)
    assert state["options"] == json.loads(OPTIONS)
    assert [step["after"] for step in state["history"]] == [[0, 1], [1]]
    with direct_vm.expect_revert("already resolved"):
        contract.ask(session, 2)


@pytest.mark.parametrize(("answer", "alive"), [("Y", [0, 1]), ("N", [1, 2, 3])])
def test_uncertain_options_survive_either_answer(deck, direct_vm, answer, alive):
    contract, _ = deck
    session = contract.open_session("unknown", OPTIONS)
    mock_question(direct_vm, labels="Y?NN")
    question = contract.ask(session, 0)
    contract.answer(session, question, answer)
    assert contract.get_session(session)["alive"] == alive
    with direct_vm.expect_revert("multiple remaining options"):
        contract.selection(session)


def test_cross_session_substitution_and_nonce_replay(deck, direct_vm):
    contract, _ = deck
    first = contract.open_session("first", OPTIONS)
    second = contract.open_session("second", OPTIONS)
    mock_question(direct_vm)
    q_first = contract.ask(first, 0)
    q_second = contract.ask(second, 0)
    assert q_first != q_second
    with direct_vm.expect_revert("No matching pending question"):
        contract.answer(second, q_first, "N")
    with direct_vm.expect_revert("already used"):
        contract.open_session("first", OPTIONS)


@pytest.mark.parametrize(("valid", "labels"), [(False, "YYNN"), (True, "YYYY"), (True, "NNNN"),
                                               (True, "????"), (True, "YNN"), (True, "YNXX")])
def test_invalid_audit_never_sets_pending(deck, direct_vm, valid, labels):
    contract, _ = deck
    session = contract.open_session("invalid", OPTIONS)
    mock_question(direct_vm, labels=labels, valid=valid)
    with direct_vm.expect_revert("generation or audit failed"):
        contract.ask(session, 0)
    assert contract.get_session(session)["pending"] is None
    assert contract.get_session(session)["alive"] == [0, 1, 2, 3]


def test_validator_rejects_independent_audit_disagreement(deck, direct_vm):
    contract, _ = deck
    session = contract.open_session("disagreement", OPTIONS)
    mock_question(direct_vm)
    contract.ask(session, 0)
    direct_vm.clear_mocks()
    mock_question(direct_vm, labels="Y?NN")
    assert not direct_vm.run_validator()


def test_all_ternary_vectors_require_strict_progress(deck):
    _, mod = deck
    for n in range(2, 7):
        for parts in itertools.product("YN?", repeat=n):
            labels = "".join(parts)
            if "Y" in labels and "N" in labels:
                assert mod.parse_audit({"valid": True, "labels": labels}, n) == labels
                for answer in "YN":
                    retained = [i for i, label in enumerate(labels) if label in (answer, "?")]
                    assert 1 <= len(retained) < n
                    assert all(i in retained for i, label in enumerate(labels) if label == "?")
            else:
                with pytest.raises(ValueError):
                    mod.parse_audit({"valid": True, "labels": labels}, n)


@pytest.mark.parametrize("options", ['[]', '["same","same"]', '[true,"valid"]',
                                    '["","valid"]', '["one"]'])
def test_bad_options_rejected(deck, direct_vm, options):
    contract, _ = deck
    with direct_vm.expect_revert("Invalid authored options"):
        contract.open_session("invalid-options", options)
