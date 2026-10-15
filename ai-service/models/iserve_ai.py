import argparse
import inspect
import json
import os
import re
import sys

try:
    import torch
    from transformers import AutoModelForSequenceClassification
    from transformers import AutoModelForSeq2SeqLM
    from transformers import AutoTokenizer
    ML_IMPORT_ERROR = None
except Exception as error:
    torch = None
    AutoModelForSequenceClassification = None
    AutoModelForSeq2SeqLM = None
    AutoTokenizer = None
    ML_IMPORT_ERROR = error


BASE_DIR = os.path.dirname(__file__)
DEVICE = torch.device("cpu") if torch else None


def resolve_model_dir(*candidates):
    for candidate in candidates:
        model_dir = os.path.join(BASE_DIR, candidate)
        if os.path.isdir(model_dir):
            return model_dir
    return os.path.join(BASE_DIR, candidates[0])


MODEL_DIRS = {
    "summarizer": os.path.join(BASE_DIR, "summarizer"),
    "classifier": resolve_model_dir("classification", "classifier"),
    "urgency": os.path.join(BASE_DIR, "urgency"),
    "sentiment": os.path.join(BASE_DIR, "sentiment"),
}


FALLBACK_LABELS = {
    "category": {
        "LABEL_0": "Unfair Treatment",
        "LABEL_1": "Academic Issues",
        "LABEL_2": "Administrative Concerns",
        "LABEL_3": "Other",
    },
    "urgency": {
        "LABEL_0": "low",
        "LABEL_1": "medium",
        "LABEL_2": "high",
        "LABEL_3": "critical",
    },
    "sentiment": {
        "LABEL_0": "negative",
        "LABEL_1": "neutral",
        "LABEL_2": "positive",
    },
}

URGENCY_RANK = {
    "low": 0,
    "medium": 1,
    "high": 2,
    "critical": 3,
}

CRITICAL_SAFETY_PATTERNS = [
    r"\bsexual harassment\b",
    r"\bsexual assault\b",
    r"\bsexual coerc",
    r"\bsex(?:ual)?\s+exchange",
    r"\bexchange(?:s)?\s+related\s+to\s+sexual",
    r"\bsex(?:ual)?\s+favor",
    r"\bsexual matters?\b",
    r"\bsexual\b.{0,40}\b(?:exchange|favor|request|matter|comment|message|touch|contact)\b",
    r"\b(?:exchange|favor|request|matter|comment|message|touch|contact)\b.{0,40}\bsexual\b",
    r"\brequested\s+inappropriate\s+sexual",
    r"\binappropriate\s+sexual",
    r"\bmolest",
    r"\brape\b",
]

HIGH_SAFETY_PATTERNS = [
    r"\bharass",
    r"\babuse\b",
    r"\bthreat",
    r"\bintimidat",
    r"\bviolence?\b",
    r"\bcoerc",
    r"\bblackmail",
    r"\bretaliat",
    r"\bbull(?:y|ied|ying)\b",
    r"\bdiscriminat",
]

UNWANTED_CONTACT_PATTERNS = [
    r"\bunwanted\s+(?:touch|contact)\b",
    r"\bwithout\s+(?:my|our)\s+consent\b.{0,40}\b(?:touch|grab|pull|shove|push)\b",
    r"\baggressive(?:ly)?\s+(?:touch(?:ed)?|grab(?:bed)?|pull(?:ed)?|yank(?:ed)?|shove(?:d)?|push(?:ed)?)\b",
    r"\b(?:touch(?:ed|ing)?|grab(?:bed|bing)?|pull(?:ed|ing)?|yank(?:ed|ing)?|shove(?:d|ing)?|push(?:ed|ing)?)\b.{0,40}\b(?:hair|head|arm|body|shoulder|hand|face|clothes)\b",
    r"\b(?:hair|head|arm|body|shoulder|hand|face|clothes)\b.{0,40}\b(?:touch(?:ed|ing)?|grab(?:bed|bing)?|pull(?:ed|ing)?|yank(?:ed|ing)?|shove(?:d|ing)?|push(?:ed|ing)?)\b",
]

HUMILIATION_PATTERNS = [
    r"\bembarrass(?:ed|ing|ment)?\b",
    r"\bhumiliat(?:e|ed|ing|ion)\b",
    r"\blower(?:ed|ing)?\s+my\s+confidence\b",
    r"\bmade\s+me\s+feel\s+(?:unsafe|embarrassed|humiliated)\b",
]

