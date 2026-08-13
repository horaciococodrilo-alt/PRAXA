from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "backend" / "migrations" / "versions"


def main() -> int:
    errors: list[str] = []
    for path in sorted(MIGRATIONS.glob("*.py")):
        text = path.read_text(encoding="utf-8")
        if re.search(r"(?<!NO)BYPASSRLS", text, re.IGNORECASE):
            errors.append(f"{path}: forbidden BYPASSRLS")
        if re.search(r"TO\s+PUBLIC", text, re.IGNORECASE):
            errors.append(f"{path}: policy or grant targets PUBLIC")
        if "app.role" in text:
            errors.append(f"{path}: app.role must not participate in database policies")
        for statement in re.findall(r"CREATE POLICY.*?(?=\n\s*(?:\"\"\"|op\.execute))", text, re.DOTALL):
            if "TO praxa_app" not in statement:
                errors.append(f"{path}: CREATE POLICY is not explicit TO praxa_app")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print("Security migration guards passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
