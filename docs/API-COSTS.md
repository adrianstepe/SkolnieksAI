# API Costs & Unit Economics — SkolnieksAI

## DeepSeek V3.2 Pricing (Free Tier LLM)

| Metric        | Price / 1M tokens |
|---------------|-------------------|
| Cache hit     | $0.028            |
| Cache miss    | $0.28             |
| Output        | $0.42             |

Auto prefix caching: requests sharing same system prompt prefix get cache hits automatically. Our RAG system prompt + Skola2030 context chunks will cache well across same-subject queries.

### Per-Query Cost Estimate (Free Tier)

| Component          | Tokens | Cache? | Cost       |
|--------------------|--------|--------|------------|
| System prompt      | ~500   | Hit    | $0.000014  |
| Retrieved chunks   | ~2500  | Miss   | $0.000700  |
| User message       | ~100   | Miss   | $0.000028  |
| Output             | ~800   | N/A    | $0.000336  |
| **Total per query**|        |        | **~$0.001**|

With optimization (high cache hit rates): ~$0.0005 per query.

## Claude Sonnet 4.6 Pricing (Paid Tier LLM)

| Metric       | Price / 1M tokens |
|--------------|-------------------|
| Input        | $3.00             |
| Output       | $15.00            |

### Per-Query Cost Estimate (Paid Tier)

| Component          | Tokens | Cost       |
|--------------------|--------|------------|
| System + chunks    | ~3000  | $0.009     |
| User message       | ~100   | $0.0003    |
| Output             | ~800   | $0.012     |
| **Total per query**|        | **~$0.021**|

## Monthly Cost Projections

### Scenario: 10,000 Free Users

- Avg queries/user/month: 15 (most won't hit 60 cap)
- Total queries: 150,000
- Cost per query: $0.001
- **Monthly DeepSeek cost: ~$150 (€140)**

### Scenario: Adding 100 Paid Users

- Avg queries/user/month: 40 (power users)
- Total queries: 4,000
- Cost per query: $0.021
- **Monthly Claude cost: ~$84 (€78)**
- Revenue: 100 × €5.99 = €599
- **Gross margin on paid: ~87%**

### Break-Even Analysis

| Cost Item       | Monthly     |
|-----------------|-------------|
| Vercel          | €0          |
| ChromaDB VPS    | €5          |
| Firebase (Blaze)| €5–15       |
| DeepSeek API    | €35–350     |
| Claude API      | €0–100      |
| Domain          | €1          |
| **Total**       | **€46–471** |

Break-even at ~€46/month = 8 Premium subscribers.
Break-even at €350/month (10k free users) = ~60 Premium subscribers.

## Token Budget Design

### Free Tier Budget

Monthly token cap: 150,000 tokens (input + output combined)
- Conservative estimate: ~60 questions/month
- We track actual tokens, not query count — fairer and harder to game
- Budget visible to us in Firestore, NOT shown as counter to user

### Why Hidden Budget?

Showing "You have 47 questions left" creates anxiety and feels restrictive.
Instead: let them use naturally until budget runs out, then show:
"Šodien esi daudz mācījies! Lai turpinātu, izmēģini Premium plānu."
(You've learned a lot today! To continue, try the Premium plan.)

## Pricing Tiers

| Tier       | Price      | LLM           | Token Budget     |
|------------|------------|---------------|------------------|
| Free       | €0         | DeepSeek V3.2 | 150K tokens/mo   |
| Premium    | €5.99/mo   | Claude Sonnet | Unlimited*       |
| Exam Prep  | €14.99/mo  | Claude Sonnet | Unlimited*       |
| School Pro | €20/student/yr or €1,000/mo | Claude Sonnet | Unlimited* |

*"Unlimited" = soft cap at 1M tokens/month. Extremely generous — no normal student hits this.

## Cost Optimization Strategies

1. **Maximize DeepSeek cache hits**: Keep system prompt identical across all free-tier requests per subject. Retrieved chunks vary, but the prefix caches.
2. **Limit conversation history**: Only include last 3 exchanges (6 messages) in context.
3. **Short output cap for free tier**: `max_tokens: 1000` (vs 2000 for paid).
4. **Aggressive chunking**: 500 tokens per chunk, only top-5 retrieved. Total retrieval context ~2500 tokens.
5. **Monitor daily**: Track `usage` collection totals, set alerts at budget thresholds.
