import re
import time
import json
import logging
import argparse
from pathlib import Path
from dataclasses import dataclass, asdict

import ollama
import pandas as pd
from tqdm import tqdm

MODEL        = "qwen3:8b"       
BATCH_SIZE   = 25               
BATCHES_PER_DOMAIN = 67   
TEMPERATURE  = 0.85
OUTPUT_DIR   = Path("data")
LOG_FILE     = OUTPUT_DIR / "generation.log"

DOMAINS = [
    "general_knowledge",
    "science",
    "history",
    "technology",
    "programming",
    "law",
]

VALID_LABELS = {"POSITIVE", "NEGATIVE", "NEUTRAL"}


MAIN_PROMPT = """You are generating a dataset of realistic user follow-up messages in a chatbot conversation.
These are short responses a user sends AFTER receiving an answer from an AI assistant.

The messages should reflect how the user FEELS about the AI's response:
- POSITIVE: User is satisfied, impressed, agrees, or finds the answer helpful or correct
- NEGATIVE: User is frustrated, disagrees, finds the answer wrong, incomplete, or unhelpful
- NEUTRAL: User acknowledges without opinion, asks a follow-up question, or requests clarification with zero emotional language

Rules:
- Write natural, conversational language (occasional typos, informal tone, abbreviations are fine)
- Vary length: some very short (2-5 words), some longer (up to 25 words)
- POSITIVE must express satisfaction or validation — not just politeness
- NEGATIVE must express dissatisfaction, correction, or frustration — not just confusion
- NEUTRAL must contain zero emotional or evaluative words — pure follow-up questions or factual acknowledgments only
- Do NOT include domain facts in the text — focus only on the USER'S REACTION to the answer
- Output format must be exactly one example per line: LABEL: "text"
- Generate exactly {N} examples, roughly balanced across the 3 classes
- Do not add explanations, numbering, blank lines between examples, or any other text"""


