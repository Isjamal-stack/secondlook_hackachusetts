# AI Integration Guidelines

## Current AI Provider
- **Provider**: OpenAI
- **Model**: gpt-4o-mini
- **Temperature**: 0.7 (creative but focused)
- **Max Tokens**: 400

## AI Output Format
The AI generates structured insights with these sections:

```
SUMMARY: [Description of issue with numbers and normal ranges]

LIKELY_CAUSES:
• [Component] - [X]% likely (Est. repair: $[range])
• [Component] - [Y]% likely (Est. repair: $[range])
• [Component] - [Z]% likely (Est. repair: $[range])

WHY_IT_MATTERS: [Consequences if ignored]

WHAT_TO_DO: [Specific action with timeframe]
```

## Parsing Logic
The frontend (`js/app.js`) parses these sections using regex and displays them under permanent subheadings:
- **What this means** → SUMMARY
- **Likely Causes** → LIKELY_CAUSES
- **Why It Matters** → WHY_IT_MATTERS
- **What To Do** → WHAT_TO_DO

## Modifying AI Behavior
To change how the AI responds:
1. Edit `server/ai_provider.py` → `generate_openai_explanation()` → system prompt
2. Keep the section labels (SUMMARY:, LIKELY_CAUSES:, etc.) for parsing
3. Test changes by restarting the server
4. Cache expires after 60 seconds or server restart

## Fallback Mode
When AI is unavailable (`AI_PROVIDER=none` or API error):
- Falls back to `template_explanations.py`
- Templates are deterministic and don't require API keys
- Useful for team members without API access

## Cost Considerations
- gpt-4o-mini is cost-effective (~$0.15 per 1M input tokens)
- Each explanation uses ~300-500 tokens
- Cache reduces redundant API calls
- Consider rate limiting for production
