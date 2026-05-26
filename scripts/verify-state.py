#!/usr/bin/env python3
import json
import re
from pathlib import Path


def main() -> None:
    data = json.loads(Path("feature_list.json").read_text())
    if not isinstance(data, dict) or not isinstance(data.get("features"), list):
        raise SystemExit("feature_list.json must contain a top-level features array")

    seen = set()
    allowed_statuses = {"todo", "in_progress", "done", "blocked"}
    for index, feature in enumerate(data["features"], start=1):
        if not isinstance(feature, dict):
            raise SystemExit(f"feature #{index} must be an object")
        for key in ["id", "description", "passes"]:
            if key not in feature:
                raise SystemExit(f"feature #{index} missing required key: {key}")
        fid = feature["id"]
        if not isinstance(fid, str) or not re.fullmatch(r"F\d{3}", fid):
            raise SystemExit(f"invalid feature id: {fid!r}")
        if fid in seen:
            raise SystemExit(f"duplicate feature id: {fid}")
        seen.add(fid)
        if not isinstance(feature["passes"], bool):
            raise SystemExit(f"passes must be boolean for {fid}")
        status = feature.get("status", "todo")
        if status not in allowed_statuses:
            raise SystemExit(f"invalid status for {fid}: {status!r}")
        if feature["passes"] is True and status != "done":
            raise SystemExit(f"passes=true requires status=done for {fid}")
        if feature["passes"] is False and status == "done":
            raise SystemExit(f"passes=false conflicts with status=done for {fid}")

    print(f"validated {len(seen)} features")


if __name__ == "__main__":
    main()