DOMAIN_PROMPTS = {
    "general_knowledge": """The user has just received an answer from an AI chatbot about a general knowledge or factual question (e.g., geography, famous people, world records, everyday facts, language, culture).

Generate {N} user follow-up messages reacting to the chatbot's response.

Few-shot examples:
POSITIVE: "oh wow i didnt know that, super helpful!"
POSITIVE: "That answered exactly what I was looking for, thanks."
POSITIVE: "Makes total sense now, I was overthinking it."
POSITIVE: "Didn't expect that, really good to know."
NEGATIVE: "No that's not right, I looked it up and got a different answer."
NEGATIVE: "This is confusing and doesn't actually answer my question."
NEGATIVE: "You gave me two contradictory facts in the same response."
NEGATIVE: "That's a really incomplete answer tbh."
NEUTRAL: "Ok. What about the population of the same country in 1990?"
NEUTRAL: "Got it. Is that the same for all regions or just some?"
NEUTRAL: "Can you give me a source for that?"
NEUTRAL: "What's the unit used to measure that?"
""",

    "science": """The user has just received an answer from an AI chatbot about a science topic (e.g., physics, chemistry, biology, astronomy, environmental science, medicine).

Generate {N} user follow-up messages reacting to the chatbot's response.

Few-shot examples:
POSITIVE: "Finally an explanation that actually clicked for me!"
POSITIVE: "That's a really clear breakdown, ty."
POSITIVE: "I've read 3 articles on this and yours is the clearest by far."
POSITIVE: "Wow that's genuinely fascinating, I had no idea."
NEGATIVE: "That contradicts what my textbook says."
NEGATIVE: "You forgot to mention a key factor that completely changes the answer."
NEGATIVE: "This feels oversimplified and skips the most important part."
NEGATIVE: "That's just wrong, please double check."
NEUTRAL: "Does the same principle apply to exothermic reactions?"
NEUTRAL: "What's the difference between that and nuclear fission then?"
NEUTRAL: "Can you explain that using a simpler analogy?"
NEUTRAL: "At what temperature does that process stop occurring?"
""",

    "history": """The user has just received an answer from an AI chatbot about a history topic (e.g., wars, civilizations, historical figures, timelines, revolutions, political events).

Generate {N} user follow-up messages reacting to the chatbot's response.

Few-shot examples:
POSITIVE: "I never connected those two events before — great context."
POSITIVE: "That's exactly the level of detail I needed for my essay."
POSITIVE: "Wow didn't realize how much that shaped modern politics."
POSITIVE: "Really well explained, thanks."
NEGATIVE: "Pretty sure the date you gave is off by at least a decade."
NEGATIVE: "You're presenting one side of the story as if it's established fact."
NEGATIVE: "That's a common myth, historians have largely debunked this."
NEGATIVE: "You completely skipped over the most significant part of that period."
NEUTRAL: "What happened in that region after the conflict ended?"
NEUTRAL: "Was that the same ruler who also controlled the eastern territories?"
NEUTRAL: "Can you put that on a timeline with the other events we discussed?"
NEUTRAL: "How long did that period last approximately?"
""",

    "technology": """The user has just received an answer from an AI chatbot about a technology topic (e.g., how devices work, software, the internet, AI, cybersecurity, consumer tech, networking).

Generate {N} user follow-up messages reacting to the chatbot's response.

Few-shot examples:
POSITIVE: "That actually explained encryption better than any video I've watched."
POSITIVE: "Okay that makes way more sense now, I was totally wrong about how it works."
POSITIVE: "Perfect, that's all I needed to know."
POSITIVE: "Great explanation, really appreciate the detail."
NEGATIVE: "That's outdated — they deprecated that two years ago."
NEGATIVE: "You didn't mention anything about the security risks which is kind of important."
NEGATIVE: "I followed these steps exactly and it still doesn't work."
NEGATIVE: "That answer is way too vague to actually be useful."
NEUTRAL: "Does that apply to both iOS and Android?"
NEUTRAL: "What's the difference between that and a VPN then?"
NEUTRAL: "How does that change with the newer hardware generation?"
NEUTRAL: "Is that a software limitation or a hardware one?"
""",

    "programming": """The user has just received a code snippet, explanation, or debugging help from an AI chatbot about a programming problem.

Generate {N} user follow-up messages reacting to the chatbot's response.

Few-shot examples:
POSITIVE: "That fixed it instantly, thank you so much!"
POSITIVE: "Clean solution, I wouldn't have thought to use that approach."
POSITIVE: "Works perfectly and the explanation helped me understand WHY, not just what."
POSITIVE: "This is exactly what I was looking for."
NEGATIVE: "This throws a TypeError on line 4, did you test this?"
NEGATIVE: "That solution is O(n²), I specifically asked for something efficient."
NEGATIVE: "You changed the logic entirely, that's not what I asked you to fix."
NEGATIVE: "That doesn't handle the edge case I described at all."
NEUTRAL: "What does the double asterisk do in that function signature?"
NEUTRAL: "Would this still work if the input list is empty?"
NEUTRAL: "Can you rewrite this in TypeScript instead?"
NEUTRAL: "What's the time complexity of that solution?"
""",

    "law": """The user has just received a general legal explanation from an AI chatbot (e.g., rights, contracts, legal processes, terminology, jurisdiction differences, court procedures).

Generate {N} user follow-up messages reacting to the chatbot's response.

Few-shot examples:
POSITIVE: "That cleared up exactly what I was confused about in the contract."
POSITIVE: "Good explanation, I finally understand the difference now."
POSITIVE: "I'll bring this up with my lawyer now that I know what to ask."
POSITIVE: "Really helpful breakdown, thanks."
NEGATIVE: "That's not how it works in my state, the law differs here."
NEGATIVE: "You gave a vague answer that doesn't actually help me understand my rights."
NEGATIVE: "I've read the statute and it says the opposite of what you told me."
NEGATIVE: "You glossed over the most important exception to that rule."
NEUTRAL: "Does that change if the contract was signed in a different country?"
NEUTRAL: "What would happen if someone violated that clause?"
NEUTRAL: "Is there a specific legal term for what you just described?"
NEUTRAL: "Does that apply to both civil and criminal cases?"
""",
}


@dataclass
class Example:
    text:   str
    label:  str
    domain: str
    batch:  int


LINE_RE = re.compile(
    r"^\s*(POSITIVE|NEGATIVE|NEUTRAL)\s*:\s*[\"']?(.+?)[\"']?\s*$",
    re.IGNORECASE,
)

def parse_response(raw: str, domain: str, batch_idx: int) -> list[Example]:
    examples = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        m = LINE_RE.match(line)
        if not m:
            continue
        label, text = m.group(1).upper(), m.group(2).strip().strip("\"'")
        if label not in VALID_LABELS:
            continue
        if len(text.split()) < 2 or len(text.split()) > 40:
            continue
        examples.append(Example(text=text, label=label, domain=domain, batch=batch_idx))
    return examples


def build_prompt(domain: str, n: int) -> str:
    domain_block = DOMAIN_PROMPTS[domain].replace("{N}", str(n))
    main_block   = MAIN_PROMPT.replace("{N}", str(n))
    return f"{main_block}\n\n{domain_block}\n\nGenerate exactly {n} examples now:"