CATEGORY_LABEL_ALIASES = {
    "academic issues": "Academic Issues",
    "teaching and grading issues": "Academic Issues",
    "administrative concerns": "Administrative Concerns",
    "academic advising issues": "Administrative Concerns",
    "facility problems": "Facility Problems",
    "financial matters": "Financial Matters",
    "harassment discrimination": "Harassment/Discrimination",
    "harassment/discrimination": "Harassment/Discrimination",
    "unfair treatment": "Unfair Treatment",
    "service quality": "Service Quality",
    "policy enforcement": "Policy Enforcement",
    "general feedback": "Other",
    "other": "Other",
}

CATEGORY_LABEL_VALUES = {value.lower() for value in CATEGORY_LABEL_ALIASES.values()}
CATEGORY_LABEL_KEYS = set(CATEGORY_LABEL_ALIASES.keys())

HARASSMENT_CATEGORY_PATTERNS = [
    r"\bharass",
    r"\bsexual harassment\b",
    r"\bdiscriminat",
    r"\bbull(?:y|ied|ying)\b",
    r"\bmolest",
    r"\babuse\b",
    r"\bretaliat",
    r"\bblackmail",
    r"\bintimidat",
    r"\bthreat",
]

UNFAIR_TREATMENT_CATEGORY_PATTERNS = [
    r"\bunfair\b",
    r"\bfavoritis",
    r"\bbias(?:ed)?\b",
    r"\bprejudic",
    r"\bhumiliat",
    r"\bembarrass",
    r"\bridicul",
    r"\binsult",
    r"\bdisrespect",
]

ACADEMIC_CATEGORY_PATTERNS = [
    r"\bgrade",
    r"\bgrading\b",
    r"\bprofessor\b",
    r"\bteacher\b",
    r"\binstructor\b",
    r"\bsubject\b",
    r"\bclass\b",
    r"\bexam\b",
    r"\bquiz\b",
    r"\bsyllabus\b",
    r"\bcurriculum\b",
    r"\blesson\b",
    r"\bpresentation\b",
]

ADMINISTRATIVE_CATEGORY_PATTERNS = [
    r"\bregistrar\b",
    r"\benrollment\b",
    r"\bclearance\b",
    r"\bdocument",
    r"\bcertificate\b",
    r"\brequest form\b",
    r"\badvis(?:e|ing|er)\b",
    r"\bschedule\b",
    r"\brecord\b",
    r"\badmin(?:istrative)?\b",
]

FACILITY_CATEGORY_PATTERNS = [
    r"\bclassroom\b",
    r"\blaborator(?:y|ies)\b",
    r"\blab\b",
    r"\bwifi\b",
    r"\binternet\b",
    r"\bbuilding\b",
    r"\bfacility\b",
    r"\bequipment\b",
    r"\bchair\b",
    r"\btable\b",
    r"\btoilet\b",
]

FACILITY_CONTEXT_PATTERNS = [
    r"\bclassroom\b",
    r"\blaborator(?:y|ies)\b",
    r"\blab\b",
    r"\broom\b",
    r"\bbuilding\b",
    r"\bfacilit(?:y|ies)\b",
    r"\bcomputer\s+laboratory\b",
]

FACILITY_OBJECT_PATTERNS = [
    r"\bcomputer(?:s)?\b",
    r"\bequipment\b",
    r"\bchair(?:s)?\b",
    r"\bdesk(?:s)?\b",
    r"\btable(?:s)?\b",
    r"\btoilet(?:s)?\b",
    r"\bair\s*conditioner\b",
    r"\baircon\b",
    r"\binternet(?:\s+connection)?\b",
    r"\bwifi\b",
    r"\belectricity\b",
    r"\bpower\b",
    r"\bceiling\b",
]

FACILITY_PROBLEM_PATTERNS = [
    r"\bbroken\b",
    r"\bdamag(?:e|ed|ing)\b",
    r"\bdefective\b",
    r"\bnot\s+working\b",
    r"\bmalfunction(?:ing)?\b",
    r"\brepair\b",
    r"\bmaintenance\b",
    r"\bleak(?:ing)?\b",
    r"\bdirty\b",
    r"\bunsafe\b",
    r"\bpower\s+outage\b",
    r"\bno\s+electricity\b",
    r"\bno\s+power\b",
    r"\bno\s+internet\b",
    r"\bpoor\s+internet\b",
    r"\bslow\s+internet\b",
    r"\bno\s+wifi\b",
]

