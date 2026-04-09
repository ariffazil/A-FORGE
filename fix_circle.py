import re

with open("/root/arifOS/arifosmcp/runtime/tools.py", "r") as f:
    content = f.read()

# Remove top-level megaTools imports
content = re.sub(r'from arifosmcp\.runtime\.megaTools import \(.*?\)', '', content, flags=re.DOTALL)

# Add local imports inside functions
def add_local_import(func_name, mega_name):
    global content
    pattern = rf'async def {func_name}\(.*?\) -> RuntimeEnvelope:'
    replacement = rf'async def {func_name}(\1) -> RuntimeEnvelope:\n    from arifosmcp.runtime.megaTools import {mega_name} as _mega_{mega_name}'
    # This is complex with regex, let's use a simpler approach
    content = content.replace(f"result = await _mega_{mega_name}", f"from arifosmcp.runtime.megaTools import {mega_name} as _mega_{mega_name}\n    result = await _mega_{mega_name}")

# Wait, my previous refactor replaced the whole functions with new ones that use envelope.py!
# So _mega_agi_mind is no longer used in the refactored functions.
# Let's check tools.py content now.
