import argparse
import json
import os
import re
import sys
from typing import Dict, List


SCRIPT_DIR = os.path.dirname(__file__)
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
MODELS_DIR = os.path.join(BACKEND_DIR, "models")

if MODELS_DIR not in sys.path:
    sys.path.insert(0, MODELS_DIR)

from iserve_ai import analyze  # noqa: E402


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip()).lower()


def tokenize(value: str) -> List[str]:
    return re.findall(r"[a-z0-9]+", normalize_text(value))


def safe_divide(numerator: float, denominator: float) -> float:
    if denominator == 0:
        return 0.0
    return numerator / denominator


def score_summary(expected: str, predicted: str) -> Dict[str, float]:
    expected_tokens = tokenize(expected)
    predicted_tokens = tokenize(predicted)

    if not expected_tokens and not predicted_tokens:
        return {"precision": 1.0, "recall": 1.0, "f1": 1.0}

    if not expected_tokens or not predicted_tokens:
        return {"precision": 0.0, "recall": 0.0, "f1": 0.0}

    expected_set = set(expected_tokens)
    predicted_set = set(predicted_tokens)
    overlap = len(expected_set & predicted_set)

    precision = safe_divide(overlap, len(predicted_set))
    recall = safe_divide(overlap, len(expected_set))
    f1 = safe_divide(2 * precision * recall, precision + recall)

    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
    }


def labels_match(expected: str, predicted: str) -> bool:
    return normalize_text(expected) == normalize_text(predicted)


