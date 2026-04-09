import re

with open("/root/arifOS/arifosmcp/runtime/tools.py", "r") as f:
    content = f.read()

# Remove top-level megaTools imports
content = re.sub(r'from arifosmcp\.runtime\.megaTools import \(.*?\)', '', content, flags=re.DOTALL)

# Remove top-level tools_v2 imports
content = re.sub(r'from arifosmcp\.runtime\.tools_v2 import \(.*?\)', '', content, flags=re.DOTALL)

# Clean up any leftover imports that are no longer needed
# We already have envelope.py for our refactored functions.

with open("/root/arifOS/arifosmcp/runtime/tools.py", "w") as f:
    f.write(content)

print("Removed top-level circular imports from tools.py.")
