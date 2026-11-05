"""Confirm the same MCP tool trace reached the API in Compose logs."""

from pathlib import Path
import subprocess
import sys
import time


smoke_output = Path(sys.argv[1]).read_text()
trace_ids = [line.removeprefix("TRACE_ID=").strip()
             for line in smoke_output.splitlines() if line.startswith("TRACE_ID=")]
assert len(trace_ids) == 1 and len(trace_ids[0]) == 32, "Missing MCP trace ID"
trace_id = trace_ids[0]

for _ in range(20):
    logs = {}
    for service in ("api", "mcp"):
        result = subprocess.run(
            ["docker", "compose", "logs", "--no-color", service],
            capture_output=True, text=True, check=True,
        )
        logs[service] = result.stdout.lower()
    if all(trace_id in log for log in logs.values()):
        print("PASS: MCP and API exported the same trace ID")
        break
    time.sleep(0.5)
else:
    raise AssertionError("Trace ID was not found in both MCP and API logs")
