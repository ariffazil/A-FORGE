import asyncio
from fastmcp import FastMCP

async def test():
    mcp = FastMCP("test")

    @mcp.tool(name="arifos.test")
    def arifos_test(query: str) -> str:
        return f"result: {query}"

    tools = await mcp.list_tools()
    print(f"Tools: {[t.name for t in tools]}")

if __name__ == "__main__":
    asyncio.run(test())
