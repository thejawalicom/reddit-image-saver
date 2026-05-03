# Vibe Coding & Infrastructure Rules
- **Infrastructure First**: You have access to Cloudflare (Workers, D1, R2), Supabase, and Railway. Always prefer these for deployment and data storage over local alternatives.
- **Web Intelligence**: Before assuming API structures, use `brave-search` or `firecrawl` to fetch the latest documentation, especially for Cloudflare and Supabase.
- **Sequential Reasoning**: For any task requiring more than two steps, you MUST use the `sequential_thinking` MCP to map out the logic before writing code.
- **Automation stack**: Use `apify` or `browserbase` for any tasks involving complex web interaction or data extraction.
- **Hardware Context**: You are running on Apple Silicon (Mac Mini M4). Optimize local model execution or compilation scripts for this architecture.
- **Indexing**: Always utilize the Qdrant index for project context before asking follow-up questions.