FINANCIAL_CATEGORY_PATTERNS = [
    r"\btuition\b",
    r"\bfee(?:s)?\b",
    r"\bpayment\b",
    r"\brefund\b",
    r"\bscholarship\b",
    r"\bbilling\b",
    r"\bfinancial\b",
]

SERVICE_QUALITY_PATTERNS = [
    r"\bservice\b",
    r"\bsupport\b",
    r"\bresponse\b",
    r"\bresponsive(?:ness)?\b",
    r"\bassistance\b",
    r"\bhelp desk\b",
    r"\bslow\b.{0,30}\bresponse\b",
    r"\bno\b.{0,20}\bresponse\b",
]

POLICY_ENFORCEMENT_PATTERNS = [
    r"\bpolicy\b",
    r"\brule(?:s)?\b",
    r"\bviolation\b",
    r"\brequirement(?:s)?\b",
    r"\bguideline(?:s)?\b",
    r"\battendance\b",
    r"\bdress code\b",
]


def model_dir_ready(model_dir):
    if not os.path.isdir(model_dir):
        return False

    required_files = ["config.json"]
    has_required_files = all(os.path.exists(os.path.join(model_dir, filename)) for filename in required_files)
    has_weights = any(
        os.path.exists(os.path.join(model_dir, filename))
        for filename in ("model.safetensors", "pytorch_model.bin")
    )

    return has_required_files and has_weights


def load_seq2seq_model(model_dir):
    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_dir)
    model.to(DEVICE)
    model.eval()
    return tokenizer, model


def load_classifier_model(model_dir):
    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(model_dir)
    model.to(DEVICE)
    model.eval()
    return tokenizer, model


def safe_load_seq2seq_model(model_dir, label):
    if ML_IMPORT_ERROR:
        print(
            f"[ai_pipeline] ML packages unavailable ({ML_IMPORT_ERROR}). Using fallback logic.",
            file=sys.stderr,
        )
        return None, None

    if not model_dir_ready(model_dir):
        print(f"[ai_pipeline] Missing local {label} model files in {model_dir}. Using fallback logic.", file=sys.stderr)
        return None, None

    try:
        return load_seq2seq_model(model_dir)
    except Exception as error:
        print(f"[ai_pipeline] Failed to load {label} model from {model_dir}: {error}", file=sys.stderr)
        return None, None


def safe_load_classifier_model(model_dir, label):
    if ML_IMPORT_ERROR:
        print(
            f"[ai_pipeline] ML packages unavailable ({ML_IMPORT_ERROR}). Using fallback logic.",
            file=sys.stderr,
        )
        return None, None

    if not model_dir_ready(model_dir):
        print(f"[ai_pipeline] Missing local {label} model files in {model_dir}. Using fallback logic.", file=sys.stderr)
        return None, None

    try:
        return load_classifier_model(model_dir)
    except Exception as error:
        print(f"[ai_pipeline] Failed to load {label} model from {model_dir}: {error}", file=sys.stderr)
        return None, None


sum_tokenizer, sum_model = safe_load_seq2seq_model(MODEL_DIRS["summarizer"], "summarizer")
cls_tokenizer, cls_model = safe_load_classifier_model(MODEL_DIRS["classifier"], "classifier")
urg_tokenizer, urg_model = safe_load_classifier_model(MODEL_DIRS["urgency"], "urgency")
sent_tokenizer, sent_model = safe_load_classifier_model(MODEL_DIRS["sentiment"], "sentiment")


def normalize_label(raw_label, group):
    label = str(raw_label or "").strip()
    if not label:
        return "--"

    mapped = FALLBACK_LABELS.get(group, {}).get(label, label)
    cleaned = str(mapped).replace("_", " ").strip()

    if group in {"urgency", "sentiment"}:
        return cleaned.lower()

    if group == "category":
        normalized_key = re.sub(r"[\s/_-]+", " ", cleaned).strip().lower()
        return CATEGORY_LABEL_ALIASES.get(normalized_key, cleaned.title())

    return cleaned.title()


def prepare_inputs(tokenizer, model, text, max_length):
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=max_length,
    )
    allowed_keys = set(inspect.signature(model.forward).parameters.keys())
    filtered = {key: value for key, value in inputs.items() if key in allowed_keys}
    return {key: value.to(DEVICE) for key, value in filtered.items()}