def load_samples(input_path: str) -> List[Dict]:
    with open(input_path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    if isinstance(payload, dict):
        samples = payload.get("samples", [])
    elif isinstance(payload, list):
        samples = payload
    else:
        raise ValueError("Input file must contain a JSON array or an object with a 'samples' array")

    if not isinstance(samples, list) or not samples:
        raise ValueError("No evaluation samples found")

    return samples


def build_input_text(sample: Dict) -> str:
    direct_text = str(sample.get("text") or "").strip()
    if direct_text:
        return direct_text

    parts = [
        str(sample.get("subject") or "").strip(),
        str(sample.get("description") or "").strip(),
        str(sample.get("personInvolved") or "").strip(),
        str(sample.get("incidentDate") or "").strip(),
    ]
    combined = "\n".join(part for part in parts if part)

    if not combined:
        raise ValueError("Sample must include either 'text' or grievance fields such as subject/description")

    return combined


def evaluate_sample(sample: Dict) -> Dict:
    complaint_text = build_input_text(sample)
    result = analyze(complaint_text)
    expected = sample.get("expected", {})

    category_expected = expected.get("category")
    urgency_expected = expected.get("urgency")
    sentiment_expected = expected.get("sentiment")
    summary_expected = expected.get("summary")

    category_predicted = result.get("category", {}).get("label", "")
    urgency_predicted = result.get("urgency", {}).get("label", "")
    sentiment_predicted = result.get("sentiment", {}).get("label", "")
    summary_predicted = result.get("summary", "")

    summary_scores = score_summary(summary_expected, summary_predicted) if summary_expected else None

    return {
        "id": sample.get("id") or sample.get("referenceNumber") or "sample",
        "text": complaint_text,
        "expected": expected,
        "predicted": {
            "summary": summary_predicted,
            "category": category_predicted,
            "urgency": urgency_predicted,
            "sentiment": sentiment_predicted,
        },
        "matches": {
            "category": labels_match(category_expected, category_predicted) if category_expected else None,
            "urgency": labels_match(urgency_expected, urgency_predicted) if urgency_expected else None,
            "sentiment": labels_match(sentiment_expected, sentiment_predicted) if sentiment_expected else None,
            "summary_f1": summary_scores["f1"] if summary_scores else None,
        },
        "summary_scores": summary_scores,
    }


def summarize_results(results: List[Dict]) -> Dict:
    category_checks = [row["matches"]["category"] for row in results if row["matches"]["category"] is not None]
    urgency_checks = [row["matches"]["urgency"] for row in results if row["matches"]["urgency"] is not None]
    sentiment_checks = [row["matches"]["sentiment"] for row in results if row["matches"]["sentiment"] is not None]
    summary_scores = [row["matches"]["summary_f1"] for row in results if row["matches"]["summary_f1"] is not None]

    return {
        "samples": len(results),
        "category_accuracy": round(safe_divide(sum(1 for item in category_checks if item), len(category_checks)), 4) if category_checks else None,
        "urgency_accuracy": round(safe_divide(sum(1 for item in urgency_checks if item), len(urgency_checks)), 4) if urgency_checks else None,
        "sentiment_accuracy": round(safe_divide(sum(1 for item in sentiment_checks if item), len(sentiment_checks)), 4) if sentiment_checks else None,
        "summary_avg_f1": round(sum(summary_scores) / len(summary_scores), 4) if summary_scores else None,
    }


def print_report(results: List[Dict], summary: Dict, show_passes: bool) -> None:
    print("AI Model Evaluation Report")
    print("==========================")
    print(f"Samples: {summary['samples']}")

    if summary["category_accuracy"] is not None:
        print(f"Category accuracy: {summary['category_accuracy'] * 100:.1f}%")
    if summary["urgency_accuracy"] is not None:
        print(f"Urgency accuracy: {summary['urgency_accuracy'] * 100:.1f}%")
    if summary["sentiment_accuracy"] is not None:
        print(f"Sentiment accuracy: {summary['sentiment_accuracy'] * 100:.1f}%")
    if summary["summary_avg_f1"] is not None:
        print(f"Summary average F1: {summary['summary_avg_f1'] * 100:.1f}%")

    print("")
    print("Per-sample results")
    print("------------------")

    for row in results:
        category_ok = row["matches"]["category"]
        urgency_ok = row["matches"]["urgency"]
        sentiment_ok = row["matches"]["sentiment"]
        summary_f1 = row["matches"]["summary_f1"]

        has_failure = any(item is False for item in [category_ok, urgency_ok, sentiment_ok])
        if not show_passes and not has_failure and (summary_f1 is None or summary_f1 >= 0.7):
            continue

        print(f"ID: {row['id']}")
        print(f"  Predicted category : {row['predicted']['category']}")
        print(f"  Predicted urgency  : {row['predicted']['urgency']}")
        print(f"  Predicted sentiment: {row['predicted']['sentiment']}")

        if row["expected"].get("category"):
            print(f"  Expected category  : {row['expected']['category']} | match={category_ok}")
        if row["expected"].get("urgency"):
            print(f"  Expected urgency   : {row['expected']['urgency']} | match={urgency_ok}")
        if row["expected"].get("sentiment"):
            print(f"  Expected sentiment : {row['expected']['sentiment']} | match={sentiment_ok}")
        if row["expected"].get("summary"):
            print(f"  Summary F1         : {summary_f1}")
            print(f"  Expected summary   : {row['expected']['summary']}")
            print(f"  Predicted summary  : {row['predicted']['summary']}")
        print("")


def main():
    parser = argparse.ArgumentParser(description="Evaluate local grievance AI models against labeled complaint samples")
    parser.add_argument("--input", required=True, help="Path to a JSON file containing evaluation samples")
    parser.add_argument("--output", help="Optional path to save the full JSON report")
    parser.add_argument("--show-passes", action="store_true", help="Print all sample results, not just weak ones")
    args = parser.parse_args()

    samples = load_samples(args.input)
    results = [evaluate_sample(sample) for sample in samples]
    summary = summarize_results(results)
    report = {
        "summary": summary,
        "results": results,
    }

    print_report(results, summary, args.show_passes)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2, ensure_ascii=False)
        print(f"Saved JSON report to {args.output}")


if __name__ == "__main__":
    main()