def generate_batch(domain: str, batch_idx: int, n: int, logger: logging.Logger) -> list[Example]:
    prompt = build_prompt(domain, n)
    try:
        response = ollama.chat(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            options={
                "temperature": TEMPERATURE,
                "num_predict": n * 40,   
                "top_p": 0.9,
            },
            think=False,   
        )
        raw = response["message"]["content"]
        examples = parse_response(raw, domain, batch_idx)
        logger.debug(f"[{domain}] batch {batch_idx}: got {len(examples)} valid examples")
        return examples
    except Exception as e:
        logger.warning(f"[{domain}] batch {batch_idx} failed: {e}")
        return []


def save_dataset(examples: list[Example], output_dir: Path, logger: logging.Logger):
    output_dir.mkdir(parents=True, exist_ok=True)
    records = [asdict(e) for e in examples]
    df = pd.DataFrame(records)

    before = len(df)
    df = df.drop_duplicates(subset=["text"])
    logger.info(f"Removed {before - len(df)} exact duplicates. Final size: {len(df)}")

    csv_path = output_dir / "sentiment_dataset.csv"
    df.to_csv(csv_path, index=False)
    logger.info(f"Saved CSV  → {csv_path}")

    print("\n── Label Distribution ──────────────────")
    print(df["label"].value_counts().to_string())
    print("\n── Domain Distribution ─────────────────")
    print(df["domain"].value_counts().to_string())
    print(f"\nTotal examples: {len(df)}")

    return df


def setup_logger(log_file: Path) -> logging.Logger:
    log_file.parent.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("dataset_gen")
    logger.setLevel(logging.DEBUG)
    fh = logging.FileHandler(log_file, encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
    fh.setFormatter(fmt)
    ch.setFormatter(fmt)
    logger.addHandler(fh)
    logger.addHandler(ch)
    return logger


def main():
    global MODEL
    parser = argparse.ArgumentParser(description="Generate sentiment dataset via Ollama")
    parser.add_argument("--model",        default=MODEL,              help="Ollama model tag")
    parser.add_argument("--batch-size",   default=BATCH_SIZE,   type=int)
    parser.add_argument("--batches",      default=BATCHES_PER_DOMAIN, type=int,
                        help="Batches per domain")
    parser.add_argument("--domains",      default=",".join(DOMAINS),
                        help="Comma-separated list of domains to generate")
    parser.add_argument("--output-dir",   default=str(OUTPUT_DIR))
    parser.add_argument("--retry-limit",  default=3, type=int,
                        help="Max retries for batches that yield 0 examples")
    args = parser.parse_args()

    MODEL = args.model

    output_dir = Path(args.output_dir)
    logger     = setup_logger(output_dir / "generation.log")
    domains    = [d.strip() for d in args.domains.split(",")]

    logger.info(f"Model: {MODEL} | Batch size: {args.batch_size} | "
                f"Batches/domain: {args.batches} | Domains: {domains}")
    logger.info(f"Target examples: ~{args.batch_size * args.batches * len(domains):,}")

    all_examples: list[Example] = []
    total_batches = len(domains) * args.batches

    with tqdm(total=total_batches, desc="Generating", unit="batch") as pbar:
        for domain in domains:
            domain_examples: list[Example] = []
            for batch_idx in range(args.batches):
                retries = 0
                while retries <= args.retry_limit:
                    examples = generate_batch(domain, batch_idx, args.batch_size, logger)
                    if examples:
                        domain_examples.extend(examples)
                        break
                    retries += 1
                    logger.warning(f"[{domain}] batch {batch_idx}: retry {retries}/{args.retry_limit}")
                    time.sleep(1)
                pbar.update(1)
                pbar.set_postfix({"total": len(all_examples) + len(domain_examples)})

            logger.info(f"[{domain}] finished: {len(domain_examples)} raw examples")
            all_examples.extend(domain_examples)

            checkpoint_path = output_dir / f"checkpoint_{domain}.jsonl"
            checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
            with open(checkpoint_path, "w", encoding="utf-8") as f:
                for ex in domain_examples:
                    f.write(json.dumps(asdict(ex), ensure_ascii=False) + "\n")
            logger.info(f"Checkpoint saved → {checkpoint_path}")

    logger.info(f"Generation complete. Raw total: {len(all_examples):,} examples")
    save_dataset(all_examples, output_dir, logger)


if __name__ == "__main__":
    main()