def normalize_category_key(value):
    return re.sub(r"[\s/_-]+", " ", str(value or "")).strip().lower()


def is_standalone_category_label(value):
    normalized = normalize_category_key(value)
    return normalized in CATEGORY_LABEL_KEYS or normalized in CATEGORY_LABEL_VALUES


def get_description_text(text):
    parts = [part.strip() for part in str(text or "").splitlines() if part.strip()]
    if not parts:
        return ""
    if len(parts) >= 2 and is_standalone_category_label(parts[0]):
        return " ".join(parts[1:3])
    if len(parts) >= 2:
        # Keep both the grievance title and main description so safety-critical
        # signals in the subject are not dropped before classification.
        return " ".join(parts[:2])
    return max(parts, key=len)


def strip_metadata_segments(text):
    cleaned = str(text or "").strip()
    if not cleaned:
        return ""

    lines = []
    metadata_prefixes = (
        "location:",
        "person involved:",
        "incident date:",
        "date:",
        "office:",
        "department:",
    )

    for raw_line in cleaned.splitlines():
        line = raw_line.strip()
        lowered = line.lower()
        if any(lowered.startswith(prefix) for prefix in metadata_prefixes):
            continue
        lines.append(line)

    cleaned = " ".join(lines)
    cleaned = re.sub(
        r"\b(?:Location|Person Involved|Incident Date|Date|Office|Department)\s*:\s*[^.?!;\n]+",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,;:-")
    return cleaned


def cleanup_generated_summary(summary):
    cleaned = strip_metadata_segments(summary)
    cleaned = re.sub(r"\b(?:Location|Person Involved|Incident Date|Department|Office)\b\s*$", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,;:-")

    if cleaned and cleaned[-1] not in ".!?":
        cleaned = f"{cleaned}."

    return cleaned


def build_fallback_summary(text, max_sentences=2, max_chars=280):
    source = strip_metadata_segments(get_description_text(text) or str(text or "").strip())
    if not source:
        return ""

    sentences = [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+", source)
        if sentence.strip()
    ]

    if not sentences:
        return source[:max_chars].strip()

    summary_parts = []
    total_length = 0
    for sentence in sentences[:max_sentences]:
        next_length = total_length + len(sentence) + (1 if summary_parts else 0)
        if next_length > max_chars and summary_parts:
            break
        summary_parts.append(sentence)
        total_length = next_length

    summary = " ".join(summary_parts).strip()
    if summary:
        return summary

    return source[:max_chars].strip()


def classify_category_fallback(text):
    normalized = str(text or "").lower()
    rules = [
        ("Harassment/Discrimination", ["harass", "bully", "discriminat", "molest", "sexual harassment", "abuse"]),
        ("Unfair Treatment", ["unfair", "favoritism", "bias", "humiliat", "embarrass"]),
        ("Financial Matters", ["tuition", "fee", "payment", "refund", "scholarship", "billing", "financial"]),
        ("Policy Enforcement", ["policy", "rule", "violation", "requirement", "attendance"]),
        ("Administrative Concerns", ["registrar", "document", "clearance", "schedule", "enrollment", "adviser", "advising", "admin"]),
        ("Academic Issues", ["grade", "grading", "professor", "teacher", "instructor", "subject", "class", "exam", "academic", "syllabus"]),
        ("Service Quality", ["service", "support", "response", "responsiveness", "assistance"]),
    ]

    for label, keywords in rules:
        if any(keyword in normalized for keyword in keywords):
            return {
                "index": -1,
                "label": label,
                "rawLabel": "fallback_rule",
                "confidence": 0.55,
            }

    if is_facility_problem_complaint(normalized):
        return {
            "index": -1,
            "label": "Facility Problems",
            "rawLabel": "fallback_rule",
            "confidence": 0.55,
        }

    return {
        "index": -1,
        "label": "Other",
        "rawLabel": "fallback_default",
        "confidence": 0.35,
    }


def classify_urgency_fallback(text):
    normalized = str(text or "").lower()
    if any(keyword in normalized for keyword in ["rape", "sexual assault", "suicide", "kill", "death", "molest", "critical"]):
        label = "critical"
    elif any(keyword in normalized for keyword in ["harass", "threat", "abuse", "injury", "violence", "urgent", "immediately"]):
        label = "high"
    elif any(keyword in normalized for keyword in ["delay", "problem", "issue", "concern", "unfair"]):
        label = "medium"
    else:
        label = "low"

    return {
        "index": -1,
        "label": label,
        "rawLabel": "fallback_rule",
        "confidence": 0.5,
    }


def classify_sentiment_fallback(text):
    normalized = str(text or "").lower()
    if any(keyword in normalized for keyword in ["thank", "resolved", "appreciate", "happy"]):
        label = "positive"
    elif any(keyword in normalized for keyword in ["problem", "complaint", "unfair", "harass", "abuse", "bad", "delay"]):
        label = "negative"
    else:
        label = "neutral"

    return {
        "index": -1,
        "label": label,
        "rawLabel": "fallback_rule",
        "confidence": 0.5,
    }


def matches_any_pattern(text, patterns):
    normalized = str(text or "").lower()
    return any(re.search(pattern, normalized, flags=re.IGNORECASE) for pattern in patterns)


def is_facility_problem_complaint(text):
    normalized = str(text or "").lower()
    has_context = matches_any_pattern(normalized, FACILITY_CONTEXT_PATTERNS)
    has_object = matches_any_pattern(normalized, FACILITY_OBJECT_PATTERNS)
    has_problem = matches_any_pattern(normalized, FACILITY_PROBLEM_PATTERNS)
    return has_problem and (has_context or has_object)


def make_override_result(base_result, label, confidence=0.995):
    overridden = dict(base_result or {})
    overridden["index"] = -1
    overridden["label"] = normalize_label(label, "category" if label not in URGENCY_RANK and label not in {"negative", "neutral", "positive"} else ("urgency" if label in URGENCY_RANK else "sentiment"))
    overridden["rawLabel"] = "safety_override"
    overridden["confidence"] = round(confidence, 4)
    return overridden


def infer_category_override(text):
    normalized_text = strip_metadata_segments(text).lower()

    if matches_any_pattern(normalized_text, HARASSMENT_CATEGORY_PATTERNS) or matches_any_pattern(normalized_text, CRITICAL_SAFETY_PATTERNS):
        return "Harassment/Discrimination", 0.93

    if matches_any_pattern(normalized_text, FINANCIAL_CATEGORY_PATTERNS):
        return "Financial Matters", 0.86

    if is_facility_problem_complaint(normalized_text):
        return "Facility Problems", 0.86

    if matches_any_pattern(normalized_text, POLICY_ENFORCEMENT_PATTERNS):
        return "Policy Enforcement", 0.84

    if matches_any_pattern(normalized_text, ACADEMIC_CATEGORY_PATTERNS):
        return "Academic Issues", 0.86

    if matches_any_pattern(normalized_text, ADMINISTRATIVE_CATEGORY_PATTERNS):
        return "Administrative Concerns", 0.84

    if matches_any_pattern(normalized_text, SERVICE_QUALITY_PATTERNS):
        return "Service Quality", 0.82

    if matches_any_pattern(normalized_text, UNFAIR_TREATMENT_CATEGORY_PATTERNS) or matches_any_pattern(normalized_text, HUMILIATION_PATTERNS):
        return "Unfair Treatment", 0.84

    return None, None


def apply_safety_overrides(text, category_result, urgency_result, sentiment_result):
    normalized_text = strip_metadata_segments(text).lower()
    updated_category = dict(category_result or {})
    updated_urgency = dict(urgency_result or {})
    updated_sentiment = dict(sentiment_result or {})

    predicted_urgency = str(updated_urgency.get("label") or "").lower()
    predicted_category = str(updated_category.get("label") or "").lower()
    predicted_sentiment = str(updated_sentiment.get("label") or "").lower()

    is_critical_safety_case = matches_any_pattern(normalized_text, CRITICAL_SAFETY_PATTERNS)
    is_high_safety_case = is_critical_safety_case or matches_any_pattern(normalized_text, HIGH_SAFETY_PATTERNS)
    is_unwanted_contact_case = matches_any_pattern(normalized_text, UNWANTED_CONTACT_PATTERNS)
    has_humiliation_signal = matches_any_pattern(normalized_text, HUMILIATION_PATTERNS)

    if is_critical_safety_case:
        updated_urgency = make_override_result(updated_urgency, "critical", confidence=0.95)
    elif is_high_safety_case and predicted_urgency != "high":
        updated_urgency = make_override_result(updated_urgency, "high", confidence=0.9)

    if is_unwanted_contact_case and not is_critical_safety_case:
        # Non-sexual unwanted physical contact should be treated as misconduct,
        # but not escalated to the top severity reserved for critical safety cases.
        updated_urgency = make_override_result(updated_urgency, "high", confidence=0.92)

    if is_high_safety_case or is_unwanted_contact_case:
        updated_category = make_override_result(updated_category, "Harassment/Discrimination", confidence=0.94)

    if not (is_high_safety_case or is_unwanted_contact_case):
        inferred_category, inferred_confidence = infer_category_override(normalized_text)
        if inferred_category and predicted_category != inferred_category.lower():
            updated_category = make_override_result(updated_category, inferred_category, confidence=inferred_confidence)

    if is_high_safety_case and predicted_sentiment in {"neutral", "positive", ""}:
        updated_sentiment = make_override_result(updated_sentiment, "negative", confidence=0.92)

    if (is_unwanted_contact_case or has_humiliation_signal) and predicted_sentiment in {"neutral", "positive", ""}:
        updated_sentiment = make_override_result(updated_sentiment, "negative", confidence=0.9)

    return updated_category, updated_urgency, updated_sentiment


def summarize(text):
    source_text = strip_metadata_segments(get_description_text(text) or text)
    if not source_text:
        return ""

    # Short complaint descriptions are usually better served by a direct extractive summary.
    if len(source_text) <= 280:
        return build_fallback_summary(source_text)

    if not sum_tokenizer or not sum_model:
        return build_fallback_summary(source_text)

    inputs = prepare_inputs(sum_tokenizer, sum_model, source_text, 1024)
    with torch.inference_mode():
        outputs = sum_model.generate(
            **inputs,
            max_length=142,
            min_length=16,
            num_beams=4,
            no_repeat_ngram_size=3,
            early_stopping=True,
        )
    summary = cleanup_generated_summary(sum_tokenizer.decode(outputs[0], skip_special_tokens=True).strip())
    if not summary:
        return build_fallback_summary(source_text)

    fallback_summary = build_fallback_summary(source_text)
    if not summary or len(summary) < 24:
        return fallback_summary

    return summary


def classify_with_confidence(text, tokenizer, model, group):
    if not tokenizer or not model:
        raise RuntimeError(f"Trained {group} model is unavailable; check model files and Python dependencies")

    inputs = prepare_inputs(tokenizer, model, text, 512)

    with torch.inference_mode():
        outputs = model(**inputs)
        probabilities = torch.softmax(outputs.logits, dim=-1)[0]

    index = int(torch.argmax(probabilities).item())
    confidence = float(probabilities[index].item())
    raw_label = model.config.id2label.get(index) or model.config.id2label.get(str(index)) or f"LABEL_{index}"

    return {
        "index": index,
        "label": normalize_label(raw_label, group),
        "rawLabel": raw_label,
        "confidence": round(confidence, 4),
    }


def analyze(text):
    clean_text = str(text or "").strip()
    if not clean_text:
        raise ValueError("Text is required for AI analysis")

    analysis_text = strip_metadata_segments(get_description_text(clean_text) or clean_text) or clean_text
    summary = summarize(clean_text) or clean_text
    category_result = classify_with_confidence(analysis_text, cls_tokenizer, cls_model, "category")
    urgency_result = classify_with_confidence(analysis_text, urg_tokenizer, urg_model, "urgency")
    sentiment_result = classify_with_confidence(analysis_text, sent_tokenizer, sent_model, "sentiment")

    return {
        "source": "trained_model",
        "summary": summary,
        "category": category_result,
        "urgency": urgency_result,
        "sentiment": sentiment_result,
    }


def print_json(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=True) + "\n")
    sys.stdout.flush()


def run_worker():
    print_json({"type": "ready"})

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        request_id = None
        try:
            payload = json.loads(line)
            request_id = payload.get("id")
            text = payload.get("text", "")
            result = analyze(text)
            print_json({"id": request_id, "result": result})
        except Exception as error:
            print_json({"id": request_id, "error": str(error)})


def main():
    parser = argparse.ArgumentParser(description="Local AI pipeline for grievance analysis")
    parser.add_argument("--worker", action="store_true", help="Run as a JSON line worker for the Node backend")
    parser.add_argument("--text", type=str, help="Analyze a single piece of text and print JSON output")
    args = parser.parse_args()

    if args.worker:
        run_worker()
        return

    if args.text:
        print_json(analyze(args.text))
        return

    parser.print_help()


if __name__ == "__main__":
    main()
